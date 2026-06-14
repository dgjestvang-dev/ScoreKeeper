from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})


def get_db_connection():
    conn = sqlite3.connect("score_keeper.db", timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # EVENTS
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER,
            type TEXT,
            team TEXT,
            player_id TEXT,
            half INTEGER,
            minute INTEGER,
            timestamp INTEGER,
            FOREIGN KEY (match_id) REFERENCES matches (id)
        )
    """)


    # TEAMS
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        )
    """)

    # PLAYERS
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER,
            name TEXT NOT NULL,
            shirt_number INTEGER,
            FOREIGN KEY (team_id) REFERENCES teams (id)
        )
    """)

    # MATCHES
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            home_team_id INTEGER,
            home_team_name TEXT,
            away_team_id INTEGER,
            away_team_name TEXT,
            date TEXT
        )
    """)


    conn.commit()
    conn.close()



# 🔥 "fake database"
events = []


@app.route('/hello')
def hello():
    return jsonify(message='Hello, from Flask backend!')

# ROUTES FOR EVENTS

@app.route('/events', methods=['POST', 'OPTIONS'])
def create_event():
    if request.method == "OPTIONS":
        return '', 200
    try:
        data = request.json

    
        conn = get_db_connection()
        cursor = conn.cursor()

    
        cursor.execute("""
            INSERT INTO events (
                match_id, type, team, player_id, half, minute, timestamp
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("match_id"),
            data.get("type"),
            data.get("team"),
            data.get("player_id"),
            data.get("half"),
            data.get("minute"),
            data.get("timestamp")
        ))


        conn.commit()
        conn.close()

        return jsonify({"status": "saved"}) 

    except Exception as e:
        print("ERROR:", e)   # 🔥 denne er gull
        return jsonify({"error": str(e)}), 500



@app.route('/events', methods=['GET'])
def get_events():
    conn = get_db_connection()
    cursor = conn.cursor()

    rows = cursor.execute("SELECT * FROM events").fetchall()

    events = [dict(row) for row in rows]

    conn.close()

    return jsonify(events)

# ROUTES FOR TEAMS

@app.route('/teams', methods=['POST', 'OPTIONS'])
def create_team():
    if request.method == "OPTIONS":
        return '', 200

    data = request.json

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO teams (name)
        VALUES (?)
    """, (data.get("name"),))

    conn.commit()
    conn.close()

    return {"status": "team created"}


@app.route('/teams', methods=['GET'])
def get_teams():
    conn = get_db_connection()
    cursor = conn.cursor()

    rows = cursor.execute("SELECT * FROM teams").fetchall()

    teams = [dict(row) for row in rows]

    conn.close()

    return jsonify(teams)


# ROUTES FOR PLAYERS

@app.route('/players', methods=['POST', 'OPTIONS'])
def create_player():
    if request.method == "OPTIONS":
        return '', 200

    data = request.json

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO players (team_id, name, shirt_number)
        VALUES (?, ?, ?)
    """, (
        data.get("team_id"),
        data.get("name"),
        data.get("shirt_number")
    ))

    conn.commit()
    conn.close()

    return {"status": "player created"}

@app.route('/players', methods=['GET'])
def get_players():
    conn = get_db_connection()
    cursor = conn.cursor()

    rows = cursor.execute("SELECT * FROM players").fetchall()

    players = [dict(row) for row in rows]

    conn.close()

    return jsonify(players)


@app.route('/teams/<int:team_id>/players', methods=['GET'])
def get_players_for_team(team_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    rows = cursor.execute(
        "SELECT * FROM players WHERE team_id = ?",
        (team_id,)
    ).fetchall()

    players = [dict(row) for row in rows]

    conn.close()

    return jsonify(players)

# ROUTES FOR MATCHES

@app.route('/matches', methods=['POST', 'OPTIONS'])
def create_match():
    if request.method == "OPTIONS":
        return '', 200

    data = request.json

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO matches (
            home_team_id,
            home_team_name,
            away_team_id,
            away_team_name,
            date
        )
        VALUES (?, ?, ?, ?, ?)
    """, (
        data.get("home_team_id"),
        data.get("home_team_name"),
        data.get("away_team_id"),
        data.get("away_team_name"),
        data.get("date")
    ))

    conn.commit()
    conn.close()

    return {"status": "match created"}


@app.route('/matches', methods=['GET'])
def get_matches():
    conn = get_db_connection()
    cursor = conn.cursor()

    rows = cursor.execute("SELECT * FROM matches").fetchall()

    matches = [dict(row) for row in rows]

    conn.close()

    return jsonify(matches)

# 🔥 denne er gull - her kan vi sende både match og events i samme request, og så lagre alt i samme transaksjon
@app.route('/save-match', methods=['POST', 'OPTIONS'])
def save_match_with_events():
    if request.method == "OPTIONS":
        return '', 200

    try:
        data = request.json

        match = data.get("match")
        events = data.get("events", [])

        conn = get_db_connection()
        cursor = conn.cursor()

        # ✅ lag match
        cursor.execute("""
            INSERT INTO matches (
                home_team_id,
                home_team_name,
                away_team_id,
                away_team_name,
                date
            )
            VALUES (?, ?, ?, ?, ?)
        """, (
            match.get("home_team_id"),
            match.get("home_team_name"),
            match.get("away_team_id"),
            match.get("away_team_name"),
            match.get("date")
        ))

        match_id = cursor.lastrowid

        # ✅ lag events (bruk samme transaction!)
        event_data = [
            (
                match_id,
                e.get("type"),
                e.get("team"),
                e.get("player_id"),
                e.get("half"),
                e.get("minute"),
                e.get("timestamp")
            )
            for e in events
        ]

        cursor.executemany("""
            INSERT INTO events (
                match_id, type, team, player_id, half, minute, timestamp
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, event_data)

        conn.commit()
        conn.close()

        return {"status": "saved", "match_id": match_id}

    except Exception as e:
        print("ERROR:", e)
        return {"error": str(e)}, 500





if __name__ == '__main__':
    init_db()   # 👈 dette oppretter tabellen
    app.run(debug=True)
