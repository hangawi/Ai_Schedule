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

// 파일 업로드
router.post('/:roomId/upload', chatController.uploadFile);

// AI 일정 제안 확정
router.post('/:roomId/confirm', chatController.confirmSchedule);

// AI 일정 제안 거절
router.post('/:roomId/reject', chatController.rejectSchedule);

// 메시지 읽음 처리
router.post('/:roomId/read', chatController.markAsRead);

module.exports = router;
