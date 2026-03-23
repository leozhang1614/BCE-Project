/**
 * 开发工作流 API 路由
 * 
 * 端点：
 * POST /api/bce/dev/submit - 提交开发成果
 * POST /api/bce/dev/complete - 完成任务并流转
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
 * POST /api/bce/dev/submit
 * 提交开发成果（自动更新任务状态并通知验收）
 */
router.post('/submit', async (req, res) => {
  try {
    const { taskTitles, developer, deliverables, comment } = req.body;
    
    if (!taskTitles || !Array.isArray(taskTitles) || taskTitles.length === 0) {
      return res.status(400).json({ error: '任务列表不能为空' });
    }
    
    console.log(`[开发提交] 收到提交请求：${taskTitles.length}个任务`);
    
    const data = loadData();
    const updatedTasks = [];
    
    // 更新任务状态
    for (const task of data.tasks) {
      if (taskTitles.includes(task.title)) {
        // 更新状态为待验收
        task.status = 'pending_acc';
        task.currentNode = 'pending_acc';
        task.completedAt = new Date().toISOString();
        task.completedBy = developer || task.assignee;
        task.deliverables = deliverables || [];
        task.developerComment = comment || '';
        task.updatedAt = new Date().toISOString();
        
        updatedTasks.push(task);
        console.log(`[开发提交] 任务已更新：${task.title} -> pending_acc`);
      }
    }
    
    if (updatedTasks.length === 0) {
      return res.status(404).json({ error: '未找到匹配的任务' });
    }
    
    // 保存数据
    saveData(data);
    
    // TODO: 通知验收人（司库）
    console.log(`[开发提交] 已通知验收人`);
    
    res.json({
      success: true,
      count: updatedTasks.length,
      data: {
        tasks: updatedTasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          completedAt: t.completedAt
        }))
      }
    });
    
  } catch (error) {
    console.error(`[开发提交] 失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/bce/dev/complete
 * 完成任务（兼容旧接口）
 */
router.post('/complete', async (req, res) => {
  // 转发到 submit 接口
  req.body.taskTitles = req.body.taskIds;
  return router.handle(req, res);
});

module.exports = router;
