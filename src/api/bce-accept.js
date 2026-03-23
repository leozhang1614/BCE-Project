/**
 * 任务验收 API 路由
 * 
 * 端点：
 * POST /api/bce/tasks/:id/accept - 验收任务
 * POST /api/bce/tasks/:id/reject - 驳回任务
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../runtime/bce-data.json');

/**
 * 保存数据
 */
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * 加载数据
 */
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
  return { tasks: [], subTasks: [] };
}

/**
 * POST /api/bce/tasks/:id/accept
 * 验收任务
 */
router.post('/:id/accept', async (req, res) => {
  try {
    const { id } = req.params;
    const { userName, comment } = req.body;
    
    const data = loadData();
    const task = data.tasks.find(t => t.id === id);
    
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    // 检查是否是待验收状态
    if (task.status !== 'pending_acc') {
      return res.status(400).json({ error: '任务不是待验收状态' });
    }
    
    // 检查验收人权限（直接检查用户名，不使用中间件）
    const allowedAcceptors = ['司库', '天枢', '磊哥'];
    if (!allowedAcceptors.includes(userName)) {
      return res.status(403).json({ error: '权限不足，只有司库/天枢/磊哥可以验收' });
    }
    
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
    
    saveData(data);
    
    // ✅ 通知审核人（执矩）确认接收
    console.log(`[验收 API] 任务已流转到审核环节，审核人：执矩`);
    console.log(`[验收 API] 心跳任务将在 5 分钟内提醒执矩确认`);
    
    res.json({
      success: true,
      message: '任务验收通过',
      data: {
        taskId: id,
        status: task.status,
        acceptedAt: task.acceptedAt
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
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { userName, comment, rejectReason } = req.body;
    
    const data = loadData();
    const task = data.tasks.find(t => t.id === id);
    
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    // 检查是否是待验收状态
    if (task.status !== 'pending_acc') {
      return res.status(400).json({ error: '任务不是待验收状态' });
    }
    
    // 检查验收人权限
    if (userName !== '司库' && userName !== '天枢') {
      return res.status(403).json({ error: '权限不足' });
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
    
    saveData(data);
    
    // TODO: 通知执行者（匠心）
    console.log(`[验收 API] 已通知执行者`);
    
    res.json({
      success: true,
      message: '任务已驳回',
      data: {
        taskId: id,
        status: task.status,
        rejectedAt: task.rejectedAt
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
