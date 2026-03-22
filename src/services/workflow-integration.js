/**
 * BCE 开发工作流与现有任务系统的集成
 * 实现节点自动流转和通知
 * 
 * @author 匠心 (CTO)
 * @version 1.0.0
 */

const notificationService = require('./notification-service');

/**
 * 节点完成自动流转
 * 与现有 BCE 任务系统的 onTaskCompleted 兼容
 */
async function onWorkflowNodeCompleted(taskId, currentNode, nextNode, operator) {
  console.log(`[工作流集成] 节点完成：${taskId} ${currentNode} -> ${nextNode}`);
  
  // 1. 记录流转日志
  logWorkflowTransition(taskId, currentNode, nextNode, operator);
  
  // 2. 通知下一节点负责人
  await notifyNextNode(taskId, nextNode);
  
  // 3. 同步到 OCC（可选）
  await syncToOcc(taskId, nextNode);
}

/**
 * 记录流转日志
 */
function logWorkflowTransition(taskId, currentNode, nextNode, operator) {
  const timestamp = new Date().toISOString();
  console.log(`[工作流] ${timestamp} ${taskId}: ${currentNode} -> ${nextNode} (operator: ${operator})`);
}

/**
 * 通知下一节点负责人
 */
async function notifyNextNode(taskId, nextNode) {
  // 根据节点类型通知对应角色
  const roleMap = {
    'development': '开发者',
    'acceptance': '项目负责人',
    'audit': '执矩',
    'completed': '所有人'
  };
  
  const roleName = roleMap[nextNode] || nextNode;
  
  console.log(`[工作流通知] 通知 ${roleName} 处理任务 ${taskId}`);
  
  // TODO: 实现具体通知逻辑（飞书/邮件/短信）
}

/**
 * 同步到 OCC（可选）
 */
async function syncToOcc(taskId, status) {
  try {
    // TODO: 调用 OCC 同步 API
    console.log(`[OCC 同步] 任务 ${taskId} 状态更新为 ${status}`);
  } catch (error) {
    console.log('[OCC 同步] 同步失败，不影响工作流流转');
  }
}

/**
 * 驳回处理（与现有驳回机制兼容）
 */
async function onWorkflowReject(taskId, fromNode, toNode, operator, reason) {
  console.log(`[工作流集成] 驳回：${taskId} ${fromNode} -> ${toNode} (原因：${reason})`);
  
  // 1. 记录驳回日志
  logWorkflowReject(taskId, fromNode, toNode, operator, reason);
  
  // 2. 通知被驳回人
  await notifyRejectedUser(taskId, toNode, reason);
  
  // 3. 记录驳回次数（用于阈值判断）
  await incrementRejectCount(taskId);
}

/**
 * 记录驳回日志
 */
function logWorkflowReject(taskId, fromNode, toNode, operator, reason) {
  const timestamp = new Date().toISOString();
  console.log(`[工作流驳回] ${timestamp} ${taskId}: ${fromNode} -> ${toNode} (operator: ${operator}, reason: ${reason})`);
}

/**
 * 通知被驳回人
 */
async function notifyRejectedUser(taskId, toNode, reason) {
  const roleMap = {
    'development': '开发者',
    'acceptance': '项目负责人',
    'audit': '执矩'
  };
  
  const roleName = roleMap[toNode] || toNode;
  
  console.log(`[工作流通知] 通知 ${roleName} 任务 ${taskId} 被驳回，原因：${reason}`);
  
  // TODO: 实现具体通知逻辑
}

/**
 * 记录驳回次数
 */
async function incrementRejectCount(taskId) {
  // TODO: 在任务数据中记录驳回次数
  // 超过阈值（5 次）时通知天枢和磊哥
}

module.exports = {
  onWorkflowNodeCompleted,
  onWorkflowReject,
  logWorkflowTransition,
  notifyNextNode,
  syncToOcc
};
