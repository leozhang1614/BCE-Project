# 飞书配置说明

## 方式一：使用现有飞书机器人（推荐 ⭐）

如果群里已经有飞书机器人，直接使用其 Webhook URL。

### 获取 Webhook URL
1. 在飞书群中 → 右上角设置 → 群机器人
2. 添加机器人 → 选择"自定义机器人"
3. 复制 Webhook 地址（形如：`https://open.feishu.cn/open-apis/bot/v2/hook/xxx`）

### 配置到 BCE
将 Webhook URL 填入下方：

```
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_WEBHOOK_HERE
```

---

## 方式二：创建飞书自建应用（完整功能）

### 步骤 1：登录飞书开放平台
访问：https://open.feishu.cn/

### 步骤 2：创建企业自建应用
1. 点击"创建应用"
2. 选择"企业自建应用"
3. 填写应用名称：BCE 通知助手
4. 选择应用类型：机器人

### 步骤 3：获取凭证
在应用管理页面获取：
- **App ID** (cli_xxx)
- **App Secret** (xxx)

### 步骤 4：配置权限
在"权限管理"中添加：
- 发送消息到单聊或群聊 (`im:message`)
- 读取群组信息 (`im:chat`)

### 步骤 5：配置事件订阅
1. 在"事件订阅"中启用
2. 配置请求地址：`http://192.168.31.187:3000/api/feishu/webhook`
3. 订阅事件：
   - `im.message.receive_v1` (接收消息)

### 步骤 6：发布应用
点击"发布"按钮

---

## 配置文件

创建 `.env` 文件在 BCE-Project 目录：

```bash
# 飞书配置
FEISHU_APP_ID=cli_xxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxx
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxxxxxxx
FEISHU_CHAT_ID=oc_xxxxxxxxxxxxx

# 服务配置
PORT=3000
NODE_ENV=production
```

---

## 测试飞书通知

```bash
# 测试发送消息
curl -X POST http://localhost:3000/api/feishu-notify/notify/task \
  -H "Content-Type: application/json" \
  -d '{
    "chatId":"oc_xxxxxxxxxxxxx",
    "taskId":"test-001",
    "taskTitle":"测试任务",
    "action":"assigned",
    "operator":"天枢",
    "comment":"这是测试通知"
  }'
```

---

## 当前群聊 ID

**当前群：** `oc_19be54b67684b6597ff335d7534896d4`

---

## 联系支持

配置问题联系：匠心 (CTO)
