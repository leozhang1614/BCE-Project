/**
 * BCE v3.4 - 进度管理 API
 * 功能：进度更新、进度查询、定时检查
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const progressService = require('../services/progress-service');
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
    console.error('[进度 API] 加载数据失败:', error.message);
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
    console.error('[进度 API] 保存数据失败:', error.message);
    return false;
  }
}

/**
 * 检查进度更新（定时调用）
 * POST /api/bce/progress/check
 */
router.post('/progress/check', async (req, res) => {
  try {
    const tasks = loadTasks();
    console.log('[进度 API] 开始检查进度，任务数:', tasks.length);
    
    const alerts = progressService.checkProgressUpdates(tasks);
    
    // 发送预警通知
    for (const alert of alerts) {
      await progressService.sendProgressAlert(alert.task, alert.type);
    }
    
    // 保存数据（预警标记已更新）
    saveTasks(tasks);
    
    res.json({
      success: true,
      data: {
        checkedAt: new Date().toISOString(),
        alertsSent: alerts.length,
        alerts: alerts.map(a => ({
          taskId: a.task.id,
          taskTitle: a.task.title,
          alertType: a.type,
          minutesSinceUpdate: Math.round(a.minutes)
        }))
      }
    });
  } catch (error) {
    console.error('[进度 API] 检查进度失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 发送标准化汇报（定时调用）
 * POST /api/bce/progress/report
 */
router.post('/progress/report', async (req, res) => {
  try {
    const { reportType = 'regular' } = req.body;
    const tasks = loadTasks();
    
    const executingTasks = tasks.filter(t => t.status === 'executing');
    
    // 发送汇报提醒
    for (const task of executingTasks) {
      await progressService.sendProgressReport(task, reportType);
    }
    
    res.json({
      success: true,
      data: {
        sentAt: new Date().toISOString(),
        reportType,
        tasksNotified: executingTasks.length
      }
    });
  } catch (error) {
    console.error('[进度 API] 发送汇报失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 任务确认（支持弹性例外）
 * POST /api/bce/tasks/:id/confirm
 */
router.post('/tasks/:id/confirm', async (req, res) => {
  try {
    const taskId = req.params.id;
    const { action, reason } = req.body;
    const operator = req.body.operator || req.headers['x-operator'] || '系统';
    
    const tasks = loadTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    const now = new Date();
    
    // 处理不同确认动作
    switch (action) {
      case 'confirm':
        // 确认接收
        task.confirmStatus = 'confirmed';
        task.confirmedAt = now.toISOString();
        task.progressUpdatedAt = now.toISOString();
        task.progressPercent = 0;
        break;
        
      case 'meeting':
        // 会议中 - 延时 1 小时
        if (!task.confirmDueAt) {
          task.confirmDueAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
        } else {
          const dueDate = new Date(task.confirmDueAt);
          task.confirmDueAt = new Date(dueDate.getTime() + 60 * 60 * 1000).toISOString();
        }
        task.confirmStatus = 'meeting';
        task.autoExtensions = task.autoExtensions || {};
        task.autoExtensions.meeting = (task.autoExtensions.meeting || 0) + 1;
        break;
        
      case 'deepWork':
        // 专注中 - 延时 2 小时（限 1 次/天）
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const lastDeepWork = task.lastDeepWorkAt ? new Date(task.lastDeepWorkAt) : null;
        
        if (lastDeepWork && lastDeepWork >= todayStart) {
          return res.status(400).json({
            success: false,
            error: '专注中每天只能使用 1 次'
          });
        }
        
        if (!task.confirmDueAt) {
          task.confirmDueAt = new Date(now.getTime() + 120 * 60 * 1000).toISOString();
        } else {
          const dueDate = new Date(task.confirmDueAt);
          task.confirmDueAt = new Date(dueDate.getTime() + 120 * 60 * 1000).toISOString();
        }
        task.confirmStatus = 'deepWork';
        task.autoExtensions = task.autoExtensions || {};
        task.autoExtensions.deepWork = 1;
        task.lastDeepWorkAt = now.toISOString();
        break;
        
      case 'later':
        // 稍后确认 - 延时 30 分钟（限 1 次/任务）
        if (task.autoExtensions && task.autoExtensions.later >= 1) {
          return res.status(400).json({
            success: false,
            error: '稍后确认每个任务只能使用 1 次'
          });
        }
        
        if (!task.confirmDueAt) {
          task.confirmDueAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
        } else {
          const dueDate = new Date(task.confirmDueAt);
          task.confirmDueAt = new Date(dueDate.getTime() + 30 * 60 * 1000).toISOString();
        }
        task.confirmStatus = 'later';
        task.autoExtensions = task.autoExtensions || {};
        task.autoExtensions.later = 1;
        break;
        
      case 'needComm':
        // 需要沟通 - 立即通知管理者
        task.confirmStatus = 'needComm';
        task.needCommReason = reason || '';
        // 通知管理者
        await require('../services/manager-service').notifyNeedComm(task, reason);
        break;
        
      case 'reassign':
        // 申请转交 - 管理者审批
        task.confirmStatus = 'reassign';
        task.reassignReason = reason || '';
        // 通知管理者审批
        await require('../services/manager-service').notifyReassignRequest(task, reason);
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: '无效的确认动作'
        });
    }
    
    task.updatedAt = now.toISOString();
    saveTasks(tasks);
    
    console.log(`[任务确认] 任务 ${taskId} 确认动作：${action}`);
    
    res.json({
      success: true,
      message: getConfirmMessage(action),
      data: {
        taskId,
        confirmStatus: task.confirmStatus,
        confirmDueAt: task.confirmDueAt,
        action
      }
    });
  } catch (error) {
    console.error('[任务确认] 失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function getConfirmMessage(action) {
  const messages = {
    'confirm': '任务已确认，开始执行！',
    'meeting': '已延时 1 小时，会议结束后请及时确认',
    'deepWork': '已延时 2 小时，专注结束后请及时确认（每天限 1 次）',
    'later': '已延时 30 分钟，请及时确认（每个任务限 1 次）',
    'needComm': '已通知管理者，等待沟通',
    'reassign': '已提交转交申请，等待管理者审批'
  };
  return messages[action] || '操作成功';
}

/**
 * 更新进度
 * POST /api/bce/progress/:id
 */
router.post('/progress/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const { percent, completed, remaining, estimate, blockers } = req.body;
    const operator = req.body.operator || req.headers['x-operator'] || '系统';
    
    console.log(`[进度 API] 收到更新请求：taskId=${taskId}, percent=${percent}, type=${typeof percent}`);
    
    // 参数验证
    if (typeof percent !== 'number' || percent < 0 || percent > 100) {
      console.error(`[进度 API] 验证失败：percent=${percent}, type=${typeof percent}`);
      return res.status(400).json({
        success: false,
        error: '进度百分比必须是 0-100 的数字'
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
    
    // 更新进度信息
    const oldProgress = task.progressPercent || 0;
    task.progressPercent = percent;
    task.progressUpdatedAt = new Date().toISOString();
    task.completedWork = completed || task.completedWork;
    task.remainingWork = remaining || task.remainingWork;
    task.estimatedComplete = estimate || task.estimatedComplete;
    task.blockers = blockers || [];
    task.updatedAt = new Date().toISOString();
    
    // 初始化进度管理
    progressService.initProgressTracking(task);
    
    // 记录进度历史
    if (!task.progressHistory) task.progressHistory = [];
    task.progressHistory.push({
      percent,
      completed,
      remaining,
      estimate,
      blockers,
      operator,
      timestamp: new Date().toISOString()
    });
    
    // 重置预警标记
    if (percent > oldProgress) {
      task.progressAlerted = false;
      task.managerAlerted = false;
      task.ceoAlerted = false;
    }
    
    // 保存数据
    saveTasks(tasks);
    
    // 记录审计日志
    logAudit('UPDATE_PROGRESS', operator, operator, 'task', taskId, {
      oldProgress,
      newProgress: percent,
      completed
    });
    
    // 计算下次更新时间
    const nextUpdate = new Date();
    nextUpdate.setMinutes(nextUpdate.getMinutes() + 30);
    
    console.log(`[进度 API] 任务 ${taskId} 进度更新：${oldProgress}% → ${percent}%`);
    
    res.json({
      success: true,
      message: '进度更新成功',
      data: {
        taskId,
        progressPercent: percent,
        progressUpdatedAt: task.progressUpdatedAt,
        nextUpdateDue: nextUpdate.toISOString()
      }
    });
  } catch (error) {
    console.error('[进度 API] 更新进度失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取进度历史
 * GET /api/bce/progress/:id/history
 */
router.get('/progress/:id/history', (req, res) => {
  try {
    const taskId = req.params.id;
    const tasks = loadTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    res.json({
      success: true,
      data: {
        taskId,
        currentProgress: task.progressPercent || 0,
        history: task.progressHistory || [],
        lastUpdate: task.progressUpdatedAt,
        nextUpdateDue: task.progressUpdatedAt ? 
          new Date(new Date(task.progressUpdatedAt).getTime() + 30 * 60 * 1000).toISOString() : null
      }
    });
  } catch (error) {
    console.error('[进度 API] 获取进度历史失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 批量获取项目进度
 * GET /api/bce/progress/project/:projectId
 */
router.get('/progress/project/:projectId', (req, res) => {
  try {
    const projectId = req.params.projectId;
    const tasks = loadTasks();
    
    const projectTasks = tasks.filter(t => t.projectId === projectId);
    
    const progressData = projectTasks.map(task => ({
      id: task.id,
      title: task.title,
      assignee: task.assignee,
      progressPercent: task.progressPercent || 0,
      status: task.status,
      lastUpdate: task.progressUpdatedAt,
      riskLevel: task.riskLevel || 'normal'
    }));
    
    // 计算整体进度
    const totalProgress = projectTasks.reduce((sum, t) => sum + (t.progressPercent || 0), 0);
    const averageProgress = projectTasks.length > 0 ? totalProgress / projectTasks.length : 0;
    
    res.json({
      success: true,
      data: {
        projectId,
        totalTasks: projectTasks.length,
        averageProgress: Math.round(averageProgress),
        tasks: progressData
      }
    });
  } catch (error) {
    console.error('[进度 API] 获取项目进度失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 开启深度工作模式
 * POST /api/bce/progress/:id/deep-work
 */
router.post('/progress/:id/deep-work', async (req, res) => {
  try {
    const taskId = req.params.id;
    const { duration = 120, reason } = req.body;
    const operator = req.body.operator || req.headers['x-operator'] || '系统';
    
    // 验证时长（2-4 小时）
    if (duration < 120 || duration > 240) {
      return res.status(400).json({
        success: false,
        error: '深度工作时长必须在 120-240 分钟之间'
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
    
    // 开启深度工作模式
    task.deepWorkMode = true;
    task.deepWorkStartAt = new Date().toISOString();
    task.deepWorkEndAt = new Date(Date.now() + duration * 60 * 1000).toISOString();
    task.deepWorkReason = reason || '';
    task.deepWorkLogSubmitted = false;
    task.updatedAt = new Date().toISOString();
    
    // 保存数据
    saveTasks(tasks);
    
    console.log(`[深度工作] 任务 ${taskId} 开启深度工作模式，时长：${duration}分钟`);
    
    res.json({
      success: true,
      message: '深度工作模式已开启，系统将暂停预警',
      data: {
        taskId,
        deepWorkStartAt: task.deepWorkStartAt,
        deepWorkEndAt: task.deepWorkEndAt,
        deepWorkDuration: duration,
        reminder: '深度工作结束后请提交工作日志'
      }
    });
  } catch (error) {
    console.error('[深度工作] 开启失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 结束深度工作并提交日志
 * POST /api/bce/progress/:id/deep-work/complete
 */
router.post('/progress/:id/deep-work/complete', async (req, res) => {
  try {
    const taskId = req.params.id;
    const { workLog, progressPercent, completed, remaining } = req.body;
    const operator = req.body.operator || req.headers['x-operator'] || '系统';
    
    if (!workLog) {
      return res.status(400).json({
        success: false,
        error: '工作日志不能为空'
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
    
    // 结束深度工作模式
    task.deepWorkMode = false;
    task.deepWorkLogSubmitted = true;
    task.deepWorkLog = workLog;
    task.deepWorkCompletedAt = new Date().toISOString();
    
    // 同时更新进度
    if (progressPercent) {
      task.progressPercent = progressPercent;
      task.progressUpdatedAt = new Date().toISOString();
      task.completedWork = completed || task.completedWork;
      task.remainingWork = remaining || task.remainingWork;
      
      // 记录进度历史
      if (!task.progressHistory) task.progressHistory = [];
      task.progressHistory.push({
        percent: progressPercent,
        completed,
        remaining,
        operator,
        timestamp: new Date().toISOString(),
        type: 'deep_work_complete'
      });
    }
    
    task.updatedAt = new Date().toISOString();
    
    // 保存数据
    saveTasks(tasks);
    
    console.log(`[深度工作] 任务 ${taskId} 结束深度工作，已提交日志`);
    
    res.json({
      success: true,
      message: '深度工作已结束，工作日志已提交',
      data: {
        taskId,
        deepWorkDuration: (new Date(task.deepWorkCompletedAt) - new Date(task.deepWorkStartAt)) / 1000 / 60,
        progressPercent: task.progressPercent
      }
    });
  } catch (error) {
    console.error('[深度工作] 结束失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取绩效数据
 * GET /api/bce/progress/performance/:assignee
 */
router.get('/progress/performance/:assignee', (req, res) => {
  try {
    const assignee = req.params.assignee;
    const tasks = loadTasks();
    
    const userTasks = tasks.filter(t => t.assignee === assignee && 
      (t.status === 'completed' || t.status === 'accepted'));
    
    let totalScore = 0;
    const taskScores = [];
    
    for (const task of userTasks) {
      const score = progressService.calculatePerformance(task);
      totalScore += score;
      taskScores.push({
        taskId: task.id,
        title: task.title,
        score,
        completedAt: task.completedAt
      });
    }
    
    const averageScore = userTasks.length > 0 ? totalScore / userTasks.length : 0;
    const performanceLevel = progressService.getPerformanceLevel(averageScore);
    
    res.json({
      success: true,
      data: {
        assignee,
        totalTasks: userTasks.length,
        totalScore,
        averageScore: Math.round(averageScore),
        performanceLevel: performanceLevel.level,
        performanceLabel: performanceLevel.label,
        bonusMultiplier: performanceLevel.bonus,
        tasks: taskScores
      }
    });
  } catch (error) {
    console.error('[进度 API] 获取绩效数据失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
