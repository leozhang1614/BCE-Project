#!/usr/bin/env node
/**
 * 测试所有成员的@功能
 */

const https = require('https');

const USER_ID_MAP = {
  '天枢': 'ou_38561a1b5b662a3e16f044750f8c481d',
  '匠心': 'ou_11b23f47253fc3551ffed488527c7740',
  '司库': 'ou_0f1f1d56a8c8b842c427b7e7ab798452',
  '执矩': 'ou_aaeb25dcae8616029a9d36906892bd05',
  '磐石': 'ou_dba586c77d92f652e427370d3f54cc54',
  '灵犀': 'ou_f9cb5a9a31ec4d739fd187153c4e5f6b',
  '天策': 'ou_3a2c50c8eb0338734362a741c934da8f',
  '磊哥': 'ou_03e8866cae58eb5ac1ef4cb07994c262'
};

const CHAT_ID = 'oc_19be54b67684b6597ff335d7534896d4';
const APP_ID = 'cli_a9242655a1ba1cb1';
const APP_SECRET = 'EtioKZkhqwEWYOwiYaOvJfeNIUQMQnSU';

async function getToken() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET });
    const req = https.request({
      hostname: 'open.feishu.cn',
      port: 443,
      path: '/open-apis/auth/v3/tenant_access_token/internal',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        const result = JSON.parse(responseData);
        result.code === 0 ? resolve(result.tenant_access_token) : reject(new Error(result.msg));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function testMember(name, userId) {
  const token = await getToken();
  
  return new Promise((resolve) => {
    const messageData = JSON.stringify({
      receive_id: CHAT_ID,
      msg_type: 'text',
      content: JSON.stringify({
        text: `🔔 @测试 - ${name}\n请确认收到`,
        at: { user_id: [userId], all: false }
      })
    });
    
    const req = https.request({
      hostname: 'open.feishu.cn',
      port: 443,
      path: '/open-apis/im/v1/messages?receive_id_type=chat_id',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(messageData),
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        const result = JSON.parse(responseData);
        const success = result.code === 0;
        const msgId = result.data?.message_id || '';
        console.log(`${name}: ${success ? '✅ 成功' : '❌ 失败'} ${msgId ? '(' + msgId + ')' : ''} - ${result.msg || ''}`);
        resolve({ name, userId, success, msgId });
      });
    });
    
    req.on('error', (e) => {
      console.log(`${name}: ❌ 错误 ${e.message}`);
      resolve({ name, userId, success: false, error: e.message });
    });
    
    req.write(messageData);
    req.end();
  });
}

async function main() {
  console.log('========================================');
  console.log('   测试所有成员的@功能');
  console.log('========================================\n');
  
  const members = Object.entries(USER_ID_MAP);
  const results = [];
  
  for (const [name, userId] of members) {
    const result = await testMember(name, userId);
    results.push(result);
    await new Promise(r => setTimeout(r, 500)); // 间隔 500ms
  }
  
  console.log('\n========================================');
  console.log('测试结果汇总:');
  results.forEach(r => {
    console.log(`  ${r.name}: ${r.success ? '✅' : '❌'} - ${r.userId}`);
  });
  console.log('========================================');
  console.log('\n请在飞书群查看哪些成员的@是蓝色可点击的！');
}

main().catch(console.error);
