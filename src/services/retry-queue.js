/**
 * 通知重试队列（指数退避）
 * 失败补偿机制
 */

class RetryQueue {
  constructor() {
    this.queue = [];
    this.maxRetries = 3;
    this.intervalId = null;
    
    this.start();
  }

  /**
   * 启动重试队列
   */
  start() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    this.intervalId = setInterval(() => this.process(), 30000);
    console.log('[重试队列] 已启动，每 30 秒处理一次');
  }

  /**
   * 停止重试队列（v3.2 修复：内存泄漏）
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[重试队列] 已停止');
    }
  }

  /**
   * 添加通知任务
   */
  add(notification, retries = 3) {
    this.queue.push({
      notification,
      retriesLeft: retries,
      nextRetryAt: Date.now() + 60000, // 1 分钟后重试
      createdAt: Date.now()
    });
    
    console.log(`[重试队列] 添加任务：${notification.type} -> ${notification.agent}`);
  }

  /**
   * 处理重试队列
   */
  async process() {
    const now = Date.now();
    const toRetry = this.queue.filter(n => n.nextRetryAt <= now);

    if (toRetry.length === 0) {
      return;
    }

    console.log(`[重试队列] 处理 ${toRetry.length} 个重试任务`);

    for (const item of toRetry) {
      try {
        // 调用 sessions_send 重试
        await this.sendNotification(item.notification);
        
        // 成功，从队列移除
        this.queue = this.queue.filter(n => n !== item);
        console.log(`[重试队列] 任务成功：${item.notification.type} -> ${item.notification.agent}`);
        
      } catch (error) {
        item.retriesLeft--;
        
        if (item.retriesLeft <= 0) {
          // 最终失败，记录日志，人工介入
          this.logError('通知最终失败', item.notification, error);
          this.queue = this.queue.filter(n => n !== item);
        } else {
          // 指数退避：1 分钟、5 分钟、30 分钟
          const delay = [60000, 300000, 1800000][3 - item.retriesLeft];
          item.nextRetryAt = Date.now() + delay;
          console.log(`[重试队列] 重试失败，${item.retriesLeft} 次后重试：${item.notification.type}`);
        }
      }
    }
  }

  /**
   * 发送通知（通过 Gateway HTTP API）
   */
  async sendNotification(notification) {
    const http = require('http');
    const GATEWAY_HOST = process.env.GATEWAY_HOST || '127.0.0.1';
    const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT) || 18789;
    const target = notification.sessionKey || `agent-${notification.agent}`;
    
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        jsonrpc: '2.0',
        method: 'sessions.send',
        params: { target, message: notification.content },
        id: Date.now()
      });
      
      const req = http.request({
        hostname: GATEWAY_HOST,
        port: GATEWAY_PORT,
        path: '/rpc',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
      
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Gateway 超时')); });
      req.write(payload);
      req.end();
    });
  }

  /**
   * 记录错误日志
   */
  logError(message, notification, error) {
    console.error(`[重试队列] ${message}:`, {
      type: notification.type,
      agent: notification.agent,
      taskId: notification.taskId,
      error: error.message,
      stack: error.stack
    });
    
    // 可以写入日志文件或发送到告警系统
  }

  /**
   * 获取队列状态
   */
  getStatus() {
    return {
      total: this.queue.length,
      byRetries: {
        '1 次': this.queue.filter(n => n.retriesLeft === 1).length,
        '2 次': this.queue.filter(n => n.retriesLeft === 2).length,
        '3 次': this.queue.filter(n => n.retriesLeft === 3).length
      },
      nextRetry: this.queue.length > 0 ? 
        new Date(Math.min(...this.queue.map(n => n.nextRetryAt))).toISOString() : null
    };
  }

  /**
   * 清空队列
   */
  clear() {
    this.queue = [];
    this.stop();
    console.log('[重试队列] 已清空');
  }
}

module.exports = new RetryQueue();
