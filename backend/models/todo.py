from .database import get_connection


def insert_todo(text, category, priority):
    conn = get_connection()
    cur = conn.execute(
        'INSERT INTO todos (text, category, priority) VALUES (?, ?, ?)',
        (text, category, priority)
    )
    todo_id = cur.lastrowid
    conn.commit()
    conn.close()
    return todo_id


def get_all_todos():
    conn = get_connection()
    rows = conn.execute(
        'SELECT id, text, done, category, priority, '
        "strftime('%Y-%m-%d %H:%M', created_at) AS created_at "
        'FROM todos ORDER BY created_at DESC'
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def update_todo_done(todo_id, done):
    conn = get_connection()
    affected = conn.execute(
        'UPDATE todos SET done = ? WHERE id = ?',
        (int(done), todo_id)
    ).rowcount
    conn.commit()
    conn.close()
    return affected > 0


def update_todo_priority(todo_id, priority):
    conn = get_connection()
    affected = conn.execute(
        'UPDATE todos SET priority = ? WHERE id = ?',
        (priority, todo_id)
    ).rowcount
    conn.commit()
    conn.close()
    return affected > 0


def delete_todo(todo_id):
    conn = get_connection()
    affected = conn.execute(
        'DELETE FROM todos WHERE id = ?', (todo_id,)
    ).rowcount
    conn.commit()
    conn.close()
    return affected > 0
