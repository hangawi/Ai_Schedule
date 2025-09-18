const express = require('express');
const router = express.Router();
const coordinationController = require('../controllers/coordinationController');
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

// TimeSlot management
router.post('/rooms/:roomId/slots', auth, coordinationController.submitTimeSlots);
router.post('/rooms/:roomId/slots/remove', auth, coordinationController.removeTimeSlot);
router.post('/rooms/:roomId/assign', auth, coordinationController.assignTimeSlot);

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
router.post('/rooms/:roomId/negotiations/auto-resolve', auth, coordinationController.autoResolveTimeoutNegotiations);
router.post('/rooms/:roomId/negotiations/:negotiationId/force-resolve', auth, coordinationController.forceResolveNegotiation);

module.exports = router;
// @desc    Handle a request (approve/reject)
  // @route   POST /api/coordination/requests/:requestId/:action
  // @access  Private
  exports.handleRequest = async (req, res) => {
     try {
        const { requestId, action } = req.params;
        const { message } = req.body;

        console.log('handleRequest called with:', { requestId, action, message, userId: req.user.id });

        // Validate action parameter
        if (!['approved', 'rejected'].includes(action)) {
           return res.status(400).json({ msg: '유효하지 않은 액션입니다. approved 또는 rejected만 허용됩니다.' });
        }

        // Find room containing the request
        const room = await Room.findOne({ 'requests._id': requestId })
           .populate('requests.requester', 'firstName lastName email')
           .populate('requests.targetUser', 'firstName lastName email')
           .populate('timeSlots.user', 'firstName lastName email')
           .populate('members.user', 'firstName lastName email');

        if (!room) {
           return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
        }

        const request = room.requests.id(requestId);
        if (!request) {
           return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
        }

        // Verify the user has permission to handle this request
        const isOwner = room.isOwner(req.user.id);
        const isTargetUser = request.targetUser && request.targetUser._id.toString() === req.user.id;

        if (!isOwner && !isTargetUser) {
           return res.status(403).json({ msg: '이 요청을 처리할 권한이 없습니다.' });
        }

        if (request.status !== 'pending') {
           return res.status(400).json({ msg: '이미 처리된 요청입니다.' });
        }

        const now = new Date();
        request.status = action; // 'approved' or 'rejected'
        request.respondedAt = now;
        request.respondedBy = req.user.id;
        request.response = message || '';

        // If approved, modify time slots
        if (action === 'approved') {
           const { type, timeSlot, targetUser, requester } = request;

           if (type === 'slot_release') {
              room.timeSlots = room.timeSlots.filter(slot => {
                 const slotUserId = slot.user._id || slot.user;
                 return !(
                    slotUserId.toString() === requester._id.toString() &&
                    slot.day === timeSlot.day &&
                    slot.startTime === timeSlot.startTime
                 );
              });
           } else if (type === 'slot_swap' && targetUser) {
              const targetSlotIndex = room.timeSlots.findIndex(slot => {
                  const slotUserId = slot.user._id ? slot.user._id.toString() : slot.user.toString();
                  return (
                      slotUserId === targetUser._id.toString() &&
                      slot.day === timeSlot.day &&
                      slot.startTime === timeSlot.startTime
                  );
              });

              if (targetSlotIndex !== -1) {
                  // The requester takes over the target's slot.
                  room.timeSlots[targetSlotIndex].user = requester._id;
              }
           } else if (type === 'time_request' || type === 'time_change') {
              const calculateDateFromDay = (dayName) => {
                 const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                 const dayIndex = daysOfWeek.indexOf(dayName.toLowerCase());
                 if (dayIndex === -1) return new Date();

                 const currentDate = new Date();
                 const currentDay = currentDate.getDay();
                 const diff = dayIndex - currentDay;
                 const targetDate = new Date(currentDate);
                 targetDate.setDate(currentDate.getDate() + diff);
                 return targetDate;
              };

              room.timeSlots.push({
                 user: requester._id,
                 date: calculateDateFromDay(timeSlot.day),
                 startTime: timeSlot.startTime,
                 endTime: timeSlot.endTime,
                 day: timeSlot.day,
                 subject: timeSlot.subject || 'Assigned Task',
                 status: 'confirmed'
              });
           }
        }

        await room.save();

        // Return updated room
        const updatedRoom = await Room.findById(room._id)
           .populate('requests.requester', 'firstName lastName email')
           .populate('requests.targetUser', 'firstName lastName email')
           .populate('timeSlots.user', 'firstName lastName email')
           .populate('members.user', 'firstName lastName email');

        res.json(updatedRoom);
     } catch (error) {
        console.error('Error handling request:', error);
        res.status(500).json({ msg: 'Server error' });
     }
  };