# OpenClaw Control Center 完整版任务跟进流程

**版本：** v1.0 正式版  
**日期：** 2026-03-21 08:57  
**设计人：** 匠心 (CTO)  
**核心：** 基于 OCC 原生能力的任务全生命周期管理

---

## 📊 完整流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                      任务全生命周期管理                           │
└─────────────────────────────────────────────────────────────────┘

1️⃣ 任务获取          2️⃣ 任务分发          3️⃣ 任务交互确认
    ↓                    ↓                    ↓
┌──────────┐        ┌──────────┐        ┌──────────┐
│ 天枢创建  │ ────→  │ sessions_ │ ────→  │ 通知中心  │
│ 任务     │        │ send 发送 │        │ 待确认   │
└──────────┘        └──────────┘        └──────────┘
                         ↓                    ↓
                    跨会话消息            协作页面显示
                    Main→匠心              蓝色链接


4️⃣ 任务流转          5️⃣ 任务确认          6️⃣ 看板展示
    ↓                    ↓                    ↓
┌──────────┐        ┌──────────┐        ┌──────────┐
│ 匠心 →   │ ────→  │ 审批队列  │ ────→  │ OCC 任务  │
│ 司库     │        │ 确认完成  │        │ 看板页面  │
└──────────┘        └──────────┘        └──────────┘
     ↓                                       ↓
协作页面显示                              实时状态更新
状态追踪
```

---

## 1️⃣ 任务获取

### 场景
天枢需要创建一个新任务，分配给匠心执行。

### 实现方式

#### 方法 A：通过 OpenClaw 直接创建（推荐）

```javascript
// 天枢的 OpenClaw 会话中
await sessions_send({
  sessionKey: 'agent-jiangxin',
  message: `
📋 新任务分配

【任务 ID】TASK-001
【任务名称】BCE 技术方案设计
【优先级】P0
【截止时间】2026-03-21 18:00
【任务描述】设计 BCE 项目技术架构，输出技术方案文档

请在 OCC 协作页面确认接收。
查看：http://localhost:4310/?section=collaboration&lang=zh
`
});
```

#### 方法 B：通过 OCC API 创建

```bash
# 调用 OCC 任务创建 API
curl -X POST http://localhost:4310/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "BCE 技术方案设计",
    "description": "设计 BCE 项目技术架构",
    "assignee": "jiangxin",
    "priority": "P0",
    "deadline": "2026-03-21T18:00:00.000Z",
    "projectId": "bce-project"
  }'
```

#### 方法 C：通过飞书机器人创建（辅助）

```javascript
// 飞书群内输入：
// /task create BCE 技术方案设计 @匠心 P0

// BCE 系统解析后调用 OCC API
POST /api/tasks
{
  "title": "BCE 技术方案设计",
  "assignee": "匠心",
  "priority": "P0"
}
```

### 数据流

```
天枢 → OpenClaw Gateway → sessions_send → 匠心会话
                              ↓
                        OCC 协作页面
                        （实时显示）
```

---

## 2️⃣ 任务分发

### 核心机制：`sessions_send`

**OCC 使用 OpenClaw 原生的会话间消息传递，不依赖飞书@！**

### 代码实现

```typescript
// OCC: src/runtime/collaboration.ts

interface InterSessionMessage {
  id: string;
  sourceSessionKey: string;    // 发送方会话（如：agent-tianshu）
  targetSessionKey: string;    // 接收方会话（如：agent-jiangxin）
  sourceTool: string;          // 工具名称（sessions_send）
  timestamp: string;
  content: string;             // 消息内容
  taskId?: string;             // 关联任务 ID
  taskTitle?: string;          // 任务标题
  priority?: string;           // 优先级
}

// 提取跨会话消息
async function getInterSessionMessages(): Promise<InterSessionMessage[]> {
  const sessions = await adapter.getSessions();
  
  const messages = sessions.flatMap(session => 
    session.messages
      .filter(m => m.tool === 'sessions_send')
      .map(m => ({
        id: m.id,
        sourceSessionKey: m.sessionKey,
        targetSessionKey: m.targetSessionKey,
        sourceTool: 'sessions_send',
        timestamp: m.timestamp,
        content: m.content,
        taskId: extractTaskId(m.content),
        taskTitle: extractTaskTitle(m.content),
        priority: extractPriority(m.content)
      }))
  );
  
  return messages;
}
```

### 协作页面展示

**URL:** `http://localhost:4310/?section=collaboration&lang=zh`

**显示内容：**
```
┌─────────────────────────────────────────────────────────┐
│  协作页面 - 跨会话通信                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Main ⇄ 匠心                                            │
│  ─────────────────                                     │
│  📋 新任务分配：BCE 技术方案设计                          │
│  发送时间：2026-03-21 08:57                             │
│  状态：⏳ 待确认                                         │
│  [确认接收] [查看详情]                                   │
│                                                         │
│  匠心 ⇄ 司库                                            │
│  ─────────────────                                     │
│  💰 财务数据支持请求                                     │
│  发送时间：2026-03-21 09:00                             │
│  状态：✅ 已确认                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 3️⃣ 任务交互确认

### 通知中心（Notification Center）

**OCC 自动将新任务添加到待确认队列**

#### 数据结构

```typescript
// runtime/acks.json
{
  "acks": [
    {
      "itemId": "task:TASK-001:assigned",
      "taskId": "TASK-001",
      "taskTitle": "BCE 技术方案设计",
      "type": "task_assignment",
      "level": "action-required",
      "assignee": "jiangxin",
      "createdAt": "2026-03-21T08:57:00.000Z",
      "status": "pending",  // pending / acknowledged / completed
      "acknowledgedAt": null,
      "acknowledgedBy": null,
      "note": null
    }
  ],
  "updatedAt": "2026-03-21T08:57:00.000Z"
}
```

#### API 接口

```bash
# 获取待确认列表
GET /api/action-queue

# 确认收到任务
POST /api/action-queue/task:TASK-001:assigned/ack
{
  "note": "收到，立即开始处理"
}

# 查看任务详情
GET /api/tasks/TASK-001
```

### 匠心确认任务

**方式 1：OCC 协作页面**
1. 打开 `http://localhost:4310/?section=collaboration`
2. 看到待确认任务
3. 点击 [确认接收] 按钮
4. 填写备注（可选）
5. 提交

**方式 2：飞书回复（辅助）**
```
匠心在飞书群回复：
"收到，TASK-001 已确认"

→ BCE 系统解析后调用 OCC API 确认
```

**方式 3：OpenClaw 直接回复**
```javascript
// 匠心的 OpenClaw 会话
sessions_send({
  sessionKey: 'agent-tianshu',
  message: 'TASK-001 已确认接收，预计 2 小时后完成'
});
```

---

## 4️⃣ 任务在不同 Agent 之间的流转

### 流转场景

匠心在执行任务过程中，需要司库提供财务数据支持。

### 流转实现

#### 步骤 1：匠心发起协作请求

```javascript
// 匠心的 OpenClaw 会话
await sessions_send({
  sessionKey: 'agent-siku',
  message: `
💼 协作请求

【任务 ID】TASK-001
【协作内容】提供 BCE 项目预算数据
【需要数据】
  - 阿里云 API 预算额度
  - 当前月度花费
  - 剩余可用预算
【截止时间】今天 12:00 前

请在 OCC 协作页面确认。
`
});
```

#### 步骤 2：OCC 记录流转关系

```typescript
// OCC 自动记录任务流转
{
  "taskId": "TASK-001",
  "flowHistory": [
    {
      "from": "tianshu",
      "to": "jiangxin",
      "action": "assign",
      "timestamp": "2026-03-21T08:57:00.000Z",
      "status": "confirmed"
    },
    {
      "from": "jiangxin",
      "to": "siku",
      "action": "collaborate",
      "timestamp": "2026-03-21T09:30:00.000Z",
      "status": "pending"
    }
  ]
}
```

#### 步骤 3：协作页面显示流转

```
┌─────────────────────────────────────────────────────────┐
│  任务流转追踪 - TASK-001                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  天枢 ──────→ 匠心 ──────→ 司库                         │
│  08:57       09:30       ⏳待确认                        │
│  ✅已确认    🔄进行中                                     │
│                                                         │
│  当前状态：等待司库提供财务数据                           │
│  阻塞时间：30 分钟                                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 步骤 4：司库确认并提供数据

```javascript
// 司库的 OpenClaw 会话
await sessions_send({
  sessionKey: 'agent-jiangxin',
  message: `
✅ 财务数据已提供

【阿里云 API 预算】
  - 月度预算：$500
  - 当前花费：$320
  - 剩余可用：$180
  
【建议】
  - 控制 qwen3.5-plus 调用频率
  - 考虑使用 deepseek 替代部分场景

详细数据已上传到共享文档。
`
});

// 同时在 OCC 确认协作请求
POST /api/action-queue/collab:TASK-001:siku/ack
{
  "note": "财务数据已提供"
}
```

---

## 5️⃣ 任务的最终确认

### 任务完成流程

#### 步骤 1：匠心完成任务

```javascript
// 匠心的 OpenClaw 会话
await sessions_send({
  sessionKey: 'agent-tianshu',
  message: `
✅ 任务完成 - TASK-001

【任务名称】BCE 技术方案设计
【交付物】
  1. 技术架构文档.md
  2. API 设计文档.md
  3. 部署方案.md
【完成时间】2026-03-21 15:30
【实际耗时】6.5 小时

请验收。
`
});
```

#### 步骤 2：OCC 更新任务状态

```bash
# 更新任务状态为待验收
PUT /api/tasks/TASK-001/status
{
  "status": "reviewing",
  "deliverables": [
    "技术架构文档.md",
    "API 设计文档.md",
    "部署方案.md"
  ]
}
```

#### 步骤 3：天枢验收

**OCC 通知天枢：**
```
┌─────────────────────────────────────────────────────────┐
│  待验收任务 - TASK-001                                   │
├─────────────────────────────────────────────────────────┤
│  任务：BCE 技术方案设计                                   │
│  负责人：匠心                                            │
│  提交时间：2026-03-21 15:30                             │
│  交付物：3 个文档                                        │
│                                                         │
│  [查看文档] [验收通过] [驳回修改]                         │
└─────────────────────────────────────────────────────────┘
```

**天枢验收操作：**
```bash
# 验收通过
POST /api/tasks/TASK-001/accept
{
  "acceptor": "tianshu",
  "comment": "验收通过，方案完善"
}
```

#### 步骤 4：任务归档

```bash
# 更新状态为已完成
PUT /api/tasks/TASK-001/status
{
  "status": "completed",
  "completedAt": "2026-03-21 16:00:00.000Z"
}
```

---

## 6️⃣ 看板页面展示

### OCC 任务看板

**URL:** `http://localhost:4310/?section=tasks&lang=zh`

### 看板布局

```
┌─────────────────────────────────────────────────────────────────┐
│  任务看板 - BCE 项目                                              │
├──────────┬──────────┬──────────┬──────────┬──────────┐
│  待开始   │  进行中   │  待验收   │  已完成   │  已取消   │
├──────────┼──────────┼──────────┼──────────┼──────────┤
│          │ TASK-001 │          │ TASK-000 │          │
│ TASK-002 │ 匠心     │          │ 天枢     │ TASK-003 │
│ 灵犀     │ BCE 技术 │          │ 知识库   │ 已取消   │
│ 前端设计  │ 方案设计  │          │ 初始化   │          │
│ P1       │ P0       │          │ ✅       │          │
│          │ 🟢       │          │          │          │
├──────────┼──────────┼──────────┼──────────┼──────────┤
│ TASK-004 │ TASK-005 │          │          │          │
│ 司库     │ 执矩     │          │          │          │
│ 财务数据  │ 安全审核  │          │          │          │
│ P2       │ P1       │          │          │          │
│ 🟡       │ 🟢       │          │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

### 任务卡片详情

**点击 TASK-001 查看：**

```
┌─────────────────────────────────────────────────────────┐
│  TASK-001: BCE 技术方案设计                               │
├─────────────────────────────────────────────────────────┤
│  状态：🟢 进行中                                          │
│  优先级：P0                                              │
│  负责人：匠心                                            │
│  创建人：天枢                                            │
│  创建时间：2026-03-21 08:57                             │
│  截止时间：2026-03-21 18:00                             │
├─────────────────────────────────────────────────────────┤
│  任务描述：                                              │
│  设计 BCE 项目技术架构，输出技术方案文档                    │
├─────────────────────────────────────────────────────────┤
│  流转历史：                                              │
│  ─────────────────                                      │
│  08:57 天枢 → 匠心（任务分配）✅                         │
│  09:00 匠心确认接收 ✅                                   │
│  09:30 匠心 → 司库（协作请求）✅                         │
│  10:00 司库提供财务数据 ✅                               │
│  15:30 匠心提交验收 ⏳                                   │
├─────────────────────────────────────────────────────────┤
│  交付物：                                                │
│  - 技术架构文档.md                                       │
│  - API 设计文档.md                                       │
│  - 部署方案.md                                           │
├─────────────────────────────────────────────────────────┤
│  协作会话：[查看协作页面]                                │
│  相关文档：[查看文档库]                                  │
└─────────────────────────────────────────────────────────┘
```

### 实时状态更新

**OCC 通过轮询 Gateway 实时更新：**

```typescript
// 每 30 秒刷新一次任务状态
setInterval(async () => {
  const tasks = await fetchTasks();
  updateTaskBoard(tasks);
}, 30000);

// 监听 Gateway 事件
gateway.on('task:updated', (task) => {
  updateTaskCard(task);
});

gateway.on('session:message', (message) => {
  if (message.tool === 'sessions_send') {
    updateCollaborationPage(message);
  }
});
```

---

## 📋 完整数据模型

### 任务数据结构

```typescript
interface Task {
  id: string;                    // TASK-001
  title: string;                 // BCE 技术方案设计
  description: string;           // 任务描述
  projectId: string;             // bce-project
  assignee: string;              // jiangxin
  creator: string;               // tianshu
  priority: 'P0' | 'P1' | 'P2';  // 优先级
  status: TaskStatus;            // 任务状态
  deadline: string;              // 截止时间
  createdAt: string;             // 创建时间
  updatedAt: string;             // 更新时间
  completedAt?: string;          // 完成时间
  deliverables: string[];        // 交付物列表
  flowHistory: FlowRecord[];     // 流转历史
  sessionKeys: string[];         // 关联会话
  metadata: {
    estimatedHours?: number;     // 预估工时
    actualHours?: number;        // 实际工时
    tags?: string[];             // 标签
  };
}

type TaskStatus = 
  | 'pending'      // 待开始
  | 'in_progress'  // 进行中
  | 'reviewing'    // 待验收
  | 'completed'    // 已完成
  | 'cancelled';   // 已取消

interface FlowRecord {
  from: string;              // 天枢
  to: string;                // 匠心
  action: FlowAction;        // 操作类型
  timestamp: string;         // 时间戳
  status: 'pending' | 'confirmed' | 'completed';
  note?: string;             // 备注
}

type FlowAction = 
  | 'assign'         // 任务分配
  | 'confirm'        // 确认接收
  | 'collaborate'    // 协作请求
  | 'submit'         // 提交验收
  | 'accept'         // 验收通过
  | 'reject';        // 驳回
```

---

## 🚀 实施步骤

### 第一阶段：部署 OCC（今天，30 分钟）

```bash
# 1. 进入项目目录
cd /Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库/openclaw-control-center

# 2. 安装依赖
npm install

# 3. 配置环境
cp .env.example .env
# 编辑 .env，确保 GATEWAY_URL=ws://127.0.0.1:18789

# 4. 构建项目
npm run build

# 5. 启动 UI 服务
npm run dev:ui

# 6. 访问协作页面
# http://localhost:4310/?section=collaboration&lang=zh
# http://localhost:4310/?section=tasks&lang=zh
```

### 第二阶段：配置任务集成（明天，1 小时）

1. 配置 OpenClaw 使用 `sessions_send`
2. 测试任务创建和分发
3. 验证协作页面显示
4. 测试任务确认流程

### 第三阶段：团队培训（后天，1 小时）

1. 培训团队成员使用 OCC
2. 建立任务查看习惯
3. 制定使用规范

---

## ✅ 成功标准

| 环节 | 验证方式 | 成功标准 |
|------|---------|---------|
| 任务获取 | 创建测试任务 | 任务成功创建 |
| 任务分发 | 查看协作页面 | 跨会话消息显示 |
| 任务确认 | 匠心确认任务 | 通知中心状态更新 |
| 任务流转 | 匠心→司库协作 | 流转历史正确记录 |
| 任务验收 | 天枢验收任务 | 状态变更为已完成 |
| 看板展示 | 查看任务看板 | 所有任务正确显示 |

---

**磊哥，这就是基于 OCC 原生能力的完整版任务跟进流程！**

**核心优势：**
1. ✅ 不依赖飞书@，使用 OpenClaw 原生 `sessions_send`
2. ✅ 完整的任务生命周期管理
3. ✅ 实时协作页面展示流转关系
4. ✅ 通知中心集中管理待确认事项
5. ✅ 专业看板页面可视化任务状态

**等您确认，我立即开始部署 OCC！** 🚀
