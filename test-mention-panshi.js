/**
 * 测试直接@磐石的通知
 */

const https = require('https');

// 配置
const FEISHU_APP_ID = 'cli_a9242655a1ba1cb1';
const FEISHU_APP_SECRET = 'EtioKZkhqwEWYOwiYaOvJfeNIUQMQnSU';
const FEISHU_CHAT_ID = 'oc_19be54b67684b6597ff335d7534896d4';
const PANSHI_USER_ID = 'ou_dba586c77d92f652e427370d3f54cc54';

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
            console.log('✅ Token 获取成功，有效期:', new Date(tokenExpiresAt).toLocaleString());
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
 * 测试 1: 发送文本消息 + @用户（at 字段在 content 内）
 */
async function testTextWithMention() {
  console.log('\n=== 测试 1: 文本消息 + @磐石 ===');
  
  const token = await getTenantAccessToken();
  
  const content = {
    text: '🔔 测试通知：这是一条测试消息\n\n请@磐石确认收到',
    at: {
      user_id: [PANSHI_USER_ID],
      all: false
    }
  };
  
  console.log('发送内容:', JSON.stringify(content, null, 2));
  
  return new Promise((resolve, reject) => {
    const body = {
      receive_id: FEISHU_CHAT_ID,
      msg_type: 'text',
      content: JSON.stringify(content)
    };
    
    console.log('请求体:', JSON.stringify(body, null, 2));
    
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
            console.log('✅ 消息发送成功:', result.data.message_id);
            resolve(result.data);
          } else {
            console.error('❌ API 返回错误:', result);
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
 * 测试 2: 发送 POST 格式消息（富文本，支持@）
 */
async function testPostFormat() {
  console.log('\n=== 测试 2: POST 格式消息 + @磐石 ===');
  
  const token = await getTenantAccessToken();
  
  // POST 格式的内容结构
  const content = {
    zh_cn: {
      title: '🔔 测试通知',
      content: [
        [
          { tag: 'text', text: '这是一条 POST 格式测试消息\n\n' },
          { tag: 'at', user_id: PANSHI_USER_ID },
          { tag: 'text', text: ' 请确认收到' }
        ]
      ]
    }
  };
  
  console.log('发送内容:', JSON.stringify(content, null, 2));
  
  return new Promise((resolve, reject) => {
    const body = {
      receive_id: FEISHU_CHAT_ID,
      msg_type: 'post',
      content: JSON.stringify(content)
    };
    
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
            console.log('✅ POST 消息发送成功:', result.data.message_id);
            resolve(result.data);
          } else {
            console.error('❌ API 返回错误:', result);
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
 * 测试 3: 发送@所有人的消息
 */
async function testAtAll() {
  console.log('\n=== 测试 3: @所有人 ===');
  
  const token = await getTenantAccessToken();
  
  const content = {
    text: '🔔 测试@所有人',
    at: {
      all: true
    }
  };
  
  return new Promise((resolve, reject) => {
    const body = {
      receive_id: FEISHU_CHAT_ID,
      msg_type: 'text',
      content: JSON.stringify(content)
    };
    
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
            console.log('✅ @所有人消息发送成功:', result.data.message_id);
            resolve(result.data);
          } else {
            console.error('❌ API 返回错误:', result);
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
 * 主测试流程
 */
async function runTests() {
  console.log('=== 飞书@功能测试 - 磐石专项 ===');
  console.log('磐石 user_id:', PANSHI_USER_ID);
  console.log('群聊 ID:', FEISHU_CHAT_ID);
  
  try {
    // 测试 1: 文本消息 + @
    await testTextWithMention();
    console.log('等待 3 秒...\n');
    await new Promise(r => setTimeout(r, 3000));
    
    // 测试 2: POST 格式
    await testPostFormat();
    console.log('等待 3 秒...\n');
    await new Promise(r => setTimeout(r, 3000));
    
    // 测试 3: @所有人
    await testAtAll();
    
    console.log('\n=== 所有测试完成 ===');
    console.log('请磐石确认是否收到以上 3 条消息的@通知');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

runTests();
