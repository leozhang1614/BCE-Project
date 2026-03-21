/**
 * 流转规则引擎（v3.2 自动流转）
 * 任务完成自动判断下一节点
 */

const { transferRules, validMembers } = require('../config/task-rules');
const occSync = require('../api/occ-sync');
const notificationService = require('./notification-service');

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
 * 循环转交检测 ✅ v3.2 新增
 */
function isCircularTransfer(task, nextAssignee) {
  // 检查最近 10 次流转历史
  const recentHistory = task.transferHistory || [];
  const last10 = recentHistory.slice(-10);
  const sequence = [...last10.map(h => h.to), nextAssignee];
  
  // 检测是否有重复模式（同一人出现 3 次以上）
  const last = sequence[sequence.length - 1];
  const count = sequence.filter(s => s === last).length;
  
  if (count >= 3) {
    return true; // 同一人出现 3 次以上，可能是循环
  }
  
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

module.exports = {
  onTaskCompleted,
  isCircularTransfer,
  addTransferHistory,
  transferTask
};
