/**
 * BCE 健康监控脚本（v3.4.2）
 * 
 * 功能：
 * 1. 每 30 秒检查 BCE 服务健康状态
 * 2. 检测心跳任务进程是否存在
 * 3. 服务异常时自动重启
 * 4. 记录健康检查日志
 */

const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const HEALTH_CHECK_INTERVAL = 30000;  // 30 秒
const BCE_HEALTH_URL = 'http://localhost:3000/health';
const HEARTBEAT_PROCESS = 'heartbeat-worker.js';
const LOG_FILE = path.join(__dirname, '../logs/health-monitor.log');

// 日志函数
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage);
  
  // 写入日志文件
  fs.appendFileSync(LOG_FILE, logMessage);
}

// 检查 BCE 服务健康状态
async function checkBCEHealth() {
  return new Promise((resolve, reject) => {
    const req = http.get(BCE_HEALTH_URL, { timeout: 5000 }, (res) => {
      if (res.statusCode === 200) {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const health = JSON.parse(data);
            resolve({
              status: 'healthy',
              service: health.service,
              version: health.version
            });
          } catch (e) {
            reject(new Error('健康检查响应解析失败'));
          }
        });
      } else {
        reject(new Error(`健康检查返回 ${res.statusCode}`));
      }
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('健康检查超时（5 秒）'));
    });
  });
}

// 检查心跳任务进程
async function checkHeartbeatProcess() {
  return new Promise((resolve, reject) => {
    exec(`ps aux | grep "${HEARTBEAT_PROCESS}" | grep -v grep`, (error, stdout, stderr) => {
      if (error || !stdout.trim()) {
        resolve({ running: false });
      } else {
        const lines = stdout.trim().split('\n');
        resolve({
          running: true,
          count: lines.length,
          pid: lines[0].split(/\s+/)[1]
        });
      }
    });
  });
}

// 重启 BCE 服务
async function restartBCEService() {
  return new Promise((resolve, reject) => {
    log('🔄 正在重启 BCE 服务...');
    
    exec('cd /Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库/BCE-Project && pm2 restart bce-server', (error, stdout, stderr) => {
      if (error) {
        log(`❌ 重启失败：${error.message}`);
        reject(error);
      } else {
        log(`✅ 重启成功：${stdout.trim()}`);
        resolve(stdout);
      }
    });
  });
}

// 重启心跳任务
async function restartHeartbeat() {
  return new Promise((resolve, reject) => {
    log('🔄 正在重启心跳任务...');
    
    // 先停止现有进程
    exec('pkill -f "heartbeat-worker.js"', () => {
      // 等待 1 秒
      setTimeout(() => {
        // 启动新进程
        exec('cd /Users/ai/.openclaw/workspace-jiangxin/匠心工作区/代码仓库/BCE-Project && nohup node scripts/heartbeat-worker.js > logs/heartbeat.log 2>&1 &', (error, stdout, stderr) => {
          if (error) {
            log(`❌ 心跳任务重启失败：${error.message}`);
            reject(error);
          } else {
            log('✅ 心跳任务重启成功');
            resolve();
          }
        });
      }, 1000);
    });
  });
}

// 主监控循环
let consecutiveFailures = 0;
const MAX_FAILURES = 3;  // 连续 3 次失败后重启

async function healthMonitor() {
  log('╔═══════════════════════════════════════════════════════════╗');
  log('║                                                           ║');
  log('║   BCE 健康监控服务已启动（v3.4.2）                         ║');
  log('║                                                           ║');
  log('║   检查间隔：30 秒                                          ║');
  log('║   重启阈值：连续 3 次失败                                   ║');
  log('║                                                           ║');
  log('╚═══════════════════════════════════════════════════════════╝');
  
  // 立即执行一次
  await runHealthCheck();
  
  // 定时执行
  setInterval(runHealthCheck, HEALTH_CHECK_INTERVAL);
}

async function runHealthCheck() {
  try {
    // 1. 检查 BCE 服务
    const bceHealth = await checkBCEHealth();
    log(`✅ BCE 服务健康：${bceHealth.service} (v${bceHealth.version})`);
    consecutiveFailures = 0;  // 重置失败计数
    
    // 2. 检查心跳任务
    const heartbeat = await checkHeartbeatProcess();
    if (heartbeat.running) {
      log(`✅ 心跳任务运行中（PID: ${heartbeat.pid}）`);
    } else {
      log('❌ 心跳任务未运行，自动重启...');
      await restartHeartbeat();
    }
    
  } catch (error) {
    consecutiveFailures++;
    log(`❌ 健康检查失败：${error.message} (连续 ${consecutiveFailures}/${MAX_FAILURES} 次)`);
    
    if (consecutiveFailures >= MAX_FAILURES) {
      log('🚨 达到重启阈值，开始自动恢复...');
      
      try {
        await restartBCEService();
        consecutiveFailures = 0;
      } catch (restartError) {
        log(`🚨 自动恢复失败：${restartError.message}`);
      }
    }
  }
}

// 启动监控
healthMonitor().catch(console.error);
