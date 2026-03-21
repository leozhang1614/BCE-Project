/**
 * 飞书卡片处理（v3.2 幂等性检查）
 * 交互式卡片（带按钮）
 */

const express = require('express');
const router = express.Router();
const occSync = require('./occ-sync');

/**
 * POST /api/feishu/card-callback - 处理卡片按钮点击
 */
router.post('/card-callback', async (req, res) => {
  try {
    const { action, taskId, userId } = req.body.value || req.body;
    
    console.log(`[飞书卡片] 收到回调：action=${action}, taskId=${taskId}, userId=${userId}`);
    
    // 1. 先获取任务当前状态
    const task = await getTask(taskId);
    if (!task) {
      return res.json({ 
        success: false, 
        message: '任务不存在' 
      });
    }
    
    // 2. 幂等性检查 ✅ v3.2 新增
    if (action === 'confirm_task') {
      if (task.status === 'confirmed') {
        return res.json({ 
          success: false, 
          message: '⚠️ 任务已确认，请勿重复操作' 
        });
      }
      
      if (task.assignee !== userId) {
        return res.json({ 
          success: false, 
          message: '⚠️ 你不是该任务的负责人' 
        });
      }
    }
    
    if (action === 'reject_task') {
      if (task.status === 'rejected') {
        return res.json({ 
          success: false, 
          message: '⚠️ 任务已驳回，请勿重复操作' 
        });
      }
    }
    
    // 3. 执行操作
    if (action === 'confirm_task') {
      await occSync.confirmTask(taskId, userId);
      
      // 4. 通知上一节点（动态计算）
      const previousHandler = getPreviousHandler(task);
      await sendFeishuCard(previousHandler, {
        header: { 
          template: "green",
          title: { content: "✅ 任务已确认" } 
        },
        elements: [{
          tag: "div",
          text: { 
            content: `${userId} 已确认接收任务：${task.title}`,
            tag: "lark_md" 
          }
        }]
      });
      
      return res.json({ success: true, message: '任务已确认' });
      
    } else if (action === 'reject_task') {
      await occSync.rejectTask(taskId, userId);
      
      return res.json({ success: true, message: '任务已驳回' });
    }
    
    res.json({ success: false, message: '未知操作' });
    
  } catch (error) {
    console.error('[飞书卡片] 处理回调失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 构建任务分配卡片
 */
function buildTaskAssignCard(task, assignee) {
  return {
    config: {
      wide_screen_mode: true
    },
    header: {
      template: "blue",
      title: {
        content: "📋 新任务分配",
        tag: "plain_text"
      }
    },
    elements: [
      {
        tag: "div",
        text: {
          content: `**任务名称**：${task.title}\n**优先级**：${task.priority}\n**截止时间**：${task.deadline || '无'}`,
          tag: "lark_md"
        }
      },
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: {
              content: "✅ 确认接收",
              tag: "plain_text"
            },
            type: "primary",
            value: {
              action: "confirm_task",
              taskId: task.id,
              userId: assignee
            }
          },
          {
            tag: "button",
            text: {
              content: "❌ 驳回",
              tag: "plain_text"
            },
            type: "default",
            value: {
              action: "reject_task",
              taskId: task.id,
              userId: assignee
            }
          }
        ]
      }
    ]
  };
}

/**
 * 构建任务转交卡片
 */
function buildTaskTransferCard(task, from, to, comment) {
  return {
    config: {
      wide_screen_mode: true
    },
    header: {
      template: "orange",
      title: {
        content: "🔄 任务已转交",
        tag: "plain_text"
      }
    },
    elements: [
      {
        tag: "div",
        text: {
          content: `**任务名称**：${task.title}\n**转交人**：${from}\n**接收人**：${to}\n**备注**：${comment || '无'}`,
          tag: "lark_md"
        }
      }
    ]
  };
}

/**
 * 发送飞书卡片
 */
async function sendFeishuCard(receiveId, card) {
  // 实际实现需要调用飞书 API
  console.log(`[飞书卡片] 发送给 ${receiveId}:`, card.header.title.content);
}

/**
 * 获取任务
 */
async function getTask(taskId) {
  // 从 OCC 或本地获取任务
  return occSync.getTask(taskId);
}

/**
 * 获取上一节点（动态计算）
 */
function getPreviousHandler(task) {
  if (task.transferHistory && task.transferHistory.length > 0) {
    const last = task.transferHistory[task.transferHistory.length - 1];
    return last.from;
  }
  return task.creator;
}

module.exports = router;
module.exports.buildTaskAssignCard = buildTaskAssignCard;
module.exports.buildTaskTransferCard = buildTaskTransferCard;
module.exports.sendFeishuCard = sendFeishuCard;
