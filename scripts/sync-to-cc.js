#!/usr/bin/env node
/**
 * BCE 任务数据同步到 Control Center
 * 
 * 定时从 BCE API 获取任务数据，同步到 Control Center 的 task-store
 * 确保 Control Center 显示的任务数据与 BCE 完全一致
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// BCE API 地址
const BCE_API_BASE = 'http://localhost:3000/api/bce';
// Control Center 任务存储路径
const CC_TASKS_PATH = '/Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库/openclaw-control-center/runtime/tasks.json';

// 同步间隔（毫秒）
const SYNC_INTERVAL_MS = 30000; // 30 秒

/**
 * 从 BCE 获取任务数据
 */
function fetchBceTasks() {
  return new Promise((resolve, reject) => {
    http.get(`${BCE_API_BASE}/tasks`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          // BCE API 返回格式：{success:true, count:N, data:[...]}
          resolve(result.data || []);
        } catch (e) {
          reject(new Error('解析 BCE 数据失败：' + e.message));
        }
      });
    }).on('error', reject);
  });
}

/**
 * 将 BCE 任务转换为 Control Center 格式
 */
function convertToCcFormat(bceTasks) {
  const ccTasks = bceTasks.map(task => {
    // BCE 状态映射到 CC 状态
    const statusMap = {
      'pending': 'todo',
      'assigned': 'todo',
      'executing': 'in_progress',
      'reviewing': 'done',
      'accepted': 'done',
      'cancelled': 'done'
    };
    
    return {
      id: task.id,
      taskId: task.id,
      projectId: task.projectId || 'bce-default',
      title: task.title,
      status: statusMap[task.status] || 'todo',
      owner: task.assignee || task.creator,
      dueAt: task.dueDate,
      definitionOfDone: task.deliverables || [],
      artifacts: [],
      rollback: null,
      sessionKeys: [],
      updatedAt: task.updatedAt,
      createdAt: task.createdAt,
      // BCE 特有字段
      bceStatus: task.status,
      bceCreator: task.creator,
      bcePriority: task.priority
    };
  });
  
  return ccTasks;
}

/**
 * 写入 Control Center 任务存储
 */
function writeCcTasks(ccTasks) {
  const snapshot = {
    tasks: ccTasks,
    agentBudgets: [],
    updatedAt: new Date().toISOString()
  };
  
  fs.writeFileSync(CC_TASKS_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
  console.log(`[同步] 已写入 ${ccTasks.length} 个任务到 ${CC_TASKS_PATH}`);
}

/**
 * 执行同步
 */
async function sync() {
  try {
    console.log(`[同步] 开始从 BCE 同步任务数据...`);
    
    const bceTasks = await fetchBceTasks();
    console.log(`[同步] 从 BCE 获取到 ${bceTasks.length} 个任务`);
    
    const ccTasks = convertToCcFormat(bceTasks);
    writeCcTasks(ccTasks);
    
    console.log(`[同步] 同步完成，下次同步时间：${new Date(Date.now() + SYNC_INTERVAL_MS).toLocaleTimeString()}`);
  } catch (error) {
    console.error(`[同步] 失败：${error.message}`);
  }
}

// 立即执行一次
sync();

// 定时执行
setInterval(sync, SYNC_INTERVAL_MS);

console.log(`[同步] BCE → Control Center 同步服务已启动`);
console.log(`[同步] 同步间隔：${SYNC_INTERVAL_MS / 1000}秒`);
console.log(`[同步] 目标文件：${CC_TASKS_PATH}`);
