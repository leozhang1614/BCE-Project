/**
 * BCE v3.4 - 管理者权限服务
 * 功能：任务重新分配、优先级调整、强制汇报、风险标记、上报 CEO
 */

const notificationService = require('./notification-service');
const progressService = require('./progress-service');

/**
 * 角色权限定义
 */
const ROLES = {
  executor: {
    name: '执行者',
    permissions: [
      'view_own_tasks',
      'update_own_progress',
      'submit_task',
      'request_help'
    ]
  },
  
  manager: {
    name: '管理者',
    permissions: [
      // 查看权限
      'view_all_project_tasks',
      'view_progress_dashboard',
      'view_performance',
      
      // 调整权限
      'reassign_tasks',
      'adjust_priority',
      'adjust_deadline',
      'split_merge_tasks',
      'pause_resume_tasks',
      
      // 干预权限
      'demand_update',
      'mark_risk',
      'escalate_to_ceo',
      'initiate_review'
    ]
  },
  
  ceo: {
    name: 'CEO',
    permissions: ['all']
  },
  
  reviewer: {
    name: '验收人',
    permissions: [
      'view_assigned_tasks',
      'submit_acceptance'
    ]
  },
  
  auditor: {
    name: '审核人',
    permissions: [
      'view_tasks_for_audit',
      'audit_pass',
      'audit_reject'
    ]
  }
};

/**
 * 管理者服务类
 */
class ManagerService {
  /**
   * 重新分配任务
   */
  async reassignTask(task, newAssignee, reason, handover, manager) {
    const oldAssignee = task.assignee;
    
    // 更新任务信息
    task.assignee = newAssignee;
    task.reassigned = true;
    task.reassignedAt = new Date().toISOString();
    task.reassignedBy = manager;
    task.reassignReason = reason;
    task.handover = handover;
    task.updatedAt = new Date().toISOString();
    
    // 记录状态历史
    if (!task.stateHistory) task.stateHistory = [];
    task.stateHistory.push({
      type: 'reassign',
      from: oldAssignee,
      to: newAssignee,
      reason,
      operator: manager,
      timestamp: new Date().toISOString()
    });
    
    // 绩效影响
    task.performanceImpact = -15;
    
    // 通知相关人员
    await this.notifyReassignment(task, oldAssignee, newAssignee, reason, handover);
    
    console.log(`[管理者权限] 任务 ${task.id} 已从 ${oldAssignee} 重新分配给 ${newAssignee}`);
    
    return {
      success: true,
      taskId: task.id,
      oldAssignee,
      newAssignee,
      performanceImpact: -15
    };
  }

  /**
   * 调整优先级
   */
  async adjustPriority(task, priority, reason, manager) {
    const oldPriority = task.priority;
    task.priority = priority;
    task.priorityChangedAt = new Date().toISOString();
    task.priorityChangedBy = manager;
    task.priorityReason = reason;
    task.updatedAt = new Date().toISOString();
    
    // P0 任务需要特殊处理
    if (priority === 'P0') {
      task.alertThreshold = 30;  // P0 任务 30 分钟未更新即上报
    }
    
    // 记录历史
    if (!task.stateHistory) task.stateHistory = [];
    task.stateHistory.push({
      type: 'priority_change',
      from: oldPriority,
      to: priority,
      reason,
      operator: manager,
      timestamp: new Date().toISOString()
    });
    
    // 通知执行者
    await notificationService.notify(
      task.assignee,
      manager,
      'priority_changed',
      `🔴 任务优先级调整\n\n任务：${task.title}\n原优先级：${oldPriority}\n新优先级：${priority}\n原因：${reason}\n\n请优先处理此任务！`,
      task.id,
      `task:${task.id}`
    );
    
    console.log(`[管理者权限] 任务 ${task.id} 优先级从 ${oldPriority} 调整为 ${priority}`);
    
    return {
      success: true,
      taskId: task.id,
      oldPriority,
      newPriority: priority
    };
  }

  /**
   * 调整截止时间
   */
  async adjustDeadline(task, deadline, reason, manager) {
    const oldDeadline = task.dueDate;
    task.dueDate = deadline;
    task.deadlineChangedAt = new Date().toISOString();
    task.deadlineChangedBy = manager;
    task.deadlineReason = reason;
    task.updatedAt = new Date().toISOString();
    
    // 重新计算进度要求
    if (task.progressPercent) {
      const remainingDays = (new Date(deadline) - new Date()) / 1000 / 3600 / 24;
      const remainingWork = 100 - task.progressPercent;
      task.requiredDailyProgress = remainingWork / Math.max(remainingDays, 1);
    }
    
    // 记录历史
    if (!task.stateHistory) task.stateHistory = [];
    task.stateHistory.push({
      type: 'deadline_change',
      from: oldDeadline,
      to: deadline,
      reason,
      operator: manager,
      timestamp: new Date().toISOString()
    });
    
    // 通知执行者
    await notificationService.notify(
      task.assignee,
      manager,
      'deadline_changed',
      `📅 任务截止时间调整\n\n任务：${task.title}\n原截止时间：${oldDeadline}\n新截止时间：${deadline}\n原因：${reason}\n\n请调整工作计划！`,
      task.id,
      `task:${task.id}`
    );
    
    console.log(`[管理者权限] 任务 ${task.id} 截止时间从 ${oldDeadline} 调整为 ${deadline}`);
    
    return {
      success: true,
      taskId: task.id,
      oldDeadline,
      newDeadline: deadline
    };
  }

  /**
   * 强制要求汇报
   */
  async demandUpdate(task, urgency, message, manager) {
    const executor = task.assignee;
    
    let notifyMessage = `
🔔 强制进度更新要求

任务：${task.title}
管理者：${manager}
紧急程度：${this.getUrgencyLabel(urgency)}

${message}

⚠️ 请在 30 分钟内更新进度！
    `.trim();
    
    // 根据紧急程度选择通知方式
    if (urgency === 'high') {
      notifyMessage += '\n\n🚨 高紧急度 - 请立即处理！';
      // 高紧急度：飞书 + 短信 + 电话
      await notificationService.notify(
        executor,
        manager,
        'demand_update_high',
        notifyMessage,
        task.id,
        `task:${task.id}`
      );
    } else {
      // 普通紧急度：飞书通知
      await notificationService.notify(
        executor,
        manager,
        'demand_update',
        notifyMessage,
        task.id,
        `task:${task.id}`
      );
    }
    
    // 记录要求历史
    if (!task.demandHistory) task.demandHistory = [];
    task.demandHistory.push({
      urgency,
      message,
      manager,
      timestamp: new Date().toISOString()
    });
    
    console.log(`[管理者权限] 强制要求任务 ${task.id} 更新进度，紧急程度：${urgency}`);
    
    return {
      success: true,
      taskId: task.id,
      notified: executor
    };
  }

  /**
   * 标记风险任务
   */
  async markRisk(task, level, reason, action, manager) {
    task.riskLevel = level;
    task.riskMarkedAt = new Date().toISOString();
    task.riskMarkedBy = manager;
    task.riskReason = reason;
    task.riskAction = action;
    task.updatedAt = new Date().toISOString();
    
    // 记录历史
    if (!task.stateHistory) task.stateHistory = [];
    task.stateHistory.push({
      type: 'risk_mark',
      level,
      reason,
      action,
      operator: manager,
      timestamp: new Date().toISOString()
    });
    
    // 通知 CEO（如果是高风险）
    if (level === 'high') {
      await notificationService.notify(
        '天枢',
        manager,
        'task_risk_high',
        `🚨 高风险任务标记\n\n任务：${task.title}\n执行者：${task.assignee}\n风险等级：高\n原因：${reason}\n已采取措施：${action}`,
        task.id,
        `task:${task.id}`
      );
    }
    
    console.log(`[管理者权限] 任务 ${task.id} 标记为${level}风险`);
    
    return {
      success: true,
      taskId: task.id,
      riskLevel: level
    };
  }

  /**
   * 上报 CEO
   */
  async escalateToCEO(task, reason, suggestions, impact, manager) {
    const report = {
      taskId: task.id,
      taskTitle: task.title,
      assignee: task.assignee,
      manager: manager,
      currentProgress: task.progressPercent,
      status: task.status,
      dueDate: task.dueDate,
      reason,
      suggestions,
      impact,
      timestamp: new Date().toISOString()
    };
    
    const message = `
🚨 任务上报 CEO 决策

任务：${task.title}
执行者：${task.assignee}
管理者：${manager}
当前进度：${task.progressPercent}%
状态：${task.status}
截止时间：${task.dueDate}

━━━━━━━━━━━━━━━━━━━━

📋 问题描述：
${reason}

💡 建议方案：
${suggestions.map(s => `   • ${s}`).join('\n')}

⚠️ 业务影响：
${impact}

━━━━━━━━━━━━━━━━━━━━

请 CEO 决策！
[批准方案 1] [批准方案 2] [要求补充信息]
    `.trim();
    
    await notificationService.notify(
      '天枢',
      manager,
      'escalation_to_ceo',
      message,
      task.id,
      `task:${task.id}`
    );
    
    // 记录上报历史
    if (!task.escalationHistory) task.escalationHistory = [];
    task.escalationHistory.push(report);
    task.escalatedAt = new Date().toISOString();
    task.escalated = true;
    
    console.log(`[管理者权限] 任务 ${task.id} 已上报 CEO`);
    
    return {
      success: true,
      taskId: task.id,
      escalated: true
    };
  }

  /**
   * 生成管理仪表盘数据
   */
  generateDashboard(tasks, projectId) {
    const projectTasks = projectId 
      ? tasks.filter(t => t.projectId === projectId)
      : tasks.filter(t => t.status === 'executing');
    
    const overview = {
      total: projectTasks.length,
      inProgress: projectTasks.filter(t => t.status === 'executing').length,
      atRisk: projectTasks.filter(t => t.riskLevel === 'high' || t.riskLevel === 'medium').length,
      overdue: projectTasks.filter(t => {
        if (!t.dueDate) return false;
        return new Date(t.dueDate) < new Date() && t.status !== 'completed';
      }).length,
      averageProgress: projectTasks.reduce((sum, t) => sum + (t.progressPercent || 0), 0) / projectTasks.length
    };
    
    const taskList = projectTasks.map(task => ({
      id: task.id,
      title: task.title,
      assignee: task.assignee,
      progressPercent: task.progressPercent || 0,
      status: task.status,
      riskLevel: task.riskLevel || 'normal',
      dueDate: task.dueDate,
      lastUpdate: task.progressUpdatedAt,
      completedWork: task.completedWork,
      remainingWork: task.remainingWork
    }));
    
    // 生成建议操作
    const suggestions = [];
    if (overview.atRisk > 0) {
      suggestions.push({
        type: 'review',
        label: `发起进度审查会议（${overview.atRisk}个风险任务）`,
        priority: 'high'
      });
    }
    if (overview.overdue > 0) {
      suggestions.push({
        type: 'reassign',
        label: `重新分配延期任务（${overview.overdue}个）`,
        priority: 'high'
      });
    }
    if (overview.averageProgress < 50 && overview.inProgress > 0) {
      suggestions.push({
        type: 'escalate',
        label: `上报 CEO（整体进度滞后）`,
        priority: 'medium'
      });
    }
    
    return {
      overview,
      tasks: taskList,
      suggestions,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * 通知任务重新分配
   */
  async notifyReassignment(task, oldAssignee, newAssignee, reason, handover) {
    // 通知原执行者
    await notificationService.notify(
      oldAssignee,
      '系统',
      'task_reassigned_from',
      `📋 任务重新分配通知\n\n任务：${task.title}\n原因：${reason}\n工作交接：${handover}\n\n绩效影响：-15 分`,
      task.id,
      `task:${task.id}`
    );
    
    // 通知新执行者
    await notificationService.notify(
      newAssignee,
      '系统',
      'task_reassigned_to',
      `📋 新任务分配\n\n任务：${task.title}\n描述：${task.description}\n优先级：${task.priority}\n截止时间：${task.dueDate}\n\n工作交接：${handover}\n\n请立即确认并开始执行！`,
      task.id,
      `task:${task.id}`
    );
    
    // 通知管理者/CEO
    await notificationService.notify(
      '天枢',
      '系统',
      'task_reassigned',
      `📋 任务重新分配\n\n任务：${task.title}\n从：${oldAssignee}\n到：${newAssignee}\n原因：${reason}`,
      task.id,
      `task:${task.id}`
    );
  }

  /**
   * 获取紧急程度标签
   */
  getUrgencyLabel(urgency) {
    const labels = {
      'low': '🟡 低',
      'medium': '🟠 中',
      'high': '🔴 高'
    };
    return labels[urgency] || '🟡 低';
  }
}

module.exports = new ManagerService();
