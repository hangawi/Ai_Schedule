const express = require('express');
const router = express.Router();
const coordinationController = require('../controllers/coordinationController');
const auth = require('../middleware/auth');

// Room management
router.post('/rooms', auth, coordinationController.createRoom);
router.get('/rooms/exchange-counts', auth, coordinationController.getRoomExchangeCounts); // 이거를 먼저 배치
router.put('/rooms/:roomId', auth, coordinationController.updateRoom);
router.delete('/rooms/:roomId', auth, coordinationController.deleteRoom);
router.post('/rooms/:inviteCode/join', auth, coordinationController.joinRoom);
router.get('/rooms/:roomId', auth, coordinationController.getRoomDetails);
router.get('/my-rooms', auth, coordinationController.getMyRooms);

// TimeSlot management
router.post('/rooms/:roomId/slots', auth, coordinationController.submitTimeSlots);
router.post('/rooms/:roomId/slots/remove', auth, coordinationController.removeTimeSlot);
router.post('/rooms/:roomId/assign', auth, coordinationController.assignTimeSlot);

// Request management
router.post('/requests', auth, coordinationController.createRequest);
router.post('/requests/:requestId/:action', auth, coordinationController.handleRequest);
router.get('/sent-requests', auth, coordinationController.getSentRequests);
router.get('/exchange-requests-count', auth, coordinationController.getExchangeRequestsCount);

module.exports = router;
