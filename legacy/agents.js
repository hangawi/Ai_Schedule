const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const auth = require('../middleware/auth');

router.get('/', auth, agentController.getAgents);
router.post('/', auth, agentController.createAgent);
router.put('/:id', auth, agentController.updateAgent);

module.exports = router;