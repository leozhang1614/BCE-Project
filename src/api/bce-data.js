/**
 * 数据源集成 API 路由
 * 
 * 端点：
 * GET /api/bce/data/quote/:stockCode - 实时行情
 * GET /api/bce/data/kline/:stockCode - K 线数据
 * GET /api/bce/data/financial/:stockCode - 财务指标
 * GET /api/bce/data/news/:stockCode - 财经新闻
 */

const express = require('express');
const router = express.Router();
const AkShareService = require('../services/akshare-service');

const akShareService = new AkShareService();

/**
 * GET /api/bce/data/quote/:stockCode
 * 获取实时行情
 */
router.get('/quote/:stockCode', async (req, res) => {
  try {
    const { stockCode } = req.params;
    
    if (!stockCode) {
      return res.status(400).json({ error: '股票代码不能为空' });
    }
    
    console.log(`[数据 API] 获取行情：${stockCode}`);
    
    const quote = await akShareService.getRealtimeQuote(stockCode);
    
    res.json({
      success: true,
      data: quote
    });
    
  } catch (error) {
    console.error(`[数据 API] 获取行情失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bce/data/kline/:stockCode
 * 获取 K 线数据
 */
router.get('/kline/:stockCode', async (req, res) => {
  try {
    const { stockCode } = req.params;
    const { period = 'daily', startDate, endDate } = req.query;
    
    if (!stockCode) {
      return res.status(400).json({ error: '股票代码不能为空' });
    }
    
    console.log(`[数据 API] 获取 K 线：${stockCode} ${period}`);
    
    const kline = await akShareService.getKlineData(stockCode, period, startDate, endDate);
    
    res.json({
      success: true,
      data: kline
    });
    
  } catch (error) {
    console.error(`[数据 API] 获取 K 线失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bce/data/financial/:stockCode
 * 获取财务指标
 */
router.get('/financial/:stockCode', async (req, res) => {
  try {
    const { stockCode } = req.params;
    
    if (!stockCode) {
      return res.status(400).json({ error: '股票代码不能为空' });
    }
    
    console.log(`[数据 API] 获取财务指标：${stockCode}`);
    
    const indicators = await akShareService.getFinancialIndicators(stockCode);
    
    res.json({
      success: true,
      data: indicators
    });
    
  } catch (error) {
    console.error(`[数据 API] 获取财务指标失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bce/data/news/:stockCode
 * 获取财经新闻
 */
router.get('/news/:stockCode', async (req, res) => {
  try {
    const { stockCode } = req.params;
    const { limit = 20 } = req.query;
    
    if (!stockCode) {
      return res.status(400).json({ error: '股票代码不能为空' });
    }
    
    console.log(`[数据 API] 获取新闻：${stockCode}`);
    
    const news = await akShareService.getFinancialNews(stockCode, parseInt(limit));
    
    res.json({
      success: true,
      data: news
    });
    
  } catch (error) {
    console.error(`[数据 API] 获取新闻失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bce/data/policy/:industry
 * 获取行业政策新闻
 */
router.get('/policy/:industry', async (req, res) => {
  try {
    const { industry } = req.params;
    const { limit = 10 } = req.query;
    
    if (!industry) {
      return res.status(400).json({ error: '行业名称不能为空' });
    }
    
    console.log(`[数据 API] 获取政策：${industry}`);
    
    const news = await akShareService.getIndustryPolicyNews(industry, parseInt(limit));
    
    res.json({
      success: true,
      data: news
    });
    
  } catch (error) {
    console.error(`[数据 API] 获取政策失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bce/data/capital/:stockCode
 * 获取资金流向
 */
router.get('/capital/:stockCode', async (req, res) => {
  try {
    const { stockCode } = req.params;
    
    if (!stockCode) {
      return res.status(400).json({ error: '股票代码不能为空' });
    }
    
    console.log(`[数据 API] 获取资金流向：${stockCode}`);
    
    const flow = await akShareService.getCapitalFlow(stockCode);
    
    res.json({
      success: true,
      data: flow
    });
    
  } catch (error) {
    console.error(`[数据 API] 获取资金流向失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
