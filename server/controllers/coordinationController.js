const mongoose = require('mongoose');
const Room = require('../models/room');
const User = require('../models/user');
const Event = require('../models/event');
const { findOptimalSlots } = require('../services/schedulingAnalysisService');
const schedulingAlgorithm = require('../services/schedulingAlgorithm');
const { OWNER_COLOR, getAvailableColor } = require('../utils/colorUtils');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Import separated controllers
const roomController = require('./roomController');
const timeSlotController = require('./timeSlotController');

const dayMap = { 0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' };

// Re-export from separated controllers
exports.createRoom = roomController.createRoom;
exports.updateRoom = roomController.updateRoom;
exports.deleteRoom = roomController.deleteRoom;
exports.joinRoom = roomController.joinRoom;
exports.getRoomDetails = roomController.getRoomDetails;
exports.getMyRooms = roomController.getMyRooms;
exports.getRoomExchangeCounts = roomController.getRoomExchangeCounts;

// Re-export from timeSlotController
exports.submitTimeSlots = timeSlotController.submitTimeSlots;
exports.removeTimeSlot = timeSlotController.removeTimeSlot;
exports.assignTimeSlot = timeSlotController.assignTimeSlot;
exports.findCommonSlots = timeSlotController.findCommonSlots;
exports.resetCarryOverTimes = timeSlotController.resetCarryOverTimes;
exports.resetCompletedTimes = timeSlotController.resetCompletedTimes;

// Negotiation management functions
exports.getNegotiations = async (req, res) => {
   try {
      const { roomId } = req.params;
      // Add your negotiation logic here
      res.json({ negotiations: [] });
   } catch (error) {
      console.error('Error getting negotiations:', error);
      res.status(500).json({ msg: 'Server error' });
   }
};

exports.addNegotiationMessage = async (req, res) => {
   try {
      const { roomId, negotiationId } = req.params;
      // Add your message logic here
      res.json({ success: true });
   } catch (error) {
      console.error('Error adding negotiation message:', error);
      res.status(500).json({ msg: 'Server error' });
   }
};

exports.resolveNegotiation = async (req, res) => {
   try {
      const { roomId, negotiationId } = req.params;
      // Add your resolve logic here
      res.json({ success: true });
   } catch (error) {
      console.error('Error resolving negotiation:', error);
      res.status(500).json({ msg: 'Server error' });
   }
};

exports.respondToNegotiation = async (req, res) => {
   try {
      const { roomId, negotiationId } = req.params;
      const { response } = req.body; // 'accept' or 'reject'
      const userId = req.user.id;

      console.log(`[respondToNegotiation] User ${userId} responding ${response} to negotiation ${negotiationId} in room ${roomId}`);

      if (!['accept', 'reject'].includes(response)) {
         return res.status(400).json({ msg: '유효하지 않은 응답입니다. accept 또는 reject만 허용됩니다.' });
      }

      const room = await Room.findById(roomId)
         .populate('negotiations.conflictingMembers.user', 'firstName lastName email')
         .populate('owner', 'firstName lastName email')
         .populate('members.user', 'firstName lastName email');

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      const negotiation = room.negotiations.id(negotiationId);
      if (!negotiation) {
         return res.status(404).json({ msg: '협의를 찾을 수 없습니다.' });
      }

      if (negotiation.status !== 'active') {
         return res.status(400).json({ msg: '이미 해결된 협의입니다.' });
      }

      // 사용자가 이 협의에 참여 중인지 확인
      const userMember = negotiation.conflictingMembers.find(cm =>
         (cm.user._id || cm.user).toString() === userId
      );

      if (!userMember) {
         return res.status(403).json({ msg: '이 협의에 참여할 권한이 없습니다.' });
      }

      // 이미 응답했는지 확인
      if (userMember.response && userMember.response !== 'pending') {
         return res.status(400).json({ msg: '이미 응답하셨습니다.' });
      }

      // 응답 저장
      userMember.response = response;
      userMember.respondedAt = new Date();

      // 시스템 메시지 추가
      const userName = userMember.user.firstName || userMember.user.name || '멤버';
      const responseText = response === 'accept' ? '양보하기로 했습니다' : '거절했습니다';

      negotiation.messages.push({
         message: `${userName}님이 ${responseText}.`,
         timestamp: new Date(),
         isSystemMessage: true
      });

      // 모든 멤버가 응답했는지 확인
      const allResponded = negotiation.conflictingMembers.every(cm =>
         cm.response && cm.response !== 'pending'
      );

      if (allResponded) {
         // 양보한 사람이 있는지 확인
         const acceptedMembers = negotiation.conflictingMembers.filter(cm => cm.response === 'accept');

         if (acceptedMembers.length > 0) {
            // 가장 먼저 양보한 사람이 양보하고, 나머지 중 하나가 시간을 배정받음
            const remainingMembers = negotiation.conflictingMembers.filter(cm => cm.response === 'reject');

            if (remainingMembers.length > 0) {
               // 랜덤하게 한 명 선택하여 시간 배정
               const selectedMember = remainingMembers[Math.floor(Math.random() * remainingMembers.length)];

               // 시간 슬롯 배정
               room.timeSlots.push({
                  user: selectedMember.user._id || selectedMember.user,
                  date: negotiation.slotInfo.date,
                  startTime: negotiation.slotInfo.startTime,
                  endTime: negotiation.slotInfo.endTime,
                  day: negotiation.slotInfo.day,
                  subject: '협의 결과',
                  status: 'confirmed',
                  assignedBy: 'negotiation'
               });

               negotiation.status = 'resolved';
               negotiation.resolution = {
                  assignedTo: selectedMember.user._id || selectedMember.user,
                  resolvedAt: new Date()
               };

               const selectedUserName = selectedMember.user.firstName || selectedMember.user.name || '멤버';
               negotiation.messages.push({
                  message: `협의가 완료되었습니다. ${selectedUserName}님이 시간을 배정받았습니다.`,
                  timestamp: new Date(),
                  isSystemMessage: true
               });

               console.log(`[협의완료] ${selectedUserName}님이 ${negotiation.slotInfo.startTime} 시간 배정`);
            }
         } else {
            // 모두 거절한 경우 - 이월
            negotiation.status = 'resolved';
            negotiation.messages.push({
               message: '모든 멤버가 거절하여 해당 시간이 이월되었습니다.',
               timestamp: new Date(),
               isSystemMessage: true
            });

            console.log(`[협의완료] 모두 거절 - 시간 이월: ${negotiation.slotInfo.startTime}`);
         }
      }

      await room.save();

      // 업데이트된 협의 정보 반환
      const updatedRoom = await Room.findById(roomId)
         .populate('negotiations.conflictingMembers.user', 'firstName lastName email')
         .populate('negotiations.resolution.assignedTo', 'firstName lastName email');

      const updatedNegotiation = updatedRoom.negotiations.id(negotiationId);

      res.json({
         success: true,
         negotiation: updatedNegotiation,
         room: updatedRoom
      });

   } catch (error) {
      console.error('Error responding to negotiation:', error);
      res.status(500).json({ msg: 'Server error' });
   }
};

exports.autoResolveTimeoutNegotiations = async (req, res) => {
   try {
      const { roomId } = req.params;
      // Add your auto-resolve logic here
      res.json({ success: true });
   } catch (error) {
      console.error('Error auto-resolving negotiations:', error);
      res.status(500).json({ msg: 'Server error' });
   }
};

exports.forceResolveNegotiation = async (req, res) => {
   try {
      const { roomId, negotiationId } = req.params;
      // Add your force resolve logic here
      res.json({ success: true });
   } catch (error) {
      console.error('Error force resolving negotiation:', error);
      res.status(500).json({ msg: 'Server error' });
   }
};

// Keep complex functions that weren't moved yet
// @desc    Handle a request
// @route   POST /api/coordination/requests/:requestId/handle
// @access  Private (Room Owner/Target User)
exports.createRequest = async (req, res) => {
   try {
      const { roomId, type, targetUserId, targetSlot, timeSlot, message } = req.body;

      console.log('[createRequest] Received data:', { roomId, type, targetUserId, timeSlot, message });

      if (!roomId || !type || !timeSlot) {
         return res.status(400).json({ msg: '필수 필드가 누락되었습니다.' });
      }

      const room = await Room.findById(roomId);

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      const hasDuplicateRequest = room.requests.some(
         request =>
            request.requester.toString() === req.user.id &&
            request.status === 'pending' &&
            request.timeSlot.day === timeSlot.day &&
            request.timeSlot.startTime === timeSlot.startTime &&
            request.timeSlot.endTime === timeSlot.endTime &&
            ((type === 'slot_swap' || type === 'time_request') ? request.targetUser?.toString() === targetUserId : true),
      );

      if (hasDuplicateRequest) {
         return res.status(400).json({ msg: '동일한 요청이 이미 존재합니다.', duplicateRequest: true });
      }

      const requestData = {
         requester: req.user.id,
         type,
         timeSlot,
         message: message || '',
         status: 'pending',
         createdAt: new Date(),
      };

      if ((type === 'slot_swap' || type === 'time_request') && targetUserId) {
         requestData.targetUser = targetUserId;
         if (targetSlot) {
            requestData.targetSlot = targetSlot;
         }
      }

      console.log('[createRequest] Saving request object:', requestData);

      room.requests.push(requestData);
      await room.save();

      const populatedRoom = await Room.findById(roomId)
         .populate('requests.requester', 'firstName lastName email')
         .populate('requests.targetUser', 'firstName lastName email');

      res.json(populatedRoom);
   } catch (error) {
      console.error('Error creating request:', error);
      res.status(500).json({ msg: 'Server error' });
   }
};


  // @desc    Handle a request (approve/reject)
  // @route   POST /api/coordination/requests/:requestId/:action
  // @access  Private
  exports.handleRequest = async (req, res) => {
     try {
        const { requestId, action } = req.params;
        const { message } = req.body;

        console.log('handleRequest called with:', { requestId, action, message, userId: req.user.id });

        if (!['approved', 'rejected'].includes(action)) {
           return res.status(400).json({ msg: '유효하지 않은 액션입니다. approved 또는 rejected만 허용됩니다.' });
        }

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

        // --- FINAL BUG FIX (AGAIN) ---
        const isOwner = room.isOwner(req.user.id);
        let isTargetUser = false;
        if (request.targetUser) {
          // Handle both populated object and plain ObjectId string
          const targetId = request.targetUser._id ? request.targetUser._id.toString() : request.targetUser.toString();
          if (targetId === req.user.id) {
            isTargetUser = true;
          }
        }
        // --- FINAL BUG FIX END ---

        if (!isOwner && !isTargetUser) {
           return res.status(403).json({ msg: '이 요청을 처리할 권한이 없습니다.' });
        }

        if (request.status !== 'pending') {
           return res.status(400).json({ msg: '이미 처리된 요청입니다.' });
        }

        const now = new Date();
        request.status = action;
        request.respondedAt = now;
        request.respondedBy = req.user.id;
        request.response = message || '';

        if (action === 'approved') {
           const { type, timeSlot, targetUser, requester } = request;

           if (type === 'slot_release') {
              // Remove the slot from the requester
              room.timeSlots = room.timeSlots.filter(slot => {
                 const slotUserId = slot.user._id || slot.user;
                 return !(
                    slotUserId.toString() === requester._id.toString() &&
                    slot.day === timeSlot.day &&
                    slot.startTime === timeSlot.startTime
                 );
              });
           } else if (type === 'slot_swap' && targetUser) {
              const targetSlotIndex = room.timeSlots.findIndex(slot =>
                  slot.user &&
                  slot.user._id.toString() === targetUser._id.toString() &&
                  slot.day === timeSlot.day &&
                  slot.startTime === timeSlot.startTime
              );

              if (targetSlotIndex !== -1) {
                  room.timeSlots[targetSlotIndex].user = requester._id;
              }
           } else if (type === 'time_request' || type === 'time_change') {
              // For time_request, transfer the timeslot from target user to requester
              if (targetUser) {
                 // First, find and remove the slot from the target user
                 const targetSlotIndex = room.timeSlots.findIndex(slot => {
                    const slotUserId = slot.user._id || slot.user;
                    return (
                       slotUserId.toString() === targetUser._id.toString() &&
                       slot.day === timeSlot.day &&
                       slot.startTime === timeSlot.startTime &&
                       slot.endTime === timeSlot.endTime
                    );
                 });

                 if (targetSlotIndex !== -1) {
                    // Transfer the slot to the requester
                    room.timeSlots[targetSlotIndex].user = requester._id;
                    console.log(`🔄 [REQUEST APPROVED] Transferred timeslot from ${targetUser._id} to ${requester._id} at ${timeSlot.day} ${timeSlot.startTime}-${timeSlot.endTime}`);
                 } else {
                    console.log(`⚠️ [REQUEST APPROVED] Could not find target slot to transfer. Creating new slot for requester.`);
                    // If we can't find the exact slot, create a new one
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
                       subject: timeSlot.subject || '승인된 요청',
                       status: 'confirmed'
                    });
                 }
              } else {
                 // If no target user (slot_release type), just add the slot to requester
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
                    subject: timeSlot.subject || '승인된 요청',
                    status: 'confirmed'
                 });
              }
           }
        }

        await room.save();

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

// @desc    Cancel a request
// @route   DELETE /api/coordination/requests/:requestId
// @access  Private (Requester only)
exports.cancelRequest = async (req, res) => {
   try {
      const { requestId } = req.params;

      const room = await Room.findOne({ 'requests._id': requestId });

      if (!room) {
         return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
      }

      const request = room.requests.id(requestId);

      if (!request) {
         return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
      }

      const canDelete = request.requester.toString() === req.user.id ||
                       (request.targetUser && request.targetUser.toString() === req.user.id);

      if (!canDelete) {
         return res.status(403).json({ msg: '요청을 삭제할 권한이 없습니다.' });
      }

      if (request.status === 'pending' && request.requester.toString() !== req.user.id) {
         return res.status(403).json({ msg: '대기 중인 요청은 요청자만 취소할 수 있습니다.' });
      }

      if (request.status === 'pending') {
         request.status = 'cancelled';
         request.respondedAt = new Date();
         request.respondedBy = req.user.id;
         request.response = '요청자에 의해 취소됨';
         await room.save();
         res.json({ msg: '요청이 취소되었습니다.' });
      } else {
         room.requests.pull(requestId);
         await room.save();
         res.json({ msg: '요청 내역이 삭제되었습니다.' });
      }
   } catch (error) {
      console.error('Error canceling/deleting request:', error);
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    Get all requests sent by the user
// @route   GET /api/coordination/sent-requests
// @access  Private
exports.getSentRequests = async (req, res) => {
   try {
      const userId = req.user.id;

      const rooms = await Room.find({
         $or: [{ owner: userId }, { 'members.user': userId }],
      })
         .populate({
            path: 'requests.requester',
            select: 'firstName lastName email'
         })
         .populate({
            path: 'requests.targetUser',
            select: 'firstName lastName email',
            options: { strictPopulate: false }
         });

      const sentRequests = rooms.flatMap(room =>
         room.requests
           .filter(req => req.requester && req.requester._id.toString() === userId)
           .map(req => ({
             ...req.toObject(),
             roomId: room._id.toString(),
             roomName: room.name
           }))
      );

      res.json({ success: true, requests: sentRequests });
   } catch (error) {
      console.error('Error fetching sent requests:', error);
      res.status(500).json({ success: false, msg: 'Server error' });
   }
};

// @desc    Get all requests received by the user
// @route   GET /api/coordination/received-requests
// @access  Private
exports.getReceivedRequests = async (req, res) => {
   try {
      const userId = req.user.id;
      console.log(`[getReceivedRequests] Fetching for user: ${userId}`);

      const rooms = await Room.find({
         $or: [{ owner: userId }, { 'members.user': userId }],
      }).populate('requests.requester', 'firstName lastName email name');
      console.log(`[getReceivedRequests] Found ${rooms.length} rooms for user.`);

      const receivedRequests = rooms.flatMap(room => {
         console.log(`[getReceivedRequests] Checking room: ${room.name} (${room._id})`);
         console.log(`[getReceivedRequests] Room has ${room.requests.length} requests.`);
         return room.requests.filter(req => {
            const isTarget = req.targetUser && req.targetUser.toString() === userId;
            console.log(`[getReceivedRequests]  - Request ${req._id}: targetUser=${req.targetUser}, isTarget=${isTarget}, status=${req.status}, type=${req.type}`);
            return isTarget;
         }).map(req => ({ ...req.toObject(), roomId: room._id, roomName: room.name }));
      });

      console.log(`[getReceivedRequests] Found ${receivedRequests.length} received requests in total.`);
      res.json({ success: true, requests: receivedRequests });
   } catch (error) {
      console.error('[getReceivedRequests] Error:', error);
      res.status(500).json({ success: false, msg: 'Server error' });
   }
};

// @desc    Remove a member from a room (owner only)
// @route   DELETE /api/coordination/rooms/:roomId/members/:memberId
// @access  Private (Room Owner only)
exports.removeMember = async (req, res) => {
  try {
    const { roomId, memberId } = req.params;

    // 1. Find the room
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // 2. Validate owner
    if (room.owner.toString() !== req.user.id) {
      return res.status(403).json({ msg: '방장만 조원을 제거할 수 있습니다.' });
    }

    // 3. Prevent owner from removing themselves
    if (room.owner.toString() === memberId) {
      return res.status(400).json({ msg: '방장은 자신을 제거할 수 없습니다.' });
    }

    // 4. Check if member exists in the room
    const initialMemberCount = room.members.length;
    room.members = room.members.filter(member => member.user.toString() !== memberId);

    if (room.members.length === initialMemberCount) {
      return res.status(404).json({ msg: '해당 조원을 찾을 수 없습니다.' });
    }

    // 5. Remove all timeSlots associated with the removed member
    room.timeSlots = room.timeSlots.filter(slot => slot.userId?.toString() !== memberId && slot.user?.toString() !== memberId);

    // 6. Remove all requests associated with the removed member (as requester or target)
    room.requests = room.requests.filter(request =>
      request.requester?.toString() !== memberId &&
      request.targetUser?.toString() !== memberId
    );

    // 7. Get member info for notification
    const removedUser = await User.findById(memberId);

    // 8. Save room
    await room.save();
    await room.populate('owner', 'firstName lastName email');
    await room.populate('members.user', 'firstName lastName email');

    // 9. Log notification
    if (removedUser) {
      console.log(`Member ${removedUser.name || removedUser.firstName + ' ' + removedUser.lastName} (${removedUser.email}) has been removed from room: ${room.name}`);
    }

    res.json({
      msg: '조원이 성공적으로 제거되었습니다.',
      room,
      removedMember: {
        name: removedUser?.name || `${removedUser?.firstName || ''} ${removedUser?.lastName || ''}`.trim(),
        email: removedUser?.email,
        id: memberId
      }
    });

  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get count of pending exchange requests for the user
// @route   GET /api/coordination/exchange-requests-count
// @access  Private
exports.getExchangeRequestsCount = async (req, res) => {
   try {
      const userId = req.user.id;

      const rooms = await Room.find({
         $or: [{ owner: userId }, { 'members.user': userId }],
      });

      let count = 0;
      rooms.forEach(room => {
         room.requests.forEach(request => {
            if (
               request.status === 'pending' &&
               request.type === 'slot_swap' &&
               request.targetUser &&
               request.targetUser.toString() === userId
            ) {
               count++;
            }
         });
      });

      res.json({ success: true, count });
   } catch (error) {
      console.error('Error fetching exchange requests count:', error);
      res.status(500).json({ success: false, msg: 'Server error' });
   }
};

exports.runAutoSchedule = async (req, res) => {
   try {
      const { roomId } = req.params;
      const { minHoursPerWeek = 3, numWeeks = 4, currentWeek, ownerFocusTime = 'none' } = req.body;
      const startDate = currentWeek ? new Date(currentWeek) : new Date();

      console.log('===== 방 조회 시작 =====');
      console.log('roomId:', roomId);
      
      const room = await Room.findById(roomId)
        .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority')
        .populate('members.user', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority');
      
      console.log('방 조회 완료:', {
        roomId: room?._id,
        memberCount: room?.members?.length,
        hasOwner: !!room?.owner
      });

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      // Clear previous auto-generated slots before running new schedule
      room.timeSlots = room.timeSlots.filter(slot => !slot.assignedBy);

      if (minHoursPerWeek < 1 || minHoursPerWeek > 10) {
         return res.status(400).json({ msg: '주당 최소 할당 시간은 1-10시간 사이여야 합니다.' });
      }

      if (!room.settings.ownerPreferences) {
         room.settings.ownerPreferences = {};
      }
      room.settings.ownerPreferences.focusTimeType = ownerFocusTime;

      await room.save();

      const membersOnly = room.members.filter(m => {
         const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
         const ownerId = room.owner._id ? room.owner._id.toString() : room.owner.toString();
         return memberId !== ownerId;
      });



      const memberIds = membersOnly.map(m => {
        const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
        return memberId;
      });

      // 개인 시간표가 있는지 확인
      let membersWithDefaultSchedule = 0;
      for (const member of membersOnly) {
        if (member.user.defaultSchedule && member.user.defaultSchedule.length > 0) {
          membersWithDefaultSchedule++;
        }
      }

      // 방장도 선호시간표 체크
      console.log('===== 방장 검증 시작 =====');
      console.log('방장 체크:', {
        hasOwner: !!room.owner,
        ownerType: typeof room.owner,
        ownerId: room.owner?._id?.toString(),
        hasDefaultSchedule: !!room.owner?.defaultSchedule,
        defaultScheduleLength: room.owner?.defaultSchedule?.length || 0,
        ownerName: `${room.owner?.firstName || ''} ${room.owner?.lastName || ''}`.trim()
      });

      if (!room.owner || !room.owner.defaultSchedule || room.owner.defaultSchedule.length === 0) {
        const ownerName = `${room.owner?.firstName || ''} ${room.owner?.lastName || ''}`.trim() || '방장';
        return res.status(400).json({
          msg: `방장(${ownerName})이 선호시간표를 설정하지 않았습니다. 내프로필에서 선호시간표를 설정해주세요.`
        });
      }
      console.log('===== 방장 검증 완료 =====');

      // 개인 시간표 확인
      console.log('===== 멤버 검증 시작 =====');
      console.log('membersOnly 개수:', membersOnly.length);

      const membersWithoutDefaultSchedule = [];
      for (const member of membersOnly) {
        console.log('멤버 체크:', {
          hasUser: !!member.user,
          userType: typeof member.user,
          isObjectId: member.user?._id ? 'has _id' : 'no _id',
          userId: member.user?._id?.toString(),
          hasDefaultSchedule: !!member.user?.defaultSchedule,
          defaultScheduleLength: member.user?.defaultSchedule?.length || 0,
          defaultScheduleData: member.user?.defaultSchedule, // 전체 데이터 출력
          firstName: member.user?.firstName,
          lastName: member.user?.lastName
        });

        if (!member.user || !member.user.defaultSchedule || member.user.defaultSchedule.length === 0) {
          const userName = member.user?.name || `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim() || '알 수 없음';
          console.log('❌ 선호시간표 없음:', userName);
          membersWithoutDefaultSchedule.push(userName);
        } else {
          console.log('✅ 선호시간표 있음:', member.user.firstName, member.user.lastName, '- 개수:', member.user.defaultSchedule.length);
        }
      }
      console.log('===== 멤버 검증 종료 =====');

      if (membersWithoutDefaultSchedule.length > 0) {
        return res.status(400).json({
          msg: `다음 멤버들이 선호시간표를 설정하지 않았습니다: ${membersWithoutDefaultSchedule.join(', ')}. 각 멤버는 내프로필에서 선호시간표를 설정해야 합니다.`
        });
      }

      // 방장의 차단 시간은 개인 시간표에서 자동으로 처리되므로 별도 처리 불필요
      const ownerBlockedTimes = [];

      const existingCarryOvers = [];
      for (const member of room.members) {
        if (member.carryOver > 0) {
          existingCarryOvers.push({
            memberId: member.user._id.toString(),
            neededHours: member.carryOver,
            priority: member.priority || 3,
            week: startDate
          });
        }
      }



      // 개인 시간표 기반 자동배정으로 변경
      const result = schedulingAlgorithm.runAutoSchedule(
         membersOnly,
         room.owner,
         [], // 기존 roomTimeSlots 대신 빈 배열 전달 (개인 시간표 기반으로 동작)
         {
            minHoursPerWeek,
            numWeeks,
            currentWeek,
            ownerPreferences: room.settings.ownerPreferences || {},
            roomSettings: {
               ...room.settings,
               ownerBlockedTimes: ownerBlockedTimes
            },
         },
         existingCarryOvers,
      );

      const twoWeeksAgo = new Date(startDate);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const oneWeekAgo = new Date(startDate);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const forcedNegotiationSuggestions = [];

      for (const member of room.members) {
        const memberUser = await User.findById(member.user);
        if (member.carryOver > 0) { // They have a carry-over from last week
            const history = member.carryOverHistory || [];
            
            const hasConsecutiveCarryOver = history.some(h => 
                new Date(h.week).getTime() >= twoWeeksAgo.getTime() &&
                new Date(h.week).getTime() < oneWeekAgo.getTime() &&
                h.amount > 0
            );

            if (hasConsecutiveCarryOver) {
                const memberName = memberUser.name || `${memberUser.firstName} ${memberUser.lastName}`;
                forcedNegotiationSuggestions.push({
                    title: '장기 이월 멤버 발생',
                    content: `멤버 '${memberName}'의 시간이 2주 이상 연속으로 이월되었습니다. 최소 할당 시간을 줄이거나, 멤버의 참여 가능 시간을 늘리거나, 직접 시간을 할당하여 문제를 해결해야 합니다.`
                });
            }
        }
      }

      // 중복 삭제 방지 - 이미 위에서 삭제했으므로 주석 처리
      // room.timeSlots = room.timeSlots.filter(slot => !slot.assignedBy);



      // 중복 방지를 위한 Set 생성
      const addedSlots = new Set();

      Object.values(result.assignments).forEach(assignment => {

         if (assignment.slots && assignment.slots.length > 0) {
            assignment.slots.forEach(slot => {
               // 필수 필드 검증
               if (!slot.day || !slot.startTime || !slot.endTime || !slot.date) {
                  console.error('❌ [저장실패] 슬롯에 필수 필드가 없습니다:', {
                     memberId: assignment.memberId,
                     slot: slot,
                     hasDay: !!slot.day,
                     hasStartTime: !!slot.startTime,
                     hasEndTime: !!slot.endTime,
                     hasDate: !!slot.date
                  });
                  return; // 이 슬롯은 건너뛰기
               }

               // 중복 체크를 위한 유니크 키 생성
               const slotKey = `${assignment.memberId}-${slot.day}-${slot.startTime}-${slot.endTime}`;

               if (!addedSlots.has(slotKey)) {
                  console.log(`🔍 [저장] 개별 슬롯 추가: ${slot.day} ${slot.startTime}-${slot.endTime} (멤버: ${assignment.memberId})`);
                  const newSlot = {
                     user: assignment.memberId,
                     date: slot.date,
                     startTime: slot.startTime,
                     endTime: slot.endTime,
                     day: slot.day,
                     priority: 3,
                     subject: '자동 배정',
                     assignedBy: req.user.id || req.user._id || 'auto-scheduler',
                     assignedAt: new Date(),
                     status: 'confirmed',
                  };
                  console.log(`🔍 [슬롯생성] newSlot.assignedBy = "${newSlot.assignedBy}" (타입: ${typeof newSlot.assignedBy})`);
                  room.timeSlots.push(newSlot);
                  addedSlots.add(slotKey);
                  console.log(`🔍 [PUSH성공] 슬롯이 room.timeSlots에 추가됨. 현재 총 개수: ${room.timeSlots.length}`);
               } else {
                  console.log(`🔍 [중복제거] 중복 슬롯 제거: ${slot.day} ${slot.startTime}-${slot.endTime} (멤버: ${assignment.memberId})`);
               }
            });
         }
      });
      // 디버깅: 모든 슬롯의 assignedBy 필드 확인
      console.log(`🔍 [필드확인] 모든 슬롯의 assignedBy 필드:`, room.timeSlots.map((slot, index) => ({
        index,
        assignedBy: slot.assignedBy,
        assignedByType: typeof slot.assignedBy,
        subject: slot.subject,
        hasAssignedBy: !!slot.assignedBy
      })));

      const autoAssignedCount = room.timeSlots.filter(slot => slot.assignedBy).length;
      const totalSlotCount = room.timeSlots.length;
      console.log(`🔍 [저장] 총 ${autoAssignedCount}개 개별 슬롯이 저장됨 (전체 슬롯: ${totalSlotCount}개)`);

      // 다른 방법으로 자동 배정 슬롯 찾기
      const autoSlotsBySubject = room.timeSlots.filter(slot => slot.subject === '자동 배정');
      console.log(`🔍 [대안필터] subject='자동 배정'으로 찾은 슬롯: ${autoSlotsBySubject.length}개`);

      // 디버깅을 위해 실제 저장된 슬롯들 확인
      const recentlyAdded = room.timeSlots.filter(slot => slot.assignedBy || slot.subject === '자동 배정');
      console.log(`🔍 [저장완료] 실제 저장된 개별 슬롯들:`, recentlyAdded.map(slot => ({
        user: slot.user,
        day: slot.day,
        time: `${slot.startTime}-${slot.endTime}`,
        assignedBy: slot.assignedBy,
        subject: slot.subject
      })));

      if (result.negotiations && result.negotiations.length > 0) {
        room.negotiations = room.negotiations.filter(neg => neg.status !== 'active');
        room.negotiations.push(...result.negotiations);
      }

      for (const member of room.members) {
        const memberId = member.user._id.toString();
        const assignment = result.assignments[memberId];

        if (assignment && assignment.assignedHours >= minHoursPerWeek * 2) {
          if (member.carryOver > 0) {
            member.carryOverHistory.push({
              week: startDate,
              amount: -member.carryOver,
              reason: 'resolved_by_auto_schedule',
              timestamp: new Date()
            });
            member.carryOver = 0;
          }
        }
      }

      // 이월시간 처리 개선
      if (result.carryOverAssignments && result.carryOverAssignments.length > 0) {
         console.log(`[이월시간] ${result.carryOverAssignments.length}명의 멤버에게 이월시간 적용`);

         for (const carryOver of result.carryOverAssignments) {
            const memberIndex = room.members.findIndex(m =>
               m.user.toString() === carryOver.memberId
            );

            if (memberIndex !== -1) {
               const member = room.members[memberIndex];
               const previousCarryOver = member.carryOver || 0;
               member.carryOver = (member.carryOver || 0) + carryOver.neededHours;

               console.log(`[이월시간] 멤버 ${carryOver.memberId}: ${previousCarryOver}시간 → ${member.carryOver}시간 (추가: ${carryOver.neededHours}시간)`);

               if (carryOver.neededHours > 0) {
                 // 이월 히스토리 업데이트
                 if (!member.carryOverHistory) {
                   member.carryOverHistory = [];
                 }

                 member.carryOverHistory.push({
                    week: carryOver.week || startDate,
                    amount: carryOver.neededHours,
                    reason: 'unassigned_from_auto_schedule',
                    timestamp: new Date(),
                    priority: carryOver.priority || 3
                 });

                 // 2주 이상 연속 이월 체크
                 const recentCarryOvers = member.carryOverHistory.filter(h => {
                   const historyDate = new Date(h.week);
                   const twoWeeksAgo = new Date(startDate);
                   twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
                   return historyDate >= twoWeeksAgo && h.amount > 0;
                 });

                 if (recentCarryOvers.length >= 2) {
                   console.log(`⚠️ [경고] 멤버 ${carryOver.memberId}의 시간이 2주 이상 연속 이월됨`);
                   // 강제 협의 또는 관리자 개입 플래그 설정
                   member.needsIntervention = true;
                   member.interventionReason = 'consecutive_carryover';
                 }
               }
            }
         }
      }

      // 우선도에 따른 다음 주 우선 배정 정보 업데이트
      Object.values(result.assignments).forEach(assignment => {
        if (assignment.carryOver && assignment.carryOver > 0) {
          const memberIndex = room.members.findIndex(m =>
            m.user.toString() === assignment.memberId
          );

          if (memberIndex !== -1) {
            const member = room.members[memberIndex];
            // 다음 주 우선 배정을 위한 우선도 임시 상승
            if (!member.tempPriorityBoost) {
              member.tempPriorityBoost = assignment.carryOver; // 이월 시간만큼 우선도 부스트
            }
          }
        }
      });

      await room.save();

      const freshRoom = await Room.findById(roomId)
         .populate('owner', 'firstName lastName email')
         .populate('members.user', 'firstName lastName email')
         .populate('timeSlots.user', 'firstName lastName email')
         .populate('requests.requester', 'firstName lastName email')
         .populate('requests.targetUser', 'firstName lastName email')
         .populate('negotiations.conflictingMembers.user', 'firstName lastName email name');

      res.json({
         room: freshRoom,
         unassignedMembersInfo: result.unassignedMembersInfo,
         conflictSuggestions: forcedNegotiationSuggestions, // Use the new suggestions
      });
   } catch (error) {
      console.error('❌ Error running auto-schedule:', error);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Error name:', error.name);

      if (error.message.includes('defaultSchedule')) {
         res.status(400).json({ msg: '선호시간표 데이터에 오류가 있습니다. 모든 멤버가 내프로필에서 선호시간표를 설정했는지 확인해주세요.' });
      } else if (error.message.includes('timeSlots')) {
         res.status(400).json({ msg: '시간표 데이터에 오류가 있습니다. 멤버들이 선호시간표를 설정했는지 확인해주세요.' });
      } else if (error.message.includes('member')) {
         res.status(400).json({ msg: '멤버 데이터에 오류가 있습니다. 방 설정을 확인해주세요.' });
      } else if (error.message.includes('settings')) {
         res.status(400).json({ msg: '방 설정에 오류가 있습니다. 시간 설정을 확인해주세요.' });
      } else if (error.message.includes('priority')) {
         res.status(400).json({ msg: '우선순위 설정에 오류가 있습니다. 멤버 우선순위를 확인해주세요.' });
      } else {
         res.status(500).json({ msg: `자동 배정 실행 중 오류가 발생했습니다: ${error.message}` });
      }
   }
};

exports.deleteAllTimeSlots = async (req, res) => {
   try {
      const { roomId } = req.params;
      const room = await Room.findById(roomId);

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      // Clear the timeSlots array
      room.timeSlots = [];
      
      // Also clear all active negotiations and non-pending requests as they are linked to slots
      room.negotiations = [];
      room.requests = room.requests.filter(r => r.status === 'pending');


      await room.save();

      const updatedRoom = await Room.findById(room._id)
         .populate('owner', 'firstName lastName email')
         .populate('members.user', 'firstName lastName email')
         .populate('timeSlots.user', 'firstName lastName email');

      res.json(updatedRoom);

   } catch (error) {
      console.error('Error deleting all time slots:', error);
      res.status(500).json({ msg: 'Server error' });
   }
};