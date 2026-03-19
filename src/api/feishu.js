const express = require('express');
const router = express.Router();
const crypto = require('crypto');

/**
 * 飞书 Webhook 接收
 * POST /api/feishu/webhook
 * 
 * 飞书事件推送格式：
 * {
 *   "challenge": "string",  // 验证挑战码
 *   "token": "string",      // 验证令牌
 *   "type": "url_verification",
 *   ...
 * }
 * 
 * 消息格式：
 * {
 *   "header": { ... },
 *   "event": {
 *     "message": {
 *       "message_id": "xxx",
 *       "content": "{\"text\":\"消息内容\"}",
 *       "chat_id": "xxx",
 *       "sender_id": { "user_id": "xxx" }
 *     }
 *   }
 * }
 */
router.post('/webhook', (req, res) => {
  try {
    const { challenge, token, type, header, event } = req.body;
    
    // 1. URL 验证（初次配置时）
    if (type === 'url_verification') {
      console.log('[飞书] URL 验证请求:', { challenge, token });
      return res.json({ challenge });
    }
    
    // 2. 消息事件处理
    if (header && header.event_type === 'im.message.receive_v1') {
      const message = event.message;
      const senderId = message.sender_id?.user_id || 'unknown';
      const chatId = message.chat_id;
      const content = JSON.parse(message.content || '{}');
      const text = content.text || '';
      
      console.log(`[飞书] 收到群聊消息：${message.message_id}, 发送者：${senderId}, 内容：${text}`);
      
      // 3. 转发到 BCE 广播系统
      handleFeishuMessage({
        messageId: message.message_id,
        chatId,
        senderId,
        text,
        rawEvent: event
      });
      
      // 4. 返回成功响应
      return res.json({ success: true });
    }
    
    // 其他事件类型
    console.log('[飞书] 未知事件类型:', type || header?.event_type);
    res.json({ success: true });
    
  } catch (error) {
    console.error('[飞书] Webhook 处理失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 处理飞书消息
 */
async function handleFeishuMessage(data) {
  const { messageId, chatId, senderId, text } = data;
  
  // 1. 识别@提及
  const mentions = extractMentions(text);
  
  // 2. 判断是否需要广播
  const isBroadcast = mentions.includes('all') || mentions.includes('_all');
  
  // 3. 判断是否需要确认
  const requireConfirm = isBroadcast || text.includes('请确认') || text.includes('收到请回复');
  
  console.log(`[飞书] 消息分析：${messageId}, 提及：${mentions.join(',')}, 广播：${isBroadcast}, 确认：${requireConfirm}`);
  
  // 4. 创建 BCE 广播（如果需要）
  if (isBroadcast || requireConfirm) {
    await createBroadcast({
      title: `飞书群聊消息 [${chatId}]`,
      content: text,
      sender: `飞书用户:${senderId}`,
      priority: requireConfirm ? 'P0' : 'P2',
      requireConfirm,
      metadata: {
        source: 'feishu',
        messageId,
        chatId,
        senderId,
        mentions
      }
    });
  }
  
  // 5. 记录到记忆系统
  await recordToMemory({
    content: `飞书群聊：${text}`,
    metadata: {
      source: 'feishu',
      messageId,
      chatId,
      senderId,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * 提取@提及
 */
function extractMentions(text) {
  const mentions = [];
  const atPattern = /@(all|_all|\w+)/g;
  let match;
  
  while ((match = atPattern.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  
  return mentions;
}

/**
 * 创建 BCE 广播
 */
async function createBroadcast(data) {
  try {
    // 调用内部广播 API
    const broadcastData = {
      ...data,
      recipients: ['天枢', '匠心', '司库', '执矩', '磐石', '灵犀']
    };
    
    console.log('[飞书] 创建广播:', broadcastData);
    // 实际应调用 /api/broadcast
    // 此处简化处理
  } catch (error) {
    console.error('[飞书] 创建广播失败:', error);
  }
}

/**
 * 记录到记忆系统
 */
async function recordToMemory(data) {
  try {
    console.log('[飞书] 记录记忆:', data);
    // 实际应调用 /api/memory
  } catch (error) {
    console.error('[飞书] 记录记忆失败:', error);
  }
}

/**
 * 发送消息到飞书
 * POST /api/feishu/send
 * Body: { chatId: string, content: string, messageType: 'text' | 'post' | 'interactive' }
 */
router.post('/send', async (req, res) => {
  try {
    const { chatId, content, messageType = 'text' } = req.body;
    
    if (!chatId || !content) {
      return res.status(400).json({ error: 'chatId 和 content 不能为空' });
    }
    
    console.log(`[飞书] 发送消息到 ${chatId}: ${content}`);
    
    // 调用飞书 API 发送消息
    // 需要配置飞书 AppID 和 AppSecret
    
    res.json({
      success: true,
      messageId: 'feishu_msg_' + Date.now()
    });
    
  } catch (error) {
    console.error('[飞书] 发送消息失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 发送确认请求到飞书
 * POST /api/feishu/confirm
 * Body: { chatId: string, userId: string, message: string }
 */
router.post('/confirm', async (req, res) => {
  try {
    const { chatId, userId, message } = req.body;
    
    if (!chatId || !userId || !message) {
      return res.status(400).json({ error: 'chatId, userId, message 不能为空' });
    }
    
    console.log(`[飞书] 发送确认请求到 ${chatId}, 用户：${userId}`);
    
    res.json({
      success: true,
      confirmationId: 'feishu_conf_' + Date.now()
    });
    
  } catch (error) {
    console.error('[飞书] 发送确认请求失败:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
