/**
 * 全员任务通知测试 - 20 秒回复挑战
 * 给每个团队成员发送任务，监控回复情况
 */

const http = require('http');

// 团队成员列表（磊哥提供的最终确认版）
const TEAM_MEMBERS = [
  { name: '天枢', userId: 'ou_82e24fd5850f184e395ecaa7d11a1ddc' },
  { name: '匠心', userId: 'ou_11b23f47253fc3551ffed488527c7740' },
  { name: '司库', userId: 'ou_998d07ddc86ad7ba9d4dd12dddc55cc6' },
  { name: '执矩', userId: 'ou_aaeb25dcae8616029a9d36906892bd05' },
  { name: '磐石', userId: 'ou_dba586c77d92f652e427370d3f54cc54' },
  { name: '灵犀', userId: 'ou_afd48fe16ccb4d2ba8a56235eb29d784' },
  { name: '天策', userId: 'ou_3a2c50c8eb0338734362a741c934da8f' }
];

const REPLY_TIMEOUT_SECONDS = 20;

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('=== 全员任务通知测试 - 20 秒回复挑战 ===\n');
  console.log(`测试时间：${new Date().toLocaleString('zh-CN')}`);
  console.log(`超时时间：${REPLY_TIMEOUT_SECONDS}秒\n`);
  
  const results = [];
  const startTime = Date.now();
  
  // 第一轮：创建任务
  console.log('📋 第一轮：创建任务并发送通知\n');
  
  for (const member of TEAM_MEMBERS) {
    try {
      const taskRes = await post('/api/bce/tasks', {
        title: `【全员测试】${member.name}的任务通知测试`,
        description: `测试任务：请在${REPLY_TIMEOUT_SECONDS}秒内回复"收到"确认任务`,
        creator: '天枢',
        assignee: member.name,
        priority: 'P0',
        dueDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        requireConfirmation: true
      });
      
      console.log(`✅ ${member.name}: 任务创建成功 - ${taskRes.taskId.substring(0, 8)}...`);
      
      results.push({
        member: member.name,
        userId: member.userId,
        taskId: taskRes.taskId,
        createdAt: Date.now(),
        status: 'sent',
        confirmedAt: null,
        confirmedBy: null
      });
      
      // 每个任务间隔 2 秒发送
      await sleep(2000);
      
    } catch (error) {
      console.error(`❌ ${member.name}: 任务创建失败 - ${error.message}`);
      results.push({
        member: member.name,
        userId: member.userId,
        taskId: null,
        createdAt: Date.now(),
        status: 'failed',
        error: error.message
      });
    }
  }
  
  console.log('\n⏰ 第二轮：等待回复（20 秒倒计时）\n');
  
  // 等待 20 秒
  const waitStart = Date.now();
  const waitEnd = waitStart + (REPLY_TIMEOUT_SECONDS * 1000);
  
  while (Date.now() < waitEnd) {
    const elapsed = Math.floor((Date.now() - waitStart) / 1000);
    const remaining = REPLY_TIMEOUT_SECONDS - elapsed;
    process.stdout.write(`\r   剩余时间：${remaining}秒... `);
    await sleep(1000);
  }
  
  console.log('\n\n📊 第三轮：检查确认状态\n');
  
  // 检查每个任务的确认状态
  for (const result of results) {
    if (result.status === 'failed') continue;
    
    try {
      const taskRes = await get(`/api/bce/tasks/${result.taskId}`);
      const task = taskRes.data;
      
      if (task.confirmedBy) {
        const confirmTime = new Date(task.confirmedAt).getTime();
        const responseTime = Math.floor((confirmTime - result.createdAt) / 1000);
        result.status = 'confirmed';
        result.confirmedAt = task.confirmedAt;
        result.confirmedBy = task.confirmedBy;
        result.responseTime = responseTime;
        console.log(`✅ ${result.member}: 已确认 - ${task.confirmedBy} (${responseTime}秒)`);
      } else {
        result.status = 'no_response';
        console.log(`❌ ${result.member}: 未确认`);
      }
    } catch (error) {
      console.error(`❌ ${result.member}: 查询失败 - ${error.message}`);
      result.status = 'error';
      result.error = error.message;
    }
  }
  
  // 统计结果
  console.log('\n📈 测试结果统计\n');
  
  const total = results.length;
  const confirmed = results.filter(r => r.status === 'confirmed').length;
  const noResponse = results.filter(r => r.status === 'no_response').length;
  const failed = results.filter(r => r.status === 'failed' || r.status === 'error').length;
  
  console.log(`总人数：${total}`);
  console.log(`✅ 已确认：${confirmed} (${(confirmed/total*100).toFixed(1)}%)`);
  console.log(`❌ 未确认：${noResponse}`);
  console.log(`🔴 失败：${failed}`);
  
  // 未确认名单
  if (noResponse > 0) {
    console.log('\n⚠️ 未确认成员名单：');
    results.filter(r => r.status === 'no_response').forEach(r => {
      console.log(`  - ${r.member} (user_id: ${r.userId})`);
    });
    
    console.log('\n🔍 问题排查建议：');
    console.log('1. 检查飞书应用权限配置');
    console.log('2. 验证 user_id 是否正确（每个应用独立）');
    console.log('3. 检查飞书通知设置（免打扰/通知开关）');
    console.log('4. 查看 BCE 服务日志确认通知是否发送成功');
    console.log('5. 手动发送测试消息验证');
  }
  
  // 保存结果
  const reportPath = '/tmp/test-report-' + Date.now() + '.json';
  const fs = require('fs');
  fs.writeFileSync(reportPath, JSON.stringify({
    testTime: new Date().toISOString(),
    timeout: REPLY_TIMEOUT_SECONDS,
    summary: {
      total,
      confirmed,
      noResponse,
      failed
    },
    results
  }, null, 2));
  
  console.log(`\n📄 详细报告已保存：${reportPath}`);
  console.log('\n=== 测试完成 ===\n');
}

runTest().catch(console.error);
