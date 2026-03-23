/**
 * 定时任务调度服务（v3.2 最终版 - 每个 Agent 定时抓取）
 * 
 * 核心逻辑：
 * 1. 每个成员一个定时任务代理
 * 2. 每 5 分钟查询分给该成员的新增任务
 * 3. 发现新任务 → 飞书通知 @该成员
 * 4. 记录已通知，避免重复
 */

const http = require('http');
const https = require('https');

// 配置
const CHECK_INTERVAL = parseInt(process.env.SCHEDULER_INTERVAL) || 5 * 60 * 1000; // 5 分钟
const NOTIFY_WINDOW = parseInt(process.env.SCHEDULER_NOTIFY_WINDOW) || 24 * 60 * 60 * 1000; // 24 小时内创建的任务（移除时间窗口限制）

// 唤醒级别配置
const WAKEUP_L1_DELAY = 0;        // 第 1 级：立即（任务创建时）
const WAKEUP_L2_DELAY = 5 * 60;   // 第 2 级：5 分钟（飞书@提醒）
const WAKEUP_L3_DELAY = 10 * 60;  // 第 3 级：10 分钟（飞书私信 + 短信）
const WAKEUP_L4_DELAY = 15 * 60;  // 第 4 级：15 分钟（电话 +@创建人）

// 成员列表
const AGENTS = ['天枢', '匠心', '司库', '执矩', '磐石', '灵犀', '天策'];

// 飞书配置
const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const FEISHU_CHAT_ID = process.env.FEISHU_CHAT_ID;

// 用户 ID 映射
const USER_ID_MAP = {
  '天枢': 'ou_82e24fd5850f184e395ecaa7d11a1ddc',
  '匠心': 'ou_11b23f47253fc3551ffed488527c7740',
  '司库': 'ou_998d07ddc86ad7ba9d4dd12dddc55cc6',
  '执矩': 'ou_aaeb25dcae8616029a9d36906892bd05',
  '磐石': 'ou_dba586c77d92f652e427370d3f54cc54',
  '灵犀': 'ou_afd48fe16ccb4d2ba8a56235eb29d784',
  '天策': 'ou_3a2c50c8eb0338734362a741c934da8f'
};

// 缓存 token
let tenantAccessToken = null;
let tokenExpiresAt = 0;

// 已通知记录（避免重复通知）
const notifiedTasks = new Set();

class SchedulerService {
  constructor() {
    this.agentIntervals = new Map(); // 每个成员的定时器
  }

  /**
   * 启动所有成员的定时任务
   */
  start() {
    console.log('[定时任务] 启动每个 Agent 的定时抓取服务');
    console.log(`[定时任务] 配置：检查间隔=${CHECK_INTERVAL/1000}秒，通知窗口=${NOTIFY_WINDOW/1000}秒`);
    console.log(`[定时任务] 成员列表：${AGENTS.join(', ')}`);

    // 为每个成员启动定时任务
    AGENTS.forEach(agent => {
      this.startAgentScheduler(agent);
    });

    console.log('[定时任务] 所有成员的定时任务已启动');
  }

  /**
   * 启动单个成员的定时任务
   */
  startAgentScheduler(agent) {
    // 立即执行一次
    this.checkNewTasksForAgent(agent);

    // 定时执行
    const intervalId = setInterval(() => {
      this.checkNewTasksForAgent(agent);
    }, CHECK_INTERVAL);

    this.agentIntervals.set(agent, intervalId);
    console.log(`[定时任务] ${agent} 的定时任务已启动（每${CHECK_INTERVAL/1000}秒）`);
  }

  /**
   * 停止所有定时任务
   */
  stop() {
    this.agentIntervals.forEach((intervalId, agent) => {
      clearInterval(intervalId);
      console.log(`[定时任务] ${agent} 的定时任务已停止`);
    });
    this.agentIntervals.clear();
  }

  /**
   * 查询并通知成员的待确认任务（多级唤醒）
   * 核心逻辑：所有待办任务都需要确认（开发/验收/审核）
   */
  async checkNewTasksForAgent(agent) {
    console.log(`\n[定时任务] ${agent}: 开始查询待确认任务`);

    try {
      // 1. 获取所有任务
      const tasks = await this.getTasks();
      console.log(`[定时任务] ${agent}: getTasks() 返回 ${tasks.length} 个任务`);

      // 2. 筛选所有分给该成员且未确认的任务（无论什么环节）
      const now = Date.now();
      const unconfirmedTasks = tasks.filter(task => {
        // 分给该成员（包括 assignee/reviewer/auditor）
        const isAssignee = task.assignee === agent;
        const isReviewer = task.reviewer === agent;
        const isAuditor = task.auditor === agent;
        
        if (!isAssignee && !isReviewer && !isAuditor) return false;
        
        // 未确认
        if (task.confirmedAt) return false;
        
        // 24 小时内更新
        const updatedAt = new Date(task.updatedAt || task.createdAt).getTime();
        return (now - updatedAt) <= 24 * 60 * 60 * 1000;
      });

      console.log(`[定时任务] ${agent}: 筛选后待确认任务数: ${unconfirmedTasks.length}`);
      
      if (unconfirmedTasks.length === 0) {
        console.log(`[定时任务] ${agent}: 没有待确认任务`);
        // 调试：打印所有任务信息
        const agentTasks = tasks.filter(t => t.assignee === agent);
        console.log(`[定时任务] ${agent}: 分给该成员的任务数: ${agentTasks.length}`);
        if (agentTasks.length > 0) {
          console.log(`[定时任务] ${agent}: 任务详情:`);
          agentTasks.forEach((t, i) => {
            console.log(`  ${i+1}. ${t.title} - 确认状态: ${t.confirmedAt ? '已确认' : '未确认'}`);
          });
        }
        return;
      }

      // 3. 按未确认时间分级处理
      for (const task of unconfirmedTasks) {
        const createdAt = new Date(task.createdAt).getTime();
        const elapsedSeconds = (now - createdAt) / 1000;
        
        // 判断唤醒级别
        let wakeupLevel = 0;
        if (elapsedSeconds >= WAKEUP_L4_DELAY) wakeupLevel = 4;
        else if (elapsedSeconds >= WAKEUP_L3_DELAY) wakeupLevel = 3;
        else if (elapsedSeconds >= WAKEUP_L2_DELAY) wakeupLevel = 2;
        else wakeupLevel = 1;
        
        // 检查是否已发送过该级别的通知
        const notificationKey = `${task.id}_L${wakeupLevel}`;
        if (notifiedTasks.has(notificationKey)) continue;
        
        // ✅ 先执行终端告警（不依赖飞书）
        this.printAlert(agent, task, wakeupLevel, elapsedSeconds);
        
        // 执行对应级别的唤醒（飞书通知，失败不影响）
        try {
          await this.wakeupAgent(agent, task, wakeupLevel);
        } catch (error) {
          console.log(`[唤醒] 飞书通知失败（终端告警已输出）: ${error.message}`);
        }
        
        // 记录已通知
        notifiedTasks.add(notificationKey);
      }

      console.log(`[定时任务] ${agent}: 唤醒检查完成`);

    } catch (error) {
      console.error(`[定时任务] ${agent}: 查询失败:`, error.message);
    }
  }

  /**
   * 发送新任务通知
   */
  async notifyNewTasks(agent, tasks) {
    const taskList = tasks.map((t, i) => `${i + 1}. ${t.title} (优先级：${t.priority || 'P3'})`).join('\n');
    
    const message = `🔔 ${agent}，你有 ${tasks.length} 个新任务需要处理：

${taskList}

⏰ 请及时确认并开始执行！
查看详情：http://192.168.31.187:3000/bce-tasks.html`;

    await this.sendFeishuMessage(message, agent);
  }

  /**
   * 打印终端告警（定时任务本身就是通知）
   */
  printAlert(agent, task, level, elapsedMinutes) {
    const fs = require('fs');
    const path = require('path');
    
    console.log('\n\n' + '='.repeat(60));
    console.log(`⚠️  任务待确认告警 [第${level}级唤醒]`);
    console.log('='.repeat(60));
    console.log(`执行者：${agent}`);
    console.log(`任  务：${task.title}`);
    console.log(`优先级：${task.priority || 'P3'}`);
    console.log(`已等待：${Math.floor(elapsedMinutes / 60)}分钟`);
    console.log(`创建人：${task.creator}`);
    console.log('='.repeat(60));
    console.log('请尽快确认任务：http://192.168.31.187:3000/bce-tasks.html');
    console.log('='.repeat(60) + '\n\n');
    
    // 刷新 stdout，确保立即输出
    process.stdout.write('');
    
    // 记录到告警日志文件
    const alertLog = `[${new Date().toISOString()}] ${agent} 有待确认任务：${task.title} (已等待${Math.floor(elapsedMinutes / 60)}分钟)\n`;
    const alertLogPath = path.join(__dirname, '../../runtime/alerts.log');
    fs.appendFileSync(alertLogPath, alertLog);
  }

  /**
   * 分级唤醒 Agent（仅飞书通知）
   */
  async wakeupAgent(agent, task, level) {
    const elapsedMinutes = Math.floor((Date.now() - new Date(task.createdAt).getTime()) / 60000);
    
    let message = '';
    
    switch (level) {
      case 1:
        message = `📋 新任务通知

负责人：<at user_id="${USER_ID_MAP[agent]}">${agent}</at>
任务：${task.title}
优先级：${task.priority || 'P3'}
创建人：${task.creator}

👉 请及时确认并开始执行！
查看任务：http://192.168.31.187:3000/bce-tasks.html`;
        await this.sendFeishuMessage(message);
        console.log(`[唤醒] ${agent}: 第 1 级唤醒（群@通知）已发送`);
        break;
        
      case 2:
        message = `⚠️ 任务待确认提醒

<at user_id="${USER_ID_MAP[agent]}">${agent}</at>，你有任务已等待 5 分钟未确认！

任务：${task.title}
优先级：${task.priority || 'P3'}

🔔 请立即确认并开始执行！`;
        await this.sendFeishuMessage(message);
        console.log(`[唤醒] ${agent}: 第 2 级唤醒（群@强提醒）已发送`);
        break;
        
      case 3:
        message = `🚨 紧急提醒

<at user_id="${USER_ID_MAP[agent]}">${agent}</at>，你有任务已等待 10 分钟未确认！

任务：${task.title}

⚠️ 如再不确认，将通知创建人！`;
        await this.sendFeishuMessage(message);
        console.log(`[唤醒] ${agent}: 第 3 级唤醒（群@紧急）已发送`);
        break;
        
      case 4:
        message = `📞 最后通知

<at user_id="${USER_ID_MAP[task.creator]}">${task.creator}</at>，${agent} 的任务已等待 15 分钟未确认！

任务：${task.title}
负责人：<at user_id="${USER_ID_MAP[agent]}">${agent}</at>

🚨 请协助联系！`;
        await this.sendFeishuMessage(message);
        console.log(`[唤醒] ${agent}: 第 4 级唤醒（通知创建人）已发送`);
        break;
    }
  }

  /**
   * 发送飞书消息（群聊@）
   */
  async sendFeishuMessage(text) {
    try {
      const token = await this.getTenantAccessToken();

      const content = {
        text: text
      };

      const body = {
        receive_id: FEISHU_CHAT_ID,
        msg_type: 'text',
        content: JSON.stringify(content)
      };

      return new Promise((resolve, reject) => {
        const req = https.request({
          hostname: 'open.feishu.cn',
          port: 443,
          path: '/open-apis/im/v1/messages?receive_id_type=chat_id',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const result = JSON.parse(data);
              if (result.code === 0) {
                console.log(`[定时任务] 飞书消息发送成功：${result.data.message_id}`);
                resolve(result.data);
              } else {
                reject(new Error(result.msg));
              }
            } catch (e) {
              reject(new Error('解析响应失败'));
            }
          });
        });

        req.on('error', reject);
        req.write(JSON.stringify(body));
        req.end();
      });
    } catch (error) {
      console.error('[定时任务] 飞书消息发送失败:', error.message);
      throw error;
    }
  }

  /**
   * 获取飞书 Token
   */
  async getTenantAccessToken() {
    if (tenantAccessToken && Date.now() < tokenExpiresAt) {
      return tenantAccessToken;
    }

    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET
      });

      const req = https.request({
        hostname: 'open.feishu.cn',
        port: 443,
        path: '/open-apis/auth/v3/tenant_access_token/internal',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
      }, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(responseData);
            if (result.code === 0) {
              tenantAccessToken = result.tenant_access_token;
              tokenExpiresAt = Date.now() + (result.expire - 100) * 1000;
              resolve(tenantAccessToken);
            } else {
              reject(new Error(`获取 token 失败：${result.msg}`));
            }
          } catch (e) {
            reject(new Error('解析响应失败'));
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  /**
   * 获取所有任务
   */
  async getTasks() {
    console.log('[getTasks] 开始查询 BCE API...');
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/bce/tasks',
        method: 'GET'
      }, (res) => {
        console.log(`[getTasks] HTTP 响应状态：${res.statusCode}`);
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log(`[getTasks] 原始响应：${data.substring(0, 200)}...`);
          try {
            const result = JSON.parse(data);
            console.log(`[getTasks] 解析成功，任务数：${result.data ? result.data.length : 0}`);
            resolve(result.data || []);
          } catch (e) {
            console.error('[getTasks] 解析响应失败:', e.message);
            reject(new Error('解析响应失败'));
          }
        });
      });

      req.on('error', (e) => {
        console.error('[getTasks] 请求失败:', e.message);
        reject(e);
      });
      req.end();
    });
  }

  /**
   * 获取调度器状态
   */
  getStatus() {
    return {
      running: this.agentIntervals.size > 0,
      interval: CHECK_INTERVAL,
      notifyWindow: NOTIFY_WINDOW,
      agents: AGENTS,
      notifiedTasks: notifiedTasks.size
    };
  }
}

// 导出单例
module.exports = new SchedulerService();
