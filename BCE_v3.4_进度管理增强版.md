# BCE v3.4 进度管理与权限升级说明

**版本：** v3.4 进度管理增强版  
**日期：** 2026-03-22 22:25  
**设计人：** 匠心 (CTO)  
**批准人：** 磊哥 (CEO)

---

## 📋 版本概述

### 核心升级

v3.4 版本针对 v3.3 的**进度追踪缺失**和**管理者权限不足**问题进行重大升级：

| 功能 | v3.3 | v3.4 |
|------|------|------|
| 进度追踪 | ❌ 只有状态，无进度 | ✅ 强制 30 分钟进度反馈 |
| 进度汇报 | ❌ 依赖自觉 | ✅ 1.5 小时标准化模板 |
| 管理者权限 | ❌ 无 | ✅ 实质性管理权力 |
| 预警机制 | ❌ 仅确认超时 | ✅ 进度滞后自动升级 |
| 绩效绑定 | ❌ 无 | ✅ 自动计分 |

---

## 🎯 功能一：强制进度反馈（30 分钟 + 弹性例外）

### 功能说明

**执行者确认任务后，系统强制每 30 分钟反馈一次进度百分比，支持弹性例外。**

### 弹性例外机制（v3.4.1 新增）

| 例外类型 | 延时时长 | 使用限制 | 审批要求 |
|----------|----------|----------|----------|
| 会议中 | +1 小时 | 无限制 | 无需审批 |
| 专注中 | +2 小时 | 1 次/天 | 无需审批 |
| 稍后确认 | +30 分钟 | 1 次/任务 | 无需审批 |
| 需要沟通 | 暂停计时 | 无限制 | 管理者介入 |
| 申请转交 | 暂停计时 | 无限制 | 管理者审批 |

---

### 技术实现

#### 0. 弹性确认机制（v3.4.1 新增）

```javascript
// 配置常量
const CONFIRM_RULES = {
  standardTime: 30,           // 标准确认时间：30 分钟
  autoExtensions: {           // 自主延期（无需审批）
    'meeting': 60,            // 会议中：+1 小时
    'deepWork': 120,          // 专注中：+2 小时
    'later': 30               // 稍后：+30 分钟
  },
  dailyLimits: {
    'deepWork': 1             // 专注中：限 1 次/天
  },
  taskLimits: {
    'later': 1                // 稍后：限 1 次/任务
  },
  requiresApproval: {         // 需要审批
    'reassign': true          // 转交任务
  }
};
```

#### 1. 任务数据结构升级

```javascript
{
  "id": "task-001",
  "title": "🚀 北斗智投系统 - 智能决策模块",
  "assignee": "匠心",
  "status": "executing",
  "priority": "P0",
  "deadline": "2026-03-22T17:00:00Z",
  "confirmedAt": null,            // 确认时间（null=未确认）
  
  // ===== v3.4.1 弹性确认机制 =====
  "confirmStatus": "pending",     // pending/confirmed/meeting/deepWork/later/needComm/reassign
  "confirmDueAt": "2026-03-22T14:00:00Z",  // 确认截止时间（可延期）
  "autoExtensions": {             // 已使用的自主延期
    'meeting': 0,
    'deepWork': 0,
    'later': 0
  },
  
  // ===== 进度追踪字段 =====
  "progressPercent": 60,
  "progressUpdatedAt": "2026-03-22T14:30:00Z",
  "completedWork": "数据采集模块、数据清洗模块",
  "remainingWork": "三维分析、建议生成",
  "estimatedComplete": "2026-03-22T23:00:00Z",
  "blockers": [],
  "missedUpdates": 0,
  "progressAlerted": false,
}
```

---

#### 2. 进度更新 API

```javascript
// 执行者更新进度
POST /api/bce/tasks/:id/progress

// Request
{
  "percent": 60,
  "completed": "数据采集模块、数据清洗模块",
  "remaining": "三维分析、建议生成",
  "estimate": "2026-03-22 23:00",
  "blockers": "无"
}

// Response
{
  "success": true,
  "message": "进度更新成功",
  "data": {
    "taskId": "task-001",
    "progressPercent": 60,
    "progressUpdatedAt": "2026-03-22T14:30:00Z",
    "nextUpdateDue": "2026-03-22T15:00:00Z"
  }
}
```

---

#### 3. 定时检查任务

```javascript
// 每 5 分钟执行一次（与现有轮询集成）
function checkProgressUpdates() {
  const executingTasks = getExecutingTasks();
  const now = new Date();
  
  executingTasks.forEach(task => {
    const lastUpdate = new Date(task.progressUpdatedAt);
    const minutesSinceUpdate = (now - lastUpdate) / 1000 / 60;
    
    // 超过 30 分钟未更新
    if (minutesSinceUpdate > 30 && !task.progressAlerted) {
      alertExecutor(task);  // 提醒执行者
      task.progressAlerted = true;
      task.missedUpdates += 1;
    }
    
    // 超过 1 小时未更新
    if (minutesSinceUpdate > 60 && !task.managerAlerted) {
      alertManager(task);   // 通知管理者
      task.managerAlerted = true;
    }
    
    // 超过 2 小时未更新
    if (minutesSinceUpdate > 120 && !task.ceoAlerted) {
      alertCEO(task);       // 上报 CEO
      task.ceoAlerted = true;
      task.riskLevel = "high";
    }
  });
}
```

---

#### 4. 预警升级流程

```
┌─────────────────────────────────────────────────────────┐
│  进度超时预警流程                                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  0'          30'          60'          120'            │
│  │            │            │             │              │
│  │            ▼            ▼             ▼              │
│  │        提醒执行者   通知管理者    上报 CEO          │
│  │            │            │             │              │
│  │            │            │             │              │
│  │        记录 missed   建议介入      标记风险        │
│  │        update=1      帮助/重分配   计入绩效        │
│  │                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### 用户操作流程

#### 执行者 - 任务确认流程（v3.4.1 弹性版）

```
1. 收到任务分配通知（三通道）
   ↓
2. 30 分钟内必须操作，可选：
   
   ✅ 确认接收 → 进入执行阶段
   ⏸️  会议中 → 自动延时 1 小时（无需审批）
   🧘 专注中 → 自动延时 2 小时（限 1 次/天）
   ⏰ 稍后确认 → 延时 30 分钟（限 1 次/任务）
   ❓ 需要沟通 → 立即通知管理者解答
   🔄 申请转交 → 管理者审批（说明原因）
   
   ↓
3. 如果 30 分钟内无任何操作
   ↓
4. 系统提醒执行者（飞书）
   ↓
5. 如果 60 分钟仍无操作
   ↓
6. 通知管理者（建议介入）
   ↓
7. 如果 120 分钟仍无操作
   ↓
8. 上报 CEO（标记高风险）
```

#### 执行者 - 进度更新流程

```
1. 收到进度更新提醒（飞书）
   ↓
2. 点击提醒链接进入更新页面
   ↓
3. 填写进度信息：
   - 完成百分比：60%
   - 已完成：数据采集模块
   - 剩余工作：三维分析
   - 预计完成：今日 23:00
   - 风险/阻塞：无
   ↓
4. 提交
   ↓
5. 系统记录并重置计时器
```

---

## 📊 功能二：标准化进度汇报（1.5 小时）

### 功能说明

**每 1.5 小时向所有执行者推送标准化汇报模板，要求按格式回复。**

---

### 汇报模板

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

✅ 预计完成：2026-03-22 23:00

✅ 风险/阻塞：无

━━━━━━━━━━━━━━━━━━━━

[立即更新] [稍后提醒]
```

---

### 推送时间表

| 时间 | 推送对象 | 内容 |
|------|---------|------|
| 09:00 | 全体执行者 | 早间进度汇报 |
| 10:30 | 全体执行者 | 定时进度汇报 |
| 12:00 | 全体执行者 | 午间进度汇报 |
| 13:30 | 全体执行者 | 定时进度汇报 |
| 15:00 | 全体执行者 | 定时进度汇报 |
| 16:30 | 全体执行者 | 定时进度汇报 |
| 18:00 | 全体执行者 | 晚间进度汇报 |
| 19:30 | 全体执行者 | 最终进度汇报 |

---

### 技术实现

```javascript
// 定时推送（每 1.5 小时）
const REPORT_SCHEDULE = [
  { time: '09:00', type: 'morning' },
  { time: '10:30', type: 'regular' },
  { time: '12:00', type: 'noon' },
  { time: '13:30', type: 'regular' },
  { time: '15:00', type: 'regular' },
  { time: '16:30', type: 'regular' },
  { time: '18:00', type: 'evening' },
  { time: '19:30', type: 'final' },
];

function sendProgressReport() {
  const executingTasks = getExecutingTasks();
  
  executingTasks.forEach(task => {
    const message = buildReportTemplate(task);
    notifyExecutor(task.assignee, message);
  });
}

function buildReportTemplate(task) {
  return `
📋 进度汇报

任务：${task.title}
负责人：${task.assignee}
截止时间：${formatDate(task.deadline)}
当前状态：${task.status}

━━━━━━━━━━━━━━━━━━━━

✅ 完成百分比：${task.progressPercent}%

✅ 已完成：
${task.completedWork.split('\n').map(w => `   - ${w}`).join('\n')}

✅ 剩余工作：
${task.remainingWork.split('\n').map(w => `   - ${w}`).join('\n')}

✅ 预计完成：${formatDate(task.estimatedComplete)}

✅ 风险/阻塞：${task.blockers.join(', ') || '无'}

━━━━━━━━━━━━━━━━━━━━
  `;
}
```

---

## 👑 功能三：管理者权限系统

### 角色定义

```javascript
roles: {
  // ===== 执行者 =====
  'executor': {
    name: '执行者',
    description: '任务执行人员',
    permissions: [
      'view_own_tasks',
      'update_own_progress',
      'submit_task',
      'request_help'
    ]
  },
  
  // ===== 管理者（新增）=====
  'manager': {
    name: '管理者',
    description: '项目发起人/CEO 指定负责人',
    permissions: [
      // 查看权限
      'view_all_project_tasks',
      'view_progress_dashboard',
      'view_performance',
      
      // 调整权限
      'reassign_tasks',
      'adjust_priority',
      'adjust_deadline',
      'split_merge_tasks',
      'pause_resume_tasks',
      
      // 干预权限
      'demand_update',
      'mark_risk',
      'escalate_to_ceo',
      'initiate_review'
    ]
  },
  
  // ===== CEO =====
  'ceo': {
    name: 'CEO',
    description: '最终决策者',
    permissions: ['all']
  },
  
  // ===== 验收人 =====
  'reviewer': {
    name: '验收人',
    description: '项目负责人验收',
    permissions: [
      'view_assigned_tasks',
      'submit_acceptance'
    ]
  },
  
  // ===== 审核人 =====
  'auditor': {
    name: '审核人',
    description: '代码合规审核（执矩）',
    permissions: [
      'view_tasks_for_audit',
      'audit_pass',
      'audit_reject'
    ]
  }
}
```

---

### 管理者实质性权力

#### 1. 任务重新分配

```javascript
// API: 重新分配任务
POST /api/bce/tasks/:id/reassign

// Request
{
  "newAssignee": "磐石",
  "reason": "原执行者进度滞后，预计无法按时交付",
  "handover": "请保留已完成的数据采集代码"
}

// 系统自动执行：
// 1. 通知原执行者（任务已重新分配）
// 2. 通知新执行者（新任务分配）
// 3. 记录绩效影响（原执行者 -15 分）
// 4. 更新任务历史

// Response
{
  "success": true,
  "message": "任务已重新分配",
  "data": {
    "taskId": "task-001",
    "oldAssignee": "匠心",
    "newAssignee": "磐石",
    "performanceImpact": -15,
    "notified": ["匠心", "磐石", "天枢"]
  }
}
```

---

#### 2. 优先级调整

```javascript
// API: 调整优先级
POST /api/bce/tasks/:id/priority

// Request
{
  "priority": "P0",
  "reason": "CEO 要求优先交付",
  "deadline": "2026-03-22 23:00"
}

// 系统自动执行：
// 1. 更新任务优先级
// 2. 通知执行者（优先级变更）
// 3. 调整预警阈值（P0 任务 30 分钟未更新即上报）
```

---

#### 3. 截止时间调整

```javascript
// API: 调整截止时间
POST /api/bce/tasks/:id/deadline

// Request
{
  "deadline": "2026-03-22 23:00",
  "reason": "业务需求提前"
}

// 系统自动执行：
// 1. 更新截止时间
// 2. 重新计算进度要求
// 3. 通知执行者
```

---

#### 4. 强制要求汇报

```javascript
// API: 强制要求进度更新
POST /api/bce/tasks/:id/demand-update

// Request
{
  "urgency": "high",  // low, medium, high
  "message": "请立即更新进度，CEO 在等"
}

// 系统自动执行：
// 1. 立即推送给执行者（飞书 + 短信）
// 2. 如果 urgency=high，同时电话通知
// 3. 记录要求历史
```

---

#### 5. 标记风险任务

```javascript
// API: 标记风险
POST /api/bce/tasks/:id/mark-risk

// Request
{
  "level": "high",  // low, medium, high
  "reason": "进度滞后 50%，预计延期 2 小时",
  "action": "已安排磐石协助"
}

// 系统自动执行：
// 1. 更新任务风险等级
// 2. 在仪表盘高亮显示
// 3. 通知 CEO
// 4. 记录管理干预
```

---

#### 6. 上报 CEO

```javascript
// API: 上报 CEO
POST /api/bce/tasks/:id/escalate

// Request
{
  "reason": "任务严重滞后，需要 CEO 决策",
  "suggestions": [
    "延期交付",
    "增加人手",
    "削减功能"
  ],
  "impact": "影响北斗智投整体上线"
}

// 系统自动执行：
// 1. 发送详细报告给 CEO
// 2. 包含任务历史、进度曲线、影响分析
// 3. 等待 CEO 决策
```

---

### 管理者仪表盘

```
┌─────────────────────────────────────────────────────────┐
│  项目管理仪表盘 - 北斗智投系统                           │
│  管理者：司库 | 更新时间：2026-03-22 22:30              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  整体进度                                               │
│  ████████████████████░░░░░░ 60%                         │
│  预计完成：2026-03-22 23:00 (可能延期⚠️)                │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  任务状态                                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ✅ 财务知识库                                          │
│     司库 | 80% | 正常                                   │
│     已完成：知识库搭建、数据接入                        │
│     剩余：数据验证                                      │
│     [查看详情] [标记风险]                               │
│                                                         │
│  ⚠️ 数据感知模块                                        │
│     磐石 | 30% | 风险 - 进度滞后                        │
│     已完成：数据采集                                    │
│     剩余：数据清洗、数据感知                            │
│     [查看详情] [重新分配] [介入帮助]                    │
│                                                         │
│  🔴 iMessage 通知                                       │
│     磐石 | 20% | 严重滞后                              │
│     已完成：iMessage 配置                               │
│     剩余：通知集成、测试                                │
│     [查看详情] [重新分配] [上报 CEO]                    │
│                                                         │
│  ✅ 智能决策模块                                        │
│     匠心 | 70% | 正常                                   │
│     已完成：数据采集、三维分析                          │
│     剩余：建议生成                                      │
│     [查看详情] [标记风险]                               │
│                                                         │
│  ⚠️ 运维调度                                            │
│     磐石 | 40% | 风险 - 多任务并行                      │
│     已完成：调度框架                                    │
│     剩余：自动化脚本、测试                              │
│     [查看详情] [调整优先级] [介入帮助]                  │
│                                                         │
│  ✅ 可视化看板                                          │
│     匠心 | 75% | 正常                                   │
│     已完成：看板框架、数据展示                          │
│     剩余：交互优化                                      │
│     [查看详情] [标记风险]                               │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  建议操作                                               │
├─────────────────────────────────────────────────────────┤
│  📊 发起进度审查会议                                    │
│  👥 重新分配 iMessage 任务                              │
│  ⚠️  上报 CEO（2 个任务严重滞后）                       │
│  📈 查看绩效报告                                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📈 功能四：绩效绑定系统

### 绩效计算规则

```javascript
// 绩效计算公式
function calculatePerformance(task) {
  let score = 0;
  
  // 1. 准时性（基础分）
  if (task.completedAt <= task.deadline) {
    score += 10;  // 准时完成
    if (task.completedAt < task.deadline - 2_hours) {
      score += 10;  // 提前 2 小时以上
    }
  } else {
    score -= 10;  // 延期完成
    const hoursOverdue = Math.floor((task.completedAt - task.deadline) / 1_hour);
    score -= hoursOverdue * 5;  // 每延期 1 小时 -5 分
  }
  
  // 2. 进度汇报（过程分）
  score += task.progress_updates * 2;  // 每次主动汇报 +2 分
  score -= task.missed_updates * 5;    // 每次未汇报 -5 分
  
  // 3. 任务调整（影响分）
  if (task.reassigned) {
    score -= 15;  // 被重新分配 -15 分
  }
  
  // 4. 风险标记（风险分）
  if (task.riskLevel === 'high') {
    score -= 10;
  }
  
  // 5. 质量评分（验收分）
  if (task.qualityScore) {
    score += (task.qualityScore - 3) * 5;  // 5 分制，高于 3 分加分
  }
  
  return score;
}
```

---

### 绩效等级

| 分数 | 等级 | 说明 |
|------|------|------|
| ≥50 | S | 卓越表现 |
| 30-49 | A | 优秀表现 |
| 10-29 | B | 良好表现 |
| 0-9 | C | 需要改进 |
| <0 | D | 严重不达标 |

---

### 绩效应用

```javascript
// 绩效影响
{
  'S': {
    bonus: '奖金 +20%',
    priority: '优先分配重要任务',
    recognition: '月度优秀员工'
  },
  'A': {
    bonus: '奖金 +10%',
    priority: '优先选择任务'
  },
  'B': {
    bonus: '正常奖金',
    priority: '正常分配'
  },
  'C': {
    bonus: '奖金 -10%',
    warning: '口头警告',
    review: '绩效面谈'
  },
  'D': {
    bonus: '奖金 -30%',
    warning: '书面警告',
    review: '绩效改进计划',
    risk: '可能调岗'
  }
}
```

---

## 🔄 完整工作流程

### 任务生命周期

```
┌─────────────────────────────────────────────────────────┐
│  BCE v3.4 任务完整生命周期                               │
└─────────────────────────────────────────────────────────┘

1️⃣ 任务创建
   ↓
   创建人：天枢/管理者
   设置：标题、描述、负责人、截止时间、优先级
   ↓

2️⃣ 任务确认（30 分钟内）
   ↓
   执行者确认接收
   系统开始计时
   ↓

3️⃣ 进度反馈（每 30 分钟）
   ↓
   执行者更新进度百分比
   系统记录完成内容、剩余工作
   ↓

4️⃣ 标准化汇报（每 1.5 小时）
   ↓
   系统推送汇报模板
   执行者按格式回复
   ↓

5️⃣ 管理者监督（持续）
   ↓
   查看仪表盘
   识别风险任务
   介入帮助/重新分配
   ↓

6️⃣ 预警升级（自动）
   ↓
   30 分钟未更新 → 提醒执行者
   60 分钟未更新 → 通知管理者
   120 分钟未更新 → 上报 CEO
   ↓

7️⃣ 任务提交验收
   ↓
   执行者提交完成
   附上完成说明
   ↓

8️⃣ 验收审核
   ↓
   验收人：通过/驳回
   审核人：代码合规检查
   ↓

9️⃣ 任务完成
   ↓
   计算绩效分数
   记录历史
   ↓

🔟 绩效汇总（每周）
   ↓
   生成绩效报告
   发送 CEO/管理者
```

---

## 📋 API 文档

### 进度相关 API

```javascript
// 1. 更新进度
POST /api/bce/tasks/:id/progress
Body: {
  percent: number,
  completed: string,
  remaining: string,
  estimate: string,
  blockers: string[]
}

// 2. 获取任务进度历史
GET /api/bce/tasks/:id/progress-history
Response: {
  history: [
    { timestamp, percent, completed, remaining }
  ]
}

// 3. 批量获取项目进度
GET /api/bce/projects/:id/progress
Response: {
  tasks: [{ id, title, assignee, progressPercent, status }]
}
```

---

### 管理者 API

```javascript
// 1. 重新分配任务
POST /api/bce/tasks/:id/reassign
Body: { newAssignee, reason, handover }

// 2. 调整优先级
POST /api/bce/tasks/:id/priority
Body: { priority, reason }

// 3. 调整截止时间
POST /api/bce/tasks/:id/deadline
Body: { deadline, reason }

// 4. 强制要求汇报
POST /api/bce/tasks/:id/demand-update
Body: { urgency, message }

// 5. 标记风险
POST /api/bce/tasks/:id/mark-risk
Body: { level, reason, action }

// 6. 上报 CEO
POST /api/bce/tasks/:id/escalate
Body: { reason, suggestions, impact }

// 7. 获取管理仪表盘
GET /api/bce/projects/:id/dashboard
Response: {
  overview: { total, inProgress, atRisk, overdue },
  tasks: [...],
  suggestions: [...]
}
```

---

## 🚀 实施计划

### 第一阶段：核心功能（今晚完成）

| 任务 | 时间 | 负责人 |
|------|------|--------|
| 1. 进度更新 API | 30 分钟 | 匠心 |
| 2. 定时检查任务 | 30 分钟 | 匠心 |
| 3. 飞书通知集成 | 30 分钟 | 匠心 |
| 4. 测试验证 | 30 分钟 | 全体 |

### 第二阶段：管理者权限（明天完成）

| 任务 | 时间 | 负责人 |
|------|------|--------|
| 1. 角色权限系统 | 1 小时 | 匠心 |
| 2. 管理者 API | 2 小时 | 匠心 |
| 3. 管理仪表盘 | 2 小时 | 匠心 |
| 4. 测试验证 | 1 小时 | 全体 |

### 第三阶段：绩效系统（后天完成）

| 任务 | 时间 | 负责人 |
|------|------|--------|
| 1. 绩效计算逻辑 | 1 小时 | 匠心 |
| 2. 绩效报告生成 | 1 小时 | 匠心 |
| 3. 制度文档更新 | 1 小时 | 司库 |
| 4. 培训宣贯 | 1 小时 | 全体 |

---

## 📊 预期效果

### 改进对比

| 指标 | v3.3 | v3.4 目标 |
|------|------|----------|
| 进度可见性 | ❌ 黑盒 | ✅ 实时可见 |
| 延期预警 | ❌ 事后 | ✅ 事前 |
| 管理者介入 | ❌ 被动 | ✅ 主动 |
| 执行者自觉 | ❌ 依赖 | ✅ 系统强制 |
| 平均延期时间 | 4 小时+ | <1 小时 |

---

## 📝 使用说明

### 执行者

1. **确认任务后** → 立即设置第一个进度更新提醒
2. **每 30 分钟** → 更新进度百分比和完成内容
3. **收到汇报提醒** → 按模板格式回复
4. **遇到困难** → 立即标记风险，请求帮助

### 管理者

1. **每天早中晚** → 查看管理仪表盘
2. **发现风险任务** → 立即介入（帮助/重分配）
3. **收到预警** → 按级别采取行动
4. **每周** → 查看绩效报告，优化任务分配

### CEO

1. **实时** → 查看项目整体进度
2. **收到上报** → 快速决策
3. **每周** → 查看绩效汇总

---

## 🎯 核心原则

1. **进度透明** - 所有任务进度实时可见
2. **强制反馈** - 系统强制，不依赖自觉
3. **实质权力** - 管理者有真正的干预权力
4. **自动升级** - 预警自动升级，不依赖人工
5. **绩效绑定** - 进度直接计入绩效

---

**版本：** v3.4  
**创建时间：** 2026-03-22 22:25  
**维护人：** 匠心 (CTO)  
**批准人：** 磊哥 (CEO)
