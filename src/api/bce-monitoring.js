/**
 * 运维监控 API 路由
 * 
 * 端点：
 * GET /api/bce/monitoring/health - 健康检查
 * GET /api/bce/monitoring/stats - API 统计
 * GET /api/bce/monitoring/errors - 错误列表
 * GET /api/bce/monitoring/alerts - 告警列表
 */

const express = require('express');
const router = express.Router();
const { monitoringService } = require('../services/monitoring-service');

/**
 * 中间件：记录 API 调用
 */
function recordAPICall(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const success = res.statusCode >= 200 && res.statusCode < 300;
    monitoringService.recordAPICall(req.originalUrl, duration, success);
  });
  
  next();
}

// 应用中间件到所有监控路由
router.use(recordAPICall);

/**
 * GET /api/bce/monitoring/health
 * 健康检查
 */
router.get('/health', (req, res) => {
  try {
    const health = monitoringService.getHealthStatus();
    res.json(health);
  } catch (error) {
    console.error('[监控 API] 健康检查失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bce/monitoring/stats
 * API 调用统计
 */
router.get('/stats', (req, res) => {
  try {
    const stats = monitoringService.getAPIStats();
    res.json({
      success: true,
      data: {
        stats,
        totalEndpoints: Object.keys(stats).length
      }
    });
  } catch (error) {
    console.error('[监控 API] 获取统计失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bce/monitoring/errors
 * 错误列表
 */
router.get('/errors', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const errors = monitoringService.getErrors(limit);
    res.json({
      success: true,
      data: {
        errors,
        count: errors.length
      }
    });
  } catch (error) {
    console.error('[监控 API] 获取错误列表失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bce/monitoring/alerts
 * 告警列表
 */
router.get('/alerts', (req, res) => {
  try {
    // 检查告警条件
    const alerts = monitoringService.checkAlerts();
    
    // 保存告警
    if (alerts.length > 0) {
      monitoringService.saveAlerts(alerts);
      console.log('[监控 API] 生成告警:', alerts.length);
    }
    
    // 读取历史告警
    const fs = require('fs');
    const path = require('path');
    const ALERTS_FILE = path.join(__dirname, '../../runtime/alerts.json');
    
    let historicalAlerts = [];
    if (fs.existsSync(ALERTS_FILE)) {
      historicalAlerts = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'));
    }
    
    res.json({
      success: true,
      data: {
        current: alerts,
        historical: historicalAlerts.slice(-20), // 最近 20 条
        count: alerts.length
      }
    });
  } catch (error) {
    console.error('[监控 API] 获取告警列表失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
