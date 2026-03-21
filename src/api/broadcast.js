const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// 内存存储（生产环境使用数据库）
const broadcasts = new Map();
const agentUnread = new Map(); // 记录每个接收者的未读消息

/**
 * 发送广播消息
 * POST /api/broadcast
 * Body: { 
 *   title: string, 
 *   content: string, 
 *   sender: string,
 *   recipients: string[], // 接收者列表，空表示全员
 *   priority: string, // P0, P1, P2
 *   requireConfirm: boolean // 是否需要确认
 * }
 */
router.post('/', (req, res) => {
  try {
    const { title, content, sender, recipients: inputRecipients = [], priority = 'P2', requireConfirm = false } = req.body;
    
    if (!title || !content || !sender) {
      return res.status(400).json({ 
        error: '缺少必要参数：title, content, sender' 
      });
    }
    
    const broadcastId = uuidv4();
    const createdAt = new Date();
    
    const broadcast = {
      id: broadcastId,
      title,
      content,
      sender,
      recipients: inputRecipients.length > 0 ? inputRecipients : ['all'], // 空表示全员
      priority,
      requireConfirm,
      status: 'sent', // sent, partial_confirmed, all_confirmed
      createdAt: createdAt.toISOString(),
      confirmations: [], // 已确认列表
      reads: [] // 已读列表
    };
    
    broadcasts.set(broadcastId, broadcast);
    
    // 更新接收者的未读消息
    const targetRecipients = inputRecipients.length > 0 ? inputRecipients : getAllAgents();
    targetRecipients.forEach(agent => {
      const agentBroadcasts = agentUnread.get(agent) || [];
      agentBroadcasts.push(broadcastId);
      agentUnread.set(agent, agentBroadcasts);
    });
    
    console.log(`[广播] 发送广播：${broadcastId}, 标题：${title}, 接收者：${targetRecipients.length}人`);
    
    res.status(201).json({
      success: true,
      broadcastId,
      message: '广播消息已发送',
      data: broadcast
    });
  } catch (error) {
    console.error('发送广播失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取广播列表
 * GET /api/broadcast?limit=10&priority=P0
 */
router.get('/', (req, res) => {
  try {
    const { limit = 20, priority } = req.query;
    
    let results = Array.from(broadcasts.values());
    
    if (priority) {
      results = results.filter(b => b.priority === priority);
    }
    
    // 按创建时间倒序
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // 限制数量
    results = results.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      count: results.length,
      data: results.map(b => ({
        id: b.id,
        title: b.title,
        sender: b.sender,
        priority: b.priority,
        status: b.status,
        createdAt: b.createdAt,
        confirmationCount: b.confirmations.length,
        readCount: b.reads.length
      }))
    });
  } catch (error) {
    console.error('获取广播列表失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取广播详情
 * GET /api/broadcast/:id
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const broadcast = broadcasts.get(id);
    if (!broadcast) {
      return res.status(404).json({ error: '广播消息不存在' });
    }
    
    res.json({
      success: true,
      data: broadcast
    });
  } catch (error) {
    console.error('获取广播详情失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 确认收到广播
 * POST /api/broadcast/:id/confirm
 * Body: { agentId: string, comment?: string }
 */
router.post('/:id/confirm', (req, res) => {
  try {
    const { id } = req.params;
    const { agentId, comment } = req.body;
    
    if (!agentId) {
      return res.status(400).json({ error: 'agentId 不能为空' });
    }
    
    const broadcast = broadcasts.get(id);
    if (!broadcast) {
      return res.status(404).json({ error: '广播消息不存在' });
    }
    
    // 检查是否已确认
    const existing = broadcast.confirmations.find(c => c.agentId === agentId);
    if (existing) {
      return res.status(400).json({ error: '已确认过此消息' });
    }
    
    const confirmation = {
      agentId,
      confirmedAt: new Date().toISOString(),
      comment: comment || null
    };
    
    broadcast.confirmations.push(confirmation);
    
    // 更新状态
    if (broadcast.confirmations.length === broadcast.recipients.length) {
      broadcast.status = 'all_confirmed';
    } else if (broadcast.confirmations.length > 0) {
      broadcast.status = 'partial_confirmed';
    }
    
    console.log(`[广播] 确认消息：${id}, 确认人：${agentId}`);
    
    res.json({
      success: true,
      message: '确认成功',
      data: broadcast
    });
  } catch (error) {
    console.error('确认广播失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 标记为已读
 * POST /api/broadcast/:id/read
 * Body: { agentId: string }
 */
router.post('/:id/read', (req, res) => {
  try {
    const { id } = req.params;
    const { agentId } = req.body;
    
    if (!agentId) {
      return res.status(400).json({ error: 'agentId 不能为空' });
    }
    
    const broadcast = broadcasts.get(id);
    if (!broadcast) {
      return res.status(404).json({ error: '广播消息不存在' });
    }
    
    // 检查是否已读
    const existing = broadcast.reads.find(r => r.agentId === agentId);
    if (existing) {
      return res.status(400).json({ error: '已读过此消息' });
    }
    
    broadcast.reads.push({
      agentId,
      readAt: new Date().toISOString()
    });
    
    console.log(`[广播] 标记已读：${id}, 读取人：${agentId}`);
    
    res.json({
      success: true,
      message: '已标记为已读'
    });
  } catch (error) {
    console.error('标记已读失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取我的未读广播
 * GET /api/broadcast/my/unread?agentId=xxx
 */
router.get('/my/unread', (req, res) => {
  try {
    const { agentId } = req.query;
    
    if (!agentId) {
      return res.status(400).json({ error: 'agentId 不能为空' });
    }
    
    const myBroadcasts = Array.from(broadcasts.values()).filter(b => {
      // 全员广播 或 指定接收者包含我
      const isTarget = b.recipients.includes('all') || b.recipients.includes(agentId);
      // 我还没读
      const notRead = !b.reads.find(r => r.agentId === agentId);
      return isTarget && notRead;
    });
    
    res.json({
      success: true,
      count: myBroadcasts.length,
      data: myBroadcasts
    });
  } catch (error) {
    console.error('获取未读广播失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取我的已读广播
 * GET /api/broadcast/my/read?agentId=xxx&limit=10
 */
router.get('/my/read', (req, res) => {
  try {
    const { agentId, limit = 10 } = req.query;
    
    if (!agentId) {
      return res.status(400).json({ error: 'agentId 不能为空' });
    }
    
    const myBroadcasts = Array.from(broadcasts.values()).filter(b => {
      const isTarget = b.recipients.includes('all') || b.recipients.includes(agentId);
      const isRead = b.reads.find(r => r.agentId === agentId);
      return isTarget && isRead;
    });
    
    myBroadcasts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      success: true,
      count: myBroadcasts.length,
      data: myBroadcasts.slice(0, parseInt(limit))
    });
  } catch (error) {
    console.error('获取已读广播失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 辅助函数：获取所有 Agent
function getAllAgents() {
  // 实际应从数据库或配置获取
  return ['匠心', '司库', '执矩', '磐石', '天枢', '灵犀'];
}

// 导出供外部访问
module.exports = router;
module.exports.broadcasts = broadcasts;
module.exports.getAllAgents = getAllAgents;
