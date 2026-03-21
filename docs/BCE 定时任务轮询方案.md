# BCE 定时任务轮询方案 - 详细设计

**版本：** v2.0  
**日期：** 2026-03-21 09:05  
**提出人：** 磊哥  
**设计人：** 匠心 (CTO)

---

## 📊 方案核心思路

**轮询 + 通知双保险**

```
┌─────────────────────────────────────────────────────────────┐
│                    BCE 定时任务轮询方案                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  定时轮询（5 分钟）          飞书通知（即时）                │
│  ┌────────────┐             ┌────────────┐                 │
│  │ 扫描任务表  │             │ 任务创建    │                 │
│  │ 发现新任务  │ ────────→   │ 飞书@通知  │                 │
│  │ 标记已读    │             │ 提醒查看   │                 │
│  └────────────┘             └────────────┘                 │
│         ↓                           ↓                        │
│  任务列表操作确认            飞书回复确认                     │
│                                                             │
│  ✅ 双保险：即使飞书@失效，轮询也能保证任务不遗漏             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 方案优势

### 对比纯飞书@方案

| 维度 | 纯飞书@ | 轮询 + 通知 |
|------|---------|-------------|
| **可靠性** | ❌ 依赖@功能 | ✅ 双重保障 |
| **及时性** | ✅ 即时 | ✅ 轮询 5 分钟 + 飞书即时 |
| **确认方式** | 单一日 | 多样化 |
| **容错性** | ❌ @失效则全挂 | ✅ 任一通道有效即可 |
| **实施成本** | 中 | 低 |

### 对比纯 OCC 方案

| 维度 | OCC 原生 | 轮询 + 通知 |
|------|---------|-------------|
| **学习成本** | ❌ 需要新界面 | ✅ 熟悉飞书 |
| **使用习惯** | ❌ 主动查看页面 | ✅ 被动接收通知 |
| **实施速度** | ❌ 需部署 OCC | ✅ 立即可改 |
| **依赖** | ❌ OCC 服务 | ✅ BCE 独立 |

---

## 📋 详细实施设计

### 1. 定时任务配置

#### 每个成员的定时任务

```javascript
// BCE-Project/src/scheduler/task-scheduler.js

const cron = require('node-cron');

// 成员列表
const TEAM_MEMBERS = [
  { name: '天枢', agentId: 'tianshu' },
  { name: '匠心', agentId: 'jiangxin' },
  { name: '司库', agentId: 'siku' },
  { name: '执矩', agentId: 'zhiju' },
  { name: '磐石', agentId: 'panshi' },
  { name: '灵犀', agentId: 'lingxi' }
];

// 为每个成员创建定时任务（每 5 分钟）
TEAM_MEMBERS.forEach(member => {
  // 每 5 分钟执行一次
  cron.schedule('*/5 * * * *', async () => {
    console.log(`[定时任务] 开始扫描 ${member.name} 的任务列表`);
    await scanAndProcessTasks(member.agentId);
  });
  
  console.log(`[定时任务] 已为 ${member.name} 创建定时任务`);
});
```

### 2. 任务扫描逻辑

```javascript
// BCE-Project/src/services/task-scanner.js

/**
 * 扫描并处理任务
 */
async function scanAndProcessTasks(agentId) {
  // 1. 获取该成员的所有任务
  const tasks = await getTasksByAssignee(agentId);
  
  // 2. 筛选出新增未确认的任务
  const newTasks = tasks.filter(task => 
    task.status === 'assigned' && 
    !task.confirmedBy &&
    isNewTask(task) // 5 分钟内创建的任务
  );
  
  // 3. 处理每个新任务
  for (const task of newTasks) {
    // 3.1 自动标记为已读（避免重复通知）
    await markTaskAsRead(task.id, agentId);
    
    // 3.2 发送飞书通知
    await sendFeishuNotification(task, agentId);
    
    // 3.3 记录扫描日志
    logScan(agentId, task.id, 'scanned');
  }
  
  // 4. 检查任务状态变更（通知发起人）
  await checkTaskStatusChanges(agentId);
}

/**
 * 检查任务状态变更
 */
async function checkTaskStatusChanges(agentId) {
  // 获取该成员创建的任务
  const createdTasks = await getTasksByCreator(agentId);
  
  for (const task of createdTasks) {
    // 检查是否有状态更新
    const changes = await getTaskChanges(task.id);
    
    if (changes.length > 0) {
      // 通知发起人
      await notifyCreator(task, changes);
    }
  }
}
```

### 3. 任务确认流程

#### 方式 A：飞书回复确认

```
场景：匠心收到新任务通知

飞书消息：
┌─────────────────────────────────────────┐
│ 📋 新任务分配                            │
│                                         │
│ 【任务 ID】TASK-001                      │
│ 【任务名称】BCE 技术方案设计              │
│ 【优先级】P0                            │
│ 【截止时间】2026-03-21 18:00            │
│                                         │
│ 回复"收到"确认任务，或点击链接查看        │
│ 查看：http://localhost:3000/bce-tasks   │
└─────────────────────────────────────────┘

匠心回复："收到"

→ BCE 系统解析飞书消息
→ 调用 API 确认任务
→ 更新任务状态
```

**代码实现：**

```javascript
// BCE-Project/src/api/feishu-webhook.js

router.post('/webhook', async (req, res) => {
  const { event } = req.body;
  const message = event.message;
  const text = message.content.text;
  const senderId = message.sender_id.user_id;
  
  // 解析飞书消息
  const senderName = getUserNameById(senderId);
  
  // 检查是否是确认回复
  if (text.includes('收到') || text.includes('确认')) {
    // 提取任务 ID（从上下文或引用消息）
    const taskId = extractTaskIdFromContext(message);
    
    if (taskId) {
      // 确认任务
      await confirmTask(taskId, senderName);
      
      // 回复确认
      await replyFeishu(message.chat_id, '✅ 任务已确认');
    }
  }
  
  res.json({ success: true });
});
```

#### 方式 B：任务列表页面确认

```
匠心头脑访问：http://localhost:3000/bce-tasks.html

┌─────────────────────────────────────────────────────────┐
│  我的任务 - 匠心                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🟡 待确认 (2)                                          │
│  ─────────────────                                      │
│  □ TASK-001: BCE 技术方案设计 [确认收到] [查看详情]      │
│  □ TASK-002: 前端页面设计 [确认收到] [查看详情]          │
│                                                         │
│  🟢 进行中 (3)                                          │
│  ─────────────────                                      │
│  ✓ TASK-000: 知识库初始化 [提交验收]                    │
│  ✓ ...                                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘

匠心点击 [确认收到] → 任务状态更新
```

### 4. 任务完成后转交流程

```javascript
// BCE-Project/src/api/bce-tasks.js

/**
 * 完成任务并转交下一节点
 * POST /api/bce/tasks/:id/complete-and-transfer
 * Body: { 
 *   operator: string, 
 *   deliverables: string[], 
 *   nextAssignee: string,
 *   comment: string 
 * }
 */
router.post('/tasks/:id/complete-and-transfer', async (req, res) => {
  try {
    const { id } = req.params;
    const { operator, deliverables, nextAssignee, comment } = req.body;
    
    const task = tasks.get(id);
    
    // 1. 更新任务状态为待验收
    task.status = 'reviewing';
    task.deliverables = deliverables;
    task.completedBy = operator;
    task.completedAt = new Date().toISOString();
    
    // 2. 如果有下一节点，创建转交记录
    if (nextAssignee) {
      task.nextAssignee = nextAssignee;
      task.transferHistory.push({
        from: operator,
        to: nextAssignee,
        timestamp: new Date().toISOString(),
        comment
      });
      
      // 3. 通知下一节点
      await sendFeishuNotification({
        ...task,
        assignee: nextAssignee,
        action: 'transferred'
      }, nextAssignee);
    }
    
    // 4. 通知发起人
    await notifyCreator(task, {
      action: 'completed',
      operator,
      nextAssignee
    });
    
    // 5. 保存
    saveData();
    
    console.log(`[BCE 任务] 任务完成并转交：${id}, 下一节点：${nextAssignee}`);
    
    res.json({
      success: true,
      message: '任务已完成并转交',
      data: task
    });
    
  } catch (error) {
    console.error('完成任务失败:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### 5. 飞书通知模板

```javascript
// BCE-Project/src/config/notification-templates.js

const TEMPLATES = {
  // 新任务分配
  task_assigned: `
📋 新任务分配

【任务 ID】{taskId}
【任务名称】{title}
【优先级】{priority}
【截止时间】{deadline}
【任务描述】{description}

请在 5 分钟内确认收到任务。
回复"收到"或访问：{taskUrl}
  `.trim(),

  // 任务转交
  task_transferred: `
🔄 任务转交

【任务 ID】{taskId}
【任务名称】{title}
【转交人】{from}
【接收人】{to}
【备注】{comment}

请及时处理。
  `.trim(),

  // 任务状态更新
  task_status_updated: `
✅ 任务状态更新

【任务 ID】{taskId}
【任务名称】{title}
【新状态】{status}
【操作人】{operator}
【备注】{comment}

查看：{taskUrl}
  `.trim(),

  // 任务完成通知发起人
  task_completed: `
🎉 任务完成

【任务 ID】{taskId}
【任务名称】{title}
【完成人】{completedBy}
【完成时间】{completedAt}
【交付物】{deliverablesCount} 个

请验收：{taskUrl}
  `.trim()
};

module.exports = { TEMPLATES };
```

---

## 🚀 实施步骤

### 第一步：添加定时任务（10 分钟）

```bash
cd /Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库/BCE-Project

# 1. 安装 cron 库
npm install node-cron

# 2. 创建定时任务服务
cat > src/scheduler/task-scheduler.js << 'EOF'
// 上面的定时任务代码
EOF

# 3. 在 index.js 中引入
# const scheduler = require('./scheduler/task-scheduler');
```

### 第二步：优化任务扫描逻辑（20 分钟）

```bash
# 创建任务扫描服务
cat > src/services/task-scanner.js << 'EOF'
// 上面的扫描逻辑代码
EOF
```

### 第三步：实现飞书确认解析（15 分钟）

```bash
# 修改飞书 Webhook
cat > src/api/feishu-webhook.js << 'EOF'
// 上面的 Webhook 代码
EOF
```

### 第四步：添加完成转交功能（15 分钟）

```bash
# 添加转交 API
# 修改 bce-tasks.js，添加 complete-and-transfer 接口
```

### 第五步：测试验证（20 分钟）

```bash
# 1. 启动服务
node src/index.js &

# 2. 创建测试任务
curl -X POST http://localhost:3000/api/bce/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "定时任务测试",
    "assignee": "匠心",
    "priority": "P1"
  }'

# 3. 等待 5 分钟，检查定时任务是否触发
# 4. 检查飞书通知是否发送
# 5. 飞书回复"收到"，验证确认功能
```

---

## 📊 完整流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                    BCE 定时任务轮询完整流程                       │
└─────────────────────────────────────────────────────────────────┘

1. 任务创建
   ↓
   天枢创建任务 → 分配给匠心
   ↓
   ┌──────────────────────────────────────┐
   │ 立即触发飞书通知                      │
   │ 📋 新任务分配 @匠心                    │
   └──────────────────────────────────────┘
   ↓

2. 定时轮询（每 5 分钟）
   ↓
   ┌──────────────────────────────────────┐
   │ 匠心的定时任务触发                     │
   │ 1. 扫描任务列表                        │
   │ 2. 发现新任务 TASK-001                 │
   │ 3. 标记为已读                          │
   │ 4. 发送飞书通知（如果还没发）          │
   └──────────────────────────────────────┘
   ↓

3. 任务确认
   ↓
   方式 A: 飞书回复"收到"
   ──────────────────────
   → BCE 解析飞书消息
   → 调用 API 确认任务
   → 更新任务状态为 confirmed
   
   方式 B: 页面点击确认
   ──────────────────────
   → 匠心访问任务列表
   → 点击 [确认收到]
   → 更新任务状态
   ↓

4. 任务执行
   ↓
   匠心执行任务
   ↓
   完成 → 提交验收

5. 任务转交（如果需要）
   ↓
   ┌──────────────────────────────────────┐
   │ 匠心完成任务并转交司库                 │
   │ POST /api/bce/tasks/:id/             │
   │ complete-and-transfer                │
   │                                      │
   │ Body: {                              │
   │   "nextAssignee": "司库",            │
   │   "deliverables": [...],             │
   │   "comment": "请审核财务数据"        │
   │ }                                    │
   └──────────────────────────────────────┘
   ↓
   ┌──────────────────────────────────────┐
   │ 触发飞书通知 @司库                     │
   │ 🔄 任务转交                            │
   └──────────────────────────────────────┘
   ↓

6. 发起人通知
   ↓
   ┌──────────────────────────────────────┐
   │ 天枢的定时任务触发                     │
   │ 1. 扫描自己创建的任务                  │
   │ 2. 发现 TASK-001 状态变更              │
   │ 3. 发送飞书通知                        │
   │ ✅ 任务状态更新：待验收                │
   └──────────────────────────────────────┘
   ↓

7. 验收完成
   ↓
   天枢验收 → 任务完成
   ↓
   ┌──────────────────────────────────────┐
   │ 飞书通知 @匠心                         │
   │ 🎉 任务已完成                          │
   └──────────────────────────────────────┘
```

---

## ✅ 成功标准

| 环节 | 验证方式 | 成功标准 |
|------|---------|---------|
| 定时任务 | 查看日志 | 每 5 分钟触发一次 |
| 任务扫描 | 创建测试任务 | 5 分钟内扫描到 |
| 飞书通知 | 检查飞书 | 收到@通知 |
| 飞书确认 | 回复"收到" | 任务状态更新 |
| 任务转交 | 完成并转交 | 下一节点收到通知 |
| 发起人通知 | 状态变更 | 天枢收到通知 |

---

## 💬 与 OCC 方案对比

| 维度 | OCC 方案 | BCE 轮询方案 |
|------|---------|-------------|
| **实施速度** | ❌ 需部署 OCC（1 小时） | ✅ 立即可改（1 小时） |
| **学习成本** | ❌ 新界面 | ✅ 熟悉飞书 |
| **可靠性** | ✅ 原生能力 | ✅ 双重保障 |
| **依赖性** | ❌ OCC 服务 | ✅ BCE 独立 |
| **通知方式** | ❌ 主动查看 | ✅ 被动接收 |
| **确认方式** | ❌ OCC 页面 | ✅ 飞书 + 页面 |
| **维护成本** | ❌ 双系统 | ✅ 单系统 |

---

## 🎯 最终建议

**磊哥，我建议采用 BCE 轮询方案！**

### 理由：

1. **实施快** - 1 小时内完成改造
2. **成本低** - 不需要部署 OCC
3. **习惯好** - 团队习惯飞书通知
4. **可靠性高** - 轮询 + 通知双保险
5. **独立性强** - BCE 独立运行，不依赖外部

### 融合方案：

**保留 OCC 作为高级功能（可选）：**
- BCE 轮询作为主力
- OCC 协作页面作为补充（查看流转历史）
- 两者数据可以同步

---

**磊哥，等您确认后我立即开始实施 BCE 轮询方案！** 🚀
