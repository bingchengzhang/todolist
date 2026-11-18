from flask import Blueprint, jsonify, request

from services.auth import login, register

bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@bp.post('/register')
def do_register():
    data = request.get_json(silent=True) or {}
    try:
        body = register(data.get('username', ''), data.get('password', ''))
        return jsonify(body), 201
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400


@bp.post('/login')
def do_login():
    data = request.get_json(silent=True) or {}
    try:
        return jsonify(login(data.get('username', ''), data.get('password', '')))
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400
