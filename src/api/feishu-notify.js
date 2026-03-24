const express = require('express');
const router = express.Router();
const https = require('https');
const { getUserIdByName } = require('../config/feishu-users');

// 飞书配置（v3.2 修复：移除硬编码凭证）
const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const FEISHU_CHAT_ID = process.env.FEISHU_CHAT_ID;

// 启动时检查凭证
if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
  console.warn('[飞书配置] 警告：缺少 FEISHU_APP_ID 或 FEISHU_APP_SECRET，飞书通知功能将不可用');
}

// 缓存 token
let tenantAccessToken = null;
let tokenExpiresAt = 0;

/**
 * 获取 tenant_access_token
 */
async function getTenantAccessToken() {
  if (tenantAccessToken && Date.now() < tokenExpiresAt) {
    return tenantAccessToken;
  }
  
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET
    });
    
    const options = {
      hostname: 'open.feishu.cn',
      port: 443,
      path: '/open-apis/auth/v3/tenant_access_token/internal',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          if (result.code === 0) {
            tenantAccessToken = result.tenant_access_token;
            tokenExpiresAt = Date.now() + (result.expire - 100) * 1000;
            console.log('[飞书] Token 获取成功，有效期:', new Date(tokenExpiresAt).toLocaleString());
            resolve(tenantAccessToken);
          } else {
            reject(new Error(`获取 token 失败：${result.msg}`));
          }
        } catch (e) {
          reject(new Error('解析响应失败'));
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * 发送飞书消息（文本消息，支持@用户）
 * @param {string} chatId - 飞书群聊 ID
 * @param {string} text - 消息文本
 * @param {string[]} atUserIds - 要@的 user_id 数组
 */
async function sendFeishuMessage(chatId, text, atUserIds = []) {
  const token = await getTenantAccessToken();
  
  return new Promise((resolve, reject) => {
    // 构建消息内容
    const content = {
      text: text
    };
    
    // 添加@信息（at 放在 content 内部）
    if (atUserIds && atUserIds.length > 0) {
      content.at = {
        user_id: atUserIds,
        all: false
      };
      console.log('[飞书] 设置@用户:', atUserIds);
    } else {
      console.log('[飞书] 无@用户');
    }
    
    const body = {
      receive_id: chatId,
      msg_type: 'text',
      content: JSON.stringify(content)
    };
    
    console.log('[飞书] 发送消息:', { 
      chatId, 
      msg_type: 'text',
      atUserIds: atUserIds.length > 0 ? atUserIds : '无',
      content_preview: text.substring(0, 50)
    });
    
    const req = https.request({
      hostname: 'open.feishu.cn',
      port: 443,
      path: '/open-apis/im/v1/messages?receive_id_type=chat_id',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(body)),
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.code === 0) {
            console.log('[飞书] 消息发送成功:', result.data.message_id);
            resolve(result.data);
          } else {
            console.error('[飞书] API 返回错误:', result);
            reject(new Error(`${result.msg} (code: ${result.code})`));
          }
        } catch (e) {
          reject(new Error('解析响应失败'));
        }
      });
    });
    
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * 发送任务通知（修复@格式）
 */
async function sendTaskNotification(task, action, operator, comment) {
  const actionTexts = {
    created: '📋 任务已创建',
    assigned: '📋 任务已分配',
    executing: '🚀 任务执行中',
    reviewing: '✅ 待验收',
    accepted: '🎉 任务已完成',
    cancelled: '❌ 任务已取消',
    auditing: '🔍 待审核',      // v3.4 新增
    confirmed: '✅ 已确认接收'  // v3.4 新增
  };
  
  // 详细调试日志
  console.log(`[飞书] === 开始发送通知 ===`);
  console.log(`[飞书] task.assignee: "${task.assignee}" (类型：${typeof task.assignee})`);
  console.log(`[飞书] task.title: "${task.title}"`);
  console.log(`[飞书] action: "${action}"`);
  
  // 获取 user_id
  const userId = getUserIdByName(task.assignee);
  console.log(`[飞书] getUserIdByName("${task.assignee}") 返回：${userId || '未找到'}`);
  
  // 构建负责人文本（不添加@标签，由飞书 at 字段处理）
  const assigneeText = task.assignee || '未分配';
  
  // 构建计划完成时间文本
  const dueDateText = task.dueDate 
    ? new Date(task.dueDate).toLocaleString('zh-CN')
    : '未设置';
  
  // 构建确认要求文本
  const confirmText = task.requireConfirmation 
    ? '\n⚠️ 要求收到回复：请在 20 秒内确认收到任务！'
    : '';
  
  // v3.4 修复：根据任务状态正确显示确认状态
  let confirmedStatus = '❌ 待确认';
  if (task.confirmedBy) {
    confirmedStatus = `✅ 已确认 (${task.confirmedBy})`;
  } else if (task.status === 'completed' || task.status === 'accepted' || task.status === 'auditing') {
    confirmedStatus = '✅ 已确认 (系统自动)';
  } else if (task.status === 'executing' || task.status === 'reviewing') {
    confirmedStatus = '✅ 执行中';
  }
  
  // v3.4 修复：计划完成时间显示优化
  const dueDateDisplay = task.dueDate 
    ? new Date(task.dueDate).toLocaleString('zh-CN')
    : (task.status === 'completed' ? '已完成' : '未设置');
  
  // 构建通知文本
  let text = `${actionTexts[action] || '任务状态更新'}
任务：${task.title}
负责人：${assigneeText}
负责人是否已接收：${confirmedStatus}
操作人：${operator}
计划完成时间：${dueDateDisplay}
${comment ? '备注：' + comment : ''}${confirmText}
查看详情：http://192.168.31.187:3000/bce-tasks.html`;
  
  // v3.4 新增：审核环节特殊处理
  if (action === 'auditing') {
    text = `${actionTexts.auditing}
任务：${task.title}
审核人：${assigneeText}
审核状态：${task.confirmedBy ? '✅ 已确认 (' + task.confirmedBy + ')' : '❌ 待审核'}
提交人：${operator}
查看详情：http://192.168.31.187:3000/bce-tasks.html`;
  }
  
  // v3.4 新增：确认接收环节特殊处理
  if (action === 'confirmed') {
    text = `${actionTexts.confirmed}
任务：${task.title}
确认人：${operator}
原负责人：${assigneeText}
查看详情：http://192.168.31.187:3000/bce-tasks.html`;
  }
  
  // 收集要@的 user_id
  const atUserIds = userId ? [userId] : [];
  console.log(`[飞书] 准备@的 user_id: ${JSON.stringify(atUserIds)}`);
  
  return await sendFeishuMessage(FEISHU_CHAT_ID, text, atUserIds);
}

/**
 * Webhook 接收（事件订阅）
 */
router.post('/webhook', async (req, res) => {
  const { challenge, token, type, header, event } = req.body;
  
  if (type === 'url_verification') {
    console.log('[飞书] URL 验证');
    return res.json({ challenge });
  }
  
  if (header && header.event_type === 'im.message.receive_v1') {
    const message = event.message;
    console.log('[飞书] 收到消息:', message.message_id);
  }
  
  res.json({ success: true });
});

/**
 * 发送任务通知 API
 */
router.post('/notify/task', async (req, res) => {
  try {
    console.log(`[飞书 API] 收到通知请求：`, JSON.stringify(req.body, null, 2));
    const { taskId, taskTitle, action, operator, comment, assignee } = req.body;
    
    console.log(`[飞书 API] 解构后：assignee="${assignee}", taskId="${taskId}", action="${action}"`);
    
    if (!taskId || !action || !operator) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const task = { id: taskId, title: taskTitle, assignee };
    console.log(`[飞书 API] 创建 task 对象：`, JSON.stringify(task));
    await sendTaskNotification(task, action, operator, comment);
    
    res.json({ success: true, message: '通知已发送', notificationId: 'feishu_' + Date.now() });
  } catch (error) {
    console.error('[飞书] 发送通知失败:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 测试 API
 */
router.get('/test', async (req, res) => {
  try {
    await sendFeishuMessage(FEISHU_CHAT_ID, '🎉 BCE 飞书通知测试成功！');
    res.json({ success: true, message: '测试消息已发送' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 调试 API - 测试 getUserIdByName
 */
router.get('/debug/user-id', (req, res) => {
  const testNames = ['执矩', '灵犀', '天策', '天枢', '匠心'];
  const results = {};
  testNames.forEach(name => {
    results[name] = getUserIdByName(name);
  });
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    results
  });
});

/**
 * 调试 API - 直接发送测试通知
 */
router.post('/debug/send', async (req, res) => {
  try {
    const { memberName } = req.body;
    if (!memberName) {
      return res.status(400).json({ error: '缺少 memberName 参数' });
    }
    
    const userId = getUserIdByName(memberName);
    console.log(`[调试] ${memberName} → user_id: ${userId}`);
    
    const text = `🔔 调试测试 - ${memberName}\n请确认收到`;
    const atUserIds = userId ? [userId] : [];
    
    await sendFeishuMessage(FEISHU_CHAT_ID, text, atUserIds);
    
    res.json({
      success: true,
      memberName,
      userId,
      atUserIds
    });
  } catch (error) {
    console.error('[调试] 发送失败:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
module.exports.sendFeishuMessage = sendFeishuMessage;
module.exports.sendTaskNotification = sendTaskNotification;
