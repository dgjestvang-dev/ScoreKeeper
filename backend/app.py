import os
from pathlib import Path
import re
import secrets
import sqlite3

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get(
    "SECRET_KEY",
    "local-development-key-do-not-use-in-production",
)
CORS(app, resources={r"/*": {"origins": "*"}})

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
INSTANCE_DIR = PROJECT_ROOT / "instance"


def resolve_db_path():
    env_db_path = os.getenv("DATABASE_PATH") or os.getenv("DB_PATH")

    if env_db_path:
        path = Path(env_db_path).expanduser()
        if not path.is_absolute():
            path = (PROJECT_ROOT / path).resolve()

        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    if (os.getenv("RENDER") or "").lower() == "true":
        render_default = Path("/var/data/score_keeper.db")
        render_default.parent.mkdir(parents=True, exist_ok=True)
        return render_default

    default_path = INSTANCE_DIR / "score_keeper.db"
    INSTANCE_DIR.mkdir(parents=True, exist_ok=True)
    return default_path


DB_PATH = resolve_db_path()
SEED_SQL_PATH = BASE_DIR / "seed_data.sql"

USERNAME_MIN_LEN = 3
USERNAME_MAX_LEN = 30
USERNAME_PATTERN = re.compile(r"^[a-z0-9_.-]+$")

DB_BOOTSTRAPPED = False

TEAM_CODE_LENGTH = 6
TEAM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def get_db_connection():
    conn = sqlite3.connect(str(DB_PATH), timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def normalize_username(value):
    return (value or "").strip().lower()


def validate_username(username):
    if not username:
        return "username is required"

    if len(username) < USERNAME_MIN_LEN:
        return f"username must be at least {USERNAME_MIN_LEN} characters"

    if len(username) > USERNAME_MAX_LEN:
        return f"username must be at most {USERNAME_MAX_LEN} characters"

    if not USERNAME_PATTERN.fullmatch(username):
        return "username can only contain lowercase letters, numbers, '.', '_' or '-'"

    return None


def ensure_column(cursor, table_name, column_name, column_sql_type):
    existing_columns = {
        row["name"]
        for row in cursor.execute(f"PRAGMA table_info({table_name})").fetchall()
    }
    if column_name not in existing_columns:
        cursor.execute(
            f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_sql_type}"
        )


def table_has_column(cursor, table_name, column_name):
    columns = cursor.execute(f"PRAGMA table_info({table_name})").fetchall()
    return any(row["name"] == column_name for row in columns)


def normalize_team_code(value):
    return (value or "").strip().upper()


def is_valid_team_code(code):
    if len(code) != TEAM_CODE_LENGTH:
        return False
    return all(ch in TEAM_CODE_ALPHABET for ch in code)


def generate_team_code(cursor):
    while True:
        code = "".join(secrets.choice(TEAM_CODE_ALPHABET) for _ in range(TEAM_CODE_LENGTH))
        exists = cursor.execute(
            "SELECT 1 FROM teams WHERE team_code = ?",
            (code,)
        ).fetchone()
        if not exists:
            return code


def user_has_team_access(cursor, user_id, team_id):
    row = cursor.execute(
        """
        SELECT 1
        FROM user_teams
        WHERE user_id = ? AND team_id = ?
        """,
        (user_id, team_id)
    ).fetchone()
    return row is not None


def user_owns_team(cursor, user_id, team_id):
    row = cursor.execute(
        """
        SELECT 1
        FROM user_teams
        WHERE user_id = ? AND team_id = ? AND role = 'owner'
        """,
        (user_id, team_id)
    ).fetchone()

    if row:
        return True

    legacy_owner = cursor.execute(
        "SELECT 1 FROM teams WHERE id = ? AND owner_user_id = ?",
        (team_id, user_id)
    ).fetchone()
    return legacy_owner is not None


def remove_customer_model_if_present(cursor):
    # SQLite cannot drop columns directly; rebuild affected tables.
    if table_has_column(cursor, "users", "customer_id"):
        cursor.execute("""
            CREATE TABLE users_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                display_name TEXT,
                role TEXT DEFAULT 'member',
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            INSERT INTO users_new (id, username, display_name, role, is_active, created_at)
            SELECT id, username, display_name, role, is_active, created_at
            FROM users
        """)
        cursor.execute("DROP TABLE users")
        cursor.execute("ALTER TABLE users_new RENAME TO users")

    if table_has_column(cursor, "teams", "customer_id"):
        has_team_code = table_has_column(cursor, "teams", "team_code")
        cursor.execute("""
            CREATE TABLE teams_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                team_code TEXT,
                owner_user_id INTEGER
            )
        """)
        if has_team_code:
            cursor.execute("""
                INSERT INTO teams_new (id, name, team_code, owner_user_id)
                SELECT id, name, team_code, owner_user_id
                FROM teams
            """)
        else:
            cursor.execute("""
                INSERT INTO teams_new (id, name, team_code, owner_user_id)
                SELECT id, name, NULL, owner_user_id
                FROM teams
            """)
        cursor.execute("DROP TABLE teams")
        cursor.execute("ALTER TABLE teams_new RENAME TO teams")

    if table_has_column(cursor, "players", "customer_id"):
        cursor.execute("""
            CREATE TABLE players_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                team_id INTEGER,
                name TEXT NOT NULL,
                shirt_number INTEGER,
                owner_user_id INTEGER,
                FOREIGN KEY (team_id) REFERENCES teams (id)
            )
        """)
        cursor.execute("""
            INSERT INTO players_new (id, team_id, name, shirt_number, owner_user_id)
            SELECT id, team_id, name, shirt_number, owner_user_id
            FROM players
        """)
        cursor.execute("DROP TABLE players")
        cursor.execute("ALTER TABLE players_new RENAME TO players")

    if table_has_column(cursor, "matches", "customer_id"):
        cursor.execute("""
            CREATE TABLE matches_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                home_team_id INTEGER,
                home_team_name TEXT,
                away_team_id INTEGER,
                away_team_name TEXT,
                date TEXT,
                owner_user_id INTEGER
            )
        """)
        cursor.execute("""
            INSERT INTO matches_new (id, home_team_id, home_team_name, away_team_id, away_team_name, date, owner_user_id)
            SELECT id, home_team_id, home_team_name, away_team_id, away_team_name, date, owner_user_id
            FROM matches
        """)
        cursor.execute("DROP TABLE matches")
        cursor.execute("ALTER TABLE matches_new RENAME TO matches")

    if table_has_column(cursor, "events", "customer_id"):
        cursor.execute("""
            CREATE TABLE events_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                match_id INTEGER,
                owner_user_id INTEGER,
                type TEXT,
                team TEXT,
                player_id TEXT,
                half INTEGER,
                minute INTEGER,
                timestamp INTEGER,
                stoppage_time INTEGER DEFAULT 0,
                FOREIGN KEY (match_id) REFERENCES matches (id)
            )
        """)
        cursor.execute("""
            INSERT INTO events_new (id, match_id, owner_user_id, type, team, player_id, half, minute, timestamp, stoppage_time)
            SELECT id, match_id, owner_user_id, type, team, player_id, half, minute, timestamp, 0
            FROM events
        """)
        cursor.execute("DROP TABLE events")
        cursor.execute("ALTER TABLE events_new RENAME TO events")

    cursor.execute("DROP TABLE IF EXISTS customers")


def import_seed_data_if_needed():
    if DB_PATH.exists() and DB_PATH.stat().st_size > 0:
        return False

    if not SEED_SQL_PATH.exists():
        return False

    conn = sqlite3.connect(str(DB_PATH), timeout=10)
    try:
        with SEED_SQL_PATH.open("r", encoding="utf-8") as seed_file:
            conn.executescript(seed_file.read())
        conn.commit()
        return True
    finally:
        conn.close()


def get_request_user_context():
    user_id_raw = request.headers.get("X-User-Id") or request.args.get("user_id")

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        if user_id_raw:
            try:
                candidate_user_id = int(user_id_raw)
            except ValueError:
                return None, (jsonify({"error": "Invalid user_id"}), 400)

            user = cursor.execute(
                """
                SELECT id, username, display_name, role
                FROM users
                WHERE id = ? AND is_active = 1
                """,
                (candidate_user_id,)
            ).fetchone()

            if not user:
                return None, (jsonify({"error": "User not found"}), 404)

            return user["id"], None

        return None, (jsonify({"error": "Authentication required"}), 401)
    finally:
        conn.close()


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            first_name TEXT,
            last_name TEXT,
            display_name TEXT,
            role TEXT DEFAULT 'member',
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER,
            owner_user_id INTEGER,
            type TEXT,
            team TEXT,
            player_id TEXT,
            half INTEGER,
            minute INTEGER,
            timestamp INTEGER,
            stoppage_time INTEGER DEFAULT 0,
            FOREIGN KEY (match_id) REFERENCES matches (id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            team_code TEXT,
            owner_user_id INTEGER
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_teams (
            user_id INTEGER NOT NULL,
            team_id INTEGER NOT NULL,
            role TEXT NOT NULL DEFAULT 'member',
            joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, team_id),
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (team_id) REFERENCES teams (id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER,
            name TEXT NOT NULL,
            shirt_number INTEGER,
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
            owner_user_id INTEGER
        )
    """)

    ensure_column(cursor, "events", "owner_user_id", "INTEGER")
    ensure_column(cursor, "events", "stoppage_time", "INTEGER DEFAULT 0")
    ensure_column(cursor, "users", "first_name", "TEXT")
    ensure_column(cursor, "users", "last_name", "TEXT")
    ensure_column(cursor, "teams", "team_code", "TEXT")
    ensure_column(cursor, "teams", "owner_user_id", "INTEGER")
    ensure_column(cursor, "players", "owner_user_id", "INTEGER")
    ensure_column(cursor, "matches", "owner_user_id", "INTEGER")

    remove_customer_model_if_present(cursor)

    ensure_column(cursor, "teams", "team_code", "TEXT")

    fallback_user_row = cursor.execute(
        "SELECT id FROM users ORDER BY id ASC LIMIT 1"
    ).fetchone()
    fallback_user_id = fallback_user_row["id"] if fallback_user_row else None

    if fallback_user_id is not None:
        cursor.execute(
            "UPDATE teams SET owner_user_id = ? WHERE owner_user_id IS NULL",
            (fallback_user_id,)
        )

    cursor.execute(
        """
        INSERT OR IGNORE INTO user_teams (user_id, team_id, role)
        SELECT owner_user_id, id, 'owner'
        FROM teams
        WHERE owner_user_id IS NOT NULL
        """
    )

    teams_missing_code = cursor.execute(
        "SELECT id FROM teams WHERE team_code IS NULL OR TRIM(team_code) = ''"
    ).fetchall()
    for row in teams_missing_code:
        code = generate_team_code(cursor)
        cursor.execute(
            "UPDATE teams SET team_code = ? WHERE id = ?",
            (code, row["id"])
        )

    cursor.execute(
        """
        UPDATE events
        SET owner_user_id = (
            SELECT owner_user_id FROM matches WHERE matches.id = events.match_id
        )
        WHERE owner_user_id IS NULL
          AND EXISTS (
              SELECT 1
              FROM matches
              WHERE matches.id = events.match_id
                AND owner_user_id IS NOT NULL
          )
        """,
    )

    if fallback_user_id is not None:
        cursor.execute(
            "UPDATE players SET owner_user_id = ? WHERE owner_user_id IS NULL",
            (fallback_user_id,)
        )
        cursor.execute(
            "UPDATE matches SET owner_user_id = ? WHERE owner_user_id IS NULL",
            (fallback_user_id,)
        )
        cursor.execute(
            "UPDATE events SET owner_user_id = ? WHERE owner_user_id IS NULL",
            (fallback_user_id,)
        )

    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_user_id)"
    )
    cursor.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_code_unique ON teams(team_code)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_user_teams_user ON user_teams(user_id)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_user_teams_team ON user_teams(team_id)"
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

    conn.commit()
    conn.close()


def bootstrap_database():
    global DB_BOOTSTRAPPED
    if DB_BOOTSTRAPPED:
        return

    import_seed_data_if_needed()
    init_db()
    DB_BOOTSTRAPPED = True


bootstrap_database()


@app.route("/hello")
def hello():
    return jsonify(message="Hello, from Flask backend!")


@app.route("/auth/login", methods=["POST", "OPTIONS"])
def auth_login():
    if request.method == "OPTIONS":
        return "", 200

    data = request.json or {}
    username = normalize_username(data.get("username"))
    username_error = validate_username(username)
    if username_error:
        return jsonify({"error": username_error}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    row = cursor.execute(
        """
        SELECT id, username, first_name, last_name, display_name, role, is_active, created_at
        FROM users
        WHERE username = ? COLLATE NOCASE AND is_active = 1
        """,
        (username,)
    ).fetchone()

    conn.close()

    if not row:
        return jsonify({"error": "user not found"}), 404

    return jsonify({"status": "ok", "user": dict(row)})


@app.route("/users", methods=["GET"])
def get_users():
    _, error = get_request_user_context()
    if error:
        return error

    conn = get_db_connection()
    cursor = conn.cursor()

    rows = cursor.execute(
        """
        SELECT id, username, first_name, last_name, display_name, role, is_active, created_at
        FROM users
        ORDER BY id ASC
        """,
    ).fetchall()

    users = [dict(row) for row in rows]
    conn.close()
    return jsonify(users)


@app.route("/users", methods=["POST", "OPTIONS"])
def create_user():
    if request.method == "OPTIONS":
        return "", 200

    data = request.json or {}
    username = normalize_username(data.get("username"))
    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()
    display_name = (data.get("display_name") or "").strip()
    role = (data.get("role") or "member").strip().lower()

    if not display_name:
        display_name = f"{first_name} {last_name}".strip() or username

    username_error = validate_username(username)
    if username_error:
        return jsonify({"error": username_error}), 400

    if role not in {"owner", "admin", "member"}:
        return jsonify({"error": "role must be owner, admin, or member"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO users (username, first_name, last_name, display_name, role)
            VALUES (?, ?, ?, ?, ?)
            """,
            (username, first_name or None, last_name or None, display_name, role)
        )
        user_id = cursor.lastrowid
        conn.commit()
        return jsonify({
            "status": "user created",
            "id": user_id,
            "username": username,
            "first_name": first_name,
            "last_name": last_name,
            "display_name": display_name,
            "role": role
        })
    except sqlite3.IntegrityError:
        conn.rollback()
        return jsonify({"error": "username already exists"}), 409
    finally:
        conn.close()


@app.route("/users/me", methods=["GET"])
def get_me():
    user_id, error = get_request_user_context()
    if error:
        return error

    conn = get_db_connection()
    cursor = conn.cursor()

    row = cursor.execute(
        """
        SELECT id, username, first_name, last_name, display_name, role, is_active, created_at
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
        user_id, error = get_request_user_context()
        if error:
            return error

        data = request.json or {}
        match_id = data.get("match_id")

        conn = get_db_connection()
        cursor = conn.cursor()

        if match_id is not None:
            match = cursor.execute(
                """
                SELECT m.id
                FROM matches m
                LEFT JOIN user_teams ut
                    ON ut.team_id = m.home_team_id AND ut.user_id = ?
                WHERE m.id = ?
                  AND (ut.user_id IS NOT NULL OR m.owner_user_id = ?)
                """,
                (user_id, match_id, user_id)
            ).fetchone()
            if not match:
                conn.close()
                return jsonify({"error": "match not found for user"}), 404

        cursor.execute("""
            INSERT INTO events (
                match_id, owner_user_id, type, team, player_id, half, minute, timestamp, stoppage_time
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            match_id,
            user_id,
            data.get("type"),
            data.get("team"),
            data.get("player_id"),
            data.get("half"),
            data.get("minute"),
            data.get("timestamp"),
            1 if data.get("stoppage_time") else 0
        ))

        conn.commit()
        conn.close()

        return jsonify({"status": "saved"})
    except Exception as exc:
        print("ERROR create_event:", exc)
        return jsonify({"error": str(exc)}), 500


@app.route("/events", methods=["GET"])
def get_events():
    user_id, error = get_request_user_context()
    if error:
        return error

    conn = get_db_connection()
    cursor = conn.cursor()

    rows = cursor.execute(
        """
        SELECT DISTINCT e.*
        FROM events e
        LEFT JOIN matches m ON m.id = e.match_id
        LEFT JOIN user_teams ut
            ON ut.team_id = m.home_team_id AND ut.user_id = ?
        WHERE ut.user_id IS NOT NULL
           OR e.owner_user_id = ?
        ORDER BY e.id ASC
        """,
        (user_id, user_id)
    ).fetchall()
    events = [dict(row) for row in rows]

    conn.close()
    return jsonify(events)


# TEAMS
@app.route("/teams", methods=["POST", "OPTIONS"])
def create_team():
    if request.method == "OPTIONS":
        return "", 200

    user_id, error = get_request_user_context()
    if error:
        return error

    data = request.json or {}

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        team_name = (data.get("name") or "").strip()
        if not team_name:
            return jsonify({"error": "name is required"}), 400

        team_code = generate_team_code(cursor)

        cursor.execute("""
            INSERT INTO teams (name, team_code, owner_user_id)
            VALUES (?, ?, ?)
        """, (team_name, team_code, user_id))

        team_id = cursor.lastrowid
        cursor.execute(
            "INSERT OR IGNORE INTO user_teams (user_id, team_id, role) VALUES (?, ?, 'owner')",
            (user_id, team_id)
        )

        conn.commit()
        return jsonify({
            "status": "team created",
            "id": team_id,
            "team_code": team_code
        })
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        conn.close()


@app.route("/teams", methods=["GET"])
def get_teams():
    user_id, error = get_request_user_context()
    if error:
        return error

    conn = get_db_connection()
    cursor = conn.cursor()

    rows = cursor.execute(
        """
        SELECT t.*, ut.role AS membership_role
        FROM teams t
        JOIN user_teams ut ON ut.team_id = t.id
        WHERE ut.user_id = ?
        ORDER BY t.name ASC
        """,
        (user_id,)
    ).fetchall()
    teams = [dict(row) for row in rows]

    conn.close()
    return jsonify(teams)


@app.route("/teams/join", methods=["POST", "OPTIONS"])
def join_team_by_code():
    if request.method == "OPTIONS":
        return "", 200

    user_id, error = get_request_user_context()
    if error:
        return error

    data = request.json or {}
    team_code = normalize_team_code(data.get("team_code"))

    if not is_valid_team_code(team_code):
        return jsonify({"error": "invalid team code"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        team = cursor.execute(
            "SELECT id, name, team_code FROM teams WHERE team_code = ?",
            (team_code,)
        ).fetchone()

        if not team:
            return jsonify({"error": "team not found"}), 404

        existing = cursor.execute(
            "SELECT role FROM user_teams WHERE user_id = ? AND team_id = ?",
            (user_id, team["id"])
        ).fetchone()

        if existing:
            return jsonify({
                "status": "already member",
                "team": {
                    "id": team["id"],
                    "name": team["name"],
                    "team_code": team["team_code"],
                    "membership_role": existing["role"]
                }
            })

        cursor.execute(
            "INSERT INTO user_teams (user_id, team_id, role) VALUES (?, ?, 'member')",
            (user_id, team["id"])
        )
        conn.commit()

        return jsonify({
            "status": "joined",
            "team": {
                "id": team["id"],
                "name": team["name"],
                "team_code": team["team_code"],
                "membership_role": "member"
            }
        })
    except Exception as exc:
        conn.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        conn.close()


@app.route("/teams/<int:team_id>", methods=["DELETE", "OPTIONS"])
def delete_team(team_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id, error = get_request_user_context()
    if error:
        return error

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        if not user_owns_team(cursor, user_id, team_id):
            return jsonify({"error": "only owner can delete team"}), 403

        # Delete team players first
        cursor.execute(
            "DELETE FROM players WHERE team_id = ?",
            (team_id,)
        )
        cursor.execute(
            "DELETE FROM user_teams WHERE team_id = ?",
            (team_id,)
        )
        cursor.execute(
            "DELETE FROM teams WHERE id = ?",
            (team_id,)
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

    user_id, error = get_request_user_context()
    if error:
        return error

    data = request.json or {}
    new_name = (data.get("name") or "").strip()

    if not new_name:
        return jsonify({"error": "name is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        if not user_owns_team(cursor, user_id, team_id):
            return jsonify({"error": "only owner can update team"}), 403

        cursor.execute(
            "UPDATE teams SET name = ? WHERE id = ?",
            (new_name, team_id)
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

    user_id, error = get_request_user_context()
    if error:
        return error

    data = request.json or {}
    team_id = data.get("team_id")

    conn = get_db_connection()
    cursor = conn.cursor()

    if not user_has_team_access(cursor, user_id, team_id):
        conn.close()
        return jsonify({"error": "team not found for user"}), 404

    cursor.execute("""
        INSERT INTO players (team_id, name, shirt_number, owner_user_id)
        VALUES (?, ?, ?, ?)
    """, (
        team_id,
        data.get("name"),
        data.get("shirt_number"),
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
    user_id, error = get_request_user_context()
    if error:
        return error

    conn = get_db_connection()
    cursor = conn.cursor()

    rows = cursor.execute(
        """
        SELECT p.*
        FROM players p
        JOIN user_teams ut ON ut.team_id = p.team_id
        WHERE ut.user_id = ?
        ORDER BY p.team_id ASC, p.shirt_number ASC, p.id ASC
        """,
        (user_id,)
    ).fetchall()
    players = [dict(row) for row in rows]

    conn.close()
    return jsonify(players)


@app.route("/players/<int:player_id>", methods=["DELETE", "OPTIONS"])
def delete_player(player_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id, error = get_request_user_context()
    if error:
        return error

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        player = cursor.execute(
            """
            SELECT p.id, p.team_id
            FROM players p
            JOIN user_teams ut ON ut.team_id = p.team_id
            WHERE p.id = ? AND ut.user_id = ?
            """,
            (player_id, user_id)
        ).fetchone()
        if not player:
            return jsonify({"error": "player not found"}), 404

        cursor.execute(
            "DELETE FROM players WHERE id = ?",
            (player_id,)
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

    user_id, error = get_request_user_context()
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
        player = cursor.execute(
            """
            SELECT p.id, p.team_id
            FROM players p
            JOIN user_teams ut ON ut.team_id = p.team_id
            WHERE p.id = ? AND ut.user_id = ?
            """,
            (player_id, user_id)
        ).fetchone()
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
    user_id, error = get_request_user_context()
    if error:
        return error

    conn = get_db_connection()
    cursor = conn.cursor()

    if not user_has_team_access(cursor, user_id, team_id):
        conn.close()
        return jsonify({"error": "team not found for user"}), 404

    rows = cursor.execute(
        "SELECT * FROM players WHERE team_id = ? ORDER BY shirt_number ASC, id ASC",
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

    user_id, error = get_request_user_context()
    if error:
        return error

    data = request.json or {}
    home_team_id = data.get("home_team_id")

    conn = get_db_connection()
    cursor = conn.cursor()

    if home_team_id is not None and not user_has_team_access(cursor, user_id, home_team_id):
        conn.close()
        return jsonify({"error": "team not found for user"}), 404

    cursor.execute("""
        INSERT INTO matches (
            home_team_id,
            home_team_name,
            away_team_id,
            away_team_name,
            date,
            owner_user_id
        )
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        home_team_id,
        data.get("home_team_name"),
        data.get("away_team_id"),
        data.get("away_team_name"),
        data.get("date"),
        user_id
    ))

    conn.commit()
    conn.close()

    return jsonify({"status": "match created"})


@app.route("/matches", methods=["GET"])
def get_matches():
    user_id, error = get_request_user_context()
    if error:
        return error

    conn = get_db_connection()
    cursor = conn.cursor()

    rows = cursor.execute(
        """
        SELECT DISTINCT m.*
        FROM matches m
        LEFT JOIN user_teams ut
            ON ut.team_id = m.home_team_id AND ut.user_id = ?
        WHERE ut.user_id IS NOT NULL
           OR m.owner_user_id = ?
        ORDER BY m.id DESC
        """,
        (user_id, user_id)
    ).fetchall()
    matches = [dict(row) for row in rows]

    conn.close()
    return jsonify(matches)


@app.route("/matches/<int:match_id>", methods=["DELETE", "OPTIONS"])
def delete_match(match_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id, error = get_request_user_context()
    if error:
        return error

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        match = cursor.execute(
            """
            SELECT m.id
            FROM matches m
            LEFT JOIN user_teams ut
                ON ut.team_id = m.home_team_id AND ut.user_id = ?
            WHERE m.id = ?
              AND (ut.user_id IS NOT NULL OR m.owner_user_id = ?)
            """,
            (user_id, match_id, user_id)
        ).fetchone()
        if not match:
            return jsonify({"error": "match not found"}), 404

        cursor.execute(
            "DELETE FROM events WHERE match_id = ?",
            (match_id,)
        )
        deleted_events = cursor.rowcount
        cursor.execute(
            "DELETE FROM matches WHERE id = ?",
            (match_id,)
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
        user_id, error = get_request_user_context()
        if error:
            return error

        data = request.json or {}
        match = data.get("match") or {}
        events = data.get("events", [])
        home_team_id = match.get("home_team_id")

        conn = get_db_connection()
        cursor = conn.cursor()

        if home_team_id is not None and not user_has_team_access(cursor, user_id, home_team_id):
            conn.close()
            return jsonify({"error": "team not found for user"}), 404

        cursor.execute("""
            INSERT INTO matches (
                home_team_id,
                home_team_name,
                away_team_id,
                away_team_name,
                date,
                owner_user_id
            )
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            home_team_id,
            match.get("home_team_name"),
            match.get("away_team_id"),
            match.get("away_team_name"),
            match.get("date"),
            user_id
        ))

        match_id = cursor.lastrowid

        event_data = [
            (
                match_id,
                user_id,
                e.get("type"),
                e.get("team"),
                e.get("player_id"),
                e.get("half"),
                e.get("minute"),
                e.get("timestamp"),
                1 if e.get("stoppage_time") else 0
            )
            for e in events
        ]

        if event_data:
            cursor.executemany("""
                INSERT INTO events (
                    match_id, owner_user_id, type, team, player_id, half, minute, timestamp, stoppage_time
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
    print("Using DB:", DB_PATH)
    port = int(os.getenv("PORT", "5000"))
    is_render = (os.getenv("RENDER") or "").lower() == "true"
    debug = (os.getenv("FLASK_DEBUG") or "1") == "1"

    if is_render:
        debug = False

    app.run(host="0.0.0.0", port=port, debug=debug)
    