/**
 * 流转规则引擎（v3.3 自动流转 + 驳回回退）
 * 任务完成自动判断下一节点
 * 审核不通过自动回退到上一个执行节点
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
      
      // 边界检查 1：不能转交给自己 ✅ v3.2 新增
      if (nextAssignee === task.assignee) {
        console.warn(`[规则引擎] 转交给自己，跳过：${nextAssignee}`);
        continue;
      }
      
      // 边界检查 2：循环转交检测 ✅ v3.2 新增
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
 * 循环转交检测 ✅ v3.2 新增（已修复）
 */
function isCircularTransfer(task, nextAssignee) {
  // 检查最近 10 次流转历史
  const recentHistory = task.transferHistory || [];
  const last10 = recentHistory.slice(-10);
  const sequence = [...last10.map(h => h.to), nextAssignee];
  
  // 检测是否有重复模式（同一人出现 3 次以上）
  const last = sequence[sequence.length - 1];
  const count = sequence.filter(s => s === last).length;
  
  // v3.2 修复：添加调试日志
  console.log(`[循环检测] 流转序列：${sequence.join(' -> ')}, 下一节点：${nextAssignee}, 出现次数：${count}`);
  
  if (count >= 3) {
    console.warn(`[循环检测] 检测到循环转交：${nextAssignee} 已出现 ${count} 次，阻止转交`);
    return true; // 同一人出现 3 次以上，阻止
  }
  
  console.log(`[循环检测] 未检测到循环，允许转交`);
  return false;
}

/**
 * 添加流转历史（限制 100 条）✅ v3.2 新增
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
    // 归档旧记录（这里简化实现，实际可以写入归档文件）
    const toArchive = task.transferHistory.slice(0, -100);
    archiveOldHistory(task.id, toArchive);
    
    // 保留最近 100 条
    task.transferHistory = task.transferHistory.slice(-100);
  }
}

/**
 * 归档旧记录
 */
function archiveOldHistory(taskId, history) {
  // 实际实现可以写入归档文件或数据库
  console.log(`[流转历史] 归档任务 ${taskId} 的 ${history.length} 条旧记录`);
}

/**
 * 转交任务
 */
async function transferTask(taskId, from, to, reason) {
  const task = await getTask(taskId);
  if (!task) {
    throw new Error(`任务不存在：${taskId}`);
  }
  
  // 更新任务状态
  task.status = 'reviewing';
  task.nextAssignee = to;
  
  // 记录流转历史（限制 100 条）
  addTransferHistory(task, from, to, reason);
  
  // 同步到 OCC
  await occSync.updateTask(taskId, task);
  
  // 通知下一节点（三通道）
  await notificationService.notifyTaskTransfer(task, from, to);
  
  console.log(`[流转] 任务转交：${taskId} ${from} -> ${to}, 原因：${reason}`);
}

/**
 * 获取任务
 */
async function getTask(taskId) {
  // 从 OCC 或本地获取任务
  return occSync.getTask(taskId);
}

/**
 * 查找上一个执行节点（驳回时回退到该节点）v3.3 新增
 * 遵循规则引擎：从流转规则中匹配当前任务的上一节点
 */
function findPreviousExecutor(task) {
  const history = task.transferHistory || [];
  
  // 从流转历史中找上一个节点
  if (history.length > 0) {
    // 获取上一个流转记录的 from 节点
    const lastRecord = history[history.length - 1];
    return lastRecord.from;
  }
  
  // 如果没有流转历史，返回任务创建人
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
    await notificationService.notify(
      '天枢',
      operator,
      'task_reject_escalation',
      message,
      task.id,
      `task:${task.id}`
    );
    console.log(`[驳回升级] 已通知天枢：${task.id}`);
  } catch (error) {
    console.error(`[驳回升级] 通知天枢失败：${error.message}`);
  }
  
  // 通知磊哥
  try {
    await notificationService.notify(
      '磊哥',
      operator,
      'task_reject_escalation',
      message,
      task.id,
      `task:${task.id}`
    );
    console.log(`[驳回升级] 已通知磊哥：${task.id}`);
  } catch (error) {
    console.error(`[驳回升级] 通知磊哥失败：${error.message}`);
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
  
  // 找到上一个执行节点
  const previousExecutor = findPreviousExecutor(task);
  console.log(`[驳回] 回退到上一个执行节点：${previousExecutor}`);
  
  // 记录驳回历史（v3.4 增强：详细记录驳回原因）
  addTransferHistory(task, task.assignee, previousExecutor, `驳回：${reason}`);
  
  // 更新任务状态
  task.status = 'executing'; // 回退到执行状态
  task.assignee = previousExecutor;
  task.rejectedAt = new Date().toISOString();
  task.rejectedBy = operator;
  task.rejectReason = reason;  // v3.4 新增：记录驳回原因
  task.rejectComment = reason; // v3.4 新增：兼容验收环节的字段名
  task.updatedAt = new Date().toISOString();
  
  // 初始化驳回历史数组（v3.4 新增）
  if (!task.rejectHistory) {
    task.rejectHistory = [];
  }
  // 记录详细驳回历史
  task.rejectHistory.push({
    reason: reason,
    rejectedBy: operator,
    rejectedAt: task.rejectedAt,
    fromNode: task.currentNode || 'auditing',
    toNode: 'executing'
  });
  
  // 获取驳回次数
  const rejectCount = getRejectCount(task);
  console.log(`[驳回] 当前驳回次数：${rejectCount}`);
  
  // 同步到 OCC
  await occSync.updateTask(taskId, task);
  
  // 通知上一个执行节点（被驳回人）
  try {
    await notificationService.notify(
      previousExecutor,
      operator,
      'task_rejected',
      `❌ 任务被驳回：${task.title}\n驳回人：${operator}\n原因：${reason}\n\n请重新执行任务。`,
      taskId,
      `task:${taskId}`
    );
    console.log(`[驳回] 已通知执行节点 ${previousExecutor}`);
  } catch (error) {
    console.error(`[驳回] 通知执行节点失败：${error.message}`);
  }
  
  // 检查是否需要升级通知（超过 5 次）
  if (rejectCount >= REJECT_THRESHOLD) {
    console.log(`[驳回] 驳回次数达到阈值（${rejectCount} >= ${REJECT_THRESHOLD}），触发升级通知`);
    await notifyRejectEscalation(task, rejectCount, operator, reason);
  }
  
  // 通知任务创建人（无论是否达到阈值都通知）
  if (task.creator && task.creator !== previousExecutor) {
    try {
      await notificationService.notify(
        task.creator,
        operator,
        'task_rejected',
        `📋 任务被驳回：${task.title}\n驳回人：${operator}\n原因：${reason}\n已回退到 ${previousExecutor} 重新执行`,
        taskId,
        `task:${taskId}`
      );
      console.log(`[驳回] 已通知创建人 ${task.creator}`);
    } catch (error) {
      console.error(`[驳回] 通知创建人失败：${error.message}`);
    }
  }
  
  console.log(`[驳回] 任务驳回完成：${taskId} -> ${previousExecutor}`);
  
  return {
    success: true,
    taskId,
    previousExecutor,
    rejectCount
  };
}

/**
 * 任务被驳回时触发（兼容接口）v3.3 新增
 */
async function onTaskRejected(taskId, operator, reason) {
  return rejectTask(taskId, operator, reason);
}

module.exports = {
  onTaskCompleted,
  onTaskRejected, // v3.3 新增：驳回处理
  isCircularTransfer,
  addTransferHistory,
  transferTask,
  rejectTask // v3.3 新增：驳回任务
};
