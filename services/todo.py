from models.todo import (
    insert_todo, get_all_todos,
    update_todo_done, update_todo_priority, update_todo_deadline,
    delete_todo,
)
from services.ai import analyze


def create_todo(text: str, deadline=None) -> dict:
    if not text or not text.strip():
        raise ValueError('任务内容不能为空')
    if len(text) > 200:
        raise ValueError('任务内容不能超过 200 字')

    text = text.strip()
    ai_result = analyze(text)
    todo_id = insert_todo(text, ai_result['category'], ai_result['priority'], deadline or None)
    return {
        'ok': True,
        'id': todo_id,
        'category': ai_result['category'],
        'priority': ai_result['priority'],
    }


def list_todos() -> list:
    return get_all_todos()


def complete_todo(todo_id: int, done: bool) -> dict:
    found = update_todo_done(todo_id, done)
    if not found:
        raise LookupError(f'Todo {todo_id} not found')
    return {'ok': True}


VALID_PRIORITIES = {'高', '中', '低'}


def change_priority(todo_id: int, priority: str) -> dict:
    if priority not in VALID_PRIORITIES:
        raise ValueError(f'无效优先级：{priority}')
    found = update_todo_priority(todo_id, priority)
    if not found:
        raise LookupError(f'Todo {todo_id} not found')
    return {'ok': True}


def change_deadline(todo_id: int, deadline) -> dict:
    found = update_todo_deadline(todo_id, deadline)
    if not found:
        raise LookupError(f'Todo {todo_id} not found')
    return {'ok': True}


def remove_todo(todo_id: int) -> dict:
    found = delete_todo(todo_id)
    if not found:
        raise LookupError(f'Todo {todo_id} not found')
    return {'ok': True}
