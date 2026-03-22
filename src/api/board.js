const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// 数据文件路径
const BOARD_DATA_PATH = path.join(__dirname, '../../runtime/board-data.json');

// 从文件加载看板数据
function loadBoardData() {
  try {
    if (fs.existsSync(BOARD_DATA_PATH)) {
      const content = fs.readFileSync(BOARD_DATA_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[任务板] 加载数据失败:', error.message);
  }
  // 返回默认看板
  return {
    id: 'bce-main-board',
    name: 'BCE 主任务板',
    description: '北斗协同引擎 - 统一任务管理看板',
    members: ['匠心', '司库', '磐石', '执矩', '灵犀', '天策', '天枢'],
    tasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// 保存看板数据
function saveBoardData(board) {
  try {
    board.updatedAt = new Date().toISOString();
    fs.writeFileSync(BOARD_DATA_PATH, JSON.stringify(board, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('[任务板] 保存数据失败:', error.message);
    return false;
  }
}

// 初始化看板数据
let boardData = loadBoardData();
console.log(`[任务板] 加载看板数据成功，任务数：${boardData.tasks?.length || 0}`);

/**
 * 创建任务板
 * POST /api/board
 * Body: { name: string, description: string, members: string[] }
 */
router.post('/', (req, res) => {
  try {
    const { name, description, members = [] } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '任务板名称不能为空' });
    }
    
    const boardId = uuidv4();
    const board = {
      id: boardId,
      name,
      description,
      members,
      tasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    boards.set(boardId, board);
    
    console.log(`[任务板] 创建任务板：${boardId}, 名称：${name}, 成员：${members.length}人`);
    
    res.status(201).json({
      success: true,
      boardId,
      message: '任务板创建成功',
      data: board
    });
  } catch (error) {
    console.error('创建任务板失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取任务板列表
 * GET /api/board
 */
router.get('/', (req, res) => {
  try {
    // 重新加载最新数据
    boardData = loadBoardData();
    
    const boardList = [{
      id: boardData.id,
      name: boardData.name,
      description: boardData.description,
      memberCount: boardData.members.length,
      taskCount: boardData.tasks?.length || 0,
      updatedAt: boardData.updatedAt
    }];
    
    res.json({
      success: true,
      count: boardList.length,
      data: boardList
    });
  } catch (error) {
    console.error('获取任务板列表失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取任务板详情
 * GET /api/board/:id
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // 重新加载最新数据
    boardData = loadBoardData();
    
    // 支持通过 ID 查询或使用默认看板
    let board = boardData;
    if (id !== 'bce-main-board' && boardData.id !== id) {
      return res.status(404).json({ error: '任务板不存在' });
    }
    
    res.json({
      success: true,
      data: board
    });
  } catch (error) {
    console.error('获取任务板详情失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 添加任务到任务板
 * POST /api/board/:id/tasks
 * Body: { title: string, description: string, assignee: string, priority: string }
 */
router.post('/:id/tasks', (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, assignee, priority = 'P2' } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: '任务标题不能为空' });
    }
    
    const board = boards.get(id);
    if (!board) {
      return res.status(404).json({ error: '任务板不存在' });
    }
    
    const taskId = uuidv4();
    const task = {
      id: taskId,
      boardId: id,
      title,
      description,
      assignee,
      priority, // P0, P1, P2, P3
      status: 'todo', // todo, in_progress, review, done
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    tasks.set(taskId, task);
    board.tasks.push(taskId);
    board.updatedAt = new Date().toISOString();
    
    console.log(`[任务板] 添加任务：${taskId}, 标题：${title}, 负责人：${assignee}`);
    
    res.status(201).json({
      success: true,
      taskId,
      message: '任务创建成功',
      data: task
    });
  } catch (error) {
    console.error('添加任务失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 更新任务状态
 * PUT /api/board/:id/tasks/:taskId
 * Body: { status: string, assignee?: string, priority?: string }
 */
router.put('/:id/tasks/:taskId', (req, res) => {
  try {
    const { id, taskId } = req.params;
    const { status, assignee, priority } = req.body;
    
    const task = tasks.get(taskId);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    if (task.boardId !== id) {
      return res.status(400).json({ error: '任务不属于此任务板' });
    }
    
    if (status) task.status = status;
    if (assignee) task.assignee = assignee;
    if (priority) task.priority = priority;
    task.updatedAt = new Date().toISOString();
    
    console.log(`[任务板] 更新任务：${taskId}, 状态：${task.status}`);
    
    res.json({
      success: true,
      message: '任务更新成功',
      data: task
    });
  } catch (error) {
    console.error('更新任务失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 删除任务
 * DELETE /api/board/:id/tasks/:taskId
 */
router.delete('/:id/tasks/:taskId', (req, res) => {
  try {
    const { id, taskId } = req.params;
    
    const task = tasks.get(taskId);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    const board = boards.get(id);
    if (!board) {
      return res.status(404).json({ error: '任务板不存在' });
    }
    
    board.tasks = board.tasks.filter(tid => tid !== taskId);
    tasks.delete(taskId);
    board.updatedAt = new Date().toISOString();
    
    console.log(`[任务板] 删除任务：${taskId}`);
    
    res.json({
      success: true,
      message: '任务删除成功'
    });
  } catch (error) {
    console.error('删除任务失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取任务统计
 * GET /api/board/:id/stats
 */
router.get('/:id/stats', (req, res) => {
  try {
    const { id } = req.params;
    
    const board = boards.get(id);
    if (!board) {
      return res.status(404).json({ error: '任务板不存在' });
    }
    
    const boardTasks = board.tasks.map(taskId => tasks.get(taskId)).filter(Boolean);
    
    const stats = {
      total: boardTasks.length,
      byStatus: {
        todo: boardTasks.filter(t => t.status === 'todo').length,
        in_progress: boardTasks.filter(t => t.status === 'in_progress').length,
        review: boardTasks.filter(t => t.status === 'review').length,
        done: boardTasks.filter(t => t.status === 'done').length
      },
      byPriority: {
        P0: boardTasks.filter(t => t.priority === 'P0').length,
        P1: boardTasks.filter(t => t.priority === 'P1').length,
        P2: boardTasks.filter(t => t.priority === 'P2').length,
        P3: boardTasks.filter(t => t.priority === 'P3').length
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

// 导出供外部访问
module.exports = router;
module.exports.loadBoardData = loadBoardData;
module.exports.saveBoardData = saveBoardData;
