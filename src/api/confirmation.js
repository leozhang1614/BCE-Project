const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// 内存存储（生产环境应使用数据库）
const confirmations = new Map();
const reminders = new Map();

/**
 * 创建强制确认请求
 * POST /api/confirmation
 * Body: { 
 *   messageId: string, 
 *   recipientId: string, 
 *   content: string,
 *   timeoutMinutes: number (默认 30)
 * }
 */
router.post('/', (req, res) => {
  try {
    const { messageId, recipientId, content, timeoutMinutes = 30 } = req.body;
    
    if (!messageId || !recipientId || !content) {
      return res.status(400).json({ 
        error: '缺少必要参数：messageId, recipientId, content' 
      });
    }
    
    const confirmationId = uuidv4();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + timeoutMinutes * 60000);
    
    const confirmation = {
      id: confirmationId,
      messageId,
      recipientId,
      content,
      status: 'pending', // pending, confirmed, expired, escalated
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      confirmedAt: null,
      reminderCount: 0,
      escalatedAt: null
    };
    
    confirmations.set(confirmationId, confirmation);
    
    // 设置超时检查
    const timeoutMs = timeoutMinutes * 60000;
    setTimeout(() => {
      checkExpiration(confirmationId);
    }, timeoutMs);
    
    console.log(`[确认] 创建确认请求：${confirmationId}, 接收方：${recipientId}, 超时：${timeoutMinutes}分钟`);
    
    res.status(201).json({
      success: true,
      confirmationId,
      message: '确认请求已创建',
      data: confirmation
    });
  } catch (error) {
    console.error('创建确认请求失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 确认消息
 * POST /api/confirmation/:id/confirm
 */
router.post('/:id/confirm', (req, res) => {
  try {
    const { id } = req.params;
    const { userId, comment } = req.body;
    
    const confirmation = confirmations.get(id);
    if (!confirmation) {
      return res.status(404).json({ error: '确认请求不存在' });
    }
    
    if (confirmation.status !== 'pending') {
      return res.status(400).json({ 
        error: `确认请求状态已是 ${confirmation.status}` 
      });
    }
    
    if (confirmation.recipientId !== userId) {
      return res.status(403).json({ error: '无权确认此消息' });
    }
    
    // 更新状态
    confirmation.status = 'confirmed';
    confirmation.confirmedAt = new Date().toISOString();
    confirmation.confirmComment = comment || null;
    
    console.log(`[确认] 消息已确认：${id}, 确认人：${userId}`);
    
    res.json({
      success: true,
      message: '确认成功',
      data: confirmation
    });
  } catch (error) {
    console.error('确认消息失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 发送提醒
 * POST /api/confirmation/:id/reminder
 */
router.post('/:id/reminder', (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    
    const confirmation = confirmations.get(id);
    if (!confirmation) {
      return res.status(404).json({ error: '确认请求不存在' });
    }
    
    if (confirmation.status !== 'pending') {
      return res.status(400).json({ error: '仅待确认状态可以发送提醒' });
    }
    
    confirmation.reminderCount += 1;
    const lastReminderAt = new Date().toISOString();
    
    console.log(`[提醒] 发送第${confirmation.reminderCount}次提醒：${id}, 接收方：${confirmation.recipientId}`);
    
    res.json({
      success: true,
      message: '提醒已发送',
      data: {
        ...confirmation,
        lastReminderAt,
        reminderMessage: message || '请尽快确认此消息'
      }
    });
  } catch (error) {
    console.error('发送提醒失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 升级通知
 * POST /api/confirmation/:id/escalate
 */
router.post('/:id/escalate', (req, res) => {
  try {
    const { id } = req.params;
    const { managerId, reason } = req.body;
    
    const confirmation = confirmations.get(id);
    if (!confirmation) {
      return res.status(404).json({ error: '确认请求不存在' });
    }
    
    if (confirmation.status !== 'pending') {
      return res.status(400).json({ error: '仅待确认状态可以升级' });
    }
    
    confirmation.status = 'escalated';
    confirmation.escalatedAt = new Date().toISOString();
    confirmation.managerId = managerId;
    confirmation.escalationReason = reason || '超时未确认';
    
    console.log(`[升级] 消息已升级：${id}, 通知上级：${managerId}, 原因：${reason}`);
    
    res.json({
      success: true,
      message: '已升级通知上级',
      data: confirmation
    });
  } catch (error) {
    console.error('升级通知失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取确认状态
 * GET /api/confirmation/:id
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const confirmation = confirmations.get(id);
    if (!confirmation) {
      return res.status(404).json({ error: '确认请求不存在' });
    }
    
    res.json({
      success: true,
      data: confirmation
    });
  } catch (error) {
    console.error('获取确认状态失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取所有待确认消息
 * GET /api/confirmation?status=pending&recipientId=xxx
 */
router.get('/', (req, res) => {
  try {
    const { status, recipientId } = req.query;
    
    let results = Array.from(confirmations.values());
    
    if (status) {
      results = results.filter(c => c.status === status);
    }
    
    if (recipientId) {
      results = results.filter(c => c.recipientId === recipientId);
    }
    
    // 按创建时间倒序
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error) {
    console.error('获取确认列表失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 检查是否超时
 */
function checkExpiration(confirmationId) {
  const confirmation = confirmations.get(confirmationId);
  if (!confirmation) return;
  
  if (confirmation.status === 'pending') {
    confirmation.status = 'expired';
    console.log(`[超时] 确认请求已超时：${confirmationId}, 接收方：${confirmation.recipientId}`);
    
    // 自动触发升级通知（如果有配置）
    if (confirmation.managerId) {
      confirmation.status = 'escalated';
      confirmation.escalatedAt = new Date().toISOString();
      console.log(`[自动升级] 通知上级：${confirmation.managerId}`);
    }
  }
}

// 导出供外部调用
module.exports = router;
module.exports.checkExpiration = checkExpiration;
module.exports.confirmations = confirmations;
