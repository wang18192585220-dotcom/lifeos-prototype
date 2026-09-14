const express = require('express');
const router = express.Router();
const wf = require('../services/workflow');

// List workflows
router.get('/', (req, res) => {
  res.json({ ok: true, workflows: wf.listWorkflows() });
});

// Create workflow
router.post('/', (req, res) => {
  try {
    const { name, triggerType, triggerConfig, actionType, actionConfig } = req.body;
    if (!name || !triggerType || !actionType) {
      return res.status(400).json({ ok: false, error: '缺少必填字段' });
    }
    const result = wf.createWorkflow({ name, triggerType, triggerConfig, actionType, actionConfig });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Toggle workflow
router.post('/:id/toggle', (req, res) => {
  wf.toggleWorkflow(req.params.id, !!req.body.enabled);
  res.json({ ok: true });
});

// Delete workflow
router.delete('/:id', (req, res) => {
  wf.deleteWorkflow(req.params.id);
  res.json({ ok: true });
});

// Get workflow logs
router.get('/:id/logs', (req, res) => {
  const logs = wf.getWorkflowLogs(req.params.id);
  res.json({ ok: true, logs });
});

// Manually trigger a workflow
router.post('/:id/run', async (req, res) => {
  try {
    const result = await wf.executeWorkflow(req.params.id);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
