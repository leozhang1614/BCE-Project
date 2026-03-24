/**
 * OCC 同步服务 API（v3.2）
 * BCE 所有写操作通过 OCC API 执行
 * OCC 为主数据源
 */

const express = require('express');
const router = express.Router();
const http = require('http');

const OCC_BASE_URL = process.env.OCC_BASE_URL || 'http://192.168.31.187:4310';
const OCC_TIMEOUT = parseInt(process.env.OCC_TIMEOUT) || 10000;

/**
 * OCC HTTP 请求封装
 */
function occRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, OCC_BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: OCC_TIMEOUT
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('OCC 请求超时'));
    });
    
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * 获取 OCC 任务列表
 */
async function getOccTasks() {
  return occRequest('GET', '/api/tasks');
}

/**
 * 获取单个 OCC 任务
 */
async function getOccTask(taskId) {
  return occRequest('GET', `/api/tasks/${taskId}`);
}

/**
 * 创建 OCC 任务
 */
async function createOccTask(task) {
  return occRequest('POST', '/api/tasks', task);
}

/**
 * 更新 OCC 任务
 */
async function updateOccTask(taskId, updates) {
  return occRequest('PUT', `/api/tasks/${taskId}`, updates);
}

/**
 * 确认 OCC 任务
 */
async function confirmOccTask(taskId, userName) {
  return occRequest('POST', `/api/tasks/${taskId}/confirm`, { userName });
}

/**
 * 驳回 OCC 任务
 */
async function rejectOccTask(taskId, userName, reason) {
  return occRequest('POST', `/api/tasks/${taskId}/reject`, { userName, reason });
}

/**
 * 获取 OCC 待确认事项
 */
async function getOccActionQueue() {
  return occRequest('GET', '/api/action-queue');
}

// ==================== API 路由 ====================

/**
 * GET /api/occ/tasks - 同步 OCC 任务到 BCE
 */
router.get('/tasks', async (req, res) => {
  try {
    const occTasks = await getOccTasks();
    res.json({
      success: true,
      source: 'OCC',
      count: Array.isArray(occTasks) ? occTasks.length : 0,
      data: occTasks
    });
  } catch (error) {
    res.status(500).json({ error: `OCC 同步失败: ${error.message}` });
  }
});

/**
 * GET /api/occ/action-queue - 获取待确认事项
 */
router.get('/action-queue', async (req, res) => {
  try {
    const queue = await getOccActionQueue();
    res.json({
      success: true,
      source: 'OCC',
      count: Array.isArray(queue) ? queue.length : 0,
      data: queue
    });
  } catch (error) {
    res.status(500).json({ error: `OCC 同步失败: ${error.message}` });
  }
});

/**
 * POST /api/occ/sync - 触发完整同步
 */
router.post('/sync', async (req, res) => {
  try {
    const tasks = await getOccTasks();
    const queue = await getOccActionQueue();
    
    res.json({
      success: true,
      message: 'OCC 同步完成',
      stats: {
        tasks: Array.isArray(tasks) ? tasks.length : 0,
        actionQueue: Array.isArray(queue) ? queue.length : 0
      },
      syncedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: `OCC 同步失败: ${error.message}` });
  }
});

/**
 * GET /api/occ/health - OCC 健康检查
 */
router.get('/health', async (req, res) => {
  try {
    const start = Date.now();
    const tasks = await getOccTasks();
    const latency = Date.now() - start;
    
    res.json({
      success: true,
      status: 'healthy',
      url: OCC_BASE_URL,
      latency: `${latency}ms`,
      taskCount: Array.isArray(tasks) ? tasks.length : 0
    });
  } catch (error) {
    res.json({
      success: false,
      status: 'unhealthy',
      url: OCC_BASE_URL,
      error: error.message
    });
  }
});

module.exports = router;
module.exports.getOccTasks = getOccTasks;
module.exports.getOccTask = getOccTask;
module.exports.createOccTask = createOccTask;
module.exports.updateOccTask = updateOccTask;
module.exports.confirmOccTask = confirmOccTask;
module.exports.rejectOccTask = rejectOccTask;
module.exports.getOccActionQueue = getOccActionQueue;

// v3.4 修复：添加别名兼容旧代码
module.exports.getTask = getOccTask;
module.exports.updateTask = updateOccTask;
module.exports.confirmTask = confirmOccTask;
module.exports.rejectTask = rejectOccTask;
