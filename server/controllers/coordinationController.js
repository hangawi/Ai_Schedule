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
      // Add your respond logic here
      res.json({ success: true });
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
            (type !== 'slot_swap' || request.targetUser?.toString() === targetUserId),
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

      if (type === 'slot_swap' && targetUserId) {
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
              // Add the requested time slot
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
            console.log(`[getReceivedRequests]  - Request ${req._id}: targetUser=${req.targetUser}, isTarget=${isTarget}`);
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
      console.log('자동 배정 요청 - 받은 옵션:', { minHoursPerWeek, numWeeks, currentWeek, ownerFocusTime });
      const startDate = currentWeek ? new Date(currentWeek) : new Date();

      const room = await Room.findById(roomId)
         .populate('owner', 'defaultSchedule scheduleExceptions')
         .populate('members.user', 'defaultSchedule scheduleExceptions');

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

      await room.populate('members.user', 'firstName lastName email defaultSchedule');

      const User = require('../models/user');
      let generatedTimeSlots = [];

      for (const member of membersOnly) {
        const userId = member.user._id ? member.user._id.toString() : member.user.toString();

        const memberHasRoomSlots = room.timeSlots.some(slot => {
          const slotUserId = slot.user._id || slot.user;
          return slotUserId.toString() === userId;
        });

        if (!memberHasRoomSlots) {
          const userData = await User.findById(userId).select('defaultSchedule');

          if (userData && userData.defaultSchedule && userData.defaultSchedule.length > 0) {
            const currentWeekDate = currentWeek ? new Date(currentWeek) : new Date();
            const startOfWeek = new Date(currentWeekDate);
            startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfWeek.getUTCDay() + 1);

            for (const schedule of userData.defaultSchedule) {
              for (let weekOffset = 0; weekOffset < numWeeks; weekOffset++) {
                const targetDate = new Date(startOfWeek);
                targetDate.setUTCDate(startOfWeek.getUTCDate() + (schedule.dayOfWeek === 0 ? 6 : schedule.dayOfWeek - 1) + (weekOffset * 7));

                if (schedule.dayOfWeek === 0 || schedule.dayOfWeek === 6) continue;

                const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

                const newSlot = {
                  user: userId,
                  date: targetDate,
                  startTime: schedule.startTime,
                  endTime: schedule.endTime,
                  day: dayNames[schedule.dayOfWeek],
                  priority: schedule.priority || 3,
                  subject: '선호 시간',
                  status: 'confirmed'
                };
                generatedTimeSlots.push(newSlot);
              }
            }
          }
        }
      }

      const allTimeSlots = [...(room.timeSlots || []), ...generatedTimeSlots];

      const memberIds = membersOnly.map(m => {
        const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
        return memberId;
      });

      const membersWithTimeData = [...new Set(allTimeSlots.map(slot => {
        const userId = slot.user._id || slot.user;
        return userId.toString();
      }))];

      for (const memberId of memberIds) {
        if (!membersWithTimeData.includes(memberId)) {
          const userData = await User.findById(memberId).select('defaultSchedule');
          if (userData && userData.defaultSchedule && userData.defaultSchedule.length > 0) {
            membersWithTimeData.push(memberId);
          }
        }
      }

      const membersWithoutTimeData = memberIds.filter(id => !membersWithTimeData.includes(id));

      if (membersWithoutTimeData.length > 0) {
        const membersWithoutDataInfo = [];
        for (const missingMemberId of membersWithoutTimeData) {
          const memberData = room.members.find(m => {
            const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
            return memberId === missingMemberId;
          });
          if (memberData) {
            const userName = memberData.user.name || `${memberData.user.firstName || ''} ${memberData.user.lastName || ''}`.trim() || '알 수 없음';
            membersWithoutDataInfo.push(userName);
          }
        }

        return res.status(400).json({
          msg: `다음 멤버들이 시간표나 선호 시간을 설정하지 않았습니다: ${membersWithoutDataInfo.join(', ')}. 각 멤버는 내프로필에서 선호시간표를 설정하거나 방에서 직접 시간을 입력해야 합니다.`,
          membersWithoutData: membersWithoutTimeData,
          membersWithoutDataNames: membersWithoutDataInfo
        });
      }

      const ownerBlockedTimes = [];

      const ownerRoomSlots = allTimeSlots.filter(slot => {
         const slotUserId = slot.user._id || slot.user;
         const ownerId = room.owner._id || room.owner;
         return slotUserId.toString() === ownerId.toString();
      });

      const ownerUser = await User.findById(room.owner._id || room.owner).select('defaultSchedule');

      ownerRoomSlots.forEach(slot => {
         ownerBlockedTimes.push({
            day: slot.day,
            startTime: slot.startTime,
            endTime: slot.endTime,
            reason: 'owner_schedule'
         });
      });

      if (ownerUser && ownerUser.defaultSchedule && ownerUser.defaultSchedule.length > 0) {
         const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
         ownerUser.defaultSchedule.forEach(schedule => {
            if (schedule.dayOfWeek === 0 || schedule.dayOfWeek === 6) return;

            ownerBlockedTimes.push({
               day: dayNames[schedule.dayOfWeek],
               startTime: schedule.startTime,
               endTime: schedule.endTime,
               reason: 'owner_default_schedule_blocked'
            });
         });
      }

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

      const result = schedulingAlgorithm.runAutoSchedule(
         membersOnly,
         room.owner,
         allTimeSlots,
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

      room.timeSlots = room.timeSlots.filter(slot => !slot.assignedBy);

      Object.values(result.assignments).forEach(assignment => {
         if (assignment.slots && assignment.slots.length > 0) {
            assignment.slots.forEach(slot => {
               const newSlot = {
                  user: assignment.memberId,
                  date: slot.date,
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                  day: slot.day,
                  priority: 3,
                  subject: '자동 배정',
                  assignedBy: req.user.id,
                  assignedAt: new Date(),
                  status: 'confirmed',
               };
               room.timeSlots.push(newSlot);
            });
         }
      });

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

      if (result.carryOverAssignments && result.carryOverAssignments.length > 0) {
         for (const carryOver of result.carryOverAssignments) {
            const memberIndex = room.members.findIndex(m =>
               m.user.toString() === carryOver.memberId
            );

            if (memberIndex !== -1) {
               const member = room.members[memberIndex];
               member.carryOver = carryOver.neededHours;

               if (carryOver.neededHours > 0) {
                 member.carryOverHistory.push({
                    week: carryOver.week,
                    amount: carryOver.neededHours,
                    reason: 'unassigned_from_auto_schedule',
                    timestamp: new Date()
                 });
               }
            }
         }
      }

      await room.save();

      const freshRoom = await Room.findById(roomId)
         .populate('owner', 'firstName lastName email')
         .populate('members.user', 'firstName lastName email')
         .populate('timeSlots.user', 'firstName lastName email');

      res.json({
         room: freshRoom,
         unassignedMembersInfo: result.unassignedMembersInfo,
         conflictSuggestions: forcedNegotiationSuggestions, // Use the new suggestions
      });
   } catch (error) {
      console.error('Error running auto-schedule:', error);

      if (error.message.includes('timeSlots')) {
         res.status(400).json({ msg: '시간표 데이터에 오류가 있습니다. 멤버들이 시간을 입력했는지 확인해주세요.' });
      } else if (error.message.includes('member')) {
         res.status(400).json({ msg: '멤버 데이터에 오류가 있습니다. 방 설정을 확인해주세요.' });
      } else if (error.message.includes('settings')) {
         res.status(400).json({ msg: '방 설정에 오류가 있습니다. 시간 설정을 확인해주세요.' });
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