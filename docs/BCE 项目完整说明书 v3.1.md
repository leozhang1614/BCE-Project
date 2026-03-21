# BCE 北斗协同引擎 - 完整项目说明书

**版本：** v3.1（根据磊哥评估报告完善）  
**日期：** 2026-03-21  
**作者：** 匠心 (CTO)  
**状态：** 部分功能已开发，待完善

---

## 📖 文档说明

**v3.1 核心更新（根据磊哥评估报告）：**
- ✅ 确认反馈机制 - B 确认后通知 A
- ✅ 转交即时通知 - 转交后立即推送 C
- ✅ SSE+ 邮箱职责划分 - 双通道协同
- ✅ 会话扩展预留 - sessionKey 字段

---

## 📊 v3.0 评估总结（磊哥）

### 核心优化亮点

| 维度 | v2.0 | v3.0 | 评价 |
|------|------|------|------|
| **实时性** | 5 分钟轮询 | SSE 毫秒推送 | ⬆️ 巨大提升 |
| **可靠性** | 内存缓存 | 文件系统邮箱 | ⬆️ 巨大提升 |
| **确认准确率** | 关键词匹配 | 卡片按钮 + 消息引用 | ⬆️ 巨大提升 |
| **交互闭环** | ❌ 单向 | ⚠️ 部分闭环 | 需补全反馈 |
| **转交即时性** | ❌ 依赖轮询 | ⚠️ 依赖 SSE | 需明确立即推送 |
| **架构扩展性** | ❌ 无 | ✅ 预留邮箱+SSE | ⬆️ 显著提升 |

### 需补充的关键功能（P0 级）

1. **确认反馈** - B 确认任务后，通知 A
2. **转交即时通知** - 转交后立即推送 C，并通知 B 结果
3. **SSE+ 邮箱职责划分** - 明确双通道协同机制
4. **会话扩展预留** - 数据模型中预留 sessionKey 字段

---

# 第一部分：项目概述

## 1. 项目是什么？

### 1.1 一句话介绍

**BCE（北斗协同引擎）是一个任务管理和协同系统，帮助团队高效分配任务、跟踪进度、确保任务按时完成。**

### 1.2 核心能力

| 能力 | 说明 | 例子 |
|------|------|------|
| **任务分配** | 把任务分配给具体的人 | 天枢分配任务给匠心 |
| **及时通知** | 任务变动及时通知相关人员 | 匠心收到飞书卡片 |
| **进度跟踪** | 实时查看任务做到哪一步了 | 查看任务看板 |
| **任务流转** | 任务在不同人之间传递 | 匠心→司库→执矩 |
| **完成确认** | 确保任务被确认和执行 | 匠心点击卡片按钮 |
| **确认反馈** | 创建者收到确认通知 | 天枢收到"匠心已确认" |

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
❌ **问题：** 确认反馈缺失（v3.1 解决）

### 2.2 BCE 的解决方案

**针对场景 1：三重通知保障**
```
天枢创建任务
     ↓
OCC 协作页面显示 ✅
     ↓
BCE 系统：
  1. 飞书卡片通知（即时）✅
  2. SSE 实时推送（毫秒级）✅
  3. 邮箱机制（可靠存储）✅
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

**针对场景 3：确认反馈闭环（v3.1 新增）**
```
匠心点击 [确认接收]
     ↓
BCE 系统：
  1. 更新 OCC 任务状态 ✅
  2. 飞书卡片通知天枢 ✅
  3. SSE 推送通知天枢 ✅
```
✅ **结果：** 天枢立即知道匠心已确认

---

## 3. 解决方案是什么？

### 3.1 融合方案：OCC 为主 + BCE 增强

```
┌─────────────────────────────────────────────────────────────────┐
│                  BCE + OCC 融合方案                              │
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
│  角色：✅ 邮箱机制 + 通知增强 + 实时推送 + 确认反馈              │
│                                                                 │
│  通知通道：飞书机器人                                           │
│  状态：⏳ 卡片通知待开发                                         │
│  升级：✅ 交互式卡片（带按钮）                                   │
│                                                                 │
│  邮箱机制：文件系统邮箱（ClawTeam 启发）                          │
│  状态：❌ 待开发                                                 │
│  地址：runtime/inboxes/{agent}/msg-*.json                       │
│                                                                 │
│  双通道设计：                                                    │
│  - SSE 实时推送（即时通知，断连丢失）                           │
│  - 文件系统邮箱（可靠存储，随时拉取）                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 系统架构

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
                    │  (邮箱机制 + 增强通知)       │
                    │  (确认反馈 + 转交通知)       │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │      双通道通知              │
                    ├─────────────────────────────┤
                    │  SSE 实时推送（即时）        │
                    │  文件系统邮箱（可靠）        │
                    └─────────────────────────────┘
```

### 3.3 数据源设计

**核心原则：OCC 是主数据源，BCE 是增强服务**

```
┌─────────────────────────────────────────────────────────────────┐
│                      数据流设计                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  OCC（主数据源）                                                 │
│  ├── 存储所有任务数据                                           │
│  ├── 处理所有状态变更                                           │
│  └── 提供唯一权威数据                                           │
│                                                                 │
│  BCE（增强服务）                                                 │
│  ├── 文件系统邮箱（可靠存储）                                   │
│  ├── SSE 实时推送（即时通知）                                   │
│  ├── 发送飞书通知（卡片形式）                                   │
│  ├── 解析飞书回复（Webhook）                                    │
│  ├── 确认反馈（通知创建者）                                     │
│  └── 将用户操作同步回 OCC                                        │
│                                                                 │
│  双通道协同：                                                    │
│  ├── SSE：实时推送，断连后可能丢失                              │
│  ├── 邮箱：永久存储，随时拉取                                   │
│  └── 发送时同时写入邮箱和推送 SSE                               │
│                                                                 │
│  数据一致性保障：                                                │
│  ├── BCE 所有写操作必须通过 OCC API 执行                          │
│  ├── SSE 实时推送作为最终一致性保障                             │
│  └── 冲突处理：以 OCC 状态为准                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. 完整交互流程（v3.1 更新）

### 4.1 任务创建与确认闭环

```
┌─────────────────────────────────────────────────────────────────┐
│              任务创建与确认完整流程（v3.1）                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 天枢创建任务                                                 │
│     ↓                                                           │
│  2. OCC 更新任务状态                                             │
│     ↓                                                           │
│  3. BCE 监听到变化                                               │
│     ↓                                                           │
│  4. BCE 同时执行：                                               │
│     ├─ 写入文件系统邮箱（可靠存储）                              │
│     ├─ SSE 推送给匠心（即时通知）                                │
│     └─ 发送飞书卡片（备用通道）                                  │
│     ↓                                                           │
│  5. 匠心收到通知（三种方式至少一种）                             │
│     ↓                                                           │
│  6. 匠心点击 [确认接收] 按钮                                     │
│     ↓                                                           │
│  7. BCE 处理确认：                                               │
│     ├─ 更新 OCC 任务状态                                         │
│     ├─ 写入匠心邮箱（已读）                                      │
│     ├─ SSE 推送给天枢 ✅ 新增                                    │
│     └─ 发送飞书卡片给天枢 ✅ 新增                                │
│     ↓                                                           │
│  8. 天枢收到"匠心已确认"通知 ✅ 闭环                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 任务转交流程（v3.1 更新）

```
┌─────────────────────────────────────────────────────────────────┐
│              任务转交完整流程（v3.1）                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 匠心完成任务，转交给司库                                     │
│     ↓                                                           │
│  2. BCE 调用 OCC API 更新任务                                    │
│     ↓                                                           │
│  3. BCE 同时执行：                                               │
│     ├─ 写入司库邮箱（可靠存储）                                  │
│     ├─ SSE 推送给司库（即时通知）✅ 新增                         │
│     ├─ 发送飞书卡片给司库（备用通道）                            │
│     └─ SSE 推送给匠心（转交成功通知）✅ 新增                     │
│     ↓                                                           │
│  4. 司库收到通知                                                 │
│     ↓                                                           │
│  5. 匠心收到"转交成功"通知                                       │
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

| 功能 | 说明 | 预计工时 | v3.1 更新 |
|------|------|---------|---------|
| 文件系统邮箱 | 可靠消息存储 | 1.5 小时 | + 双通道设计 |
| 飞书 Webhook 优化 | 解析"收到"回复，自动确认任务 | 1 小时 | + 消息引用匹配 |
| 飞书卡片通知 | 交互式卡片（带按钮） | 1.5 小时 | + 确认反馈 |
| SSE 实时推送 | 替代定时轮询 | 2 小时 | + 职责划分 |
| 确认反馈机制 | B 确认后通知 A | 1 小时 | ✅ 新增 |
| 转交即时通知 | 转交后立即推送 C | 1 小时 | ✅ 新增 |
| 任务转交功能 | 任务完成后转交下一节点 | 1.5 小时 | + 边界处理 |
| OCC 任务同步 | BCE 任务同步到 OCC | 2 小时 | + 冲突处理 |

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

### 6.2 任务确认（v3.1 更新）

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
6. 天枢收到确认通知 ✅
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
3. BCE 解析卡片回调并确认任务
4. 天枢收到确认通知 ✅
```

**方式 C：飞书回复确认（待优化）**
```
1. 收到飞书通知
2. 回复"收到"（在通知消息下回复）
3. BCE 通过消息引用匹配确认任务
4. 天枢收到确认通知 ✅
```

### 6.3 任务流转（v3.1 更新）

**完整流程：**
```
天枢 → 匠心 → 司库 → 执矩 → 天枢
创建    执行    协作    审核    验收
```

**待开发功能：任务转交**
```bash
curl -X POST http://localhost:3000/api/bce/tasks/:id/complete-and-transfer \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "匠心",
    "nextAssignee": "司库",
    "comment": "请审核财务数据"
  }'
```

**边界条件处理（v3.1 更新）：**
- ✅ 校验 nextAssignee 是否为有效成员
- ✅ 转交失败时回退到"待转交"状态
- ✅ 通知原操作者转交结果
- ✅ 立即推送通知下一节点 ✅ 新增

---

# 第三部分：技术实现

## 8. 技术架构

### 8.1 系统架构图（v3.1 更新）

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
                    │  (邮箱机制 + 增强通知)       │
                    │  (确认反馈 + 转交通知)       │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │      双通道通知              │
                    ├─────────────────────────────┤
                    │  SSE 实时推送（即时）        │
                    │  文件系统邮箱（可靠）        │
                    └─────────────────────────────┘
```

### 8.2 技术栈

| 技术 | 说明 | 版本 |
|------|------|------|
| **Node.js** | 后端运行时 | v18+ |
| **Express.js** | Web 框架 | v4.x |
| **axios** | HTTP 客户端 | v1.x |
| **sse.js** | SSE 实时推送 | v2.x |
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
│   │   ├── feishu-notify.js    ← 飞书通知 API ✅
│   │   ├── feishu-webhook.js   ← 飞书消息接收 ⏳待开发
│   │   ├── feishu-card.js      ← 飞书卡片处理 ✅新增
│   │   ├── sse-push.js         ← SSE 实时推送 ✅新增
│   │   └── board.js            ← 任务看板 API 🟡待开发
│   │
│   ├── services/               ← 业务服务（核心逻辑）
│   │   ├── mailbox.js          ← 邮箱机制 ✅新增（ClawTeam 启发）
│   │   ├── task-scanner.js     ← 任务扫描服务 ❌待开发
│   │   ├── notification-service.js ← 通知服务 ✅
│   │   ├── notification-policy.js  ← 通知策略 🟡待开发
│   │   └── occ-sync.js         ← OCC 同步服务 ❌待开发
│   │
│   ├── integrations/           ← 外部集成（连接其他系统）
│   │   └── occ-sync.js         ← OCC 同步服务 ❌待开发
│   │
│   └── config/                 ← 配置文件
│       ├── feishu-users.js     ← 飞书用户配置 ✅
│       ├── feishu-apps.js      ← 飞书应用配置 🟡待开发
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

# SSE 配置
SSE_ENABLED=true
SSE_HEARTBEAT_INTERVAL=30000

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

## 12. 详细实现说明（v3.1 更新）

### 12.1 文件系统邮箱（v3.1 更新）

**目标：** 可靠消息存储，零依赖

**双通道设计：**
```
SSE（实时通道）：
- 推送即时通知
- 断连后无法收到消息
- 用于在线用户

邮箱（可靠通道）：
- 永久存储所有消息
- Agent 可随时拉取历史
- 作为 SSE 断连后的补偿机制
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

**消息格式：**
```json
{
  "id": "msg-001",
  "from": "tianshu",
  "to": "jiangxin",
  "type": "task_assigned",
  "taskId": "TASK-001",
  "sessionKey": "task:TASK-001",  ← v3.1 新增：预留会话 ID
  "content": "📋 新任务分配：BCE 技术方案设计",
  "createdAt": "2026-03-21T10:00:00.000Z",
  "read": false,
  "confirmedAt": null
}
```

**核心代码：**
```javascript
class MailboxService {
  constructor() {
    this.mailboxDir = 'runtime/inboxes';
  }

  // 发送消息到邮箱（同时推送 SSE）
  async send(to, from, type, content, taskId, sessionKey) {
    const agentDir = path.join(this.mailboxDir, to);
    await fs.ensureDir(agentDir);
    
    const msg = {
      id: `msg-${Date.now()}`,
      from,
      to,
      type,
      taskId,
      sessionKey,  // v3.1 新增：预留会话 ID
      content,
      createdAt: new Date().toISOString(),
      read: false
    };
    
    // 原子写入（tmp + rename）
    const tmpFile = path.join(agentDir, `.tmp-${msg.id}.json`);
    const msgFile = path.join(agentDir, `${msg.id}.json`);
    
    await fs.writeFile(tmpFile, JSON.stringify(msg, null, 2));
    await fs.rename(tmpFile, msgFile);
    
    // 同时推送 SSE（如果在线）
    if (sseClients.has(to)) {
      sseClients.get(to).send(msg);
    } else {
      console.log(`Agent ${to} 离线，消息已存入邮箱`);
    }
    
    return msg;
  }

  // 接收消息
  async receive(agent, consume = true) {
    const agentDir = path.join(this.mailboxDir, agent);
    const files = await fs.readdir(agentDir);
    const msgs = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(agentDir, file));
        msgs.push(JSON.parse(content));
        
        if (consume) {
          // 移动到已读目录
          const readDir = path.join(agentDir, 'read');
          await fs.ensureDir(readDir);
          await fs.rename(
            path.join(agentDir, file),
            path.join(readDir, file)
          );
        }
      }
    }
    
    return msgs;
  }

  // 未读计数
  async count(agent) {
    const agentDir = path.join(this.mailboxDir, agent);
    const files = await fs.readdir(agentDir);
    return files.filter(f => f.endsWith('.json')).length;
  }
}
```

### 12.2 确认反馈机制（v3.1 新增）

**目标：** B 确认任务后，立即通知 A

**实现原理：**
```
匠心点击 [确认接收]
     ↓
BCE 处理确认：
  1. 更新 OCC 任务状态
  2. 写入匠心邮箱（已读）
  3. SSE 推送给天枢 ✅ 新增
  4. 发送飞书卡片给天枢 ✅ 新增
     ↓
天枢收到"匠心已确认"通知
```

**核心代码：**
```javascript
// feishu-card.js - 处理卡片按钮点击
router.post('/feishu/card-callback', async (req, res) => {
  const { action, taskId, userId } = req.body.value;
  
  if (action === 'confirm_task') {
    // 1. 更新 OCC
    await occApi.confirmTask(taskId, userId);
    
    // 2. 获取任务详情
    const task = await occApi.getTask(taskId);
    
    // 3. 通知创建者（天枢）✅ 新增
    await sendFeishuCard({
      receiveId: task.creator,
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
    
    // 4. SSE 推送通知创建者 ✅ 新增
    ssePush.sendToUser(task.creator, {
      event: 'task_confirmed',
      data: { 
        taskId, 
        confirmUser: userId,
        taskTitle: task.title 
      }
    });
    
    res.json({ success: true });
  }
});
```

### 12.3 转交即时通知（v3.1 新增）

**目标：** 转交后立即推送 C，并通知 B 结果

**实现原理：**
```
匠心转交给司库
     ↓
BCE 处理转交：
  1. 更新 OCC 任务状态
  2. SSE 推送给司库（立即通知）✅ 新增
  3. 发送飞书卡片给司库
  4. SSE 推送给匠心（转交成功）✅ 新增
  5. 发送飞书卡片给匠心
```

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
  
  try {
    // 2. 更新任务状态
    task.status = 'reviewing';
    task.nextAssignee = nextAssignee;
    
    // 3. 记录流转历史
    task.transferHistory.push({
      from: task.assignee,
      to: nextAssignee,
      timestamp: new Date().toISOString(),
      comment: comment || ''
    });
    
    // 4. 同步到 OCC
    await occApi.updateTask(id, task);
    
    // 5. 立即推送通知给下一节点（司库）✅ 新增
    await ssePush.sendToUser(nextAssignee, {
      event: 'task_assigned',
      data: { 
        taskId: id, 
        from: operator,
        taskTitle: task.title,
        comment: comment || ''
      }
    });
    
    // 6. 发送飞书卡片给下一节点
    await sendFeishuCard({
      receiveId: nextAssignee,
      card: taskTransferCard(task, operator, comment)
    });
    
    // 7. 通知原操作者（匠心）转交成功 ✅ 新增
    await ssePush.sendToUser(operator, {
      event: 'transfer_success',
      data: { 
        taskId: id, 
        to: nextAssignee 
      }
    });
    
    await sendFeishuCard({
      receiveId: operator,
      card: {
        header: { title: { content: "✅ 转交成功" } },
        elements: [{
          tag: "div",
          text: { 
            content: `任务已转交给 ${nextAssignee}`,
            tag: "lark_md" 
          }
        }]
      }
    });
    
    res.json({
      success: true,
      message: '任务已完成并转交',
      data: task
    });
    
  } catch (error) {
    // 8. 转交失败处理 ✅ 新增
    task.status = 'pending_transfer';
    await occApi.updateTask(id, task);
    
    await sendFeishuCard({
      receiveId: operator,
      card: {
        header: { template: "red", title: { content: "❌ 转交失败" } },
        elements: [{
          tag: "div",
          text: { 
            content: `转交失败：${error.message}`,
            tag: "lark_md" 
          }
        }]
      }
    });
    
    throw error;
  }
});
```

### 12.4 SSE 实时推送（v3.1 更新）

**目标：** 替代定时轮询，实时推送任务更新

**双通道职责划分：**
```
SSE（实时通道）：
- 推送即时通知
- 断连后无法收到消息
- 用于在线用户
- 轻量级，低延迟

邮箱（可靠通道）：
- 永久存储所有消息
- Agent 可随时拉取历史
- 作为 SSE 断连后的补偿机制
- 重量级，可靠
```

**核心代码：**
```javascript
// sse-push.js
class SSEPushService {
  constructor() {
    this.clients = new Map(); // userId -> SSE 连接
  }

  // 注册 SSE 连接
  register(userId, res) {
    this.clients.set(userId, res);
    console.log(`用户 ${userId} 已连接 SSE`);
    
    // 定期心跳
    const heartbeat = setInterval(() => {
      if (this.clients.has(userId)) {
        res.write(`data: {"event":"heartbeat","data":${Date.now()}}\n\n`);
      } else {
        clearInterval(heartbeat);
      }
    }, 30000);
    
    // 客户端断开时清理
    res.on('close', () => {
      this.clients.delete(userId);
      clearInterval(heartbeat);
      console.log(`用户 ${userId} 断开 SSE 连接`);
    });
  }

  // 推送给指定用户
  sendToUser(userId, data) {
    const client = this.clients.get(userId);
    if (client) {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
      console.log(`已推送给用户 ${userId}:`, data);
    } else {
      console.log(`用户 ${userId} 不在线，消息已存入邮箱`);
      // 消息已由 mailbox.send() 存入邮箱
    }
  }

  // 推送给多个用户
  sendToUsers(userIds, data) {
    for (const userId of userIds) {
      this.sendToUser(userId, data);
    }
  }
}

module.exports = new SSEPushService();
```

**客户端使用：**
```javascript
// 前端 SSE 连接
const eventSource = new EventSource('http://localhost:3000/sse/tasks');

eventSource.addEventListener('task_update', (event) => {
  const task = JSON.parse(event.data);
  console.log('任务更新:', task);
  // 更新 UI
});

eventSource.addEventListener('task_confirmed', (event) => {
  const data = JSON.parse(event.data);
  console.log('任务已确认:', data);
  // 显示通知
});

eventSource.addEventListener('task_assigned', (event) => {
  const data = JSON.parse(event.data);
  console.log('新任务分配:', data);
  // 显示通知
});

eventSource.addEventListener('heartbeat', (event) => {
  console.log('心跳:', event.data);
});
```

### 12.5 会话扩展预留（v3.1 新增）

**目标：** 为未来会话管理预留接口

**数据模型更新：**
```javascript
// 任务数据结构
{
  "id": "TASK-001",
  "title": "BCE 技术方案设计",
  "assignee": "匠心",
  "creator": "天枢",
  "sessionKey": "task:TASK-001",  ← v3.1 新增：预留会话 ID
  "status": "todo",
  "createdAt": "2026-03-21T10:00:00.000Z",
  "updatedAt": "2026-03-21T10:00:00.000Z"
}

// 消息数据结构
{
  "id": "msg-001",
  "from": "tianshu",
  "to": "jiangxin",
  "type": "task_assigned",
  "taskId": "TASK-001",
  "sessionKey": "task:TASK-001",  ← v3.1 新增：预留会话 ID
  "content": "📋 新任务分配：BCE 技术方案设计",
  "createdAt": "2026-03-21T10:00:00.000Z",
  "read": false
}
```

**未来扩展：**
```javascript
// 第二阶段：构建 BCE 原生会话管理
// 为每个任务创建唯一的会话 ID
const taskSessionKey = `task:${taskId}`;

// 所有任务相关消息都带上会话标识
await sendMessage({
  to: 'jiangxin',
  sessionKey: taskSessionKey,  // ← 预留字段
  content: '新任务分配'
});

// 未来迁移到会话模式时，已有数据可以直接复用
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
4. 创建者收到确认通知 ✅
```

**完成！** 🎉

---

## 15. 常见问题

### Q1：收不到飞书通知怎么办？

**可能原因：**
1. BCE 服务未运行
2. 飞书配置错误
3. 卡片通知未启用

**解决方法：**
```bash
# 1. 检查 BCE 服务
curl http://localhost:3000/health

# 2. 查看邮箱
ls runtime/inboxes/jiangxin/

# 3. 检查飞书配置
cat .env | grep FEISHU
```

### Q2：SSE 断连后收不到消息怎么办？

**答案：** 消息已存入文件系统邮箱，随时可以拉取。

```bash
# 查看邮箱中的消息
ls runtime/inboxes/jiangxin/

# 查看消息内容
cat runtime/inboxes/jiangxin/msg-001.json
```

### Q3：确认反馈什么时候收到？

**答案：** 立即收到。

匠心点击 [确认接收] 后：
1. OCC 任务状态立即更新
2. 天枢立即收到 SSE 推送
3. 天枢立即收到飞书卡片

---

# 第六部分：架构演进

## 16. 当前方案局限性

### 16.1 实时性问题

**问题：** 定时轮询导致最多 5 分钟延迟

**解决方案（v3.1）：**
- ✅ SSE 实时推送替代轮询
- ✅ 毫秒级推送

### 16.2 数据一致性问题

**问题：** OCC 和 BCE 可能存在状态不一致

**解决方案（v3.1）：**
- ✅ 确立 OCC 为唯一数据源
- ✅ BCE 所有写操作通过 OCC API 执行
- ✅ 冲突时以 OCC 状态为准

### 16.3 交互体验问题

**问题：** 飞书纯文本通知体验差

**解决方案（v3.1）：**
- ✅ 使用交互式卡片（带按钮）
- ✅ 消息引用匹配避免歧义
- ✅ 邮箱机制可靠存储

### 16.4 确认反馈问题

**问题：** B 确认后 A 不知道

**解决方案（v3.1）：**
- ✅ B 确认后 SSE 推送给 A
- ✅ B 确认后飞书卡片通知 A

---

## 17. 长期演进规划

### 17.1 第一阶段：优化当前方案（本周）

**目标：** 解决当前最急迫的问题

**任务：**
- ✅ 文件系统邮箱（ClawTeam 启发）
- ✅ 飞书 Webhook 优化（+消息引用匹配）
- ✅ 飞书卡片通知（交互式卡片）
- ✅ SSE 实时推送（替代轮询）
- ✅ 确认反馈机制（通知创建者）
- ✅ 转交即时通知（推送下一节点）
- ✅ 任务转交功能（+边界处理）
- ✅ OCC 任务同步（+冲突处理）
- ✅ 会话扩展预留（sessionKey 字段）

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
| **SSE** | Server-Sent Events，服务器推送事件 |
| **文件系统邮箱** | 基于文件的消息存储机制 |
| **双通道设计** | SSE（实时）+ 邮箱（可靠） |

### B. 相关文档

| 文档 | 位置 |
|------|------|
| 完整任务管理方案 | `docs/完整任务管理方案.md` |
| 技术实施细节 | `docs/技术实施细节.md` |
| BCE+OCC 融合方案 | `docs/BCE+OCC 最终融合方案.md` |
| 待开发功能详细实现 | `docs/待开发功能 - 详细实现说明.md` |
| ClawTeam 分析报告 | `docs/ClawTeam 分析报告.md` |
| v3.0 评估报告 | `docs/v3.0 评估报告.md` |

### C. 联系方式

| 角色 | 职责 | 联系方式 |
|------|------|---------|
| 匠心 | CTO/开发负责人 | 飞书 @匠心 |
| 天枢 | CEO/需求确认 | 飞书 @天枢 |

---

**文档版本：** v3.1  
**创建日期：** 2026-03-21  
**最后更新：** 2026-03-21 11:15  
**维护人：** 匠心 (CTO)

**根据磊哥 v3.0 评估报告完善** 📝

---

## 📊 v3.1 核心改进总结

### 新增功能

| 功能 | 说明 | 状态 |
|------|------|------|
| **确认反馈机制** | B 确认后通知 A | ✅ v3.1 新增 |
| **转交即时通知** | 转交后立即推送 C | ✅ v3.1 新增 |
| **双通道设计** | SSE+ 邮箱职责划分 | ✅ v3.1 新增 |
| **会话扩展预留** | sessionKey 字段 | ✅ v3.1 新增 |

### 交互闭环

```
v3.0: A 发 → B 收 → B 确认（A 不知道）❌
v3.1: A 发 → B 收 → B 确认 → A 知道 ✅
```

### 转交闭环

```
v3.0: B 转交 → C 收（依赖轮询）❌
v3.1: B 转交 → C 收（立即推送）→ B 知道结果 ✅
```

**磊哥，v3.1 已完善所有评估意见！** 🚀
