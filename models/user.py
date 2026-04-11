import psycopg2.extras
from .database import get_connection


def create_user(username: str, password_hash: str) -> int:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        'INSERT INTO users (username, password_hash) VALUES (%s, %s) RETURNING id',
        (username, password_hash)
    )
    user_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return user_id


def get_user_by_username(username: str) -> dict | None:
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        'SELECT id, username, password_hash FROM users WHERE username = %s',
        (username,)
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None
