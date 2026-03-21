#!/usr/bin/env node
/**
 * 飞书@通知完整测试脚本
 * 独立于 BCE 系统，直接测试飞书 API
 */

const https = require('https');

const FEISHU_CONFIG = {
  appId: 'cli_a9242655a1ba1cb1',
  appSecret: 'EtioKZkhqwEWYOwiYaOvJfeNIUQMQnSU',
  chatId: 'oc_19be54b67684b6597ff335d7534896d4'
};

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

async function getTenantAccessToken() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      app_id: FEISHU_CONFIG.appId,
      app_secret: FEISHU_CONFIG.appSecret
    });
    
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
        try {
          const result = JSON.parse(responseData);
          if (result.code === 0) {
            resolve(result.tenant_access_token);
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

async function sendTestMessage(memberName) {
  const token = await getTenantAccessToken();
  const userId = USER_ID_MAP[memberName];
  
  console.log(`\n=== 测试成员：${memberName} ===`);
  console.log(`User ID: ${userId}`);
  
  const messageData = JSON.stringify({
    receive_id: FEISHU_CONFIG.chatId,
    msg_type: 'text',
    content: JSON.stringify({
      text: `🔔 飞书@通知测试 - ${memberName}\n请确认收到任务`,
      at: {
        user_id: [userId],
        all: false
      }
    })
  });
  
  return new Promise((resolve, reject) => {
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
        try {
          const result = JSON.parse(responseData);
          if (result.code === 0) {
            console.log(`✅ 发送成功！消息 ID: ${result.data.message_id}`);
            console.log(`✅ 请在飞书群查看是否@${memberName}`);
            resolve(result.data);
          } else {
            console.log(`❌ 发送失败：${result.msg} (code: ${result.code})`);
            reject(new Error(result.msg));
          }
        } catch (e) {
          console.log(`❌ 解析响应失败：${e.message}`);
          reject(e);
        }
      });
    });
    
    req.on('error', (e) => {
      console.log(`❌ 请求错误：${e.message}`);
      reject(e);
    });
    
    req.write(messageData);
    req.end();
  });
}

async function main() {
  console.log('========================================');
  console.log('   飞书@通知完整测试脚本');
  console.log('========================================');
  
  // 测试问题成员：天策、灵犀、执矩
  const testMembers = ['天策', '灵犀', '执矩'];
  
  for (const member of testMembers) {
    try {
      await sendTestMessage(member);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 间隔 1 秒
    } catch (error) {
      console.log(`测试 ${member} 失败：${error.message}`);
    }
  }
  
  console.log('\n========================================');
  console.log('测试完成！请在飞书群查看结果');
  console.log('========================================\n');
}

main().catch(console.error);
