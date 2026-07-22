from pathlib import Path
import sqlite3

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "score_keeper.db"

DEFAULT_CUSTOMER_NAME = "Extensor Demo"
DEFAULT_CUSTOMER_SLUG = "extensor-demo"
DEFAULT_USERNAME = "danie"
DEFAULT_DISPLAY_NAME = "Danie"

DEFAULT_CUSTOMER_ID = None
DEFAULT_USER_ID = None


def get_db_connection():
    conn = sqlite3.connect(str(DB_PATH), timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_column(cursor, table_name, column_name, column_sql_type):
    existing_columns = {
        row["name"]
        for row in cursor.execute(f"PRAGMA table_info({table_name})").fetchall()
    }
    if column_name not in existing_columns:
        cursor.execute(
            f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_sql_type}"
        )


def ensure_default_customer_and_user(cursor):
    cursor.execute(
        """
        INSERT OR IGNORE INTO customers (name, slug)
        VALUES (?, ?)
        """,
        (DEFAULT_CUSTOMER_NAME, DEFAULT_CUSTOMER_SLUG)
    )

    customer_row = cursor.execute(
        "SELECT id FROM customers WHERE slug = ?",
        (DEFAULT_CUSTOMER_SLUG,)
    ).fetchone()
    customer_id = customer_row["id"]

    cursor.execute(
        """
        INSERT OR IGNORE INTO users (customer_id, username, display_name, role)
        VALUES (?, ?, ?, ?)
        """,
        (customer_id, DEFAULT_USERNAME, DEFAULT_DISPLAY_NAME, "owner")
    )

    user_row = cursor.execute(
        "SELECT id FROM users WHERE username = ?",
        (DEFAULT_USERNAME,)
    ).fetchone()
    user_id = user_row["id"]

    return customer_id, user_id


def get_request_user_context():
    user_id_raw = request.headers.get("X-User-Id") or request.args.get("user_id")

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        if user_id_raw:
            try:
                candidate_user_id = int(user_id_raw)
            except ValueError:
                return None, None, (jsonify({"error": "Invalid user_id"}), 400)

            user = cursor.execute(
                """
                SELECT id, customer_id, username, display_name, role
                FROM users
                WHERE id = ? AND is_active = 1
                """,
                (candidate_user_id,)
            ).fetchone()

            if not user:
                return None, None, (jsonify({"error": "User not found"}), 404)

            return user["customer_id"], user["id"], None

        customer_id, user_id = ensure_default_customer_and_user(cursor)
        conn.commit()
        return customer_id, user_id, None
    finally:
        conn.close()


def init_db():
    global DEFAULT_CUSTOMER_ID
    global DEFAULT_USER_ID

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            username TEXT NOT NULL UNIQUE,
            display_name TEXT,
            role TEXT DEFAULT 'member',
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers (id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER,
            customer_id INTEGER,
            owner_user_id INTEGER,
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
            name TEXT NOT NULL,
            customer_id INTEGER,
            owner_user_id INTEGER
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER,
            name TEXT NOT NULL,
            shirt_number INTEGER,
            customer_id INTEGER,
            owner_user_id INTEGER,
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
            date TEXT,
            customer_id INTEGER,
            owner_user_id INTEGER
        )
    """)

    ensure_column(cursor, "events", "customer_id", "INTEGER")
    ensure_column(cursor, "events", "owner_user_id", "INTEGER")
    ensure_column(cursor, "teams", "customer_id", "INTEGER")
    ensure_column(cursor, "teams", "owner_user_id", "INTEGER")
    ensure_column(cursor, "players", "customer_id", "INTEGER")
    ensure_column(cursor, "players", "owner_user_id", "INTEGER")
    ensure_column(cursor, "matches", "customer_id", "INTEGER")
    ensure_column(cursor, "matches", "owner_user_id", "INTEGER")

    default_customer_id, default_user_id = ensure_default_customer_and_user(cursor)

    cursor.execute(
        "UPDATE teams SET customer_id = ? WHERE customer_id IS NULL",
        (default_customer_id,)
    )
    cursor.execute(
        "UPDATE teams SET owner_user_id = ? WHERE owner_user_id IS NULL",
        (default_user_id,)
    )

    cursor.execute(
        "UPDATE players SET customer_id = ? WHERE customer_id IS NULL",
        (default_customer_id,)
    )
    cursor.execute(
        "UPDATE players SET owner_user_id = ? WHERE owner_user_id IS NULL",
        (default_user_id,)
    )

    cursor.execute(
        "UPDATE matches SET customer_id = ? WHERE customer_id IS NULL",
        (default_customer_id,)
    )
    cursor.execute(
        "UPDATE matches SET owner_user_id = ? WHERE owner_user_id IS NULL",
        (default_user_id,)
    )

    cursor.execute(
        """
        UPDATE events
        SET customer_id = COALESCE(
            (SELECT customer_id FROM matches WHERE matches.id = events.match_id),
            ?
        )
        WHERE customer_id IS NULL
        """,
        (default_customer_id,)
    )

    cursor.execute(
        """
        UPDATE events
        SET owner_user_id = COALESCE(
            (SELECT owner_user_id FROM matches WHERE matches.id = events.match_id),
            ?
        )
        WHERE owner_user_id IS NULL
        """,
        (default_user_id,)
    )

    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_user_id)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_players_owner ON players(owner_user_id)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_matches_owner ON matches(owner_user_id)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_events_owner ON events(owner_user_id)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_events_match ON events(match_id)"
    )

    DEFAULT_CUSTOMER_ID = default_customer_id
    DEFAULT_USER_ID = default_user_id

    conn.commit()
    conn.close()


@app.route("/hello")
def hello():
    return jsonify(message="Hello, from Flask backend!")


@app.route("/auth/login", methods=["POST", "OPTIONS"])
def auth_login():
    if request.method == "OPTIONS":
        return "", 200

    data = request.json or {}
    username = (data.get("username") or "").strip().lower()

    if not username:
        return jsonify({"error": "username is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    row = cursor.execute(
        """
        SELECT id, customer_id, username, display_name, role, is_active, created_at
        FROM users
        WHERE username = ? AND is_active = 1
        """,
        (username,)
    ).fetchone()

    conn.close()

    if not row:
        return jsonify({"error": "user not found"}), 404

    return jsonify({"status": "ok", "user": dict(row)})


@app.route("/users", methods=["GET"])
def get_users():
    customer_id, _, error = get_request_user_context()
    if error:
        return error

    conn = get_db_connection()
    cursor = conn.cursor()

    rows = cursor.execute(
        """
        SELECT id, customer_id, username, display_name, role, is_active, created_at
        FROM users
        WHERE customer_id = ?
        ORDER BY id ASC
        """,
        (customer_id,)
    ).fetchall()

    users = [dict(row) for row in rows]
    conn.close()
    return jsonify(users)


@app.route("/users", methods=["POST", "OPTIONS"])
def create_user():
    if request.method == "OPTIONS":
        return "", 200

    customer_id, _, error = get_request_user_context()
    if error:
        return error

    data = request.json or {}
    username = (data.get("username") or "").strip().lower()
    display_name = (data.get("display_name") or "").strip()
    role = (data.get("role") or "member").strip().lower()

    if not username:
        return jsonify({"error": "username is required"}), 400

    if role not in {"owner", "admin", "member"}:
        return jsonify({"error": "role must be owner, admin, or member"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO users (customer_id, username, display_name, role)
            VALUES (?, ?, ?, ?)
            """,
            (customer_id, username, display_name or username, role)
        )
        user_id = cursor.lastrowid
        conn.commit()
        return jsonify({
            "status": "user created",
            "id": user_id,
            "customer_id": customer_id,
            "username": username,
            "display_name": display_name or username,
            "role": role
        })
    except sqlite3.IntegrityError:
        conn.rollback()
        return jsonify({"error": "username already exists"}), 409
    finally:
        conn.close()


@app.route("/users/me", methods=["GET"])
def get_me():
    _, user_id, error = get_request_user_context()
    if error:
        return error

    conn = get_db_connection()
    cursor = conn.cursor()

    row = cursor.execute(
        """
        SELECT id, customer_id, username, display_name, role, is_active, created_at
        FROM users
        WHERE id = ?
        """,
        (user_id,)
    ).fetchone()

    conn.close()
    if not row:
        return jsonify({"error": "user not found"}), 404

    return jsonify(dict(row))


# EVENTS
@app.route("/events", methods=["POST", "OPTIONS"])
def create_event():
    if request.method == "OPTIONS":
        return "", 200

    try:
        customer_id, user_id, error = get_request_user_context()
        if error:
            return error

        data = request.json or {}
        match_id = data.get("match_id")

        conn = get_db_connection()
        cursor = conn.cursor()

        if match_id is not None:
            match = cursor.execute(
                "SELECT id FROM matches WHERE id = ? AND owner_user_id = ?",
                (match_id, user_id)
            ).fetchone()
            if not match:
                conn.close()
                return jsonify({"error": "match not found for user"}), 404

        cursor.execute("""
            INSERT INTO events (
                match_id, customer_id, owner_user_id, type, team, player_id, half, minute, timestamp
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            match_id,
            customer_id,
            user_id,
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
    _, user_id, error = get_request_user_context()
    if error:
        return error

    conn = get_db_connection()
    cursor = conn.cursor()

    rows = cursor.execute(
        "SELECT * FROM events WHERE owner_user_id = ?",
        (user_id,)
    ).fetchall()
    events = [dict(row) for row in rows]

    conn.close()
    return jsonify(events)


# TEAMS
@app.route("/teams", methods=["POST", "OPTIONS"])
def create_team():
    if request.method == "OPTIONS":
        return "", 200

    customer_id, user_id, error = get_request_user_context()
    if error:
        return error

    data = request.json or {}

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO teams (name, customer_id, owner_user_id)
        VALUES (?, ?, ?)
    """, (data.get("name"), customer_id, user_id))

    team_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        "status": "team created",
        "id": team_id
    })


@app.route("/teams", methods=["GET"])
def get_teams():
    _, user_id, error = get_request_user_context()
    if error:
        return error

    conn = get_db_connection()
    cursor = conn.cursor()

    rows = cursor.execute(
        "SELECT * FROM teams WHERE owner_user_id = ?",
        (user_id,)
    ).fetchall()
    teams = [dict(row) for row in rows]

    conn.close()
    return jsonify(teams)


@app.route("/teams/<int:team_id>", methods=["DELETE", "OPTIONS"])
def delete_team(team_id):
    if request.method == "OPTIONS":
        return "", 200

    _, user_id, error = get_request_user_context()
    if error:
        return error

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT id FROM teams WHERE id = ? AND owner_user_id = ?",
            (team_id, user_id)
        )
        team = cursor.fetchone()
        if not team:
            return jsonify({"error": "team not found"}), 404

        # Delete team players first
        cursor.execute(
            "DELETE FROM players WHERE team_id = ? AND owner_user_id = ?",
            (team_id, user_id)
        )
        cursor.execute(
            "DELETE FROM teams WHERE id = ? AND owner_user_id = ?",
            (team_id, user_id)
        )

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

    _, user_id, error = get_request_user_context()
    if error:
        return error

    data = request.json or {}
    new_name = (data.get("name") or "").strip()

    if not new_name:
        return jsonify({"error": "name is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT id FROM teams WHERE id = ? AND owner_user_id = ?",
            (team_id, user_id)
        )
        team = cursor.fetchone()
        if not team:
            return jsonify({"error": "team not found"}), 404

        cursor.execute(
            "UPDATE teams SET name = ? WHERE id = ? AND owner_user_id = ?",
            (new_name, team_id, user_id)
        )
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

    customer_id, user_id, error = get_request_user_context()
    if error:
        return error

    data = request.json or {}
    team_id = data.get("team_id")

    conn = get_db_connection()
    cursor = conn.cursor()

    team = cursor.execute(
        "SELECT id FROM teams WHERE id = ? AND owner_user_id = ?",
        (team_id, user_id)
    ).fetchone()
    if not team:
        conn.close()
        return jsonify({"error": "team not found"}), 404

    cursor.execute("""
        INSERT INTO players (team_id, name, shirt_number, customer_id, owner_user_id)
        VALUES (?, ?, ?, ?, ?)
    """, (
        team_id,
        data.get("name"),
        data.get("shirt_number"),
        customer_id,
        user_id
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
    _, user_id, error = get_request_user_context()
    if error:
        return error

    conn = get_db_connection()
    cursor = conn.cursor()

    rows = cursor.execute(
        "SELECT * FROM players WHERE owner_user_id = ?",
        (user_id,)
    ).fetchall()
    players = [dict(row) for row in rows]

    conn.close()
    return jsonify(players)


@app.route("/players/<int:player_id>", methods=["DELETE", "OPTIONS"])
def delete_player(player_id):
    if request.method == "OPTIONS":
        return "", 200

    _, user_id, error = get_request_user_context()
    if error:
        return error

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT id FROM players WHERE id = ? AND owner_user_id = ?",
            (player_id, user_id)
        )
        player = cursor.fetchone()
        if not player:
            return jsonify({"error": "player not found"}), 404

        cursor.execute(
            "DELETE FROM players WHERE id = ? AND owner_user_id = ?",
            (player_id, user_id)
        )
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

    _, user_id, error = get_request_user_context()
    if error:
        return error

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
        cursor.execute(
            "SELECT id FROM players WHERE id = ? AND owner_user_id = ?",
            (player_id, user_id)
        )
        player = cursor.fetchone()
        if not player:
            return jsonify({"error": "player not found"}), 404

        cursor.execute(
            "UPDATE players SET name = ?, shirt_number = ? WHERE id = ? AND owner_user_id = ?",
            (new_name, new_shirt_number, player_id, user_id)
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
    _, user_id, error = get_request_user_context()
    if error:
        return error

    conn = get_db_connection()
    cursor = conn.cursor()

    rows = cursor.execute(
        "SELECT * FROM players WHERE team_id = ? AND owner_user_id = ?",
        (team_id, user_id)
    ).fetchall()

    players = [dict(row) for row in rows]

    conn.close()
    return jsonify(players)


# MATCHES
@app.route("/matches", methods=["POST", "OPTIONS"])
def create_match():
    if request.method == "OPTIONS":
        return "", 200

    customer_id, user_id, error = get_request_user_context()
    if error:
        return error

    data = request.json or {}

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO matches (
            home_team_id,
            home_team_name,
            away_team_id,
            away_team_name,
            date,
            customer_id,
            owner_user_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("home_team_id"),
        data.get("home_team_name"),
        data.get("away_team_id"),
        data.get("away_team_name"),
        data.get("date"),
        customer_id,
        user_id
    ))

    conn.commit()
    conn.close()

    return jsonify({"status": "match created"})


@app.route("/matches", methods=["GET"])
def get_matches():
    _, user_id, error = get_request_user_context()
    if error:
        return error

    conn = get_db_connection()
    cursor = conn.cursor()

    rows = cursor.execute(
        "SELECT * FROM matches WHERE owner_user_id = ?",
        (user_id,)
    ).fetchall()
    matches = [dict(row) for row in rows]

    conn.close()
    return jsonify(matches)


@app.route("/matches/<int:match_id>", methods=["DELETE", "OPTIONS"])
def delete_match(match_id):
    if request.method == "OPTIONS":
        return "", 200

    _, user_id, error = get_request_user_context()
    if error:
        return error

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT id FROM matches WHERE id = ? AND owner_user_id = ?",
            (match_id, user_id)
        )
        match = cursor.fetchone()
        if not match:
            return jsonify({"error": "match not found"}), 404

        cursor.execute(
            "DELETE FROM events WHERE match_id = ? AND owner_user_id = ?",
            (match_id, user_id)
        )
        deleted_events = cursor.rowcount
        cursor.execute(
            "DELETE FROM matches WHERE id = ? AND owner_user_id = ?",
            (match_id, user_id)
        )
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
        customer_id, user_id, error = get_request_user_context()
        if error:
            return error

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
                date,
                customer_id,
                owner_user_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            match.get("home_team_id"),
            match.get("home_team_name"),
            match.get("away_team_id"),
            match.get("away_team_name"),
            match.get("date"),
            customer_id,
            user_id
        ))

        match_id = cursor.lastrowid

        event_data = [
            (
                match_id,
                customer_id,
                user_id,
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
                    match_id, customer_id, owner_user_id, type, team, player_id, half, minute, timestamp
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, event_data)

        conn.commit()
        conn.close()

        return jsonify({"status": "saved", "match_id": match_id})
    except Exception as exc:
        print("ERROR save_match_with_events:", exc)
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    init_db()
    print("Using DB:", DB_PATH)
    print(
        "Default user seeded:",
        {
            "customer_id": DEFAULT_CUSTOMER_ID,
            "user_id": DEFAULT_USER_ID,
            "username": DEFAULT_USERNAME
        }
    )
    app.run(host="0.0.0.0", port=5000, debug=True)
    