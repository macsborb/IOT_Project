# IOT\_Project – Système de Détection IoT

## 🗂️ Sommaire

- [📖 Introduction](#introduction)
- [✨ Fonctionnalités Clés](#fonctionnalités-clés)
- [🏗️ Architecture du Système](#architecture-du-système)
- [⚡️ Installation et Configuration](#installation-et-configuration)
- [🌐 Utilisation de l’Application](#utilisation-de-lapplication)
- [🗄️ Structure de la Base de Données](#structure-de-la-base-de-données)
- [⏳ Lancement et Arrêt de l’Environnement](#lancement-et-arrêt-de-lenvironnement)
- [✅ Conclusion](#conclusion)

## 📖 Introduction

IOT\_Project est une solution de surveillance IoT en temps réel, permettant de récupérer, afficher et stocker l’état de capteurs (tactile, sonore, infrarouge). L’application repose sur Arduino, Node.js, MySQL, et WebSocket.

## ✨ Fonctionnalités Clés

- Surveillance en temps réel
- Historisation des événements
- Authentification sécurisée
- Détection de connexion/déconnexion de l’Arduino
- Déploiement simplifié avec Docker

## 🏗️ Architecture du Système

- **Arduino / Capteurs** : Génèrent des événements via des requêtes HTTP.
- **Serveur Node.js / Express** : Met à jour le heartbeat, gère la création des logs, informe les clients via WebSocket.
- **Base de Données MySQL** : Stocke les comptes admin, l’historique des événements.

## ⚡️ Installation et Configuration

Pré-requis : Docker, Docker Compose, Git.

### Récupération du Code

```bash
git clone https://github.com/macsborb/IOT_Project.git
cd IOT_Project
```

### Exemple de docker-compose.yml
```bash
version: '3'
services:
  iot-database:
    image: mysql:8
    container_name: iot-database
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: "root"
      MYSQL_DATABASE: "iot"
    ports:
      - "3306:3306"
    volumes:
      - db_data:/var/lib/mysql
    networks:
      - iot-network

  iot-web:
    build: .
    container_name: iot-web
    restart: always
    ports:
      - "80:80"
    networks:
      - iot-network
    depends_on:
      - iot-database

volumes:
  db_data:

networks:
  iot-network:
    driver: bridge
```

### BDD
```bash
CREATE TABLE IF NOT EXISTS logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sensor VARCHAR(50) NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    duration INT
);
```

### Démarrage via Docker

```bash
docker-compose up --build
```

## 🌐 Utilisation de l’Application

- Initialisation & Connexion à [http://localhost](http://localhost)
- Simulation de capteurs via GET requests.
Simuler état actif :
```bash
http://localhost/sensorEvent?sensor=touch&state=true
```
Simuler état inactif :
```bash
http://localhost/sensorEvent?sensor=touch&state=false
```
Simuler heartbeat Arduino :
```bash
http://localhost/heartbeat
```

## 🗄️ Structure de la Base de Données

- `users` : Identifiants admin.

| Colonne        |      Type      | Description                          |
|:-------------- |:-------------:|:-------------------------------------|
| id             |   INT PK      | Identifiant unique de l'utilisateur  |
| username       | VARCHAR(50)   | Identifiant de connexion             |
| password_hash  |  CHAR(64)     | Hash SHA-256 du mot de passe         |
| salt           |  CHAR(32)     | Sel utilisé pour le hashage          |
| created_at     |  TIMESTAMP    | Date de création du compte           |

- `logs` : Historique des capteurs.

| Colonne     |      Type      | Description                           |
|:----------- |:-------------:|:--------------------------------------|
| id          |   INT PK      | Identifiant unique de l'événement     |
| sensor      | VARCHAR(50)   | Type de capteur (touch, sound, ir)    |
| start_time  |  DATETIME     | Date de début de l'événement          |
| end_time    |  DATETIME     | Date de fin de l'événement (ou NULL)  |
| duration    |    INT        | Durée de l'événement en secondes      |

## ⏳ Lancement et Arrêt de l’Environnement

- Lancement : `docker-compose up`
- Arrêt : `docker-compose down`

## ✅ Conclusion

IOT\_Project fournit une solution complète, moderne, extensible pour la surveillance en temps réel de capteurs ainsi que l’historisation des événements. Bon déploiement ! 👏

