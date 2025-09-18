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

      // Duplicate request check
      const existingRequestQuery = {
         requester: req.user.id,
         roomId,
         status: 'pending',
         'timeSlot.day': timeSlot.day,
         'timeSlot.startTime': timeSlot.startTime,
         'timeSlot.endTime': timeSlot.endTime,
      };

      if (type === 'slot_swap' && targetUserId) {
         existingRequestQuery.targetUserId = targetUserId;
      }

      const existingRequest = await Room.findOne({
         _id: roomId,
         requests: {
            $elemMatch: existingRequestQuery,
         },
      });

      if (existingRequest) {
         return res.status(400).json({ msg: '동일한 요청이 이미 존재합니다.' });
      }

      const room = await Room.findById(roomId);

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      // 중복 요청 체크
      const hasDuplicateRequest = room.requests.some(
         request =>
            request.requester.toString() === req.user.id &&
            request.status === 'pending' &&
            request.timeSlot.day === timeSlot.day &&
            request.timeSlot.startTime === timeSlot.startTime &&
            request.timeSlot.endTime === timeSlot.endTime &&
            (type !== 'slot_swap' || request.targetUserId?.toString() === targetUserId),
      );

      if (hasDuplicateRequest) {
         return res.status(400).json({ msg: '동일한 요청이 이미 존재합니다.' });
      }

      const requestData = {
         requester: req.user.id,
         roomId,
         type,
         timeSlot,
         message: message || '',
         status: 'pending',
         createdAt: new Date(),
      };

      // Add type-specific fields
      if (type === 'slot_swap' && targetUserId) {
         requestData.targetUserId = targetUserId;
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
// @route   POST /api/coordination/requests/:requestId/handle
// @access  Private
exports.handleRequest = async (req, res) => {
   try {
      const { requestId } = req.params;
      const { action, message } = req.body;

      console.log('handleRequest called with:', { requestId, action, message, userId: req.user.id });

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
      const isTargetUser = request.targetUserId && request.targetUserId.toString() === req.user.id;

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
         const { type, timeSlot, targetUserId, targetSlot, requester } = request;

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
         } else if (type === 'slot_swap' && targetUserId && targetSlot) {
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
                  slotUserId.toString() === targetUserId.toString() &&
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
            // Add new slot for requester
            room.timeSlots.push({
               user: requester._id,
               date: new Date(timeSlot.day), // This should be calculated properly
               startTime: timeSlot.startTime,
               endTime: timeSlot.endTime,
               day: timeSlot.day,
               priority: 3,
               status: 'confirmed',
               assignedBy: req.user.id,
               assignedAt: now,
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

      // Only the requester can cancel
      if (request.requester.toString() !== req.user.id) {
         return res.status(403).json({ msg: '요청을 취소할 권한이 없습니다.' });
      }

      // Remove the request
      room.requests.pull(requestId);
      await room.save();

      res.json({ msg: '요청이 취소되었습니다.' });
   } catch (error) {
      console.error('Error canceling request:', error);
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
         .populate('requests.requester', 'firstName lastName email')
         .populate('requests.targetUser', 'firstName lastName email');

      const sentRequests = rooms.flatMap(room =>
         room.requests.filter(req => req.requester && req.requester._id.toString() === userId),
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
               request.targetUserId &&
               request.targetUserId.toString() === userId
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

      // Additional validation before running algorithm
      if (!room.timeSlots || room.timeSlots.length === 0) {
        return res.status(400).json({ msg: '시간표 데이터에 오류가 있습니다. 멤버들이 시간을 입력했는지 확인해주세요.' });
      }

      // Validate timeSlots data
      const invalidSlots = room.timeSlots.filter(slot =>
        !slot.user || !slot.startTime || !slot.endTime || !slot.day
      );
      if (invalidSlots.length > 0) {
        console.log('Invalid slots found:', invalidSlots);
        return res.status(400).json({ msg: '시간표 데이터에 오류가 있습니다. 일부 시간 슬롯 정보가 불완전합니다.' });
      }

      // Validate members have submitted timeSlots
      const membersWithSlots = [...new Set(room.timeSlots.map(slot => {
        const userId = slot.user._id || slot.user;
        return userId.toString();
      }))];

      const memberIds = membersOnly.map(m => {
        const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
        return memberId;
      });

      const membersWithoutSlots = memberIds.filter(id => !membersWithSlots.includes(id));

      if (membersWithoutSlots.length > 0) {
        console.log('Members without slots:', membersWithoutSlots);
        return res.status(400).json({ msg: '일부 멤버가 시간표를 입력하지 않았습니다. 모든 멤버가 시간을 입력해야 자동 배정이 가능합니다.' });
      }

      // Continue with algorithm...
      const result = schedulingAlgorithm.runAutoSchedule(
         membersOnly,
         room.owner,
         room.timeSlots || [],
         {
            minHoursPerWeek,
            numWeeks,
            currentWeek,
            ownerPreferences: room.settings.ownerPreferences || {},
            roomSettings: room.settings || {},
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
