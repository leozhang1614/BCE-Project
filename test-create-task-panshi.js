/**
 * 测试任务创建时@磐石的通知
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
  console.log('=== 测试：创建任务并@磐石 ===\n');
  
  try {
    // 创建任务，负责人是磐石
    const res = await post('/api/bce/tasks', {
      title: '【测试】磐石任务通知测试',
      description: '测试任务创建时是否能正确@磐石',
      creator: '天枢',
      assignee: '磐石',
      priority: 'P1',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      requireConfirmation: true
    });
    
    console.log('✅ 任务创建成功:', res.taskId);
    console.log('   请磐石确认是否收到飞书@通知\n');
    console.log('任务详情：');
    console.log('  - 标题:', res.data.title);
    console.log('  - 负责人:', res.data.assignee);
    console.log('  - 状态:', res.data.status);
    console.log('  - 创建时间:', res.data.createdAt);
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

test();
