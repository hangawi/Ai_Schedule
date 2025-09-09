const express = require('express');
const router = express.Router();
const coordinationController = require('../controllers/coordinationController');
const auth = require('../middleware/auth');

// Room management
router.post('/rooms', auth, coordinationController.createRoom);
router.put('/rooms/:roomId', auth, coordinationController.updateRoom);
router.delete('/rooms/:roomId', auth, coordinationController.deleteRoom);
router.post('/rooms/:inviteCode/join', auth, coordinationController.joinRoom);
router.get('/rooms/:roomId', auth, coordinationController.getRoomDetails);
router.get('/my-rooms', auth, coordinationController.getMyRooms);

// Member management
router.delete('/rooms/:roomId/members/:memberId', auth, coordinationController.removeMember);

// TimeSlot management
router.post('/rooms/:roomId/slots', auth, coordinationController.submitTimeSlots);
router.delete('/rooms/:roomId/slots', auth, coordinationController.removeTimeSlot); // New route for removing specific slots
router.post('/rooms/:roomId/assign-slot', auth, coordinationController.assignTimeSlot); // New route for assigning slots
router.post('/rooms/:roomId/auto-assign', auth, coordinationController.autoAssignSlots); // Auto-assign slots
router.delete('/rooms/:roomId/slots/:slotId', auth, coordinationController.deleteTimeSlot); // New route for deleting assigned slots

// Request management
router.post('/requests', auth, coordinationController.createRequest);
router.put('/requests/:requestId', auth, coordinationController.handleRequest);
router.get('/rooms/:roomId/requests', auth, coordinationController.getRequestsForRoom);

module.exports = router;
