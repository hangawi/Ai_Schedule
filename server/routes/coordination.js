const express = require('express');
const router = express.Router();
const coordinationController = require('../controllers/coordinationController');
const timeSlotController = require('../controllers/timeSlotController');
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

// Member management
router.delete('/rooms/:roomId/members/:memberId', auth, coordinationController.removeMember);

// TimeSlot management
router.post('/rooms/:roomId/slots', auth, coordinationController.submitTimeSlots);
router.post('/rooms/:roomId/slots/remove', auth, coordinationController.removeTimeSlot);
router.post('/rooms/:roomId/assign', auth, coordinationController.assignTimeSlot);
router.delete('/rooms/:roomId/time-slots', auth, coordinationController.deleteAllTimeSlots);

// AI-based scheduling
router.post('/rooms/:roomId/find-common-slots', auth, coordinationController.findCommonSlots);
router.post('/rooms/:roomId/run-schedule', auth, coordinationController.runAutoSchedule);

// Request management
router.post('/requests', auth, coordinationController.createRequest);
router.post('/requests/:requestId/:action', auth, coordinationController.handleRequest);
router.delete('/requests/:requestId', auth, coordinationController.cancelRequest);
router.get('/sent-requests', auth, coordinationController.getSentRequests);
router.get('/received-requests', auth, coordinationController.getReceivedRequests);
router.get('/exchange-requests-count', auth, coordinationController.getExchangeRequestsCount);

// Negotiation management
router.get('/rooms/:roomId/negotiations', auth, coordinationController.getNegotiations);
router.post('/rooms/:roomId/negotiations/:negotiationId/messages', auth, coordinationController.addNegotiationMessage);
router.post('/rooms/:roomId/negotiations/:negotiationId/resolve', auth, coordinationController.resolveNegotiation);
router.post('/rooms/:roomId/negotiations/:negotiationId/respond', auth, coordinationController.respondToNegotiation);
router.post('/rooms/:roomId/negotiations/:negotiationId/cancel', auth, coordinationController.cancelNegotiationResponse);
router.post('/rooms/:roomId/negotiations/auto-resolve', auth, coordinationController.autoResolveTimeoutNegotiations);
router.post('/rooms/:roomId/negotiations/:negotiationId/force-resolve', auth, coordinationController.forceResolveNegotiation);
router.delete('/rooms/:roomId/negotiations', auth, coordinationController.clearAllNegotiations);
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

module.exports = router;