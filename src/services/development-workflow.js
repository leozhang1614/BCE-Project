/**
 * BCE 开发任务标准工作流
 * 
 * 流程：开发 → 验收 → 审核 → (不通过则回退到开发)
 * 
 * 角色：
 * - 开发者：负责功能开发
 * - 项目负责人：负责验收
 * - 执矩：负责代码合规审核
 * 
 * @author 匠心 (CTO)
 * @version 1.0.0
 */

const fs = require('fs').promises;
const path = require('path');

// 工作流配置
const WORKFLOW_CONFIG = {
  // 节点定义
  nodes: {
    development: {
      id: 'development',
      name: '开发',
      role: 'developer', // 开发者
      description: '功能实现、自测'
    },
    acceptance: {
      id: 'acceptance',
      name: '验收',
      role: 'project_owner', // 项目负责人
      description: '功能验证、需求符合度'
    },
    audit: {
      id: 'audit',
      name: '审核',
      role: 'zhiju', // 执矩
      description: '代码合规、系统稳定性审核'
    }
  },
  
  // 流转规则
  transitions: {
    // 开发节点可以流转到验收节点
    development: ['acceptance'],
    // 验收节点可以流转到审核节点，也可以回退到开发节点
    acceptance: ['audit', 'development'],
    // 审核节点可以通过（完成），也可以回退到开发节点（重点！）
    audit: ['completed', 'development']
  },
  
  // 审核不通过的处理
  audit_reject: {
    // 回退目标节点（重点是开发节点，不是上一个节点！）
    rollback_to: 'development',
    // 需要重新走的流程
    reflow_path: ['development', 'acceptance', 'audit']
  }
};

// 存储路径
const WORKFLOW_STORE_PATH = path.join(__dirname, '..', 'runtime', 'workflow-store.json');

/**
 * 加载工作流存储
 */
async function loadWorkflowStore() {
  try {
    const raw = await fs.readFile(WORKFLOW_STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return {
      tasks: [],
      updatedAt: '1970-01-01T00:00:00.000Z'
    };
  }
}

/**
 * 保存工作流存储
 */
async function saveWorkflowStore(store) {
  await fs.mkdir(path.dirname(WORKFLOW_STORE_PATH), { recursive: true });
  store.updatedAt = new Date().toISOString();
  await fs.writeFile(WORKFLOW_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  return WORKFLOW_STORE_PATH;
}

/**
 * 创建开发任务
 */
async function createDevelopmentTask(taskData) {
  const store = await loadWorkflowStore();
  
  const task = {
    id: `dev-${Date.now()}`,
    title: taskData.title,
    description: taskData.description,
    developer: taskData.developer, // 开发者
    projectOwner: taskData.projectOwner, // 项目负责人
    auditor: 'zhiju', // 执矩（固定）
    status: 'development', // 初始状态：开发中
    currentRole: 'developer',
    workflow: {
      currentNode: 'development',
      history: [{
        node: 'development',
        operator: taskData.developer,
        timestamp: new Date().toISOString(),
        action: 'start'
      }]
    },
    deliverables: [], // 交付物
    auditComments: [], // 审核意见
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  store.tasks.push(task);
  await saveWorkflowStore(store);
  
  return task;
}

/**
 * 开发完成，提交验收（自动流转到验收节点）
 */
async function submitForAcceptance(taskId, developer, deliverables) {
  const store = await loadWorkflowStore();
  const task = store.tasks.find(t => t.id === taskId);
  
  if (!task) {
    throw new Error('任务不存在');
  }
  
  if (task.workflow.currentNode !== 'development') {
    throw new Error('任务不在开发节点');
  }
  
  // 更新任务状态 - 自动流转到验收节点
  task.status = 'acceptance';
  task.currentRole = 'project_owner';
  task.deliverables = deliverables;
  task.updatedAt = new Date().toISOString();
  
  // 记录工作流历史
  task.workflow.history.push({
    node: 'acceptance',
    from: 'development',
    operator: developer,
    timestamp: new Date().toISOString(),
    action: 'submit_acceptance',
    deliverables: deliverables
  });
  
  task.workflow.currentNode = 'acceptance';
  
  await saveWorkflowStore(store);
  
  // 触发 BCE 规则引擎 - 自动通知项目负责人
  try {
    const { onTaskNodeTransition } = require('./transfer-rules');
    await onTaskNodeTransition(taskId, 'development', 'acceptance', developer);
  } catch (error) {
    console.log('[工作流] 规则引擎集成可选，不影响提交流程');
  }
  
  return task;
}

/**
 * 验收通过，提交审核
 */
async function submitForAudit(taskId, projectOwner, acceptanceReport) {
  const store = await loadWorkflowStore();
  const task = store.tasks.find(t => t.id === taskId);
  
  if (!task) {
    throw new Error('任务不存在');
  }
  
  if (task.workflow.currentNode !== 'acceptance') {
    throw new Error('任务不在验收节点');
  }
  
  // 更新任务状态
  task.status = 'audit';
  task.currentRole = 'zhiju';
  task.acceptanceReport = acceptanceReport;
  task.updatedAt = new Date().toISOString();
  
  // 记录工作流历史
  task.workflow.history.push({
    node: 'audit',
    from: 'acceptance',
    operator: projectOwner,
    timestamp: new Date().toISOString(),
    action: 'submit_audit',
    acceptanceReport: acceptanceReport
  });
  
  task.workflow.currentNode = 'audit';
  
  await saveWorkflowStore(store);
  
  return task;
}

/**
 * 审核通过，任务完成
 */
async function auditPass(taskId, auditor, auditComments) {
  const store = await loadWorkflowStore();
  const task = store.tasks.find(t => t.id === taskId);
  
  if (!task) {
    throw new Error('任务不存在');
  }
  
  if (task.workflow.currentNode !== 'audit') {
    throw new Error('任务不在审核节点');
  }
  
  // 更新任务状态
  task.status = 'completed';
  task.currentRole = null;
  task.auditComments = auditComments;
  task.completedAt = new Date().toISOString();
  task.updatedAt = new Date().toISOString();
  
  // 记录工作流历史
  task.workflow.history.push({
    node: 'completed',
    from: 'audit',
    operator: auditor,
    timestamp: new Date().toISOString(),
    action: 'audit_pass',
    auditComments: auditComments
  });
  
  task.workflow.currentNode = 'completed';
  
  await saveWorkflowStore(store);
  
  return task;
}

/**
 * 审核不通过，回退到开发节点（重点！）
 */
async function auditReject(taskId, auditor, rejectReason) {
  const store = await loadWorkflowStore();
  const task = store.tasks.find(t => t.id === taskId);
  
  if (!task) {
    throw new Error('任务不存在');
  }
  
  if (task.workflow.currentNode !== 'audit') {
    throw new Error('任务不在审核节点');
  }
  
  // 更新任务状态 - 回退到开发节点
  task.status = 'development';
  task.currentRole = 'developer';
  task.updatedAt = new Date().toISOString();
  
  // 记录审核意见
  task.auditComments.push({
    type: 'reject',
    operator: auditor,
    timestamp: new Date().toISOString(),
    reason: rejectReason,
    rollbackTo: 'development' // 明确记录回退到开发节点
  });
  
  // 记录工作流历史 - 回退到开发节点
  task.workflow.history.push({
    node: 'development',
    from: 'audit',
    operator: auditor,
    timestamp: new Date().toISOString(),
    action: 'audit_reject',
    reason: rejectReason,
    rollbackTo: 'development', // 重点：回退到开发节点
    reflowRequired: true // 需要重新走完整流程
  });
  
  task.workflow.currentNode = 'development';
  
  await saveWorkflowStore(store);
  
  return task;
}

/**
 * 获取任务工作流状态
 */
async function getWorkflowStatus(taskId) {
  const store = await loadWorkflowStore();
  const task = store.tasks.find(t => t.id === taskId);
  
  if (!task) {
    throw new Error('任务不存在');
  }
  
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    currentNode: task.workflow.currentNode,
    currentRole: task.currentRole,
    developer: task.developer,
    projectOwner: task.projectOwner,
    auditor: task.auditor,
    history: task.workflow.history,
    deliverables: task.deliverables,
    auditComments: task.auditComments,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.completedAt
  };
}

/**
 * 获取所有开发任务
 */
async function getAllDevelopmentTasks() {
  const store = await loadWorkflowStore();
  return store.tasks;
}

module.exports = {
  WORKFLOW_CONFIG,
  createDevelopmentTask,
  submitForAcceptance,
  submitForAudit,
  auditPass,
  auditReject, // 审核不通过回退到开发节点
  getWorkflowStatus,
  getAllDevelopmentTasks
};
