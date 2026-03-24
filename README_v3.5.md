# BCE v3.5 快速入门

**北斗协同引擎 (Beidou Collaboration Engine)**

---

## 🎯 一句话介绍

**BCE v3.5 是一个智能任务协同系统，通过心跳机制确保每个任务都被及时确认和执行，杜绝任务"卡住"问题。**

---

## ✨ 核心特性

### 1. 5 分钟心跳确认
- ⏰ 每 5 分钟自动查询待办任务
- 📱 发现未确认任务 → 飞书@提醒
- 🔄 覆盖开发/验收/审核全环节

### 2. 审核流程自动化
- ✅ 验收通过 → 自动流转到审核
- 👤 自动设置审核人（执矩）
- 📊 看板实时显示待审核任务

### 3. 30 分钟进度更新
- 📈 执行者每 30 分钟更新进度百分比
- ⚠️ 超时自动升级告警
- 📋 标准化进度汇报模板

### 4. 管理者仪表盘
- 📊 实时查看所有任务进度
- 🔔 风险任务预警
- 🎯 一键强制汇报

---

## 🚀 一键安装（3 步搞定）

### 前置条件
- Node.js 18+
- Git
- 飞书应用（App ID + Secret）

---

### 步骤 1：克隆代码

```bash
git clone https://github.com/leozhang1614/BCE-Project.git
cd BCE-Project
```

---

### 步骤 2：配置环境变量

```bash
# 复制配置模板
cp .env.example .env

# 编辑配置（必填 3 项）
nano .env
```

**.env 文件内容：**
```bash
# 飞书配置（必填）
FEISHU_APP_ID=cli_xxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxx
FEISHU_CHAT_ID=oc_xxxxxxxxxxxxx

# 服务配置（可选）
PORT=3000
NODE_ENV=production
```

> 💡 **获取飞书配置：** 联系管理员或查看飞书开发者后台

---

### 步骤 3：启动服务

```bash
# 安装依赖
npm install

# 启动主服务
node src/index.js > logs/bce-v3.5.log 2>&1 &

# 启动定时任务
node scripts/start-scheduler.js > logs/scheduler-service.log 2>&1 &

# 验证服务
curl http://localhost:3000/health
```

**看到以下输出表示成功：**
```json
{"status":"ok","version":"3.5.0"}
```

---

## 📱 访问看板

**浏览器打开：**
```
http://localhost:3000/bce-tasks.html
```

**看板显示：**
- 📊 任务统计（待分配/执行中/待验收/待审核/已完成）
- 📋 任务列表（状态/执行者/优先级）
- ⚠️ 风险任务告警

---

## 🎯 快速使用

### 创建任务

**API 方式：**
```bash
curl -X POST http://localhost:3000/api/bce/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试任务",
    "description": "这是一个测试任务",
    "creator": "天枢",
    "assignee": "匠心",
    "priority": "P1"
  }'
```

**飞书方式：**
- 在飞书群@匠心机器人
- 输入：`创建任务：XXX`

---

### 任务流转

```
创建任务 → 匠心确认 → 执行中 → 提交验收 → 司库验收
  ↓
验收通过 → 自动流转审核 → 执矩审核 → 审核通过 → 已完成
  ↓
验收驳回 → 返回执行中 → 重新执行
```

---

### 确认任务

**飞书通知 → 点击确认按钮**

或

**API 方式：**
```bash
curl -X POST http://localhost:3000/api/bce/tasks/{任务 ID}/confirm \
  -H "Content-Type: application/json" \
  -d '{"userName": "匠心"}'
```

---

## 📊 核心 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/bce/tasks` | GET | 获取任务列表 |
| `/api/bce/tasks` | POST | 创建任务 |
| `/api/bce/tasks/:id/confirm` | POST | 确认任务 |
| `/api/bce/tasks/:id/accept` | POST | 验收通过 |
| `/api/bce/tasks/:id/reject` | POST | 驳回任务 |
| `/api/bce/progress/check` | POST | 更新进度 |
| `/api/bce/manager/dashboard` | GET | 管理者仪表盘 |

---

## 🔧 常用命令

```bash
# 查看服务状态
ps aux | grep "node src/index.js"

# 查看日志
tail -f logs/bce-v3.5.log

# 重启服务
pkill -f "node src/index.js"
node src/index.js > logs/bce-v3.5.log 2>&1 &

# 健康检查
curl http://localhost:3000/health

# 查看任务统计
curl http://localhost:3000/api/bce/tasks/stats
```

---

## ⚠️ 注意事项

### 1. 端口占用
如果 3000 端口被占用，修改 `.env` 中的 `PORT` 配置

### 2. 飞书通知不工作
- 检查 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET` 是否正确
- 检查飞书应用是否有群聊权限
- 查看日志：`tail -f logs/scheduler-service.log`

### 3. 心跳任务不执行
- 检查 `start-scheduler.js` 是否运行
- 查看日志：`tail -f logs/scheduler-service.log`
- 重启定时任务：`pkill -f "start-scheduler.js"` 然后重新启动

---

## 📚 完整文档

- **发布说明：** [RELEASE_v3.5.md](RELEASE_v3.5.md)
- **项目说明：** [docs/BCE_v3.4_项目说明文档.md](docs/BCE_v3.4_项目说明文档.md)
- **操作指南：** [docs/BCE_v3.4_操作指南.md](docs/BCE_v3.4_操作指南.md)
- **节点跟进制度：** [docs/节点跟进制度_v3.4.md](docs/节点跟进制度_v3.4.md)

---

## 🆘 问题反馈

**GitHub Issues:**
https://github.com/leozhang1614/BCE-Project/issues

**飞书联系：**
- 匠心 (CTO)
- 天枢 (CEO)

---

## 📦 版本信息

- **版本号：** v3.5.0
- **发布日期：** 2026-03-23
- **GitHub:** https://github.com/leozhang1614/BCE-Project/releases/tag/v3.5

---

**快速入门完成！现在就开始使用 BCE v3.5 吧！** 🚀
