/**
 * BCE v3.4 - 定时任务调度器
 * 功能：每 5 分钟检查进度更新，每 1.5 小时发送标准化汇报
 */

const http = require('http');

const CONFIG = {
  // 进度检查间隔（5 分钟）
  PROGRESS_CHECK_INTERVAL: 5 * 60 * 1000,
  
  // 汇报发送间隔（1.5 小时）
  REPORT_INTERVAL: 90 * 60 * 1000,
  
  // BCE 服务器地址
  BCE_HOST: 'localhost',
  BCE_PORT: 3000
};

/**
 * 发送 HTTP 请求
 */
function sendRequest(path, method = 'POST', body = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: CONFIG.BCE_HOST,
      port: CONFIG.BCE_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', reject);
    
    if (body && Object.keys(body).length > 0) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

/**
 * 检查进度更新
 */
async function checkProgress() {
  try {
    const result = await sendRequest('/api/bce/progress/check');
    
    // 防御性检查：确保 result 和 result.data 存在
    if (!result) {
      console.warn('[定时任务] API 返回为空，跳过本次检查');
      return;
    }
    
    if (!result.success) {
      console.warn('[定时任务] API 返回失败:', result.error || '未知错误');
      return;
    }
    
    if (!result.data || typeof result.data.alertsSent === 'undefined') {
      console.warn('[定时任务] API 返回格式异常:', result);
      return;
    }
    
    console.log(`[定时任务] 进度检查完成，发送${result.data.alertsSent}个预警`);
    
    if (result.data.alertsSent > 0) {
      console.log('[定时任务] 预警详情:', result.data.alerts);
    }
  } catch (error) {
    console.error('[定时任务] 进度检查失败:', error.message);
    // 不中断后续执行，等待下次定时检查
  }
}

/**
 * 发送标准化汇报
 */
async function sendReport(reportType = 'regular') {
  try {
    const result = await sendRequest('/api/bce/progress/report', 'POST', { reportType });
    
    // 防御性检查
    if (!result || !result.success || !result.data) {
      console.warn('[定时任务] 发送汇报失败:', result);
      return;
    }
    
    console.log(`[定时任务] ${reportType}汇报已发送，通知${result.data.tasksNotified}个任务`);
  } catch (error) {
    console.error('[定时任务] 发送汇报失败:', error.message);
    // 不中断后续执行
  }
}

/**
 * 获取汇报类型
 */
function getReportType() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  
  // 简化判断：根据时间决定汇报类型
  if (hours < 10) return 'morning';
  if (hours < 12) return 'regular';
  if (hours < 14) return 'noon';
  if (hours < 18) return 'regular';
  if (hours < 20) return 'evening';
  return 'final';
}

/**
 * 启动定时任务
 */
function start() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║   BCE v3.4 定时任务调度器已启动                           ║');
  console.log('║                                                           ║');
  console.log(`║   进度检查：每${CONFIG.PROGRESS_CHECK_INTERVAL / 60000}分钟                                  ║`);
  console.log(`║   进度汇报：每${CONFIG.REPORT_INTERVAL / 60000}分钟                                   ║`);
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  // 立即执行一次
  console.log('[定时任务] 启动时立即执行一次检查...');
  checkProgress();
  
  // 定时检查进度（每 5 分钟）
  setInterval(() => {
    console.log(`[定时任务] 执行进度检查 (${new Date().toLocaleString()})`);
    checkProgress();
  }, CONFIG.PROGRESS_CHECK_INTERVAL);
  
  // 定时发送汇报（每 1.5 小时）
  setInterval(() => {
    const reportType = getReportType();
    console.log(`[定时任务] 发送${reportType}进度汇报 (${new Date().toLocaleString()})`);
    sendReport(reportType);
  }, CONFIG.REPORT_INTERVAL);
}

// 启动
start();
