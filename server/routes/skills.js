const express = require('express');
const router = express.Router();
const skills = require('../services/skills');

// List all skills
router.get('/', (req, res) => {
  res.json({ ok: true, skills: skills.listSkills() });
});

// Toggle a skill
router.post('/:id/toggle', (req, res) => {
  const { enabled } = req.body;
  skills.toggleSkill(req.params.id, !!enabled);
  res.json({ ok: true });
});

// Update skill config
router.post('/:id/config', (req, res) => {
  skills.updateSkillConfig(req.params.id, req.body);
  res.json({ ok: true });
});

module.exports = router;
