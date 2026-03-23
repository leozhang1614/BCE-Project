/**
 * BCE v3.4 - 进度管理服务
 * 功能：强制进度反馈、定时检查、预警升级
 */

const fs = require('fs');
const path = require('path');
const notificationService = require('./notification-service');

const DATA_FILE = path.join(__dirname, '../../runtime/bce-data.json');

// 配置常量（v3.4.1 弹性确认版）
const CONFIG = {
  // ===== 任务确认规则（弹性机制）=====
  CONFIRM_STANDARD_TIME: 30,       // 标准确认时间：30 分钟
  CONFIRM_AUTO_EXTENSIONS: {       // 自主延期（无需审批）
    'meeting': 60,                 // 会议中：+1 小时
    'deepWork': 120,               // 专注中：+2 小时
    'later': 30                    // 稍后：+30 分钟
  },
  CONFIRM_DAILY_LIMITS: {
    'deepWork': 1                  // 专注中：限 1 次/天
  },
  CONFIRM_TASK_LIMITS: {
    'later': 1                     // 稍后：限 1 次/任务
  },
  
  // ===== 进度更新间隔（统一 30 分钟）=====
  PROGRESS_UPDATE_INTERVAL: 30,
  
  // ===== 预警升级时间（统一标准）=====
  ALERT_EXECUTOR: 30,    // 30 分钟未更新 → 提醒执行者
  ALERT_MANAGER: 60,     // 60 分钟未更新 → 通知管理者
  ALERT_CEO: 120,        // 120 分钟未更新 → 上报 CEO
  
  // 标准化汇报间隔（分钟）
  REPORT_INTERVAL: 90,   // 1.5 小时
  
  // 汇报时间表
  REPORT_SCHEDULE: [
    { time: '09:00', type: 'morning', label: '早间' },
    { time: '10:30', type: 'regular', label: '定时' },
    { time: '12:00', type: 'noon', label: '午间' },
    { time: '13:30', type: 'regular', label: '定时' },
    { time: '15:00', type: 'regular', label: '定时' },
    { time: '16:30', type: 'regular', label: '定时' },
    { time: '18:00', type: 'evening', label: '晚间' },
    { time: '19:30', type: 'final', label: '最终' },
  ]
};

/**
 * 进度管理状态
 */
class ProgressManager {
  constructor() {
    this.timers = new Map();
    this.lastCheck = new Map();
  }

  /**
   * 初始化进度追踪
   */
  initProgressTracking(task) {
    if (!task) return;
    
    // 初始化进度字段
    if (task.status === 'executing') {
      if (typeof task.progressPercent === 'undefined') {
        task.progressPercent = 0;
      }
      if (!task.progressUpdatedAt) {
        task.progressUpdatedAt = new Date().toISOString();
      }
      if (!task.completedWork) {
        task.completedWork = '';
      }
      if (!task.remainingWork) {
        task.remainingWork = task.description || '待明确';
      }
      if (!task.estimatedComplete) {
        task.estimatedComplete = task.dueDate || null;
      }
      if (!task.blockers) {
        task.blockers = [];
      }
      if (!task.missedUpdates) {
        task.missedUpdates = 0;
      }
      if (!task.progressAlerted) {
        task.progressAlerted = false;
      }
      if (!task.managerAlerted) {
        task.managerAlerted = false;
      }
      if (!task.ceoAlerted) {
        task.ceoAlerted = false;
      }
      
      console.log(`[进度管理] 初始化任务 ${task.id} 的进度追踪`);
    }
  }

  /**
   * 获取任务的预警阈值（基于优先级）
   */
  getAlertThresholds(task) {
    const priority = task.priority || 'P1';
    
    switch (priority) {
      case 'P0':
        return {
          executor: CONFIG.ALERT_P0_EXECUTOR,
          manager: CONFIG.ALERT_P0_MANAGER,
          ceo: CONFIG.ALERT_P0_CEO
        };
      case 'P1':
        return {
          executor: CONFIG.ALERT_P1_EXECUTOR,
          manager: CONFIG.ALERT_P1_MANAGER,
          ceo: CONFIG.ALERT_P1_CEO
        };
      case 'P2':
        return {
          executor: CONFIG.ALERT_P2_EXECUTOR,
          manager: CONFIG.ALERT_P2_MANAGER,
          ceo: CONFIG.ALERT_P2_CEO
        };
      default:
        return {
          executor: CONFIG.ALERT_P1_EXECUTOR,
          manager: CONFIG.ALERT_P1_MANAGER,
          ceo: CONFIG.ALERT_P1_CEO
        };
    }
  }

  /**
   * 检查所有执行中任务的进度
   */
  checkProgressUpdates(tasks) {
    const now = new Date();
    const alerts = [];

    tasks.forEach(task => {
      if (task.status !== 'executing') return;
      
      // ===== 深度工作保护期检查 =====
      if (task.deepWorkMode && CONFIG.DEEP_WORK_ENABLED) {
        const deepWorkEnd = new Date(task.deepWorkEndAt);
        if (now < deepWorkEnd) {
          // 深度工作保护期内，不发送预警
          console.log(`[深度工作] 任务 ${task.id} 处于保护期，跳过预警`);
          return;
        }
        // 深度工作结束，检查是否提交了日志
        if (CONFIG.DEEP_WORK_REQUIRE_LOG && !task.deepWorkLogSubmitted) {
          alerts.push({
            type: 'deep_work_log_required',
            task,
            message: '深度工作结束，请提交工作日志'
          });
        }
      }
      
      const lastUpdate = new Date(task.progressUpdatedAt);
      const minutesSinceUpdate = (now - lastUpdate) / 1000 / 60;
      
      // 获取基于优先级的预警阈值
      const thresholds = this.getAlertThresholds(task);
      
      // 超过阈值未更新（根据优先级）
      if (minutesSinceUpdate > thresholds.executor && !task.progressAlerted) {
        alerts.push({
          type: 'executor',
          task,
          minutes: minutesSinceUpdate,
          priority: task.priority
        });
        task.progressAlerted = true;
        task.missedUpdates += 1;
      }
      
      if (minutesSinceUpdate > thresholds.manager && !task.managerAlerted) {
        alerts.push({
          type: 'manager',
          task,
          minutes: minutesSinceUpdate,
          priority: task.priority
        });
        task.managerAlerted = true;
      }
      
      if (minutesSinceUpdate > thresholds.ceo && !task.ceoAlerted) {
        alerts.push({
          type: 'ceo',
          task,
          minutes: minutesSinceUpdate,
          priority: task.priority
        });
        task.ceoAlerted = true;
        task.riskLevel = 'high';
      }
    });

    return alerts;
  }

  /**
   * 发送进度更新提醒
   */
  async sendProgressAlert(task, alertType) {
    const executor = task.assignee;
    const manager = task.manager || task.creator;
    
    let message = '';
    
    switch (alertType) {
      case 'executor':
        message = `
⏰ 进度更新提醒

任务：${task.title}
当前进度：${task.progressPercent}%
最后更新：${task.progressUpdatedAt}

⚠️ 已超过 30 分钟未更新进度，请立即更新！

[立即更新] [稍后提醒]
        `.trim();
        
        await notificationService.notify(
          executor,
          '系统',
          'progress_reminder',
          message,
          task.id,
          `task:${task.id}`
        );
        break;
        
      case 'manager':
        message = `
🔔 任务进度预警

任务：${task.title}
执行者：${executor}
当前进度：${task.progressPercent}%
未更新时长：60 分钟

⚠️ 执行者已超过 1 小时未更新进度，建议介入了解情况！

[查看详情] [联系执行者] [重新分配]
        `.trim();
        
        await notificationService.notify(
          manager,
          '系统',
          'progress_warning',
          message,
          task.id,
          `task:${task.id}`
        );
        break;
        
      case 'ceo':
        message = `
🚨 任务严重滞后报告

任务：${task.title}
执行者：${executor}
管理者：${manager}
当前进度：${task.progressPercent}%
未更新时长：120 分钟
风险等级：高

⚠️ 任务已严重滞后，需要 CEO 决策！

建议措施：
1. 重新分配任务
2. 增加人手协助
3. 调整截止时间

[立即处理] [查看详情]
        `.trim();
        
        await notificationService.notify(
          '天枢',
          '系统',
          'progress_critical',
          message,
          task.id,
          `task:${task.id}`
        );
        break;
    }
    
    console.log(`[进度提醒] 已发送${alertType}提醒，任务：${task.id}`);
  }

  /**
   * 构建标准化汇报模板
   */
  buildReportTemplate(task, reportType) {
    return `
📋 ${reportType}进度汇报

任务：${task.title}
负责人：${task.assignee}
截止时间：${task.dueDate ? this.formatDate(task.dueDate) : '未设置'}
当前状态：${this.getStatusEmoji(task.status)} ${task.status}

━━━━━━━━━━━━━━━━━━━━

✅ 完成百分比：${task.progressPercent || 0}%

✅ 已完成：
${this.formatWorkList(task.completedWork)}

✅ 剩余工作：
${this.formatWorkList(task.remainingWork)}

✅ 预计完成：${task.estimatedComplete ? this.formatDate(task.estimatedComplete) : '待评估'}

✅ 风险/阻塞：${task.blockers && task.blockers.length > 0 ? task.blockers.join(', ') : '无'}

━━━━━━━━━━━━━━━━━━━━

请在 30 分钟内回复更新！
[立即更新] [请求帮助]
    `.trim();
  }

  /**
   * 格式化工作列表
   */
  formatWorkList(work) {
    if (!work) return '   - 待明确';
    const items = work.split(/[,，\n]/).filter(w => w.trim());
    if (items.length === 0) return '   - 待明确';
    return items.map(w => `   - ${w.trim()}`).join('\n');
  }

  /**
   * 格式化日期
   */
  formatDate(dateStr) {
    if (!dateStr) return '未设置';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * 获取状态表情
   */
  getStatusEmoji(status) {
    const emojis = {
      'pending': '⏳',
      'assigned': '📋',
      'executing': '🚀',
      'reviewing': '✅',
      'accepted': '✓',
      'completed': '✅',
      'cancelled': '❌'
    };
    return emojis[status] || '📌';
  }

  /**
   * 发送标准化汇报
   */
  async sendProgressReport(task, reportType) {
    const executor = task.assignee;
    const message = this.buildReportTemplate(task, reportType);
    
    await notificationService.notify(
      executor,
      '系统',
      'progress_report',
      message,
      task.id,
      `task:${task.id}`
    );
    
    console.log(`[进度汇报] 已发送${reportType}汇报提醒，任务：${task.id}`);
  }

  /**
   * 计算绩效分数
   */
  calculatePerformance(task) {
    let score = 0;
    
    // 1. 准时性（基础分）
    if (task.completedAt && task.dueDate) {
      const completed = new Date(task.completedAt);
      const deadline = new Date(task.dueDate);
      
      if (completed <= deadline) {
        score += 10;  // 准时完成
        const hoursEarly = (deadline - completed) / 1000 / 3600;
        if (hoursEarly >= 2) {
          score += 10;  // 提前 2 小时以上
        }
      } else {
        score -= 10;  // 延期完成
        const hoursOverdue = Math.floor((completed - deadline) / 1000 / 3600);
        score -= hoursOverdue * 5;  // 每延期 1 小时 -5 分
      }
    }
    
    // 2. 进度汇报（过程分）
    const progressUpdates = task.progressHistory ? task.progressHistory.length : 0;
    score += progressUpdates * 2;  // 每次主动汇报 +2 分
    score -= (task.missedUpdates || 0) * 5;  // 每次未汇报 -5 分
    
    // 3. 任务调整（影响分）
    if (task.reassigned) {
      score -= 15;  // 被重新分配 -15 分
    }
    
    // 4. 风险标记（风险分）
    if (task.riskLevel === 'high') {
      score -= 10;
    }
    
    // 5. 质量评分（验收分）
    if (task.qualityScore) {
      score += (task.qualityScore - 3) * 5;  // 5 分制，高于 3 分加分
    }
    
    return score;
  }

  /**
   * 获取绩效等级
   */
  getPerformanceLevel(score) {
    if (score >= 50) return { level: 'S', label: '卓越', bonus: 1.2 };
    if (score >= 30) return { level: 'A', label: '优秀', bonus: 1.1 };
    if (score >= 10) return { level: 'B', label: '良好', bonus: 1.0 };
    if (score >= 0) return { level: 'C', label: '需改进', bonus: 0.9 };
    return { level: 'D', label: '不达标', bonus: 0.7 };
  }
}

module.exports = new ProgressManager();
