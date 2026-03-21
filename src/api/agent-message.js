const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// 内存存储 Agent 消息
const agentMessages = new Map();
const agentStatus = new Map();

// 初始化 Agent 状态
const agents = ['匠心', '司库', '执矩', '磐石', '天枢', '灵犀'];
agents.forEach(agent => {
  agentStatus.set(agent, {
    id: agent,
    online: false,
    lastSeenAt: null,
    unreadCount: 0
  });
});

/**
 * Agent 上线通知
 * POST /api/agent/online
 * Body: { agentId: string }
 */
router.post('/online', (req, res) => {
  try {
    const { agentId } = req.body;
    
    if (!agentId) {
      return res.status(400).json({ error: 'agentId 不能为空' });
    }
    
    const status = agentStatus.get(agentId) || {
      id: agentId,
      online: false,
      lastSeenAt: null,
      unreadCount: 0
    };
    
    status.online = true;
    status.lastSeenAt = new Date().toISOString();
    agentStatus.set(agentId, status);
    
    console.log(`[Agent] ${agentId} 已上线`);
    
    res.json({
      success: true,
      message: `${agentId} 已上线`,
      data: status
    });
  } catch (error) {
    console.error('Agent 上线失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Agent 下线通知
 * POST /api/agent/offline
 * Body: { agentId: string }
 */
router.post('/offline', (req, res) => {
  try {
    const { agentId } = req.body;
    
    if (!agentId) {
      return res.status(400).json({ error: 'agentId 不能为空' });
    }
    
    const status = agentStatus.get(agentId);
    if (status) {
      status.online = false;
      status.lastSeenAt = new Date().toISOString();
      agentStatus.set(agentId, status);
    }
    
    console.log(`[Agent] ${agentId} 已下线`);
    
    res.json({
      success: true,
      message: `${agentId} 已下线`,
      data: status
    });
  } catch (error) {
    console.error('Agent 下线失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 发送消息给其他 Agent
 * POST /api/agent/message
 * Body: { 
 *   from: string, 
 *   to: string | string[], 
 *   content: string,
 *   type: 'direct' | 'broadcast',
 *   requireReply: boolean
 * }
 */
router.post('/message', (req, res) => {
  try {
    const { from, to, content, type = 'direct', requireReply = false } = req.body;
    
    if (!from || !content) {
      return res.status(400).json({ error: 'from 和 content 不能为空' });
    }
    
    if (!to && type === 'direct') {
      return res.status(400).json({ error: 'direct 消息需要指定 to' });
    }
    
    const messageId = uuidv4();
    const message = {
      id: messageId,
      from,
      to: type === 'broadcast' ? ['all'] : (Array.isArray(to) ? to : [to]),
      content,
      type,
      requireReply,
      status: 'sent',
      createdAt: new Date().toISOString(),
      readAt: null,
      repliedAt: null
    };
    
    // 存储消息
    agentMessages.set(messageId, message);
    
    // 更新接收者的未读计数
    const recipients = type === 'broadcast' ? agents : (Array.isArray(to) ? to : [to]);
    recipients.forEach(agent => {
      if (agent !== from) {
        const status = agentStatus.get(agent);
        if (status) {
          status.unreadCount = (status.unreadCount || 0) + 1;
          agentStatus.set(agent, status);
        }
      }
    });
    
    console.log(`[Agent 消息] ${from} → ${recipients.join(',')}: ${content.substring(0, 50)}...`);
    
    res.status(201).json({
      success: true,
      messageId,
      message: '消息已发送',
      data: message
    });
  } catch (error) {
    console.error('发送 Agent 消息失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取我的消息
 * GET /api/agent/message/my?agentId=xxx&status=unread|read|all
 */
router.get('/message/my', (req, res) => {
  try {
    const { agentId, status = 'unread', limit = 20 } = req.query;
    
    if (!agentId) {
      return res.status(400).json({ error: 'agentId 不能为空' });
    }
    
    let messages = Array.from(agentMessages.values())
      .filter(m => m.to.includes('all') || m.to.includes(agentId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if (status === 'unread') {
      messages = messages.filter(m => !m.readAt);
    } else if (status === 'read') {
      messages = messages.filter(m => m.readAt);
    }
    
    messages = messages.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    console.error('获取消息失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 标记消息为已读
 * POST /api/agent/message/:id/read
 * Body: { agentId: string }
 */
router.post('/message/:id/read', (req, res) => {
  try {
    const { id } = req.params;
    const { agentId } = req.body;
    
    const message = agentMessages.get(id);
    if (!message) {
      return res.status(404).json({ error: '消息不存在' });
    }
    
    message.readAt = new Date().toISOString();
    
    // 减少未读计数
    const status = agentStatus.get(agentId);
    if (status && status.unreadCount > 0) {
      status.unreadCount--;
      agentStatus.set(agentId, status);
    }
    
    res.json({
      success: true,
      message: '已标记为已读',
      data: message
    });
  } catch (error) {
    console.error('标记已读失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 回复消息
 * POST /api/agent/message/:id/reply
 * Body: { from: string, content: string }
 */
router.post('/message/:id/reply', (req, res) => {
  try {
    const { id } = req.params;
    const { from, content } = req.body;
    
    const originalMessage = agentMessages.get(id);
    if (!originalMessage) {
      return res.status(404).json({ error: '消息不存在' });
    }
    
    const replyId = uuidv4();
    const reply = {
      id: replyId,
      from,
      to: [originalMessage.from],
      content,
      type: 'direct',
      replyTo: id,
      status: 'sent',
      createdAt: new Date().toISOString()
    };
    
    agentMessages.set(replyId, reply);
    originalMessage.repliedAt = new Date().toISOString();
    
    console.log(`[Agent 回复] ${from} 回复消息 ${id}: ${content.substring(0, 50)}...`);
    
    res.status(201).json({
      success: true,
      replyId,
      message: '回复已发送',
      data: reply
    });
  } catch (error) {
    console.error('回复消息失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取所有 Agent 状态
 * GET /api/agent/status
 */
router.get('/status', (req, res) => {
  try {
    const statusList = Array.from(agentStatus.values());
    
    res.json({
      success: true,
      count: statusList.length,
      data: statusList
    });
  } catch (error) {
    console.error('获取状态失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取单个 Agent 状态
 * GET /api/agent/status/:id
 */
router.get('/status/:id', (req, res) => {
  try {
    const { id } = req.params;
    const status = agentStatus.get(id);
    
    if (!status) {
      return res.status(404).json({ error: 'Agent 不存在' });
    }
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('获取状态失败:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
module.exports.agentMessages = agentMessages;
module.exports.agentStatus = agentStatus;
