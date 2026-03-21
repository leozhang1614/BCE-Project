/**
 * 通知服务（v3.2 三通道设计）
 * 主通道：OpenClaw sessions_send（通过 Gateway HTTP API）
 * 备用通道：飞书卡片
 * 可靠通道：文件系统邮箱
 */

const http = require('http');
const retryQueue = require('./retry-queue');
const mailboxService = require('./mailbox-service');

// OpenClaw Gateway 配置
const GATEWAY_HOST = process.env.GATEWAY_HOST || '127.0.0.1';
const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT) || 18789;

class NotificationService {
  /**
   * 通过 Gateway HTTP API 调用 sessions_send
   */
  async sessionsSend(target, message) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        jsonrpc: '2.0',
        method: 'sessions.send',
        params: {
          target,
          message
        },
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
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.error) {
              reject(new Error(result.error.message || 'sessions_send 失败'));
            } else {
              resolve(result.result);
            }
          } catch {
            resolve(data);
          }
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Gateway 超时')); });
      req.write(payload);
      req.end();
    });
  }

  /**
   * 三通道通知
   */
  async notify(agent, from, type, content, taskId, sessionKey = null) {
    const notification = { agent, from, type, content, taskId, sessionKey };
    
    // 1. 主通道：OpenClaw sessions_send（通过 Gateway）
    try {
      const target = sessionKey || `agent-${agent}`;
      await this.sessionsSend(target, content);
      console.log(`[通知] sessions_send 推送给 ${agent} 成功`);
    } catch (error) {
      console.log(`[通知] sessions_send 失败，加入重试队列：${error.message}`);
      retryQueue.add(notification);
    }

    // 2. 备用通道：飞书卡片
    try {
      await this.sendFeishuCard(agent, from, type, content, taskId);
    } catch (error) {
      console.error(`[通知] 飞书卡片发送失败：${error.message}`);
    }

    // 3. 可靠通道：文件系统邮箱
    try {
      await mailboxService.send(agent, from, type, content, taskId, sessionKey);
    } catch (error) {
      console.error(`[通知] 邮箱存储失败：${error.message}`);
    }
  }

  /**
   * 发送飞书卡片通知
   */
  async sendFeishuCard(agent, from, type, content, taskId) {
    const feishuNotify = require('../api/feishu-notify');
    const chatId = process.env.FEISHU_CHAT_ID;
    
    if (!chatId) {
      console.warn('[通知] 未配置 FEISHU_CHAT_ID，跳过飞书卡片');
      return;
    }
    
    const colorMap = {
      task_assigned: 'blue',
      task_confirmed: 'green',
      task_transferred: 'orange',
      task_completed: 'green',
      transfer_success: 'green',
      transfer_failed: 'red',
      unread_summary: 'blue'
    };
    
    const titleMap = {
      task_assigned: '📋 新任务分配',
      task_confirmed: '✅ 任务已确认',
      task_transferred: '🔄 任务已转交',
      task_completed: '✅ 任务已完成',
      transfer_success: '✅ 转交成功',
      transfer_failed: '❌ 转交失败',
      unread_summary: '📬 未读消息提醒'
    };
    
    const card = {
      config: { wide_screen_mode: true },
      header: {
        template: colorMap[type] || 'blue',
        title: { content: titleMap[type] || '📢 通知', tag: 'plain_text' }
      },
      elements: [
        {
          tag: "div",
          text: { content: content.replace(/\n/g, '\n'), tag: "lark_md" }
        },
        {
          tag: "note",
          elements: [
            { tag: "plain_text", content: `来自：${from} | ${new Date().toLocaleString('zh-CN')}` }
          ]
        }
      ]
    };
    
    try {
      const { sendInteractiveCard } = feishuNotify;
      if (typeof sendInteractiveCard === 'function') {
        await sendInteractiveCard(chatId, card);
      } else {
        // 回退到普通消息发送
        const { sendFeishuMessage } = feishuNotify;
        await sendFeishuMessage(chatId, `${titleMap[type] || '📢'}\n${content}`);
      }
      console.log(`[飞书卡片] 发送成功：${titleMap[type]}`);
    } catch (error) {
      console.error(`[飞书卡片] 发送失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 任务分配通知
   */
  async notifyTaskAssigned(task, assignee) {
    await this.notify(
      assignee,
      task.creator || 'system',
      'task_assigned',
      `📋 新任务分配：${task.title}\n优先级：${task.priority || '无'}\n截止时间：${task.deadline || '无'}`,
      task.id,
      `task:${task.id}`
    );
  }

  /**
   * 任务确认通知（通知上一节点）
   */
  async notifyTaskConfirmed(task, confirmUser) {
    const previousHandler = this.getPreviousHandler(task);
    
    await this.notify(
      previousHandler,
      confirmUser,
      'task_confirmed',
      `✅ ${confirmUser} 已确认接收任务：${task.title}`,
      task.id,
      `task:${task.id}`
    );
  }

  /**
   * 任务转交通知
   */
  async notifyTaskTransfer(task, from, to) {
    await this.notify(
      to,
      from,
      'task_transferred',
      `🔄 任务已转交：${task.title}\n转交人：${from}`,
      task.id,
      `task:${task.id}`
    );
    await this.notify(
      from,
      'system',
      'transfer_success',
      `✅ 任务已转交给 ${to}`,
      task.id,
      `task:${task.id}`
    );
  }

  /**
   * 获取任务的上一个处理人（动态计算）
   */
  getPreviousHandler(task) {
    if (task.transferHistory && task.transferHistory.length > 0) {
      const last = task.transferHistory[task.transferHistory.length - 1];
      return last.from;
    }
    return task.creator;
  }

  /**
   * 离线汇总通知
   */
  async notifyUnreadSummary(agent, unreadCount) {
    if (unreadCount > 0) {
      await this.notify(
        agent,
        'system',
        'unread_summary',
        `📬 你有 ${unreadCount} 条未读任务，请查看邮箱`,
        null,
        null
      );
    }
  }
}

module.exports = new NotificationService();
