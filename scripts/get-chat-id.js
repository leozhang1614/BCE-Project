#!/usr/bin/env node
/**
 * 获取飞书群的 open_chat_id
 */

const https = require('https');

const FEISHU_APP_ID = 'cli_a9242655a1ba1cb1';
const FEISHU_APP_SECRET = 'EtioKZkhqwEWYOwiYaOvJfeNIUQMQnSU';
const CHAT_ID = 'oc_19be54b67684b6597ff335d7534896d4';

async function getTenantAccessToken() {
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
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const req = https.request(options, (res) => {
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

async function getChatInfo(chatId) {
  const token = await getTenantAccessToken();
  
  return new Promise((resolve, reject) => {
    // 使用旧版 API 获取群信息
    const options = {
      hostname: 'open.feishu.cn',
      port: 443,
      path: `/open-apis/chat/info?chat_id=${chatId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        console.log('飞书 API 响应:', responseData);
        try {
          const result = JSON.parse(responseData);
          if (result.code === 0) {
            resolve(result.data);
          } else {
            reject(new Error(`获取失败：${result.msg}`));
          }
        } catch (e) {
          reject(new Error('解析响应失败'));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  try {
    console.log('正在获取群信息...');
    const chatInfo = await getChatInfo(CHAT_ID);
    console.log('\n✅ 群信息获取成功！');
    console.log('完整响应:', JSON.stringify(chatInfo, null, 2));
    console.log('\n群名称:', chatInfo.name);
    console.log('群类型:', chatInfo.chat_type);
    console.log('机器人数量:', chatInfo.bot_count);
    console.log('\n请将以下信息配置到 BCE 系统中：');
    console.log('FEISHU_CHAT_ID=', CHAT_ID);
  } catch (error) {
    console.error('❌ 获取失败:', error.message);
  }
}

main();
