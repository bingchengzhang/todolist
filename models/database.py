import os
import psycopg2
import psycopg2.extras

DATABASE_URL = os.environ['DATABASE_URL']


def get_connection():
    return psycopg2.connect(DATABASE_URL)


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
    cur.execute('ALTER TABLE todos ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)')
    cur.execute('ALTER TABLE todos ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP')

    conn.commit()
    cur.close()
    conn.close()
