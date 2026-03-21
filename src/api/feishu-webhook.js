/**
 * 飞书 Webhook（v3.2 parent_id 精确匹配 + 幂等性）
 * 解析"收到"回复，自动确认任务
 */

const express = require('express');
const router = express.Router();
const occSync = require('./occ-sync');

/**
 * POST /api/feishu/webhook - 飞书消息接收
 */
router.post('/webhook', async (req, res) => {
  try {
    const event = req.body.event;
    
    // 处理 URL 验证（飞书开放平台）
    if (req.body.type === 'url_verification') {
      return res.json({ challenge: req.body.challenge });
    }
    
    const message = event.message;
    const parentId = message.parent_id;
    
    console.log(`[飞书 Webhook] 收到消息：parent_id=${parentId}`);
    
    // 1. 检查是否是回复消息 ✅ v3.2 精确匹配
    if (!parentId) {
      console.log('[飞书 Webhook] 不是回复消息，忽略');
      return res.json({ success: true, message: '非回复消息' });
    }
    
    // 2. 根据 parent_id 查找任务 ✅ v3.2 精确实现
    const task = await findTaskByMessageId(parentId);
    if (!task) {
      console.log('[飞书 Webhook] 未找到关联任务');
      return res.json({ success: false, error: '未找到任务' });
    }
    
    // 3. 解析消息内容
    const content = JSON.parse(message.content);
    const text = content.text || '';
    
    // 4. 检查确认关键词
    const confirmKeywords = ['收到', '确认', '好的', 'ok', '好'];
    const isConfirm = confirmKeywords.some(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (!isConfirm) {
      return res.json({ success: true, message: '非确认消息' });
    }
    
    // 5. 幂等性检查 ✅ v3.2 新增
    if (task.status === 'confirmed') {
      await sendFeishuReply(parentId, '⚠️ 任务已确认，请勿重复操作');
      return res.json({ success: false, message: '任务已确认' });
    }
    
    if (task.assignee !== event.sender.name) {
      await sendFeishuReply(parentId, '⚠️ 你不是该任务的负责人');
      return res.json({ success: false, message: '非负责人' });
    }
    
    // 6. 确认任务
    await occSync.confirmTask(task.id, event.sender.name);
    
    // 7. 回复确认结果
    await sendFeishuReply(parentId, `✅ 已确认任务：${task.title}`);
    
    // 8. 通知上一节点（动态计算）
    const previousHandler = getPreviousHandler(task);
    await sendFeishuCard(previousHandler, {
      header: { 
        template: "green",
        title: { content: "✅ 任务已确认" } 
      },
      elements: [{
        tag: "div",
        text: { 
          content: `${event.sender.name} 已确认接收任务：${task.title}`,
          tag: "lark_md" 
        }
      }]
    });
    
    console.log(`[飞书 Webhook] 任务确认成功：${task.id}, 确认人：${event.sender.name}`);
    
    res.json({ success: true, taskId: task.id });
    
  } catch (error) {
    console.error('[飞书 Webhook] 处理失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 根据 parent_id 查找任务
 */
async function findTaskByMessageId(parentId) {
  // 从数据库或缓存中查找
  // 这里简化实现，实际需要从任务表中查找
  const tasks = require('./bce-tasks').tasks;
  
  for (const [id, task] of tasks.entries()) {
    if (task.notificationMessageId === parentId) {
      return task;
    }
  }
  
  return null;
}

/**
 * 获取上一节点（动态计算）
 */
function getPreviousHandler(task) {
  if (task.transferHistory && task.transferHistory.length > 0) {
    const last = task.transferHistory[task.transferHistory.length - 1];
    return last.from;
  }
  return task.creator;
}

/**
 * 回复飞书消息
 */
async function sendFeishuReply(parentId, text) {
  // 实际实现需要调用飞书 API
  console.log(`[飞书回复] ${parentId}: ${text}`);
}

/**
 * 发送飞书卡片
 */
async function sendFeishuCard(receiveId, card) {
  // 实际实现需要调用飞书 API
  console.log(`[飞书卡片] 发送给 ${receiveId}:`, card.header.title.content);
}

module.exports = router;
