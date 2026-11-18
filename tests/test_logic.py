import os
import unittest
from unittest.mock import patch

from services.ai import analyze
from services.auth import register
from services.todo import change_priority, create_todo


class AnalyzeTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'DEEPSEEK_API_KEY': ''})
        self.env.start()

    def tearDown(self):
        self.env.stop()

    def test_keywords(self):
        self.assertEqual(analyze('复习高数'), {'category': '学习', 'priority': '中'})
        self.assertEqual(analyze('准备会议'), {'category': '工作', 'priority': '中'})
        self.assertEqual(analyze('今天开会'), {'category': '其他', 'priority': '高'})
        self.assertEqual(analyze('买早饭')['category'], '生活')
        self.assertEqual(analyze('随便看看'), {'category': '其他', 'priority': '低'})

    @patch('services.ai.requests.post')
    def test_invalid_model_values_are_replaced(self, post):
        os.environ['DEEPSEEK_API_KEY'] = 'sk-test'
        post.return_value.raise_for_status.return_value = None
        post.return_value.json.return_value = {
            'choices': [{
                'message': {
                    'content': '```json\n{"category": "娱乐", "priority": "超高", "reason": "x"}\n```',
                },
            }],
        }
        self.assertEqual(analyze('随便写'), {'category': '其他', 'priority': '中'})

    @patch('services.ai.requests.post', side_effect=OSError('down'))
    def test_request_error_uses_keywords(self, _post):
        os.environ['DEEPSEEK_API_KEY'] = 'sk-test'
        self.assertEqual(analyze('买菜')['category'], '生活')


class TodoValidationTests(unittest.TestCase):
    def test_blank_text(self):
        with self.assertRaisesRegex(ValueError, '不能为空'):
            create_todo('   ', 1)

    def test_text_limit(self):
        with self.assertRaisesRegex(ValueError, '200'):
            create_todo('字' * 201, 1)

    @patch('services.todo.insert_todo', return_value=7)
    @patch('services.todo.analyze', return_value={'category': '其他', 'priority': '中'})
    def test_explicit_values_win(self, _analyze, insert):
        result = create_todo('  买菜 ', 3, category='工作', priority='高')
        self.assertEqual(result, {'ok': True, 'id': 7, 'category': '工作', 'priority': '高'})
        insert.assert_called_once_with('买菜', '工作', '高', None, 3)

    @patch('services.todo.insert_todo', return_value=8)
    @patch('services.todo.analyze', return_value={'category': '生活', 'priority': '低'})
    def test_unknown_values_fall_back_to_analysis(self, _analyze, insert):
        result = create_todo('买菜', 3, category='娱乐', priority='急')
        self.assertEqual(result['category'], '生活')
        self.assertEqual(result['priority'], '低')
        insert.assert_called_once_with('买菜', '生活', '低', None, 3)

    def test_unknown_priority_is_rejected(self):
        with self.assertRaises(ValueError):
            change_priority(1, '急', 1)


class AuthValidationTests(unittest.TestCase):
    def test_short_username(self):
        with self.assertRaisesRegex(ValueError, '2-20'):
            register('a', '123456')

    def test_username_characters(self):
        with self.assertRaisesRegex(ValueError, '下划线'):
            register('ab cd', '123456')

    def test_short_password(self):
        with self.assertRaisesRegex(ValueError, '6'):
            register('abc', '12345')
