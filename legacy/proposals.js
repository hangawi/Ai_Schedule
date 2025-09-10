const express = require('express');
const router = express.Router();
const proposalController = require('../controllers/proposalController');
const auth = require('../middleware/auth');

router.post('/', auth, proposalController.createProposal);
router.get('/', auth, proposalController.getProposals);
router.get('/:id', auth, proposalController.getProposalById);
router.put('/:id/suggest', auth, proposalController.suggestTime);
router.put('/:id/finalize', auth, proposalController.finalizeTime);
router.delete('/:id', auth, proposalController.cancelProposal);

module.exports = router;