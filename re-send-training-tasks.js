const http = require('http');

const trainingTasks = [
  { id: 'f4c3be74-c6ef-47b5-b007-7a466e5c4f99', assignee: '天枢', title: '📚 BCE v3.2 系统培训 - 天枢' },
  { id: '9bb77b9b-7ac1-4efb-bd2c-5fb184a3c2b4', assignee: '天枢', title: '📚 BCE v3.2 系统培训 - 天枢' },
  { id: '639c7ea2-009d-43a2-8187-2d7265ec83f4', assignee: '匠心', title: '📚 BCE v3.2 系统培训 - 匠心' },
  { id: 'fba2cef8-3fba-4cc1-9825-b827f2379676', assignee: '司库', title: '📚 BCE v3.2 系统培训 - 司库' },
  { id: '72d8685e-106f-46ba-a5ef-af79812b02b4', assignee: '执矩', title: '📚 BCE v3.2 系统培训 - 执矩' },
  { id: '81a7eacf-d902-429e-b0aa-b12fe7b30844', assignee: '磐石', title: '📚 BCE v3.2 系统培训 - 磐石' },
  { id: '36e65a53-a0af-465b-a588-df47d0c90539', assignee: '灵犀', title: '📚 BCE v3.2 系统培训 - 灵犀' },
  { id: '908b5041-98b4-410b-8d18-4a8332970f71', assignee: '天策', title: '📚 BCE v3.2 系统培训 - 天策' }
];

console.log('=== 重新发送培训任务通知 ===\n');

for (const task of trainingTasks) {
  const data = JSON.stringify({
    taskId: task.id,
    taskTitle: task.title,
    action: 'assigned',
    operator: '匠心',
    assignee: task.assignee,
    comment: '🔔 请立即确认收到任务！这是 BCE v3.2 系统培训任务'
  });
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/feishu-notify/notify/task',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };
  
  const req = http.request(options, (res) => {
    let responseData = '';
    res.on('data', chunk => responseData += chunk);
    res.on('end', () => {
      try {
        const result = JSON.parse(responseData);
        console.log(`✅ ${task.assignee}: ${result.success ? '发送成功' : '发送失败 - ' + result.error}`);
      } catch (e) {
        console.log(`❌ ${task.assignee}: 解析响应失败`);
      }
    });
  });
  
  req.on('error', (e) => {
    console.log(`❌ ${task.assignee}: ${e.message}`);
  });
  
  req.write(data);
  req.end();
  
  // 延迟发送，避免速率限制
  setTimeout(() => {}, 100);
}

// 等待所有请求完成
setTimeout(() => {
  console.log('\n=== 所有通知发送完成 ===');
}, 2000);
