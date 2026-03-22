# BCE 北斗协同引擎

**基于 OpenClaw 的智能任务协同管理系统**

## ✨ 核心特性

- 🎯 开发任务标准工作流（开发→验收→审核）
- 🔄 自动流转机制
- ⚠️ 审核不通过自动回退
- 💬 自然语言交互
- 🔗 OpenClaw 深度集成

## 🚀 快速开始

### 安装

```bash
# 克隆项目
git clone https://github.com/beidou-company/BCE-Project.git
cd BCE-Project

# 安装依赖
npm install

# 启动服务
node src/index.js
```

### 使用 Skill

```bash
# 安装 Skill
clawhub install bce-dev-workflow

# 自然语言创建任务
创建一个开发任务，名称是"用户模块开发"，开发者是匠心，负责人是天枢
```

## 📋 工作流

```
开发（开发者） → 验收（项目负责人） → 审核（执矩）
                                        ↓
                                 审核不通过
                                        ↓
                                 回退到开发节点
```

## 🔧 API 端点

- `POST /api/dev-workflow/tasks` - 创建开发任务
- `POST /api/dev-workflow/tasks/:id/submit-acceptance` - 提交验收
- `POST /api/dev-workflow/tasks/:id/submit-audit` - 提交审核
- `POST /api/dev-workflow/tasks/:id/audit-pass` - 审核通过
- `POST /api/dev-workflow/tasks/:id/audit-reject` - 审核驳回

## 📚 文档

- [开发任务流程管理规范](./执行通知 - BCE 开发任务流程管理规范_v2.0.md)
- [开发任务标准工作流](./BCE 开发任务标准工作流_v1.0.md)
- [任务轮询机制](./BCE 任务轮询机制_v3.0_强制版_最终版.md)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可

MIT License

## 👥 作者

**匠心 (CTO) @ 北斗公司**
