require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const taskRoutes = require('./api/tasks');
const agentRoutes = require('./api/agents');
const collaborationRoutes = require('./api/collaboration');
const memoryRoutes = require('./api/memory');
const confirmationRoutes = require('./api/confirmation');
const boardRoutes = require('./api/board');
const broadcastRoutes = require('./api/broadcast');
const feishuRoutes = require('./api/feishu');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(helmet({
  contentSecurityPolicy: false,  // 开发环境禁用 CSP
  crossOriginOpenerPolicy: false,
  originAgentCluster: false
}));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.static('public'));

// 路由
app.use('/api/tasks', taskRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/collaboration', collaborationRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/confirmation', confirmationRoutes);
app.use('/api/board', boardRoutes);
app.use('/api/broadcast', broadcastRoutes);
app.use('/api/feishu', feishuRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'BCE', timestamp: new Date().toISOString() });
});

// 根路径
app.get('/', (req, res) => {
  res.json({
    name: 'OpenClaw Control Center',
    description: '北斗协同引擎 (BCE)',
    version: '1.0.0'
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '内部服务器错误' });
});

app.listen(PORT, () => {
  console.log(`🚀 BCE 服务已启动：http://localhost:${PORT}`);
});

module.exports = app;
