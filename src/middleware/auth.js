/**
 * 权限控制中间件
 */

// 角色权限定义
const ROLE_PERMISSIONS = {
  admin: ['create', 'read', 'update', 'delete', 'assign', 'accept'],  // 管理员（磊哥、天枢）
  member: ['create', 'read', 'update', 'assign'],  // 普通成员（匠心、司库等）
  viewer: ['read']  // 只读用户
};

// 用户角色映射
const USER_ROLES = {
  'ou_107ee407edb8e6053adf9b019451071d': 'admin',  // 磊哥
  'ou_c22dcb4ed8911acfca2f0e2ad865b0ce': 'admin',  // 天枢
  'ou_b3b3b6abaa38da2c4066010a02abf544': 'member', // 匠心
  'ou_998d07ddc86ad7ba9d4dd12dddc55cc6': 'member', // 司库
  'ou_143256262f3459429ed5bb057f7a3436': 'member', // 磐石
};

// 用户名到 role 的映射
const USERNAME_ROLES = {
  '磊哥': 'admin',
  '天枢': 'admin',
  '匠心': 'member',
  '司库': 'member',
  '执矩': 'member',
  '磐石': 'member',
  '灵犀': 'member'
};

/**
 * 获取用户角色
 */
function getUserRole(userIdOrName) {
  return USER_ROLES[userIdOrName] || USERNAME_ROLES[userIdOrName] || 'viewer';
}

/**
 * 检查权限
 */
function hasPermission(role, action) {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(action);
}

/**
 * 权限检查中间件
 * @param {string} requiredAction - 需要的权限 (create/read/update/delete/assign/accept)
 */
function checkPermission(requiredAction) {
  return (req, res, next) => {
    // 从请求头或 body 获取用户信息
    const userId = req.headers['x-user-id'] || req.body.operator || req.body.creator;
    const role = getUserRole(userId);
    
    if (!hasPermission(role, requiredAction)) {
      console.log(`[权限] 用户 ${userId} (${role}) 尝试执行 ${requiredAction} 操作，权限不足`);
      return res.status(403).json({ 
        error: '权限不足',
        message: `用户 ${userId} 的角色 ${role} 没有 ${requiredAction} 权限`
      });
    }
    
    next();
  };
}

// 导入 tasks（v3.2 修复：解决未定义变量问题）
const tasks = require('../api/bce-tasks').tasks;

/**
 * 任务操作权限检查
 * 检查用户是否有权限操作指定任务
 */
function checkTaskPermission(requiredAction) {
  return (req, res, next) => {
    const userId = req.headers['x-user-id'] || req.body.operator || req.body.creator;
    const role = getUserRole(userId);
    
    // 管理员可以操作所有任务
    if (role === 'admin') {
      return next();
    }
    
    // 检查是否是任务负责人或创建人
    const taskId = req.params.id;
    if (taskId) {
      const task = tasks.get(taskId);
      if (task && (task.assignee === userId || task.creator === userId)) {
        return next();
      }
    }
    
    // 检查用户名
    const userName = req.body.operator || req.body.creator;
    if (userName && USERNAME_ROLES[userName] === 'member') {
      return next();
    }
    
    console.log(`[权限] 用户 ${userId} 无权操作任务 ${taskId}`);
    return res.status(403).json({ 
      error: '权限不足',
      message: '您没有权限操作此任务，只有管理员、任务负责人或创建人可以操作'
    });
  };
}

module.exports = {
  checkPermission,
  checkTaskPermission,
  getUserRole,
  hasPermission,
  ROLE_PERMISSIONS,
  USER_ROLES,
  USERNAME_ROLES
};
