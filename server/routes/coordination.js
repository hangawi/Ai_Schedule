/**
 * ===================================================================================================
 * Coordination Routes (일정 조정 라우터)
 * ===================================================================================================
 *
 * 설명: 일정 조정(Coordination) 관련 API 엔드포인트
 *
 * 주요 엔드포인트:
 * - POST /api/coordination/rooms - 방 생성
 * - GET /api/coordination/rooms/:id - 방 조회
 * - POST /api/coordination/requests - 조정 요청 생성
 * - POST /api/coordination/requests/:id/:action - 요청 승인/거절
 * - POST /api/coordination/auto-assign - 자동 배정 실행
 *
 * 관련 파일:
 * - server/controllers/coordinationController.js
 * - server/controllers/coordinationRequestController
 *
 * ===================================================================================================
 */

const express = require('express');
const router = express.Router();
const coordinationController = require('../controllers/coordinationController');
const coordinationSchedulingController = require('../controllers/coordinationSchedulingController');
const timeSlotController = require('../controllers/timeSlotController');
const exchangeRequestController = require('../controllers/coordinationExchangeRequestController');
const auth = require('../middleware/auth');

// Room management
router.post('/rooms', auth, coordinationController.createRoom);
router.get('/rooms/exchange-counts', auth, coordinationController.getRoomExchangeCounts); // 이거를 먼저 배치
router.get('/my-rooms', auth, coordinationController.getMyRooms);

// Member time management (moved before dynamic room routes)
router.post('/reset-carryover/:roomId', auth, coordinationController.resetCarryOverTimes);
router.post('/reset-completed/:roomId', auth, coordinationController.resetCompletedTimes);

router.put('/rooms/:roomId', auth, coordinationController.updateRoom);
router.delete('/rooms/:roomId', auth, coordinationController.deleteRoom);
router.post('/rooms/:inviteCode/join', auth, coordinationController.joinRoom);
router.get('/rooms/:roomId', auth, coordinationController.getRoomDetails);
router.get('/rooms/:roomId/logs', auth, coordinationController.getRoomLogs);
router.post('/rooms/:roomId/clear-logs', auth, coordinationController.clearRoomLogs);
router.delete('/rooms/:roomId/logs/user/:userId', auth, coordinationController.clearUserLogs);

// Member management
router.delete('/rooms/:roomId/members/:memberId', auth, coordinationController.removeMember);
router.delete('/rooms/:roomId/leave', auth, coordinationController.leaveRoom);

// TimeSlot management
router.post('/rooms/:roomId/slots', auth, coordinationController.submitTimeSlots);
router.post('/rooms/:roomId/slots/remove', auth, coordinationController.removeTimeSlot);
router.post('/rooms/:roomId/assign', auth, coordinationController.assignTimeSlot);
router.delete('/rooms/:roomId/time-slots', auth, coordinationController.deleteAllTimeSlots);

// AI-based scheduling
router.post('/rooms/:roomId/find-common-slots', auth, coordinationController.findCommonSlots);
router.post('/rooms/:roomId/run-schedule', auth, coordinationController.runAutoSchedule);
router.post('/rooms/:roomId/confirm-schedule', auth, coordinationSchedulingController.confirmSchedule);

// Dynamic travel time - Available slots (조원용 시간대 조회)
router.get('/rooms/:roomId/available-slots', auth, coordinationSchedulingController.getAvailableSlots);

// Start confirmation timer when travel mode is selected
router.post('/rooms/:roomId/start-confirmation-timer', auth, coordinationSchedulingController.startConfirmationTimer);

// Apply travel mode to schedule (save enhanced schedule to server)
router.post('/rooms/:roomId/apply-travel-mode', auth, coordinationSchedulingController.applyTravelMode);

// Confirm travel mode (make it visible to members)
router.post('/rooms/:roomId/confirm-travel-mode', auth, coordinationSchedulingController.confirmTravelMode);

// Request management
router.post('/requests', auth, coordinationController.createRequest);
// 🔧 더 구체적인 라우트를 먼저 배치
router.post('/requests/:requestId/chain-confirm', auth, coordinationController.handleChainConfirmation);
router.post('/requests/:requestId/:action', auth, coordinationController.handleRequest);
router.delete('/requests/:requestId', auth, coordinationController.cancelRequest);
router.get('/sent-requests', auth, coordinationController.getSentRequests);
router.get('/received-requests', auth, coordinationController.getReceivedRequests);
router.get('/exchange-requests-count', auth, coordinationController.getExchangeRequestsCount);

router.post('/rooms/:roomId/reset-completed-times', auth, timeSlotController.resetCompletedTimes);

// @route   DELETE /api/coordination/rooms/:roomId/members/:memberId/carry-over-history
// @desc    Clear a member's carry-over time and history
// @access  Private (Owner)
router.delete('/rooms/:roomId/members/:memberId/carry-over-history', auth, timeSlotController.clearCarryOverHistory);

// @route   POST /api/coordination/rooms/:roomId/reset-all-stats
// @desc    Reset all stats (completed and carry-over) for all members
// @access  Private (Owner)
router.post('/rooms/:roomId/reset-all-stats', auth, timeSlotController.resetAllMemberStats);

// @route   DELETE /api/coordination/rooms/:roomId/all-carry-over-history
// @desc    Clear all members' carry-over history
// @access  Private (Owner)
router.delete('/rooms/:roomId/all-carry-over-history', auth, timeSlotController.clearAllCarryOverHistories);

// Smart exchange chatbot endpoints
router.post('/rooms/:roomId/parse-exchange-request', auth, coordinationController.parseExchangeRequest);
router.post('/rooms/:roomId/smart-exchange', auth, coordinationController.smartExchange);

// Exchange request endpoints (NEW)
router.post('/rooms/:roomId/exchange-requests', auth, exchangeRequestController.createExchangeRequest);
router.post('/rooms/:roomId/exchange-requests/:requestId/respond', auth, exchangeRequestController.respondToExchangeRequest);
router.get('/exchange-requests/pending', auth, exchangeRequestController.getPendingExchangeRequests);

// Chain exchange request endpoints (4.txt: A → B → C 연쇄 교환)
router.post('/rooms/:roomId/chain-exchange-requests/:requestId/respond', auth, exchangeRequestController.respondToChainExchangeRequest);
router.get('/chain-exchange-requests/pending', auth, exchangeRequestController.getPendingChainExchangeRequests);

module.exports = router;