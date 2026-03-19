# OpenClaw Control Center - 北斗协同引擎 (BCE)

北斗协同引擎 (Beidou Collaboration Engine) 是 OpenClaw 的任务管理和协作平台。

## 功能特性

- **任务管理**: 创建、分配、跟踪任务
- **Agent 管理**: 注册和监控 Agent 状态
- **协作会话**: 支持多 Agent 协作工作流

## 安装

```bash
npm install
```

## 配置

复制环境变量示例文件并配置:

```bash
cp .env.example .env
```

## 运行

开发模式:
```bash
npm run dev
```

生产模式:
```bash
npm start
```

## API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/tasks` | GET | 获取所有任务 |
| `/api/tasks` | POST | 创建任务 |
| `/api/tasks/:id` | GET | 获取单个任务 |
| `/api/agents` | GET | 获取所有 Agent |
| `/api/agents` | POST | 注册 Agent |
| `/api/collaboration/sessions` | POST | 创建协作会话 |

## 技术栈

- Node.js 18+
- Express.js
- UUID

## License

MIT
