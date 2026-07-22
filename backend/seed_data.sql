BEGIN TRANSACTION;
CREATE TABLE customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
INSERT INTO "customers" VALUES(1,'Extensor Demo','extensor-demo','2026-07-18 17:26:06');
CREATE TABLE events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER,
            type TEXT,
            team TEXT,
            player_id TEXT,
            half INTEGER,
            minute INTEGER,
            timestamp INTEGER, customer_id INTEGER, owner_user_id INTEGER,
            FOREIGN KEY (match_id) REFERENCES matches (id)
        );
INSERT INTO "events" VALUES(94,7,'shots_total','home',NULL,1,1,1784661908077,1,1);
INSERT INTO "events" VALUES(95,7,'shots_total','away',NULL,1,1,1784661918328,1,1);
INSERT INTO "events" VALUES(96,7,'goals','home','1',1,1,1784661919343,1,1);
INSERT INTO "events" VALUES(97,7,'shots_target','home',NULL,1,1,1784661919343,1,1);
INSERT INTO "events" VALUES(98,7,'shots_total','home',NULL,1,1,1784661919343,1,1);
INSERT INTO "events" VALUES(99,7,'assists','home','4',1,1,1784661919343,1,1);
INSERT INTO "events" VALUES(100,7,'shots_target','away',NULL,1,2,1784661979267,1,1);
INSERT INTO "events" VALUES(101,7,'shots_total','away',NULL,1,2,1784661979267,1,1);
INSERT INTO "events" VALUES(102,7,'corners','home',NULL,1,2,1784661986104,1,1);
INSERT INTO "events" VALUES(103,7,'yellow_card','home','8',1,2,1784661989471,1,1);
INSERT INTO "events" VALUES(104,7,'shots_target','home',NULL,1,3,1784662030460,1,1);
INSERT INTO "events" VALUES(105,7,'shots_total','home',NULL,1,3,1784662030460,1,1);
INSERT INTO "events" VALUES(106,7,'yellow_card','away',NULL,1,3,1784662031577,1,1);
INSERT INTO "events" VALUES(107,7,'goals','home','4',1,4,1784662102362,1,1);
INSERT INTO "events" VALUES(108,7,'shots_target','home',NULL,1,4,1784662102362,1,1);
INSERT INTO "events" VALUES(109,7,'shots_total','home',NULL,1,4,1784662102362,1,1);
INSERT INTO "events" VALUES(110,7,'assists','home','5',1,4,1784662102362,1,1);
INSERT INTO "events" VALUES(111,7,'goals','away',NULL,1,5,1784662171354,1,1);
INSERT INTO "events" VALUES(112,7,'shots_target','away',NULL,1,5,1784662171354,1,1);
INSERT INTO "events" VALUES(113,7,'shots_total','away',NULL,1,5,1784662171354,1,1);
INSERT INTO "events" VALUES(114,7,'goals','home','1',2,2,1784662311513,1,1);
INSERT INTO "events" VALUES(115,7,'shots_target','home',NULL,2,2,1784662311513,1,1);
INSERT INTO "events" VALUES(116,7,'shots_total','home',NULL,2,2,1784662311513,1,1);
INSERT INTO "events" VALUES(117,7,'assists','home','9',2,2,1784662311513,1,1);
INSERT INTO "events" VALUES(118,7,'corners','home',NULL,2,2,1784662346260,1,1);
INSERT INTO "events" VALUES(119,7,'shots_total','away',NULL,2,3,1784662376616,1,1);
INSERT INTO "events" VALUES(120,7,'offside','away',NULL,2,3,1784662378316,1,1);
INSERT INTO "events" VALUES(121,7,'yellow_card','away',NULL,2,3,1784662382100,1,1);
INSERT INTO "events" VALUES(122,7,'goals','away',NULL,2,5,1784662520439,1,1);
INSERT INTO "events" VALUES(123,7,'shots_target','away',NULL,2,5,1784662520439,1,1);
INSERT INTO "events" VALUES(124,7,'shots_total','away',NULL,2,5,1784662520439,1,1);
CREATE TABLE matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            home_team_id INTEGER,
            home_team_name TEXT,
            away_team_id INTEGER,
            away_team_name TEXT,
            date TEXT
        , customer_id INTEGER, owner_user_id INTEGER);
INSERT INTO "matches" VALUES(7,1,'Frisk Asker G13',NULL,'Bærum','2026-07-21',1,1);
CREATE TABLE players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER,
            name TEXT NOT NULL,
            shirt_number INTEGER, customer_id INTEGER, owner_user_id INTEGER,
            FOREIGN KEY (team_id) REFERENCES teams (id)
        );
INSERT INTO "players" VALUES(1,1,'Vini',25,1,1);
INSERT INTO "players" VALUES(2,1,'Hugo',14,1,1);
INSERT INTO "players" VALUES(3,1,'Liam',2,1,1);
INSERT INTO "players" VALUES(4,1,'Peder',11,1,1);
INSERT INTO "players" VALUES(5,1,'Vetle',30,1,1);
INSERT INTO "players" VALUES(6,1,'Olivier',9,1,1);
INSERT INTO "players" VALUES(7,1,'Julian',4,1,1);
INSERT INTO "players" VALUES(8,1,'Johannes',7,1,1);
INSERT INTO "players" VALUES(9,1,'Matus',35,1,1);
INSERT INTO "players" VALUES(10,2,'Oliver',9,1,1);
INSERT INTO "players" VALUES(11,2,'Emil',4,1,1);
INSERT INTO "players" VALUES(12,3,'Nelly',10,1,1);
INSERT INTO "players" VALUES(19,3,'Jenny',9,1,1);
INSERT INTO "players" VALUES(20,2,'Vini',13,1,1);
CREATE TABLE teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        , customer_id INTEGER, owner_user_id INTEGER);
INSERT INTO "teams" VALUES(1,'Frisk Asker G13',1,1);
INSERT INTO "teams" VALUES(2,'Frisk Asker G12',1,1);
INSERT INTO "teams" VALUES(3,'Frisk Asker J10',1,1);
CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, username TEXT NOT NULL UNIQUE, display_name TEXT, role TEXT DEFAULT 'member', is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (customer_id) REFERENCES customers (id));
INSERT INTO "users" VALUES(1,1,'danie','Danie','owner',1,'2026-07-18 17:26:06');
CREATE INDEX idx_teams_owner ON teams(owner_user_id);
CREATE INDEX idx_players_owner ON players(owner_user_id);
CREATE INDEX idx_matches_owner ON matches(owner_user_id);
CREATE INDEX idx_events_owner ON events(owner_user_id);
CREATE INDEX idx_events_match ON events(match_id);
DELETE FROM "sqlite_sequence";
INSERT INTO "sqlite_sequence" VALUES('teams',20);
INSERT INTO "sqlite_sequence" VALUES('players',20);
INSERT INTO "sqlite_sequence" VALUES('matches',7);
INSERT INTO "sqlite_sequence" VALUES('events',124);
INSERT INTO "sqlite_sequence" VALUES('customers',32);
INSERT INTO "sqlite_sequence" VALUES('users',32);
COMMIT;
