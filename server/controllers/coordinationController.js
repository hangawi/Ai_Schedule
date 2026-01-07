/**
 * ===================================================================================================
 * Coordination Controller (조정 컨트롤러)
 * ===================================================================================================
 *
 * 설명: 일정 조정 방(Room) 생성 및 관리
 *
 * 주요 기능:
 * - 방 생성/수정/삭제
 * - 멤버 추가/제거
 * - 방 설정 관리
 * - 자동 배정 트리거
 *
 * 관련 파일:
 * - server/models/room.js - Room 모델
 * - server/services/schedulingAlgorithm.js - 자동 배정
 *
 * ===================================================================================================
 */

const mongoose = require('mongoose');
const Room = require('../models/room');
const User = require('../models/user');
const Event = require('../models/event');
const ActivityLog = require('../models/ActivityLog');
const { findOptimalSlots } = require('../services/schedulingAnalysisService');
const schedulingAlgorithm = require('../services/schedulingAlgorithm');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Import separated controllers
const roomController = require('./roomController');
const timeSlotController = require('./timeSlotController');
const requestController = require('./coordinationRequestController');
const memberController = require('./coordinationMemberController');
const schedulingController = require('./coordinationSchedulingController');
const exchangeController = require('./coordinationExchangeController');

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

// Re-export from requestController
exports.createRequest = requestController.createRequest;
exports.handleRequest = requestController.handleRequest;
exports.cancelRequest = requestController.cancelRequest;
exports.getSentRequests = requestController.getSentRequests;
exports.getReceivedRequests = requestController.getReceivedRequests;
exports.handleChainConfirmation = requestController.handleChainConfirmation;

// Re-export from memberController
exports.removeMember = memberController.removeMember;
exports.leaveRoom = memberController.leaveRoom;
exports.getExchangeRequestsCount = memberController.getExchangeRequestsCount;

// Re-export from schedulingController
exports.runAutoSchedule = schedulingController.runAutoSchedule;
exports.deleteAllTimeSlots = schedulingController.deleteAllTimeSlots;

// Re-export from exchangeController
exports.parseExchangeRequest = exchangeController.parseExchangeRequest;
exports.smartExchange = exchangeController.smartExchange;

// 방장이나 어드민 로그 조회
exports.getRoomLogs = async (req, res) => {
   try {
      const { roomId } = req.params;
      const userId = req.user.id;  // MongoDB ObjectId string
      const { page = 1, limit = 50 } = req.query;

      const room = await Room.findById(roomId);
      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      // 방장인지 확인
      const roomOwnerId = room.ownerId?.toString() || room.owner?.toString();
      if (!roomOwnerId || roomOwnerId !== userId) {
         return res.status(403).json({ msg: '방장만 로그를 조회할 수 있습니다.' });
      }

      // 초기화 시점 이후의 로그만 조회
      const clearedAt = room.logsClearedAt?.owner;
      console.log('Owner clearedAt:', clearedAt);

      const query = { roomId };
      if (clearedAt) {
         query.createdAt = { $gt: clearedAt };
         console.log('Filtering logs after:', clearedAt);
      }

      const allLogs = await ActivityLog.find(query)
         .sort({ createdAt: -1 });

      // 멤버별 초기화 시점도 필터링
      const memberClearedAt = room.memberLogsClearedAt?.owner || {};
      const filteredLogs = allLogs.filter(log => {
         const userClearedAt = memberClearedAt[log.userId];
         if (userClearedAt && log.createdAt <= userClearedAt) {
            return false; // 해당 멤버의 로그를 방장이 초기화함
         }
         return true;
      });

      // 페이지네이션 적용
      const total = filteredLogs.length;
      const paginatedLogs = filteredLogs.slice((page - 1) * limit, page * limit);

      res.json({
         logs: paginatedLogs,
         roomName: room.name,
         pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total
         }
      });
   } catch (error) {
      console.error('Get room logs error:', error);
      res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
   }
};

// Clear room logs for owner
exports.clearRoomLogs = async (req, res) => {
   try {
      const { roomId } = req.params;
      const userId = req.user.id;

      const room = await Room.findById(roomId);
      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      // 방장인지 확인
      const roomOwnerId = room.ownerId?.toString() || room.owner?.toString();
      if (!roomOwnerId || roomOwnerId !== userId) {
         return res.status(403).json({ msg: '방장만 로그를 초기화할 수 있습니다.' });
      }

      // 방장의 초기화 시점 업데이트
      if (!room.logsClearedAt) {
         room.logsClearedAt = { owner: null, admin: null };
      }
      room.logsClearedAt.owner = new Date();
      room.markModified('logsClearedAt');
      await room.save();

      console.log('Owner cleared logs at:', room.logsClearedAt.owner);

      res.json({
         success: true,
         msg: '로그가 초기화되었습니다.',
         clearedAt: room.logsClearedAt.owner
      });
   } catch (error) {
      console.error('Clear room logs error:', error);
      res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
   }
};

// 특정 사용자의 로그만 삭제 (방장 전용 - 타임스탬프 방식)
exports.clearUserLogs = async (req, res) => {
   try {
      const { roomId, userId } = req.params;
      const currentUserId = req.user.id;

      // 방 존재 확인
      const room = await Room.findById(roomId);
      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      // 방장 권한 확인
      if (room.owner.toString() !== currentUserId) {
         return res.status(403).json({ msg: '방장만 로그를 삭제할 수 있습니다.' });
      }

      // 방장이 멤버별 초기화 시점 업데이트 (실제 로그 삭제 안함)
      if (!room.memberLogsClearedAt) {
         room.memberLogsClearedAt = { owner: {}, admin: {} };
      }
      if (!room.memberLogsClearedAt.owner) {
         room.memberLogsClearedAt.owner = {};
      }
      room.memberLogsClearedAt.owner[userId] = new Date();
      room.markModified('memberLogsClearedAt');
      await room.save();

      console.log('Owner cleared member logs for user:', userId, 'at:', room.memberLogsClearedAt.owner[userId]);

      res.json({
         success: true,
         msg: '로그가 초기화되었습니다.',
         clearedAt: room.memberLogsClearedAt.owner[userId]
      });
   } catch (error) {
      console.error('Clear user logs error:', error);
      res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
   }
};


/**
 * @desc    사용자의 모든 확정된 일정 조회 (모든 방의 confirmed timeSlots)
 * @route   GET /api/coordination/my-confirmed-schedules
 * @access  Private
 */
exports.getMyConfirmedSchedules = async (req, res) => {
   try {
      const userId = req.user.id;

      // 사용자가 참여 중인 모든 방 조회
      const rooms = await Room.find({
         $or: [
            { owner: userId },
            { 'members.user': userId }
         ]
      }).populate('timeSlots.user', 'firstName lastName email')
        .populate('owner', 'firstName lastName');

      if (!rooms || rooms.length === 0) {
         return res.json({ schedules: [] });
      }

      // 모든 방의 확정된 timeSlots 수집
      const confirmedSchedules = [];

      rooms.forEach(room => {
         // 해당 사용자의 confirmed 상태인 timeSlots만 필터링
         const userSlots = room.timeSlots.filter(slot => {
            const slotUserId = slot.user?._id?.toString() || slot.user?.toString();
            return slotUserId === userId && slot.status === 'confirmed';
         });

         userSlots.forEach(slot => {
            // Event 형식과 유사하게 변환
            confirmedSchedules.push({
               id: slot._id,
               title: slot.subject || '확정된 일정',
               date: slot.date,
               startTime: slot.startTime,
               endTime: slot.endTime,
               day: slot.day,
               roomId: room._id,
               roomName: room.name,
               priority: slot.priority || 3,
               category: 'coordination', // 조율 일정 구분
               isCoordinated: true, // 일정 맞추기로 확정된 일정임을 표시
               participants: room.members.length, // 방 멤버 수
               color: 'green', // 확정 일정은 초록색으로 구분
               assignedBy: slot.assignedBy,
               assignedAt: slot.assignedAt
            });
         });
      });

      // 날짜순 정렬 (오래된 것 -> 최신 순)
      confirmedSchedules.sort((a, b) => new Date(a.date) - new Date(b.date));

      res.json({ schedules: confirmedSchedules });
   } catch (error) {
      console.error('Get confirmed schedules error:', error);
      res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
   }
};
