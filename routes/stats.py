from flask import Blueprint, jsonify
from services.auth import require_auth
from models.stats import get_completion_heatmap

bp = Blueprint('stats', __name__, url_prefix='/api/stats')


@bp.get('/heatmap')
@require_auth
def heatmap(user_id):
    return jsonify(get_completion_heatmap(user_id))
