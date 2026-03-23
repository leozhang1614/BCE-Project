# BCE v3.4 进度管理增强版 - 完整项目说明

**版本：** v3.4.0  
**发布日期：** 2026-03-23  
**设计人：** 匠心 (CTO)  
**批准人：** 磊哥 (CEO)  
**状态：** ✅ 开发完成

---

## 📋 目录

1. [版本概述](#版本概述)
2. [核心功能](#核心功能)
3. [技术架构](#技术架构)
4. [API 文档](#api 文档)
5. [部署指南](#部署指南)
6. [配置说明](#配置说明)
7. [测试验证](#测试验证)
8. [故障排查](#故障排查)

---

## 版本概述

### 升级背景

BCE v3.3 版本上线后，发现以下问题：

1. **进度追踪缺失** - 只有任务状态，无具体进度百分比
2. **依赖自觉汇报** - 执行者不主动更新进度
3. **管理者无权限** - 无法干预任务执行过程
4. **延期发现滞后** - 到期才发现未完成

### v3.4 核心改进

| 功能 | v3.3 | v3.4 | 改进 |
|------|------|------|------|
| 进度追踪 | ❌ 只有状态 | ✅ 强制 30 分钟反馈 | 实时可见 |
| 进度汇报 | ❌ 依赖自觉 | ✅ 1.5 小时标准化模板 | 系统强制 |
| 管理者权限 | ❌ 无 | ✅ 实质性管理权力 | 主动干预 |
| 预警机制 | ❌ 仅确认超时 | ✅ 进度滞后自动升级 | 事前预警 |
| 绩效绑定 | ❌ 无 | ✅ 自动计分 | 激励约束 |

---

## 核心功能

### 1️⃣ 智能进度反馈（分优先级 + 深度工作保护）

**功能说明：**
根据任务优先级自动调整更新频率，支持深度工作保护期，避免频繁打断。

**分优先级更新间隔：**

| 优先级 | 说明 | 更新间隔 | 预警升级（执行者/管理者/CEO） |
|--------|------|----------|-------------------------------|
| P0 | 紧急任务 | 30 分钟 | 30'/60'/120' |
| P1 | 常规任务 | 90 分钟 | 90'/180'/360' |
| P2 | 调研/设计 | 180 分钟 | 180'/360'/720' |

**技术实现：**

```javascript
// 任务数据结构（v3.4.1 深度工作保护版）
{
  "id": "task-001",
  "priority": "P1",                // 优先级决定更新频率
  "progressPercent": 60,
  "progressUpdatedAt": "2026-03-23T14:30:00Z",
  "completedWork": "数据采集模块、数据清洗模块",
  "remainingWork": "三维分析、建议生成",
  "estimatedComplete": "2026-03-23T23:00:00Z",
  "blockers": [],
  
  // 深度工作保护（新增）
  "deepWorkMode": false,           // 是否处于深度工作模式
  "deepWorkStartAt": null,         // 深度工作开始时间
  "deepWorkEndAt": null,           // 深度工作结束时间
  "deepWorkLog": null,             // 深度工作日志
  "deepWorkLogSubmitted": false,   // 是否已提交日志
}
```

**预警升级流程（基于优先级）：**

```
P0 紧急任务：
  0' → 任务确认
       ↓
  30' → 提醒执行者
       ↓
  60' → 通知管理者
       ↓
  120' → 上报 CEO

P1 常规任务：
  0' → 任务确认
       ↓
  90' → 提醒执行者
       ↓
  180' → 通知管理者
       ↓
  360' → 上报 CEO

P2 调研/设计：
  0' → 任务确认
       ↓
  180' → 提醒执行者
       ↓
  360' → 通知管理者
       ↓
  720' → 上报 CEO
```

**深度工作保护期：**

```
员工标记"深度工作中" → 选择时长（2-4 小时）→ 系统暂停预警
                                              ↓
                                    结束后提交详细日志
                                              ↓
                                    系统恢复预警
```

**API 接口：**

```bash
# 更新进度
POST /api/bce/progress/:id
{
  "percent": 60,
  "completed": "数据采集模块",
  "remaining": "三维分析",
  "estimate": "2026-03-23 23:00",
  "blockers": "无"
}
```

---

### 2️⃣ 标准化进度汇报（1.5 小时周期）

**功能说明：**
每 1.5 小时向所有执行者推送标准化汇报模板，要求按格式回复。

**汇报模板：**

```
📋 进度汇报

任务：{task_title}
负责人：{assignee}
截止时间：{deadline}
当前状态：{status}

━━━━━━━━━━━━━━━━━━━━

✅ 完成百分比：60%

✅ 已完成：
   - 数据采集模块
   - 数据清洗模块

✅ 剩余工作：
   - 三维分析
   - 建议生成

✅ 预计完成：2026-03-23 23:00

✅ 风险/阻塞：无

━━━━━━━━━━━━━━━━━━━━

[立即更新] [稍后提醒]
```

**推送时间表：**

| 时间 | 类型 | 说明 |
|------|------|------|
| 09:00 | morning | 早间进度汇报 |
| 10:30 | regular | 定时进度汇报 |
| 12:00 | noon | 午间进度汇报 |
| 13:30 | regular | 定时进度汇报 |
| 15:00 | regular | 定时进度汇报 |
| 16:30 | regular | 定时进度汇报 |
| 18:00 | evening | 晚间进度汇报 |
| 19:30 | final | 最终进度汇报 |

---

### 3️⃣ 管理者权限系统

**角色定义：**

```javascript
roles: {
  'executor': {
    name: '执行者',
    permissions: ['view_own_tasks', 'update_own_progress', ...]
  },
  
  'manager': {
    name: '管理者',
    permissions: [
      // 查看权限
      'view_all_project_tasks',
      'view_progress_dashboard',
      'view_performance',
      
      // 调整权限
      'reassign_tasks',
      'adjust_priority',
      'adjust_deadline',
      
      // 干预权限
      'demand_update',
      'mark_risk',
      'escalate_to_ceo'
    ]
  },
  
  'ceo': {
    name: 'CEO',
    permissions: ['all']
  }
}
```

**管理者实质性权力：**

#### 1. 任务重新分配

```bash
POST /api/bce/manager/:id/reassign
{
  "newAssignee": "磐石",
  "reason": "原执行者进度滞后",
  "handover": "请保留已完成代码"
}
```

**效果：**
- 立即通知原执行者（绩效 -15 分）
- 通知新执行者（新任务分配）
- 通知 CEO（备案）

#### 2. 优先级调整

```bash
POST /api/bce/manager/:id/priority
{
  "priority": "P0",
  "reason": "CEO 要求优先交付"
}
```

**效果：**
- 更新任务优先级
- 通知执行者优先处理
- P0 任务 30 分钟未更新即上报

#### 3. 截止时间调整

```bash
POST /api/bce/manager/:id/deadline
{
  "deadline": "2026-03-23 23:00",
  "reason": "业务需求提前"
}
```

**效果：**
- 更新截止时间
- 重新计算进度要求
- 通知执行者调整计划

#### 4. 强制要求汇报

```bash
POST /api/bce/manager/:id/demand-update
{
  "urgency": "high",
  "message": "请立即更新进度，CEO 在等"
}
```

**效果：**
- 立即推送给执行者（飞书 + 短信）
- 高紧急度同时电话通知
- 记录要求历史

#### 5. 标记风险任务

```bash
POST /api/bce/manager/:id/mark-risk
{
  "level": "high",
  "reason": "进度滞后 50%",
  "action": "已安排磐石协助"
}
```

**效果：**
- 更新任务风险等级
- 仪表盘高亮显示
- 通知 CEO

#### 6. 上报 CEO

```bash
POST /api/bce/manager/:id/escalate
{
  "reason": "任务严重滞后",
  "suggestions": ["延期交付", "增加人手", "削减功能"],
  "impact": "影响整体上线"
}
```

**效果：**
- 发送详细报告给 CEO
- 包含任务历史、进度曲线
- 等待 CEO 决策

---

### 4️⃣ 管理仪表盘

**功能说明：**
实时查看所有任务进度，识别风险，快速决策。

**仪表盘数据：**

```json
{
  "overview": {
    "total": 10,
    "inProgress": 6,
    "atRisk": 2,
    "overdue": 1,
    "averageProgress": 60
  },
  "tasks": [
    {
      "id": "task-001",
      "title": "财务知识库",
      "assignee": "司库",
      "progressPercent": 80,
      "status": "executing",
      "riskLevel": "normal"
    },
    {
      "id": "task-002",
      "title": "数据感知模块",
      "assignee": "磐石",
      "progressPercent": 30,
      "status": "executing",
      "riskLevel": "high"
    }
  ],
  "suggestions": [
    {
      "type": "review",
      "label": "发起进度审查会议（2 个风险任务）",
      "priority": "high"
    }
  ]
}
```

**API 接口：**

```bash
# 获取项目仪表盘
GET /api/bce/manager/dashboard/:projectId

# 获取全部仪表盘
GET /api/bce/manager/dashboard
```

---

### 5️⃣ 绩效绑定系统

**绩效计算规则：**

```javascript
function calculatePerformance(task) {
  let score = 0;
  
  // 1. 准时性（基础分）
  if (completed <= deadline) {
    score += 10;  // 准时完成
    if (hoursEarly >= 2) score += 10;  // 提前 2 小时+
  } else {
    score -= 10;  // 延期
    score -= hoursOverdue * 5;  // 每小时 -5 分
  }
  
  // 2. 进度汇报（过程分）
  score += progress_updates * 2;  // 每次 +2 分
  score -= missed_updates * 5;    // 每次 -5 分
  
  // 3. 任务调整（影响分）
  if (reassigned) score -= 15;  // 被重新分配 -15 分
  
  // 4. 风险标记（风险分）
  if (riskLevel === 'high') score -= 10;
  
  // 5. 质量评分（验收分）
  score += (qualityScore - 3) * 5;  // 5 分制
  
  return score;
}
```

**绩效等级：**

| 分数 | 等级 | 说明 | 奖金系数 |
|------|------|------|----------|
| ≥50 | S | 卓越表现 | 1.2 |
| 30-49 | A | 优秀表现 | 1.1 |
| 10-29 | B | 良好表现 | 1.0 |
| 0-9 | C | 需要改进 | 0.9 |
| <0 | D | 严重不达标 | 0.7 |

**API 接口：**

```bash
# 获取个人绩效
GET /api/bce/progress/performance/:assignee
```

---

## 技术架构

### 文件结构

```
BCE-Project/
├── src/
│   ├── api/
│   │   ├── bce-tasks.js          # 任务管理 API
│   │   ├── bce-progress.js       # v3.4 进度管理 API ✨
│   │   ├── bce-manager.js        # v3.4 管理者权限 API ✨
│   │   ├── feishu-notify.js      # 飞书通知
│   │   └── ...
│   ├── services/
│   │   ├── progress-service.js   # v3.4 进度服务 ✨
│   │   ├── manager-service.js    # v3.4 管理者服务 ✨
│   │   ├── notification-service.js
│   │   ├── scheduler-v3.4.js     # v3.4 定时任务 ✨
│   │   └── ...
│   ├── middleware/
│   │   ├── auth.js
│   │   └── audit.js
│   └── index.js                  # 主入口（已更新 v3.4）
├── runtime/
│   └── bce-data.json             # 任务数据存储
├── docs/
│   └── BCE_v3.4_项目说明文档.md  # 本文档
└── package.json
```

### 数据模型

**任务数据结构（v3.4 增强版）：**

```javascript
{
  // 基础信息
  "id": "task-001",
  "title": "北斗智投系统 - 智能决策模块",
  "description": "...",
  "assignee": "匠心",
  "status": "executing",
  "priority": "P0",
  "dueDate": "2026-03-23T17:00:00Z",
  
  // v3.4 新增 - 进度管理
  "progressPercent": 60,
  "progressUpdatedAt": "2026-03-23T14:30:00Z",
  "completedWork": "数据采集模块、数据清洗模块",
  "remainingWork": "三维分析、建议生成",
  "estimatedComplete": "2026-03-23T23:00:00Z",
  "blockers": [],
  "progressHistory": [
    {
      "percent": 60,
      "completed": "数据采集模块",
      "remaining": "三维分析",
      "timestamp": "2026-03-23T14:30:00Z",
      "operator": "匠心"
    }
  ],
  
  // v3.4 新增 - 预警标记
  "missedUpdates": 0,
  "progressAlerted": false,
  "managerAlerted": false,
  "ceoAlerted": false,
  "riskLevel": "normal",
  
  // v3.4 新增 - 管理者操作
  "reassigned": false,
  "demandHistory": [],
  "escalationHistory": [],
  
  // v3.4 新增 - 绩效
  "performanceScore": 0,
  "qualityScore": 0,
  
  // 元数据
  "createdAt": "2026-03-23T13:00:00Z",
  "updatedAt": "2026-03-23T14:30:00Z"
}
```

### 定时任务

**调度器配置：**

```javascript
// scheduler-v3.4.js
{
  PROGRESS_CHECK_INTERVAL: 5 * 60 * 1000,   // 5 分钟检查进度
  REPORT_INTERVAL: 90 * 60 * 1000,          // 1.5 小时发送汇报
}
```

**启动方式：**

```bash
# 方式 1：作为独立进程
node src/services/scheduler-v3.4.js

# 方式 2：集成到主服务（推荐）
# 在 index.js 中启动
require('./services/scheduler-v3.4');
```

---

## API 文档

### 进度管理 API

#### 1. 更新进度

```http
POST /api/bce/progress/:id
Content-Type: application/json

{
  "percent": 60,
  "completed": "数据采集模块、数据清洗模块",
  "remaining": "三维分析、建议生成",
  "estimate": "2026-03-23 23:00",
  "blockers": "无",
  "operator": "匠心"
}
```

**响应：**

```json
{
  "success": true,
  "message": "进度更新成功",
  "data": {
    "taskId": "task-001",
    "progressPercent": 60,
    "progressUpdatedAt": "2026-03-23T14:30:00Z",
    "nextUpdateDue": "2026-03-23T15:00:00Z"
  }
}
```

#### 2. 获取进度历史

```http
GET /api/bce/progress/:id/history
```

**响应：**

```json
{
  "success": true,
  "data": {
    "taskId": "task-001",
    "currentProgress": 60,
    "history": [
      {
        "percent": 30,
        "timestamp": "2026-03-23T14:00:00Z"
      },
      {
        "percent": 60,
        "timestamp": "2026-03-23T14:30:00Z"
      }
    ],
    "lastUpdate": "2026-03-23T14:30:00Z",
    "nextUpdateDue": "2026-03-23T15:00:00Z"
  }
}
```

#### 3. 批量获取项目进度

```http
GET /api/bce/progress/project/:projectId
```

#### 4. 检查进度更新（定时调用）

```http
POST /api/bce/progress/check
```

#### 5. 发送标准化汇报（定时调用）

```http
POST /api/bce/progress/report
{
  "reportType": "regular"
}
```

#### 6. 获取绩效数据

```http
GET /api/bce/progress/performance/:assignee
```

---

### 管理者权限 API

#### 1. 重新分配任务

```http
POST /api/bce/manager/:id/reassign
{
  "newAssignee": "磐石",
  "reason": "原执行者进度滞后",
  "handover": "请保留已完成代码",
  "manager": "天枢"
}
```

#### 2. 调整优先级

```http
POST /api/bce/manager/:id/priority
{
  "priority": "P0",
  "reason": "CEO 要求优先交付",
  "manager": "天枢"
}
```

#### 3. 调整截止时间

```http
POST /api/bce/manager/:id/deadline
{
  "deadline": "2026-03-23 23:00",
  "reason": "业务需求提前",
  "manager": "天枢"
}
```

#### 4. 强制要求汇报

```http
POST /api/bce/manager/:id/demand-update
{
  "urgency": "high",
  "message": "请立即更新进度",
  "manager": "天枢"
}
```

#### 5. 标记风险

```http
POST /api/bce/manager/:id/mark-risk
{
  "level": "high",
  "reason": "进度滞后 50%",
  "action": "已安排协助",
  "manager": "天枢"
}
```

#### 6. 上报 CEO

```http
POST /api/bce/manager/:id/escalate
{
  "reason": "任务严重滞后",
  "suggestions": ["延期交付", "增加人手"],
  "impact": "影响整体上线",
  "manager": "天枢"
}
```

#### 7. 获取管理仪表盘

```http
GET /api/bce/manager/dashboard/:projectId
```

---

## 部署指南

### 前置条件

- Node.js >= 16.x
- npm >= 8.x
- BCE v3.3 基础环境

### 安装步骤

#### 1. 备份现有数据

```bash
cd ~/openclaw/workspace-jiangxin/匠心工作区/代码仓库/BCE-Project

# 备份 runtime 数据
cp runtime/bce-data.json runtime/bce-data.json.backup.$(date +%Y%m%d_%H%M%S)

# 备份代码（可选）
tar -czf BCE-v3.3-backup.tar.gz src/
```

#### 2. 部署新代码

```bash
# 复制新文件（已完成）
# src/api/bce-progress.js
# src/api/bce-manager.js
# src/services/progress-service.js
# src/services/manager-service.js
# src/services/scheduler-v3.4.js

# 更新主入口（已完成）
# src/index.js
```

#### 3. 安装依赖（如有新增）

```bash
npm install
```

#### 4. 启动服务

```bash
# 停止旧服务（如运行中）
# 找到进程 PID
lsof -i :3000

# 停止进程
kill <PID>

# 启动新服务
node src/index.js

# 或使用 PM2（推荐生产环境）
pm2 restart bce --name "bce-v3.4"
```

#### 5. 启动定时任务

```bash
# 方式 1：后台运行
nohup node src/services/scheduler-v3.4.js > logs/scheduler.log 2>&1 &

# 方式 2：PM2
pm2 start src/services/scheduler-v3.4.js --name "bce-scheduler"
```

#### 6. 验证部署

```bash
# 健康检查
curl http://localhost:3000/health

# 预期输出：
{
  "status": "ok",
  "service": "BCE v3.4 进度管理增强版",
  "version": "3.4.0",
  "features": {
    "progressTracking": "enabled",
    "managerPermissions": "enabled",
    "performanceSystem": "enabled"
  }
}
```

---

## 配置说明

### 环境变量

```bash
# .env 文件
PORT=3000
FEISHU_APP_ID=cli_a9242655a1ba1cb1
FEISHU_APP_SECRET=EtioKZkhqwEWYOwiYaOvJfeNIUQMQnSU
DEFAULT_CHAT_ID=oc_19be54b67684b6597ff335d7534896d4
```

### 进度管理配置

```javascript
// src/services/progress-service.js
const CONFIG = {
  PROGRESS_UPDATE_INTERVAL: 30,     // 30 分钟
  ALERT_EXECUTOR: 30,               // 30 分钟提醒执行者
  ALERT_MANAGER: 60,                // 60 分钟通知管理者
  ALERT_CEO: 120,                   // 120 分钟上报 CEO
  REPORT_INTERVAL: 90,              // 1.5 小时汇报
};
```

### 汇报时间表配置

```javascript
// src/services/progress-service.js
const REPORT_SCHEDULE = [
  { time: '09:00', type: 'morning', label: '早间' },
  { time: '10:30', type: 'regular', label: '定时' },
  { time: '12:00', type: 'noon', label: '午间' },
  { time: '13:30', type: 'regular', label: '定时' },
  { time: '15:00', type: 'regular', label: '定时' },
  { time: '16:30', type: 'regular', label: '定时' },
  { time: '18:00', type: 'evening', label: '晚间' },
  { time: '19:30', type: 'final', label: '最终' },
];
```

---

## 测试验证

### 1. 进度更新测试

```bash
# 创建测试任务
curl -X POST http://localhost:3000/api/bce/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "v3.4 测试任务",
    "description": "测试进度管理功能",
    "creator": "天枢",
    "assignee": "匠心",
    "priority": "P1",
    "dueDate": "2026-03-24T17:00:00Z"
  }'

# 更新进度
curl -X POST http://localhost:3000/api/bce/progress/<TASK_ID> \
  -H "Content-Type: application/json" \
  -d '{
    "percent": 50,
    "completed": "功能开发",
    "remaining": "测试验证",
    "estimate": "2026-03-24 17:00",
    "operator": "匠心"
  }'

# 查看进度历史
curl http://localhost:3000/api/bce/progress/<TASK_ID>/history
```

### 2. 管理者权限测试

```bash
# 重新分配任务
curl -X POST http://localhost:3000/api/bce/manager/<TASK_ID>/reassign \
  -H "Content-Type: application/json" \
  -d '{
    "newAssignee": "磐石",
    "reason": "测试重新分配",
    "handover": "保留代码",
    "manager": "天枢"
  }'

# 调整优先级
curl -X POST http://localhost:3000/api/bce/manager/<TASK_ID>/priority \
  -H "Content-Type: application/json" \
  -d '{
    "priority": "P0",
    "reason": "测试优先级调整",
    "manager": "天枢"
  }'
```

### 3. 仪表盘测试

```bash
# 获取管理仪表盘
curl http://localhost:3000/api/bce/manager/dashboard
```

### 4. 绩效测试

```bash
# 获取个人绩效
curl http://localhost:3000/api/bce/progress/performance/匠心
```

---

## 故障排查

### 常见问题

#### 1. 进度更新失败

**现象：** API 返回 400 错误

**原因：** 参数格式错误

**解决：**
```bash
# 检查 percent 是否为 0-100 的数字
# 检查 completed/remaining 是否为字符串
```

#### 2. 通知未发送

**现象：** 执行者未收到飞书通知

**原因：** 飞书服务未启动或配置错误

**解决：**
```bash
# 检查飞书通知服务
curl http://localhost:3000/api/feishu-notify/health

# 检查 .env 配置
cat .env | grep FEISHU
```

#### 3. 定时任务未执行

**现象：** 没有自动检查进度

**原因：** scheduler-v3.4.js 未启动

**解决：**
```bash
# 检查进程
ps aux | grep scheduler

# 启动定时任务
node src/services/scheduler-v3.4.js
```

#### 4. 数据未持久化

**现象：** 重启后进度丢失

**原因：** runtime/bce-data.json 未保存

**解决：**
```bash
# 检查文件权限
ls -la runtime/bce-data.json

# 手动保存
curl http://localhost:3000/api/bce/tasks/save
```

---

## 升级说明

### 从 v3.3 升级到 v3.4

1. **数据迁移** - 现有任务自动初始化进度字段
2. **向后兼容** - v3.3 API 继续可用
3. **无停机升级** - 可热部署

### 回退方案

如需回退到 v3.3：

```bash
# 停止服务
kill <PID>

# 恢复备份
cp runtime/bce-data.json.backup.* runtime/bce-data.json

# 恢复代码
git checkout v3.3

# 重启服务
node src/index.js
```

---

## 性能优化

### 建议配置

1. **生产环境使用 PM2**
   ```bash
   pm2 start src/index.js --name bce -i max
   pm2 start src/services/scheduler-v3.4.js --name bce-scheduler
   ```

2. **数据库优化**（任务量大时）
   - 迁移到 PostgreSQL
   - 添加索引

3. **通知优化**
   - 批量发送通知
   - 使用消息队列

---

## 安全建议

1. **权限验证** - 生产环境启用 JWT
2. **速率限制** - 防止 API 滥用
3. **审计日志** - 记录所有管理者操作
4. **数据备份** - 定期备份 runtime 数据

---

## 联系支持

**技术负责人：** 匠心 (CTO)  
**反馈渠道：** 飞书群 - 北斗公司技术研发中心  
**文档维护：** 自动更新（任务完成后同步）

---

**版本：** v3.4.0  
**创建时间：** 2026-03-23 11:50  
**最后更新：** 2026-03-23 12:30  
**状态：** ✅ 开发完成
