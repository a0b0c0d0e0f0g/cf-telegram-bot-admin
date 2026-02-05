# Cloudflare Pages + SvelteKit Telegram 机器人管理后台（多机器人 / 可共享配置 / 自动Webhook / D1）

## 功能清单（已实现）
- ✅ SvelteKit + Cloudflare Pages（Functions）一体化后台
- ✅ 自建账号密码登录（JWT + HttpOnly Cookie）
- ✅ D1 持久化：管理员、机器人、多配置模板、外部接口 connectors
- ✅ 多机器人：每个机器人绑定一个配置模板（可共享/可独立）
- ✅ 自动 setWebhook：新增机器人时自动绑定
- ✅ Webhook 路由：`/tg/:botId/:secret/webhook`（同时校验 Telegram header secret）
- ✅ Bot Token 加密存储：AES-GCM（密钥放 Cloudflare secret）
- ✅ 配置模板：支持继承（深度 merge；数组由子覆盖）
- ✅ 配置编辑：JSON / 可视化表单双模式（可自由切换）
- ✅ 外部接口 connectors：按模板配置；密钥通过 Cloudflare secrets 引用

---

## 0. 前置条件
- Node.js 18+（建议 20+）
- Cloudflare 账号
- 已创建 Cloudflare Pages 项目（绑定此 repo）
- 已创建 D1 数据库

---

## 1. 安装依赖
```bash
npm i
```

---

## 2. 创建 D1 并执行迁移
创建数据库（示例）：
```bash
wrangler d1 create tg_bot_admin
```

把返回的 `database_id` 填到 `wrangler.toml` 的 `database_id`。

执行迁移：
```bash
wrangler d1 execute tg_bot_admin --file=./migrations/0001_init.sql
```

---

## 3. 设置 Secrets（必须）
### 3.1 JWT_SECRET
```bash
wrangler secret put JWT_SECRET
```

### 3.2 BOOTSTRAP_TOKEN（首次初始化管理员用）
```bash
wrangler secret put BOOTSTRAP_TOKEN
```

### 3.3 BOT_TOKEN_KEY（AES-GCM 加密机器人 token）
需要一个 32-byte key 的 base64 字符串。你可以用 node 生成：
```bash
node -e "console.log(Buffer.from(require('crypto').randomBytes(32)).toString('base64'))"
```

然后：
```bash
wrangler secret put BOT_TOKEN_KEY
```

---

## 4. 首次初始化管理员（只允许一次）
**POST** `/api/bootstrap`，并带 header：`x-bootstrap-token: <你的 BOOTSTRAP_TOKEN>`

Body:
```json
{ "email": "admin@example.com", "password": "yourStrongPassword" }
```

成功后会同时创建一个“默认模板”。

> 初始化完成后再次调用会返回 409。

---

## 5. 使用（管理后台）
- 访问：`/login` 登录
- `Dashboard`：机器人/模板列表
- 新增机器人：自动 setWebhook
- 模板编辑：可视化表单 / JSON 自由切换
- 模板 Connectors：外部接口定义（密钥用 Cloudflare secrets）

---

## 6. Telegram Webhook 路由
Webhook URL 形如：
```
https://YOUR_DOMAIN/tg/<botId>/<secret>/webhook
```

系统还会把同一个 `secret` 设置为 Telegram 的 `secret_token`，Telegram 请求会携带：
`x-telegram-bot-api-secret-token`，我们在 Worker 侧也会校验。

---

## 7. 规则（bot_logic_json）示例
```json
{
  "version": 1,
  "routes": [
    { "type": "command", "match": "/start", "action": { "type": "send_message", "text": "已连接✅" } },
    { "type": "keyword", "match": "查询", "action": { "type": "call_connector", "connectorName": "crmSearch", "outputTemplate": "结果：{{data.result}}" } }
  ]
}
```

模板渲染：支持 `{{text}}`、`{{data.xxx}}`。

---

## 8. 外部接口密钥
例如 connector 配置 `authSecretName = "CRM_API_KEY"`，则需要：
```bash
wrangler secret put CRM_API_KEY
```

---

## 9. 本地开发（可选）
SvelteKit 本地 dev 主要用于 UI 开发：
```bash
npm run dev
```

若要在本地模拟 D1 / Pages Functions，需要用 `wrangler pages dev`（需要你自行按 Cloudflare 文档配置本地 bindings）。

---

## 10. 生产部署（Pages）
- 把此项目推到 Git 仓库
- Cloudflare Pages 选择该 repo
- Build command：`npm run build`
- Output directory：`.svelte-kit/cloudflare`
- 在 Pages 项目里绑定 D1（名称 DB），并配置 secrets（JWT_SECRET/BOOTSTRAP_TOKEN/BOT_TOKEN_KEY）
