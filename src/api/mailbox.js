/**
 * 邮箱 API
 * 支持离线拉取、标记已读
 */

const express = require('express');
const router = express.Router();
const mailboxService = require('../services/mailbox-service');

/**
 * GET /api/mailbox/unread - 获取未读消息
 */
router.get('/unread', async (req, res) => {
  try {
    const { agent } = req.query;
    
    if (!agent) {
      return res.status(400).json({ error: '缺少 agent 参数' });
    }
    
    const messages = await mailboxService.getUnread(agent);
    
    res.json({
      success: true,
      unreadCount: messages.length,
      messages: messages.map(m => ({
        id: m.id,
        from: m.from,
        type: m.type,
        taskId: m.taskId,
        sessionKey: m.sessionKey,
        content: m.content,
        createdAt: m.createdAt,
        read: m.read
      }))
    });
  } catch (error) {
    console.error('[邮箱 API] 获取未读消息失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mailbox/read - 标记已读
 */
router.post('/read', async (req, res) => {
  try {
    const { agent, messageIds } = req.body;
    
    if (!agent || !messageIds) {
      return res.status(400).json({ error: '缺少 agent 或 messageIds 参数' });
    }
    
    await mailboxService.markBatchAsRead(messageIds, agent);
    
    res.json({
      success: true,
      message: `已标记 ${messageIds.length} 条消息为已读`
    });
  } catch (error) {
    console.error('[邮箱 API] 标记已读失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mailbox/count - 未读计数
 */
router.get('/count', async (req, res) => {
  try {
    const { agent } = req.query;
    
    if (!agent) {
      return res.status(400).json({ error: '缺少 agent 参数' });
    }
    
    const count = await mailboxService.count(agent);
    
    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('[邮箱 API] 获取计数失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mailbox/cleanup - 清理旧消息
 */
router.post('/cleanup', async (req, res) => {
  try {
    const { agent, keep } = req.body;
    
    if (!agent) {
      return res.status(400).json({ error: '缺少 agent 参数' });
    }
    
    await mailboxService.cleanup(agent, keep || 100);
    
    res.json({
      success: true,
      message: '清理完成'
    });
  } catch (error) {
    console.error('[邮箱 API] 清理失败:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
