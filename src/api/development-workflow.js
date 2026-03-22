/**
 * BCE 开发任务标准工作流 API
 */

const express = require('express');
const router = express.Router();
const workflow = require('../services/development-workflow');

/**
 * POST /api/dev-workflow/tasks
 * 创建开发任务
 */
router.post('/tasks', async (req, res) => {
  try {
    const { title, description, developer, projectOwner } = req.body;
    
    if (!title || !developer || !projectOwner) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段：title, developer, projectOwner'
      });
    }
    
    const task = await workflow.createDevelopmentTask({
      title,
      description,
      developer,
      projectOwner
    });
    
    res.json({
      success: true,
      data: task,
      message: '开发任务已创建，当前状态：开发中'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/dev-workflow/tasks/:id/submit-acceptance
 * 开发完成，提交验收
 */
router.post('/tasks/:id/submit-acceptance', async (req, res) => {
  try {
    const { id } = req.params;
    const { developer, deliverables } = req.body;
    
    if (!developer || !deliverables) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段：developer, deliverables'
      });
    }
    
    const task = await workflow.submitForAcceptance(id, developer, deliverables);
    
    res.json({
      success: true,
      data: task,
      message: '已提交验收，等待项目负责人验收'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/dev-workflow/tasks/:id/submit-audit
 * 验收通过，提交审核
 */
router.post('/tasks/:id/submit-audit', async (req, res) => {
  try {
    const { id } = req.params;
    const { projectOwner, acceptanceReport } = req.body;
    
    if (!projectOwner || !acceptanceReport) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段：projectOwner, acceptanceReport'
      });
    }
    
    const task = await workflow.submitForAudit(id, projectOwner, acceptanceReport);
    
    res.json({
      success: true,
      data: task,
      message: '已提交审核，等待执矩审核'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/dev-workflow/tasks/:id/audit-pass
 * 审核通过
 */
router.post('/tasks/:id/audit-pass', async (req, res) => {
  try {
    const { id } = req.params;
    const { auditor, auditComments } = req.body;
    
    if (!auditor) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段：auditor'
      });
    }
    
    const task = await workflow.auditPass(id, auditor, auditComments);
    
    res.json({
      success: true,
      data: task,
      message: '✅ 审核通过，任务已完成'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/dev-workflow/tasks/:id/audit-reject
 * 审核不通过，回退到开发节点（重点！）
 */
router.post('/tasks/:id/audit-reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { auditor, rejectReason } = req.body;
    
    if (!auditor || !rejectReason) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段：auditor, rejectReason'
      });
    }
    
    const task = await workflow.auditReject(id, auditor, rejectReason);
    
    res.json({
      success: true,
      data: task,
      message: '❌ 审核不通过，已回退到开发节点，需要重新开发 → 重新验收 → 重新审核',
      workflow: {
        currentNode: 'development',
        rollbackTo: 'development',
        reflowRequired: true,
        nextSteps: ['重新开发', '重新验收', '重新审核']
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/dev-workflow/tasks/:id/status
 * 获取任务工作流状态
 */
router.get('/tasks/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const status = await workflow.getWorkflowStatus(id);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/dev-workflow/tasks
 * 获取所有开发任务
 */
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await workflow.getAllDevelopmentTasks();
    
    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
