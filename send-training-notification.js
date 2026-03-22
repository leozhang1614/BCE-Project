const https = require('https');

const trainingTasks = [
  { assignee: '天枢', title: '📚 BCE v3.2 系统培训 - 天枢' },
  { assignee: '匠心', title: '📚 BCE v3.2 系统培训 - 匠心' },
  { assignee: '司库', title: '📚 BCE v3.2 系统培训 - 司库' },
  { assignee: '执矩', title: '📚 BCE v3.2 系统培训 - 执矩' },
  { assignee: '磐石', title: '📚 BCE v3.2 系统培训 - 磐石' },
  { assignee: '灵犀', title: '📚 BCE v3.2 系统培训 - 灵犀' },
  { assignee: '天策', title: '📚 BCE v3.2 系统培训 - 天策' }
];

const USER_ID_MAP = {
  '天枢': 'ou_82e24fd5850f184e395ecaa7d11a1ddc',
  '匠心': 'ou_11b23f47253fc3551ffed488527c7740',
  '司库': 'ou_998d07ddc86ad7ba9d4dd12dddc55cc6',
  '执矩': 'ou_aaeb25dcae8616029a9d36906892bd05',
  '磐石': 'ou_dba586c77d92f652e427370d3f54cc54',
  '灵犀': 'ou_afd48fe16ccb4d2ba8a56235eb29d784',
  '天策': 'ou_3a2c50c8eb0338734362a741c934da8f'
};

const CHAT_ID = 'oc_19be54b67684b6597ff335d7534896d4';
const APP_ID = 'cli_a9242655a1ba1cb1';
const APP_SECRET = 'EtioKZkhqwEWYOwiYaOvJfeNIUQMQnSU';

// 获取 Token
const tokenData = JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET });

const tokenReq = https.request({
  hostname: 'open.feishu.cn',
  port: 443,
  path: '/open-apis/auth/v3/tenant_access_token/internal',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const result = JSON.parse(data);
    const token = result.tenant_access_token;
    console.log('✅ Token 获取成功\n');
    
    // 发送所有培训任务通知
    trainingTasks.forEach((task, index) => {
      setTimeout(() => {
        const userId = USER_ID_MAP[task.assignee];
        const content = {
          text: `📚 BCE v3.2 系统培训任务\n\n负责人：${task.assignee}\n优先级：P0\n截止时间：2026-03-22 18:00\n\n🔔 请立即确认收到任务！\n\n任务详情：http://192.168.31.187:3000/bce-tasks.html`,
          at: userId ? { user_id: [userId], all: false } : undefined
        };
        
        const body = {
          receive_id: CHAT_ID,
          msg_type: 'text',
          content: JSON.stringify(content)
        };
        
        const msgReq = https.request({
          hostname: 'open.feishu.cn',
          port: 443,
          path: '/open-apis/im/v1/messages?receive_id_type=chat_id',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          }
        }, (res2) => {
          let data2 = '';
          res2.on('data', chunk => data2 += chunk);
          res2.on('end', () => {
            const result2 = JSON.parse(data2);
            if (result2.code === 0) {
              console.log(`✅ ${task.assignee}: 发送成功 - ${result2.data.message_id}`);
            } else {
              console.log(`❌ ${task.assignee}: 发送失败 - ${result2.msg}`);
            }
          });
        });
        
        msgReq.write(JSON.stringify(body));
        msgReq.end();
      }, index * 500); // 每 500ms 发送一个，避免速率限制
    });
  });
});

tokenReq.write(tokenData);
tokenReq.end();

// 等待所有发送完成
setTimeout(() => {
  console.log('\n=== 所有培训任务通知发送完成 ===');
}, 5000);
