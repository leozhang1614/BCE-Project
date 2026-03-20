const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { checkPermission, checkTaskPermission } = require('../middleware/auth');
const { logAudit, getAuditLogs } = require('../middleware/audit');

// 数据持久化文件
const DATA_FILE = path.join(__dirname, '../../runtime/bce-data.json');

// 内存存储
const tasks = new Map();
const subTasks = new Map();
const comments = new Map();

/**
 * 加载持久化数据
 */
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (data.tasks) data.tasks.forEach(t => tasks.set(t.id, t));
      if (data.subTasks) data.subTasks.forEach(st => subTasks.set(st.id, st));
      if (data.comments) data.comments.forEach(c => comments.set(c.id, c));
      console.log(`[数据] 已加载 ${tasks.size} 个任务，${subTasks.size} 个子任务，${comments.size} 条评论`);
    }
  } catch (error) {
    console.error('[数据] 加载失败:', error.message);
  }
}

/**
 * 保存数据到文件
 */
function saveData() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const data = {
      tasks: Array.from(tasks.values()),
      subTasks: Array.from(subTasks.values()),
      comments: Array.from(comments.values()),
      savedAt: new Date().toISOString()
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`[数据] 已保存 ${tasks.size} 个任务`);
  } catch (error) {
    console.error('[数据] 保存失败:', error.message);
  }
}

// 启动时加载数据
loadData();

/**
 * 发送飞书通知（辅助函数）
 */
function sendFeishuNotification(taskId, task, action, operator, comment) {
  const notifyData = {
    chatId: 'oc_19be54b67684b6597ff335d7534896d4',
    taskId,
    taskTitle: task.title,
    action,
    operator,
    assignee: task.assignee,
    comment
  };
  
  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/feishu-notify/notify/task',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, (res) => {
    console.log(`[飞书通知] 发送${action}通知，状态：${res.statusCode}`);
  });
  
  req.on('error', (e) => {
    console.error('[飞书通知] 发送失败:', e.message);
  });
  
  req.write(JSON.stringify(notifyData));
  req.end();
}

/**
 * 任务状态机
 * 创建 (pending) → 分配 (assigned) → 执行 (executing) → 验收 (reviewing) → 完成 (accepted)
 */
const TASK_STATES = {
  PENDING: 'pending',      // 已创建，待分配
  ASSIGNED: 'assigned',    // 已分配，待执行
  EXECUTING: 'executing',  // 执行中
  REVIEWING: 'reviewing',  // 待验收
  ACCEPTED: 'accepted',    // 已验收
  CANCELLED: 'cancelled'   // 已取消
};

const STATE_TRANSITIONS = {
  [TASK_STATES.PENDING]: [TASK_STATES.ASSIGNED, TASK_STATES.CANCELLED],
  [TASK_STATES.ASSIGNED]: [TASK_STATES.EXECUTING, TASK_STATES.PENDING, TASK_STATES.CANCELLED],
  [TASK_STATES.EXECUTING]: [TASK_STATES.REVIEWING, TASK_STATES.ASSIGNED, TASK_STATES.CANCELLED],
  [TASK_STATES.REVIEWING]: [TASK_STATES.ACCEPTED, TASK_STATES.EXECUTING],
  [TASK_STATES.ACCEPTED]: [],
  [TASK_STATES.CANCELLED]: []
};

/**
 * 创建任务
 * POST /api/bce/tasks
 * Body: { 
 *   title: string, 
 *   description: string,
 *   creator: string,
 *   assignee?: string,
 *   priority?: 'P0'|'P1'|'P2',
 *   dueDate?: string,
 *   projectId?: string
 * }
 */
router.post('/tasks', (req, res) => {
  try {
    const { title, description, creator, assignee, priority = 'P2', dueDate, projectId } = req.body;
    
    if (!title || !creator) {
      return res.status(400).json({ error: 'title 和 creator 不能为空' });
    }
    
    const taskId = uuidv4();
    const task = {
      id: taskId,
      title,
      description: description || '',
      creator,
      assignee: assignee || null,
      priority,
      status: TASK_STATES.PENDING,
      dueDate: dueDate || null,
      projectId: projectId || null,
      subTasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stateHistory: [{
        from: null,
        to: TASK_STATES.PENDING,
        operator: creator,
        timestamp: new Date().toISOString(),
        comment: '任务创建'
      }]
    };
    
    tasks.set(taskId, task);
    saveData(); // 持久化保存
    
    // 记录审计日志
    logAudit('CREATE_TASK', creator, creator, 'task', taskId, {
      title,
      assignee,
      priority
    });
    
    console.log(`[BCE 任务] 创建任务：${taskId}, 标题：${title}, 创建人：${creator}`);
    
    // 如果有负责人，自动发送飞书通知
    if (assignee) {
      sendFeishuNotification(taskId, task, 'created', creator, '新任务已创建，请确认接收');
    }
    
    res.status(201).json({
      success: true,
      taskId,
      message: '任务创建成功',
      data: task
    });
  } catch (error) {
    console.error('创建任务失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 任务搜索
 * GET /api/bce/tasks/search?keyword=xxx&status=assigned&assignee=匠心
 */
router.get('/tasks/search', (req, res) => {
  try {
    const { keyword, status, assignee, creator, priority } = req.query;
    
    let results = Array.from(tasks.values());
    
    // 关键词搜索（标题、描述）
    if (keyword) {
      const lower = keyword.toLowerCase();
      results = results.filter(t => 
        t.title.toLowerCase().includes(lower) ||
        t.description.toLowerCase().includes(lower) ||
        t.creator.toLowerCase().includes(lower)
      );
    }
    
    // 状态筛选
    if (status) results = results.filter(t => t.status === status);
    
    // 负责人筛选
    if (assignee) results = results.filter(t => t.assignee === assignee);
    
    // 创建人筛选
    if (creator) results = results.filter(t => t.creator === creator);
    
    // 优先级筛选
    if (priority) results = results.filter(t => t.priority === priority);
    
    // 按创建时间倒序
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      success: true,
      count: results.length,
      query: { keyword, status, assignee, creator, priority },
      data: results
    });
  } catch (error) {
    console.error('搜索失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 发送飞书通知（辅助函数）
 */
function sendFeishuNotification(taskId, task, action, operator, comment) {
  const notifyData = {
    chatId: 'oc_19be54b67684b6597ff335d7534896d4',
    taskId,
    taskTitle: task.title,
    action,
    operator,
    assignee: task.assignee,
    comment
  };
  
  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/feishu-notify/notify/task',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, (res) => {
    console.log(`[飞书通知] 发送${action}通知，状态：${res.statusCode}`);
  });
  
  req.on('error', (e) => {
    console.error('[飞书通知] 发送失败:', e.message);
  });
  
  req.write(JSON.stringify(notifyData));
  req.end();
}

/**
 * 获取任务列表
 * GET /api/bce/tasks?status=pending&assignee=匠心&projectId=xxx
 */
router.get('/tasks', (req, res) => {
  try {
    const { status, assignee, projectId, creator } = req.query;
    
    let results = Array.from(tasks.values());
    
    if (status) results = results.filter(t => t.status === status);
    if (assignee) results = results.filter(t => t.assignee === assignee);
    if (projectId) results = results.filter(t => t.projectId === projectId);
    if (creator) results = results.filter(t => t.creator === creator);
    
    // 按创建时间倒序
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取任务详情
 * GET /api/bce/tasks/:id
 */
router.get('/tasks/:id', (req, res) => {
  try {
    const { id } = req.params;
    const task = tasks.get(id);
    
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    // 获取子任务
    const taskSubTasks = Array.from(subTasks.values()).filter(st => st.parentTaskId === id);
    
    // 获取评论
    const taskComments = Array.from(comments.values()).filter(c => c.taskId === id);
    
    res.json({
      success: true,
      data: {
        ...task,
        subTasks: taskSubTasks,
        comments: taskComments
      }
    });
  } catch (error) {
    console.error('获取任务详情失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 分配任务
 * POST /api/bce/tasks/:id/assign
 * Body: { assignee: string, comment?: string }
 */
router.post('/tasks/:id/assign', (req, res) => {
  try {
    const { id } = req.params;
    const { assignee, comment } = req.body;
    
    if (!assignee) {
      return res.status(400).json({ error: 'assignee 不能为空' });
    }
    
    const task = tasks.get(id);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    if (!canTransition(task.status, TASK_STATES.ASSIGNED)) {
      return res.status(400).json({ 
        error: `当前状态 ${task.status} 不能转移到 assigned` 
      });
    }
    
    const oldStatus = task.status;
    task.status = TASK_STATES.ASSIGNED;
    task.assignee = assignee;
    task.updatedAt = new Date().toISOString();
    task.stateHistory.push({
      from: oldStatus,
      to: TASK_STATES.ASSIGNED,
      operator: req.body.operator || 'system',
      timestamp: new Date().toISOString(),
      comment: comment || '任务已分配'
    });
    
    console.log(`[BCE 任务] 分配任务：${id}, 负责人：${assignee}`);
    
    // 自动发送飞书通知
    sendFeishuNotification(id, task, 'assigned', req.body.operator || 'system', '任务已分配给您');
    
    res.json({
      success: true,
      message: '任务分配成功',
      data: task
    });
  } catch (error) {
    console.error('分配任务失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 开始执行任务
 * POST /api/bce/tasks/:id/start
 * Body: { operator: string, comment?: string }
 */
router.post('/tasks/:id/start', (req, res) => {
  try {
    const { id } = req.params;
    const { operator, comment } = req.body;
    
    const task = tasks.get(id);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    if (!canTransition(task.status, TASK_STATES.EXECUTING)) {
      return res.status(400).json({ 
        error: `当前状态 ${task.status} 不能转移到 executing` 
      });
    }
    
    const oldStatus = task.status;
    task.status = TASK_STATES.EXECUTING;
    task.updatedAt = new Date().toISOString();
    task.stateHistory.push({
      from: oldStatus,
      to: TASK_STATES.EXECUTING,
      operator: operator || task.assignee,
      timestamp: new Date().toISOString(),
      comment: comment || '开始执行任务'
    });
    
    console.log(`[BCE 任务] 开始执行：${id}`);
    
    // 自动发送飞书通知
    sendFeishuNotification(id, task, 'executing', operator || task.assignee, '任务已开始执行');
    
    res.json({
      success: true,
      message: '任务已开始执行',
      data: task
    });
  } catch (error) {
    console.error('开始执行失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 提交验收
 * POST /api/bce/tasks/:id/submit
 * Body: { operator: string, deliverables?: string[], comment?: string }
 */
router.post('/tasks/:id/submit', (req, res) => {
  try {
    const { id } = req.params;
    const { operator, deliverables, comment } = req.body;
    
    const task = tasks.get(id);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    if (!canTransition(task.status, TASK_STATES.REVIEWING)) {
      return res.status(400).json({ 
        error: `当前状态 ${task.status} 不能转移到 reviewing` 
      });
    }
    
    const oldStatus = task.status;
    task.status = TASK_STATES.REVIEWING;
    task.deliverables = deliverables || [];
    task.updatedAt = new Date().toISOString();
    task.stateHistory.push({
      from: oldStatus,
      to: TASK_STATES.REVIEWING,
      operator: operator || task.assignee,
      timestamp: new Date().toISOString(),
      comment: comment || '提交验收'
    });
    
    console.log(`[BCE 任务] 提交验收：${id}`);
    
    // 自动发送飞书通知
    sendFeishuNotification(id, task, 'reviewing', operator || task.assignee, '已提交验收，请审核');
    
    res.json({
      success: true,
      message: '已提交验收',
      data: task
    });
  } catch (error) {
    console.error('提交验收失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 验收通过
 * POST /api/bce/tasks/:id/accept
 * Body: { acceptor: string, comment?: string }
 */
router.post('/tasks/:id/accept', checkPermission('accept'), checkTaskPermission('accept'), (req, res) => {
  try {
    const { id } = req.params;
    const { acceptor, comment } = req.body;
    
    if (!acceptor) {
      return res.status(400).json({ error: 'acceptor 不能为空' });
    }
    
    const task = tasks.get(id);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    if (!canTransition(task.status, TASK_STATES.ACCEPTED)) {
      return res.status(400).json({ 
        error: `当前状态 ${task.status} 不能转移到 accepted` 
      });
    }
    
    const oldStatus = task.status;
    task.status = TASK_STATES.ACCEPTED;
    task.acceptor = acceptor;
    task.acceptedAt = new Date().toISOString();
    task.updatedAt = new Date().toISOString();
    task.stateHistory.push({
      from: oldStatus,
      to: TASK_STATES.ACCEPTED,
      operator: acceptor,
      timestamp: new Date().toISOString(),
      comment: comment || '验收通过'
    });
    
    console.log(`[BCE 任务] 验收通过：${id}, 验收人：${acceptor}`);
    
    // 自动发送飞书通知
    sendFeishuNotification(id, task, 'accepted', acceptor, comment || '验收通过');
    
    res.json({
      success: true,
      message: '任务验收通过',
      data: task
    });
  } catch (error) {
    console.error('验收失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 取消任务
 * POST /api/bce/tasks/:id/cancel
 * Body: { operator: string, reason: string }
 */
router.post('/tasks/:id/cancel', (req, res) => {
  try {
    const { id } = req.params;
    const { operator, reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ error: '取消原因不能为空' });
    }
    
    const task = tasks.get(id);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    if (!canTransition(task.status, TASK_STATES.CANCELLED)) {
      return res.status(400).json({ 
        error: `当前状态 ${task.status} 不能转移到 cancelled` 
      });
    }
    
    const oldStatus = task.status;
    task.status = TASK_STATES.CANCELLED;
    task.updatedAt = new Date().toISOString();
    task.stateHistory.push({
      from: oldStatus,
      to: TASK_STATES.CANCELLED,
      operator: operator || 'system',
      timestamp: new Date().toISOString(),
      comment: `取消原因：${reason}`
    });
    
    console.log(`[BCE 任务] 取消任务：${id}, 原因：${reason}`);
    
    // 自动发送飞书通知
    sendFeishuNotification(id, task, 'cancelled', operator || 'system', `任务已取消：${reason}`);
    
    res.json({
      success: true,
      message: '任务已取消',
      data: task
    });
  } catch (error) {
    console.error('取消任务失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 创建子任务
 * POST /api/bce/tasks/:id/subtasks
 * Body: { title: string, description?: string, assignee?: string }
 */
router.post('/tasks/:id/subtasks', (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, assignee } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'title 不能为空' });
    }
    
    const parentTask = tasks.get(id);
    if (!parentTask) {
      return res.status(404).json({ error: '父任务不存在' });
    }
    
    const subTaskId = uuidv4();
    const subTask = {
      id: subTaskId,
      parentTaskId: id,
      title,
      description: description || '',
      assignee: assignee || null,
      status: TASK_STATES.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    subTasks.set(subTaskId, subTask);
    parentTask.subTasks.push(subTaskId);
    
    console.log(`[BCE 子任务] 创建子任务：${subTaskId}, 父任务：${id}`);
    
    res.status(201).json({
      success: true,
      subTaskId,
      message: '子任务创建成功',
      data: subTask
    });
  } catch (error) {
    console.error('创建子任务失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 添加评论
 * POST /api/bce/tasks/:id/comments
 * Body: { author: string, content: string, parentId?: string }
 */
router.post('/tasks/:id/comments', (req, res) => {
  try {
    const { id } = req.params;
    const { author, content, parentId } = req.body;
    
    if (!author || !content) {
      return res.status(400).json({ error: 'author 和 content 不能为空' });
    }
    
    const task = tasks.get(id);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    const commentId = uuidv4();
    const comment = {
      id: commentId,
      taskId: id,
      author,
      content,
      parentId: parentId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    comments.set(commentId, comment);
    
    console.log(`[BCE 评论] 添加评论：${commentId}, 任务：${id}, 作者：${author}`);
    
    res.status(201).json({
      success: true,
      commentId,
      message: '评论添加成功',
      data: comment
    });
  } catch (error) {
    console.error('添加评论失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取任务评论
 * GET /api/bce/tasks/:id/comments
 */
router.get('/tasks/:id/comments', (req, res) => {
  try {
    const { id } = req.params;
    
    const taskComments = Array.from(comments.values())
      .filter(c => c.taskId === id)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    res.json({
      success: true,
      count: taskComments.length,
      data: taskComments
    });
  } catch (error) {
    console.error('获取评论失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 辅助函数：检查状态转移是否合法
 */
function canTransition(from, to) {
  const allowedTransitions = STATE_TRANSITIONS[from];
  return allowedTransitions && allowedTransitions.includes(to);
}

/**
 * 获取任务统计
 * GET /api/bce/tasks/stats
 */
router.get('/tasks/stats', (req, res) => {
  try {
    const allTasks = Array.from(tasks.values());
    
    const stats = {
      total: allTasks.length,
      byStatus: {
        pending: allTasks.filter(t => t.status === TASK_STATES.PENDING).length,
        assigned: allTasks.filter(t => t.status === TASK_STATES.ASSIGNED).length,
        executing: allTasks.filter(t => t.status === TASK_STATES.EXECUTING).length,
        reviewing: allTasks.filter(t => t.status === TASK_STATES.REVIEWING).length,
        accepted: allTasks.filter(t => t.status === TASK_STATES.ACCEPTED).length,
        cancelled: allTasks.filter(t => t.status === TASK_STATES.CANCELLED).length
      },
      byPriority: {
        P0: allTasks.filter(t => t.priority === 'P0').length,
        P1: allTasks.filter(t => t.priority === 'P1').length,
        P2: allTasks.filter(t => t.priority === 'P2').length
      }
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取统计失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取审计日志
 * GET /api/bce/audit?userId=xxx&action=CREATE_TASK
 */
router.get('/audit', (req, res) => {
  try {
    const { userId, action, resourceType, resourceId, limit = 50 } = req.query;
    
    const logs = getAuditLogs({
      userId,
      action,
      resourceType,
      resourceId
    }).slice(0, parseInt(limit));
    
    res.json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    console.error('获取审计日志失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 确认收到任务
 * POST /api/bce/tasks/:id/confirm
 * Body: { userId: string, userName: string }
 */
router.post('/tasks/:id/confirm', (req, res) => {
  try {
    const { id } = req.params;
    const { userId, userName } = req.body;
    
    if (!userName) {
      return res.status(400).json({ error: 'userName 不能为空' });
    }
    
    const task = tasks.get(id);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    task.confirmedAt = new Date().toISOString();
    task.confirmedBy = userName;
    task.requireConfirmation = false;
    task.updatedAt = new Date().toISOString();
    
    saveData();
    
    console.log(`[BCE 任务] 任务确认：${id}, 确认人：${userName}`);
    
    res.json({
      success: true,
      message: '任务已确认',
      data: {
        confirmedAt: task.confirmedAt,
        confirmedBy: task.confirmedBy
      }
    });
  } catch (error) {
    console.error('确认任务失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取未确认任务列表
 * GET /api/bce/tasks/unconfirmed
 */
router.get('/tasks/unconfirmed', (req, res) => {
  try {
    const { assignee } = req.query;
    
    let results = Array.from(tasks.values()).filter(t => 
      t.requireConfirmation === true && t.status === 'assigned'
    );
    
    if (assignee) {
      results = results.filter(t => t.assignee === assignee);
    }
    
    res.json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error) {
    console.error('获取未确认任务失败:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
module.exports.tasks = tasks;
module.exports.subTasks = subTasks;
module.exports.comments = comments;
