import psycopg2.extras
from .database import get_connection


def insert_todo(text, category, priority, deadline, user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        'INSERT INTO todos (text, category, priority, deadline, user_id) '
        'VALUES (%s, %s, %s, %s, %s) RETURNING id',
        (text, category, priority, deadline, user_id)
    )
    todo_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return todo_id


def get_all_todos(user_id):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        "SELECT id, text, done, category, priority, deadline, "
        "to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at "
        "FROM todos WHERE user_id = %s "
        "ORDER BY "
        "  CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, "
        "  deadline ASC, created_at DESC",
        (user_id,)
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    result = []
    for row in rows:
        d = dict(row)
        d['deadline'] = d['deadline'].isoformat() if d['deadline'] else None
        result.append(d)
    return result


def update_todo_done(todo_id, done, user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        'UPDATE todos SET done = %s WHERE id = %s AND user_id = %s',
        (done, todo_id, user_id)
    )
    affected = cur.rowcount
    conn.commit()
    cur.close()
    conn.close()
    return affected > 0


def update_todo_priority(todo_id, priority, user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        'UPDATE todos SET priority = %s WHERE id = %s AND user_id = %s',
        (priority, todo_id, user_id)
    )
    affected = cur.rowcount
    conn.commit()
    cur.close()
    conn.close()
    return affected > 0


def update_todo_deadline(todo_id, deadline, user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        'UPDATE todos SET deadline = %s WHERE id = %s AND user_id = %s',
        (deadline or None, todo_id, user_id)
    )
    affected = cur.rowcount
    conn.commit()
    cur.close()
    conn.close()
    return affected > 0


def delete_todo(todo_id, user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        'DELETE FROM todos WHERE id = %s AND user_id = %s',
        (todo_id, user_id)
    )
    affected = cur.rowcount
    conn.commit()
    cur.close()
    conn.close()
    return affected > 0
