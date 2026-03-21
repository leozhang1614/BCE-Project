/**
 * 验证飞书通知是否真的发送成功
 * 直接调用 feishu-notify API 发送测试通知
 */

const http = require('http');

function post(path, data) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`解析失败：${body}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

async function test() {
  console.log('=== 验证飞书通知发送 ===\n');
  
  try {
    // 测试 1: 直接调用 feishu-notify API
    console.log('测试 1: 直接调用 /api/feishu-notify/notify/task');
    const res1 = await post('/api/feishu-notify/notify/task', {
      chatId: 'oc_19be54b67684b6597ff335d7534896d4',
      taskId: 'test-001',
      taskTitle: '飞书通知验证测试',
      action: 'created',
      operator: '系统',
      assignee: '磐石',
      comment: '这是一条测试通知，请确认收到'
    });
    console.log('✅ 结果:', res1);
    console.log('   请检查飞书群是否收到消息\n');
    
    await new Promise(r => setTimeout(r, 3000));
    
    // 测试 2: 使用不同的 action
    console.log('测试 2: 发送 assigned 通知');
    const res2 = await post('/api/feishu-notify/notify/task', {
      chatId: 'oc_19be54b67684b6597ff335d7534896d4',
      taskId: 'test-002',
      taskTitle: '任务分配测试',
      action: 'assigned',
      operator: '天枢',
      assignee: '匠心',
      comment: '任务已分配，请确认接收'
    });
    console.log('✅ 结果:', res2);
    console.log('   请检查飞书群是否收到消息\n');
    
    console.log('如果以上消息都发送成功但群里没收到，说明：');
    console.log('1. 飞书 API 调用成功，但消息被限流/屏蔽');
    console.log('2. 机器人被移出群聊');
    console.log('3. 机器人权限被收回');
    console.log('4. 消息发送到错误的群聊');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

test();
