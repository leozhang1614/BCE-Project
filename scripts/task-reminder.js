#!/usr/bin/env node
/**
 * 任务确认超时提醒
 * 
 * 功能：
 * - 每 5 分钟检查未确认任务
 * - 5 分钟未确认：发送提醒通知
 * - 15 分钟未确认：升级通知磊哥
 * - 30 分钟未确认：升级通知天枢
 */

const http = require('http');

const BCE_API_BASE = 'http://localhost:3000/api/bce';
const FEISHU_NOTIFY_API = 'http://localhost:3000/api/feishu-notify/notify/task';

// 超时配置（毫秒）
const REMINDER_AFTER_MS = 5 * 60 * 1000;    // 5 分钟后提醒
const ESCALATE_LEIGE_AFTER_MS = 15 * 60 * 1000;  // 15 分钟后通知磊哥
const ESCALATE_TIANSHU_AFTER_MS = 30 * 60 * 1000; // 30 分钟后通知天枢

/**
 * 获取未确认任务
 */
async function getUnconfirmedTasks() {
  return new Promise((resolve, reject) => {
    http.get(`${BCE_API_BASE}/tasks/unconfirmed`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.data || []);
        } catch (e) {
          reject(new Error('解析失败'));
        }
      });
    }).on('error', reject);
  });
}

/**
 * 发送飞书通知
 */
async function sendFeishuNotification(task, action, operator, comment, assignee) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      taskId: task.id,
      taskTitle: task.title,
      action,
      operator,
      comment,
      assignee
    });
    
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/feishu-notify/notify/task',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => resolve(responseData));
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * 检查并发送提醒
 */
async function checkAndRemind() {
  try {
    console.log(`[${new Date().toLocaleString('zh-CN')}] 检查未确认任务...`);
    
    const tasks = await getUnconfirmedTasks();
    console.log(`找到 ${tasks.length} 个未确认任务`);
    
    const now = Date.now();
    
    for (const task of tasks) {
      // 查找分配时间
      const assignHistory = task.stateHistory?.find(h => h.to === 'assigned');
      if (!assignHistory) continue;
      
      const assignedAt = new Date(assignHistory.timestamp).getTime();
      const elapsed = now - assignedAt;
      const elapsedMinutes = Math.floor(elapsed / 60000);
      
      console.log(`任务：${task.title}, 负责人：${task.assignee}, 已超时：${elapsedMinutes}分钟`);
      
      // 5 分钟未确认：发送提醒
      if (elapsed >= REMINDER_AFTER_MS && elapsed < ESCALATE_LEIGE_AFTER_MS) {
        console.log(`  → 发送提醒通知`);
        await sendFeishuNotification(
          task,
          'reminder',
          '系统',
          `⚠️ 任务已分配${elapsedMinutes}分钟，尚未确认！请立即确认！`,
          task.assignee
        );
      }
      
      // 15 分钟未确认：通知磊哥
      if (elapsed >= ESCALATE_LEIGE_AFTER_MS && elapsed < ESCALATE_TIANSHU_AFTER_MS) {
        console.log(`  → 升级通知磊哥`);
        await sendFeishuNotification(
          task,
          'escalate_leige',
          '系统',
          `🚨 紧急！任务已分配${elapsedMinutes}分钟，${task.assignee}尚未确认！请立即处理！`,
          '磊哥'
        );
      }
      
      // 30 分钟未确认：通知天枢
      if (elapsed >= ESCALATE_TIANSHU_AFTER_MS) {
        console.log(`  → 升级通知天枢`);
        await sendFeishuNotification(
          task,
          'escalate_tianshu',
          '系统',
          `🚨 严重超时！任务已分配${elapsedMinutes}分钟，${task.assignee}尚未确认！请立即处理！`,
          '天枢'
        );
      }
    }
    
    console.log(`[${new Date().toLocaleString('zh-CN')}] 检查完成\n`);
  } catch (error) {
    console.error('检查失败:', error.message);
  }
}

// 立即执行一次
checkAndRemind();

// 每 5 分钟检查一次
setInterval(checkAndRemind, 5 * 60 * 1000);

console.log('✅ 任务确认超时提醒服务已启动');
console.log('   提醒时间：5 分钟');
console.log('   升级磊哥：15 分钟');
console.log('   升级天枢：30 分钟');
