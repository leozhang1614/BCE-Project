# BCE v3.4 进度管理增强版 - 完整技术方案

**版本：** v3.4  
**创建日期：** 2026-03-22  
**优化日期：** 2026-03-23  
**技术负责人：** 匠心 (CTO)  
**状态：** 🟡 待批准

---

## 📋 目录

1. [版本概述](#1-版本概述)
2. [核心原则](#2-核心原则)
3. [功能详细设计](#3-功能详细设计)
4. [技术架构](#4-技术架构)
5. [数据库设计](#5-数据库设计)
6. [API 接口设计](#6-api 接口设计)
7. [管理仪表盘](#7-管理仪表盘)
8. [实施计划](#8-实施计划)
9. [风险与应对](#9-风险与应对)
10. [验收标准](#10-验收标准)

---

## 1. 版本概述

### 1.1 背景

基于磊哥提出的核心需求，BCE v3.4 聚焦于**进度透明化**和**管理人性化**，解决以下痛点：

**痛点分析：**
- ❌ 进度不透明 - 管理者无法实时了解任务状态
- ❌ 反馈不及时 - 执行者忘记主动汇报
- ❌ 催促无意义 - 提醒多但无实质性跟进手段
- ❌ 责任不明确 - 延期后无追溯机制

### 1.2 核心目标

| 目标 | 描述 | 衡量指标 |
|------|------|----------|
| 透明可控 | 所有任务进度实时可见 | 100% 任务可追踪 |
| 人性化 | 减少无效催促，增加实质支持 | 提醒减少 50% |
| 自动化 | 定时反馈，减少人工干预 | 自动汇报率 100% |
| 可追溯 | 所有操作有记录可查 | 审计日志完整率 100% |

### 1.3 版本对比

| 功能 | v3.3 | v3.4 | 改进 |
|------|------|------|------|
| 进度反馈 | 手动 | 自动 30 分钟 | ✅ 强制 |
| 汇报模板 | 无 | 标准化 1.5 小时 | ✅ 统一 |
| 管理者权限 | 基础 | 实质性权力 | ✅ 增强 |
| 绩效绑定 | 无 | 积分系统 | ✅ 新增 |
| 风险预警 | 基础 | 三级升级 | ✅ 完善 |

---

## 2. 核心原则

### 2.1 透明可控 × 人性化

**透明可控：**
- ✅ 所有任务进度实时可见
- ✅ 所有操作有审计日志
- ✅ 所有延期有追溯记录
- ✅ 所有风险有预警机制

**人性化：**
- ✅ 减少无效提醒，增加实质支持
- ✅ 自动反馈，减少人工记忆负担
- ✅ 绩效正向激励为主
- ✅ 风险提前预警，避免突然暴雷

### 2.2 设计哲学

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   自动化的归自动化（定时任务、自动汇报）              │
│   人性的归人性（决策、协调、支持）                    │
│                                                     │
│   让系统做系统擅长的事                                │
│   让人做人擅长的事                                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 3. 功能详细设计

### 3.1 强制进度反馈（30 分钟）

#### 3.1.1 触发机制

**启动条件：**
- 执行者确认接收任务（状态：🟢 进行中）
- 自动启动 30 分钟倒计时

**反馈内容：**
```
【进度反馈】任务 #123 - 数据采集模块
📊 完成百分比：45%
🔨 当前工作：API 接口开发
📍 下一步：前端对接
⏰ 剩余时间：4 小时 30 分
🟢 状态：正常
```

#### 3.1.2 超时升级机制

| 超时时长 | 通知对象 | 通知方式 | 升级级别 |
|----------|----------|----------|----------|
| 30 分钟 | 执行者 | 飞书消息 | L1 提醒 |
| 60 分钟 | 管理者 | 飞书消息 + @ | L2 警告 |
| 120 分钟 | CEO 天枢 | 飞书消息 + @ + 电话 | L3 严重 |

**升级逻辑：**
```javascript
if (timeout >= 120) {
  notify(CEO, level: 'L3_CRITICAL');
  notify(Manager, level: 'L3_CRITICAL');
  notify(Executor, level: 'L3_CRITICAL');
  markTaskRisk(taskId, 'HIGH');
} else if (timeout >= 60) {
  notify(Manager, level: 'L2_WARNING');
  notify(Executor, level: 'L2_WARNING');
} else if (timeout >= 30) {
  notify(Executor, level: 'L1_REMINDER');
}
```

#### 3.1.3 人性化设计

**免打扰时段：**
- 夜间模式：23:00 - 08:00（仅记录，不推送）
- 会议模式：执行者可手动开启（延迟推送）
- 专注模式：每 2 小时汇总一次（减少打断）

**补报机制：**
- 允许执行者补报进度（需说明原因）
- 补报不扣分，但记录在案
- 每月补报≤3 次不处罚

---

### 3.2 标准化进度汇报（1.5 小时）

#### 3.2.1 汇报模板

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【进度汇报】任务 #123 - 数据采集系统
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 完成百分比：60%

✅ 已完成：
   • 数据采集模块
   • API 接口开发
   • 单元测试

⏳ 剩余工作：
   • 三维分析模块
   • 建议生成模块
   • 集成测试

🕐 预计完成：今日 23:00
   • 剩余时间：4 小时 30 分
   • 风险等级：🟢 正常

⚠️ 风险/阻塞：无
   • 如需支持，请@管理者

👤 执行者：匠心
📈 本次积分：+2（按时汇报）
📊 累计积分：48 分（等级：B）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### 3.2.2 汇报频率

| 任务时长 | 汇报频率 | 说明 |
|----------|----------|------|
| < 2 小时 | 完成时汇报 | 短任务免打扰 |
| 2-8 小时 | 每 1.5 小时 | 标准频率 |
| 8-24 小时 | 每 1.5 小时 | 含夜间免打扰 |
| > 24 小时 | 每 1.5 小时 + 每日汇总 | 长任务特别关注 |

#### 3.2.3 智能汇总

**多任务汇总：**
- 执行者同时有多个任务时，自动合并汇报
- 按优先级排序
- 总进度百分比加权计算

**示例：**
```
【多任务汇报】匠心 - 2026-03-23 10:00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 整体进度：55%

任务 #123（高优先级）：60% - 数据采集系统
任务 #124（中优先级）：45% - 三维分析
任务 #125（低优先级）：30% - 文档编写

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### 3.3 管理者权限系统

#### 3.3.1 角色定义

| 角色 | 定义 | 产生方式 |
|------|------|----------|
| 执行者 | 任务承担者 | 任务分配时指定 |
| 管理者 | 项目发起人 | 任务创建者自动成为管理者 |
| CEO | 天枢 | 系统预设 |

#### 3.3.2 管理者实质性权力

**✅ 重新分配任务**
```
权力：可将任务从执行者 A 转给执行者 B
触发：执行者延期/能力不足/优先级调整
流程：
  1. 管理者发起重新分配
  2. 系统通知原执行者（-15 分）
  3. 系统通知新执行者（任务接收）
  4. 记录审计日志
绩效影响：
  - 原执行者：-15 分
  - 新执行者：接收任务，正常计分
```

**✅ 调整优先级**
```
权力：高/中/低优先级调整
影响：
  - 高优先级：汇报频率×2，提醒更频繁
  - 中优先级：标准频率
  - 低优先级：汇报频率÷2，减少打扰
绩效影响：无直接影响
```

**✅ 调整截止时间**
```
权力：延长或缩短任务 deadline
限制：
  - 延长：最多延长原 deadline 的 50%
  - 缩短：需执行者确认（可拒绝）
  - 超过限制：需 CEO 批准
绩效影响：
  - 延长：原绩效预期重新计算
  - 缩短：提前完成奖励×1.5
```

**✅ 强制汇报**
```
权力：随时要求执行者汇报进度
限制：每任务每日≤3 次（避免滥用）
流程：
  1. 管理者点击"强制汇报"
  2. 执行者收到飞书消息（高优先级）
  3. 执行者 10 分钟内回复进度
  4. 超时自动上报 CEO
绩效影响：
  - 按时回复：无影响
  - 超时回复：-5 分
```

**✅ 标记风险**
```
权力：将任务标记为🔴高风险
触发条件：
  - 执行者多次超时
  - 技术难度超出预期
  - 资源不足
影响：
  - CEO 自动收到通知
  - 任务在仪表盘高亮显示
  - 管理者需提交风险缓解方案
绩效影响：
  - 因个人原因：-10 分
  - 因客观原因：无影响
```

**✅ 上报 CEO**
```
权力：将严重问题上报天枢
触发条件：
  - 任务严重延期（>24 小时）
  - 执行者失联（>4 小时）
  - 需要跨部门协调
  - 需要额外资源
流程：
  1. 管理者提交上报申请
  2. 附带问题描述和建议方案
  3. CEO 收到通知并决策
  4. 记录审计日志
绩效影响：根据 CEO 决策确定
```

#### 3.3.3 权限验证

```javascript
// 权限验证中间件示例
async function verifyPermission(taskId, userId, action) {
  const task = await getTask(taskId);
  const user = await getUser(userId);
  
  // CEO 拥有全部权限
  if (user.role === 'CEO') {
    return true;
  }
  
  // 管理者拥有项目管理权限
  if (task.managerId === userId) {
    const managerActions = [
      'reassign',
      'change_priority',
      'change_deadline',
      'force_report',
      'mark_risk',
      'escalate_to_ceo'
    ];
    return managerActions.includes(action);
  }
  
  // 执行者只能更新自己的进度
  if (task.executorId === userId && action === 'update_progress') {
    return true;
  }
  
  return false; // 默认拒绝
}
```

---

### 3.4 绩效绑定系统

#### 3.4.1 积分规则

**正向激励：**
| 行为 | 积分 | 说明 |
|------|------|------|
| 准时完成 | +10 | 在截止时间前完成 |
| 提前完成（>24h） | +20 | 提前 24 小时以上 |
| 提前完成（>48h） | +30 | 提前 48 小时以上 |
| 每次进度汇报 | +2 | 1.5 小时模板汇报 |
| 高质量汇报 | +3 | 管理者标记为"优秀" |
| 主动承担额外任务 | +5 | 自愿接手 |
| 帮助他人完成任务 | +10 | 协作奖励 |

**负向约束：**
| 行为 | 积分 | 说明 |
|------|------|------|
| 延期完成 | -10 | 超过截止时间 |
| 严重延期（>24h） | -20 | 超过 24 小时 |
| 未按时汇报 | -5 | 超时未反馈 |
| 被重新分配 | -15 | 管理者强制转交 |
| 标记高风险（个人原因） | -10 | 因个人原因导致 |
| 失联（>4h） | -20 | 无法联系 |
| 质量不达标被驳回 | -10 | 审核不通过 |

#### 3.4.2 等级评定

**实时等级：**
| 等级 | 积分范围 | 奖金系数 | 特权 |
|------|----------|----------|------|
| S | ≥100 | 1.5x | 优先选择任务 |
| A | 80-99 | 1.2x | 延长 deadline 50% |
| B | 60-79 | 1.0x | 标准权限 |
| C | 40-59 | 0.8x | 需管理者审核 |
| D | <40 | 0.5x | 限制任务接收 |

**等级更新频率：**
- 实时更新积分
- 每日凌晨 02:00 重新评定等级
- 等级变更通知本人 + 管理者

#### 3.4.3 绩效流水

**每条记录可追溯：**
```json
{
  "id": "perf_001",
  "user_id": "jiangxin",
  "task_id": "task_123",
  "action": "complete_on_time",
  "score_change": 10,
  "reason": "任务#123 准时完成",
  "reviewer": "tian shu",
  "timestamp": "2026-03-23T10:30:00Z"
}
```

**查询接口：**
```
GET /api/v3.4/performance/:user_id/records
  ?start_date=2026-03-01
  &end_date=2026-03-31
```

---

### 3.5 风险预警系统

#### 3.5.1 风险等级

| 等级 | 颜色 | 触发条件 | 通知对象 |
|------|------|----------|----------|
| 正常 | 🟢 | 进度正常，无超时 | 无 |
| 关注 | 🔵 | 进度落后<20% | 执行者 |
| 警告 | 🟠 | 进度落后 20-50% 或超时<60 分钟 | 执行者 + 管理者 |
| 高风险 | 🔴 | 进度落后>50% 或超时≥60 分钟 | 执行者 + 管理者 + CEO |
| 严重 | ⚫ | 失联>4 小时或延期>24 小时 | 全员 + 电话通知 |

#### 3.5.2 预警策略

**主动预警：**
- 系统自动检测风险等级
- 达到阈值自动推送通知
- 升级时附带建议方案

**预警模板：**
```
⚠️【风险预警】任务 #123

🔴 风险等级：高风险

📊 当前进度：30%（预期 60%）
⏰ 剩余时间：2 小时
📉 落后程度：-30%

💡 建议方案：
  1. 申请延长 deadline 2 小时
  2. 请求增派人手协助
  3. 削减非核心功能

👉 操作：
  [申请延期] [请求支援] [上报 CEO]
```

---

## 4. 技术架构

### 4.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        BCE v3.4                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  进度追踪器  │  │  权限管理器  │  │  绩效引擎    │      │
│  │  Tracker     │  │  Permission  │  │  Performance │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                  │
│                   ┌────────▼────────┐                        │
│                   │   核心服务层    │                        │
│                   │  Core Service   │                        │
│                   └────────┬────────┘                        │
│                            │                                  │
│         ┌──────────────────┼──────────────────┐              │
│         │                  │                  │              │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐      │
│  │  定时任务    │  │  消息推送    │  │  数据持久化  │      │
│  │  Scheduler   │  │  Messenger   │  │  Repository  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 模块划分

#### 4.2.1 进度追踪器 (Progress Tracker)

**职责：**
- 维护任务进度状态
- 计算完成百分比
- 检测超时并触发升级

**核心方法：**
```javascript
class ProgressTracker {
  startTracking(taskId, executorId) {
    // 启动 30 分钟反馈倒计时
  }
  
  updateProgress(taskId, progress, details) {
    // 更新进度并重置倒计时
  }
  
  checkTimeout() {
    // 检测超时并触发升级
  }
  
  getProgress(taskId) {
    // 获取当前进度
  }
}
```

#### 4.2.2 定时任务调度器 (Scheduler)

**职责：**
- 30 分钟强制反馈定时任务
- 1.5 小时标准化汇报定时任务
- 每日凌晨等级评定任务

**技术选型：**
- 方案 A：`node-cron`（简单，够用）
- 方案 B：`node-schedule`（更灵活）
- 方案 C：`Bull` + Redis（分布式，高可用）

**推荐：** 方案 A（`node-cron`），简单可靠

**实现示例：**
```javascript
const cron = require('node-cron');

// 每 30 分钟检查一次进度反馈
cron.schedule('*/30 * * * *', async () => {
  await progressTracker.checkTimeout();
});

// 每 1.5 小时推送一次汇报模板
cron.schedule('0 */1,30 * * * *', async () => {
  await reportService.sendStandardReport();
});

// 每日凌晨 2 点评定等级
cron.schedule('0 2 * * *', async () => {
  await performanceService.updateLevels();
});
```

#### 4.2.3 消息推送服务 (Messenger)

**职责：**
- 飞书消息格式化
- @提及功能
- 消息模板渲染

**飞书集成：**
```javascript
async function sendFeishuMessage(userId, message) {
  const payload = {
    receive_id: userId,
    msg_type: 'post',
    content: JSON.stringify({
      post: {
        zh_cn: {
          title: message.title,
          content: [
            [{ tag: 'text', text: message.content }],
            [{ tag: 'at', user_id: userId }]
          ]
        }
      }
    })
  };
  
  return await feishuAPI.sendMessage(payload);
}
```

#### 4.2.4 权限验证中间件 (Permission Middleware)

**职责：**
- 验证用户权限
- 记录审计日志
- 拒绝未授权访问

**实现示例：**
```javascript
async function permissionMiddleware(req, res, next) {
  const { taskId, action } = req.body;
  const userId = req.user.id;
  
  const hasPermission = await verifyPermission(taskId, userId, action);
  
  if (!hasPermission) {
    await auditLog.log({
      userId,
      taskId,
      action,
      result: 'DENIED',
      timestamp: new Date()
    });
    
    return res.status(403).json({ error: 'Permission denied' });
  }
  
  next();
}
```

#### 4.2.5 绩效计算引擎 (Performance Engine)

**职责：**
- 积分计算
- 等级评定
- 绩效报表生成

**核心方法：**
```javascript
class PerformanceEngine {
  async addScore(userId, action, taskId) {
    const points = this.getPoints(action);
    await this.recordScore(userId, points, action, taskId);
    await this.updateLevel(userId);
  }
  
  getPoints(action) {
    const rules = {
      'complete_on_time': 10,
      'complete_early': 20,
      'report_on_time': 2,
      'late': -10,
      'reassigned': -15
    };
    return rules[action] || 0;
  }
  
  async updateLevel(userId) {
    const totalScore = await this.getTotalScore(userId);
    const level = this.calculateLevel(totalScore);
    await this.saveLevel(userId, level);
  }
}
```

### 4.3 数据流图

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   执行者    │     │   管理者    │     │    CEO      │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │  1.确认接收任务    │                   │
       ▼                   │                   │
┌─────────────────────────────────────────────────────────┐
│                    BCE v3.4 系统                         │
│                                                          │
│  ┌────────────┐                                         │
│  │ 任务状态   │  2.启动 30 分钟倒计时                     │
│  │ 进行中     │                                         │
│  └────────────┘                                         │
│         │                                                │
│         │  3.每 30 分钟触发                               │
│         ▼                                                │
│  ┌────────────┐                                         │
│  │ 进度反馈   │  4.推送飞书消息                          │
│  │ 提醒       │                                         │
│  └────────────┘                                         │
│         │                                                │
│         │  5.执行者回复进度                              │
│         ▼                                                │
│  ┌────────────┐                                         │
│  │ 进度更新   │  6.记录数据库                            │
│  │ +2 分       │                                         │
│  └────────────┘                                         │
│         │                                                │
│         │  7.每 1.5 小时触发                              │
│         ▼                                                │
│  ┌────────────┐                                         │
│  │ 标准化     │  8.推送汇报模板                          │
│  │ 汇报       │                                         │
│  └────────────┘                                         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 5. 数据库设计

### 5.1 表结构总览

| 表名 | 说明 | 主要字段 |
|------|------|----------|
| tasks | 任务表（扩展） | id, title, executor_id, manager_id, status, progress |
| progress_logs | 进度日志表 | id, task_id, user_id, progress_percent, created_at |
| performance_records | 绩效记录表 | id, user_id, score_change, action, created_at |
| permissions | 权限表 | id, role, permission, created_at |
| audit_logs | 审计日志表 | id, user_id, action, target, result, created_at |
| risk_alerts | 风险预警表 | id, task_id, level, message, resolved, created_at |

### 5.2 详细表结构

#### 5.2.1 tasks 表（扩展）

```sql
-- 原有字段
id TEXT PRIMARY KEY,
title TEXT NOT NULL,
description TEXT,
executor_id TEXT NOT NULL,
status TEXT DEFAULT 'pending',
deadline TIMESTAMP,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

-- v3.4 新增字段
manager_id TEXT,                    -- 管理者 ID（项目发起人）
priority TEXT DEFAULT 'medium',     -- high/medium/low
progress_percent INTEGER DEFAULT 0, -- 完成百分比
last_progress_report TIMESTAMP,     -- 上次汇报时间
performance_score INTEGER DEFAULT 0, -- 任务绩效积分
risk_level TEXT DEFAULT 'normal',   -- normal/watching/warning/high/critical
```

#### 5.2.2 progress_logs 表（新建）

```sql
CREATE TABLE progress_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    progress_percent INTEGER NOT NULL,
    completed_work TEXT,            -- JSON 数组
    remaining_work TEXT,            -- JSON 数组
    estimated_completion TIMESTAMP,
    risks TEXT,                     -- JSON 数组
    is_auto_report BOOLEAN DEFAULT FALSE,  -- 是否自动汇报
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 索引优化
CREATE INDEX idx_progress_logs_task_id ON progress_logs(task_id);
CREATE INDEX idx_progress_logs_user_id ON progress_logs(user_id);
CREATE INDEX idx_progress_logs_created_at ON progress_logs(created_at);
```

#### 5.2.3 performance_records 表（新建）

```sql
CREATE TABLE performance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    task_id TEXT,
    action TEXT NOT NULL,           -- complete_on_time, late, report_on_time, etc.
    score_change INTEGER NOT NULL,
    reason TEXT,
    reviewer_id TEXT,               -- 审核人（CEO 或管理者）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id)
);

-- 索引优化
CREATE INDEX idx_performance_records_user_id ON performance_records(user_id);
CREATE INDEX idx_performance_records_task_id ON performance_records(task_id);
CREATE INDEX idx_performance_records_created_at ON performance_records(created_at);
```

#### 5.2.4 permissions 表（新建）

```sql
CREATE TABLE permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,             -- executor, manager, ceo
    permission TEXT NOT NULL,       -- update_progress, reassign, etc.
    resource TEXT,                  -- 资源类型（task/performance/report）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引优化
CREATE INDEX idx_permissions_role ON permissions(role);
CREATE UNIQUE INDEX idx_permissions_role_permission ON permissions(role, permission);

-- 初始化数据
INSERT INTO permissions (role, permission, resource) VALUES
('executor', 'update_progress', 'task'),
('executor', 'view_own_task', 'task'),
('manager', 'reassign_task', 'task'),
('manager', 'change_priority', 'task'),
('manager', 'change_deadline', 'task'),
('manager', 'force_report', 'task'),
('manager', 'mark_risk', 'task'),
('manager', 'escalate_to_ceo', 'task'),
('manager', 'view_team_performance', 'performance'),
('ceo', 'all', '*');
```

#### 5.2.5 audit_logs 表（新建）

```sql
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,               -- task/user/permission
    target_id TEXT,
    old_value TEXT,                 -- JSON
    new_value TEXT,                 -- JSON
    result TEXT NOT NULL,           -- SUCCESS/DENIED/FAILED
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 索引优化
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

#### 5.2.6 risk_alerts 表（新建）

```sql
CREATE TABLE risk_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    level TEXT NOT NULL,            -- watching/warning/high/critical
    message TEXT NOT NULL,
    triggered_by TEXT,              -- timeout/progress_lag/manual
    notified_users TEXT,            -- JSON 数组
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by TEXT,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- 索引优化
CREATE INDEX idx_risk_alerts_task_id ON risk_alerts(task_id);
CREATE INDEX idx_risk_alerts_level ON risk_alerts(level);
CREATE INDEX idx_risk_alerts_resolved ON risk_alerts(resolved);
```

### 5.3 ER 图

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────────┐
│    users    │       │     tasks       │       │  progress_logs  │
├─────────────┤       ├─────────────────┤       ├─────────────────┤
│ id          │◄──────│ executor_id     │       │ task_id    ─────┼──► tasks
│ name        │       │ manager_id   ───┼───┐   │ user_id    ─────┼──► users
│ role        │       │ status          │   │   │ progress_percent│
│ level       │       │ progress_percent│   │   │ created_at      │
└─────────────┘       └────────┬────────┘   │   └─────────────────┘
       │                       │            │
       │                       │            │
       │              ┌────────▼────────┐   │
       │              │ performance_    │   │
       │              │ records         │   │
       │              ├─────────────────┤   │
       └─────────────►│ user_id     ────┼───┘
                      │ task_id     ────┼──────► tasks
                      │ score_change    │
                      │ action          │
                      └─────────────────┘
```

---

## 6. API 接口设计

### 6.1 进度管理 API

#### 6.1.1 更新任务进度

```http
POST /api/v3.4/tasks/:id/progress
Content-Type: application/json
Authorization: Bearer <token>

Request Body:
{
  "progress_percent": 60,
  "completed_work": ["数据采集模块", "API 接口开发"],
  "remaining_work": ["三维分析", "建议生成"],
  "estimated_completion": "2026-03-23T23:00:00Z",
  "risks": []
}

Response 200 OK:
{
  "success": true,
  "task_id": "task_123",
  "progress_percent": 60,
  "score_added": 2,
  "next_report_time": "2026-03-23T11:30:00Z"
}
```

#### 6.1.2 获取任务进度历史

```http
GET /api/v3.4/tasks/:id/progress-logs
Authorization: Bearer <token>

Query Parameters:
  - limit: 数量限制（默认 20）
  - offset: 偏移量（默认 0）

Response 200 OK:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "progress_percent": 60,
      "completed_work": ["数据采集模块"],
      "created_at": "2026-03-23T10:00:00Z"
    }
  ],
  "total": 5
}
```

#### 6.1.3 强制汇报

```http
POST /api/v3.4/tasks/:id/force-report
Authorization: Bearer <token>

Request Body:
{
  "reason": "进度落后，需要立即汇报"
}

Response 200 OK:
{
  "success": true,
  "message": "已通知执行者立即汇报",
  "deadline": "2026-03-23T10:10:00Z"
}

Permission: manager 或 ceo
```

### 6.2 权限管理 API

#### 6.2.1 重新分配任务

```http
POST /api/v3.4/tasks/:id/reassign
Authorization: Bearer <token>

Request Body:
{
  "new_executor_id": "user_456",
  "reason": "执行者延期，需要转交"
}

Response 200 OK:
{
  "success": true,
  "task_id": "task_123",
  "old_executor": "user_123",
  "new_executor": "user_456",
  "performance_impact": {
    "old_executor": -15,
    "new_executor": 0
  }
}

Permission: manager 或 ceo
```

#### 6.2.2 调整优先级

```http
PUT /api/v3.4/tasks/:id/priority
Authorization: Bearer <token>

Request Body:
{
  "priority": "high"
}

Response 200 OK:
{
  "success": true,
  "task_id": "task_123",
  "old_priority": "medium",
  "new_priority": "high"
}

Permission: manager 或 ceo
```

#### 6.2.3 调整截止时间

```http
PUT /api/v3.4/tasks/:id/deadline
Authorization: Bearer <token>

Request Body:
{
  "deadline": "2026-03-24T12:00:00Z",
  "reason": "技术难度超出预期"
}

Response 200 OK:
{
  "success": true,
  "task_id": "task_123",
  "old_deadline": "2026-03-23T17:00:00Z",
  "new_deadline": "2026-03-24T12:00:00Z",
  "requires_executor_confirm": true
}

Permission: manager 或 ceo
```

#### 6.2.4 标记风险

```http
POST /api/v3.4/tasks/:id/mark-risk
Authorization: Bearer <token>

Request Body:
{
  "level": "high",
  "message": "技术难点未攻克，需要支援",
  "mitigation_plan": "申请增派一名后端开发"
}

Response 200 OK:
{
  "success": true,
  "task_id": "task_123",
  "risk_level": "high",
  "notified_users": ["ceo", "manager"]
}

Permission: manager 或 ceo
```

#### 6.2.5 上报 CEO

```http
POST /api/v3.4/tasks/:id/escalate
Authorization: Bearer <token>

Request Body:
{
  "reason": "执行者失联超过 4 小时",
  "suggestion": "建议重新分配任务给灵犀",
  "urgency": "high"
}

Response 200 OK:
{
  "success": true,
  "escalation_id": "esc_789",
  "ceo_notified": true,
  "expected_response_time": "2026-03-23T11:00:00Z"
}

Permission: manager
```

### 6.3 绩效管理 API

#### 6.3.1 获取用户绩效

```http
GET /api/v3.4/performance/:user_id
Authorization: Bearer <token>

Response 200 OK:
{
  "success": true,
  "data": {
    "user_id": "jiangxin",
    "total_score": 48,
    "level": "B",
    "bonus_multiplier": 1.0,
    "tasks_completed": 12,
    "on_time_rate": 0.92,
    "last_updated": "2026-03-23T02:00:00Z"
  }
}
```

#### 6.3.2 获取绩效排行榜

```http
GET /api/v3.4/performance/leaderboard
Authorization: Bearer <token>

Query Parameters:
  - period: week/month/quarter/all（默认 month）
  - limit: 数量限制（默认 10）

Response 200 OK:
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "user_id": "lingxi",
      "total_score": 120,
      "level": "S",
      "tasks_completed": 15
    },
    {
      "rank": 2,
      "user_id": "jiangxin",
      "total_score": 48,
      "level": "B",
      "tasks_completed": 12
    }
  ]
}
```

#### 6.3.3 获取绩效流水

```http
GET /api/v3.4/performance/:user_id/records
Authorization: Bearer <token>

Query Parameters:
  - start_date: 2026-03-01
  - end_date: 2026-03-31
  - limit: 50

Response 200 OK:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "action": "complete_on_time",
      "score_change": 10,
      "task_id": "task_123",
      "reason": "任务#123 准时完成",
      "created_at": "2026-03-23T10:30:00Z"
    }
  ]
}
```

### 6.4 审计日志 API

#### 6.4.1 获取审计日志

```http
GET /api/v3.4/audit-logs
Authorization: Bearer <token>

Query Parameters:
  - user_id: 用户 ID（可选）
  - action: 操作类型（可选）
  - start_date: 开始日期
  - end_date: 结束日期
  - limit: 数量限制（默认 50）

Response 200 OK:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": "tian shu",
      "action": "reassign_task",
      "target_type": "task",
      "target_id": "task_123",
      "old_value": {"executor": "jiangxin"},
      "new_value": {"executor": "lingxi"},
      "result": "SUCCESS",
      "created_at": "2026-03-23T09:00:00Z"
    }
  ]
}

Permission: ceo 或 manager（仅查看自己管理的任务）
```

---

## 7. 管理仪表盘

### 7.1 功能概述

**目标用户：**
- 管理者（项目发起人）
- CEO（天枢）

**核心价值：**
- 实时查看所有任务进度
- 快速识别风险任务
- 一键执行管理操作
- 绩效数据可视化

### 7.2 页面布局

```
┌─────────────────────────────────────────────────────────────────────┐
│  BCE v3.4 管理仪表盘                                    🔔 3   👤天枢 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  📊 整体概况                                                  │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │  │
│  │  │ 进行中   │  │ 高风险   │  │ 待验收   │  │ 已完成   │        │  │
│  │  │   12    │  │    2    │  │    5    │  │   48    │        │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐  │
│  │  📋 任务进度列表            │  │  ⚠️ 风险预警                 │  │
│  │  ┌───────────────────────┐  │  │  ┌───────────────────────┐  │  │
│  │  │ 任务#123  ████████░░ 80%│  │  │  │ 🔴 任务#125          │  │  │
│  │  │ 任务#124  █████░░░░░ 50%│  │  │  │ 进度落后 35%          │  │  │
│  │  │ 任务#125  ███░░░░░░░ 30%│  │  │  │ 已超时 45 分钟         │  │  │
│  │  │ 任务#126  ██████████100%│  │  │  │ [处理] [忽略]         │  │  │
│  │  └───────────────────────┘  │  │  └───────────────────────┘  │  │
│  └─────────────────────────────┘  └─────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  📈 绩效排行榜（本月）                                        │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │ 1. 灵犀   ████████████████████ 120 分  S 级             │  │  │
│  │  │ 2. 匠心   ██████████████░░░░░░  48 分  B 级             │  │  │
│  │  │ 3. 磐石   ████████████░░░░░░░░  36 分  C 级             │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.3 核心功能

#### 7.3.1 任务进度视图

**功能：**
- 实时进度条显示
- 按优先级排序（高→中→低）
- 风险等级颜色标识
- 点击查看详情

**操作：**
- [查看详情] - 打开任务详情页
- [强制汇报] - 要求执行者立即汇报
- [重新分配] - 转交任务
- [调整优先级] - 修改优先级

#### 7.3.2 风险预警面板

**功能：**
- 实时显示高风险任务
- 自动刷新（每 30 秒）
- 一键处理（处理/忽略）
- 历史预警记录

**预警级别颜色：**
- 🔵 关注：蓝色
- 🟠 警告：橙色
- 🔴 高风险：红色
- ⚫ 严重：黑色 + 闪烁

#### 7.3.3 绩效面板

**功能：**
- 团队绩效排名
- 个人积分趋势图
- 等级分布饼图
- 导出 Excel 报表

### 7.4 技术实现

**前端技术栈：**
- 方案 A：Streamlit（快速，Python）
- 方案 B：React + Ant Design（专业，灵活）
- 方案 C：Vue + Element UI（轻量，易上手）

**推荐：** 方案 A（Streamlit），快速上线

**后端 API：**
- RESTful API（已有设计）
- WebSocket 实时推送（可选）
- 数据缓存（Redis，可选）

**示例代码（Streamlit）：**
```python
import streamlit as st
import requests

st.title("BCE v3.4 管理仪表盘")

# 获取任务数据
response = requests.get('http://localhost:3000/api/v3.4/tasks')
tasks = response.json()['data']

# 整体概况
col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("进行中", len([t for t in tasks if t['status'] == 'in_progress']))
with col2:
    st.metric("高风险", len([t for t in tasks if t['risk_level'] == 'high']))

# 任务列表
for task in tasks:
    st.progress(task['progress_percent'] / 100)
    st.write(f"**{task['title']}** - {task['progress_percent']}%")
```

---

## 8. 实施计划

### 8.1 阶段划分

| 阶段 | 内容 | 工时 | 优先级 |
|------|------|------|--------|
| 阶段一 | 核心功能（进度反馈 + 汇报模板） | 2 天 | P0 |
| 阶段二 | 权限系统（管理者权力） | 1 天 | P0 |
| 阶段三 | 绩效系统（积分 + 等级） | 1 天 | P1 |
| 阶段四 | 管理仪表盘 | 1 天 | P1 |
| 阶段五 | 测试与验收 | 1 天 | P0 |

**总计：** 6 个工作日

### 8.2 详细计划

#### 阶段一：核心功能（2 天）

**Day 1:**
- [ ] 数据库表结构创建（progress_logs 表）
- [ ] 定时任务调度器实现（node-cron）
- [ ] 30 分钟强制反馈逻辑
- [ ] 飞书消息推送集成

**Day 2:**
- [ ] 1.5 小时标准化汇报模板
- [ ] 超时升级机制（L1/L2/L3）
- [ ] 免打扰时段逻辑
- [ ] 单元测试

**交付物：**
- ✅ 30 分钟强制反馈可用
- ✅ 1.5 小时标准化汇报可用
- ✅ 超时升级通知可用

#### 阶段二：权限系统（1 天）

**Day 3:**
- [ ] 数据库表结构创建（permissions 表）
- [ ] RBAC 权限模型实现
- [ ] 管理者 API 接口（重新分配/调整优先级/调整截止时间）
- [ ] 权限验证中间件
- [ ] 审计日志记录

**交付物：**
- ✅ 管理者权限系统可用
- ✅ 权限验证通过
- ✅ 审计日志完整

#### 阶段三：绩效系统（1 天）

**Day 4:**
- [ ] 数据库表结构创建（performance_records 表）
- [ ] 积分规则引擎实现
- [ ] 等级评定逻辑
- [ ] 绩效 API 接口
- [ ] 每日凌晨定时任务

**交付物：**
- ✅ 积分系统可用
- ✅ 等级评定可用
- ✅ 绩效查询接口可用

#### 阶段四：管理仪表盘（1 天）

**Day 5:**
- [ ] Streamlit 前端搭建
- [ ] 任务进度视图
- [ ] 风险预警面板
- [ ] 绩效排行榜
- [ ] 实时数据刷新

**交付物：**
- ✅ 管理仪表盘可访问
- ✅ 核心功能可用

#### 阶段五：测试与验收（1 天）

**Day 6:**
- [ ] 集成测试
- [ ] 性能测试（并发 100 用户）
- [ ] 安全测试（权限验证）
- [ ] 文档完善
- [ ] 磊哥验收

**交付物：**
- ✅ 测试报告
- ✅ 用户手册
- ✅ 验收通过

### 8.3 里程碑

| 里程碑 | 日期 | 交付物 |
|--------|------|--------|
| M1：核心功能完成 | Day 2 | 进度反馈 + 汇报模板 |
| M2：权限系统完成 | Day 3 | 管理者权限可用 |
| M3：绩效系统完成 | Day 4 | 积分 + 等级可用 |
| M4：仪表盘完成 | Day 5 | 管理仪表盘上线 |
| M5：验收通过 | Day 6 | 正式上线 |

---

## 9. 风险与应对

### 9.1 技术风险

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|----------|
| 定时任务精度问题 | 中 | 中 | 使用持久化任务队列（Bull） |
| 飞书 API 限流 | 低 | 高 | 实现消息队列 + 重试机制 |
| 数据库并发冲突 | 中 | 中 | 乐观锁 + 事务 |
| 服务器重启丢失任务 | 低 | 高 | 定时任务持久化存储 |

### 9.2 业务风险

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|----------|
| 执行者抵触情绪 | 中 | 中 | 加强沟通，强调正向激励 |
| 管理者滥用权力 | 低 | 高 | 审计日志 + CEO 监督 |
| 绩效系统不公平 | 低 | 高 | 定期 review 规则，可调整 |
| 系统过于复杂 | 中 | 中 | 简化 UI，提供培训 |

### 9.3 应对策略

**技术层面：**
1. 关键代码 Review（CTO 负责）
2. 单元测试覆盖率>80%
3. 灰度发布（先小范围测试）
4. 回滚方案准备

**业务层面：**
1. 全员培训（系统使用）
2. 试运行 1 周（收集反馈）
3. 规则可调整（根据反馈优化）
4. CEO 最终决策权

---

## 10. 验收标准

### 10.1 功能验收

| 功能 | 验收标准 | 验证方法 |
|------|----------|----------|
| 30 分钟强制反馈 | 执行者确认任务后，30 分钟自动推送反馈请求 | 手动测试 |
| 1.5 小时标准化汇报 | 每 1.5 小时自动推送汇报模板 | 手动测试 |
| 超时升级机制 | 30'/60'/120'分别通知执行者/管理者/CEO | 手动测试 |
| 重新分配任务 | 管理者可将任务转交他人，绩效自动扣分 | 手动测试 |
| 调整优先级 | 管理者可修改任务优先级 | 手动测试 |
| 调整截止时间 | 管理者可延长/缩短 deadline | 手动测试 |
| 强制汇报 | 管理者可随时要求执行者汇报 | 手动测试 |
| 标记风险 | 管理者可标记任务为高风险，CEO 收到通知 | 手动测试 |
| 积分系统 | 完成任务/汇报自动加分，延期/超时自动扣分 | 手动测试 |
| 等级评定 | 每日凌晨自动评定等级 | 手动测试 |
| 管理仪表盘 | 实时显示任务进度、风险、绩效 | 手动测试 |

### 10.2 性能验收

| 指标 | 目标值 | 验证方法 |
|------|--------|----------|
| API 响应时间 | <200ms | 压测工具 |
| 消息推送延迟 | <5 秒 | 手动测试 |
| 并发用户数 | ≥100 | 压测工具 |
| 定时任务精度 | ±1 分钟 | 日志分析 |

### 10.3 安全验收

| 检查项 | 标准 | 验证方法 |
|--------|------|----------|
| 权限验证 | 未授权访问返回 403 | 手动测试 |
| 审计日志 | 所有操作有记录 | 数据库查询 |
| 数据加密 | 敏感信息加密存储 | 代码审查 |
| SQL 注入 | 无注入漏洞 | 安全扫描 |

### 10.4 文档验收

| 文档 | 内容 | 状态 |
|------|------|------|
| 技术方案 | 本文档 | ✅ 完成 |
| API 文档 | 接口详细说明 | ⏳ 待完成 |
| 用户手册 | 使用说明 | ⏳ 待完成 |
| 运维手册 | 部署 + 监控 | ⏳ 待完成 |

---

## 📝 附录

### 附录 A：飞书消息模板

**30 分钟反馈提醒：**
```json
{
  "msg_type": "post",
  "content": {
    "post": {
      "zh_cn": {
        "title": "⏰ 进度反馈提醒",
        "content": [
          [{"tag": "text", "text": "任务：{{task_title}}\n当前进度：{{progress}}%\n请及时反馈进度。"}],
          [{"tag": "at", "user_id": "{{user_id}}"}]
        ]
      }
    }
  }
}
```

**1.5 小时标准化汇报：**
```json
{
  "msg_type": "post",
  "content": {
    "post": {
      "zh_cn": {
        "title": "📊 进度汇报",
        "content": [
          [{"tag": "text", "text": "任务：{{task_title}}\n完成百分比：{{progress}}%\n已完成：{{completed}}\n剩余工作：{{remaining}}\n预计完成：{{estimated}}\n风险/阻塞：{{risks}}"}],
          [{"tag": "at", "user_id": "{{user_id}}"}]
        ]
      }
    }
  }
}
```

### 附录 B：数据库初始化脚本

```sql
-- 创建所有表
CREATE TABLE IF NOT EXISTS progress_logs (...);
CREATE TABLE IF NOT EXISTS performance_records (...);
CREATE TABLE IF NOT EXISTS permissions (...);
CREATE TABLE IF NOT EXISTS audit_logs (...);
CREATE TABLE IF NOT EXISTS risk_alerts (...);

-- 初始化权限数据
INSERT INTO permissions (role, permission, resource) VALUES
('executor', 'update_progress', 'task'),
('manager', 'reassign_task', 'task'),
('ceo', 'all', '*');
```

### 附录 C：项目文件结构

```
BCE-Project/
├── src/
│   ├── api/
│   │   ├── progress.js          # 进度管理 API
│   │   ├── permission.js        # 权限管理 API
│   │   ├── performance.js       # 绩效管理 API
│   │   └── audit.js             # 审计日志 API
│   ├── services/
│   │   ├── progress-tracker.js  # 进度追踪器
│   │   ├── scheduler.js         # 定时任务调度器
│   │   ├── messenger.js         # 消息推送服务
│   │   └── performance-engine.js # 绩效计算引擎
│   ├── middleware/
│   │   └── permission.js        # 权限验证中间件
│   └── models/
│       ├── Task.js
│       ├── ProgressLog.js
│       ├── PerformanceRecord.js
│       └── AuditLog.js
├── dashboard/
│   └── app.py                   # Streamlit 仪表盘
├── database/
│   └── schema.sql               # 数据库初始化脚本
├── tests/
│   ├── progress.test.js
│   ├── permission.test.js
│   └── performance.test.js
└── docs/
    ├── API 文档.md
    ├── 用户手册.md
    └── 运维手册.md
```

---

**文档版本：** v1.0  
**创建日期：** 2026-03-23 08:58  
**技术负责人：** 匠心 (CTO)  
**审批状态：** 🟡 待磊哥批准

---

**下一步：** 磊哥批准后立即开始实施（预计 6 个工作日完成）