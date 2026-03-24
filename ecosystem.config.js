/**
 * BCE PM2 生态系统配置（v3.4.2 增强版）
 * 
 * 功能：
 * 1. 自动重启（崩溃后）
 * 2. 内存限制（防止内存泄漏）
 * 3. 日志轮转（避免日志过大）
 * 4. 健康检查（定期检测服务状态）
 * 5. 优雅重启（零停机）
 */

module.exports = {
  apps: [{
    name: 'bce-server',
    script: './src/index.js',
    
    // 运行模式
    instances: 1,
    exec_mode: 'fork',
    
    // 环境变量
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // 错误处理
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    
    // 自动重启配置
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',  // 超过 500MB 自动重启
    
    // 重启策略
    restart_delay: 4000,  // 重启间隔 4 秒
    max_restarts: 10,     // 最多重启 10 次
    min_uptime: '10s',    // 最小运行时间（少于 10 秒重启算失败）
    
    // 日志轮转
    log_type: 'json',
    log_rotate: true,
    rotate_interval: '1d',     // 每天轮转
    rotate_size: '50M',        // 超过 50MB 轮转
    retain: 7,                 // 保留 7 天日志
    
    // 健康检查（v3.4.2 新增）
    health_check: {
      enabled: true,
      endpoint: '/health',
      interval: 30000,  // 每 30 秒检查一次
      timeout: 5000,    // 超时 5 秒
      unhealthy_threshold: 3,  // 连续 3 次失败标记为不健康
    },
    
    // 优雅退出
    kill_timeout: 3000,  // 等待 3 秒后强制杀死
    wait_ready: true,    // 等待进程发出 ready 信号
    listen_timeout: 10000  // 监听超时 10 秒
  }]
};
