import os

import psycopg2


def get_connection():
    url = os.environ.get('DATABASE_URL')
    if not url:
        raise ValueError('DATABASE_URL variable is missing')
    return psycopg2.connect(url, sslmode='require')


def init_db():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id            SERIAL PRIMARY KEY,
            username      TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS todos (
            id           SERIAL PRIMARY KEY,
            user_id      INTEGER REFERENCES users(id),
            text         TEXT NOT NULL,
            done         BOOLEAN DEFAULT FALSE,
            category     TEXT,
            priority     TEXT,
            deadline     TIMESTAMP,
            completed_at TIMESTAMP,
            created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cur.execute('ALTER TABLE todos ADD COLUMN IF NOT EXISTS deadline TIMESTAMP')
    cur.execute(
        'ALTER TABLE todos ADD COLUMN IF NOT EXISTS '
        'user_id INTEGER REFERENCES users(id)'
    )
    cur.execute('ALTER TABLE todos ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP')

    conn.commit()
    cur.close()
    conn.close()
