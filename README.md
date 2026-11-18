# 待办

多人待办。Flask 提供接口，页面是静态 HTML/JS，数据在 PostgreSQL。

登录后可以添加任务、勾选完成，并按全部、今日到期、已完成、逾期筛选。分类可以手选；留在「自动分类」时由服务端判断。优先级用页面上的「高 / 中 / 低」提交。

## 环境

- Python 3.11（`runtime.txt`）
- PostgreSQL。连接固定使用 `sslmode=require`

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串 |
| `JWT_SECRET` | 登录 token 的签名密钥。未设置时用代码里的默认值 |
| `DEEPSEEK_API_KEY` | 可选。为空或调用失败时，按关键词给出分类和优先级 |
| `PORT` | 可选，默认 5000 |

## 运行

```bash
./start.sh
```

`start.sh` 在项目根目录存在 `.env` 时加载它，再用 gunicorn 监听 `0.0.0.0:$PORT`。

本机调试可以先导出上述变量，再执行 `python app.py`（调试模式，端口 5000）。这个入口不读取 `.env`。分类模块导入时会读项目根目录的 `.env`，只用于 `DEEPSEEK_API_KEY`。

打开 `http://127.0.0.1:5000`。页面在 `localhost` 和 `127.0.0.1` 上请求本机 API，其他主机名请求 `https://web-production-f1ba1.up.railway.app`。

## 接口

需要登录的请求带请求头 `Authorization: Bearer <token>`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/register` | `{username, password}`。成功返回 201 和 `{ok, token, username}` |
| POST | `/api/auth/login` | 同上，成功返回 200 |
| GET | `/api/todos/` | 当前用户的任务 |
| POST | `/api/todos/` | `{text, deadline?, category?, priority?}`。成功返回 201 |
| PATCH | `/api/todos/<id>` | 只处理一个字段：`done`、`priority` 或 `deadline` |
| DELETE | `/api/todos/<id>` | 删除 |
| GET | `/api/stats/heatmap` | 自今天起向前 83 天内，每天完成的数量 |

`text` 去掉首尾空白后不能为空，最长 200 字。分类只接受「工作」「学习」「生活」「其他」，优先级只接受「高」「中」「低」。请求里的合法值优先；否则调用 DeepSeek。模型不可用时按关键词匹配，仍匹配不到则为「其他」和「中」。

用户名 2–20 位，只能含字母、数字和下划线，保存前转为小写。密码至少 6 位。Token 有效期 30 天。

列表顺序：未完成在前；有截止日期的在前；截止日期升序；创建时间降序。

页面没有删除、修改截止日期和热力图，这三项只在接口里。

## 目录

```
app.py          入口。托管 frontend/，注册路由
models/         用户、任务、完成统计的 SQL
services/       注册登录、任务校验、分类
routes/         HTTP 接口
frontend/       页面
Procfile        gunicorn app:app
runtime.txt     python-3.11
start.sh        加载 .env 后启动 gunicorn
```

部署时由平台注入 `PORT` 和 `DATABASE_URL`，进程按 `Procfile` 启动。

## 测试

```bash
pytest
```

没有 `DATABASE_URL` 时只跑不连数据库的用例。设置之后会再跑注册、任务和热力图。
