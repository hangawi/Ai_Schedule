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

// 🆕 최적 만남 시간 찾기 (멤버 선호시간 겹침 기반)
exports.findOptimalMeetingTime = async (req, res) => {
   try {
      const ScheduleSuggestion = require('../models/ScheduleSuggestion');

      const room = await Room.findById(req.params.roomId)
         .populate('members.user', '_id firstName lastName')
         .populate('owner', '_id firstName lastName');

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      // 모든 멤버 ID 수집 (방장 + 멤버, 중복 제거)
      const allMemberIds = [...new Set([
         room.owner._id.toString(),
         ...room.members.map(m => m.user._id.toString())
      ])];
      const totalMembers = allMemberIds.length;

      // 모든 멤버의 defaultSchedule 가져오기
      const users = await User.find({ _id: { $in: allMemberIds } })
         .select('_id firstName lastName defaultSchedule');

      // 요청자 본인의 선호시간 체크
      const requestingUser = users.find(u => u._id.toString() === req.user.id);
      if (!requestingUser || !requestingUser.defaultSchedule || requestingUser.defaultSchedule.length === 0) {
         return res.json({
            success: false,
            reason: 'no_preferred_times',
            message: '선호시간이 등록되어 있지 않아 최적 시간표를 만들 수 없습니다. 먼저 선호시간을 설정해주세요.',
            totalMembers,
            candidates: []
         });
      }

      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const results = [];

      // 각 요일별로 겹치는 시간 계산
      for (let day = 0; day <= 6; day++) {
         // 이 요일에 선호시간이 있는 멤버 수집
         const membersOnDay = [];
         for (const user of users) {
            const daySlots = (user.defaultSchedule || []).filter(s => s.dayOfWeek === day);
            if (daySlots.length > 0) {
               membersOnDay.push({
                  userId: user._id.toString(),
                  name: user.firstName || '사용자',
                  slots: daySlots.map(s => ({ startTime: s.startTime, endTime: s.endTime }))
               });
            }
         }

         if (membersOnDay.length < 2) continue;

         // 30분 단위로 슬롯 분할하여 멤버별 가용 여부 체크
         const slotMembers = {}; // "HH:MM" -> Set of userIds

         for (const member of membersOnDay) {
            for (const slot of member.slots) {
               const [sh, sm] = slot.startTime.split(':').map(Number);
               const [eh, em] = slot.endTime.split(':').map(Number);
               const startMin = sh * 60 + sm;
               const endMin = eh * 60 + em;

               for (let m = startMin; m < endMin; m += 30) {
                  const key = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
                  if (!slotMembers[key]) slotMembers[key] = new Set();
                  slotMembers[key].add(member.userId);
               }
            }
         }

         // 연속된 슬롯을 그룹으로 묶기 (같은 멤버 set인 경우만)
         const sortedTimes = Object.keys(slotMembers).sort();
         let currentGroup = null;

         for (const time of sortedTimes) {
            const memberSet = slotMembers[time];
            const count = memberSet.size;

            if (count >= 2) {
               const memberKey = [...memberSet].sort().join(',');
               const [h, m] = time.split(':').map(Number);
               const nextMin = h * 60 + m + 30;
               const endTime = `${String(Math.floor(nextMin / 60)).padStart(2, '0')}:${String(nextMin % 60).padStart(2, '0')}`;

               if (currentGroup && currentGroup.memberKey === memberKey) {
                  currentGroup.endTime = endTime;
               } else {
                  if (currentGroup) results.push(currentGroup);
                  currentGroup = {
                     dayOfWeek: day,
                     dayName: dayNames[day],
                     startTime: time,
                     endTime: endTime,
                     count: count,
                     memberKey: memberKey,
                     members: [...memberSet],
                     totalMembers: totalMembers
                  };
               }
            } else {
               if (currentGroup) {
                  results.push(currentGroup);
                  currentGroup = null;
               }
            }
         }
         if (currentGroup) results.push(currentGroup);
      }

      // 정렬: 가용 멤버 수 내림차순, 요일 오름차순
      results.sort((a, b) => b.count - a.count || a.dayOfWeek - b.dayOfWeek);

      // 멤버 이름 매핑
      const userMap = {};
      for (const user of users) {
         userMap[user._id.toString()] = user.firstName || '사용자';
      }

      // 이미 최적시간표에서 생성된 활성 suggestion 조회 (확정 시 목록에서 제외)
      const activeSuggestions = await ScheduleSuggestion.find({
         room: req.params.roomId,
         status: { $in: ['future', 'today'] },
         'optimalSource.dayOfWeek': { $ne: null }
      });

      const usedSlotKeys = new Set(
         activeSuggestions.map(s =>
            `${s.optimalSource.dayOfWeek}-${s.optimalSource.startTime}-${s.optimalSource.endTime}`
         )
      );

      const candidates = results
         .map(r => ({
            dayOfWeek: r.dayOfWeek,
            dayName: r.dayName,
            startTime: r.startTime,
            endTime: r.endTime,
            count: r.count,
            totalMembers: r.totalMembers,
            memberNames: r.members.map(id => userMap[id] || '사용자'),
            isAllMembers: r.count === totalMembers
         }))
         .filter(c => !usedSlotKeys.has(`${c.dayOfWeek}-${c.startTime}-${c.endTime}`));

      // 겹치는 시간이 전혀 없는 경우 (선호시간은 있지만 다른 사람과 안 겹침)
      if (candidates.length === 0 && results.length === 0) {
         return res.json({
            success: false,
            reason: 'no_overlap',
            message: '다른 멤버들과 겹치는 선호시간이 없어 시간표를 만들 수 없습니다.',
            totalMembers,
            candidates: []
         });
      }

      res.json({
         success: true,
         totalMembers,
         candidates
      });
   } catch (error) {
      console.error('findOptimalMeetingTime error:', error);
      res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
   }
};

/**
 * 최적 시간 선택 → 일정 제안(ScheduleSuggestion) 생성
 */
exports.createSuggestionFromOptimal = async (req, res) => {
   try {
      const ScheduleSuggestion = require('../models/ScheduleSuggestion');
      const ChatMessage = require('../models/ChatMessage');

      const { dayOfWeek, startTime, endTime, summary } = req.body;
      const roomId = req.params.roomId;
      const userId = req.user.id;

      const room = await Room.findById(roomId)
         .populate('members.user', '_id firstName lastName')
         .populate('owner', '_id firstName lastName');
      if (!room) return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });

      // 다음 해당 요일 날짜 계산
      const today = new Date();
      const todayDow = today.getDay();
      let diff = dayOfWeek - todayDow;
      if (diff < 0) diff += 7;
      if (diff === 0) diff = 0; // 오늘이 해당 요일이면 오늘
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + diff);
      const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

      // 모든 멤버를 memberResponses에 추가
      const memberResponses = room.members.map(member => {
         const memberId = member.user._id.toString();
         if (memberId === userId) {
            return { user: member.user._id, status: 'accepted', respondedAt: new Date() };
         }
         return { user: member.user._id, status: 'pending', respondedAt: null };
      });
      // 방장이 members에 없는 경우 추가
      const ownerInMembers = room.members.some(m => m.user._id.toString() === room.owner._id.toString());
      if (!ownerInMembers) {
         if (room.owner._id.toString() === userId) {
            memberResponses.push({ user: room.owner._id, status: 'accepted', respondedAt: new Date() });
         } else {
            memberResponses.push({ user: room.owner._id, status: 'pending', respondedAt: null });
         }
      }

      const suggestion = new ScheduleSuggestion({
         room: roomId,
         summary: summary || '최적 시간 일정',
         date: dateStr,
         startTime,
         endTime,
         location: '',
         memberResponses,
         status: 'future',
         suggestedBy: userId,
         optimalSource: { dayOfWeek, startTime, endTime }
      });
      await suggestion.save();

      // 제안자의 personalTime에 추가
      const suggester = await User.findById(userId);
      if (suggester) {
         let adjEndTime = endTime === '24:00' ? '23:59' : endTime;
         const newPtId = suggester.personalTimes.length > 0
            ? Math.max(...suggester.personalTimes.map(pt => pt.id || 0)) + 1 : 1;
         suggester.personalTimes.push({
            id: newPtId,
            title: `[약속] ${summary || '최적 시간 일정'}`,
            type: 'event',
            startTime,
            endTime: adjEndTime,
            specificDate: dateStr,
            suggestionId: suggestion._id.toString(),
            participants: 1
         });
         await suggester.save();
      }

      // 시스템 메시지 전송
      const userName = suggester ? `${suggester.firstName || ''}`.trim() || '사용자' : '사용자';
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const systemMsg = new ChatMessage({
         room: roomId,
         sender: userId,
         type: 'system',
         content: `${userName}님이 최적 시간으로 일정을 제안했습니다: ${dateStr} (${dayNames[dayOfWeek]}요일) ${startTime}~${endTime}`,
         suggestionId: suggestion._id
      });
      await systemMsg.save();

      // 소켓 이벤트 (global.io 사용 - 다른 컨트롤러와 동일)
      if (global.io) {
         global.io.to(`room-${roomId}`).emit('chat-message', systemMsg);
         global.io.to(`room-${roomId}`).emit('suggestion-updated', { roomId, suggestion });
      }

      res.json({ success: true, suggestion });
   } catch (error) {
      console.error('createSuggestionFromOptimal error:', error);
      res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
   }
};
