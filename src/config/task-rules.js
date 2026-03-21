/**
 * 任务流转规则配置（v3.2 自动流转）
 */

const transferRules = [
  {
    name: '技术方案转财务审核',
    match: (task) => task.type === 'tech_design' && task.status === 'completed',
    next: (task) => '司库',
    condition: (task) => task.assignee !== '司库'  // 避免循环
  },
  {
    name: '财务审核转安全审核',
    match: (task) => task.type === 'finance_review' && task.status === 'completed',
    next: (task) => '执矩'
  },
  {
    name: '安全审核转 CEO 验收',
    match: (task) => task.type === 'security_review' && task.status === 'completed',
    next: (task) => '天枢'
  },
  {
    name: '默认转回创建者验收',
    match: (task) => task.status === 'completed',
    next: (task) => task.creator,
    condition: (task) => task.assignee !== task.creator  // 避免自转交
  }
];

/**
 * 有效成员列表（用于边界检查）
 */
const validMembers = [
  '天枢',
  '匠心',
  '司库',
  '执矩',
  '磐石',
  '灵犀',
  '天策'
];

module.exports = {
  transferRules,
  validMembers
};
