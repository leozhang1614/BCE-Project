# BCE 项目功能说明书

**项目名称：** 北斗协同引擎（Beidou Collaboration Engine）  
**版本：** v1.0  
**日期：** 2026-03-21  
**状态：** 部分功能已开发，待完善  
**负责人：** 匠心 (CTO)

---

## 📋 目录

1. [项目概述](#1-项目概述)
2. [系统架构](#2-系统架构)
3. [功能清单](#3-功能清单)
4. [详细功能说明](#4-详细功能说明)
5. [待开发功能](#5-待开发功能)
6. [技术实现](#6-技术实现)
7. [部署说明](#7-部署说明)
8. [使用指南](#8-使用指南)

---

## 1. 项目概述

### 1.1 项目背景

**问题：** 多 Agent 协同工作中，任务分配、通知、确认、流转缺乏统一管理。

**目标：** 建立一个稳定可靠的任务管理体系，实现：
- ✅ 任务能发 - 创建任务后能及时通知到负责人
- ✅ 任务能收 - 负责人能及时收到并确认任务
- ✅ 信息反馈 - 任务状态变更能及时反馈给相关人员
- ✅ 任务流转 - 任务能在不同 Agent 之间顺利流转

### 1.2 解决方案

**融合方案：OCC 为主 + BCE 轮询为辅**

```
┌─────────────────────────────────────────────────────────────────┐
│                  BCE + OCC 融合方案                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  主系统：OCC（OpenClaw Control Center）                         │
│  状态：✅ 已部署                                                │
│  地址：http://192.168.31.187:4310                              │
│                                                                 │
│  辅助系统：BCE（北斗协同引擎）                                   │
│  状态：⏳ 部分功能待开发                                         │
│  地址：http://localhost:3000                                   │
│                                                                 │
│  通知通道：飞书机器人                                           │
│  状态：⏳ 简化版待优化                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 核心价值

| 价值 | 说明 |
|------|------|
| **统一任务管理** | 所有任务集中管理，状态清晰可见 |
| **及时通知** | 任务创建、变更及时通知相关人员 |
| **流程规范** | 任务流转有明确的状态机和流程 |
| **数据同步** | BCE 与 OCC 数据实时同步 |
| **多渠道确认** | OCC 页面 + 飞书回复双重确认 |

---

## 2. 系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户层                                   │
│    天枢 ──────┬────── 匠心 ──────┬────── 司库 ──────┬─── 执矩   │
│               │                  │                  │           │
└───────────────┼──────────────────┼──────────────────┼───────────┘
                │                  │                  │
        ┌───────┴───────┐  ┌───────┴───────┐  ┌──────┴──────┐
        │  OCC 协作页面  │  │  OCC 任务页面  │  │  飞书群聊   │
        │  (主确认入口)  │  │  (任务看板)    │  │  (通知提醒)  │
        └───────┬───────┘  └───────┬───────┘  └──────┬──────┘
                │                  │                  │
                └──────────────────┼──────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │      OpenClaw Gateway       │
                    │  ws://127.0.0.1:18789       │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │     sessions_send 机制      │
                    │   (原生跨会话消息传递)       │
                    └─────────────────────────────┘
```

### 2.2 组件说明

| 组件 | 说明 | 状态 |
|------|------|------|
| **OCC** | OpenClaw Control Center，主任务管理系统 | ✅ 已部署 |
| **BCE** | 北斗协同引擎，辅助任务和通知系统 | ⏳ 部分完成 |
| **Gateway** | OpenClaw Gateway，会话管理中枢 | ✅ 运行中 |
| **飞书机器人** | 通知提醒通道 | ⚠️ 待优化 |

### 2.3 数据流

```
任务创建 → 任务分发 → 任务确认 → 任务执行 → 任务流转 → 任务验收 → 任务归档
   │          │          │          │          │          │          │
   ↓          ↓          ↓          ↓          ↓          ↓          ↓
OCC 创建   OCC 显示    OCC 确认    sessions   OCC 记录    OCC 验收    OCC 归档
任务      协作页面    通知中心    _send      流转历史    任务页面    任务页面
                                      │
                                      ↓
                                 BCE 轮询
                                 飞书提醒
```

---

## 3. 功能清单

### 3.1 已完成功能 ✅

#### OCC 功能

| 功能 | 说明 | 访问地址 |
|------|------|---------|
| 总览页面 | 系统状态、待处理事项 | `/?section=overview` |
| 协作页面 | 跨会话消息、任务流转 | `/?section=collaboration` |
| 任务页面 | 138 个任务、看板视图 | `/?section=tasks` |
| 员工页面 | Agent 状态、任务队列 | `/?section=staff` |
| 用量页面 | Token 消耗、花费统计 | `/?section=usage` |
| 设置页面 | 系统配置、连接状态 | `/?section=settings` |
| 通知中心 API | 待确认事项列表 | `/api/action-queue` |
| 任务 API | 任务 CRUD 操作 | `/api/tasks` |

#### BCE 功能

| 功能 | 说明 | API |
|------|------|-----|
| 任务管理 API | 任务 CRUD | `/api/bce/tasks` |
| 飞书通知 API | 飞书消息发送 | `/api/feishu-notify` |
| 任务创建 | 创建新任务 | `POST /api/bce/tasks` |
| 任务分配 | 分配负责人 | `POST /api/bce/tasks/:id/assign` |
| 任务开始 | 开始执行 | `POST /api/bce/tasks/:id/start` |
| 任务提交 | 提交验收 | `POST /api/bce/tasks/:id/submit` |
| 任务验收 | 验收通过 | `POST /api/bce/tasks/:id/accept` |
| 任务取消 | 取消任务 | `POST /api/bce/tasks/:id/cancel` |
| 任务确认 | 确认收到 | `POST /api/bce/tasks/:id/confirm` |

---

### 3.2 待开发功能 ⏳

#### P0 高优先级（本周完成）

| 功能 | 说明 | 预计工时 | 状态 |
|------|------|---------|------|
| **定时轮询服务** | 每 5 分钟扫描任务，飞书提醒 | 1 小时 | ❌ 待开发 |
| **飞书 Webhook 优化** | 解析"收到"回复，自动确认任务 | 1 小时 | ❌ 待开发 |
| **任务转交功能** | 任务完成后转交下一节点 | 1.5 小时 | ❌ 待开发 |
| **OCC 任务同步** | BCE 任务自动同步到 OCC | 2 小时 | ❌ 待开发 |

#### P1 中优先级（下周完成）

| 功能 | 说明 | 预计工时 | 状态 |
|------|------|---------|------|
| **多应用飞书通知** | 每个成员独立飞书应用，解决@问题 | 3 小时 | ❌ 待开发 |
| **任务看板增强** | 筛选、搜索、批量操作、导出 | 4 小时 | ❌ 待开发 |
| **通知策略引擎** | 安静时段、通知级别、渠道选择 | 3 小时 | ❌ 待开发 |

#### P2 低优先级（本月完成）

| 功能 | 说明 | 预计工时 | 状态 |
|------|------|---------|------|
| **任务统计报表** | 完成率、工时、延期、负载分析 | 4 小时 | ❌ 待开发 |
| **移动端适配** | 手机端查看任务、飞书小程序 | 8 小时 | ❌ 待开发 |
| **API 文档完善** | OpenAPI 规范、在线文档、SDK | 2 小时 | ❌ 待开发 |

---

## 4. 详细功能说明

### 4.1 任务管理

#### 4.1.1 任务创建

**功能描述：** 创建新任务并分配给负责人

**使用场景：**
- 天枢创建任务分配给匠心
- 项目经理创建任务分配给团队成员

**输入：**
```json
{
  "title": "BCE 技术方案设计",
  "description": "设计 BCE 项目技术架构，输出技术方案文档",
  "assignee": "匠心",
  "creator": "天枢",
  "priority": "P0",
  "deadline": "2026-03-21T18:00:00.000Z",
  "projectId": "bce-project"
}
```

**输出：**
```json
{
  "success": true,
  "taskId": "TASK-001",
  "message": "任务创建成功",
  "data": {
    "id": "TASK-001",
    "title": "BCE 技术方案设计",
    "status": "pending",
    "assignee": "匠心",
    "createdAt": "2026-03-21T09:00:00.000Z"
  }
}
```

**实现状态：** ✅ 已完成

**API：**
```bash
POST /api/bce/tasks
```

---

#### 4.1.2 任务确认

**功能描述：** 负责人确认收到任务

**使用场景：**
- 匠心收到任务后确认接收
- 团队成员确认任务分配

**确认方式：**

**方式 A：OCC 页面确认（推荐）**
```
1. 访问 OCC 协作页面
2. 查看待确认任务
3. 点击 [确认接收]
4. 填写备注（可选）
5. 提交 → 任务状态更新
```

**方式 B：飞书回复确认**
```
1. 收到飞书通知
2. 回复"收到"
3. BCE 解析回复 → 调用 API 确认
4. 任务状态更新
```

**实现状态：** ⏳ 方式 A 已完成，方式 B 待优化

**API：**
```bash
POST /api/bce/tasks/:id/confirm
```

---

#### 4.1.3 任务流转

**功能描述：** 任务在不同 Agent 之间流转

**流转流程：**
```
天枢 → 匠心 → 司库 → 执矩 → 天枢
创建    执行    协作    审核    验收
```

**实现状态：** ⏳ 待开发（任务转交功能）

**API：**
```bash
POST /api/bce/tasks/:id/complete-and-transfer
```

---

### 4.2 定时轮询

#### 4.2.1 轮询机制

**功能描述：** 每 5 分钟扫描一次任务，发现新任务发送飞书提醒

**轮询流程：**
```
┌─────────────────────────────────────────────────────────┐
│              定时轮询流程                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. 定时触发（每 5 分钟）                                 │
│     ↓                                                   │
│  2. 从 OCC API 获取任务列表                               │
│     ↓                                                   │
│  3. 筛选未确认任务                                      │
│     ↓                                                   │
│  4. 发送飞书通知                                        │
│     ↓                                                   │
│  5. 记录扫描日志                                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**实现状态：** ❌ 待开发

**代码位置：**
```
src/scheduler/task-scheduler.js
src/services/task-scanner.js
```

---

#### 4.2.2 飞书通知

**功能描述：** 发送飞书消息提醒查看任务

**通知模板：**
```
📋 新任务通知

任务：BCE 技术方案设计
负责人：匠心
优先级：P0
截止时间：2026-03-21 18:00

请查看 OCC 协作页面确认：
http://192.168.31.187:4310/?section=collaboration&lang=zh
```

**实现状态：** ⚠️ 基础功能可用，@功能待优化

**代码位置：**
```
src/api/feishu-notify.js
src/services/notification-service.js
```

---

### 4.3 OCC 同步

#### 4.3.1 任务同步

**功能描述：** BCE 任务自动同步到 OCC

**同步流程：**
```
BCE 创建任务 → OCC 同步服务 → OCC 任务 API → OCC 任务页面显示
```

**状态映射：**
| BCE 状态 | OCC 状态 |
|---------|---------|
| pending | todo |
| assigned | todo |
| in_progress | in-progress |
| reviewing | review |
| completed | done |
| cancelled | cancelled |

**实现状态：** ❌ 待开发

**代码位置：**
```
src/integrations/occ-sync.js
```

---

#### 4.3.2 通知同步

**功能描述：** BCE 通知同步到 OCC 通知中心

**同步内容：**
- 待确认事项
- 任务状态变更
- 协作请求

**实现状态：** ❌ 待开发

**API：**
```bash
POST /api/action-queue
```

---

## 5. 待开发功能

### 5.1 定时轮询服务 🔴

**优先级：** P0  
**预计工时：** 1 小时  
**负责人：** 匠心

**需求说明：**
- 每 5 分钟自动扫描 OCC 任务
- 发现未确认任务发送飞书提醒
- 记录扫描日志
- 避免重复通知

**实现文件：**
- `src/scheduler/task-scheduler.js`
- `src/services/task-scanner.js`

**验收标准：**
- [ ] 每 5 分钟自动触发
- [ ] 发现新任务后发送飞书提醒
- [ ] 提醒消息包含 OCC 页面链接
- [ ] 不重复通知同一任务

---

### 5.2 飞书 Webhook 优化 🔴

**优先级：** P0  
**预计工时：** 1 小时  
**负责人：** 匠心

**需求说明：**
- 解析飞书群消息
- 识别"收到"、"确认"等关键词
- 自动确认任务
- 反馈确认结果到飞书

**实现文件：**
- `src/api/feishu-webhook.js`

**验收标准：**
- [ ] 飞书回复"收到"后任务状态更新
- [ ] 支持引用消息上下文
- [ ] 确认结果反馈到飞书

---

### 5.3 任务转交功能 🔴

**优先级：** P0  
**预计工时：** 1.5 小时  
**负责人：** 匠心

**需求说明：**
- 任务完成后转交下一节点
- 记录流转历史
- 通知下一节点
- 通知发起人

**实现文件：**
- `src/api/bce-tasks.js`

**验收标准：**
- [ ] 任务完成后可指定下一节点
- [ ] 流转历史记录完整
- [ ] 下一节点收到通知

---

### 5.4 OCC 任务同步 🔴

**优先级：** P0  
**预计工时：** 2 小时  
**负责人：** 匠心

**需求说明：**
- BCE 创建任务后自动同步到 OCC
- 状态变更实时同步
- 双向同步不冲突
- 失败重试机制

**实现文件：**
- `src/integrations/occ-sync.js`

**验收标准：**
- [ ] BCE 创建任务后自动同步到 OCC
- [ ] 状态变更实时同步
- [ ] 双向同步不冲突

---

### 5.5 多应用飞书通知 🟡

**优先级：** P1  
**预计工时：** 3 小时  
**负责人：** 匠心 + 磊哥

**需求说明：**
- 每个成员独立的飞书应用配置
- 使用接收者的应用发送通知
- 解决@功能 user_id 不匹配问题

**实现文件：**
- `src/config/feishu-apps.js`
- `src/api/feishu-notify-multi.js`

**验收标准：**
- [ ] 7 个成员应用配置完成
- [ ] @功能正常工作
- [ ] 蓝色@链接显示

---

### 5.6 任务看板增强 🟡

**优先级：** P1  
**预计工时：** 4 小时  
**负责人：** 匠心

**需求说明：**
- 任务筛选（优先级/状态/负责人）
- 任务搜索
- 批量操作
- 导出功能

**实现文件：**
- `public/bce-board.html`
- `src/api/board.js`

**验收标准：**
- [ ] 支持多条件筛选
- [ ] 支持关键词搜索
- [ ] 支持批量操作
- [ ] 支持导出 Excel

---

### 5.7 通知策略引擎 🟡

**优先级：** P1  
**预计工时：** 3 小时  
**负责人：** 匠心

**需求说明：**
- 安静时段设置
- 通知级别（info/warn/action-required）
- 通知渠道选择（飞书/邮件/短信）

**实现文件：**
- `src/services/notification-policy.js`

**验收标准：**
- [ ] 支持安静时段配置
- [ ] 支持通知级别
- [ ] 支持多渠道通知

---

### 5.8 任务统计报表 🟢

**优先级：** P2  
**预计工时：** 4 小时  
**负责人：** 匠心

**需求说明：**
- 完成率统计
- 工时统计
- 延期分析
- 团队负载

**实现文件：**
- `src/api/statistics.js`
- `public/statistics.html`

**验收标准：**
- [ ] 完成率统计图表
- [ ] 工时统计报表
- [ ] 延期分析
- [ ] 团队负载可视化

---

### 5.9 移动端适配 🟢

**优先级：** P2  
**预计工时：** 8 小时  
**负责人：** 匠心

**需求说明：**
- OCC 移动端适配
- 飞书小程序集成
- 响应式设计

**实现文件：**
- `public/mobile.html`
- 飞书小程序代码

**验收标准：**
- [ ] 手机端正常显示
- [ ] 飞书小程序可用
- [ ] 响应式设计

---

### 5.10 API 文档完善 🟢

**优先级：** P2  
**预计工时：** 2 小时  
**负责人：** 匠心

**需求说明：**
- OpenAPI 规范
- 在线文档
- SDK 生成

**实现文件：**
- `docs/api.yaml`
- `docs/api-docs.md`

**验收标准：**
- [ ] 完整的 OpenAPI 规范
- [ ] 在线 API 文档
- [ ] SDK 示例代码

---

## 6. 技术实现

### 6.1 技术栈

| 技术 | 说明 | 版本 |
|------|------|------|
| **Node.js** | 后端运行时 | v18+ |
| **Express.js** | Web 框架 | v4.x |
| **axios** | HTTP 客户端 | v1.x |
| **node-cron** | 定时任务 | v3.x |
| **飞书开放平台** | 消息通知 | - |
| **OpenClaw** | 会话管理 | - |

### 6.2 项目结构

```
BCE-Project/
├── src/
│   ├── api/                  # API 层
│   │   ├── bce-tasks.js      # 任务管理 API
│   │   ├── feishu-notify.js  # 飞书通知 API
│   │   ├── feishu-webhook.js # 飞书 Webhook ⏳
│   │   └── board.js          # 看板 API 🟡
│   ├── services/             # 服务层
│   │   ├── task-scanner.js   # 任务扫描服务 ❌
│   │   ├── notification-service.js # 通知服务
│   │   └── notification-policy.js  # 通知策略 🟡
│   ├── scheduler/            # 调度器
│   │   └── task-scheduler.js # 定时任务调度器 ❌
│   ├── integrations/         # 集成层
│   │   └── occ-sync.js       # OCC 同步服务 ❌
│   └── config/               # 配置
│       ├── feishu-users.js   # 飞书用户配置
│       ├── feishu-apps.js    # 飞书应用配置 🟡
│       └── team-members.js   # 团队成员配置
├── public/                   # 前端
│   ├── bce-board.html        # 任务看板
│   ├── bce-tasks.html        # 任务列表
│   └── statistics.html       # 统计页面 🟢
├── logs/                     # 日志
│   ├── scheduler.log
│   ├── scan-log.jsonl
│   └── occ-sync.log
├── runtime/                  # 运行时数据
│   └── bce-data.json
├── docs/                     # 文档
│   └── 功能说明书.md
├── test/                     # 测试
│   ├── test-all-members.js
│   └── test-task-interaction.js
├── .env                      # 环境配置
├── package.json              # 依赖管理
└── README.md                 # 项目说明
```

**图例：**
- ✅ 已完成
- ⏳ 部分完成
- ❌ 待开发（P0）
- 🟡 待开发（P1）
- 🟢 待开发（P2）

---

### 6.3 核心代码示例

#### 6.3.1 定时任务调度器

```javascript
// src/scheduler/task-scheduler.js

const cron = require('node-cron');
const TaskScanner = require('../services/task-scanner');
const NotificationService = require('../services/notification-service');

const TEAM_MEMBERS = [
  { name: '天枢', agentId: 'tianshu' },
  { name: '匠心', agentId: 'jiangxin' },
  { name: '司库', agentId: 'siku' },
  { name: '执矩', agentId: 'zhiju' },
  { name: '磐石', agentId: 'panshi' },
  { name: '灵犀', agentId: 'lingxi' },
  { name: '天策', agentId: 'tiance' }
];

class TaskScheduler {
  async init() {
    for (const member of TEAM_MEMBERS) {
      cron.schedule('*/5 * * * *', async () => {
        await this.runScan(member);
      });
    }
  }

  async runScan(member) {
    const scanner = new TaskScanner();
    const result = await scanner.scan(member.agentId);
    
    if (result.newTasks.length > 0) {
      const notifier = new NotificationService();
      await notifier.sendNotifications(result.newTasks, member);
    }
  }
}

module.exports = new TaskScheduler();
```

**状态：** ❌ 待开发

---

#### 6.3.2 OCC 同步服务

```javascript
// src/integrations/occ-sync.js

const axios = require('axios');

class OCCSyncService {
  constructor() {
    this.axios = axios.create({
      baseURL: 'http://192.168.31.187:4310',
      timeout: 10000
    });
  }

  async syncTask(bceTask) {
    const occTask = this.mapBceTaskToOcc(bceTask);
    await this.axios.post('/api/tasks', occTask);
  }

  mapBceTaskToOcc(bceTask) {
    return {
      projectId: 'bce-project',
      taskId: bceTask.id,
      title: bceTask.title,
      owner: bceTask.assignee,
      status: this.mapStatus(bceTask.status),
      dueAt: bceTask.deadline
    };
  }

  mapStatus(bceStatus) {
    const map = {
      'pending': 'todo',
      'in_progress': 'in-progress',
      'completed': 'done'
    };
    return map[bceStatus] || 'todo';
  }
}

module.exports = new OCCSyncService();
```

**状态：** ❌ 待开发

---

## 7. 部署说明

### 7.1 环境要求

| 要求 | 说明 |
|------|------|
| **Node.js** | v18 或更高版本 |
| **npm** | v8 或更高版本 |
| **OpenClaw** | 已安装并运行 |
| **OCC** | 已部署（http://192.168.31.187:4310） |
| **飞书应用** | 已创建并配置 |

### 7.2 安装步骤

```bash
# 1. 克隆项目
cd /Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库/BCE-Project

# 2. 安装依赖
npm install

# 3. 配置环境
cp .env.example .env
# 编辑 .env 文件，配置飞书凭证和 OCC 地址

# 4. 启动服务
node src/index.js

# 5. 验证服务
curl http://localhost:3000/health
```

### 7.3 环境配置

**文件：** `.env`

```bash
# OCC 配置
OCC_BASE_URL=http://192.168.31.187:4310
OCC_TIMEOUT=10000
OCC_RETRIES=3

# 定时任务配置
SCHEDULER_ENABLED=true
SCHEDULER_CRON=*/5 * * * *
SCHEDULER_TIMEZONE=Asia/Shanghai

# 飞书配置
FEISHU_APP_ID=cli_a9242655a1ba1cb1
FEISHU_APP_SECRET=EtioKZkhqwEWYOwiYaOvJfeNIUQMQnSU
FEISHU_CHAT_ID=oc_19be54b67684b6597ff335d7534896d4

# 日志配置
LOG_LEVEL=info
LOG_FILE=logs/scheduler.log
```

### 7.4 进程管理

**使用 PM2（推荐）：**
```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start src/index.js --name bce

# 查看状态
pm2 status

# 查看日志
pm2 logs bce

# 重启服务
pm2 restart bce

# 停止服务
pm2 stop bce
```

---

## 8. 使用指南

### 8.1 快速开始

#### 步骤 1：访问 OCC 协作页面

```
http://192.168.31.187:4310/?section=collaboration&lang=zh
```

#### 步骤 2：查看待确认任务

在协作页面查看跨会话消息和待确认任务。

#### 步骤 3：确认任务

点击 [确认接收] 按钮，填写备注（可选），提交。

#### 步骤 4：查看任务状态

访问任务页面查看任务看板和状态。

```
http://192.168.31.187:4310/?section=tasks&lang=zh
```

### 8.2 任务创建流程

```
1. 天枢通过 OpenClaw sessions_send 创建任务
   ↓
2. OCC 协作页面自动显示
   ↓
3. BCE 定时轮询扫描到任务
   ↓
4. BCE 发送飞书提醒
   ↓
5. 匠心在 OCC 页面确认任务
   ↓
6. 任务状态更新为 confirmed
```

### 8.3 任务流转流程

```
1. 匠心完成任务
   ↓
2. 调用任务转交 API
   ↓
3. 记录流转历史
   ↓
4. 通知司库（下一节点）
   ↓
5. 司库在 OCC 页面确认
   ↓
6. 任务继续流转到下一节点
```

### 8.4 常见问题

**Q1：收不到飞书通知？**
- 检查 BCE 服务是否运行
- 检查定时任务是否启动
- 查看日志 `logs/scheduler.log`

**Q2：OCC 页面不显示任务？**
- 检查 OCC 服务是否运行
- 检查 OCC 与 Gateway 连接
- 刷新页面或清除缓存

**Q3：任务确认失败？**
- 检查任务 ID 是否正确
- 检查 API 请求格式
- 查看 BCE 日志

---

## 附录

### A. API 接口列表

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/bce/tasks` | GET | 获取任务列表 |
| `/api/bce/tasks` | POST | 创建任务 |
| `/api/bce/tasks/:id` | GET | 获取任务详情 |
| `/api/bce/tasks/:id/status` | PUT | 更新任务状态 |
| `/api/bce/tasks/:id/confirm` | POST | 确认任务 |
| `/api/bce/tasks/:id/assign` | POST | 分配任务 |
| `/api/bce/tasks/:id/start` | POST | 开始任务 |
| `/api/bce/tasks/:id/submit` | POST | 提交验收 |
| `/api/bce/tasks/:id/accept` | POST | 验收通过 |
| `/api/bce/tasks/:id/cancel` | POST | 取消任务 |
| `/api/feishu-notify/notify/task` | POST | 发送飞书通知 |
| `/api/feishu/webhook` | POST | 飞书 Webhook |

### B. 文档索引

| 文档 | 位置 |
|------|------|
| 完整任务管理方案 | `docs/完整任务管理方案.md` |
| 技术实施细节 | `docs/技术实施细节 - 定时任务与系统交互.md` |
| BCE+OCC 融合方案 | `docs/BCE+OCC 最终融合方案.md` |
| 定时任务轮询方案 | `docs/BCE 定时任务轮询方案.md` |

---

**文档版本：** v1.0  
**最后更新：** 2026-03-21 09:25  
**维护人：** 匠心 (CTO)
