/**
 * AI 分析引擎 API 路由
 * 
 * 端点：
 * POST /api/bce/ai/analyze - 单只股票分析
 * POST /api/bce/ai/analyze/portfolio - 批量分析
 * GET /api/bce/ai/analysis/:id - 获取分析结果
 */

const express = require('express');
const router = express.Router();
const QwenAnalysisService = require('../services/qwen-analysis-service');
const AkShareService = require('../services/akshare-service');

const qwenService = new QwenAnalysisService();
const akShareService = new AkShareService();

/**
 * POST /api/bce/ai/analyze
 * 单只股票三维分析
 */
router.post('/analyze', async (req, res) => {
  try {
    const { stockCode, stockName } = req.body;
    
    if (!stockCode) {
      return res.status(400).json({ error: '股票代码不能为空' });
    }
    
    console.log(`[AI API] 收到分析请求：${stockCode}`);
    
    // 获取实时行情
    const quote = await akShareService.getRealtimeQuote(stockCode);
    
    // 调用 AI 分析
    const analysis = await qwenService.analyze3D(stockCode, stockName || quote.name);
    
    // 合并结果
    const result = {
      success: true,
      data: {
        stockCode,
        stockName: stockName || quote.name,
        quote: quote,
        analysis: analysis,
        analyzedAt: new Date().toISOString()
      }
    };
    
    console.log(`[AI API] 分析完成：${stockCode}`);
    res.json(result);
    
  } catch (error) {
    console.error(`[AI API] 分析失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/bce/ai/analyze/portfolio
 * 批量分析股票组合
 */
router.post('/analyze/portfolio', async (req, res) => {
  try {
    const { stocks } = req.body;
    
    if (!stocks || !Array.isArray(stocks)) {
      return res.status(400).json({ error: '股票列表不能为空' });
    }
    
    console.log(`[AI API] 收到批量分析请求：${stocks.length}只股票`);
    
    // 批量分析
    const results = await qwenService.analyzePortfolio(stocks);
    
    const result = {
      success: true,
      count: results.length,
      data: results
    };
    
    console.log(`[AI API] 批量分析完成：${results.length}只`);
    res.json(result);
    
  } catch (error) {
    console.error(`[AI API] 批量分析失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bce/ai/analysis/:id
 * 获取分析结果（从缓存或数据库）
 */
router.get('/analysis/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // TODO: 从数据库获取分析结果
    
    res.json({
      success: true,
      data: {
        id: id,
        // 分析结果数据
      }
    });
    
  } catch (error) {
    console.error(`[AI API] 获取分析结果失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
