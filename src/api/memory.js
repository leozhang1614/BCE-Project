const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');

// 记忆桥接脚本路径
const MEMORY_BRIDGE_PATH = path.join(__dirname, '../../scripts/memory_bridge.py');

/**
 * 添加记忆
 * POST /api/memory
 * Body: { content: string, metadata: object }
 */
router.post('/', async (req, res) => {
  try {
    const { content, metadata = {} } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: '记忆内容不能为空' });
    }
    
    // 调用 Python 记忆桥接脚本
    const result = await callMemoryBridge('jiangxin', 'add', content, metadata);
    
    res.status(201).json({
      success: true,
      message: '记忆已同步',
      data: result
    });
  } catch (error) {
    console.error('添加记忆失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取记忆列表
 * GET /api/memory?limit=10
 */
router.get('/', async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    
    const result = await callMemoryBridge('jiangxin', 'list', limit);
    
    res.json({
      success: true,
      count: result.length,
      data: result
    });
  } catch (error) {
    console.error('获取记忆失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 搜索记忆
 * GET /api/memory/search?keyword=xxx
 */
router.get('/search', async (req, res) => {
  try {
    const { keyword } = req.query;
    
    if (!keyword) {
      return res.status(400).json({ error: '关键词不能为空' });
    }
    
    const result = await callMemoryBridge('jiangxin', 'search', keyword);
    
    res.json({
      success: true,
      count: result.length,
      data: result
    });
  } catch (error) {
    console.error('搜索记忆失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 刷新重试队列
 * POST /api/memory/flush
 */
router.post('/flush', async (req, res) => {
  try {
    await callMemoryBridge('jiangxin', 'flush');
    
    res.json({
      success: true,
      message: '重试队列已刷新'
    });
  } catch (error) {
    console.error('刷新队列失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 调用记忆桥接脚本的辅助函数
 */
function callMemoryBridge(agent, command, ...args) {
  return new Promise((resolve, reject) => {
    const pythonArgs = [agent, command, ...args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    )];
    
    const process = spawn('python3', [MEMORY_BRIDGE_PATH, ...pythonArgs]);
    
    let output = '';
    let errorOutput = '';
    
    process.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        // 解析输出
        try {
          // 提取 JSON 部分（跳过日志行）
          const jsonMatch = output.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            resolve(JSON.parse(jsonMatch[0]));
          } else if (output.includes('✅')) {
            // 成功但无 JSON 输出
            resolve({ success: true });
          } else {
            resolve(output.trim());
          }
        } catch (e) {
          resolve(output.trim());
        }
      } else {
        reject(new Error(errorOutput || `进程退出码：${code}`));
      }
    });
    
    process.on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = router;
