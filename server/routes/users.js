const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

router.get('/me', auth, userController.getMe);
router.put('/me', auth, userController.updateMe);

// Routes for user schedule
router.get('/profile/schedule', auth, userController.getUserSchedule);
router.put('/profile/schedule', auth, userController.updateUserSchedule);

// Routes for user profile (주소 조회)
router.get('/profile/:userId', auth, userController.getUserProfileById);

router.get('/:userId/schedule', auth, userController.getUserScheduleById);

router.post('/connect-calendar', auth, userController.connectCalendar);

module.exports = router;