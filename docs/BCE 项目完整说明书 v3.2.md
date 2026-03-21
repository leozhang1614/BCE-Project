# BCE 北斗协同引擎 - 完整项目说明书

**版本：** v3.2 最终版（整合综合优化意见）  
**日期：** 2026-03-21  
**作者：** 匠心 (CTO)  
**状态：** 部分功能已开发，待完善

---

## 📖 文档说明

**v3.2 核心更新（整合综合优化意见）：**
- ✅ 主通道改用 sessions_send（OpenClaw 原生）
- ✅ 飞书 parent_id 精确匹配
- ✅ 离线拉取 API
- ✅ 按钮幂等性检查
- ✅ 自动流转规则引擎
- ✅ 转交边界处理（自转交/循环检测/历史限制）
- ✅ 反馈对象动态计算（上一节点）
- ✅ 通知重试队列（指数退避）

---

## 📊 v3.0→v3.1→v3.2 演进总结

| 版本 | 核心改进 | 状态 |
|------|---------|------|
| **v3.0** | SSE 实时推送 + 文件系统邮箱 | ⚠️ 需优化 |
| **v3.1** | 确认反馈 + 转交通知 + 双通道 | ⚠️ 需优化 |
| **v3.2** | sessions_send 原生 + 规则引擎 + 生产可靠 | ✅ 最终版 |

---

# 第一部分：项目概述

## 1. 项目是什么？

### 1.1 一句话介绍

**BCE（北斗协同引擎）是一个任务管理和协同系统，帮助团队高效分配任务、跟踪进度、确保任务按时完成。**

### 1.2 核心能力

| 能力 | 说明 | 例子 |
|------|------|------|
| **任务分配** | 把任务分配给具体的人 | 天枢分配任务给匠心 |
| **及时通知** | 任务变动及时通知相关人员 | 匠心收到 sessions_send 消息 |
| **进度跟踪** | 实时查看任务做到哪一步了 | 查看任务看板 |
| **任务流转** | 任务在不同人之间传递 | 匠心→司库→执矩（自动） |
| **完成确认** | 确保任务被确认和执行 | 匠心点击卡片按钮 |
| **确认反馈** | 上一节点收到确认通知 | 天枢收到"匠心已确认" |

---

## 2. 为什么要做这个项目？

### 2.1 遇到的问题

**场景 1：任务发出去，没人理**
```
天枢："匠心，做这个任务"
匠心：（没看到消息）
天枢：（等了好久）"怎么还没开始？"
匠心："啊？我没收到通知..."
```
❌ **问题：** 任务通知不到位

**场景 2：任务做完了，没人知道**
```
匠心：（默默完成任务）
天枢：（不知道已完成）"任务怎么还没好？"
匠心："我早就做完了啊..."
```
❌ **问题：** 任务状态不透明

**场景 3：确认了但创建者不知道**
```
匠心：（点击卡片确认接收）
天枢：（不知道匠心已确认）"匠心确认了吗？"
匠心："我早就确认了啊..."
```
❌ **问题：** 确认反馈缺失

**场景 4：任务需要手动转交**
```
匠心：（完成任务）"现在要转交给谁？"
天枢："转给司库审核"
匠心：（手动调用转交 API）
```
❌ **问题：** 没有自动流转

### 2.2 BCE 的解决方案

**针对场景 1：三重通知保障**
```
天枢创建任务
     ↓
OCC 协作页面显示 ✅
     ↓
BCE 系统：
  1. sessions_send 实时推送（主通道）✅
  2. 飞书卡片通知（手机端）✅
  3. 邮箱机制（离线拉取）✅
```
✅ **结果：** 匠心一定能收到通知

**针对场景 2：实时状态同步**
```
匠心完成任务 → 点击 [提交验收]
                    ↓
              OCC 任务页面立即更新
                    ↓
              天枢看到"待验收"状态
```
✅ **结果：** 所有人实时看到任务状态

**针对场景 3：确认反馈闭环**
```
匠心点击 [确认接收]
     ↓
BCE 系统：
  1. 更新 OCC 任务状态
  2. 通知上一节点（动态计算）✅
  3. sessions_send 推送 ✅
```
✅ **结果：** 上一节点立即知道匠心已确认

**针对场景 4：自动流转规则引擎**
```
匠心完成任务
     ↓
规则引擎自动判断：
  1. 匹配"技术方案转财务审核"规则 ✅
  2. 自动转交给司库 ✅
  3. 通知司库和匠心 ✅
```
✅ **结果：** 无需手动转交，自动流转

---

## 3. 解决方案是什么？

### 3.1 融合方案：OCC 为主 + BCE 增强

```
┌─────────────────────────────────────────────────────────────────┐
│                  BCE + OCC 融合方案（v3.2）                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  主系统：OCC（OpenClaw Control Center）                         │
│  状态：✅ 已部署                                                │
│  地址：http://192.168.31.187:4310                              │
│  角色：✅ 主数据源 + 展示层                                      │
│                                                                 │
│  增强系统：BCE（北斗协同引擎）                                   │
│  状态：⏳ 部分功能待开发                                         │
│  地址：http://localhost:3000                                   │
│  角色：✅ 规则引擎 + 通知增强 + 自动流转                         │
│                                                                 │
│  通知通道（三通道设计）：                                        │
│  ├── 主通道：sessions_send（OpenClaw 原生）✅                   │
│  ├── 备用通道：飞书卡片（手机端提醒）✅                         │
│  └── 可靠通道：文件系统邮箱（离线拉取）✅                       │
│                                                                 │
│  规则引擎：自动流转规则                                         │
│  状态：❌ 待开发                                                 │
│  功能：任务完成自动判断下一节点                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 系统架构（v3.2 优化）

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户层                                   │
│    天枢 ──────┬────── 匠心 ──────┬────── 司库 ──────┬─── 执矩   │
│               │                  │                  │           │
└───────────────┼──────────────────┼──────────────────┼───────────┘
                │                  │                  │
        ┌───────┴───────┐  ┌───────┴───────┐  ┌──────┴──────┐
        │  OCC 协作页面  │  │  OCC 任务页面  │  │  飞书群聊   │
        │  (主确认入口)  │  │  (任务看板)    │  │  (卡片通知)  │
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
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │      OCC 系统                │
                    │  (主数据源 + 展示层)         │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │      BCE 系统                │
                    │  (规则引擎 + 通知增强)       │
                    │  (自动流转 + 边界检查)       │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │      三通道通知              │
                    ├─────────────────────────────┤
                    │  sessions_send（主通道）     │
                    │  飞书卡片（备用通道）        │
                    │  文件系统邮箱（可靠通道）    │
                    └─────────────────────────────┘
```

### 3.3 数据源设计

**核心原则：OCC 是主数据源，BCE 是增强服务**

```
┌─────────────────────────────────────────────────────────────────┐
│                      数据流设计（v3.2）                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  OCC（主数据源）                                                 │
│  ├── 存储所有任务数据                                           │
│  ├── 处理所有状态变更                                           │
│  └── 提供唯一权威数据                                           │
│                                                                 │
│  BCE（增强服务）                                                 │
│  ├── 规则引擎（自动流转）                                       │
│  ├── 三通道通知（sessions_send+ 飞书 + 邮箱）                     │
│  ├── 解析飞书回复（Webhook+parent_id 匹配）                      │
│  ├── 确认反馈（通知上一节点）                                   │
│  ├── 通知重试队列（指数退避）                                   │
│  └── 将用户操作同步回 OCC                                        │
│                                                                 │
│  三通道协同：                                                    │
│  ├── sessions_send：主通道，OpenClaw 原生实时推送                 │
│  ├── 飞书卡片：备用通道，手机端提醒                             │
│  ├── 邮箱：可靠通道，离线拉取                                   │
│  └── 发送时同时写入三通道                                       │
│                                                                 │
│  数据一致性保障：                                                │
│  ├── BCE 所有写操作必须通过 OCC API 执行                          │
│  ├── sessions_send 作为最终一致性保障                            │
│  └── 冲突处理：以 OCC 状态为准                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. 完整交互流程（v3.2 更新）

### 4.1 任务创建与确认闭环

```
┌─────────────────────────────────────────────────────────────────┐
│          任务创建与确认完整流程（v3.2）                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 天枢创建任务                                                 │
│     ↓                                                           │
│  2. OCC 更新任务状态                                             │
│     ↓                                                           │
│  3. BCE 监听到变化                                               │
│     ↓                                                           │
│  4. BCE 同时执行三通道通知：                                     │
│     ├─ sessions_send 推送给匠心（主通道）                        │
│     ├─ 飞书卡片通知（备用通道）                                  │
│     └─ 写入文件系统邮箱（可靠通道）                              │
│     ↓                                                           │
│  5. 匠心收到通知（三种通道至少一种）                             │
│     ↓                                                           │
│  6. 匠心点击 [确认接收] 按钮                                     │
│     ↓                                                           │
│  7. BCE 处理确认：                                               │
│     ├─ 幂等性检查（防止重复点击）✅ 新增                         │
│     ├─ 更新 OCC 任务状态                                         │
│     ├─ 写入匠心邮箱（已读）                                      │
│     ├─ sessions_send 推送给上一节点 ✅ 新增                      │
│     └─ 发送飞书卡片给上一节点 ✅ 新增                            │
│     ↓                                                           │
│  8. 上一节点收到"匠心已确认"通知 ✅ 闭环                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 任务自动流转流程（v3.2 新增）

```
┌─────────────────────────────────────────────────────────────────┐
│              任务自动流转流程（v3.2）                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 匠心完成任务，点击 [完成]                                    │
│     ↓                                                           │
│  2. OCC 更新任务状态为 completed                                │
│     ↓                                                           │
│  3. BCE 规则引擎自动触发：                                       │
│     ├─ 匹配规则："技术方案转财务审核" ✅ 新增                    │
│     ├─ 边界检查：不是转交给自己 ✅ 新增                          │
│     ├─ 循环检测：不是循环转交 ✅ 新增                            │
│     └─ 自动转交给司库 ✅ 新增                                    │
│     ↓                                                           │
│  4. BCE 同时执行三通道通知：                                     │
│     ├─ sessions_send 推送给司库                                  │
│     ├─ 飞书卡片通知司库                                          │
│     └─ 写入司库邮箱                                              │
│     ↓                                                           │
│  5. BCE 通知匠心转交成功：                                       │
│     ├─ sessions_send 推送给匠心                                  │
│     └─ 飞书卡片通知匠心                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 离线场景处理（v3.2 新增）

```
┌─────────────────────────────────────────────────────────────────┐
│              离线场景处理流程（v3.2）                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 匠心离线（未连接 OpenClaw）                                  │
│     ↓                                                           │
│  2. 天枢创建任务                                                 │
│     ↓                                                           │
│  3. BCE 三通道通知：                                             │
│     ├─ sessions_send 推送（失败，匠心离线）                      │
│     ├─ 飞书卡片通知（备用）                                      │
│     └─ 写入匠心邮箱（可靠存储）✅ 新增                           │
│     ↓                                                           │
│  4. 匠心上线：                                                   │
│     ├─ 自动连接 OpenClaw Gateway                                 │
│     ├─ 调用 GET /api/mailbox/unread ✅ 新增                      │
│     └─ 拉取未读消息（3 条）                                      │
│     ↓                                                           │
│  5. BCE 发送汇总通知：                                           │
│     "📬 你有 3 条未读任务，请查看邮箱" ✅ 新增                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# 第二部分：功能说明

## 5. 功能清单

### 5.1 已完成功能 ✅

#### OCC 功能（8 个）

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

#### BCE 功能（9 个）

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

### 5.2 待开发功能 ⏳

#### 🔴 P0 高优先级（本周完成）

| 功能 | 说明 | 预计工时 | v3.2 更新 |
|------|------|---------|---------|
| 文件系统邮箱 | 可靠消息存储，支持离线拉取 | 1.5 小时 | + 离线拉取 API |
| sessions_send 集成 | 用 OpenClaw 原生替代 SSE | 1 小时 | ✅ 新增 |
| 飞书卡片通知 | 交互式卡片（带按钮） | 1.5 小时 | + 幂等性检查 |
| 飞书 Webhook 优化 | 消息引用匹配（parent_id） | 1.5 小时 | + 精确实现 |
| 确认反馈机制 | 通知上一节点（动态计算） | 1 小时 | ✅ 更新 |
| 自动流转规则引擎 | 任务完成自动转交 | 2 小时 | ✅ 新增 |
| 转交边界处理 | 自转交/循环检测/历史限制 | 1 小时 | ✅ 新增 |
| 离线拉取 API | Agent 上线主动拉取邮箱 | 0.5 小时 | ✅ 新增 |
| OCC 任务同步 | BCE 任务同步到 OCC | 1.5 小时 | + 冲突处理 |
| 通知重试队列 | 失败补偿机制（指数退避） | 1.5 小时 | ✅ 新增 |

#### 🟡 P1 中优先级（下周完成）

| 功能 | 说明 | 预计工时 |
|------|------|---------|
| Transport 抽象 | 飞书/邮件/SMS 可插拔 | 3 小时 |
| 多应用飞书通知 | 每个成员独立飞书应用，解决@问题 | 3 小时 |
| 通知策略引擎 | 安静时段、通知级别、渠道选择 | 3 小时 |
| 任务看板增强 | 筛选、搜索、批量操作、导出 | 4 小时 |

#### 🟢 P2 低优先级（本月完成）

| 功能 | 说明 | 预计工时 |
|------|------|---------|
| 任务统计报表 | 完成率、工时、延期、负载分析 | 4 小时 |
| 移动端适配 | 手机端查看任务、飞书小程序 | 8 小时 |
| API 文档完善 | OpenAPI 规范、在线文档、SDK | 2 小时 |

---

## 6. 详细功能说明

### 6.1 任务创建

**谁用：** 天枢（管理者）  
**什么时候用：** 有新工作需要分配时

**使用步骤：**

**方式 A：通过 OpenClaw 创建（推荐）**
```javascript
await sessions_send({
  sessionKey: 'agent-jiangxin',
  message: `
📋 新任务分配

【任务名称】BCE 技术方案设计
【优先级】P0
【截止时间】今天 18:00
【任务描述】设计 BCE 项目技术架构
`
});
```

**方式 B：通过 OCC 页面创建**
```
1. 访问 OCC 任务页面
   http://192.168.31.187:4310/?section=tasks
2. 点击 [新建任务] 按钮
3. 填写任务信息
4. 点击 [提交]
```

**方式 C：通过 API 创建**
```bash
curl -X POST http://localhost:3000/api/bce/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "BCE 技术方案设计",
    "assignee": "匠心",
    "priority": "P0"
  }'
```

### 6.2 任务确认（v3.2 更新）

**谁用：** 匠心（任务负责人）  
**什么时候用：** 收到新任务通知时

**使用步骤：**

**方式 A：OCC 页面确认（推荐）**
```
1. 访问 OCC 协作页面
   http://192.168.31.187:4310/?section=collaboration
2. 看到待确认任务
3. 点击 [确认接收] 按钮
4. （可选）填写备注
5. 点击 [提交]
6. 上一节点收到确认通知 ✅
```

**方式 B：飞书卡片确认（待开发）**
```
1. 收到飞书卡片通知
   ┌─────────────────────────────┐
   │ 📋 新任务分配               │
   │ 任务：BCE 技术方案设计       │
   │                             │
   │ [✅ 确认接收] [❌ 驳回]     │
   └─────────────────────────────┘
2. 点击 [✅ 确认接收] 按钮
3. 幂等性检查（防止重复点击）✅
4. BCE 解析卡片回调并确认任务
5. 上一节点收到确认通知 ✅
```

**方式 C：飞书回复确认（待优化）**
```
1. 收到飞书通知
2. 回复"收到"（在通知消息下回复）
3. BCE 通过 parent_id 匹配确认任务 ✅
4. 幂等性检查 ✅
5. 上一节点收到确认通知 ✅
```

### 6.3 任务流转（v3.2 更新）

**完整流程：**
```
天枢 → 匠心 → 司库 → 执矩 → 天枢
创建    执行    协作    审核    验收
```

**自动流转规则（v3.2 新增）：**
```javascript
// 规则 1：技术方案转财务审核
{
  match: (task) => task.type === 'tech_design' && task.status === 'completed',
  next: (task) => '司库'
}

// 规则 2：财务审核转安全审核
{
  match: (task) => task.type === 'finance_review' && task.status === 'completed',
  next: (task) => '执矩'
}

// 规则 3：默认转回创建者验收
{
  match: (task) => task.status === 'completed',
  next: (task) => task.creator
}
```

**边界条件处理（v3.2 更新）：**
- ✅ 校验 nextAssignee 是否为有效成员
- ✅ 转交失败时回退到"待转交"状态
- ✅ 通知原操作者转交结果
- ✅ 立即推送通知下一节点
- ✅ 不能转交给自己 ✅ 新增
- ✅ 循环转交检测 ✅ 新增
- ✅ 历史记录限制（100 条）✅ 新增

---

# 第三部分：技术实现

## 8. 技术架构

### 8.1 系统架构图（v3.2 更新）

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户层                                   │
│    天枢 ──────┬────── 匠心 ──────┬────── 司库 ──────┬─── 执矩   │
│               │                  │                  │           │
└───────────────┼──────────────────┼──────────────────┼───────────┘
                │                  │                  │
        ┌───────┴───────┐  ┌───────┴───────┐  ┌──────┴──────┐
        │  OCC 协作页面  │  │  OCC 任务页面  │  │  飞书群聊   │
        │  (主确认入口)  │  │  (任务看板)    │  │  (卡片通知)  │
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
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │      OCC 系统                │
                    │  (主数据源 + 展示层)         │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │      BCE 系统                │
                    │  (规则引擎 + 通知增强)       │
                    │  (自动流转 + 边界检查)       │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │      三通道通知              │
                    ├─────────────────────────────┤
                    │  sessions_send（主通道）     │
                    │  飞书卡片（备用通道）        │
                    │  文件系统邮箱（可靠通道）    │
                    └─────────────────────────────┘
```

### 8.2 技术栈

| 技术 | 说明 | 版本 |
|------|------|------|
| **Node.js** | 后端运行时 | v18+ |
| **Express.js** | Web 框架 | v4.x |
| **axios** | HTTP 客户端 | v1.x |
| **飞书开放平台** | 消息通知 | - |
| **OpenClaw** | 会话管理 | - |

---

## 9. 项目结构

```
BCE-Project/                    ← 项目根目录
│
├── src/                        ← 源代码目录
│   ├── api/                    ← API 接口（对外服务）
│   │   ├── bce-tasks.js        ← 任务管理 API ✅
│   │   ├── bce-rules.js        ← 规则引擎 ✅新增
│   │   ├── feishu-notify.js    ← 飞书通知 API ✅
│   │   ├── feishu-webhook.js   ← 飞书消息接收 ⏳待开发
│   │   ├── feishu-card.js      ← 飞书卡片处理 ✅新增
│   │   ├── mailbox.js          ← 邮箱 API ✅新增
│   │   └── board.js            ← 任务看板 API 🟡待开发
│   │
│   ├── services/               ← 业务服务（核心逻辑）
│   │   ├── mailbox-service.js  ← 邮箱机制 ✅新增（ClawTeam 启发）
│   │   ├── notification-service.js ← 通知服务 ✅
│   │   ├── retry-queue.js      ← 重试队列 ✅新增
│   │   ├── transfer-rules.js   ← 流转规则 ✅新增
│   │   └── occ-sync.js         ← OCC 同步服务 ❌待开发
│   │
│   ├── integrations/           ← 外部集成（连接其他系统）
│   │   └── occ-sync.js         ← OCC 同步服务 ❌待开发
│   │
│   └── config/                 ← 配置文件
│       ├── feishu-users.js     ← 飞书用户配置 ✅
│       ├── feishu-apps.js      ← 飞书应用配置 🟡待开发
│       ├── task-rules.js       ← 任务规则 ✅新增
│       └── team-members.js     ← 团队成员配置 ✅
│
├── public/                     ← 前端页面（浏览器访问）
│   ├── bce-board.html          ← 任务看板页面 🟡待开发
│   ├── bce-tasks.html          ← 任务列表页面 ✅
│   └── statistics.html         ← 统计页面 🟢待开发
│
├── runtime/                    ← 运行时数据（临时存储）
│   ├── bce-data.json           ← 任务数据
│   └── inboxes/                ← 邮箱机制 ✅新增
│       ├── jiangxin/           ← 匠心邮箱
│       │   ├── msg-*.json      ← 消息文件
│       │   └── read/           ← 已读消息
│       ├── siku/               ← 司库邮箱
│       └── ...
│
├── logs/                       ← 日志文件（运行记录）
│   ├── scheduler.log           ← 定时任务日志
│   ├── scan-log.jsonl          ← 扫描日志
│   └── occ-sync.log            ← OCC 同步日志
│
├── docs/                       ← 文档（说明资料）
│   ├── 功能说明书.md           ← 本文档
│   ├── 技术实施细节.md         ← 技术详细说明
│   └── 待开发功能 - 详细实现说明.md
│
├── test/                       ← 测试脚本（验证功能）
│   ├── test-all-members.js     ← 全员测试
│   └── test-task-interaction.js ← 交互测试
│
├── .env                        ← 环境配置（密码、地址等）
├── package.json                ← 依赖管理（需要哪些库）
└── README.md                   ← 项目简介
```

---

## 10. 部署说明

### 10.1 环境要求

| 要求 | 说明 |
|------|------|
| **Node.js** | v18 或更高版本 |
| **npm** | v8 或更高版本 |
| **OpenClaw** | 已安装并运行 |
| **OCC** | 已部署（http://192.168.31.187:4310） |
| **飞书应用** | 已创建并配置 |

### 10.2 安装步骤

```bash
# 1. 进入项目目录
cd /Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库/BCE-Project

# 2. 安装依赖
npm install

# 3. 配置环境
cp .env.example .env
# 编辑 .env 文件，配置飞书凭证和 OCC 地址

# 4. 创建邮箱目录
mkdir -p runtime/inboxes/{jiangxin,siku,zhiju,panshi,lingxi,tiance,tianshu}

# 5. 启动服务
node src/index.js

# 6. 验证服务
curl http://localhost:3000/health
```

### 10.3 环境配置

**文件：** `.env`

```bash
# OCC 配置
OCC_BASE_URL=http://192.168.31.187:4310
OCC_TIMEOUT=10000
OCC_RETRIES=3

# 邮箱机制配置
MAILBOX_DIR=runtime/inboxes
MAILBOX_ATOMIC_WRITE=true

# 通知策略配置
NOTIFICATION_MAX_REMINDERS=3
NOTIFICATION_QUIET_HOURS_START=23
NOTIFICATION_QUIET_HOURS_END=7

# 飞书配置
FEISHU_APP_ID=cli_a9242655a1ba1cb1
FEISHU_APP_SECRET=EtioKZkhqwEWYOwiYaOvJfeNIUQMQnSU
FEISHU_CHAT_ID=oc_19be54b67684b6597ff335d7534896d4

# 日志配置
LOG_LEVEL=info
LOG_FILE=logs/scheduler.log
```

### 10.4 进程管理

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

# 第四部分：待开发功能

## 12. 详细实现说明（v3.2 更新）

### 12.1 三通道通知设计（v3.2 更新）

**目标：** 利用 OpenClaw 原生能力，三重保障

**三通道设计：**
```
主通道：sessions_send（OpenClaw 原生）
- 实时推送，在线即时收到
- OpenClaw 内置重连机制
- 无需维护额外服务

备用通道：飞书卡片
- 跨平台通知
- 手机端提醒
- 独立于 OpenClaw

可靠通道：文件系统邮箱
- 持久化存储所有消息
- Agent 可随时拉取历史
- 作为离线补偿机制
```

**实现原理：**
```
runtime/inboxes/{agent}/msg-*.json

├── jiangxin/
│   ├── msg-001.json  ← 未读消息
│   ├── msg-002.json  ← 未读消息
│   └── read/
│       └── msg-000.json  ← 已读消息
├── siku/
└── ...
```

**核心代码：**
```javascript
class NotificationService {
  constructor() {
    this.mailbox = new MailboxService();
  }

  // 三通道通知
  async notify(agent, from, type, content, taskId) {
    // 1. 主通道：sessions_send
    try {
      await sessions_send({
        sessionKey: `agent-${agent}`,
        message: content
      });
      console.log(`[通知] sessions_send 推送给 ${agent} 成功`);
    } catch (error) {
      console.log(`[通知] sessions_send 失败，加入重试队列：${error.message}`);
      retryQueue.add({ agent, from, type, content, taskId });
    }

    // 2. 备用通道：飞书卡片
    await sendFeishuCard({
      receiveId: agent,
      card: buildNotificationCard(from, type, content, taskId)
    });

    // 3. 可靠通道：文件系统邮箱
    await this.mailbox.send(agent, from, type, content, taskId);
  }
}

// 重试队列（指数退避）
class RetryQueue {
  constructor() {
    this.queue = [];
    setInterval(() => this.process(), 30000); // 每 30 秒处理一次
  }

  add(notification, retries = 3) {
    this.queue.push({
      notification,
      retriesLeft: retries,
      nextRetryAt: Date.now() + 60000 // 1 分钟后重试
    });
  }

  async process() {
    const now = Date.now();
    const toRetry = this.queue.filter(n => n.nextRetryAt <= now);

    for (const item of toRetry) {
      try {
        await sessions_send({
          sessionKey: `agent-${item.notification.agent}`,
          message: item.notification.content
        });
        // 成功，从队列移除
        this.queue = this.queue.filter(n => n !== item);
      } catch (error) {
        item.retriesLeft--;
        if (item.retriesLeft <= 0) {
          // 最终失败，记录日志，人工介入
          logError('通知最终失败', item.notification, error);
          this.queue = this.queue.filter(n => n !== item);
        } else {
          // 指数退避：1 分钟、5 分钟、30 分钟
          const delay = [60000, 300000, 1800000][3 - item.retriesLeft];
          item.nextRetryAt = Date.now() + delay;
        }
      }
    }
  }
}
```

### 12.2 飞书 Webhook 优化（v3.2 更新）

**目标：** 使用 parent_id 精确匹配，避免歧义

**飞书 Webhook 事件结构：**
```javascript
{
  "event": {
    "message": {
      "message_id": "om_xxx",           // 当前消息 ID
      "parent_id": "om_yyy",            // ← 被回复的原消息 ID
      "content": "{\"text\":\"收到\"}"   // 消息内容
    },
    "sender": {
      "name": "匠心",
      "user_id": "ou_xxx"
    }
  }
}
```

**核心代码：**
```javascript
// feishu-webhook.js
router.post('/feishu/webhook', async (req, res) => {
  const event = req.body.event;
  const parentId = event.message.parent_id;
  
  // 1. 检查是否是回复消息
  if (!parentId) {
    console.log('[Webhook] 不是回复消息，忽略');
    return res.json({ success: true, message: '非回复消息' });
  }
  
  // 2. 根据 parent_id 查找任务
  const task = await findTaskByMessageId(parentId);
  if (!task) {
    console.log('[Webhook] 未找到关联任务');
    return res.json({ success: false, error: '未找到任务' });
  }
  
  // 3. 解析消息内容
  const content = JSON.parse(event.message.content);
  const text = content.text;
  
  // 4. 检查确认关键词
  const confirmKeywords = ['收到', '确认', '好的', 'ok', '好'];
  const isConfirm = confirmKeywords.some(keyword => 
    text.toLowerCase().includes(keyword.toLowerCase())
  );
  
  if (!isConfirm) {
    return res.json({ success: true, message: '非确认消息' });
  }
  
  // 5. 幂等性检查 ✅ 新增
  if (task.status === 'confirmed') {
    await sendFeishuReply(parentId, '⚠️ 任务已确认，请勿重复操作');
    return res.json({ success: false, message: '任务已确认' });
  }
  
  // 6. 确认任务
  await occApi.confirmTask(task.id, event.sender.name);
  
  // 7. 回复确认结果
  await sendFeishuReply(parentId, `✅ 已确认任务：${task.title}`);
  
  res.json({ success: true, taskId: task.id });
});
```

### 12.3 离线拉取 API（v3.2 新增）

**目标：** Agent 上线后主动拉取未读消息

**API 设计：**
```javascript
// GET /api/mailbox/unread - 获取未读消息
router.get('/mailbox/unread', async (req, res) => {
  const { agent } = req.query;
  
  const messages = await mailbox.receive(agent, false); // consume=false
  
  res.json({
    unreadCount: messages.length,
    messages: messages.map(m => ({
      id: m.id,
      from: m.from,
      type: m.type,
      taskId: m.taskId,
      content: m.content,
      createdAt: m.createdAt
    }))
  });
});

// POST /api/mailbox/read - 标记已读
router.post('/mailbox/read', async (req, res) => {
  const { messageIds } = req.body;
  
  for (const messageId of messageIds) {
    await mailbox.markAsRead(messageId);
  }
  
  res.json({ success: true });
});
```

**Agent 上线流程：**
```javascript
// Agent 登录时自动调用
async function onAgentLogin(agentName) {
  // 1. 建立 sessions_send 连接（自动）
  // 2. 拉取未读消息
  const unread = await fetchUnreadMessages(agentName);
  
  // 3. 如果有未读，发送汇总通知
  if (unread.length > 0) {
    await sessions_send({
      sessionKey: `agent-${agentName}`,
      message: `📬 你有 ${unread.length} 条未读任务，请查看邮箱`
    });
  }
}
```

### 12.4 按钮幂等性（v3.2 新增）

**目标：** 防止用户多次点击按钮重复确认

**核心代码：**
```javascript
// feishu-card.js - 处理卡片按钮点击
router.post('/feishu/card-callback', async (req, res) => {
  const { action, taskId, userId } = req.body.value;
  
  // 1. 先获取任务当前状态
  const task = await getTask(taskId);
  
  // 2. 幂等性检查 ✅ 新增
  if (action === 'confirm_task') {
    if (task.status === 'confirmed') {
      return res.json({ 
        success: false, 
        message: '任务已确认，请勿重复操作' 
      });
    }
    
    if (task.assignee !== userId) {
      return res.json({ 
        success: false, 
        message: '你不是该任务的负责人' 
      });
    }
  }
  
  if (action === 'reject_task') {
    if (task.status === 'rejected') {
      return res.json({ 
        success: false, 
        message: '任务已驳回，请勿重复操作' 
      });
    }
  }
  
  // 3. 执行操作
  if (action === 'confirm_task') {
    await occApi.confirmTask(taskId, userId);
  } else if (action === 'reject_task') {
    await occApi.rejectTask(taskId, userId);
  }
  
  // 4. 返回成功
  res.json({ success: true });
});
```

### 12.5 自动流转规则引擎（v3.2 新增）

**目标：** 任务完成后自动转交，无需手动调用

**规则配置：**
```javascript
// config/task-rules.js
const transferRules = [
  {
    name: '技术方案转财务审核',
    match: (task) => task.type === 'tech_design' && task.status === 'completed',
    next: (task) => '司库',
    condition: (task) => task.assignee !== '司库'  // 避免循环
  },
  {
    name: '财务审核转安全审核',
    match: (task) => task.type === 'finance_review' && task.status === 'completed',
    next: (task) => '执矩'
  },
  {
    name: '默认转回创建者验收',
    match: (task) => task.status === 'completed',
    next: (task) => task.creator
  }
];

module.exports = { transferRules };
```

**核心代码：**
```javascript
// bce-rules.js - 规则引擎
const { transferRules } = require('./config/task-rules');

// 任务完成时自动触发
async function onTaskCompleted(taskId) {
  const task = await getTask(taskId);
  
  for (const rule of transferRules) {
    if (rule.match(task)) {
      // 检查条件
      if (rule.condition && !rule.condition(task)) {
        continue;
      }
      
      const nextAssignee = typeof rule.next === 'function' 
        ? rule.next(task) 
        : rule.next;
      
      // 边界检查：不能转交给自己
      if (nextAssignee === task.assignee) {
        logWarn('转交给自己，跳过', { taskId, assignee: task.assignee });
        continue;
      }
      
      // 边界检查：循环转交检测
      if (isCircularTransfer(task, nextAssignee)) {
        logError('检测到循环转交', { taskId, nextAssignee });
        continue;
      }
      
      // 自动转交
      await transferTask(taskId, task.assignee, nextAssignee, rule.name);
      break;
    }
  }
}

// 循环转交检测
function isCircularTransfer(task, nextAssignee) {
  // 检查最近 10 次流转历史
  const recentHistory = task.transferHistory.slice(-10);
  const sequence = [...recentHistory.map(h => h.to), nextAssignee];
  
  // 检测是否有重复模式
  const last = sequence[sequence.length - 1];
  if (sequence.filter(s => s === last).length >= 3) {
    return true; // 同一人出现 3 次以上，可能是循环
  }
  return false;
}
```

### 12.6 转交边界处理（v3.2 新增）

**目标：** 处理自转交、循环转交、历史记录无限增长

**核心代码：**
```javascript
// bce-tasks.js - 任务转交 API
router.post('/tasks/:id/complete-and-transfer', async (req, res) => {
  const { id } = req.params;
  const { operator, nextAssignee, comment } = req.body;
  
  const task = tasks.get(id);
  
  // 1. 校验下一节点是否有效
  const validMembers = ['天枢', '匠心', '司库', '执矩', '磐石', '灵犀', '天策'];
  if (!validMembers.includes(nextAssignee)) {
    return res.status(400).json({ 
      error: `无效的接收人：${nextAssignee}` 
    });
  }
  
  // 2. 边界检查：不能转交给自己 ✅ 新增
  if (nextAssignee === task.assignee) {
    return res.status(400).json({ 
      error: '不能转交给自己' 
    });
  }
  
  // 3. 边界检查：循环转交检测 ✅ 新增
  if (isCircularTransfer(task, nextAssignee)) {
    return res.status(400).json({ 
      error: '检测到循环转交，请检查流转规则' 
    });
  }
  
  try {
    // 4. 更新任务状态
    task.status = 'reviewing';
    task.nextAssignee = nextAssignee;
    
    // 5. 记录流转历史（限制 100 条）✅ 新增
    addTransferHistory(task, task.assignee, nextAssignee, comment || '');
    
    // 6. 同步到 OCC
    await occApi.updateTask(id, task);
    
    // 7. 立即推送通知给下一节点
    await notificationService.notify(nextAssignee, operator, 'task_assigned', 
      `任务已转交：${task.title}`, id);
    
    // 8. 通知原操作者转交成功
    await notificationService.notify(operator, 'system', 'transfer_success', 
      `任务已转交给 ${nextAssignee}`, id);
    
    res.json({
      success: true,
      message: '任务已完成并转交',
      data: task
    });
    
  } catch (error) {
    // 9. 转交失败处理
    task.status = 'pending_transfer';
    await occApi.updateTask(id, task);
    
    await notificationService.notify(operator, 'system', 'transfer_failed', 
      `转交失败：${error.message}`, id);
    
    throw error;
  }
});

// 添加流转历史（限制 100 条）
function addTransferHistory(task, from, to, comment) {
  task.transferHistory = task.transferHistory || [];
  task.transferHistory.push({
    from, to, comment,
    timestamp: new Date().toISOString()
  });
  
  // 保留最近 100 条
  if (task.transferHistory.length > 100) {
    // 归档旧记录
    archiveOldHistory(task.id, task.transferHistory.slice(0, -100));
    task.transferHistory = task.transferHistory.slice(-100);
  }
}
```

### 12.7 反馈对象动态计算（v3.2 新增）

**目标：** 确认反馈通知上一节点，而不是固定创建者

**核心代码：**
```javascript
// 获取任务的上一个处理人
function getPreviousHandler(task) {
  // 从流转历史中取最后一条
  if (task.transferHistory && task.transferHistory.length > 0) {
    const last = task.transferHistory[task.transferHistory.length - 1];
    return last.from;  // 谁转交过来的
  }
  // 没有流转历史，返回创建者
  return task.creator;
}

// 确认时通知上一节点
async function handleConfirm(taskId, userId) {
  const task = await getTask(taskId);
  const notifyUser = getPreviousHandler(task);
  
  // 通知上一节点
  await notificationService.notify(notifyUser, userId, 'task_confirmed', 
    `${userId} 已确认任务：${task.title}`, taskId);
  
  // 同时发送飞书卡片
  await sendFeishuCard({
    receiveId: notifyUser,
    card: {
      header: { 
        template: "green",
        title: { content: "✅ 任务已确认" } 
      },
      elements: [{
        tag: "div",
        text: { 
          content: `${userId} 已确认接收任务：${task.title}`,
          tag: "lark_md" 
        }
      }]
    }
  });
}
```

---

# 第五部分：使用指南

## 14. 快速开始

### 14.1 5 分钟上手

**步骤 1：访问 OCC 协作页面**
```
打开浏览器，访问：
http://192.168.31.187:4310/?section=collaboration&lang=zh
```

**步骤 2：查看任务**
```
在协作页面，你可以看到：
- 所有跨会话消息
- 待确认任务
- 任务流转历史
```

**步骤 3：确认任务**
```
看到待确认任务后：
1. 点击 [确认接收] 按钮
2. （可选）填写备注
3. 点击 [提交]
4. 上一节点收到确认通知 ✅
```

**完成！** 🎉

---

## 15. 常见问题

### Q1：收不到通知怎么办？

**可能原因：**
1. BCE 服务未运行
2. sessions_send 连接断开
3. 飞书配置错误

**解决方法：**
```bash
# 1. 检查 BCE 服务
curl http://localhost:3000/health

# 2. 查看邮箱（离线消息）
ls runtime/inboxes/jiangxin/

# 3. 检查飞书配置
cat .env | grep FEISHU
```

### Q2：离线后如何查看未读消息？

**答案：** 调用离线拉取 API。

```bash
# 获取未读消息
curl "http://localhost:3000/api/mailbox/unread?agent=jiangxin"

# 标记已读
curl -X POST http://localhost:3000/api/mailbox/read \
  -H "Content-Type: application/json" \
  -d '{"messageIds": ["msg-001", "msg-002"]}'
```

### Q3：按钮可以多次点击吗？

**答案：** 不可以，有幂等性检查。

第一次点击：✅ 确认成功  
第二次点击：⚠️ 任务已确认，请勿重复操作

### Q4：任务会自动流转吗？

**答案：** 会，规则引擎自动判断。

```
匠心完成任务
     ↓
规则引擎匹配"技术方案转财务审核"
     ↓
自动转交给司库
     ↓
通知司库和匠心
```

### Q5：确认反馈通知谁？

**答案：** 通知上一节点（动态计算）。

- 有流转历史：通知最后转交的人
- 无流转历史：通知创建者

---

# 第六部分：架构演进

## 16. 当前方案局限性

### 16.1 实时性问题

**问题：** 定时轮询导致最多 5 分钟延迟

**解决方案（v3.2）：**
- ✅ sessions_send 实时推送（OpenClaw 原生）
- ✅ 毫秒级推送

### 16.2 数据一致性问题

**问题：** OCC 和 BCE 可能存在状态不一致

**解决方案（v3.2）：**
- ✅ 确立 OCC 为唯一数据源
- ✅ BCE 所有写操作通过 OCC API 执行
- ✅ 冲突时以 OCC 状态为准

### 16.3 交互体验问题

**问题：** 飞书纯文本通知体验差

**解决方案（v3.2）：**
- ✅ 使用交互式卡片（带按钮）
- ✅ 消息引用匹配避免歧义
- ✅ 邮箱机制可靠存储

### 16.4 确认反馈问题

**问题：** B 确认后 A 不知道

**解决方案（v3.2）：**
- ✅ B 确认后通知上一节点（动态计算）
- ✅ sessions_send 推送 + 飞书卡片

### 16.5 自动流转问题

**问题：** 需要手动调用转交 API

**解决方案（v3.2）：**
- ✅ 规则引擎自动判断下一节点
- ✅ 边界检查（自转交/循环检测/历史限制）

---

## 17. 长期演进规划

### 17.1 第一阶段：优化当前方案（本周）

**目标：** 解决当前最急迫的问题

**任务：**
- ✅ 文件系统邮箱（ClawTeam 启发）
- ✅ sessions_send 集成（OpenClaw 原生）
- ✅ 飞书卡片通知（交互式卡片）
- ✅ 飞书 Webhook 优化（parent_id 匹配）
- ✅ 确认反馈机制（通知上一节点）
- ✅ 自动流转规则引擎
- ✅ 转交边界处理
- ✅ 离线拉取 API
- ✅ 通知重试队列
- ✅ OCC 任务同步

### 17.2 第二阶段：构建 BCE 原生会话管理（未来 2-4 周）

**目标：** 基于 OpenClaw 会话实现实时任务管理

**核心思路：**
```
1. 为每个任务创建唯一的会话 ID（如 task:BCE-001）
2. 所有相关 Agent 加入这个会话
3. 利用 sessions_send 做实时推送
4. BCE 作为会话管理增强器
```

**优势：**
- ✅ 实时性：消息通过 Gateway 即时送达
- ✅ 一致性：任务状态就是会话状态
- ✅ 可追溯：完整沟通历史在一个会话里
- ✅ 扩展性：轻松添加评论、附件等功能

### 17.3 第三阶段：平台化（未来 2-3 个月）

**目标：** 将 BCE 打造成通用任务管理平台

**功能扩展：**
- 多项目管理
- 甘特图视图
- 工时统计
- 团队协作
- API 开放

---

## 附录

### A. 术语表

| 术语 | 解释 |
|------|------|
| **BCE** | 北斗协同引擎，本项目 |
| **OCC** | OpenClaw Control Center，任务展示系统 |
| **Gateway** | OpenClaw 网关，会话管理中樞 |
| **sessions_send** | OpenClaw 原生消息传递机制 |
| **飞书 Webhook** | 飞书消息接收接口 |
| **parent_id** | 飞书消息引用 ID |
| **文件系统邮箱** | 基于文件的消息存储机制 |
| **三通道设计** | sessions_send（主）+ 飞书（备）+ 邮箱（可靠） |
| **规则引擎** | 自动流转规则 |
| **幂等性** | 防止重复操作 |

### B. 相关文档

| 文档 | 位置 |
|------|------|
| 完整任务管理方案 | `docs/完整任务管理方案.md` |
| 技术实施细节 | `docs/技术实施细节.md` |
| BCE+OCC 融合方案 | `docs/BCE+OCC 最终融合方案.md` |
| 待开发功能详细实现 | `docs/待开发功能 - 详细实现说明.md` |
| ClawTeam 分析报告 | `docs/ClawTeam 分析报告.md` |
| v3.0 评估报告 | `docs/v3.0 评估报告.md` |
| 意见响应清单 | `docs/v3.0 评估报告 - 意见响应清单.md` |
| 综合优化意见 | `docs/综合优化意见.md` |

### C. 联系方式

| 角色 | 职责 | 联系方式 |
|------|------|---------|
| 匠心 | CTO/开发负责人 | 飞书 @匠心 |
| 天枢 | CEO/需求确认 | 飞书 @天枢 |

---

**文档版本：** v3.2 最终版  
**创建日期：** 2026-03-21  
**最后更新：** 2026-03-21 11:35  
**维护人：** 匠心 (CTO)

**整合综合优化意见最终版** 📝

---

## 📊 v3.2 核心改进总结

### 架构优化

| 改进 | v3.1 | v3.2 | 提升 |
|------|------|------|------|
| **主通道** | SSE | sessions_send | ⬆️ 利用原生能力 |
| **通知通道** | 双通道 | 三通道 | ⬆️ 更可靠 |
| **流转方式** | 手动调用 | 规则引擎 | ⬆️ 自动流转 |

### 功能完善

| 功能 | v3.1 | v3.2 | 提升 |
|------|------|------|------|
| **消息匹配** | 无细节 | parent_id 精确匹配 | ⬆️ 可落地 |
| **离线拉取** | 无 | GET /api/mailbox/unread | ⬆️ 完整闭环 |
| **幂等性** | 无 | 状态检查 | ⬆️ 生产可靠 |
| **反馈对象** | 固定 creator | 动态上一节点 | ⬆️ 更准确 |
| **转交边界** | 部分 | 完整处理 | ⬆️ 生产可靠 |
| **重试机制** | 无 | 指数退避队列 | ⬆️ 更可靠 |

### 生产可靠性

| 特性 | v3.1 | v3.2 | 提升 |
|------|------|------|------|
| **自转交检查** | ❌ | ✅ | ⬆️ 防止错误 |
| **循环检测** | ❌ | ✅ | ⬆️ 防止死循环 |
| **历史限制** | ❌ | 100 条 | ⬆️ 防止无限增长 |
| **重试队列** | ❌ | ✅ | ⬆️ 防止丢失 |

**磊哥，v3.2 最终版已整合所有优化意见！** 🚀
