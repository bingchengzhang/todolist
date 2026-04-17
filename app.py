import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, send_from_directory
from flask_cors import CORS
from models.database import init_db
from routes.todo import bp as todos_bp
from routes.auth import bp as auth_bp
from routes.stats import bp as stats_bp

FRONTEND = os.path.join(os.path.dirname(__file__), 'frontend')

app = Flask(__name__, static_folder=FRONTEND, static_url_path='')
CORS(app, resources={r"/api/*": {"origins": "*"}})

init_db()
app.register_blueprint(todos_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(stats_bp)


@app.get('/')
def index():
    return send_from_directory(FRONTEND, 'index.html')


if __name__ == '__main__':
    app.run(debug=True, port=5000)
