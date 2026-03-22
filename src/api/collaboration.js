const express = require('express');
const router = express.Router();
const CollaborationService = require('../services/collaborationService');

// 获取所有协作会话
router.get('/sessions', async (req, res) => {
  try {
    const sessions = CollaborationService.getAllSessions();
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建协作会话
router.post('/sessions', async (req, res) => {
  try {
    const session = await CollaborationService.createSession(req.body);
    res.status(201).json(session);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 获取协作会话
router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await CollaborationService.getSession(req.params.id);
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加参与者
router.post('/sessions/:id/participants', async (req, res) => {
  try {
    const result = await CollaborationService.addParticipant(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
