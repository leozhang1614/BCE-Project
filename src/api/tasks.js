const express = require('express');
const router = express.Router();
const TaskService = require('../services/taskService');

// 获取所有任务
router.get('/', async (req, res) => {
  try {
    const tasks = await TaskService.getAllTasks();
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建任务
router.post('/', async (req, res) => {
  try {
    const task = await TaskService.createTask(req.body);
    res.status(201).json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 获取单个任务
router.get('/:id', async (req, res) => {
  try {
    const task = await TaskService.getTaskById(req.params.id);
    if (!task) return res.status(404).json({ error: '任务不存在' });
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新任务
router.put('/:id', async (req, res) => {
  try {
    const task = await TaskService.updateTask(req.params.id, req.body);
    res.json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 删除任务
router.delete('/:id', async (req, res) => {
  try {
    await TaskService.deleteTask(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
