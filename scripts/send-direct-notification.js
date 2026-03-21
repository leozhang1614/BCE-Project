#!/usr/bin/env node
/**
 * 直接发送飞书通知（绕过 BCE 系统问题代码）
 * 用法：node send-direct-notification.js 执矩
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

const memberName = process.argv[2] || '执矩';
const userId = USER_ID_MAP[memberName];

console.log(`========================================`);
console.log(`   直接发送飞书通知 - ${memberName}`);
console.log(`========================================\n`);

if (!userId) {
  console.log(`❌ 错误：${memberName} 的 user_id 未配置`);
  process.exit(1);
}

console.log(`User ID: ${userId}\n`);

// 获取 token
const tokenData = JSON.stringify({
  app_id: 'cli_a9242655a1ba1cb1',
  app_secret: 'EtioKZkhqwEWYOwiYaOvJfeNIUQMQnSU'
});

const tokenReq = https.request({
  hostname: 'open.feishu.cn',
  port: 443,
  path: '/open-apis/auth/v3/tenant_access_token/internal',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(tokenData) }
}, (tokenRes) => {
  let tokenData = '';
  tokenRes.on('data', chunk => tokenData += chunk);
  tokenRes.on('end', () => {
    const tokenResult = JSON.parse(tokenData);
    
    if (tokenResult.code !== 0) {
      console.log(`❌ Token 获取失败：${tokenResult.msg}`);
      process.exit(1);
    }
    
    const token = tokenResult.tenant_access_token;
    console.log(`✅ Token 获取成功\n`);
    
    // 发送消息
    const messageData = JSON.stringify({
      receive_id: 'oc_19be54b67684b6597ff335d7534896d4',
      msg_type: 'text',
      content: JSON.stringify({
        text: `📋 任务分配通知\n任务：直接发送测试 - ${memberName}\n负责人：${memberName}\n操作人：天枢\n备注：请直接确认收到任务`,
        at: {
          user_id: [userId],
          all: false
        }
      })
    });
    
    const msgReq = https.request({
      hostname: 'open.feishu.cn',
      port: 443,
      path: '/open-apis/im/v1/messages?receive_id_type=chat_id',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(messageData),
        'Authorization': `Bearer ${token}`
      }
    }, (msgRes) => {
      let msgData = '';
      msgRes.on('data', chunk => msgData += chunk);
      msgRes.on('end', () => {
        const msgResult = JSON.parse(msgData);
        
        if (msgResult.code === 0) {
          console.log(`✅ 消息发送成功！`);
          console.log(`消息 ID: ${msgResult.data.message_id}`);
          console.log(`\n请在飞书群查看是否@${memberName}`);
        } else {
          console.log(`❌ 发送失败：${msgResult.msg} (code: ${msgResult.code})`);
        }
      });
    });
    
    msgReq.on('error', (e) => {
      console.log(`❌ 请求错误：${e.message}`);
      process.exit(1);
    });
    
    msgReq.write(messageData);
    msgReq.end();
  });
});

tokenReq.on('error', (e) => {
  console.log(`❌ Token 请求错误：${e.message}`);
  process.exit(1);
});

tokenReq.write(tokenData);
tokenReq.end();
