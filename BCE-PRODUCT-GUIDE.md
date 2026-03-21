# BCE 项目 + Control Center 产品说明书与操作指引

**文档版本：** 2.0  
**创建日期：** 2026-03-20 18:22  
**技术负责人：** 匠心 (CTO)  
**项目地址：** `/Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库/BCE-Project`

---

## 📋 目录

1. [系统概述](#1-系统概述)
2. [系统架构与协同方式](#2-系统架构与协同方式)
3. [BCE 项目功能详解](#3-bce 项目功能详解)
4. [Control Center 功能详解](#4-control-center 功能详解)
5. [数据同步机制](#5-数据同步机制)
6. [飞书通知与@功能](#6-飞书通知与@功能)
7. [操作指引](#7-操作指引)
8. [故障排查](#8-故障排查)
9. [附录](#9-附录)

---

## 1. 系统概述

### 1.1 项目背景

BCE（北斗协同引擎）和 Control Center 是北斗团队的任务协同管理系统，实现任务在团队成员间的无缝流转、信息同步和飞书通知。

### 1.2 核心目标

- **任务无缝流转**：创建→分配→执行→验收完整流程
- **信息实时同步**：BCE 与 Control Center 数据 30 秒自动同步
- **飞书通知集成**：任务状态变更自动@相关人员
- **数据持久化**：重启后数据不丢失

### 1.3 用户角色

| 角色 | 人员 | 职责 | 权限 |
|------|------|------|------|
| 管理员 | 磊哥、天枢 | 创建任务、分配任务、验收任务 | 所有权限 |
| 执行成员 | 匠心、司库、执矩、磐石、灵犀 | 执行任务、提交验收 | 创建、读取、更新、分配 |
| 只读用户 | 其他人员 | 查看任务 | 仅读取 |

### 1.4 访问地址

| 系统 | 地址 | 用途 |
|------|------|------|
| **BCE 任务管理** | `http://192.168.31.187:3000/bce-tasks.html` | 主要工作台 |
| **Agent 消息** | `http://192.168.31.187:3000/agent-messages.html` | 内部通信 |
| **任务看板** | `http://192.168.31.187:3000/board.html` | 可视化看板 |
| **Control Center** | `http://192.168.31.187:4310` | 系统监控 + 任务展示 |

---

## 2. 系统架构与协同方式

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                      用户层                              │
├─────────────┬─────────────┬─────────────┬───────────────┤
│ 磊哥        │ 天枢        │ 匠心        │ 其他成员      │
│ (管理员)    │ (管理员)    │ (执行成员)  │ (执行成员)    │
└─────────────┴─────────────┴─────────────┴───────────────┘
                          ↓ HTTP/飞书 API
┌─────────────────────────────────────────────────────────┐
│                   应用服务层                              │
├─────────────────────┬───────────────────────────────────┤
│   BCE (3000 端口)    │   Control Center (4310 端口)       │
│  - 任务管理          │  - 系统监控                        │
│  - 飞书通知          │  - 用量统计                        │
│  - Agent 消息        │  - 任务展示 (只读)                 │
│  - 数据持久化        │  - 会话管理                        │
└─────────────────────┴───────────────────────────────────┘
                          ↓ 定时同步 (30 秒)
┌─────────────────────────────────────────────────────────┐
│                     数据存储层                            │
├─────────────────────┬───────────────────────────────────┤
│ BCE runtime 目录     │ Control Center runtime 目录        │
│ - bce-data.json     │ - tasks.json                       │
│ - audit-log.json    │                                    │
└─────────────────────┴───────────────────────────────────┘
                          ↓ 飞书 API
┌─────────────────────────────────────────────────────────┐
│                     飞书平台                              │
├─────────────────────┬───────────────────────────────────┤
│ 飞书群通知          │ 飞书@提醒                          │
│ - 任务状态变更      │ - @负责人                          │
│ - 任务分配通知      │ - @验收人                          │
│ - 任务完成通知      │ - @创建人                          │
└─────────────────────┴───────────────────────────────────┘
```

### 2.2 BCE 与 Control Center 协同方式

| 特性 | BCE | Control Center | 协同方式 |
|------|-----|---------------|---------|
| **数据源** | 主数据源 | 只读副本 | BCE → Control Center 单向同步 |
| **任务创建** | ✅ 可创建 | ❌ 不可创建 | 只在 BCE 创建 |
| **任务更新** | ✅ 可更新 | ❌ 不可更新 | 只在 BCE 更新 |
| **任务展示** | ✅ 实时展示 | ✅ 30 秒延迟展示 | Control Center 轮询 BCE API |
| **系统监控** | ❌ 无 | ✅ 完整监控 | Control Center 负责 |

### 2.3 信息同步方式

#### 同步机制

```
BCE 数据变更
  ↓
保存到 runtime/bce-data.json
  ↓
同步脚本 (每 30 秒)
  ↓
读取 BCE 数据
  ↓
转换为 Control Center 格式
  ↓
写入 Control Center runtime/tasks.json
  ↓
Control Center 前端刷新显示
```

#### 同步脚本

**位置：** `/Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库/BCE-Project/scripts/sync-to-cc.js`

**配置：**
```javascript
const SYNC_INTERVAL_MS = 30000; // 30 秒同步一次
const CC_TASKS_PATH = '/Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库/openclaw-control-center/runtime/tasks.json';
```

**状态映射：**
| BCE 状态 | Control Center 状态 |
|---------|-------------------|
| pending | todo |
| assigned | todo |
| executing | in_progress |
| reviewing | done |
| accepted | done |
| cancelled | done |

---

## 3. BCE 项目功能详解

### 3.1 任务管理

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

**访问方式：** `http://192.168.31.187:3000/bce-tasks.html` → 点击"➕ 创建任务"

**必填字段：**
- 任务标题
- 创建人

**可选字段：**
- 任务描述
- 优先级 (P0/P1/P2)
- **计划完成时间** ⭐

**API 调用：**
```bash
POST http://localhost:3000/api/bce/tasks
Content-Type: application/json

{
  "title": "任务标题",
  "description": "任务描述",
  "creator": "磊哥",
  "assignee": "匠心",
  "priority": "P0",
  "dueDate": "2026-03-21T18:00:00.000Z"
}
```

**响应：**
```json
{
  "success": true,
  "taskId": "xxx-xxx-xxx",
  "message": "任务创建成功",
  "data": { ... }
}
```

#### 3.1.3 任务分配

**操作方式：** 任务列表 → 找到"待分配"任务 → 点击"分配" → 输入负责人姓名

**负责人姓名：** 匠心/司库/执矩/磐石/灵犀

**API 调用：**
```bash
POST http://localhost:3000/api/bce/tasks/:id/assign
Content-Type: application/json

{
  "assignee": "匠心",
  "operator": "天枢",
  "comment": "这个任务由匠心负责"
}
```

**飞书通知：**
```
📋 任务已分配
任务：任务标题
负责人：匠心
负责人是否已接收：待确认
操作人：天枢
计划完成时间：2026-03-21 18:00:00
备注：这个任务由匠心负责
查看详情：http://192.168.31.187:3000/bce-tasks.html
```

#### 3.1.4 任务执行

**操作方式：** 任务列表 → 找到"已分配"任务 → 点击"开始执行"

**API 调用：**
```bash
POST http://localhost:3000/api/bce/tasks/:id/start
Content-Type: application/json

{
  "operator": "匠心",
  "comment": "开始执行任务"
}
```

**飞书通知：**
```
🚀 任务执行中
任务：任务标题
负责人：匠心
负责人是否已接收：待确认
操作人：匠心
计划完成时间：2026-03-21 18:00:00
备注：开始执行任务
查看详情：http://192.168.31.187:3000/bce-tasks.html
```

#### 3.1.5 任务验收

**提交验收：**
- 操作方式：任务列表 → 找到"执行中"任务 → 点击"提交验收" → 输入交付物

**验收通过：**
- 操作方式：任务列表 → 找到"待验收"任务 → 点击"验收通过" → 输入验收意见
- 权限：仅管理员（磊哥、天枢）

**API 调用：**
```bash
# 提交验收
POST http://localhost:3000/api/bce/tasks/:id/submit
{
  "operator": "匠心",
  "deliverables": ["代码完成", "测试通过"],
  "comment": "功能开发完成"
}

# 验收通过
POST http://localhost:3000/api/bce/tasks/:id/accept
{
  "acceptor": "天枢",
  "comment": "验收通过，可以上线"
}
```

**飞书通知：**
```
🎉 任务已完成
任务：任务标题
负责人：匠心
负责人是否已接收：待确认
操作人：天枢
计划完成时间：2026-03-21 18:00:00
备注：验收通过，可以上线
查看详情：http://192.168.31.187:3000/bce-tasks.html
```

### 3.2 子任务拆分

**使用场景：** 大任务需要分解为多个小任务

**操作方式：** 任务详情 → 添加子任务 → 填写子任务信息

**API 调用：**
```bash
POST http://localhost:3000/api/bce/tasks/:id/subtasks
{
  "title": "子任务 1: API 开发",
  "description": "负责任务流转 API 开发",
  "assignee": "匠心"
}
```

### 3.3 评论系统

**使用场景：** 任务讨论、进度更新、问题反馈

**操作方式：** 任务详情 → 评论区 → 输入内容 → 发送

**API 调用：**
```bash
POST http://localhost:3000/api/bce/tasks/:id/comments
{
  "author": "匠心",
  "content": "任务已完成 50%",
  "parentId": null  // 回复评论时填写父评论 ID
}
```

### 3.4 任务搜索

**访问方式：** `http://192.168.31.187:3000/bce-tasks.html` → 搜索框

**搜索条件：**
- 关键词（标题、描述）
- 状态（pending/assigned/executing/reviewing/accepted/cancelled）
- 负责人
- 创建人
- 优先级

**API 调用：**
```bash
GET http://localhost:3000/api/bce/tasks/search?keyword=API&status=assigned&assignee=匠心
```

### 3.5 权限控制

**角色定义：**
```javascript
const ROLE_PERMISSIONS = {
  admin: ['create', 'read', 'update', 'delete', 'assign', 'accept'],  // 管理员
  member: ['create', 'read', 'update', 'assign'],  // 普通成员
  viewer: ['read']  // 只读用户
};
```

**用户角色映射：**
```javascript
const USER_ROLES = {
  '磊哥': 'admin',
  '天枢': 'admin',
  '匠心': 'member',
  '司库': 'member',
  '执矩': 'member',
  '磐石': 'member',
  '灵犀': 'member'
};
```

**权限检查：**
- 任务验收：仅 admin 角色
- 任务分配：admin 或任务创建人
- 任务更新：admin、任务负责人或创建人

### 3.6 操作审计

**功能：** 记录所有任务操作，支持追溯

**日志位置：** `/Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库/BCE-Project/runtime/audit-log.json`

**日志内容：**
```json
{
  "id": 1,
  "timestamp": "2026-03-20T10:15:04.801Z",
  "action": "CREATE_TASK",
  "userId": "磊哥",
  "userName": "磊哥",
  "resourceType": "task",
  "resourceId": "ffb13cc2-f349-4010-9706-96224e4087e1",
  "details": {
    "title": "✅ 修复验证测试",
    "assignee": "匠心",
    "priority": "P0"
  }
}
```

**查询审计日志：**
```bash
GET http://localhost:3000/api/bce/audit?userId=磊哥&action=CREATE_TASK&limit=50
```

### 3.7 数据持久化

**存储位置：** `/Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库/BCE-Project/runtime/bce-data.json`

**存储内容：**
- 任务数据（tasks）
- 子任务数据（subTasks）
- 评论数据（comments）

**自动保存时机：**
- 任务创建
- 任务状态变更
- 子任务创建
- 评论添加

**重启后自动加载：**
```javascript
// 服务启动时
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    data.tasks.forEach(t => tasks.set(t.id, t));
    // ...
  }
}
```

---

## 4. Control Center 功能详解

### 4.1 系统监控

**功能：** 监控系统健康状态、用量统计

**访问地址：** `http://192.168.31.187:4310`

**监控内容：**
- 服务运行状态（BCE、Control Center）
- API 响应时间统计
- 请求量统计（按小时/天）
- 错误日志统计
- 会话连接状态

**截图示例：**
![系统监控面板](./screenshots/control-center-monitoring.png)
> *图：Control Center 系统监控主面板，显示服务状态和用量统计*

### 4.2 任务展示

**数据来源：** BCE 项目（30 秒同步）

**展示内容：**
- 任务列表（按状态分组）
- 任务详情（标题、负责人、状态、优先级、计划完成时间）
- 任务统计（总数/待分配/执行中/待验收/已完成）
- 任务趋势图（近 7 天任务创建/完成趋势）

**只读限制：**
- ❌ 不可创建任务
- ❌ 不可更新任务
- ❌ 不可删除任务
- ✅ 可查看任务详情
- ✅ 可搜索/筛选任务

**截图示例：**
![任务列表面板](./screenshots/control-center-tasks.png)
> *图：Control Center 任务列表面板，显示所有任务的状态和负责人*

**筛选功能：**
- 按状态筛选：全部/待分配/执行中/待验收/已完成
- 按负责人筛选：匠心/司库/执矩/磐石/灵犀
- 按优先级筛选：P0/P1/P2
- 按时间筛选：今天/本周/本月

### 4.3 会话管理

**功能：** 管理 OpenClaw 会话状态

**会话信息：**
- 会话 ID
- 会话类型（main/subagent/heartbeat）
- 会话状态（active/idle/closed）
- 最后活跃时间
- 关联的 Agent 名称

**截图示例：**
![会话管理面板](./screenshots/control-center-sessions.png)
> *图：Control Center 会话管理面板，显示所有活跃会话状态*

### 4.4 系统设置

**功能：** 配置系统参数

**可配置项：**
- 同步间隔（默认 30 秒）
- 通知开关（飞书通知启用/禁用）
- 数据备份策略
- 日志保留天数

**截图示例：**
![系统设置面板](./screenshots/control-center-settings.png)
> *图：Control Center 系统设置面板，可配置同步间隔和通知开关*

### 4.5 数据导出

**功能：** 导出任务数据为 CSV/Excel

**导出格式：**
- CSV：适合导入 Excel 或其他工具
- JSON：适合数据备份或迁移

**导出内容：**
- 任务 ID、标题、描述、负责人、状态、优先级
- 创建时间、计划完成时间、实际完成时间
- 操作历史记录

**操作方式：**
1. 访问 Control Center → 数据导出
2. 选择导出格式（CSV/JSON）
3. 选择时间范围（全部/近 7 天/近 30 天/自定义）
4. 点击"导出"

**截图示例：**
![数据导出面板](./screenshots/control-center-export.png)
> *图：Control Center 数据导出面板，支持 CSV 和 JSON 格式*

---

## 4.6 Control Center 快速上手

### 4.6.1 首次使用

1. **访问地址：** `http://192.168.31.187:4310`
2. **查看系统状态：** 确认 BCE 服务连接正常（绿色状态）
3. **查看任务列表：** 默认显示所有任务
4. **使用筛选功能：** 按负责人或状态筛选任务

### 4.6.2 日常使用场景

**场景 1：查看我的任务**
1. 访问 Control Center
2. 点击"负责人"筛选 → 选择自己的名字
3. 查看分配给自己的所有任务

**场景 2：跟踪项目进度**
1. 访问 Control Center → 任务列表
2. 查看"执行中"状态的任务数量
3. 点击任务查看详情和评论

**场景 3：导出任务报告**
1. 访问 Control Center → 数据导出
2. 选择时间范围（如：近 7 天）
3. 选择格式（CSV）
4. 点击导出 → 打开 Excel 查看

### 4.6.3 视频教程

**视频 1：Control Center 快速入门（5 分钟）**
- 链接：`https://example.com/videos/cc-quickstart.mp4`（待录制）
- 内容：系统介绍、任务查看、筛选功能

**视频 2：BCE 任务管理完整流程（10 分钟）**
- 链接：`https://example.com/videos/bce-workflow.mp4`（待录制）
- 内容：创建任务、分配任务、执行任务、验收任务

**视频 3：飞书通知配置指南（3 分钟）**
- 链接：`https://example.com/videos/feishu-setup.mp4`（待录制）
- 内容：飞书开放平台配置、Webhook 设置、@功能测试

> 📹 **视频教程录制计划：** 2026-03-21 前完成录制并上传

---

## 5. 数据同步机制

### 5.1 同步流程

```
┌─────────────┐
│ BCE 数据变更  │
└──────┬──────┘
       │
       ↓
┌─────────────────┐
│ 保存到 bce-data  │
└──────┬──────────┘
       │
       ↓
┌─────────────────┐
│ 同步脚本 (30 秒)  │
└──────┬──────────┘
       │
       ↓
┌─────────────────┐
│ 读取 BCE 数据     │
└──────┬──────────┘
       │
       ↓
┌─────────────────┐
│ 转换为 CC 格式    │
└──────┬──────────┘
       │
       ↓
┌─────────────────┐
│ 写入 CC tasks   │
└──────┬──────────┘
       │
       ↓
┌─────────────────┐
│ CC 前端刷新显示  │
└─────────────────┘
```

### 5.2 同步脚本配置

**位置：** `BCE-Project/scripts/sync-to-cc.js`

**关键配置：**
```javascript
const SYNC_INTERVAL_MS = 30000; // 30 秒
const CC_TASKS_PATH = '/Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库/openclaw-control-center/runtime/tasks.json';
```

### 5.3 状态映射表

| BCE 状态 | BCE 英文 | Control Center 状态 |
|---------|---------|-------------------|
| 待分配 | pending | todo |
| 已分配 | assigned | todo |
| 执行中 | executing | in_progress |
| 待验收 | reviewing | done |
| 已完成 | accepted | done |
| 已取消 | cancelled | done |

---

## 6. 飞书通知与@功能

### 6.1 飞书通知触发场景

| 场景 | 触发时机 | 通知对象 |
|------|---------|---------|
| 任务创建 | 任务创建时 | 群聊所有人 |
| 任务分配 | 任务分配时 | 负责人 + 群聊所有人 |
| 任务执行 | 开始执行时 | 群聊所有人 |
| 任务验收 | 提交验收时 | 验收人 + 群聊所有人 |
| 任务完成 | 验收通过时 | 创建人 + 群聊所有人 |

### 6.2 @功能实现方式

#### 技术实现

**飞书 API 要求：**
```javascript
{
  "receive_id": "oc_19be54b67684b6597ff335d7534896d4",
  "msg_type": "text",
  "content": JSON.stringify({
    "text": "通知内容...",
    "at": {
      "user_id": ["ou_b3b3b6abaa38da2c4066010a02abf544"],  // 要@的用户 ID
      "all": false
    }
  })
}
```

#### 用户名到 user_id 映射

**映射表：**
```javascript
const userMap = {
  '天枢': 'ou_c22dcb4ed8911acfca2f0e2ad865b0ce',
  '匠心': 'ou_b3b3b6abaa38da2c4066010a02abf544',
  '司库': 'ou_998d07ddc86ad7ba9d4dd12dddc55cc6',
  '磐石': 'ou_143256262f3459429ed5bb057f7a3436',
  '磊哥': 'ou_107ee407edb8e6053adf9b019451071d'
};
```

#### @功能配置要求

**飞书开放平台配置：**
1. **事件订阅：** `im.message.receive_v1`
2. **Webhook 地址：** `http://192.168.31.187:3000/api/feishu/webhook`
3. **机器人权限：** `im:message:send_as_bot`

### 6.3 飞书通知模板

**标准模板：**
```
📋 任务已分配
任务：{任务标题}
负责人：{负责人姓名}
负责人是否已接收：待确认
操作人：{操作人姓名}
计划完成时间：{计划完成时间}
备注：{备注信息}
查看详情：http://192.168.31.187:3000/bce-tasks.html
```

**@效果：** 负责人会在飞书中收到@提醒 🔔

### 6.4 飞书 Webhook 接收

**功能：** 接收飞书群消息，识别@机器人

**支持命令：**
- `@匠心` → 匠心机器人回复
- `@天枢` → 天枢机器人回复

**自动识别：**
```javascript
if (text.includes('@匠心')) {
  await sendFeishuMessage(chatId, `@用户 匠心已收到您的消息`, [senderId]);
}
```

---

## 7. 操作指引

### 7.1 管理员操作指南（磊哥、天枢）

#### 创建任务

1. 访问 `http://192.168.31.187:3000/bce-tasks.html`
2. 点击"➕ 创建任务"
3. 填写：
   - 任务标题（必填）
   - 任务描述（可选）
   - 创建人（必填）
   - 优先级（可选）
   - **计划完成时间**（可选，建议填写）
4. 点击"创建任务"

#### 分配任务

1. 找到"待分配"状态的任务
2. 点击"分配"按钮
3. 输入负责人姓名（匠心/司库/执矩/磐石/灵犀）
4. 点击确认

**飞书通知：** 负责人会收到@提醒

#### 验收任务

1. 找到"待验收"状态的任务
2. 点击"验收通过"按钮
3. 输入验收意见
4. 点击确认

**权限：** 仅管理员可以验收

### 7.2 执行成员操作指南（匠心、司库等）

#### 查看分配给我的任务

1. 访问 `http://192.168.31.187:3000/bce-tasks.html`
2. 在任务列表中查找自己的名字
3. 或使用搜索功能：`assignee=我的名字`

#### 开始执行任务

1. 找到"已分配"状态的任务
2. 点击"开始执行"按钮
3. 任务状态变为"执行中"

**飞书通知：** 群聊会收到通知

#### 提交验收

1. 完成任务后，找到"执行中"状态的任务
2. 点击"提交验收"按钮
3. 输入交付物（如：代码完成、测试通过）
4. 任务状态变为"待验收"

**飞书通知：** 验收人会收到@提醒

#### 添加评论

1. 点击任务的"查看详情"按钮
2. 在评论区输入内容
3. 点击"发送"

### 7.3 任务搜索操作

#### 关键词搜索

1. 访问搜索页面或使用搜索 API
2. 输入关键词（支持标题、描述）
3. 点击搜索

**API 示例：**
```bash
GET http://localhost:3000/api/bce/tasks/search?keyword=API
```

#### 多条件筛选

**筛选条件：**
- 状态：pending/assigned/executing/reviewing/accepted/cancelled
- 负责人：匠心/司库/执矩/磐石/灵犀
- 优先级：P0/P1/P2

**API 示例：**
```bash
GET http://localhost:3000/api/bce/tasks/search?status=assigned&assignee=匠心&priority=P0
```

### 7.4 查看审计日志

**访问方式：**
```bash
GET http://localhost:3000/api/bce/audit?userId=匠心&limit=50
```

**筛选条件：**
- userId：操作人
- action：操作类型（CREATE_TASK/ASSIGN_TASK等）
- resourceType：资源类型（task）
- limit：返回条数

---

## 8. 故障排查

### 8.1 常见问题

#### 问题 1：任务列表为空

**原因：** BCE 服务未启动或数据文件丢失

**解决：**
```bash
# 检查服务状态
curl http://localhost:3000/health

# 检查数据文件
ls -la BCE-Project/runtime/bce-data.json

# 重启服务
cd BCE-Project && npm start
```

#### 问题 2：飞书通知不发送

**原因：** 
- 飞书配置错误
- 机器人权限不足
- 群 ID 错误

**解决：**
1. 检查 `.env` 文件配置
2. 确认飞书应用已发布
3. 确认机器人已添加到群
4. 查看日志：`[飞书] 发送失败`

#### 问题 3：飞书@不生效

**原因：**
- user_id 映射错误
- 飞书群限制机器人@
- API 格式错误

**解决：**
1. 检查 user_id 映射表
2. 查看日志：`[飞书] 设置@用户`
3. 确认飞书群机器人权限

#### 问题 4：Control Center 数据不同步

**原因：** 同步脚本未运行

**解决：**
```bash
# 检查同步脚本
ps aux | grep sync-to-cc

# 重启同步脚本
node scripts/sync-to-cc.js &
```

### 8.2 日志查看

**BCE 服务日志：**
```bash
# 查看运行日志
tail -f BCE-Project/logs/app.log

# 查看飞书通知日志
grep "飞书" BCE-Project/logs/app.log
```

**审计日志：**
```bash
cat BCE-Project/runtime/audit-log.json | python3 -m json.tool
```

---

## 9. 附录

### 9.1 API 接口列表

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/bce/tasks` | POST | 创建任务 |
| `/api/bce/tasks` | GET | 获取任务列表 |
| `/api/bce/tasks/:id` | GET | 获取任务详情 |
| `/api/bce/tasks/:id/assign` | POST | 分配任务 |
| `/api/bce/tasks/:id/start` | POST | 开始执行 |
| `/api/bce/tasks/:id/submit` | POST | 提交验收 |
| `/api/bce/tasks/:id/accept` | POST | 验收通过 |
| `/api/bce/tasks/:id/cancel` | POST | 取消任务 |
| `/api/bce/tasks/:id/subtasks` | POST | 创建子任务 |
| `/api/bce/tasks/:id/comments` | POST | 添加评论 |
| `/api/bce/tasks/search` | GET | 搜索任务 |
| `/api/bce/tasks/stats` | GET | 任务统计 |
| `/api/bce/audit` | GET | 审计日志 |
| `/api/sync/tasks` | GET | 同步 Control Center |
| `/api/feishu-notify/notify/task` | POST | 发送飞书通知 |
| `/api/feishu-notify/test` | GET | 测试飞书通知 |

### 9.2 文件结构

```
BCE-Project/
├── src/
│   ├── index.js              # 主入口
│   ├── api/
│   │   ├── bce-tasks.js      # 任务管理 API
│   │   ├── agent-message.js  # Agent 消息 API
│   │   ├── feishu-notify.js  # 飞书通知 API
│   │   └── sync.js           # 数据同步 API
│   └── middleware/
│       ├── auth.js           # 权限控制中间件
│       └── audit.js          # 审计日志中间件
├── public/
│   ├── bce-tasks.html        # 任务管理页面
│   ├── agent-messages.html   # Agent 消息页面
│   └── board.html            # 任务看板页面
├── scripts/
│   ├── sync-to-cc.js         # Control Center 同步脚本
│   └── get-chat-id.js        # 飞书群 ID 获取脚本
├── runtime/
│   ├── bce-data.json         # 任务数据持久化
│   └── audit-log.json        # 审计日志
├── .env                      # 环境配置
├── package.json              # 项目配置
└── README.md                 # 项目说明
```

### 9.3 环境配置

**.env 文件：**
```bash
# 飞书配置
FEISHU_APP_ID=cli_a9242655a1ba1cb1
FEISHU_APP_SECRET=EtioKZkhqwEWYOwiYaOvJfeNIUQMQnSU
FEISHU_CHAT_ID=oc_19be54b67684b6597ff335d7534896d4

# 服务配置
PORT=3000
NODE_ENV=production
```

### 9.4 用户 user_id 映射

| 姓名 | user_id |
|------|---------|
| 天枢 | ou_c22dcb4ed8911acfca2f0e2ad865b0ce |
| 匠心 | ou_b3b3b6abaa38da2c4066010a02abf544 |
| 司库 | ou_998d07ddc86ad7ba9d4dd12dddc55cc6 |
| 磐石 | ou_143256262f3459429ed5bb057f7a3436 |
| 磊哥 | ou_107ee407edb8e6053adf9b019451071d |

---

**文档版本：** 2.1  
**最后更新：** 2026-03-20 18:45  
**维护人：** 匠心 (CTO)  
**文档路径：** `/Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库/BCE-Project/BCE-PRODUCT-GUIDE.md`

---

## 附录 A：截图说明

### 截图文件列表

以下截图文件应放置在 `screenshots/` 目录下：

| 文件名 | 说明 | 状态 |
|--------|------|------|
| `control-center-monitoring.png` | Control Center 系统监控主面板 | 🟡 待截取 |
| `control-center-tasks.png` | Control Center 任务列表面板 | 🟡 待截取 |
| `control-center-sessions.png` | Control Center 会话管理面板 | 🟡 待截取 |
| `control-center-settings.png` | Control Center 系统设置面板 | 🟡 待截取 |
| `control-center-export.png` | Control Center 数据导出面板 | 🟡 待截取 |
| `bce-tasks-list.png` | BCE 任务管理主页面 | 🟡 待截取 |
| `bce-task-detail.png` | BCE 任务详情页面（含评论和子任务） | 🟡 待截取 |
| `bce-create-task.png` | BCE 创建任务弹窗 | 🟡 待截取 |
| `feishu-notification.png` | 飞书通知消息示例 | 🟡 待截取 |

### 截图工具推荐

**macOS 自带：**
- `Cmd + Shift + 4` - 截取选定区域
- `Cmd + Shift + 5` - 打开截图工具（支持录屏）

**推荐工具：**
- CleanShot X - 支持标注、滚动截图
- Shottr - 免费、支持标注

### 截图规范

1. **分辨率：** 1920x1080 或更高
2. **格式：** PNG（无损压缩）
3. **标注：** 重要功能用红框标注
4. **命名：** 使用英文小写，连字符分隔

---

## 附录 B：更新日志

| 版本 | 日期 | 更新内容 | 更新人 |
|------|------|---------|--------|
| 2.1 | 2026-03-20 18:45 | 补充 Control Center 详细功能说明、截图示例占位、视频教程链接 | 匠心 |
| 2.0 | 2026-03-20 18:22 | 初始版本，完整的产品说明书和操作指引 | 匠心 |
