/**
 * 飞书用户 ID 映射表（磊哥提供 - 2026-03-20 23:19 最终确认版）
 * 用于飞书通知中@指定用户
 * 
 * 注意：每个机器人有自己的应用，user_id 是各自应用中的 open_id
 */

const USER_ID_MAP = {
  '天枢': 'ou_82e24fd5850f184e395ecaa7d11a1ddc',
  '匠心': 'ou_11b23f47253fc3551ffed488527c7740',
  '司库': 'ou_998d07ddc86ad7ba9d4dd12dddc55cc6',
  '执矩': 'ou_aaeb25dcae8616029a9d36906892bd05',
  '磐石': 'ou_dba586c77d92f652e427370d3f54cc54',
  '灵犀': 'ou_afd48fe16ccb4d2ba8a56235eb29d784',
  '天策': 'ou_3a2c50c8eb0338734362a741c934da8f',
  '磊哥': 'ou_de94b16d442425be15d96344fdd271f8'
};

/**
 * 根据用户名获取 user_id
 * @param {string} name - 用户姓名
 * @returns {string} user_id
 */
function getUserIdByName(name) {
  const userId = USER_ID_MAP[name] || '';
  if (!userId) {
    console.log(`[飞书] ⚠️ 用户 ${name} 的 user_id 未配置`);
  } else {
    console.log(`[飞书] ✅ 用户名 ${name} → user_id: ${userId}`);
  }
  return userId;
}

/**
 * 获取所有已配置的 user_id 列表
 * @returns {string[]} user_id 列表
 */
function getAllUserIds() {
  return Object.values(USER_ID_MAP);
}

module.exports = {
  USER_ID_MAP,
  getUserIdByName,
  getAllUserIds
};
