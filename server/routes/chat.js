const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const auth = require('../middleware/auth');

// 모든 채팅 API는 인증 필요
router.use(auth);

// 채팅 내역 조회
router.get('/:roomId', chatController.getMessages);

// 메시지 전송
router.post('/:roomId', chatController.sendMessage);

// AI 일정 제안 확정
router.post('/:roomId/confirm', chatController.confirmSchedule);

module.exports = router;
