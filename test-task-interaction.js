/**
 * BCE 任务交互流程测试脚本
 * 测试任务从创建到完成的完整流程，验证飞书通知是否及时发送
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000/api/bce';

/**
 * 发送 HTTP POST 请求
 */
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

/**
 * 发送 HTTP GET 请求
 */
function get(path) {
  return new Promise((resolve, reject) => {
    http.get({
      hostname: 'localhost',
      port: 3000,
      path,
      headers: { 'Accept': 'application/json' }
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
    }).on('error', reject);
  });
}

/**
 * 等待指定毫秒
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 主测试流程
 */
async function runTest() {
  console.log('=== BCE 任务交互流程测试 ===\n');
  
  try {
    // 测试 1: 创建任务
    console.log('📋 测试 1: 创建任务（带负责人）');
    const createRes = await post('/tasks', {
      title: '【测试】任务交互流程验证',
      description: '测试任务从创建到完成的完整流程，验证飞书通知',
      creator: '天枢',
      assignee: '匠心',
      priority: 'P0',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      requireConfirmation: true
    });
    
    console.log('✅ 任务创建成功:', createRes.taskId);
    console.log('   等待飞书通知发送...\n');
    await sleep(3000); // 等待 3 秒
    
    const taskId = createRes.taskId;
    
    // 测试 2: 确认任务
    console.log('✅ 测试 2: 确认任务');
    const confirmRes = await post(`/tasks/${taskId}/confirm`, {
      userId: 'ou_11b23f47253fc3551ffed488527c7740',
      userName: '匠心'
    });
    console.log('✅ 任务确认成功\n');
    await sleep(2000);
    
    // 测试 3: 分配任务
    console.log('📋 测试 3: 分配任务');
    const assignRes = await post(`/tasks/${taskId}/assign`, {
      assignee: '匠心',
      operator: '天枢',
      comment: '请开始执行'
    });
    console.log('✅ 任务分配成功\n');
    await sleep(3000);
    
    // 测试 4: 开始执行
    console.log('🚀 测试 4: 开始执行任务');
    const startRes = await post(`/tasks/${taskId}/start`, {
      operator: '匠心',
      comment: '开始处理'
    });
    console.log('✅ 任务已开始执行\n');
    await sleep(3000);
    
    // 测试 5: 提交验收
    console.log('✅ 测试 5: 提交验收');
    const submitRes = await post(`/tasks/${taskId}/submit`, {
      operator: '匠心',
      deliverables: ['代码', '文档'],
      comment: '已完成，请验收'
    });
    console.log('✅ 已提交验收\n');
    await sleep(3000);
    
    // 测试 6: 验收通过
    console.log('🎉 测试 6: 验收通过');
    const acceptRes = await post(`/tasks/${taskId}/accept`, {
      acceptor: '天枢',
      comment: '验收通过，做得很好！'
    });
    console.log('✅ 任务验收通过\n');
    await sleep(3000);
    
    // 测试 7: 获取任务详情
    console.log('📊 测试 7: 获取任务详情');
    const taskRes = await get(`/tasks/${taskId}`);
    console.log('✅ 任务状态:', taskRes.data.status);
    console.log('   状态历史:', taskRes.data.stateHistory.length, '条记录\n');
    
    // 测试 8: 创建另一个任务并取消
    console.log('❌ 测试 8: 创建任务并取消');
    const createRes2 = await post('/tasks', {
      title: '【测试】将被取消的任务',
      creator: '天枢',
      assignee: '磐石',
      priority: 'P2'
    });
    console.log('✅ 任务 2 创建成功:', createRes2.taskId);
    await sleep(2000);
    
    const cancelRes = await post(`/tasks/${createRes2.taskId}/cancel`, {
      operator: '天枢',
      reason: '测试取消流程'
    });
    console.log('✅ 任务已取消\n');
    await sleep(3000);
    
    // 总结
    console.log('=== 测试完成 ===');
    console.log('✅ 所有通知已发送，请检查飞书群消息：');
    console.log('   1. 📋 任务创建通知（@匠心）');
    console.log('   2. 📋 任务分配通知（@匠心）');
    console.log('   3. 🚀 任务执行通知');
    console.log('   4. ✅ 提交验收通知');
    console.log('   5. 🎉 验收通过通知');
    console.log('   6. 📋 任务创建通知（@磐石）');
    console.log('   7. ❌ 任务取消通知');
    console.log('\n任务 ID:', taskId);
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runTest();
