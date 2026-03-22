# 💻 BCE v3.3 核心代码

**版本：** v3.3  
**日期：** 2026-03-22  

---

## 1️⃣ 流转规则引擎（transfer-rules.js）

```javascript
/**
 * 流转规则引擎（v3.3 自动流转 + 驳回回退）
 * 任务完成自动判断下一节点
 * 审核不通过自动回退到上一节点
 */

const { transferRules, validMembers } = require('../config/task-rules');
const occSync = require('../api/occ-sync');
const notificationService = require('./notification-service');

// 驳回次数阈值（超过此值通知天枢和磊哥）
const REJECT_THRESHOLD = 5;

/**
 * 任务完成时自动触发流转
 */
async function onTaskCompleted(taskId) {
  const task = await getTask(taskId);
  if (!task) {
    console.error(`[规则引擎] 未找到任务：${taskId}`);
    return;
  }
  
  console.log(`[规则引擎] 任务完成，开始匹配规则：${taskId}`);
  
  for (const rule of transferRules) {
    if (rule.match(task)) {
      console.log(`[规则引擎] 匹配规则：${rule.name}`);
      
      // 检查条件
      if (rule.condition && !rule.condition(task)) {
        console.log(`[规则引擎] 条件不满足，跳过：${rule.name}`);
        continue;
      }
      
      const nextAssignee = typeof rule.next === 'function' 
        ? rule.next(task) 
        : rule.next;
      
      // 边界检查 1：不能转交给自己
      if (nextAssignee === task.assignee) {
        console.warn(`[规则引擎] 转交给自己，跳过：${nextAssignee}`);
        continue;
      }
      
      // 边界检查 2：循环转交检测
      if (isCircularTransfer(task, nextAssignee)) {
        console.error(`[规则引擎] 检测到循环转交，跳过：${nextAssignee}`);
        continue;
      }
      
      // 边界检查 3：有效成员检查
      if (!validMembers.includes(nextAssignee)) {
        console.error(`[规则引擎] 无效的接收人：${nextAssignee}`);
        continue;
      }
      
      // 自动转交
      await transferTask(taskId, task.assignee, nextAssignee, rule.name);
      console.log(`[规则引擎] 自动转交成功：${taskId} -> ${nextAssignee}`);
      break;
    }
  }
}

/**
 * 驳回任务（审核不通过时调用）v3.3 新增
 */
async function rejectTask(taskId, operator, reason) {
  const task = await getTask(taskId);
  if (!task) {
    console.error(`[驳回] 未找到任务：${taskId}`);
    return { success: false, error: '任务不存在' };
  }
  
  console.log(`[驳回] 任务被驳回：${taskId}, 操作人：${operator}, 原因：${reason}`);
  
  // 从流转历史中获取上一个节点（遵循规则引擎）
  const previousNode = findPreviousExecutor(task);
  console.log(`[驳回] 回退到上一节点：${previousNode}`);
  
  // 记录驳回历史
  addTransferHistory(task, task.assignee, previousNode, `驳回：${reason}`);
  
  // 更新任务状态
  task.status = 'executing'; // 回退到执行状态
  task.assignee = previousNode;
  task.rejectedAt = new Date().toISOString();
  task.rejectedBy = operator;
  task.updatedAt = new Date().toISOString();
  
  // 获取驳回次数
  const rejectCount = getRejectCount(task);
  console.log(`[驳回] 当前驳回次数：${rejectCount}`);
  
  // 同步到 OCC
  await occSync.updateTask(taskId, task);
  
  // 通知被驳回人
  try {
    await notificationService.notify(
      previousNode,
      operator,
      'task_rejected',
      `❌ 任务被驳回：${task.title}\n驳回人：${operator}\n原因：${reason}\n\n请重新执行任务。`,
      taskId,
      `task:${taskId}`
    );
    console.log(`[驳回] 已通知执行节点 ${previousNode}`);
  } catch (error) {
    console.error(`[驳回] 通知执行节点失败：${error.message}`);
  }
  
  // 检查是否需要升级通知（超过 5 次）
  if (rejectCount >= REJECT_THRESHOLD) {
    console.log(`[驳回] 驳回次数达到阈值（${rejectCount} >= ${REJECT_THRESHOLD}），触发升级通知`);
    await notifyRejectEscalation(task, rejectCount, operator, reason);
  }
  
  // 通知任务创建人
  if (task.creator && task.creator !== previousNode) {
    try {
      await notificationService.notify(
        task.creator,
        operator,
        'task_rejected',
        `📋 任务被驳回：${task.title}\n驳回人：${operator}\n原因：${reason}\n已回退到 ${previousNode} 重新执行`,
        taskId,
        `task:${taskId}`
      );
      console.log(`[驳回] 已通知创建人 ${task.creator}`);
    } catch (error) {
      console.error(`[驳回] 通知创建人失败：${error.message}`);
    }
  }
  
  console.log(`[驳回] 任务驳回完成：${taskId} -> ${previousNode}`);
  
  return {
    success: true,
    taskId,
    previousNode,
    rejectCount
  };
}

/**
 * 查找上一个节点（从流转历史获取）v3.3 新增
 */
function findPreviousExecutor(task) {
  const history = task.transferHistory || [];
  
  if (history.length > 0) {
    const lastRecord = history[history.length - 1];
    return lastRecord.from; // 流转历史中的上一个节点
  }
  
  return task.creator || '匠心';
}

/**
 * 获取任务被驳回的次数 v3.3 新增
 */
function getRejectCount(task) {
  const history = task.transferHistory || [];
  return history.filter(h => 
    h.comment && h.comment.includes('驳回')
  ).length;
}

/**
 * 通知升级（驳回超过 5 次通知天枢和磊哥）v3.3 新增
 */
async function notifyRejectEscalation(task, rejectCount, operator, reason) {
  const message = `🚨 任务驳回预警：${task.title}\n` +
    `驳回次数：${rejectCount} 次（阈值：${REJECT_THRESHOLD}）\n` +
    `当前操作人：${operator}\n` +
    `驳回原因：${reason}\n` +
    `请立即处理！`;
  
  // 通知天枢
  try {
    await notificationService.notify('天枢', operator, 'task_reject_escalation', message, task.id, `task:${task.id}`);
    console.log(`[驳回升级] 已通知天枢：${task.id}`);
  } catch (error) {
    console.error(`[驳回升级] 通知天枢失败：${error.message}`);
  }
  
  // 通知磊哥
  try {
    await notificationService.notify('磊哥', operator, 'task_reject_escalation', message, task.id, `task:${task.id}`);
    console.log(`[驳回升级] 已通知磊哥：${task.id}`);
  } catch (error) {
    console.error(`[驳回升级] 通知磊哥失败：${error.message}`);
  }
}

/**
 * 循环转交检测
 */
function isCircularTransfer(task, nextAssignee) {
  const recentHistory = task.transferHistory || [];
  const last10 = recentHistory.slice(-10);
  const sequence = [...last10.map(h => h.to), nextAssignee];
  
  const last = sequence[sequence.length - 1];
  const count = sequence.filter(s => s === last).length;
  
  if (count >= 3) {
    console.warn(`[循环检测] 检测到循环转交：${nextAssignee} 已出现 ${count} 次，阻止转交`);
    return true;
  }
  
  return false;
}

/**
 * 添加流转历史（限制 100 条）
 */
function addTransferHistory(task, from, to, comment) {
  task.transferHistory = task.transferHistory || [];
  task.transferHistory.push({
    from, 
    to, 
    comment,
    timestamp: new Date().toISOString()
  });
  
  // 保留最近 100 条
  if (task.transferHistory.length > 100) {
    task.transferHistory = task.transferHistory.slice(-100);
  }
}

/**
 * 转交任务
 */
async function transferTask(taskId, from, to, reason) {
  const task = await getTask(taskId);
  if (!task) {
    throw new Error(`任务不存在：${taskId}`);
  }
  
  task.status = 'reviewing';
  task.nextAssignee = to;
  
  addTransferHistory(task, from, to, reason);
  
  await occSync.updateTask(taskId, task);
  await notificationService.notifyTaskTransfer(task, from, to);
  
  console.log(`[流转] 任务转交：${taskId} ${from} -> ${to}, 原因：${reason}`);
}

/**
 * 获取任务
 */
async function getTask(taskId) {
  return occSync.getTask(taskId);
}

module.exports = {
  onTaskCompleted,
  onTaskRejected: rejectTask,
  rejectTask,
  isCircularTransfer,
  addTransferHistory,
  transferTask,
  findPreviousExecutor,
  getRejectCount,
  notifyRejectEscalation
};
```

---

## 2️⃣ 任务 API（bce-tasks.js - 驳回端点）

```javascript
/**
 * 驳回任务（审核不通过）v3.3 新增
 * POST /api/bce/tasks/:id/reject
 * Body: { operator: string, reason: string }
 */
router.post('/tasks/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { operator, reason } = req.body;
    
    if (!operator || !reason) {
      return res.status(400).json({ error: 'operator 和 reason 不能为空' });
    }
    
    const task = tasks.get(id);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    console.log(`[驳回 API] 收到驳回请求：${id}, 操作人：${operator}, 原因：${reason}`);
    
    // 调用驳回服务
    const result = await rejectTask(id, operator, reason);
    
    if (result.success) {
      saveData(); // 保存数据
      
      res.json({
        success: true,
        message: `任务已驳回，回退到 ${result.previousNode} 重新执行`,
        data: {
          taskId: id,
          previousNode: result.previousNode,
          rejectCount: result.rejectCount,
          rejectedAt: new Date().toISOString()
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || '驳回失败'
      });
    }
  } catch (error) {
    console.error('驳回任务失败:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

## 3️⃣ 流转规则配置（task-rules.js）

```javascript
/**
 * 流转规则配置
 * 所有任务流转（完成/驳回/转交）都遵循此规则
 */

module.exports = {
  // 有效成员列表
  validMembers: [
    '天枢', '匠心', '司库', '执矩', '磐石', '灵犀', '天策'
  ],
  
  // 流转规则
  transferRules: [
    {
      name: "技术方案流转",
      match: (task) => task.type === 'technical' || task.title.includes('技术'),
      next: (task) => {
        // 匠心执行完成 → 司库财务审核
        if (task.assignee === '匠心') return '司库';
        // 司库财务审核通过 → 执矩安全审核
        if (task.assignee === '司库') return '执矩';
        // 执矩安全审核通过 → 天枢验收
        if (task.assignee === '执矩') return '天枢';
        // 天枢验收通过 → 完成
        if (task.assignee === '天枢') return null;
      }
    },
    {
      name: "财务审核流转",
      match: (task) => task.type === 'finance' || task.title.includes('财务'),
      next: (task) => {
        if (task.assignee === '司库') return '执矩';
        if (task.assignee === '执矩') return '天枢';
        if (task.assignee === '天枢') return null;
      }
    },
    {
      name: "安全审核流转",
      match: (task) => task.type === 'security' || task.title.includes('安全'),
      next: (task) => {
        if (task.assignee === '执矩') return '天枢';
        if (task.assignee === '天枢') return null;
      }
    },
    {
      name: "默认流转",
      match: () => true,
      next: (task) => {
        // 默认流转：匠心 → 司库 → 执矩 → 天枢
        if (task.assignee === '匠心') return '司库';
        if (task.assignee === '司库') return '执矩';
        if (task.assignee === '执矩') return '天枢';
        if (task.assignee === '天枢') return null;
      }
    }
  ]
};
```

---

## 4️⃣ 通知服务（notification-service.js - 驳回通知）

```javascript
/**
 * 发送驳回通知 v3.3 新增
 */
async function notifyTaskRejected(taskId, task, rejector, reason, rejectedUser) {
  const notification = {
    type: 'task_rejected',
    taskId,
    taskTitle: task.title,
    rejector,
    reason,
    rejectedUser,
    timestamp: new Date().toISOString()
  };
  
  // 主通道：sessions_send
  try {
    await sendViaSessionsSend(rejectedUser, notification);
  } catch (error) {
    console.error('[驳回通知] sessions_send 失败:', error.message);
  }
  
  // 备用通道：飞书卡片
  try {
    await sendViaFeishuCard(rejectedUser, notification);
  } catch (error) {
    console.error('[驳回通知] 飞书卡片失败:', error.message);
  }
  
  // 可靠通道：邮箱
  try {
    await sendViaMailbox(rejectedUser, notification);
  } catch (error) {
    console.error('[驳回通知] 邮箱失败:', error.message);
  }
  
  console.log(`[驳回通知] 已发送给 ${rejectedUser}`);
}

/**
 * 发送升级通知 v3.3 新增
 */
async function notifyRejectEscalation(taskId, task, rejectCount, rejector, reason) {
  const notification = {
    type: 'reject_escalation',
    taskId,
    taskTitle: task.title,
    rejectCount,
    rejector,
    reason,
    timestamp: new Date().toISOString()
  };
  
  // 通知天枢
  await sendViaSessionsSend('天枢', notification);
  await sendViaFeishuCard('天枢', notification);
  
  // 通知磊哥
  await sendViaSessionsSend('磊哥', notification);
  await sendViaFeishuCard('磊哥', notification);
  
  console.log(`[升级通知] 已发送（驳回 ${rejectCount} 次）`);
}
```

---

**代码版本：** v3.3  
**最后更新：** 2026-03-22  
**维护人：** 匠心 (CTO)
