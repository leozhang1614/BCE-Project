/**
 * BCE v3.4 - 管理者权限 API
 * 功能：任务重新分配、优先级调整、强制汇报、风险标记、上报 CEO、管理仪表盘
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const managerService = require('../services/manager-service');
const { logAudit } = require('../middleware/audit');

const DATA_FILE = path.join(__dirname, '../../runtime/bce-data.json');

/**
 * 加载任务数据
 */
function loadTasks() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return data.tasks || [];
    }
  } catch (error) {
    console.error('[管理者 API] 加载数据失败:', error.message);
  }
  return [];
}

/**
 * 保存任务数据
 */
function saveTasks(tasks) {
  try {
    const data = {
      tasks: Array.from(tasks),
      savedAt: new Date().toISOString()
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('[管理者 API] 保存数据失败:', error.message);
    return false;
  }
}

/**
 * 重新分配任务
 * POST /api/bce/manager/:id/reassign
 */
router.post('/manager/:id/reassign', async (req, res) => {
  try {
    const taskId = req.params.id;
    const { newAssignee, reason, handover } = req.body;
    const manager = req.body.manager || req.headers['x-manager'] || '系统';
    
    if (!newAssignee || !reason) {
      return res.status(400).json({
        success: false,
        error: '新执行者和原因不能为空'
      });
    }
    
    const tasks = loadTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    // 执行重新分配
    const result = await managerService.reassignTask(task, newAssignee, reason, handover, manager);
    
    // 保存数据
    saveTasks(tasks);
    
    // 记录审计日志
    logAudit('REASSIGN_TASK', manager, manager, 'task', taskId, {
      from: task.assignee,
      to: newAssignee,
      reason
    });
    
    console.log(`[管理者 API] 任务 ${taskId} 重新分配：${result.oldAssignee} → ${result.newAssignee}`);
    
    res.json({
      success: true,
      message: '任务已重新分配',
      data: result
    });
  } catch (error) {
    console.error('[管理者 API] 重新分配失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 调整优先级
 * POST /api/bce/manager/:id/priority
 */
router.post('/manager/:id/priority', async (req, res) => {
  try {
    const taskId = req.params.id;
    const { priority, reason } = req.body;
    const manager = req.body.manager || req.headers['x-manager'] || '系统';
    
    if (!priority || !reason) {
      return res.status(400).json({
        success: false,
        error: '优先级和原因不能为空'
      });
    }
    
    const tasks = loadTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    // 执行优先级调整
    const result = await managerService.adjustPriority(task, priority, reason, manager);
    
    // 保存数据
    saveTasks(tasks);
    
    // 记录审计日志
    logAudit('ADJUST_PRIORITY', manager, manager, 'task', taskId, {
      from: result.oldPriority,
      to: priority,
      reason
    });
    
    console.log(`[管理者 API] 任务 ${taskId} 优先级调整：${result.oldPriority} → ${priority}`);
    
    res.json({
      success: true,
      message: '优先级已调整',
      data: result
    });
  } catch (error) {
    console.error('[管理者 API] 调整优先级失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 调整截止时间
 * POST /api/bce/manager/:id/deadline
 */
router.post('/manager/:id/deadline', async (req, res) => {
  try {
    const taskId = req.params.id;
    const { deadline, reason } = req.body;
    const manager = req.body.manager || req.headers['x-manager'] || '系统';
    
    if (!deadline || !reason) {
      return res.status(400).json({
        success: false,
        error: '截止时间和原因不能为空'
      });
    }
    
    const tasks = loadTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    // 执行截止时间调整
    const result = await managerService.adjustDeadline(task, deadline, reason, manager);
    
    // 保存数据
    saveTasks(tasks);
    
    // 记录审计日志
    logAudit('ADJUST_DEADLINE', manager, manager, 'task', taskId, {
      from: result.oldDeadline,
      to: deadline,
      reason
    });
    
    console.log(`[管理者 API] 任务 ${taskId} 截止时间调整：${result.oldDeadline} → ${deadline}`);
    
    res.json({
      success: true,
      message: '截止时间已调整',
      data: result
    });
  } catch (error) {
    console.error('[管理者 API] 调整截止时间失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 强制要求汇报
 * POST /api/bce/manager/:id/demand-update
 */
router.post('/manager/:id/demand-update', async (req, res) => {
  try {
    const taskId = req.params.id;
    const { urgency = 'medium', message } = req.body;
    const manager = req.body.manager || req.headers['x-manager'] || '系统';
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: '消息内容不能为空'
      });
    }
    
    const tasks = loadTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    // 执行强制汇报要求
    const result = await managerService.demandUpdate(task, urgency, message, manager);
    
    // 保存数据
    saveTasks(tasks);
    
    // 记录审计日志
    logAudit('DEMAND_UPDATE', manager, manager, 'task', taskId, {
      urgency,
      message
    });
    
    console.log(`[管理者 API] 任务 ${taskId} 强制要求汇报，紧急程度：${urgency}`);
    
    res.json({
      success: true,
      message: '已发送强制更新要求',
      data: result
    });
  } catch (error) {
    console.error('[管理者 API] 强制要求汇报失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 标记风险
 * POST /api/bce/manager/:id/mark-risk
 */
router.post('/manager/:id/mark-risk', async (req, res) => {
  try {
    const taskId = req.params.id;
    const { level, reason, action } = req.body;
    const manager = req.body.manager || req.headers['x-manager'] || '系统';
    
    if (!level || !reason) {
      return res.status(400).json({
        success: false,
        error: '风险等级和原因不能为空'
      });
    }
    
    const tasks = loadTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    // 执行风险标记
    const result = await managerService.markRisk(task, level, reason, action, manager);
    
    // 保存数据
    saveTasks(tasks);
    
    // 记录审计日志
    logAudit('MARK_RISK', manager, manager, 'task', taskId, {
      level,
      reason,
      action
    });
    
    console.log(`[管理者 API] 任务 ${taskId} 标记为${level}风险`);
    
    res.json({
      success: true,
      message: '风险已标记',
      data: result
    });
  } catch (error) {
    console.error('[管理者 API] 标记风险失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 上报 CEO
 * POST /api/bce/manager/:id/escalate
 */
router.post('/manager/:id/escalate', async (req, res) => {
  try {
    const taskId = req.params.id;
    const { reason, suggestions, impact } = req.body;
    const manager = req.body.manager || req.headers['x-manager'] || '系统';
    
    if (!reason || !suggestions || !impact) {
      return res.status(400).json({
        success: false,
        error: '原因、建议方案和影响不能为空'
      });
    }
    
    const tasks = loadTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    // 执行上报
    const result = await managerService.escalateToCEO(task, reason, suggestions, impact, manager);
    
    // 保存数据
    saveTasks(tasks);
    
    // 记录审计日志
    logAudit('ESCALATE_TO_CEO', manager, manager, 'task', taskId, {
      reason,
      suggestions,
      impact
    });
    
    console.log(`[管理者 API] 任务 ${taskId} 已上报 CEO`);
    
    res.json({
      success: true,
      message: '已上报 CEO',
      data: result
    });
  } catch (error) {
    console.error('[管理者 API] 上报 CEO 失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取管理仪表盘
 * GET /api/bce/manager/dashboard/:projectId
 */
router.get('/manager/dashboard/:projectId?', (req, res) => {
  try {
    const projectId = req.params.projectId;
    const tasks = loadTasks();
    
    // 生成仪表盘数据
    const dashboard = managerService.generateDashboard(tasks, projectId);
    
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('[管理者 API] 获取仪表盘失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取角色权限
 * GET /api/bce/manager/roles
 */
router.get('/manager/roles', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        roles: require('../services/manager-service').ROLES || {}
      }
    });
  } catch (error) {
    console.error('[管理者 API] 获取角色权限失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
