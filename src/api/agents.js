const express = require('express');
const router = express.Router();
const AgentService = require('../services/agentService');

// 获取所有 Agent
router.get('/', async (req, res) => {
  try {
    const agents = await AgentService.getAllAgents();
    res.json(agents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 注册 Agent
router.post('/', async (req, res) => {
  try {
    const agent = await AgentService.registerAgent(req.body);
    res.status(201).json(agent);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 获取 Agent 状态
router.get('/:id/status', async (req, res) => {
  try {
    const status = await AgentService.getAgentStatus(req.params.id);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
