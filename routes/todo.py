from flask import Blueprint, request, jsonify
from services.todo import (
    create_todo, list_todos,
    complete_todo, change_priority, change_deadline,
    remove_todo,
)

bp = Blueprint('todos', __name__, url_prefix='/api/todos')


@bp.get('/')
def get_todos():
    return jsonify(list_todos())


@bp.post('/')
def post_todo():
    data = request.get_json(silent=True) or {}
    text     = data.get('text', '')
    deadline = data.get('deadline') or None
    try:
        result = create_todo(text, deadline)
        return jsonify(result), 201
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400


@bp.patch('/<int:todo_id>')
def patch_todo(todo_id):
    data = request.get_json(silent=True) or {}

    if 'done' in data:
        try:
            return jsonify(complete_todo(todo_id, bool(data['done'])))
        except LookupError as e:
            return jsonify({'ok': False, 'error': str(e)}), 404

    if 'priority' in data:
        try:
            return jsonify(change_priority(todo_id, data['priority']))
        except ValueError as e:
            return jsonify({'ok': False, 'error': str(e)}), 400
        except LookupError as e:
            return jsonify({'ok': False, 'error': str(e)}), 404

    if 'deadline' in data:
        try:
            return jsonify(change_deadline(todo_id, data['deadline'] or None))
        except LookupError as e:
            return jsonify({'ok': False, 'error': str(e)}), 404

    return jsonify({'ok': False, 'error': 'missing field'}), 400


@bp.delete('/<int:todo_id>')
def delete_todo_route(todo_id):
    try:
        return jsonify(remove_todo(todo_id))
    except LookupError as e:
        return jsonify({'ok': False, 'error': str(e)}), 404
