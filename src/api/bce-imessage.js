/**
 * iMessage 通知 API 路由
 * 
 * 端点：
 * POST /api/bce/imessage/send - 发送通知
 * POST /api/bce/imessage/task - 任务通知
 * POST /api/bce/imessage/alert - 告警通知
 * GET /api/bce/imessage/history - 通知历史
 * GET /api/bce/imessage/stats - 统计信息
 */

const express = require('express');
const router = express.Router();
const { iMessageService, NOTIFICATION_LEVELS } = require('../services/imessage-service');

/**
 * POST /api/bce/imessage/send
 * 发送 iMessage 通知
 */
router.post('/send', async (req, res) => {
  try {
    const { phoneNumber, message, level = NOTIFICATION_LEVELS.INFO } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: 'phoneNumber 和 message 不能为空'
      });
    }

    const result = await iMessageService.send(phoneNumber, message, level);
    
    res.json(result);
  } catch (error) {
    console.error('[iMessage API] 发送通知失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/bce/imessage/task
 * 发送任务通知
 */
router.post('/task', async (req, res) => {
  try {
    const { assignee, taskTitle, taskStatus, taskUrl } = req.body;

    if (!assignee || !taskTitle || !taskStatus) {
      return res.status(400).json({
        success: false,
        error: 'assignee、taskTitle 和 taskStatus 不能为空'
      });
    }

    const result = await iMessageService.sendTaskNotification(assignee, taskTitle, taskStatus, taskUrl);
    
    res.json(result);
  } catch (error) {
    console.error('[iMessage API] 发送任务通知失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/bce/imessage/alert
 * 发送告警通知
 */
router.post('/alert', async (req, res) => {
  try {
    const { level, alertType, message } = req.body;

    if (!level || !alertType || !message) {
      return res.status(400).json({
        success: false,
        error: 'level、alertType 和 message 不能为空'
      });
    }

    const result = await iMessageService.sendAlert(level, alertType, message);
    
    res.json(result);
  } catch (error) {
    console.error('[iMessage API] 发送告警失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bce/imessage/history
 * 获取通知历史
 */
router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const level = req.query.level;
    
    const history = iMessageService.getHistory(limit, level);
    
    res.json({
      success: true,
      data: {
        notifications: history,
        count: history.length
      }
    });
  } catch (error) {
    console.error('[iMessage API] 获取历史失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bce/imessage/stats
 * 获取统计信息
 */
router.get('/stats', (req, res) => {
  try {
    const stats = iMessageService.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[iMessage API] 获取统计失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
