const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

router.get('/me', auth, userController.getMe);
router.put('/me', auth, userController.updateMe);

// Routes for user schedule (더 구체적인 경로를 먼저)
router.get('/profile/schedule', auth, userController.getUserSchedule);
router.put('/profile/schedule', auth, userController.updateUserSchedule);

// Routes for user profile (자신의 프로필 조회/수정) - /profile/:userId보다 먼저
router.get('/profile', auth, userController.getUserProfile);
router.put('/profile', auth, userController.updateUserProfile);

// Routes for user profile (다른 사용자 프로필 조회) - 파라미터 라우트는 마지막에
router.get('/profile/:userId', auth, userController.getUserProfileById);

router.get('/:userId/schedule', auth, userController.getUserScheduleById);

router.post('/connect-calendar', auth, userController.connectCalendar);

module.exports = router;