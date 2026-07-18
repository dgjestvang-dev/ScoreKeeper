from pathlib import Path
import sqlite3

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "score_keeper.db"


def get_db_connection():
    conn = sqlite3.connect(str(DB_PATH), timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

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

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER,
            name TEXT NOT NULL,
            shirt_number INTEGER,
            FOREIGN KEY (team_id) REFERENCES teams (id)
        )
    """)

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


@app.route("/hello")
def hello():
    return jsonify(message="Hello, from Flask backend!")


# EVENTS
@app.route("/events", methods=["POST", "OPTIONS"])
def create_event():
    if request.method == "OPTIONS":
        return "", 200

    try:
        data = request.json or {}

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
    except Exception as exc:
        print("ERROR create_event:", exc)
        return jsonify({"error": str(exc)}), 500


@app.route("/events", methods=["GET"])
def get_events():
    conn = get_db_connection()
    cursor = conn.cursor()

    rows = cursor.execute("SELECT * FROM events").fetchall()
    events = [dict(row) for row in rows]

    conn.close()
    return jsonify(events)


# TEAMS
@app.route("/teams", methods=["POST", "OPTIONS"])
def create_team():
    if request.method == "OPTIONS":
        return "", 200

    data = request.json or {}

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO teams (name)
        VALUES (?)
    """, (data.get("name"),))

    team_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        "status": "team created",
        "id": team_id
    })


@app.route("/teams", methods=["GET"])
def get_teams():
    conn = get_db_connection()
    cursor = conn.cursor()

    rows = cursor.execute("SELECT * FROM teams").fetchall()
    teams = [dict(row) for row in rows]

    conn.close()
    return jsonify(teams)


@app.route("/teams/<int:team_id>", methods=["DELETE", "OPTIONS"])
def delete_team(team_id):
    if request.method == "OPTIONS":
        return "", 200

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT id FROM teams WHERE id = ?", (team_id,))
        team = cursor.fetchone()
        if not team:
            return jsonify({"error": "team not found"}), 404

        # Delete team players first
        cursor.execute("DELETE FROM players WHERE team_id = ?", (team_id,))
        cursor.execute("DELETE FROM teams WHERE id = ?", (team_id,))

        conn.commit()
        return jsonify({"status": "team deleted", "id": team_id})
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        conn.close()


@app.route("/teams/<int:team_id>", methods=["PATCH", "OPTIONS"])
def update_team(team_id):
    if request.method == "OPTIONS":
        return "", 200

    data = request.json or {}
    new_name = (data.get("name") or "").strip()

    if not new_name:
        return jsonify({"error": "name is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT id FROM teams WHERE id = ?", (team_id,))
        team = cursor.fetchone()
        if not team:
            return jsonify({"error": "team not found"}), 404

        cursor.execute("UPDATE teams SET name = ? WHERE id = ?", (new_name, team_id))
        conn.commit()
        return jsonify({"status": "team updated", "id": team_id, "name": new_name})
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        conn.close()


# PLAYERS
@app.route("/players", methods=["POST", "OPTIONS"])
def create_player():
    if request.method == "OPTIONS":
        return "", 200

    data = request.json or {}

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

    player_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        "status": "player created",
        "id": player_id
    })


@app.route("/players", methods=["GET"])
def get_players():
    conn = get_db_connection()
    cursor = conn.cursor()

    rows = cursor.execute("SELECT * FROM players").fetchall()
    players = [dict(row) for row in rows]

    conn.close()
    return jsonify(players)


@app.route("/players/<int:player_id>", methods=["DELETE", "OPTIONS"])
def delete_player(player_id):
    if request.method == "OPTIONS":
        return "", 200

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT id FROM players WHERE id = ?", (player_id,))
        player = cursor.fetchone()
        if not player:
            return jsonify({"error": "player not found"}), 404

        cursor.execute("DELETE FROM players WHERE id = ?", (player_id,))
        conn.commit()

        return jsonify({"status": "player deleted", "id": player_id})
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        conn.close()


@app.route("/players/<int:player_id>", methods=["PATCH", "OPTIONS"])
def update_player(player_id):
    if request.method == "OPTIONS":
        return "", 200

    data = request.json or {}
    new_name = (data.get("name") or "").strip()
    new_shirt_number = data.get("shirt_number")

    if not new_name:
        return jsonify({"error": "name is required"}), 400

    if new_shirt_number is None:
        return jsonify({"error": "shirt_number is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT id FROM players WHERE id = ?", (player_id,))
        player = cursor.fetchone()
        if not player:
            return jsonify({"error": "player not found"}), 404

        cursor.execute(
            "UPDATE players SET name = ?, shirt_number = ? WHERE id = ?",
            (new_name, new_shirt_number, player_id)
        )
        conn.commit()
        return jsonify({"status": "player updated", "id": player_id, "name": new_name, "shirt_number": new_shirt_number})
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        conn.close()


@app.route("/teams/<int:team_id>/players", methods=["GET"])
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


# MATCHES
@app.route("/matches", methods=["POST", "OPTIONS"])
def create_match():
    if request.method == "OPTIONS":
        return "", 200

    data = request.json or {}

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

    return jsonify({"status": "match created"})


@app.route("/matches", methods=["GET"])
def get_matches():
    conn = get_db_connection()
    cursor = conn.cursor()

    rows = cursor.execute("SELECT * FROM matches").fetchall()
    matches = [dict(row) for row in rows]

    conn.close()
    return jsonify(matches)


@app.route("/matches/<int:match_id>", methods=["DELETE", "OPTIONS"])
def delete_match(match_id):
    if request.method == "OPTIONS":
        return "", 200

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT id FROM matches WHERE id = ?", (match_id,))
        match = cursor.fetchone()
        if not match:
            return jsonify({"error": "match not found"}), 404

        cursor.execute("DELETE FROM events WHERE match_id = ?", (match_id,))
        deleted_events = cursor.rowcount
        cursor.execute("DELETE FROM matches WHERE id = ?", (match_id,))
        deleted_matches = cursor.rowcount

        if deleted_matches == 0:
            conn.rollback()
            return jsonify({"error": "match delete failed"}), 500

        conn.commit()
        return jsonify({
            "status": "match deleted",
            "id": match_id,
            "deleted_events": deleted_events,
            "deleted_matches": deleted_matches
        })
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        conn.close()


@app.route("/save-match", methods=["POST", "OPTIONS"])
def save_match_with_events():
    if request.method == "OPTIONS":
        return "", 200

    try:
        data = request.json or {}
        match = data.get("match") or {}
        events = data.get("events", [])

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
            match.get("home_team_id"),
            match.get("home_team_name"),
            match.get("away_team_id"),
            match.get("away_team_name"),
            match.get("date")
        ))

        match_id = cursor.lastrowid

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

        if event_data:
            cursor.executemany("""
                INSERT INTO events (
                    match_id, type, team, player_id, half, minute, timestamp
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, event_data)

        conn.commit()
        conn.close()

        return jsonify({"status": "saved", "match_id": match_id})
    except Exception as exc:
        print("ERROR save_match_with_events:", exc)
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    print("Using DB:", DB_PATH)
    init_db()
    app.run(debug=True)
    