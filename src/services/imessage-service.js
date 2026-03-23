/**
 * iMessage 通知服务
 * 
 * 功能：
 * 1. 分级通知策略
 * 2. iMessage 集成
 * 3. 通知历史记录
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const NOTIFICATIONS_FILE = path.join(__dirname, '../../runtime/notifications.json');

/**
 * 通知级别
 */
const NOTIFICATION_LEVELS = {
  INFO: 'info',      // 普通信息
  WARNING: 'warning', // 警告
  CRITICAL: 'critical', // 紧急告警
  TASK: 'task'       // 任务通知
};

/**
 * iMessage 通知服务
 */
class IMessageService {
  constructor() {
    this.notifications = [];
    this.maxNotifications = 100; // 最多保留 100 条
    
    // 加载历史通知
    this.loadNotifications();
  }

  /**
   * 加载历史通知
   */
  loadNotifications() {
    try {
      if (fs.existsSync(NOTIFICATIONS_FILE)) {
        this.notifications = JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, 'utf8'));
      }
    } catch (e) {
      console.error('[iMessage] 加载历史通知失败:', e.message);
      this.notifications = [];
    }
  }

  /**
   * 保存通知到文件
   */
  saveNotifications() {
    try {
      fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(this.notifications, null, 2), 'utf8');
    } catch (e) {
      console.error('[iMessage] 保存通知失败:', e.message);
    }
  }

  /**
   * 发送 iMessage 通知
   * @param {string} phoneNumber - 接收者手机号
   * @param {string} message - 消息内容
   * @param {string} level - 通知级别
   */
  async send(phoneNumber, message, level = NOTIFICATION_LEVELS.INFO) {
    const notification = {
      id: this.generateId(),
      phoneNumber,
      message,
      level,
      status: 'sending',
      createdAt: new Date().toISOString(),
      sentAt: null,
      error: null
    };

    console.log(`[iMessage] 发送${level}通知到 ${phoneNumber}: ${message}`);

    // 使用 macOS osascript 发送 iMessage
    const script = `
      tell application "Messages"
        set targetBuddy to "${phoneNumber}"
        send "${message}" to buddy targetBuddy of (service 1 whose service type is iMessage)
      end tell
    `;

    return new Promise((resolve, reject) => {
      exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
        if (error) {
          notification.status = 'failed';
          notification.error = error.message;
          console.error('[iMessage] 发送失败:', error.message);
        } else {
          notification.status = 'sent';
          notification.sentAt = new Date().toISOString();
          console.log('[iMessage] 发送成功');
        }

        // 保存通知记录
        this.notifications.unshift(notification);
        if (this.notifications.length > this.maxNotifications) {
          this.notifications.pop();
        }
        this.saveNotifications();

        resolve({
          success: notification.status === 'sent',
          notification
        });
      });
    });
  }

  /**
   * 发送任务通知
   */
  async sendTaskNotification(assignee, taskTitle, taskStatus, taskUrl) {
    const message = `【BCE 任务通知】\n任务：${taskTitle}\n状态：${taskStatus}\n请及时处理：${taskUrl}`;
    
    // 根据执行者查找手机号（需要配置）
    const phoneMap = {
      '匠心': '+86-138-0000-0001',
      '司库': '+86-138-0000-0002',
      '磐石': '+86-138-0000-0003',
      '执矩': '+86-138-0000-0004'
    };

    const phoneNumber = phoneMap[assignee];
    if (!phoneNumber) {
      console.warn('[iMessage] 未找到执行者手机号:', assignee);
      return {
        success: false,
        error: `未找到执行者 ${assignee} 的手机号`
      };
    }

    return await this.send(phoneNumber, message, NOTIFICATION_LEVELS.TASK);
  }

  /**
   * 发送告警通知
   */
  async sendAlert(level, alertType, message) {
    // 告警发送给管理员
    const adminPhones = ['+86-138-0000-0001']; // 磊哥/天枢
    
    const alertMessage = `【BCE 告警】\n级别：${level}\n类型：${alertType}\n内容：${message}`;
    
    const results = [];
    for (const phone of adminPhones) {
      const result = await this.send(phone, alertMessage, level);
      results.push(result);
    }

    return {
      success: results.every(r => r.success),
      results
    };
  }

  /**
   * 获取通知历史
   */
  getHistory(limit = 20, level = null) {
    let notifications = this.notifications;
    
    if (level) {
      notifications = notifications.filter(n => n.level === level);
    }
    
    return notifications.slice(0, limit);
  }

  /**
   * 生成唯一 ID
   */
  generateId() {
    return `imsg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const total = this.notifications.length;
    const sent = this.notifications.filter(n => n.status === 'sent').length;
    const failed = this.notifications.filter(n => n.status === 'failed').length;
    
    const byLevel = {};
    Object.values(NOTIFICATION_LEVELS).forEach(level => {
      byLevel[level] = this.notifications.filter(n => n.level === level).length;
    });

    return {
      total,
      sent,
      failed,
      successRate: total > 0 ? ((sent / total) * 100).toFixed(2) : 100,
      byLevel
    };
  }
}

// 创建单例
const iMessageService = new IMessageService();

module.exports = {
  iMessageService,
  IMessageService,
  NOTIFICATION_LEVELS
};
