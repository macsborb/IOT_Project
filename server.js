

const path = require('path');
const http = require('http');
const WebSocket = require("ws");
const express = require('express');
const mysql = require('mysql2/promise');
const crypto = require('crypto');

const serverPort = 80;

const clients = {};
let lastArduinoHeartbeat = 0; // Initialement pas de heartbeat
let arduinoStatus = false; // Initialement hors ligne

// Vérifier l'état de l'Arduino toutes les 5 secondes
setInterval(() => {
    const now = Date.now();
    // Si jamais reçu de heartbeat, reste hors ligne
    if (lastArduinoHeartbeat === 0) {
        if (arduinoStatus) {
            arduinoStatus = false;
            notifyArduinoStatus(false);
        }
        return;
    }

    const timeSinceLastHeartbeat = now - lastArduinoHeartbeat;
    console.log('Time since last heartbeat:', timeSinceLastHeartbeat, 'ms');
    
    const newStatus = timeSinceLastHeartbeat < 15000; // 15 secondes timeout
    if (newStatus !== arduinoStatus) {
        console.log('Arduino status changed:', newStatus ? 'online' : 'offline');
        arduinoStatus = newStatus;
        notifyArduinoStatus(newStatus);
    }
}, 5000);

// Fonction utilitaire pour notifier tous les clients du changement d'état de l'Arduino
function notifyArduinoStatus(status) {
    const message = JSON.stringify({
        type: "StateChanged",
        sensor: "arduino",
        state: status
    });
    for (let client in clients) {
        clients[client].send(message);
    }
}

//#region MYSQL Database
// ========================
// ===  MYSQL DATABASE  ===
// ========================
const mysqlConfig = {
    namedPlaceholders: true,
    host: process.env.DB_HOSTNAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT
};
// Create a MySQL connection pool
const pool = mysql.createPool(mysqlConfig);
//#endregion MYSQL Database

const app = express();
const server = http.createServer(app);

app.use(express.static(path.join(__dirname, 'front')));

// Route pour le heartbeat de l'Arduino
app.get("/heartbeat", (req, res) => {
    const now = Date.now();
    lastArduinoHeartbeat = now;
    console.log('Heartbeat received at:', new Date(now).toISOString());
    
    if (!arduinoStatus) {
        console.log('Arduino coming online');
        arduinoStatus = true;
        notifyArduinoStatus(true);
    }
    res.sendStatus(200);
});

let activeSensors = {};

app.get("/sensorEvent", async (req, res) => {
    const sensor = req.query.sensor;
    const state = (req.query.state == "true") ? true : false;
    const currentTime = new Date();

    if (state) {
        // Si le capteur devient actif
        if (!activeSensors[sensor]) {
            activeSensors[sensor] = {
                startTime: currentTime,
                logId: null
            };
            // Créer une nouvelle entrée dans les logs
            const result = await pool.query(
                "INSERT INTO logs SET sensor = :sensor, start_time = :startTime",
                { sensor: sensor, startTime: currentTime }
            );
            activeSensors[sensor].logId = result[0].insertId;
        }
    } else {
        // Si le capteur devient inactif
        if (activeSensors[sensor]) {
            const duration = Math.round((currentTime - activeSensors[sensor].startTime) / 1000); // durée en secondes
            await pool.query(
                "UPDATE logs SET end_time = :endTime, duration = :duration WHERE id = :id",
                {
                    endTime: currentTime,
                    duration: duration,
                    id: activeSensors[sensor].logId
                }
            );
            delete activeSensors[sensor];
        }
    }

    notifyClients(sensor, state, currentTime);
    console.log(`Sensor ${sensor}: ${state}`);
    res.sendStatus(200);
});

//#region Websocket
//  ==================
//  === Websocket  ===
//  ==================
const wss = new WebSocket.Server({server: server});
wss.on('connection', (socket, req) => {
    const uuid = crypto.randomUUID();
    socket.id = uuid;
    clients[uuid] = socket;

    // Envoyer l'état actuel de l'Arduino au nouveau client
    socket.send(JSON.stringify({
        type: "StateChanged",
        sensor: "arduino",
        state: arduinoStatus
    }));

    socket.on("message", async (data) => {
        console.log(data.toString())
        const message = JSON.parse(data.toString());

        switch (message.type) {

            case "getHistory":
                const filters = message.filters || {};
                let query = "SELECT * FROM logs WHERE 1=1";
                const params = {};

                if (filters.sensor) {
                    query += " AND sensor = :sensor";
                    params.sensor = filters.sensor;
                }
                if (filters.minDuration) {
                    query += " AND duration >= :minDuration";
                    params.minDuration = parseInt(filters.minDuration);
                }
                if (filters.maxDuration) {
                    query += " AND duration <= :maxDuration";
                    params.maxDuration = parseInt(filters.maxDuration);
                }
                if (filters.startDateTime) {
                    query += " AND DATE_FORMAT(start_time, '%Y-%m-%d %H:%i:%s') >= :startDateTime";
                    const startDate = new Date(filters.startDateTime);
                    params.startDateTime = startDate.toISOString().slice(0, 19).replace('T', ' ');
                }
                if (filters.endDateTime) {
                    query += " AND DATE_FORMAT(start_time, '%Y-%m-%d %H:%i:%s') <= :endDateTime";
                    const endDate = new Date(filters.endDateTime);
                    params.endDateTime = endDate.toISOString().slice(0, 19).replace('T', ' ');
                }

                const order = filters.order || 'DESC';
                query += ` ORDER BY start_time ${order} LIMIT 200`;
                
                console.log('Query:', query);
                console.log('Params:', params);
                let result = await pool.query(query, params);
                socket.send(JSON.stringify({type: message.type, content: result[0]}));
                break;
        }
    });
    
    socket.on("close", () => {
        delete clients[socket.id];
    })
});
//#endregion Websocket


//#region Start Server
// =======================
//  ===  START SERVER  ===
// =======================
server.listen(serverPort, () => {
    console.log('Server is running on port ' + serverPort);
});
//#endregion Start Server

function notifyClients(sensor, state, time) {
    for (let client in clients) {
        clients[client].send(JSON.stringify({
            type: "StateChanged",
            sensor: sensor,
            state: state,
            time: time
        }));
    }
}