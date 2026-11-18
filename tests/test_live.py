import os
import unittest
import uuid
from datetime import datetime, timezone

DATABASE_URL = os.environ.get('DATABASE_URL')


@unittest.skipUnless(DATABASE_URL, 'DATABASE_URL is not set')
class LiveApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ['DEEPSEEK_API_KEY'] = ''
        import app as app_module

        cls.client = app_module.app.test_client()
        cls.username = 'u' + uuid.uuid4().hex[:10]
        created = cls.client.post('/api/auth/register', json={
            'username': cls.username,
            'password': 'secret12',
        })
        assert created.status_code == 201, created.get_json()
        cls.headers = {'Authorization': f"Bearer {created.get_json()['token']}"}

    def test_index_and_auth_wall(self):
        page = self.client.get('/')
        self.assertEqual(page.status_code, 200)
        self.assertIn('待办'.encode(), page.data)
        self.assertIn(b'id="todo-input"', page.data)

        blocked = self.client.get('/api/todos/')
        self.assertEqual(blocked.status_code, 401)
        self.assertEqual(self.client.get('/api/stats/heatmap').status_code, 401)

    def test_login(self):
        response = self.client.post('/api/auth/login', json={
            'username': self.username.upper(),
            'password': 'secret12',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['username'], self.username)

    def test_todo_roundtrip(self):
        created = self.client.post(
            '/api/todos/',
            json={'text': '复习离散数学'},
            headers=self.headers,
        )
        self.assertEqual(created.status_code, 201)
        body = created.get_json()
        self.assertEqual(body['category'], '学习')
        self.assertEqual(body['priority'], '中')
        todo_id = body['id']

        listed = self.client.get('/api/todos/', headers=self.headers).get_json()
        match = next(row for row in listed if row['id'] == todo_id)
        self.assertFalse(match['done'])
        self.assertEqual(match['text'], '复习离散数学')

        bumped = self.client.patch(
            f'/api/todos/{todo_id}',
            json={'priority': '高'},
            headers=self.headers,
        )
        self.assertEqual(bumped.status_code, 200)
        rejected = self.client.patch(
            f'/api/todos/{todo_id}',
            json={'priority': '急'},
            headers=self.headers,
        )
        self.assertEqual(rejected.status_code, 400)

        done = self.client.patch(
            f'/api/todos/{todo_id}',
            json={'done': True},
            headers=self.headers,
        )
        self.assertEqual(done.status_code, 200)

        today = datetime.now(timezone.utc).date().isoformat()
        heatmap = self.client.get('/api/stats/heatmap', headers=self.headers).get_json()
        self.assertGreaterEqual(heatmap.get(today, 0), 1)

        other = self.client.post('/api/auth/register', json={
            'username': 'v' + uuid.uuid4().hex[:10],
            'password': 'secret12',
        })
        other_headers = {'Authorization': f"Bearer {other.get_json()['token']}"}
        denied = self.client.delete(f'/api/todos/{todo_id}', headers=other_headers)
        self.assertEqual(denied.status_code, 404)

        removed = self.client.delete(f'/api/todos/{todo_id}', headers=self.headers)
        self.assertEqual(removed.status_code, 200)
        remaining = self.client.get('/api/todos/', headers=self.headers).get_json()
        self.assertFalse(any(row['id'] == todo_id for row in remaining))

    def test_blank_text(self):
        response = self.client.post('/api/todos/', json={'text': '  '}, headers=self.headers)
        self.assertEqual(response.status_code, 400)
