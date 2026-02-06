const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const auth = require('../middleware/auth');

// 모든 채팅 API는 인증 필요
router.use(auth);

// AI 오타 교정 (roomId 없는 경로이므로 먼저 정의)
router.post('/correct-typo', chatController.correctTypo);

// 채팅 내역 조회
router.get('/:roomId', chatController.getMessages);

// 메시지 전송
router.post('/:roomId', chatController.sendMessage);

// 메시지 삭제
router.delete('/:roomId/message/:messageId', chatController.deleteMessage);

// 파일 업로드
router.post('/:roomId/upload', chatController.uploadFile);

// AI 일정 제안 충돌 체크
router.post('/:roomId/check-conflict', chatController.checkScheduleConflict);

// AI 일정 제안 확정
router.post('/:roomId/confirm', chatController.confirmSchedule);

// AI 일정 제안 거절
router.post('/:roomId/reject', chatController.rejectSchedule);

// 메시지 읽음 처리
router.post('/:roomId/read', chatController.markAsRead);

// 일정 제안 관리
router.get('/:roomId/suggestions', chatController.getSuggestions);
router.post('/:roomId/suggestions/:suggestionId/accept', chatController.acceptSuggestion);
router.post('/:roomId/suggestions/:suggestionId/force-accept', chatController.forceAcceptSuggestion); // 🆕 강제 참석 (충돌 무시)
router.post('/:roomId/suggestions/:suggestionId/reject', chatController.rejectSuggestion);
router.delete('/:roomId/suggestions/:suggestionId', chatController.deleteSuggestion);

// 🆕 일정 삭제로 인한 불참 알림
router.post('/:roomId/member-decline', chatController.notifyMemberDecline);

module.exports = router;
