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
        CREATE TABLE IF NOT EXISTS todos (
            id          SERIAL PRIMARY KEY,
            text        TEXT NOT NULL,
            done        BOOLEAN DEFAULT FALSE,
            category    TEXT,
            priority    TEXT,
            deadline    TIMESTAMP,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Safe migration: add column if table already existed without it
    cur.execute('''
        ALTER TABLE todos ADD COLUMN IF NOT EXISTS deadline TIMESTAMP
    ''')
    conn.commit()
    cur.close()
    conn.close()
