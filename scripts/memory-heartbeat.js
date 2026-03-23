/**
 * 记忆系统心跳检查任务
 * 
 * 核心逻辑：
 * 1. 每天晚上 22:00 检查当日记忆
 * 2. 发现缺失自动修复
 * 3. 记录检查日志
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// 配置
const MEMORY_DIR = '/Users/ai/.openclaw/workspace-jiangxin/memory';
const BCE_API = 'http://localhost:3000/api/bce/tasks';

/**
 * 获取今日日期字符串
 */
function getTodayStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 检查今日记忆文件是否存在
 */
function checkTodayMemory() {
  const today = getTodayStr();
  const memoryFile = path.join(MEMORY_DIR, `${today}.md`);
  
  console.log(`\n🔍 [记忆心跳] 检查今日记忆：${today}.md`);
  
  if (fs.existsSync(memoryFile)) {
    const stats = fs.statSync(memoryFile);
    const size = stats.size;
    console.log(`✅ [记忆心跳] 今日记忆已存在 (${size} bytes)`);
    return true;
  } else {
    console.log(`❌ [记忆心跳] 今日记忆缺失！`);
    return false;
  }
}

/**
 * 获取今日任务
 */
async function getTodayTasks() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bce/tasks',
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          const today = getTodayStr();
          const todayTasks = result.data.filter(t => 
            t.createdAt && t.createdAt.startsWith(today)
          );
          resolve(todayTasks);
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
 * 自动修复今日记忆
 */
async function repairMemory() {
  const today = getTodayStr();
  const memoryFile = path.join(MEMORY_DIR, `${today}.md`);
  
  console.log(`\n🔧 [记忆心跳] 开始修复今日记忆...`);
  
  try {
    // 获取今日任务
    const tasks = await getTodayTasks();
    
    // 生成记忆内容
    let content = `# ${today} - 工作日志\n\n`;
    content += `## 今日任务\n\n`;
    
    if (tasks.length > 0) {
      tasks.forEach((t, i) => {
        content += `${i + 1}. **${t.title}**\n`;
        content += `   - 状态：${t.status}\n`;
        content += `   - 优先级：${t.priority}\n`;
        content += `   - 确认时间：${t.confirmedAt || '未确认'}\n\n`;
      });
    } else {
      content += `今日无新任务\n\n`;
    }
    
    content += `## 工作记录\n\n`;
    content += `（待补充）\n\n`;
    
    content += `## 明日计划\n\n`;
    content += `（待补充）\n`;
    
    // 写入文件
    fs.writeFileSync(memoryFile, content, 'utf8');
    console.log(`✅ [记忆心跳] 今日记忆已修复 (${memoryFile})`);
    console.log(`   任务数：${tasks.length}`);
    
    return true;
  } catch (error) {
    console.error(`❌ [记忆心跳] 修复失败：${error.message}`);
    return false;
  }
}

/**
 * 执行记忆检查
 */
async function checkMemory() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║   记忆系统心跳检查                                        ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  const exists = checkTodayMemory();
  
  if (!exists) {
    await repairMemory();
  }
  
  console.log('\n✅ [记忆心跳] 检查完成\n');
}

/**
 * 启动定时任务（每天 22:00）
 */
function start() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║   记忆系统心跳任务已启动                                   ║');
  console.log('║                                                           ║');
  console.log('║   每天 22:00 自动检查当日记忆                               ║');
  console.log('║   发现缺失自动修复                                         ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  // 立即执行一次
  checkMemory();
  
  // 计算到下一个 22:00 的时间
  function scheduleNextCheck() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(22, 0, 0, 0);
    
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    
    const delay = next.getTime() - now.getTime();
    
    console.log(`⏰ [记忆心跳] 下次检查：${next.toLocaleString('zh-CN')}`);
    console.log(`⏰ [记忆心跳] 等待：${Math.floor(delay / 1000 / 60)}分钟\n`);
    
    setTimeout(() => {
      checkMemory();
      scheduleNextCheck();
    }, delay);
  }
  
  scheduleNextCheck();
}

// 启动服务
start();
