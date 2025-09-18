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

      console.log('Request creation data:', { roomId, type, targetUserId, targetSlot, timeSlot, message });

      if (!roomId || !type || !timeSlot) {
         return res.status(400).json({ msg: '필수 필드가 누락되었습니다.' });
      }

      // Check for existing room first
      const room = await Room.findById(roomId);

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      // 중복 요청 체크
      const hasDuplicateRequest = room.requests.some(
         request => {
            // 같은 요청자의 대기 중인 요청만 체크
            if (request.requester.toString() !== req.user.id || request.status !== 'pending') {
               return false;
            }

            // 같은 시간대의 요청인지 체크
            const sameTimeSlot = request.timeSlot.day === timeSlot.day &&
                                request.timeSlot.startTime === timeSlot.startTime &&
                                request.timeSlot.endTime === timeSlot.endTime;

            if (!sameTimeSlot) {
               return false;
            }

            // slot_swap 타입의 경우 targetUser도 같은지 체크
            if (type === 'slot_swap') {
               return request.type === 'slot_swap' &&
                      request.targetUser?.toString() === targetUserId;
            }

            // 다른 타입의 경우 타입이 같은지 체크
            return request.type === type;
         }
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

      // Add type-specific fields
      if (type === 'slot_swap' && targetUserId) {
         requestData.targetUser = targetUserId;
         if (targetSlot) {
            requestData.targetSlot = targetSlot;
         }
      }

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
      const isTargetUser = request.targetUser && request.targetUser.toString() === req.user.id;

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
         const { type, timeSlot, targetUser, targetSlot, requester } = request;

         if (type === 'slot_release') {
            // Remove the slot from requester
            room.timeSlots = room.timeSlots.filter(slot => {
               const slotUserId = slot.user._id || slot.user;
               return !(
                  slotUserId.toString() === requester._id.toString() &&
                  slot.day === timeSlot.day &&
                  slot.startTime === timeSlot.startTime &&
                  slot.endTime === timeSlot.endTime
               );
            });
         } else if (type === 'slot_swap' && targetUser && targetSlot) {
            // Find and swap the slots
            const requesterSlotIndex = room.timeSlots.findIndex(slot => {
               const slotUserId = slot.user._id || slot.user;
               return (
                  slotUserId.toString() === requester._id.toString() &&
                  slot.day === timeSlot.day &&
                  slot.startTime === timeSlot.startTime &&
                  slot.endTime === timeSlot.endTime
               );
            });

            const targetSlotIndex = room.timeSlots.findIndex(slot => {
               const slotUserId = slot.user._id || slot.user;
               return (
                  slotUserId.toString() === targetUser.toString() &&
                  slot.day === targetSlot.day &&
                  slot.startTime === targetSlot.startTime &&
                  slot.endTime === targetSlot.endTime
               );
            });

            if (requesterSlotIndex !== -1 && targetSlotIndex !== -1) {
               // Swap the users
               const tempUser = room.timeSlots[requesterSlotIndex].user;
               room.timeSlots[requesterSlotIndex].user = room.timeSlots[targetSlotIndex].user;
               room.timeSlots[targetSlotIndex].user = tempUser;
            }
         } else if (type === 'time_request' || type === 'time_change') {
            // Calculate proper date from day name
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

            // Add new slot for requester
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

      // Only the requester or target user can delete (for processed requests)
      const canDelete = request.requester.toString() === req.user.id ||
                       (request.targetUser && request.targetUser.toString() === req.user.id);

      if (!canDelete) {
         return res.status(403).json({ msg: '요청을 삭제할 권한이 없습니다.' });
      }

      // For pending requests, only requester can cancel
      if (request.status === 'pending' && request.requester.toString() !== req.user.id) {
         return res.status(403).json({ msg: '대기 중인 요청은 요청자만 취소할 수 있습니다.' });
      }

      if (request.status === 'pending') {
         // Cancel pending request (change status instead of deleting)
         request.status = 'cancelled';
         request.respondedAt = new Date();
         request.respondedBy = req.user.id;
         request.response = '요청자에 의해 취소됨';
         await room.save();
         res.json({ msg: '요청이 취소되었습니다.' });
      } else {
         // Delete processed requests (approved/rejected/cancelled)
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

      // Find all rooms and filter requests by the current user
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

// Continue with other complex functions that weren't moved...
// (Add other functions as needed)

// @desc    Run auto-scheduling algorithm
// @route   POST /api/coordination/rooms/:roomId/run-schedule
// @access  Private (Owner only)
exports.runAutoSchedule = async (req, res) => {
   try {
      const { roomId } = req.params;
      const { minHoursPerWeek = 3, numWeeks = 4, currentWeek, ownerFocusTime = 'none' } = req.body;
      console.log('자동 배정 요청 - 받은 옵션:', { minHoursPerWeek, numWeeks, currentWeek, ownerFocusTime });
      const startDate = currentWeek ? new Date(currentWeek) : new Date(); // Define startDate here

      const room = await Room.findById(roomId)
         .populate('owner', 'defaultSchedule scheduleExceptions') // Populate owner's defaultSchedule and exceptions
         .populate('members.user', 'defaultSchedule scheduleExceptions'); // Populate members' defaultSchedule and exceptions

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      // Basic validation
      if (minHoursPerWeek < 1 || minHoursPerWeek > 10) {
         return res.status(400).json({ msg: '주당 최소 할당 시간은 1-10시간 사이여야 합니다.' });
      }

      // Check if room has members (excluding owner)
      const nonOwnerMembers = room.members.filter(m => m.user._id.toString() !== room.owner._id.toString());
      if (nonOwnerMembers.length === 0) {
         return res
            .status(400)
            .json({ msg: '방에 멤버가 없습니다. 자동 배정을 위해서는 최소 1명의 멤버가 필요합니다.' });
      }

      // Update owner preferences in room settings
      if (!room.settings.ownerPreferences) {
         room.settings.ownerPreferences = {};
      }
      room.settings.ownerPreferences.focusTimeType = ownerFocusTime;

      // Save the updated preferences
      await room.save();

      console.log('runAutoSchedule: room found');
      console.log('runAutoSchedule: room.members:', room.members.length);
      console.log('runAutoSchedule: room.timeSlots:', room.timeSlots.length);

      // Extract members only (without owner)
      const membersOnly = room.members.filter(m => {
         const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
         const ownerId = room.owner._id ? room.owner._id.toString() : room.owner.toString();
         return memberId !== ownerId;
      });

      console.log('runAutoSchedule: membersOnly filtered:', membersOnly.length);

      // Populate member users to get their defaultSchedule
      await room.populate('members.user', 'firstName lastName email defaultSchedule');

      // Generate timeSlots from members' defaultSchedule if needed
      const User = require('../models/user');
      let generatedTimeSlots = [];

      console.log('runAutoSchedule: Starting timeSlots generation for', membersOnly.length, 'members');

      for (const member of membersOnly) {
        const userId = member.user._id ? member.user._id.toString() : member.user.toString();

        // Check if member has timeSlots in room
        const memberHasRoomSlots = room.timeSlots.some(slot => {
          const slotUserId = slot.user._id || slot.user;
          return slotUserId.toString() === userId;
        });

        console.log(`runAutoSchedule: Member ${userId} has room slots:`, memberHasRoomSlots);

        // If no room slots, generate from defaultSchedule
        if (!memberHasRoomSlots) {
          const userData = await User.findById(userId).select('defaultSchedule');
          console.log(`runAutoSchedule: Member ${userId} defaultSchedule:`, userData?.defaultSchedule?.length || 0, 'slots');
          console.log(`runAutoSchedule: Member ${userId} defaultSchedule data:`, JSON.stringify(userData?.defaultSchedule, null, 2));

          if (userData && userData.defaultSchedule && userData.defaultSchedule.length > 0) {
            // Convert defaultSchedule to timeSlots for current week
            const currentWeekDate = currentWeek ? new Date(currentWeek) : new Date();
            const startOfWeek = new Date(currentWeekDate);
            startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfWeek.getUTCDay() + 1); // Monday

            for (const schedule of userData.defaultSchedule) {
              // Convert dayOfWeek (0=Sunday) to actual date
              for (let weekOffset = 0; weekOffset < numWeeks; weekOffset++) {
                const targetDate = new Date(startOfWeek);
                targetDate.setUTCDate(startOfWeek.getUTCDate() + (schedule.dayOfWeek === 0 ? 6 : schedule.dayOfWeek - 1) + (weekOffset * 7));

                // Skip weekends (Saturday=6, Sunday=0)
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
                console.log(`runAutoSchedule: Generated slot for ${userId}:`, newSlot);
                generatedTimeSlots.push(newSlot);
              }
            }
          }
        }
      }

      // Combine room timeSlots with generated timeSlots
      const allTimeSlots = [...(room.timeSlots || []), ...generatedTimeSlots];
      console.log('runAutoSchedule: Generated timeSlots count:', generatedTimeSlots.length);
      console.log('runAutoSchedule: Room timeSlots count:', room.timeSlots?.length || 0);
      console.log('runAutoSchedule: Total allTimeSlots count:', allTimeSlots.length);

      // Now validate that all members have some time data (either timeSlots or defaultSchedule)
      const memberIds = membersOnly.map(m => {
        const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
        return memberId;
      });

      // Check if all members have time data (either timeSlots or defaultSchedule from combined allTimeSlots)
      const membersWithTimeData = [...new Set(allTimeSlots.map(slot => {
        const userId = slot.user._id || slot.user;
        return userId.toString();
      }))];

      // Also check for members who have defaultSchedule but no room timeSlots
      for (const memberId of memberIds) {
        if (!membersWithTimeData.includes(memberId)) {
          const userData = await User.findById(memberId).select('defaultSchedule');
          if (userData && userData.defaultSchedule && userData.defaultSchedule.length > 0) {
            membersWithTimeData.push(memberId);
            console.log(`Member ${memberId} has defaultSchedule:`, userData.defaultSchedule.length, 'slots');
          }
        }
      }

      const membersWithoutTimeData = memberIds.filter(id => !membersWithTimeData.includes(id));

      console.log('runAutoSchedule: Total memberIds:', memberIds.length);
      console.log('runAutoSchedule: Members with time data:', membersWithTimeData.length, membersWithTimeData);
      console.log('runAutoSchedule: Members without time data:', membersWithoutTimeData.length, membersWithoutTimeData);
      console.log('runAutoSchedule: All time slots count:', allTimeSlots.length);

      if (membersWithoutTimeData.length > 0) {
        console.log('Members without time data:', membersWithoutTimeData);

        // Get member names for better error message
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

      // Generate blocked times from owner's schedule
      const ownerBlockedTimes = [];

      // Get owner's room timeSlots
      const ownerRoomSlots = allTimeSlots.filter(slot => {
         const slotUserId = slot.user._id || slot.user;
         const ownerId = room.owner._id || room.owner;
         return slotUserId.toString() === ownerId.toString();
      });

      // Get owner's defaultSchedule if they have one
      const ownerUser = await User.findById(room.owner._id || room.owner).select('defaultSchedule');

      // Add owner's timeSlots to blocked times
      ownerRoomSlots.forEach(slot => {
         ownerBlockedTimes.push({
            day: slot.day,
            startTime: slot.startTime,
            endTime: slot.endTime,
            reason: 'owner_schedule'
         });
      });

      // Add owner's defaultSchedule to blocked times
      // 방장의 defaultSchedule을 항상 블록타임으로 추가 (금지시간으로 활용)
      if (ownerUser && ownerUser.defaultSchedule && ownerUser.defaultSchedule.length > 0) {
         const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
         ownerUser.defaultSchedule.forEach(schedule => {
            // Skip weekends
            if (schedule.dayOfWeek === 0 || schedule.dayOfWeek === 6) return;

            // 방장의 시간표는 다른 멤버들이 배정될 수 없는 금지시간으로 설정
            ownerBlockedTimes.push({
               day: dayNames[schedule.dayOfWeek],
               startTime: schedule.startTime,
               endTime: schedule.endTime,
               reason: 'owner_default_schedule_blocked'
            });
         });

         console.log('runAutoSchedule: Added owner defaultSchedule as blocked times:', ownerBlockedTimes.length);
      }

      console.log('runAutoSchedule: Owner blocked times:', ownerBlockedTimes.length);

      // Continue with algorithm...
      const result = schedulingAlgorithm.runAutoSchedule(
         membersOnly,
         room.owner,
         allTimeSlots, // Use combined timeSlots including defaultSchedule
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
         [], // deferredAssignments
      );

      // Apply results...
      room.timeSlots = room.timeSlots.filter(slot => !slot.assignedBy);

      // Add new assignments
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

      // Update carry-over assignments for unassigned members
      if (result.carryOverAssignments && result.carryOverAssignments.length > 0) {
         for (const carryOver of result.carryOverAssignments) {
            const memberIndex = room.members.findIndex(m =>
               m.user.toString() === carryOver.memberId
            );

            if (memberIndex !== -1) {
               // Add to carryOver field
               room.members[memberIndex].carryOver += carryOver.neededHours;

               // Add to carryOverHistory
               room.members[memberIndex].carryOverHistory.push({
                  week: carryOver.week,
                  amount: carryOver.neededHours,
                  reason: 'unassigned_from_auto_schedule',
                  timestamp: new Date()
               });
            }
         }
      }

      await room.save();

      // Return fresh room data
      const freshRoom = await Room.findById(roomId)
         .populate('owner', 'firstName lastName email')
         .populate('members.user', 'firstName lastName email')
         .populate('timeSlots.user', 'firstName lastName email');

      res.json({
         room: freshRoom,
         unassignedMembersInfo: result.unassignedMembersInfo,
         conflictSuggestions: [],
      });
   } catch (error) {
      console.error('Error running auto-schedule:', error);

      // More specific error messages
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

// Add other remaining functions as needed...
