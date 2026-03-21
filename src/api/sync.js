const express = require('express');
const router = express.Router();
const http = require('http');

// BCE API 地址
const BCE_API_BASE = 'http://localhost:3000/api/bce';

/**
 * 获取 BCE 任务列表（同步 Control Center）
 * GET /api/sync/bce/tasks
 */
router.get('/tasks', (req, res) => {
  http.get(`${BCE_API_BASE}/tasks`, (bceRes) => {
    let data = '';
    bceRes.on('data', chunk => data += chunk);
    bceRes.on('end', () => {
      try {
        const bceData = JSON.parse(data);
        res.json({
          success: true,
          source: 'BCE',
          syncedAt: new Date().toISOString(),
          data: bceData.data || []
        });
      } catch (e) {
        res.status(500).json({ error: '解析 BCE 数据失败' });
      }
    });
  }).on('error', (e) => {
    res.status(500).json({ error: `连接 BCE 失败：${e.message}` });
  });
});

/**
 * 获取 BCE 任务详情
 * GET /api/sync/bce/tasks/:id
 */
router.get('/tasks/:id', (req, res) => {
  const { id } = req.params;
  http.get(`${BCE_API_BASE}/tasks/${id}`, (bceRes) => {
    let data = '';
    bceRes.on('data', chunk => data += chunk);
    bceRes.on('end', () => {
      try {
        const bceData = JSON.parse(data);
        res.json({
          success: true,
          source: 'BCE',
          syncedAt: new Date().toISOString(),
          data: bceData.data || {}
        });
      } catch (e) {
        res.status(500).json({ error: '解析 BCE 数据失败' });
      }
    });
  }).on('error', (e) => {
    res.status(500).json({ error: `连接 BCE 失败：${e.message}` });
  });
});

/**
 * 获取 BCE 任务统计
 * GET /api/sync/bce/tasks/stats
 */
router.get('/tasks/stats', (req, res) => {
  http.get(`${BCE_API_BASE}/tasks/stats`, (bceRes) => {
    let data = '';
    bceRes.on('data', chunk => data += chunk);
    bceRes.on('end', () => {
      try {
        const bceData = JSON.parse(data);
        res.json({
          success: true,
          source: 'BCE',
          syncedAt: new Date().toISOString(),
          data: bceData.data || {}
        });
      } catch (e) {
        res.status(500).json({ error: '解析 BCE 数据失败' });
      }
    });
  }).on('error', (e) => {
    res.status(500).json({ error: `连接 BCE 失败：${e.message}` });
  });
});

/**
 * 健康检查
 * GET /api/sync/health
 */
router.get('/health', (req, res) => {
  http.get(`${BCE_API_BASE}/tasks`, (bceRes) => {
    res.json({
      success: true,
      bceConnected: bceRes.statusCode === 200,
      syncedAt: new Date().toISOString()
    });
  }).on('error', () => {
    res.json({
      success: false,
      bceConnected: false,
      error: 'BCE 服务不可用'
    });
  });
});

module.exports = router;
