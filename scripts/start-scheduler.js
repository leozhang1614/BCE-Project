/**
 * 启动定时任务调度服务
 */

require('dotenv').config({ path: '.env.local' });

const schedulerService = require('../src/services/scheduler-service');

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║                                                           ║');
console.log('║   BCE v3.2 定时任务调度服务启动                            ║');
console.log('║                                                           ║');
console.log('╚═══════════════════════════════════════════════════════════╝');

// 启动服务
schedulerService.start();

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n[定时任务] 正在关闭...');
  process.exit(0);
});
