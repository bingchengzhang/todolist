import os
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify
from models.user import create_user, get_user_by_username

SECRET = os.environ.get('JWT_SECRET', 'change-me-in-production')


def register(username: str, password: str) -> dict:
    username = username.strip().lower()
    if len(username) < 2 or len(username) > 20:
        raise ValueError('用户名需 2-20 个字符')
    if not username.replace('_', '').isalnum():
        raise ValueError('用户名只能包含字母、数字和下划线')
    if len(password) < 6:
        raise ValueError('密码至少 6 位')
    if get_user_by_username(username):
        raise ValueError('用户名已被占用')

    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    user_id = create_user(username, pw_hash)
    return {'ok': True, 'token': _make_token(user_id), 'username': username}


def login(username: str, password: str) -> dict:
    username = username.strip().lower()
    user = get_user_by_username(username)
    if not user or not bcrypt.checkpw(password.encode(), user['password_hash'].encode()):
        raise ValueError('用户名或密码错误')
    return {'ok': True, 'token': _make_token(user['id']), 'username': user['username']}


def _make_token(user_id: int) -> str:
    return jwt.encode(
        {'sub': user_id, 'exp': datetime.now(timezone.utc) + timedelta(days=30)},
        SECRET,
        algorithm='HS256',
    )


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').removeprefix('Bearer ').strip()
        try:
            payload = jwt.decode(token, SECRET, algorithms=['HS256'])
            user_id = payload['sub']
        except Exception:
            return jsonify({'ok': False, 'error': 'Unauthorized'}), 401
        return f(*args, user_id=user_id, **kwargs)
    return decorated
