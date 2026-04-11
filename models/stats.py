from .database import get_connection


def get_completion_heatmap(user_id: int) -> dict:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute('''
        SELECT
            to_char(completed_at, 'YYYY-MM-DD') AS date,
            COUNT(*) AS count
        FROM todos
        WHERE user_id = %s
          AND done = TRUE
          AND completed_at IS NOT NULL
          AND completed_at >= CURRENT_DATE - INTERVAL '83 days'
        GROUP BY to_char(completed_at, 'YYYY-MM-DD')
        ORDER BY date
    ''', (user_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return {row[0]: row[1] for row in rows}
