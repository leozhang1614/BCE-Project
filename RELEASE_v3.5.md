# BCE v3.5 发布说明

**发布日期：** 2026-03-23  
**版本类型：** 功能增强版

---

## 🎯 核心升级

### 1. 审核流程自动化（新增）

**功能描述：** 验收通过后自动流转到审核环节，无需手动操作

**改动文件：**
- `src/api/bce-accept.js` - 验收 API 增加自动流转逻辑
- `src/api/bce-tasks.js` - 添加 AUDITING 状态常量

**核心逻辑：**
```javascript
// 验收通过 → 自动设置
task.status = 'auditing';
task.auditor = '执矩';
task.requireConfirmation = true;
```

---

### 2. 心跳任务全环节覆盖（增强）

**功能描述：** 定时任务现在查询所有环节的待确认任务（开发/验收/审核）

**改动文件：**
- `src/services/scheduler-service.js` - 修改 `checkNewTasksForAgent` 方法

**核心逻辑：**
```javascript
// 查询所有分给用户且未确认的任务
const isAssignee = task.assignee === agent;
const isReviewer = task.reviewer === agent;
const isAuditor = task.auditor === agent;

if (!isAssignee && !isReviewer && !isAuditor) return false;
if (task.confirmedAt) return false;  // 未确认才提醒
```

**覆盖环节：**
- ✅ 任务分配（assigned）→ 执行者确认
- ✅ 提交验收（reviewing）→ 验收人确认
- ✅ 提交审核（auditing）→ 审核人确认

---

### 3. 看板显示优化（新增）

**功能描述：** 看板新增"待审核"状态统计和显示

**改动文件：**
- `public/bce-tasks.html` - 添加待审核统计卡片和样式
- `src/api/bce-tasks.js` - stats API 添加 auditing 统计

**新增内容：**
- 待审核统计卡片（橙色）
- 审核任务样式（`status-auditing`）
- 状态映射（`auditing: '待审核'`）

---

### 4. 路由顺序修复（Bug 修复）

**问题：** `/tasks/stats` 路由在 `/tasks/:id` 之后，导致 stats 被当作任务 ID

**修复：** 将 `/tasks/stats` 路由移到 `/tasks/:id` 之前

**改动文件：**
- `src/api/bce-tasks.js` - 调整路由顺序

---

### 5. 安全修复（v3.4.2 延续）

**功能描述：** API Key 不再明码存储，从环境变量读取

**改动文件：**
- `.env.example` - 使用占位符
- `.gitignore` - 忽略 `.env` 文件

---

## 📦 新增文件

### 脚本类
- `scripts/start-scheduler.js` - 定时任务启动脚本
- `scripts/health-check.sh` - 健康检查脚本
- `scripts/heartbeat-worker.js` - 心跳任务 Worker
- `scripts/memory-heartbeat.js` - 记忆心跳脚本
- `scripts/delete-all-tasks.js` - 批量删除任务脚本

### 服务类
- `src/services/monitoring-service.js` - 运维监控服务
- `src/services/imessage-service.js` - iMessage 通知服务
- `src/services/akshare-service.js` - AkShare 数据服务
- `src/services/evolution-service.js` - 自我进化服务

### API 类
- `src/api/bce-monitoring.js` - 运维监控 API
- `src/api/bce-imessage.js` - iMessage 通知 API
- `src/api/bce-data.js` - 数据管理 API
- `src/api/bce-evolution.js` - 自我进化 API
- `src/api/bce-ai.js` - AI 分析 API

### 其他
- `runtime/monitoring.log` - 监控日志
- `runtime/scheduler-service.log` - 调度器日志
- `runtime/alerts.log` - 告警日志
- `runtime/inboxes/` - 消息收件箱目录

---

## 🔧 技术改进

### 1. 状态管理优化

**新增状态常量：**
```javascript
const TASK_STATES = {
  // ... 原有状态
  AUDITING: 'auditing',  // v3.5 新增
};
```

**状态流转规则：**
```javascript
const STATE_TRANSITIONS = {
  [TASK_STATES.REVIEWING]: [TASK_STATES.ACCEPTED, TASK_STATES.AUDITING, TASK_STATES.EXECUTING],
  [TASK_STATES.AUDITING]: [TASK_STATES.COMPLETED, TASK_STATES.REVIEWING, TASK_STATES.EXECUTING],
};
```

---

### 2. 数据持久化增强

**新增日志文件：**
- `monitoring.log` - 监控日志
- `scheduler-service.log` - 调度器日志
- `alerts.log` - 告警日志

**消息收件箱：**
- `runtime/inboxes/{user}/msg-{timestamp}.json`

---

### 3. 中间件优化

**改动文件：**
- `src/middleware/auth.js` - 权限验证优化
- `src/index.js` - 服务启动逻辑优化

---

## 📊 功能对比

| 功能 | v3.4 | v3.5 |
|------|------|------|
| 任务分配确认 | ✅ | ✅ |
| 进度管理（30 分钟） | ✅ | ✅ |
| 验收流程 | ✅ | ✅ |
| **审核流程** | ❌ | ✅ 自动流转 |
| **心跳查询审核** | ❌ | ✅ |
| **看板待审核显示** | ❌ | ✅ |
| 管理者权限系统 | ✅ | ✅ |
| 绩效绑定 | ✅ | ✅ |
| iMessage 通知 | ❌ | ✅ |
| 运维监控 | ❌ | ✅ |
| AI 数据分析 | ❌ | ✅ |

---

## 🚀 升级步骤

### 从 v3.4 升级

```bash
# 1. 停止旧服务
pkill -f "node src/index.js"
pkill -f "scheduler-v3.4.js"

# 2. 拉取最新代码
git pull origin master

# 3. 安装依赖
npm install

# 4. 备份数据
cp runtime/bce-data.json runtime/bce-data.json.backup.$(date +%Y%m%d_%H%M%S)

# 5. 启动服务
node src/index.js > logs/bce-v3.5.log 2>&1 &
node scripts/start-scheduler.js > logs/scheduler-service.log 2>&1 &

# 6. 验证
curl http://localhost:3000/health
```

### 全新安装

```bash
# 1. 克隆仓库
git clone https://github.com/leozhang1614/BCE-Project.git
cd BCE-Project

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填写配置

# 4. 启动服务
node src/index.js > logs/bce-v3.5.log 2>&1 &
node scripts/start-scheduler.js > logs/scheduler-service.log 2>&1 &

# 5. 访问看板
open http://localhost:3000/bce-tasks.html
```

---

## ⚠️ 注意事项

### 1. 数据迁移

**v3.5 新增 auditing 状态，已有任务不受影响**

如果需要将已验收任务流转到审核：
```bash
# 使用脚本批量更新
node scripts/migrate-to-auditing.js
```

### 2. 环境变量

**确保配置以下环境变量：**
```bash
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx  # 从系统环境变量读取
FEISHU_CHAT_ID=oc_xxx
```

### 3. 权限配置

**审核人权限：**
- 只有 `auditor` 字段指定的用户可以审核
- 默认审核人：执矩
- 可在任务创建时指定审核人

---

## 🐛 已知问题

1. **plantuml-master 技能不存在** - clawhub 上找不到，使用 mermaid-architect 替代
2. **user-journey-mapper 技能不存在** - clawhub 上找不到，暂无替代

---

## 📝 待办事项

- [ ] 添加审核驳回功能测试用例
- [ ] 完善运维监控告警规则
- [ ] 优化 iMessage 通知模板
- [ ] 添加 AI 数据分析报告模板

---

## 🎯 下一版本规划（v3.6）

**计划功能：**
1. 任务依赖关系管理
2. 甘特图视图
3. 资源负载均衡
4. 自动化测试集成
5. 性能优化（缓存、索引）

---

**发布人：** 匠心 (CTO)  
**审核人：** 磊哥 (CEO)  
**标签：** `v3.5` `feature` `audit-workflow` `heartbeat-enhancement`
