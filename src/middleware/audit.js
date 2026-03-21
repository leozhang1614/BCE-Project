const fs = require('fs');
const path = require('path');

const AUDIT_LOG_FILE = path.join(__dirname, '../../runtime/audit-log.json');

/**
 * 记录操作审计日志
 */
function logAudit(action, userId, userName, resourceType, resourceId, details = {}) {
  try {
    const dir = path.dirname(AUDIT_LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    // 加载现有日志
    let logs = [];
    if (fs.existsSync(AUDIT_LOG_FILE)) {
      logs = JSON.parse(fs.readFileSync(AUDIT_LOG_FILE, 'utf8'));
    }
    
    // 添加新日志
    logs.push({
      id: logs.length + 1,
      timestamp: new Date().toISOString(),
      action,
      userId,
      userName,
      resourceType,
      resourceId,
      details
    });
    
    // 只保留最近 1000 条日志
    if (logs.length > 1000) {
      logs = logs.slice(-1000);
    }
    
    fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(logs, null, 2));
    console.log(`[审计] ${action} - ${userName} 操作 ${resourceType}:${resourceId}`);
  } catch (error) {
    console.error('[审计] 记录失败:', error.message);
  }
}

/**
 * 获取审计日志
 */
function getAuditLogs(filters = {}) {
  try {
    if (!fs.existsSync(AUDIT_LOG_FILE)) {
      return [];
    }
    
    let logs = JSON.parse(fs.readFileSync(AUDIT_LOG_FILE, 'utf8'));
    
    // 筛选
    if (filters.userId) logs = logs.filter(l => l.userId === filters.userId);
    if (filters.action) logs = logs.filter(l => l.action === filters.action);
    if (filters.resourceType) logs = logs.filter(l => l.resourceType === filters.resourceType);
    if (filters.resourceId) logs = logs.filter(l => l.resourceId === filters.resourceId);
    
    // 按时间倒序
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return logs;
  } catch (error) {
    console.error('[审计] 获取日志失败:', error.message);
    return [];
  }
}

module.exports = {
  logAudit,
  getAuditLogs
};
