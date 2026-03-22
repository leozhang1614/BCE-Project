/**
 * BCE 北斗协同引擎 - v3.2 最终版
 * 主入口文件
 */

// 加载环境变量
require('dotenv').config();

const express = require('express');
const path = require('path');

// 导入 API 模块
const tasksApi = require('./api/bce-tasks');
const feishuNotifyApi = require('./api/feishu-notify');
const feishuCardApi = require('./api/feishu-card');
const feishuWebhookApi = require('./api/feishu-webhook');
const mailboxApi = require('./api/mailbox');  // v3.2 新增
const occSyncApi = require('./api/occ-sync');  // v3.2 OCC 同步
const devWorkflowApi = require('./api/development-workflow');  // v3.3 开发工作流

// 导入服务模块
const notificationService = require('./services/notification-service');  // v3.2 三通道
const transferRulesService = require('./services/transfer-rules');  // v3.2 规则引擎
const retryQueue = require('./services/retry-queue');  // v3.2 重试队列
const mailboxService = require('./services/mailbox-service');  // v3.2 邮箱
const schedulerService = require('./services/scheduler-service');  // v3.2 定时任务轮询

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件
app.use(express.static(path.join(__dirname, '../public')));

// API 路由
app.use('/api/bce', tasksApi);
app.use('/api/feishu-notify', feishuNotifyApi);
app.use('/api/feishu/card-callback', feishuCardApi);
app.use('/api/feishu/webhook', feishuWebhookApi);
app.use('/api/mailbox', mailboxApi);  // v3.2 新增
app.use('/api/occ', occSyncApi);  // v3.2 OCC 同步
app.use('/api/dev-workflow', devWorkflowApi);  // v3.3 开发工作流

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'BCE v3.2',
    version: '3.2.0',
    features: {
      mailbox: 'enabled',
      rules: 'enabled',
      retry: 'enabled',
      threeChannels: 'enabled'
    },
    retryQueue: retryQueue.getStatus()
  });
});

// 规则引擎状态
app.get('/api/rules/status', (req, res) => {
  res.json({
    status: 'ok',
    rules: require('./config/task-rules').transferRules.map(r => r.name)
  });
});

// 邮箱状态
app.get('/api/mailbox/status', async (req, res) => {
  const members = ['天枢', '匠心', '司库', '执矩', '磐石', '灵犀', '天策'];
  const status = {};
  
  for (const member of members) {
    status[member] = await mailboxService.count(member);
  }
  
  res.json({
    status: 'ok',
    unreadCounts: status
  });
});

// 定时任务状态
app.get('/api/scheduler/status', (req, res) => {
  res.json({
    status: 'ok',
    scheduler: schedulerService.getStatus()
  });
});

// 启动服务
async function start() {
  const server = app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   BCE 北斗协同引擎 v3.2 最终版                              ║
║                                                           ║
║   HTTP: http://localhost:${PORT}                          ║
║                                                           ║
║   核心功能：                                               ║
║   ✅ sessions_send 主通道                                  ║
║   ✅ 飞书卡片备用通道                                      ║
║   ✅ 文件系统邮箱可靠通道                                  ║
║   ✅ 规则引擎自动流转                                      ║
║   ✅ 通知重试队列（指数退避）                              ║
║   ✅ 幂等性检查                                            ║
║   ✅ 转交边界处理                                          ║
║                                                           ║
║   状态：http://localhost:${PORT}/health                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });

  // v3.2 修复：添加错误处理
  server.on('error', (err) => {
    console.error('[BCE] 服务启动失败:', err);
    process.exit(1);
  });
  
  // 启动定时任务轮询（v3.2 兜底方案）
  schedulerService.start();
  
  // 监听任务完成事件，触发规则引擎
  process.on('task:completed', async (taskId) => {
    console.log(`[事件] 任务完成：${taskId}`);
    await transferRulesService.onTaskCompleted(taskId);
  });
}

// 优雅退出
process.on('SIGINT', async () => {
  console.log('[BCE] 正在关闭服务...');
  schedulerService.stop();
  retryQueue.clear();
  process.exit(0);
});

start();

module.exports = app;
