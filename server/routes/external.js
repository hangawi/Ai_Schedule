const express = require('express');
const router = express.Router();
const externalController = require('../controllers/externalController');

router.post('/invite', externalController.inviteExternal);
router.get('/availability/:token', externalController.getAvailabilityPage);
router.post('/availability/:token', externalController.submitAvailability);

module.exports = router;