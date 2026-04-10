import psycopg2.extras
from .database import get_connection


def insert_todo(text, category, priority):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        'INSERT INTO todos (text, category, priority) VALUES (%s, %s, %s) RETURNING id',
        (text, category, priority)
    )
    todo_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return todo_id


def get_all_todos():
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        "SELECT id, text, done, category, priority, "
        "to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at "
        "FROM todos ORDER BY created_at DESC"
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(row) for row in rows]


def update_todo_done(todo_id, done):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        'UPDATE todos SET done = %s WHERE id = %s',
        (done, todo_id)
    )
    affected = cur.rowcount
    conn.commit()
    cur.close()
    conn.close()
    return affected > 0


def update_todo_priority(todo_id, priority):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        'UPDATE todos SET priority = %s WHERE id = %s',
        (priority, todo_id)
    )
    affected = cur.rowcount
    conn.commit()
    cur.close()
    conn.close()
    return affected > 0


def delete_todo(todo_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        'DELETE FROM todos WHERE id = %s', (todo_id,)
    )
    affected = cur.rowcount
    conn.commit()
    cur.close()
    conn.close()
    return affected > 0
