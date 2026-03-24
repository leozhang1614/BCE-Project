/**
 * 任务验收 API 路由（v3.4 修复版）
 * 
 * 修复内容：
 * 1. 使用统一的 tasks Map（与 bce-tasks.js 共享数据）
 * 2. 添加状态机检查（canTransition）
 * 3. 添加 OCC 同步
 * 4. 使用统一权限中间件
 * 
 * 端点：
 * POST /api/bce/tasks/:id/accept - 验收任务
 * POST /api/bce/tasks/:id/reject - 驳回任务
 */

const express = require('express');
const router = express.Router();

// v3.4 修复：使用 bce-tasks.js 的统一数据源
const tasksApi = require('./bce-tasks');
const tasks = tasksApi.tasks;
const saveData = tasksApi.saveData;
const TASK_STATES = tasksApi.TASK_STATES;
const occSync = require('./occ-sync');  // v3.4 新增：OCC 同步
const { checkPermission } = require('../middleware/auth');  // v3.4 新增：统一权限

/**
 * 检查状态流转是否允许
 */
function canTransition(from, to) {
  const STATE_TRANSITIONS = {
    'pending': ['assigned', 'cancelled'],
    'assigned': ['executing', 'pending', 'cancelled'],
    'executing': ['reviewing', 'assigned', 'cancelled'],
    'reviewing': ['accepted', 'auditing', 'executing'],
    'auditing': ['completed', 'reviewing', 'executing'],
    'accepted': ['completed'],
    'completed': [],
    'cancelled': []
  };
  const allowedTransitions = STATE_TRANSITIONS[from];
  return allowedTransitions && allowedTransitions.includes(to);
}

/**
 * POST /api/bce/tasks/:id/accept
 * 验收任务
 */
router.post('/:id/accept', checkPermission('accept'), async (req, res) => {
  try {
    const { id } = req.params;
    const { userName, comment } = req.body;
    
    // v3.4 修复：使用统一的 tasks Map
    const task = tasks.get(id);
    
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    // v3.4 修复：检查状态流转
    if (!canTransition(task.status, 'auditing')) {
      return res.status(400).json({ 
        error: `不允许的状态流转：${task.status} -> auditing` 
      });
    }
    
    // v3.4 修复：使用统一权限中间件（不再手动检查）
    // checkPermission('accept') 已经在路由上应用
    
    console.log(`[验收 API] ${userName} 验收任务：${task.title}`);
    
    // 更新任务状态
    task.status = 'auditing';  // 验收通过后流转到待审核
    task.currentNode = 'auditing';
    task.acceptedAt = new Date().toISOString();
    task.acceptedBy = userName;
    task.acceptComment = comment || '';
    
    // ✅ 自动设置审核人为执矩（固化流程）
    task.auditor = '执矩';
    task.requireConfirmation = true;  // 需要执矩确认接收
    task.confirmedAt = null;  // 重置确认状态
    task.updatedAt = new Date().toISOString();
    
    // 恢复 assignee 为原执行者（审核阶段）
    if (task.previousAssignee) {
      task.assignee = task.previousAssignee;
    }
    
    // v3.4 修复：保存到统一数据源
    saveData();
    
    // v3.4 修复：同步到 OCC
    try {
      await occSync.updateTask(id, task);
      console.log(`[验收 API] 已同步到 OCC`);
    } catch (occError) {
      console.error(`[验收 API] OCC 同步失败：${occError.message}`);
      // 记录但不阻止主流程
      task.syncStatus = 'pending';
    }
    
    console.log(`[验收 API] 任务已流转到审核环节，审核人：执矩`);
    console.log(`[验收 API] 心跳任务将在 5 分钟内提醒执矩确认`);
    
    res.json({
      success: true,
      message: '任务验收通过',
      data: {
        taskId: id,
        status: task.status,
        currentNode: task.currentNode,
        acceptedAt: task.acceptedAt,
        auditor: task.auditor,
        requireConfirmation: task.requireConfirmation
      }
    });
    
  } catch (error) {
    console.error(`[验收 API] 验收失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/bce/tasks/:id/reject
 * 驳回任务
 */
router.post('/:id/reject', checkPermission('accept'), async (req, res) => {
  try {
    const { id } = req.params;
    const { userName, comment, rejectReason } = req.body;
    
    // v3.4 修复：使用统一的 tasks Map
    const task = tasks.get(id);
    
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    // v3.4 修复：检查状态流转
    if (!canTransition(task.status, 'executing')) {
      return res.status(400).json({ 
        error: `不允许的状态流转：${task.status} -> executing` 
      });
    }
    
    console.log(`[验收 API] ${userName} 驳回任务：${task.title}`);
    
    // 更新任务状态（回退到开发）
    task.status = 'executing';
    task.currentNode = 'executing';
    task.rejectedAt = new Date().toISOString();
    task.rejectedBy = userName;
    task.rejectComment = comment || '';
    task.rejectReason = rejectReason || '';
    task.updatedAt = new Date().toISOString();
    
    // 恢复 assignee 为原执行者
    if (task.previousAssignee) {
      task.assignee = task.previousAssignee;
    }
    
    // v3.4 修复：记录驳回历史
    if (!task.rejectHistory) {
      task.rejectHistory = [];
    }
    task.rejectHistory.push({
      reason: rejectReason || comment,
      rejectedBy: userName,
      rejectedAt: task.rejectedAt,
      fromNode: 'reviewing',
      toNode: 'executing'
    });
    
    // v3.4 修复：保存到统一数据源
    saveData();
    
    // v3.4 修复：同步到 OCC
    try {
      await occSync.updateTask(id, task);
      console.log(`[验收 API] 已同步到 OCC`);
    } catch (occError) {
      console.error(`[验收 API] OCC 同步失败：${occError.message}`);
    }
    
    console.log(`[验收 API] 任务已驳回，回退到 ${task.assignee} 重新执行`);
    
    res.json({
      success: true,
      message: '任务已驳回',
      data: {
        taskId: id,
        status: task.status,
        currentNode: task.currentNode,
        assignee: task.assignee,
        rejectedAt: task.rejectedAt,
        rejectedBy: task.rejectedBy,
        rejectReason: task.rejectReason,
        rejectHistory: task.rejectHistory
      }
    });
    
  } catch (error) {
    console.error(`[验收 API] 驳回失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
