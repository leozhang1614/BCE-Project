/**
 * Qwen3.5-Plus AI 分析引擎服务
 * 
 * 功能：
 * 1. 调用 Qwen3.5-Plus API 进行三维分析
 * 2. 生成投资建议
 * 3. 支持流式输出
 */

const https = require('https');

class QwenAnalysisService {
  constructor() {
    this.apiKey = process.env.QWEN_API_KEY;
    this.endpoint = 'dashscope.aliyuncs.com';
    this.model = 'qwen3.5-plus';
  }

  /**
   * 三维分析（技术面 + 基本面 + 消息面）
   */
  async analyze3D(stockCode, stockName) {
    console.log(`[AI 分析] 开始分析：${stockCode} ${stockName}`);
    
    const prompt = `你是一位专业的股票分析师，请对${stockCode} ${stockName}进行三维分析：

## 分析维度
1. **技术面分析**
   - 趋势分析（短期/中期/长期）
   - 支撑位和压力位
   - 成交量分析
   - 技术指标（MACD/KDJ/RSI）

2. **基本面分析**
   - 估值水平（PE/PB/PS）
   - 盈利能力（ROE/毛利率/净利率）
   - 成长性（营收增长/利润增长）
   - 财务状况（负债率/现金流）

3. **消息面分析**
   - 行业政策
   - 公司动态
   - 市场情绪
   - 资金流向

## 输出格式
请严格按照以下 JSON 格式输出：
{
  "stockCode": "股票代码",
  "stockName": "股票名称",
  "analysisDate": "分析日期",
  "technical": {
    "trend": "趋势判断",
    "support": "支撑位",
    "resistance": "压力位",
    "volume": "成交量分析",
    "indicators": "技术指标分析"
  },
  "fundamental": {
    "valuation": "估值分析",
    "profitability": "盈利能力",
    "growth": "成长性",
    "financial": "财务状况"
  },
  "news": {
    "policy": "行业政策",
    "company": "公司动态",
    "sentiment": "市场情绪",
    "capital": "资金流向"
  },
  "recommendation": {
    "rating": "推荐评级（买入/增持/中性/减持/卖出）",
    "targetPrice": "目标价格",
    "stopLoss": "止损位",
    "confidence": "置信度（0-100）",
    "reason": "推荐理由"
  }
}`;

    try {
      const result = await this.callQwenAPI(prompt);
      console.log(`[AI 分析] 分析完成：${stockCode}`);
      return result;
    } catch (error) {
      console.error(`[AI 分析] 分析失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 调用 Qwen3.5-Plus API
   */
  async callQwenAPI(prompt) {
    return new Promise((resolve, reject) => {
      const requestBody = JSON.stringify({
        model: this.model,
        input: {
          messages: [
            {
              role: 'system',
              content: '你是一位专业的股票分析师，擅长技术面、基本面和消息面分析。请严格按照 JSON 格式输出分析结果。'
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        parameters: {
          result_format: 'json',
          temperature: 0.7,
          max_tokens: 2000
        }
      });

      const options = {
        hostname: this.endpoint,
        port: 443,
        path: '/api/v1/services/aigc/text-generation/generation',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.output && result.output.choices && result.output.choices[0]) {
              const content = result.output.choices[0].message.content;
              // 尝试解析 JSON
              try {
                const analysis = JSON.parse(content);
                resolve(analysis);
              } catch (e) {
                // 如果不是纯 JSON，返回原始内容
                resolve({ content: content });
              }
            } else {
              reject(new Error(result.message || 'API 返回格式错误'));
            }
          } catch (e) {
            reject(new Error(`解析响应失败：${e.message}`));
          }
        });
      });

      req.on('error', reject);
      req.write(requestBody);
      req.end();
    });
  }

  /**
   * 批量分析股票组合
   */
  async analyzePortfolio(stocks) {
    console.log(`[AI 分析] 开始批量分析 ${stocks.length} 只股票`);
    
    const results = [];
    for (const stock of stocks) {
      try {
        const analysis = await this.analyze3D(stock.code, stock.name);
        results.push({
          ...stock,
          analysis: analysis,
          analyzedAt: new Date().toISOString()
        });
        
        // 避免 API 限流，间隔 1 秒
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[AI 分析] ${stock.code} 分析失败：${error.message}`);
        results.push({
          ...stock,
          error: error.message,
          analyzedAt: new Date().toISOString()
        });
      }
    }
    
    return results;
  }
}

module.exports = QwenAnalysisService;
