# TodoList 项目规格文档

## 项目概述

本地单用户 AI 增强 Todo 应用，支持任务管理、AI 自动分类与优先级推荐。
技术栈：Python（Flask）+ 纯 HTML/CSS/JS + SQLite

---

## 功能模块

### 1. 任务管理（核心）

| 功能 | 描述 |
|------|------|
| 添加任务 | 输入文字，提交后加入列表 |
| 删除任务 | 点击删除按钮，从列表移除 |
| 完成任务 | 点击勾选，标记为已完成，置灰显示 |
| 查看列表 | 启动后展示所有未完成任务，已完成任务折叠 |

### 2. AI 功能

| 功能 | 描述 |
|------|------|
| 自动分类 | 添加任务后，AI 自动判断类别（学习/生活/工作/其他） |
| 优先级推荐 | AI 根据任务内容推荐优先级（高/中/低） |
| 触发时机 | 添加任务时自动触发，结果显示在任务卡片上 |

---

## API 接口规格

### 任务接口

```
POST   /api/todos          添加任务
GET    /api/todos          获取所有任务
PATCH  /api/todos/:id      更新任务（完成状态）
DELETE /api/todos/:id      删除任务
```

**POST /api/todos**
- 请求体：`{ "text": "任务内容" }`
- 约束：text 长度 1-200 字，不能为空
- 返回：`{ "ok": true, "id": 1, "category": "学习", "priority": "高" }`

**GET /api/todos**
- 返回：按创建时间倒序排列的任务列表
- 格式：
```json
[
  {
    "id": 1,
    "text": "复习离散数学",
    "done": false,
    "category": "学习",
    "priority": "高",
    "created_at": "2026-04-10 09:00"
  }
]
```

**PATCH /api/todos/:id**
- 请求体：`{ "done": true }`
- 返回：`{ "ok": true }`

**DELETE /api/todos/:id**
- 返回：`{ "ok": true }`

---

## 数据结构

### todos 表（SQLite）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PRIMARY KEY | 自增 |
| text | TEXT NOT NULL | 任务内容 |
| done | BOOLEAN DEFAULT 0 | 是否完成 |
| category | TEXT | AI 分类结果 |
| priority | TEXT | AI 优先级结果 |
| created_at | TIMESTAMP | 创建时间 |

---

## AI 接口规格

调用本地或远程大模型（DeepSeek / 豆包），Prompt 固定格式：

```
你是一个任务管理助手。
给定任务："{text}"
请返回 JSON，格式如下：
{
  "category": "学习|生活|工作|其他",
  "priority": "高|中|低",
  "reason": "一句话说明理由"
}
只返回 JSON，不要其他内容。
```

- 调用失败时：category 默认"其他"，priority 默认"中"
- 超时限制：5 秒

---

## 前端页面规格

### 布局

```
┌─────────────────────────────┐
│  📝 My Todo List            │
├─────────────────────────────┤
│  [输入框................] [添加] │
├─────────────────────────────┤
│  ○ 复习离散数学              │
│    🏷 学习  ⚡ 高            │
│                        [删除] │
│  ○ 买早饭                   │
│    🏷 生活  ⚡ 低            │
│                        [删除] │
├─────────────────────────────┤
│  已完成 (2) ▼               │
└─────────────────────────────┘
```

### 交互细节

- 添加任务后输入框清空
- AI 分析期间显示 loading 状态（"分析中..."）
- 完成任务后移入"已完成"折叠区
- 优先级用颜色区分：高=红，中=橙，低=绿

---

## 开发顺序

```
第一阶段：跑通核心
  models/database.py   建库建表
  models/todo.py       数据 CRUD
  services/todo.py     业务逻辑
  routes/todo.py       API 接口
  frontend/            基础界面对接

第二阶段：加 AI
  services/ai.py       调模型，解析返回
  集成到 POST /api/todos 流程中

第三阶段：polish
  loading 状态
  错误处理
  样式优化
```

---

## 边界条件

- text 为空 → 前端拦截，不发请求
- text 超 200 字 → 后端返回 error，前端提示
- AI 调用失败 → 静默降级，不影响任务添加
- 数据库文件：`backend/data/todos.db`，不上传 git
```
