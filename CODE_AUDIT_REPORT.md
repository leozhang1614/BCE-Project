# BCE 项目代码审计报告

**审计时间：** 2026-03-24 13:00  
**审计人：** 匠心 (CTO)  
**版本：** v3.4

---

## 📊 项目概况

- **总文件数：** 49 个 JS 文件
- **API 路由数：** 128 个
- **代码行数：** ~6500 行（估算）

---

## 🔴 严重问题（必须立即修复）

### 1. 数据存储不一致 ⚠️🔴

**问题描述：**
- `bce-tasks.js` 使用内存 Map (`tasks.set/get`) + 定期保存
- `bce-accept.js` 使用独立文件读写 (`loadData/saveData`)
- **两个模块的数据可能不同步！**

**影响：**
- 验收后修改的任务状态可能在 bce-tasks.js 中被覆盖
- 数据丢失风险

**修复方案：**
```javascript
// bce-accept.js 应该使用 bce-tasks.js 导出的 tasks Map
const { tasks, saveData } = require('./bce-tasks');

// 而不是自己读写文件
// ❌ 错误：const data = loadData();
// ✅ 正确：const task = tasks.get(id);
```

**优先级：** P0 - 立即修复

---

### 2. 状态机未严格执行 ⚠️🔴

**问题描述：**
- 定义了 `STATE_TRANSITIONS` 但**未在所有 API 中使用**
- `canTransition()` 函数存在但**未被调用**

**代码位置：**
```javascript
// src/api/bce-tasks.js:120
function canTransition(from, to) {
  const allowedTransitions = STATE_TRANSITIONS[from];
  return allowedTransitions && allowedTransitions.includes(to);
}
```

**影响：**
- 可能出现非法状态流转（如 pending → completed）
- 业务流程混乱

**修复方案：**
```javascript
// 在所有状态变更 API 中添加检查
if (!canTransition(task.status, newStatus)) {
  return res.status(400).json({ 
    error: `不允许的状态流转：${task.status} -> ${newStatus}` 
  });
}
```

**优先级：** P0 - 立即修复

---

### 3. OCC 同步不完整 ⚠️🔴

**问题描述：**
- 部分 API 调用 `occSync.updateTask()`（确认 API）
- **验收 API、驳回 API 未同步到 OCC**

**代码对比：**
```javascript
// ✅ bce-tasks.js:837 确认 API 有同步
await occSync.updateTask(id, task);

// ❌ bce-accept.js 验收 API 无同步
// saveData(data);  // 只保存到本地文件

// ❌ transfer-rules.js 驳回 API 有同步 ✅
await occSync.updateTask(taskId, task);
```

**影响：**
- OCC 主数据源与 BCE 本地数据不一致
- 多系统协作时数据冲突

**修复方案：**
在 `bce-accept.js` 中添加：
```javascript
const occSync = require('./occ-sync');
await occSync.updateTask(id, task);
```

**优先级：** P0 - 立即修复

---

## 🟡 中等问题（建议修复）

### 4. 权限验证不统一 ⚠️🟡

**问题描述：**
- 部分 API 使用 `checkPermission()` 中间件
- 部分 API 手动检查用户名（bce-accept.js）
- **权限逻辑分散**

**代码对比：**
```javascript
// ✅ bce-tasks.js:531 使用中间件
router.post('/tasks/:id/accept', checkPermission('accept'), ...);

// ❌ bce-accept.js:53 手动检查
const allowedAcceptors = ['司库', '天枢', '磊哥'];
if (!allowedAcceptors.includes(userName)) { ... }
```

**影响：**
- 权限变更需要修改多处
- 容易出现权限漏洞

**修复方案：**
统一使用 `checkPermission()` 中间件

**优先级：** P1 - 建议修复

---

### 5. 错误处理不完整 ⚠️🟡

**问题描述：**
- 部分 API 有完整的 try-catch
- 部分异步操作（通知、OCC 同步）错误被吞掉

**代码示例：**
```javascript
// bce-tasks.js:839 OCC 同步失败被忽略
try {
  await occSync.updateTask(id, task);
} catch (occError) {
  console.error('[确认同步] OCC 同步失败:', occError.message);
  // ❌ 没有返回错误给客户端
}
```

**影响：**
- 静默失败，难以排查问题
- 客户端不知道操作是否真正成功

**修复方案：**
```javascript
} catch (occError) {
  console.error('[确认同步] OCC 同步失败:', occError.message);
  // 记录但不阻止主流程（OCC 是异步的）
  task.syncStatus = 'pending';  // 标记为待同步
}
```

**优先级：** P1 - 建议修复

---

### 6. 心跳任务配置不完整 ⚠️🟡

**问题描述：**
- 心跳任务只有 4 个执行者配置
- **没有配置验收环节的心跳查询**

**当前配置：**
```javascript
const WORKERS = [
  { name: '匠心', queryStatus: 'pending', queryBy: 'assignee' },
  { name: '磐石', queryStatus: 'pending', queryBy: 'assignee' },
  { name: '司库', queryStatus: 'reviewing', queryBy: 'assignee' },  // ✅ 验收
  { name: '执矩', queryStatus: 'auditing', queryBy: 'auditor' }    // ✅ 审核
];
```

**问题：**
- 验收环节查询的是 `reviewing` 状态
- 但验收 API 检查的是 `pending_acc` 状态
- **状态不匹配！**

**修复方案：**
```javascript
// 方案 1：修改心跳任务查询 reviewing
{ name: '司库', queryStatus: 'reviewing', queryBy: 'assignee' }

// 方案 2：修改验收 API 使用 reviewing
if (task.status !== 'reviewing') { ... }
```

**优先级：** P1 - 建议修复

---

## 🟢 轻微问题（可选优化）

### 7. 日志记录不统一 ⚠️🟢

**问题描述：**
- 部分 API 有详细日志
- 部分 API 几乎没有日志

**建议：**
统一日志格式：
```javascript
console.log(`[模块名] 操作：xxx, 用户：xxx, 结果：xxx`);
```

**优先级：** P2 - 可选优化

---

### 8. 数据备份策略不完善 ⚠️🟢

**现状：**
- 有多个 backup 文件（188KB, 170KB）
- 没有自动清理策略

**建议：**
- 添加备份轮转（保留最近 7 天）
- 压缩旧备份

**优先级：** P2 - 可选优化

---

## ✅ 已修复的问题

### 9. 审核环节状态流转 ✅

**问题：** 审核确认后状态不流转  
**修复：** 已添加状态流转逻辑  
**状态：** ✅ 已完成

---

### 10. 驳回原因记录 ✅

**问题：** 驳回原因未记录  
**修复：** 已添加 `rejectReason` 和 `rejectHistory`  
**状态：** ✅ 已完成

---

### 11. OCC 模块导出别名 ✅

**问题：** `occSync.getTask` 未导出  
**修复：** 已添加别名导出  
**状态：** ✅ 已完成

---

## 📋 修复计划

### P0 - 立即修复（今天完成）
1. ✅ 修复数据存储不一致（bce-accept.js 使用统一数据源）
2. ✅ 添加状态机检查（所有状态流转 API）
3. ✅ 补全 OCC 同步（验收 API）

### P1 - 本周内修复
4. 统一权限验证逻辑
5. 完善错误处理
6. 修复心跳任务状态匹配

### P2 - 下周优化
7. 统一日志格式
8. 添加备份轮转

---

## 🔍 详细代码检查清单

### API 路由完整性
- [x] 任务 CRUD：✅ 完整
- [x] 任务流转：✅ 完整
- [x] 验收/审核：✅ 完整
- [x] 驳回流程：✅ 完整
- [x] 通知系统：✅ 完整

### 数据一致性
- [ ] 内存 vs 文件：❌ 不一致
- [ ] OCC 同步：❌ 不完整
- [x] 备份机制：✅ 有

### 权限控制
- [x] 用户角色定义：✅ 完整
- [ ] 权限验证：❌ 不统一
- [x] 敏感操作保护：✅ 有

### 错误处理
- [x] 基本 try-catch：✅ 有
- [ ] 异步错误处理：❌ 不完整
- [x] 错误日志：✅ 有

### 状态管理
- [x] 状态定义：✅ 完整
- [x] 状态流转规则：✅ 定义
- [ ] 状态流转检查：❌ 未执行

---

## 📊 代码质量评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 功能完整性 | ⭐⭐⭐⭐⭐ | 5/5 - 功能完整 |
| 代码规范性 | ⭐⭐⭐⭐ | 4/5 - 基本规范 |
| 数据一致性 | ⭐⭐ | 2/5 - 严重问题 |
| 错误处理 | ⭐⭐⭐ | 3/5 - 基本完整 |
| 权限控制 | ⭐⭐⭐ | 3/5 - 不统一 |
| 可维护性 | ⭐⭐⭐ | 3/5 - 需要重构 |

**综合评分：** ⭐⭐⭐ (3/5)

---

## 🎯 结论

**BCE 项目功能完整，但存在严重的数据一致性问题！**

**必须立即修复：**
1. 统一数据存储（bce-accept.js → bce-tasks.js）
2. 严格执行状态机检查
3. 补全 OCC 同步

**修复后评分可达：** ⭐⭐⭐⭐ (4/5)

---

**报告人：** 匠心 (CTO)  
**日期：** 2026-03-24 13:00
