from models.todo import (
    insert_todo, get_all_todos,
    update_todo_done, update_todo_priority, update_todo_deadline,
    delete_todo,
)
from services.ai import analyze

VALID_CATEGORIES = {'工作', '学习', '生活', '其他'}
VALID_PRIORITIES = {'高', '中', '低'}


def create_todo(text: str, user_id: int, deadline=None, category=None, priority=None) -> dict:
    if not text or not text.strip():
        raise ValueError('任务内容不能为空')
    if len(text) > 200:
        raise ValueError('任务内容不能超过 200 字')

    text = text.strip()
    ai_result = analyze(text)

    final_category = category if category in VALID_CATEGORIES else ai_result['category']
    final_priority = priority if priority in VALID_PRIORITIES else ai_result['priority']

    todo_id = insert_todo(text, final_category, final_priority, deadline or None, user_id)
    return {
        'ok': True,
        'id': todo_id,
        'category': final_category,
        'priority': final_priority,
    }


def list_todos(user_id: int) -> list:
    return get_all_todos(user_id)


def complete_todo(todo_id: int, done: bool, user_id: int) -> dict:
    if not update_todo_done(todo_id, done, user_id):
        raise LookupError(f'Todo {todo_id} not found')
    return {'ok': True}


def change_priority(todo_id: int, priority: str, user_id: int) -> dict:
    if priority not in VALID_PRIORITIES:
        raise ValueError(f'无效优先级：{priority}')
    if not update_todo_priority(todo_id, priority, user_id):
        raise LookupError(f'Todo {todo_id} not found')
    return {'ok': True}


def change_deadline(todo_id: int, deadline, user_id: int) -> dict:
    if not update_todo_deadline(todo_id, deadline, user_id):
        raise LookupError(f'Todo {todo_id} not found')
    return {'ok': True}


def remove_todo(todo_id: int, user_id: int) -> dict:
    if not delete_todo(todo_id, user_id):
        raise LookupError(f'Todo {todo_id} not found')
    return {'ok': True}
