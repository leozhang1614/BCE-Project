# BCE 项目功能说明书

**项目名称：** 北斗协同引擎 (Beidou Collaboration Engine - BCE)  
**版本：** 1.0.0  
**创建日期：** 2026-03-20  
**技术负责人：** 匠心 (CTO)  
**项目地址：** `/Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库/BCE-Project`

---

## 📋 目录

1. [项目概述](#1-项目概述)
2. [系统架构](#2-系统架构)
3. [功能模块详解](#3-功能模块详解)
4. [API 接口文档](#4-api-接口文档)
5. [数据库设计](#5-数据库设计)
6. [技术实现细节](#6-技术实现细节)
7. [部署指南](#7-部署指南)
8. [使用手册](#8-使用手册)
9. [故障排查](#9-故障排查)
10. [版本历史](#10-版本历史)

---

## 1. 项目概述

### 1.1 项目背景

BCE 项目是为北斗团队设计的任务协同管理系统，实现任务在团队成员间的无缝流转，支持任务创建、分配、执行、验收的完整生命周期管理。

### 1.2 核心目标

- **任务无缝流转**：创建→分配→执行→验收
- **执行环节拆分**：支持子任务分解
- **任务间交互**：评论、附件、状态同步
- **数据实时同步**：与 Control Center 数据一致
- **飞书通知集成**：任务状态变更自动通知

### 1.3 用户角色

| 角色 | 人员 | 职责 |
|------|------|------|
| 任务创建人 | 天枢/磊哥 | 创建任务、分配任务、验收任务 |
| 任务执行人 | 匠心/司库/执矩/磐石/灵犀 | 执行任务、提交验收 |
| 系统管理员 | 匠心 | 系统维护、配置管理 |

### 1.4 访问地址

| 系统 | 地址 | 用途 |
|------|------|------|
| BCE 任务管理 | `http://192.168.31.187:3000/bce-tasks.html` | 主要工作台 |
| Agent 消息 | `http://192.168.31.187:3000/agent-messages.html` | 内部通信 |
| 任务看板 | `http://192.168.31.187:3000/board.html` | 可视化看板 |
| Control Center | `http://192.168.31.187:4310` | 系统监控 |

---

## 2. 系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                      前端展示层                           │
├─────────────────┬─────────────────┬─────────────────────┤
│ bce-tasks.html  │ agent-messages  │ board.html          │
│ 任务管理页面     │ Agent 消息页面    │ 任务看板页面         │
└─────────────────┴─────────────────┴─────────────────────┘
                          ↓ HTTP/REST API
┌─────────────────────────────────────────────────────────┐
│                      后端服务层                           │
├───────────┬───────────┬───────────┬───────────┬─────────┤
│ BCE Tasks │ Agent Msg │ Broadcast │ Feishu    │ Sync    │
│ 任务 API   │ 消息 API   │ 广播 API   │ 通知 API   │ 同步 API │
└───────────┴───────────┴───────────┴───────────┴─────────┘
                          ↓ 数据读写
┌─────────────────────────────────────────────────────────┐
│                      数据存储层                           │
├─────────────────────────────────────────────────────────┤
│ 内存存储 (Map) - 任务/消息/评论数据                       │
│ 文件系统 - Control Center tasks.json 同步                │
└─────────────────────────────────────────────────────────┘
```

### 2.2 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 后端 | Node.js | v25.8.0 |
| 框架 | Express.js | 最新 |
| 前端 | 原生 HTML/CSS/JS | - |
| 通信 | HTTP/REST API | - |
| 数据存储 | 内存 Map + JSON 文件 | - |

### 2.3 项目结构

```
BCE-Project/
├── src/
│   ├── index.js              # 主入口
│   └── api/
│       ├── bce-tasks.js      # 任务管理 API
│       ├── agent-message.js  # Agent 消息 API
│       ├── broadcast.js      # 广播 API
│       ├── feishu-notify.js  # 飞书通知 API
│       ├── sync.js           # 数据同步 API
│       └── ...
├── public/
│   ├── bce-tasks.html        # 任务管理页面
│   ├── agent-messages.html   # Agent 消息页面
│   └── board.html            # 任务看板页面
├── scripts/
│   ├── sync-to-cc.js         # Control Center 同步脚本
│   └── get-chat-id.js        # 飞书群 ID 获取脚本
├── .env                      # 环境配置
├── package.json              # 项目配置
└── README.md                 # 项目说明
```

---

## 3. 功能模块详解

### 3.1 任务管理模块

#### 3.1.1 任务状态机

```
创建 (pending) → 分配 (assigned) → 执行 (executing) → 验收 (reviewing) → 完成 (accepted)
                                      ↓
                                   取消 (cancelled)
```

**状态说明：**

| 状态 | 英文 | 说明 | 可转移状态 |
|------|------|------|-----------|
| 待分配 | pending | 任务已创建，等待分配 | assigned, cancelled |
| 已分配 | assigned | 任务已分配，等待执行 | executing, pending, cancelled |
| 执行中 | executing | 任务正在执行 | reviewing, assigned, cancelled |
| 待验收 | reviewing | 任务执行完成，等待验收 | accepted, executing |
| 已完成 | accepted | 任务验收通过 | - |
| 已取消 | cancelled | 任务已取消 | - |

#### 3.1.2 任务创建

**功能描述：** 创建新任务，设置任务基本信息

**输入参数：**
- `title` (必填): 任务标题
- `description` (可选): 任务描述
- `creator` (必填): 创建人
- `assignee` (可选): 负责人
- `priority` (可选): 优先级 (P0/P1/P2)
- `dueDate` (可选): 截止日期
- `projectId` (可选): 项目 ID

**输出：**
- `taskId`: 任务 ID
- `task`: 任务对象

**技术实现：**
```javascript
// POST /api/bce/tasks
router.post('/tasks', (req, res) => {
  const { title, description, creator, assignee, priority = 'P2', dueDate, projectId } = req.body;
  
  const taskId = uuidv4();
  const task = {
    id: taskId,
    title,
    description: description || '',
    creator,
    assignee: assignee || null,
    priority,
    status: 'pending',
    dueDate: dueDate || null,
    projectId: projectId || null,
    subTasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stateHistory: [{
      from: null,
      to: 'pending',
      operator: creator,
      timestamp: new Date().toISOString(),
      comment: '任务创建'
    }]
  };
  
  tasks.set(taskId, task);
  res.status(201).json({ success: true, taskId, message: '任务创建成功', data: task });
});
```

#### 3.1.3 任务分配

**功能描述：** 将任务分配给指定负责人

**输入参数：**
- `assignee` (必填): 负责人姓名
- `operator` (可选): 操作人
- `comment` (可选): 分配备注

**技术实现：**
```javascript
// POST /api/bce/tasks/:id/assign
router.post('/tasks/:id/assign', (req, res) => {
  const { id } = req.params;
  const { assignee, comment } = req.body;
  
  const task = tasks.get(id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  
  if (!canTransition(task.status, 'assigned')) {
    return res.status(400).json({ error: `当前状态 ${task.status} 不能转移到 assigned` });
  }
  
  const oldStatus = task.status;
  task.status = 'assigned';
  task.assignee = assignee;
  task.updatedAt = new Date().toISOString();
  task.stateHistory.push({
    from: oldStatus,
    to: 'assigned',
    operator: req.body.operator || 'system',
    timestamp: new Date().toISOString(),
    comment: comment || '任务已分配'
  });
  
  // 自动发送飞书通知
  sendFeishuNotification(id, task, 'assigned', req.body.operator || 'system', '任务已分配给您');
  
  res.json({ success: true, message: '任务分配成功', data: task });
});
```

#### 3.1.4 任务执行

**功能描述：** 开始执行任务

**输入参数：**
- `operator` (可选): 操作人
- `comment` (可选): 执行备注

**技术实现：**
```javascript
// POST /api/bce/tasks/:id/start
router.post('/tasks/:id/start', (req, res) => {
  const { id } = req.params;
  const { operator, comment } = req.body;
  
  const task = tasks.get(id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  
  if (!canTransition(task.status, 'executing')) {
    return res.status(400).json({ error: `当前状态 ${task.status} 不能转移到 executing` });
  }
  
  const oldStatus = task.status;
  task.status = 'executing';
  task.updatedAt = new Date().toISOString();
  task.stateHistory.push({
    from: oldStatus,
    to: 'executing',
    operator: operator || task.assignee,
    timestamp: new Date().toISOString(),
    comment: comment || '开始执行任务'
  });
  
  // 自动发送飞书通知
  sendFeishuNotification(id, task, 'executing', operator || task.assignee, '任务已开始执行');
  
  res.json({ success: true, message: '任务已开始执行', data: task });
});
```

#### 3.1.5 任务验收

**功能描述：** 提交验收和验收通过

**提交验收输入参数：**
- `operator` (可选): 操作人
- `deliverables` (可选): 交付物列表
- `comment` (可选): 验收备注

**验收通过输入参数：**
- `acceptor` (必填): 验收人
- `comment` (可选): 验收意见

**技术实现：**
```javascript
// POST /api/bce/tasks/:id/submit
router.post('/tasks/:id/submit', (req, res) => {
  const { id } = req.params;
  const { operator, deliverables, comment } = req.body;
  
  const task = tasks.get(id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  
  if (!canTransition(task.status, 'reviewing')) {
    return res.status(400).json({ error: `当前状态 ${task.status} 不能转移到 reviewing` });
  }
  
  const oldStatus = task.status;
  task.status = 'reviewing';
  task.deliverables = deliverables || [];
  task.updatedAt = new Date().toISOString();
  task.stateHistory.push({
    from: oldStatus,
    to: 'reviewing',
    operator: operator || task.assignee,
    timestamp: new Date().toISOString(),
    comment: comment || '提交验收'
  });
  
  // 自动发送飞书通知
  sendFeishuNotification(id, task, 'reviewing', operator || task.assignee, '已提交验收，请审核');
  
  res.json({ success: true, message: '已提交验收', data: task });
});

// POST /api/bce/tasks/:id/accept
router.post('/tasks/:id/accept', (req, res) => {
  const { id } = req.params;
  const { acceptor, comment } = req.body;
  
  if (!acceptor) return res.status(400).json({ error: 'acceptor 不能为空' });
  
  const task = tasks.get(id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  
  if (!canTransition(task.status, 'accepted')) {
    return res.status(400).json({ error: `当前状态 ${task.status} 不能转移到 accepted` });
  }
  
  const oldStatus = task.status;
  task.status = 'accepted';
  task.acceptor = acceptor;
  task.acceptedAt = new Date().toISOString();
  task.updatedAt = new Date().toISOString();
  task.stateHistory.push({
    from: oldStatus,
    to: 'accepted',
    operator: acceptor,
    timestamp: new Date().toISOString(),
    comment: comment || '验收通过'
  });
  
  // 自动发送飞书通知
  sendFeishuNotification(id, task, 'accepted', acceptor, comment || '验收通过');
  
  res.json({ success: true, message: '任务验收通过', data: task });
});
```

### 3.2 子任务拆分模块

#### 3.2.1 创建子任务

**功能描述：** 将任务拆分为多个子任务

**输入参数：**
- `title` (必填): 子任务标题
- `description` (可选): 子任务描述
- `assignee` (可选): 子任务负责人

**技术实现：**
```javascript
// POST /api/bce/tasks/:id/subtasks
router.post('/tasks/:id/subtasks', (req, res) => {
  const { id } = req.params;
  const { title, description, assignee } = req.body;
  
  if (!title) return res.status(400).json({ error: 'title 不能为空' });
  
  const parentTask = tasks.get(id);
  if (!parentTask) return res.status(404).json({ error: '父任务不存在' });
  
  const subTaskId = uuidv4();
  const subTask = {
    id: subTaskId,
    parentTaskId: id,
    title,
    description: description || '',
    assignee: assignee || null,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  subTasks.set(subTaskId, subTask);
  parentTask.subTasks.push(subTaskId);
  
  res.status(201).json({ success: true, subTaskId, message: '子任务创建成功', data: subTask });
});
```

### 3.3 评论系统模块

#### 3.3.1 添加评论

**功能描述：** 为任务添加评论，支持回复评论

**输入参数：**
- `author` (必填): 评论作者
- `content` (必填): 评论内容
- `parentId` (可选): 父评论 ID（用于回复）

**技术实现：**
```javascript
// POST /api/bce/tasks/:id/comments
router.post('/tasks/:id/comments', (req, res) => {
  const { id } = req.params;
  const { author, content, parentId } = req.body;
  
  if (!author || !content) {
    return res.status(400).json({ error: 'author 和 content 不能为空' });
  }
  
  const task = tasks.get(id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  
  const commentId = uuidv4();
  const comment = {
    id: commentId,
    taskId: id,
    author,
    content,
    parentId: parentId || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  comments.set(commentId, comment);
  
  res.status(201).json({ success: true, commentId, message: '评论添加成功', data: comment });
});
```

#### 3.3.2 获取评论列表

**功能描述：** 获取任务的所有评论

**技术实现：**
```javascript
// GET /api/bce/tasks/:id/comments
router.get('/tasks/:id/comments', (req, res) => {
  const { id } = req.params;
  
  const taskComments = Array.from(comments.values())
    .filter(c => c.taskId === id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  
  res.json({ success: true, count: taskComments.length, data: taskComments });
});
```

### 3.4 Agent 消息模块

#### 3.4.1 Agent 上线/下线

**功能描述：** Agent 上线/下线状态管理

**技术实现：**
```javascript
// POST /api/agent-message/online
router.post('/online', (req, res) => {
  const { agentId } = req.body;
  
  const status = agentStatus.get(agentId) || {
    id: agentId,
    online: false,
    lastSeenAt: null,
    unreadCount: 0
  };
  
  status.online = true;
  status.lastSeenAt = new Date().toISOString();
  agentStatus.set(agentId, status);
  
  res.json({ success: true, message: `${agentId} 已上线`, data: status });
});
```

#### 3.4.2 发送 Agent 消息

**功能描述：** Agent 之间发送消息

**输入参数：**
- `from` (必填): 发送者
- `to` (必填): 接收者（直接消息）或 `all`（广播）
- `content` (必填): 消息内容
- `type` (可选): `direct` 或 `broadcast`
- `requireReply` (可选): 是否需要回复

**技术实现：**
```javascript
// POST /api/agent-message/message
router.post('/message', (req, res) => {
  const { from, to, content, type = 'direct', requireReply = false } = req.body;
  
  if (!from || !content) {
    return res.status(400).json({ error: 'from 和 content 不能为空' });
  }
  
  const messageId = uuidv4();
  const message = {
    id: messageId,
    from,
    to: type === 'broadcast' ? ['all'] : (Array.isArray(to) ? to : [to]),
    content,
    type,
    requireReply,
    status: 'sent',
    createdAt: new Date().toISOString(),
    readAt: null,
    repliedAt: null
  };
  
  agentMessages.set(messageId, message);
  
  // 更新接收者的未读计数
  const recipients = type === 'broadcast' ? agents : (Array.isArray(to) ? to : [to]);
  recipients.forEach(agent => {
    if (agent !== from) {
      const status = agentStatus.get(agent);
      if (status) {
        status.unreadCount = (status.unreadCount || 0) + 1;
        agentStatus.set(agent, status);
      }
    }
  });
  
  res.status(201).json({ success: true, messageId, message: '消息已发送', data: message });
});
```

### 3.5 数据同步模块

#### 3.5.1 同步到 Control Center

**功能描述：** 定时将 BCE 任务数据同步到 Control Center

**技术实现：**
```javascript
// scripts/sync-to-cc.js
const SYNC_INTERVAL_MS = 30000; // 30 秒

async function sync() {
  const bceTasks = await fetchBceTasks();
  const ccTasks = convertToCcFormat(bceTasks);
  writeCcTasks(ccTasks);
}

function convertToCcFormat(bceTasks) {
  const statusMap = {
    'pending': 'todo',
    'assigned': 'todo',
    'executing': 'in_progress',
    'reviewing': 'done',
    'accepted': 'done',
    'cancelled': 'done'
  };
  
  return bceTasks.map(task => ({
    id: task.id,
    taskId: task.id,
    projectId: task.projectId || 'bce-default',
    title: task.title,
    status: statusMap[task.status] || 'todo',
    owner: task.assignee || task.creator,
    dueAt: task.dueDate,
    definitionOfDone: task.deliverables || [],
    bceStatus: task.status,
    bceCreator: task.creator,
    bcePriority: task.priority
  }));
}

setInterval(sync, SYNC_INTERVAL_MS);
```

---

## 4. API 接口文档

### 4.1 任务管理 API

| 接口 | 方法 | 说明 | 输入参数 |
|------|------|------|---------|
| `/api/bce/tasks` | POST | 创建任务 | title, description, creator, assignee, priority, dueDate, projectId |
| `/api/bce/tasks` | GET | 获取任务列表 | status, assignee, projectId, creator (query) |
| `/api/bce/tasks/:id` | GET | 获取任务详情 | - |
| `/api/bce/tasks/:id/assign` | POST | 分配任务 | assignee, operator, comment |
| `/api/bce/tasks/:id/start` | POST | 开始执行 | operator, comment |
| `/api/bce/tasks/:id/submit` | POST | 提交验收 | operator, deliverables, comment |
| `/api/bce/tasks/:id/accept` | POST | 验收通过 | acceptor, comment |
| `/api/bce/tasks/:id/cancel` | POST | 取消任务 | operator, reason |
| `/api/bce/tasks/stats` | GET | 任务统计 | - |

### 4.2 子任务 API

| 接口 | 方法 | 说明 | 输入参数 |
|------|------|------|---------|
| `/api/bce/tasks/:id/subtasks` | POST | 创建子任务 | title, description, assignee |

### 4.3 评论 API

| 接口 | 方法 | 说明 | 输入参数 |
|------|------|------|---------|
| `/api/bce/tasks/:id/comments` | POST | 添加评论 | author, content, parentId |
| `/api/bce/tasks/:id/comments` | GET | 获取评论列表 | - |

### 4.4 Agent 消息 API

| 接口 | 方法 | 说明 | 输入参数 |
|------|------|------|---------|
| `/api/agent-message/online` | POST | Agent 上线 | agentId |
| `/api/agent-message/offline` | POST | Agent 下线 | agentId |
| `/api/agent-message/message` | POST | 发送消息 | from, to, content, type, requireReply |
| `/api/agent-message/message/my` | GET | 获取我的消息 | agentId, status, limit (query) |
| `/api/agent-message/message/:id/read` | POST | 标记已读 | agentId |
| `/api/agent-message/message/:id/reply` | POST | 回复消息 | from, content |
| `/api/agent-message/status` | GET | 获取所有 Agent 状态 | - |
| `/api/agent-message/status/:id` | GET | 获取单个 Agent 状态 | - |

### 4.5 数据同步 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/sync/tasks` | GET | 获取 BCE 任务列表（同步 Control Center） |
| `/api/sync/tasks/:id` | GET | 获取 BCE 任务详情 |
| `/api/sync/tasks/stats` | GET | 获取 BCE 任务统计 |
| `/api/sync/health` | GET | 健康检查 |

---

## 5. 数据库设计

### 5.1 数据存储结构

**使用内存 Map 存储，重启后数据丢失（生产环境应使用数据库）**

#### 5.1.1 任务对象 (Task)

```javascript
{
  id: string,              // 任务 ID (UUID)
  title: string,           // 任务标题
  description: string,     // 任务描述
  creator: string,         // 创建人
  assignee: string|null,   // 负责人
  priority: string,        // 优先级 (P0/P1/P2)
  status: string,          // 状态 (pending/assigned/executing/reviewing/accepted/cancelled)
  dueDate: string|null,    // 截止日期
  projectId: string|null,  // 项目 ID
  subTasks: string[],      // 子任务 ID 列表
  deliverables: string[],  // 交付物列表
  acceptor: string|null,   // 验收人
  acceptedAt: string|null, // 验收时间
  createdAt: string,       // 创建时间
  updatedAt: string,       // 更新时间
  stateHistory: [{         // 状态历史
    from: string|null,
    to: string,
    operator: string,
    timestamp: string,
    comment: string
  }]
}
```

#### 5.1.2 子任务对象 (SubTask)

```javascript
{
  id: string,              // 子任务 ID (UUID)
  parentTaskId: string,    // 父任务 ID
  title: string,           // 子任务标题
  description: string,     // 子任务描述
  assignee: string|null,   // 负责人
  status: string,          // 状态
  createdAt: string,       // 创建时间
  updatedAt: string        // 更新时间
}
```

#### 5.1.3 评论对象 (Comment)

```javascript
{
  id: string,              // 评论 ID (UUID)
  taskId: string,          // 任务 ID
  author: string,          // 评论作者
  content: string,         // 评论内容
  parentId: string|null,   // 父评论 ID（用于回复）
  createdAt: string,       // 创建时间
  updatedAt: string        // 更新时间
}
```

#### 5.1.4 Agent 消息对象 (AgentMessage)

```javascript
{
  id: string,              // 消息 ID (UUID)
  from: string,            // 发送者
  to: string[],            // 接收者列表
  content: string,         // 消息内容
  type: string,            // 类型 (direct/broadcast)
  requireReply: boolean,   // 是否需要回复
  status: string,          // 状态 (sent/read/replied)
  createdAt: string,       // 创建时间
  readAt: string|null,     // 已读时间
  repliedAt: string|null   // 已回复时间
}
```

---

## 6. 技术实现细节

### 6.1 状态转移验证

```javascript
const STATE_TRANSITIONS = {
  'pending': ['assigned', 'cancelled'],
  'assigned': ['executing', 'pending', 'cancelled'],
  'executing': ['reviewing', 'assigned', 'cancelled'],
  'reviewing': ['accepted', 'executing'],
  'accepted': [],
  'cancelled': []
};

function canTransition(from, to) {
  const allowedTransitions = STATE_TRANSITIONS[from];
  return allowedTransitions && allowedTransitions.includes(to);
}
```

### 6.2 飞书通知实现

```javascript
async function sendFeishuNotification(taskId, task, action, operator, comment) {
  const notifyData = {
    chatId: 'oc_19be54b67684b6597ff335d7534896d4',
    taskId,
    taskTitle: task.title,
    action,
    operator,
    comment
  };
  
  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/feishu-notify/notify/task',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  
  req.write(JSON.stringify(notifyData));
  req.end();
}
```

### 6.3 Control Center 同步

```javascript
// 状态映射
const statusMap = {
  'pending': 'todo',
  'assigned': 'todo',
  'executing': 'in_progress',
  'reviewing': 'done',
  'accepted': 'done',
  'cancelled': 'done'
};

// 定时同步
setInterval(async () => {
  const bceTasks = await fetchBceTasks();
  const ccTasks = bceTasks.map(task => ({
    ...task,
    status: statusMap[task.status]
  }));
  writeCcTasks(ccTasks);
}, 30000); // 30 秒
```

---

## 7. 部署指南

### 7.1 环境要求

- Node.js v25.8.0+
- npm 或 yarn
- 飞书开放平台应用（可选，用于通知）

### 7.2 安装步骤

```bash
# 1. 克隆项目
cd /Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库/BCE-Project

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填写飞书配置

# 4. 启动服务
npm start

# 5. 验证服务
curl http://localhost:3000/health
```

### 7.3 配置说明

**.env 文件：**
```bash
# 飞书配置
FEISHU_APP_ID=cli_xxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxx
FEISHU_CHAT_ID=oc_xxxxxxxxxxxxx

# 服务配置
PORT=3000
NODE_ENV=production
```

### 7.4 后台运行

```bash
# 使用 PM2
npm install -g pm2
pm2 start npm --name "bce" -- start
pm2 save
pm2 startup
```

---

## 8. 使用手册

### 8.1 任务创建人（天枢/磊哥）

#### 创建任务
1. 访问 `http://192.168.31.187:3000/bce-tasks.html`
2. 点击 "➕ 创建任务"
3. 填写任务信息
4. 点击 "创建任务"

#### 分配任务
1. 找到刚创建的任务
2. 点击 "分配" 按钮
3. 输入负责人姓名
4. 点击确认

#### 验收任务
1. 找到状态为 "待验收" 的任务
2. 点击 "验收通过" 按钮
3. 输入验收意见
4. 点击确认

### 8.2 任务执行人（匠心/司库/执矩/磐石/灵犀）

#### 查看分配给我的任务
1. 访问任务管理页面
2. 在任务列表中查找自己的名字

#### 开始执行
1. 找到状态为 "已分配" 的任务
2. 点击 "开始执行" 按钮

#### 提交验收
1. 完成任务后，找到状态为 "执行中" 的任务
2. 点击 "提交验收" 按钮
3. 输入交付物
4. 任务状态变为 "待验收"

#### 添加评论
1. 点击任务的 "查看详情" 按钮
2. 在评论区输入内容
3. 点击 "发送"

---

## 9. 故障排查

### 9.1 常见问题

#### 问题 1：任务列表为空
**原因：** BCE 服务未启动或数据丢失  
**解决：** 
```bash
# 检查服务状态
curl http://localhost:3000/health

# 重启服务
npm start
```

#### 问题 2：飞书通知不发送
**原因：** 飞书配置错误或机器人不在群里  
**解决：**
1. 检查 `.env` 文件配置
2. 确认天枢机器人在群里
3. 查看日志：`[飞书] 发送消息失败`

#### 问题 3：Control Center 数据不同步
**原因：** 同步脚本未运行  
**解决：**
```bash
# 检查同步脚本
ps aux | grep sync-to-cc

# 重启同步脚本
node scripts/sync-to-cc.js &
```

### 9.2 日志查看

```bash
# 查看 BCE 服务日志
tail -f /path/to/BCE-Project/logs/app.log

# 查看同步日志
tail -f /path/to/BCE-Project/logs/sync.log
```

---

## 10. 版本历史

### v1.0.0 (2026-03-20)

**新增功能：**
- ✅ 任务完整流转流程（创建→分配→执行→验收）
- ✅ 子任务拆分功能
- ✅ 评论系统
- ✅ Agent 消息系统
- ✅ Control Center 数据同步
- 🟡 飞书通知（待调试）

**技术栈：**
- Node.js v25.8.0
- Express.js
- 原生 HTML/CSS/JS

**已知问题：**
- 飞书通知 API 返回错误 9499（机器人权限问题）

---

## 📞 技术支持

| 问题类型 | 联系人 |
|---------|--------|
| 系统故障 | 匠心 (CTO) |
| 飞书配置 | 磐石 (SRE) |
| 使用问题 | 天枢 (CEO) |

---

**文档版本：** 1.0.0  
**最后更新：** 2026-03-20 15:17  
**维护人：** 匠心 (CTO)
