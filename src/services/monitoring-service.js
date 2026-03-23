/**
 * 运维监控服务
 * 
 * 功能：
 * 1. 系统健康监控
 * 2. API 调用监控
 * 3. 异常告警
 * 4. 性能指标收集
 */

const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../../runtime/monitoring.log');
const ALERTS_FILE = path.join(__dirname, '../../runtime/alerts.json');

/**
 * 监控系统健康状态
 */
class MonitoringService {
  constructor() {
    this.startTime = Date.now();
    this.apiCalls = new Map(); // API 端点 -> 调用次数
    this.errors = [];
    this.maxErrors = 100; // 最多保留 100 条错误
  }

  /**
   * 记录 API 调用
   */
  recordAPICall(endpoint, duration, success = true) {
    const key = endpoint;
    if (!this.apiCalls.has(key)) {
      this.apiCalls.set(key, {
        count: 0,
        success: 0,
        failure: 0,
        totalDuration: 0,
        lastCall: null
      });
    }

    const stats = this.apiCalls.get(key);
    stats.count++;
    stats.lastCall = new Date().toISOString();
    stats.totalDuration += duration;

    if (success) {
      stats.success++;
    } else {
      stats.failure++;
    }

    // 记录错误
    if (!success) {
      this.recordError({
        type: 'API_FAILURE',
        endpoint,
        duration,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 记录错误
   */
  recordError(error) {
    this.errors.push({
      ...error,
      timestamp: error.timestamp || new Date().toISOString()
    });

    // 限制错误数量
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // 写入日志文件
    this.writeLog(error);
  }

  /**
   * 写入日志文件
   */
  writeLog(entry) {
    try {
      const logLine = `[${entry.timestamp}] ${entry.type}: ${JSON.stringify(entry)}\n`;
      fs.appendFileSync(LOG_FILE, logLine);
    } catch (e) {
      console.error('[监控] 写入日志失败:', e.message);
    }
  }

  /**
   * 获取系统健康状态
   */
  getHealthStatus() {
    const uptime = Date.now() - this.startTime;
    const totalCalls = Array.from(this.apiCalls.values()).reduce((sum, s) => sum + s.count, 0);
    const totalFailures = Array.from(this.apiCalls.values()).reduce((sum, s) => sum + s.failure, 0);
    const successRate = totalCalls > 0 ? ((totalCalls - totalFailures) / totalCalls * 100).toFixed(2) : 100;

    return {
      status: 'ok',
      service: 'BCE v3.4 北斗智投 Phase 2',
      version: '3.4.0',
      uptime: this.formatUptime(uptime),
      uptimeSeconds: Math.floor(uptime / 1000),
      api: {
        totalCalls,
        totalFailures,
        successRate: `${successRate}%`,
        endpoints: this.apiCalls.size
      },
      errors: {
        recent: this.errors.length,
        lastError: this.errors.length > 0 ? this.errors[this.errors.length - 1].timestamp : null
      },
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 获取 API 调用统计
   */
  getAPIStats() {
    const stats = {};
    for (const [endpoint, data] of this.apiCalls.entries()) {
      stats[endpoint] = {
        count: data.count,
        success: data.success,
        failure: data.failure,
        avgDuration: data.count > 0 ? (data.totalDuration / data.count).toFixed(2) : 0,
        lastCall: data.lastCall
      };
    }
    return stats;
  }

  /**
   * 获取错误列表
   */
  getErrors(limit = 20) {
    return this.errors.slice(-limit);
  }

  /**
   * 格式化运行时间
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}天 ${hours % 24}小时 ${minutes % 60}分`;
    if (hours > 0) return `${hours}小时 ${minutes % 60}分 ${seconds % 60}秒`;
    if (minutes > 0) return `${minutes}分 ${seconds % 60}秒`;
    return `${seconds}秒`;
  }

  /**
   * 检查告警条件
   */
  checkAlerts() {
    const alerts = [];
    const health = this.getHealthStatus();

    // 错误率告警
    const errorRate = parseFloat(health.api.successRate);
    if (errorRate < 95) {
      alerts.push({
        level: 'warning',
        type: 'HIGH_ERROR_RATE',
        message: `API 成功率低于 95% (${health.api.successRate})`,
        timestamp: new Date().toISOString()
      });
    }

    // 内存告警
    const memoryMB = health.memory.heapUsed / 1024 / 1024;
    if (memoryMB > 500) {
      alerts.push({
        level: 'warning',
        type: 'HIGH_MEMORY',
        message: `内存使用超过 500MB (${memoryMB.toFixed(2)}MB)`,
        timestamp: new Date().toISOString()
      });
    }

    // 最近错误告警
    const recentErrors = this.errors.filter(e => {
      const time = new Date(e.timestamp);
      const now = new Date();
      return (now - time) < 5 * 60 * 1000; // 5 分钟内
    });

    if (recentErrors.length >= 5) {
      alerts.push({
        level: 'critical',
        type: 'MULTIPLE_ERRORS',
        message: `5 分钟内发生${recentErrors.length}个错误`,
        timestamp: new Date().toISOString()
      });
    }

    return alerts;
  }

  /**
   * 保存告警到文件
   */
  saveAlerts(alerts) {
    try {
      let existingAlerts = [];
      if (fs.existsSync(ALERTS_FILE)) {
        existingAlerts = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'));
      }

      existingAlerts.push(...alerts);
      // 保留最近 100 条告警
      existingAlerts = existingAlerts.slice(-100);

      fs.writeFileSync(ALERTS_FILE, JSON.stringify(existingAlerts, null, 2), 'utf8');
    } catch (e) {
      console.error('[监控] 保存告警失败:', e.message);
    }
  }
}

// 创建单例
const monitoringService = new MonitoringService();

module.exports = {
  monitoringService,
  MonitoringService
};
