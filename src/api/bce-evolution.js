/**
 * 自我进化模块 API 路由
 * 
 * 端点：
 * POST /api/bce/evolution/review - 交易复盘
 * POST /api/bce/evolution/cro - CRO 归因分析
 * GET /api/bce/evolution/knowledge - 获取策略知识库
 * POST /api/bce/evolution/knowledge - 更新策略知识库
 */

const express = require('express');
const router = express.Router();
const EvolutionService = require('../services/evolution-service');

const evolutionService = new EvolutionService();

/**
 * POST /api/bce/evolution/review
 * 交易复盘
 */
router.post('/review', async (req, res) => {
  try {
    const trade = req.body;
    
    if (!trade.id || !trade.stockCode) {
      return res.status(400).json({ error: '交易 ID 和股票代码不能为空' });
    }
    
    console.log(`[进化 API] 收到复盘请求：${trade.stockCode}`);
    
    const review = await evolutionService.reviewTrade(trade);
    
    res.json({
      success: true,
      data: review
    });
    
  } catch (error) {
    console.error(`[进化 API] 复盘失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/bce/evolution/cro
 * CRO 归因分析
 */
router.post('/cro', async (req, res) => {
  try {
    const { portfolio, benchmark } = req.body;
    
    if (!portfolio || !benchmark) {
      return res.status(400).json({ error: '投资组合和基准数据不能为空' });
    }
    
    console.log('[进化 API] 收到 CRO 归因请求');
    
    const attribution = await evolutionService.croAttribution(portfolio, benchmark);
    
    res.json({
      success: true,
      data: attribution
    });
    
  } catch (error) {
    console.error(`[进化 API] CRO 归因失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bce/evolution/knowledge
 * 获取策略知识库
 */
router.get('/knowledge', async (req, res) => {
  try {
    const filters = req.query;
    
    console.log('[进化 API] 获取策略知识库');
    
    const knowledge = evolutionService.getStrategyKnowledge(filters);
    
    res.json({
      success: true,
      count: knowledge.length,
      data: knowledge
    });
    
  } catch (error) {
    console.error(`[进化 API] 获取知识库失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/bce/evolution/knowledge
 * 更新策略知识库
 */
router.post('/knowledge', async (req, res) => {
  try {
    const { review, attribution } = req.body;
    
    if (!review) {
      return res.status(400).json({ error: '复盘数据不能为空' });
    }
    
    console.log('[进化 API] 更新策略知识库');
    
    const knowledge = evolutionService.updateStrategyKnowledge(review, attribution);
    
    res.json({
      success: true,
      data: knowledge
    });
    
  } catch (error) {
    console.error(`[进化 API] 更新知识库失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
