/**
 * BCE 自定义工作流服务
 * 支持发起人自定义流程
 * 
 * @author 匠心 (CTO)
 * @version 1.0.0
 */

const fs = require('fs').promises;
const path = require('path');

// 存储路径
const WORKFLOW_STORE_PATH = path.join(__dirname, '..', 'runtime', 'custom-workflow-store.json');

/**
 * 加载存储
 */
async function loadStore() {
  try {
    const raw = await fs.readFile(WORKFLOW_STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return {
      workflowTemplates: [],
      tasks: [],
      updatedAt: '1970-01-01T00:00:00.000Z'
    };
  }
}

/**
 * 保存存储
 */
async function saveStore(store) {
  await fs.mkdir(path.dirname(WORKFLOW_STORE_PATH), { recursive: true });
  store.updatedAt = new Date().toISOString();
  await fs.writeFile(WORKFLOW_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  return WORKFLOW_STORE_PATH;
}

/**
 * 创建工作流模板（发起人定义流程）
 */
async function createWorkflowTemplate(templateData) {
  const store = await loadStore();
  
  const template = {
    id: `wf-template-${Date.now()}`,
    name: templateData.name, // 流程名称
    description: templateData.description, // 流程描述
    creator: templateData.creator, // 创建人（发起人）
    nodes: templateData.nodes, // 节点定义
    transitions: templateData.transitions, // 流转规则
    rejectRules: templateData.rejectRules, // 驳回规则
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  store.workflowTemplates.push(template);
  await saveStore(store);
  
  return template;
}

/**
 * 创建任务（使用自定义工作流）
 */
async function createTaskWithWorkflow(taskData) {
  const store = await loadStore();
  
  // 获取工作流模板
  const template = store.workflowTemplates.find(t => t.id === taskData.workflowTemplateId);
  if (!template) {
    throw new Error('工作流模板不存在');
  }
  
  // 获取第一个节点作为初始节点
  const firstNode = template.nodes[0];
  
  const task = {
    id: `task-${Date.now()}`,
    title: taskData.title,
    description: taskData.description,
    creator: taskData.creator,
    workflowTemplateId: template.id,
    status: firstNode.id,
    currentNode: firstNode.id,
    currentRole: firstNode.role,
    workflow: {
      template: template,
      currentNode: firstNode.id,
      history: [{
        node: firstNode.id,
        operator: taskData.creator,
        timestamp: new Date().toISOString(),
        action: 'create'
      }]
    },
    nodeData: {}, // 各节点的数据
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  store.tasks.push(task);
  await saveStore(store);
  
  return task;
}

/**
 * 节点流转
 */
async function transitionNode(taskId, currentNodeId, targetNodeId, operator, data) {
  const store = await loadStore();
  const task = store.tasks.find(t => t.id === taskId);
  
  if (!task) {
    throw new Error('任务不存在');
  }
  
  // 验证流转是否合法
  const template = task.workflow.template;
  const currentTransitions = template.transitions[currentNodeId];
  
  if (!currentTransitions || !currentTransitions.includes(targetNodeId)) {
    throw new Error(`不允许的流转：从 ${currentNodeId} 到 ${targetNodeId}`);
  }
  
  // 更新任务状态
  task.status = targetNodeId;
  task.currentNode = targetNodeId;
  
  // 获取目标节点的角色
  const targetNode = template.nodes.find(n => n.id === targetNodeId);
  task.currentRole = targetNode.role;
  
  task.updatedAt = new Date().toISOString();
  
  // 记录工作流历史
  task.workflow.history.push({
    node: targetNodeId,
    from: currentNodeId,
    operator: operator,
    timestamp: new Date().toISOString(),
    action: 'transition',
    data: data
  });
  
  // 保存节点数据
  if (data) {
    task.nodeData[targetNodeId] = data;
  }
  
  await saveStore(store);
  
  return task;
}

/**
 * 驳回（支持自定义回退目标）
 */
async function reject(taskId, currentNodeId, targetNodeId, operator, reason) {
  const store = await loadStore();
  const task = store.tasks.find(t => t.id === taskId);
  
  if (!task) {
    throw new Error('任务不存在');
  }
  
  // 获取驳回规则
  const template = task.workflow.template;
  const rejectRule = template.rejectRules[currentNodeId];
  
  // 如果没有指定目标节点，使用驳回规则中的默认目标
  const rollbackTo = targetNodeId || (rejectRule ? rejectRule.rollbackTo : null);
  
  if (!rollbackTo) {
    throw new Error('未指定驳回目标节点');
  }
  
  // 更新任务状态 - 回退到目标节点
  task.status = rollbackTo;
  task.currentNode = rollbackTo;
  
  // 获取目标节点的角色
  const targetNode = template.nodes.find(n => n.id === rollbackTo);
  task.currentRole = targetNode.role;
  
  task.updatedAt = new Date().toISOString();
  
  // 记录驳回历史
  task.workflow.history.push({
    node: rollbackTo,
    from: currentNodeId,
    operator: operator,
    timestamp: new Date().toISOString(),
    action: 'reject',
    reason: reason,
    rollbackTo: rollbackTo
  });
  
  await saveStore(store);
  
  return task;
}

/**
 * 获取任务工作流状态
 */
async function getTaskWorkflowStatus(taskId) {
  const store = await loadStore();
  const task = store.tasks.find(t => t.id === taskId);
  
  if (!task) {
    throw new Error('任务不存在');
  }
  
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    currentNode: task.currentNode,
    currentRole: task.currentRole,
    creator: task.creator,
    workflow: {
      template: task.workflow.template,
      currentNode: task.currentNode,
      history: task.workflow.history
    },
    nodeData: task.nodeData,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

/**
 * 获取所有工作流模板
 */
async function getAllWorkflowTemplates() {
  const store = await loadStore();
  return store.workflowTemplates;
}

/**
 * 获取所有任务
 */
async function getAllTasks() {
  const store = await loadStore();
  return store.tasks;
}

module.exports = {
  createWorkflowTemplate,
  createTaskWithWorkflow,
  transitionNode,
  reject,
  getTaskWorkflowStatus,
  getAllWorkflowTemplates,
  getAllTasks
};
