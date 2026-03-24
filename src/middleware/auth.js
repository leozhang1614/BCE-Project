/**
 * 权限控制中间件
 */

// 角色权限定义
const ROLE_PERMISSIONS = {
  admin: ['create', 'read', 'update', 'delete', 'assign', 'accept', 'reject'],  // 管理员（磊哥、天枢）
  manager: ['create', 'read', 'update', 'assign', 'accept', 'reject'],  // 管理者（司库）
  member: ['create', 'read', 'update'],  // 成员（匠心、磐石）
  viewer: ['read']  // 只读用户
};

// 用户角色映射（v3.4.2 修复：补充所有成员 open_id）
const USER_ROLES = {
  'ou_107ee407edb8e6053adf9b019451071d': 'admin',  // 磊哥
  'ou_c22dcb4ed8911acfca2f0e2ad865b0ce': 'admin',  // 天枢
  'ou_82e24fd5850f184e395ecaa7d11a1ddc': 'admin',  // 天枢（备用）
  'ou_998d07ddc86ad7ba9d4dd12dddc55cc6': 'manager', // 司库（验收权限）
  'ou_b3b3b6abaa38da2c4066010a02abf544': 'member', // 匠心
  'ou_aaeb25dcae8616029a9d36906892bd05': 'member', // 执矩（v3.4.2 新增）
  'ou_dba586c77d92f652e427370d3f54cc54': 'member', // 磐石（v3.4.2 修正）
  'ou_afd48fe16ccb4d2ba8a56235eb29d784': 'member', // 灵犀（v3.4.2 新增）
  'ou_3a2c50c8eb0338734362a741c934da8f': 'member', // 天策（v3.4.2 新增）
  'ou_de94b16d442425be15d96344fdd271f8': 'admin',  // 磊哥（备用）
};

// 用户名到 role 的映射
const USERNAME_ROLES = {
  '磊哥': 'admin',
  '天枢': 'admin',
  '司库': 'manager',  // 司库（验收权限）
  '匠心': 'member',
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
    // 从请求头或 body 获取用户信息（支持 userName 和 acceptor 参数）
    const userId = req.headers['x-user-id'] || req.body.operator || req.body.creator || req.body.userName || req.body.acceptor;
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
    
    // 检查是否是任务负责人或创建人（动态加载 tasks 避免循环依赖）
    const taskId = req.params.id;
    if (taskId) {
      try {
        const tasks = require('../api/bce-tasks').tasks;
        const task = tasks.get(taskId);
        if (task) {
          // 检查 userId 匹配
          if (task.assignee === userId || task.creator === userId) {
            return next();
          }
          // 检查用户名匹配（中文名）
          const userName = req.body.operator || req.body.creator || req.body.acceptor;
          if (userName && (task.assignee === userName || task.creator === userName)) {
            return next();
          }
        }
      } catch (e) {
        // 如果加载失败，跳过任务检查
        console.log('[权限] 加载 tasks 失败:', e.message);
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
