/**
 * 执行者心跳任务（兜底方案）
 * 
 * 核心逻辑：
 * 1. 每 5 分钟主动查询 BCE API
 * 2. 发现待办任务后自动处理
 * 3. 不依赖飞书通知
 */

const http = require('http');

// 配置
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 分钟
const BCE_HOST = 'localhost';
const BCE_PORT = 3000;

// 执行者列表（不同角色查询不同状态）
const WORKERS = [
  { name: '匠心', userId: 'ou_b3b3b6abaa38da2c4066010a02abf544', queryStatus: 'pending', queryBy: 'assignee' },
  { name: '磐石', userId: 'ou_dba586c77d92f652e427370d3f54cc54', queryStatus: 'pending', queryBy: 'assignee' },
  { name: '司库', userId: 'ou_998d07ddc86ad7ba9d4dd12dddc55cc6', queryStatus: 'reviewing', queryBy: 'assignee' },  // 司库查询待验收任务
  { name: '执矩', userId: 'ou_aaeb25dcae8616029a9d36906892bd05', queryStatus: 'auditing', queryBy: 'auditor' }   // 执矩查询待审核任务（v3.4 修复）
];

/**
 * 查询待办任务
 */
async function queryPendingTasks(workerName, status = 'pending', queryBy = 'assignee') {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: BCE_HOST,
      port: BCE_PORT,
      path: `/api/bce/tasks?${queryBy}=${encodeURIComponent(workerName)}&status=${status}`,
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.data || []);
        } catch (e) {
          reject(new Error('解析响应失败'));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

/**
 * 确认任务
 */
async function confirmTask(taskId, workerName) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: BCE_HOST,
      port: BCE_PORT,
      path: `/api/bce/tasks/${taskId}/confirm`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(new Error('解析响应失败'));
        }
      });
    });
    
    req.on('error', reject);
    req.write(JSON.stringify({ userName: workerName }));
    req.end();
  });
}

/**
 * 验收任务
 */
async function acceptTask(taskId, workerName, comment = '') {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: BCE_HOST,
      port: BCE_PORT,
      path: `/api/bce/tasks/${taskId}/accept`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(new Error('解析响应失败'));
        }
      });
    });
    
    req.on('error', reject);
    // 使用 acceptor 参数名（匹配 bce-tasks.js 的 API）
    req.write(JSON.stringify({ acceptor: workerName, comment: comment }));
    req.end();
  });
}

/**
 * 执行者心跳任务
 */
async function workerHeartbeat(worker) {
  try {
    const status = worker.queryStatus || 'pending';
    const queryBy = worker.queryBy || 'assignee';
    console.log(`❤️ [${worker.name} 心跳] 开始查询待办任务 (status=${status}, queryBy=${queryBy})...`);
    
    const tasks = await queryPendingTasks(worker.name, status, queryBy);
    
    if (tasks.length > 0) {
      console.log(`❤️ [${worker.name} 心跳] 发现${tasks.length}个待办任务！`);
      
      for (const task of tasks) {
        console.log(`  - ${task.title}`);
        
        // 根据任务类型自动处理
        if (status === 'pending') {
          // 待确认任务 - 自动确认
          const result = await confirmTask(task.id, worker.name);
          if (result.success) {
            console.log(`    ✅ 已自动确认`);
          } else {
            console.log(`    ❌ 确认失败：${result.error}`);
          }
        } else if (status === 'reviewing') {
          // 待验收任务 - 自动验收（司库）
          const result = await acceptTask(task.id, worker.name, '自动验收通过');
          if (result.success) {
            console.log(`    ✅ 已自动验收`);
          } else {
            console.log(`    ❌ 验收失败：${result.error}`);
          }
        } else if (status === 'auditing') {
          // 待审核任务 - 自动确认（执矩）
          const result = await confirmTask(task.id, worker.name);
          if (result.success) {
            console.log(`    ✅ 已自动确认（审核接收）`);
          } else {
            console.log(`    ❌ 确认失败：${result.error}`);
          }
        }
      }
    } else {
      console.log(`❤️ [${worker.name} 心跳] 没有待办任务`);
    }
  } catch (error) {
    console.error(`❤️ [${worker.name} 心跳] 查询失败：${error.message}`);
  }
}

/**
 * 启动所有执行者的心跳任务
 */
function start() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║   BCE v3.4 执行者心跳任务（兜底方案）                      ║');
  console.log('║                                                           ║');
  console.log('║   每 5 分钟主动查询待办任务并自动处理                       ║');
  console.log('║   不依赖飞书通知                                          ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  
  // 立即执行一次
  WORKERS.forEach(worker => {
    workerHeartbeat(worker);
  });
  
  // 定时执行
  WORKERS.forEach(worker => {
    setInterval(() => {
      workerHeartbeat(worker);
    }, CHECK_INTERVAL);
  });
  
  console.log(`✅ 已启动 ${WORKERS.length} 个执行者的心跳任务（每${CHECK_INTERVAL/1000}秒）`);
  console.log('');
}

// 启动服务
start();
