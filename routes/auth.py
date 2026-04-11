from flask import Blueprint, request, jsonify
from services.auth import register, login

bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@bp.post('/register')
def do_register():
    data = request.get_json(silent=True) or {}
    try:
        return jsonify(register(data.get('username', ''), data.get('password', ''))), 201
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400


@bp.post('/login')
def do_login():
    data = request.get_json(silent=True) or {}
    try:
        return jsonify(login(data.get('username', ''), data.get('password', '')))
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400
