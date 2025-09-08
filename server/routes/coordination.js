const express = require('express');
const router = express.Router();
const coordinationController = require('../controllers/coordinationController');
const auth = require('../middleware/auth');

// Room management
router.post('/rooms', auth, coordinationController.createRoom);
router.post('/rooms/:inviteCode/join', auth, coordinationController.joinRoom);
router.get('/rooms/:roomId', auth, coordinationController.getRoomDetails);
router.get('/my-rooms', auth, coordinationController.getMyRooms);

// TimeSlot management
router.post('/rooms/:roomId/slots', auth, coordinationController.submitTimeSlots);

// Request management
router.post('/requests', auth, coordinationController.createRequest);
router.put('/requests/:requestId', auth, coordinationController.handleRequest);
router.get('/rooms/:roomId/requests', auth, coordinationController.getRequestsForRoom);

module.exports = router;
