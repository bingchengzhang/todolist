import json
import os

import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'
PROMPT = '''你是一个任务管理助手。
给定任务："{text}"
请返回 JSON，格式如下：
{{"category": "学习|生活|工作|其他", "priority": "高|中|低", "reason": "一句话说明理由"}}
只返回 JSON，不要其他内容。'''

VALID_CATEGORIES = {'学习', '生活', '工作', '其他'}
VALID_PRIORITIES = {'高', '中', '低'}


CATEGORY_KEYWORDS = {
    '学习': ['复习', '学习', '作业', '考试', '读书', '笔记', '课', '练习', '背', '刷题', '论文', '报告'],
    '工作': ['会议', '需求', '上班', '项目', '客户', '汇报', '邮件', '文档', '代码', '开发', '测试', '部署'],
    '生活': ['买', '吃', '喝', '睡', '运动', '健身', '购物', '做饭', '洗', '打扫', '医院', '看病', '家'],
}
PRIORITY_HIGH_KEYWORDS = ['紧急', '立刻', '马上', '今天', '明天', '截止', '重要', '考试', '面试', '汇报']
PRIORITY_LOW_KEYWORDS  = ['随便', '有空', '以后', '下次', '可选', '顺便']


def analyze(text: str) -> dict:
    """Call DeepSeek API to classify the task. Falls back to keyword matching on any error."""
    try:
        return _call_deepseek(text)
    except Exception:
        return _keyword_fallback(text)


def _keyword_fallback(text: str) -> dict:
    category = '其他'
    for cat, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            category = cat
            break
    if any(kw in text for kw in PRIORITY_HIGH_KEYWORDS):
        priority = '高'
    elif any(kw in text for kw in PRIORITY_LOW_KEYWORDS):
        priority = '低'
    else:
        priority = '中'
    return {'category': category, 'priority': priority}


def _call_deepseek(text: str) -> dict:
    api_key = os.getenv('DEEPSEEK_API_KEY', '')
    if not api_key or api_key == 'your_api_key_here':
        raise ValueError('DEEPSEEK_API_KEY not set')

    resp = requests.post(
        DEEPSEEK_URL,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': 'deepseek-chat',
            'messages': [{'role': 'user', 'content': PROMPT.format(text=text)}],
            'temperature': 0,
        },
        timeout=5,
    )
    resp.raise_for_status()

    raw = resp.json()['choices'][0]['message']['content'].strip()
    # Strip markdown code fences if present
    if raw.startswith('```'):
        raw = raw.split('```')[1]
        if raw.startswith('json'):
            raw = raw[4:]
    data = json.loads(raw)

    category = data.get('category', '其他')
    priority = data.get('priority', '中')

    # Validate values are within allowed set
    if category not in VALID_CATEGORIES:
        category = '其他'
    if priority not in VALID_PRIORITIES:
        priority = '中'

    return {'category': category, 'priority': priority}
