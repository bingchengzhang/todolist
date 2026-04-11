from flask import Blueprint, request, jsonify
from services.auth import require_auth
from services.todo import (
    create_todo, list_todos,
    complete_todo, change_priority, change_deadline,
    remove_todo,
)

bp = Blueprint('todos', __name__, url_prefix='/api/todos')


@bp.get('/')
@require_auth
def get_todos(user_id):
    return jsonify(list_todos(user_id))


@bp.post('/')
@require_auth
def post_todo(user_id):
    data = request.get_json(silent=True) or {}
    try:
        result = create_todo(data.get('text', ''), user_id, data.get('deadline') or None)
        return jsonify(result), 201
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400


@bp.patch('/<int:todo_id>')
@require_auth
def patch_todo(todo_id, user_id):
    data = request.get_json(silent=True) or {}

    if 'done' in data:
        try:
            return jsonify(complete_todo(todo_id, bool(data['done']), user_id))
        except LookupError as e:
            return jsonify({'ok': False, 'error': str(e)}), 404

    if 'priority' in data:
        try:
            return jsonify(change_priority(todo_id, data['priority'], user_id))
        except (ValueError, LookupError) as e:
            code = 400 if isinstance(e, ValueError) else 404
            return jsonify({'ok': False, 'error': str(e)}), code

    if 'deadline' in data:
        try:
            return jsonify(change_deadline(todo_id, data['deadline'] or None, user_id))
        except LookupError as e:
            return jsonify({'ok': False, 'error': str(e)}), 404

    return jsonify({'ok': False, 'error': 'missing field'}), 400


@bp.delete('/<int:todo_id>')
@require_auth
def delete_todo_route(todo_id, user_id):
    try:
        return jsonify(remove_todo(todo_id, user_id))
    except LookupError as e:
        return jsonify({'ok': False, 'error': str(e)}), 404
