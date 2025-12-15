/**
 * ===================================================================================================
 * Coordination Request Controller (조정 요청 컨트롤러)
 * ===================================================================================================
 *
 * 설명: 시간 교환 요청 처리 (A ↔ B)
 *
 * 주요 기능:
 * - 교환 요청 생성
 * - 요청 승인/거절 처리
 * - 연쇄 교환 (Chain Exchange) - A → B → C → D
 * - 자동 빈 시간 찾기
 *
 * 관련 파일:
 * - server/controllers/coordinationRequestController/helpers/
 * - server/controllers/coordinationExchangeController/
 *
 * ===================================================================================================
 */

const Room = require('../../models/room');
const User = require('../../models/user');
const ActivityLog = require('../../models/ActivityLog');

// Constants
const { ERROR_MESSAGES } = require('./constants/errorMessages');
const { DAY_NAMES } = require('./constants/dayNames');

// Utils
const { toMinutes, toTimeString, timeRangesOverlap } = require('./utils/timeConverter');
const { slotBelongsToUser } = require('./utils/slotComparator');

// Validators
const { validateCreateRequest, validateAction, hasDuplicateRequest } = require('./validators/validateRequest');
const { validateHandlePermission, validateDeletePermission } = require('./validators/validatePermission');

// Helpers
const { findOverlappingSlots } = require('./helpers/findOverlappingSlots');
const { buildScheduleByDay } = require('./helpers/buildScheduleByDay');
const { findCandidates } = require('./helpers/findCandidates');

// Services
const { logApproval, logRejection, formatSlotDetails } = require('./services/activityLogService');

// 체인 요청용 헬퍼 함수들 import
const { findChainCandidates } = require('../coordinationExchangeRequestController');

// @desc    Create a new request
// @route   POST /api/coordination/requests
// @access  Private
exports.createRequest = async (req, res) => {
  try {
    const { roomId, type, targetUserId, targetSlot, timeSlot, message } = req.body;

    // 필수 필드 검증
    const validationError = validateCreateRequest(req.body);
    if (validationError) {
      return res.status(validationError.status).json({ msg: validationError.msg });
    }

    const room = await Room.findById(roomId)
      .populate('members.user', 'firstName lastName email');
    if (!room) {
      return res.status(404).json({ msg: ERROR_MESSAGES.ROOM_NOT_FOUND });
    }

    // 방장은 시간표 교환요청을 할 수 없음
    if (room.owner.toString() === req.user.id) {
      return res.status(403).json({ msg: ERROR_MESSAGES.OWNER_CANNOT_REQUEST });
    }

    // 중복 요청 확인
    if (hasDuplicateRequest(room.requests, req.user.id, timeSlot, type, targetUserId)) {
      return res.status(400).json({ msg: ERROR_MESSAGES.DUPLICATE_REQUEST, duplicateRequest: true });
    }

    // Generate descriptive message if not provided
    let finalMessage = message || '';
    if (!message && (type === 'time_request' || type === 'time_change') && targetUserId) {
      const requesterMember = room.members.find(m =>
        (m.user._id || m.user).toString() === req.user.id
      );
      const requesterName = requesterMember?.user?.firstName && requesterMember?.user?.lastName
        ? `${requesterMember.user.firstName} ${requesterMember.user.lastName}`
        : requesterMember?.user?.firstName || '요청자';

      const dayMapKorean = {
        'monday': '월요일',
        'tuesday': '화요일',
        'wednesday': '수요일',
        'thursday': '목요일',
        'friday': '금요일'
      };
      const dayKorean = dayMapKorean[timeSlot.day] || timeSlot.day;

      // Find requester's current slots to inform target where they'll move
      const requesterCurrentSlots = room.timeSlots.filter(slot => {
        const slotUserId = (slot.user._id || slot.user).toString();
        return slotUserId === req.user.id;
      });

      let targetDestinationInfo = '';
      if (requesterCurrentSlots.length > 0) {
        // Group by date and get time range
        const slotsByDate = {};
        requesterCurrentSlots.forEach(slot => {
          const dateKey = new Date(slot.date).toISOString().split('T')[0];
          if (!slotsByDate[dateKey]) slotsByDate[dateKey] = [];
          slotsByDate[dateKey].push(slot);
        });

        // Get first date group for the message
        const firstDateSlots = Object.values(slotsByDate)[0];
        if (firstDateSlots && firstDateSlots.length > 0) {
          firstDateSlots.sort((a, b) => {
            const [aH, aM] = a.startTime.split(':').map(Number);
            const [bH, bM] = b.startTime.split(':').map(Number);
            return (aH * 60 + aM) - (bH * 60 + bM);
          });
          const firstSlot = firstDateSlots[0];
          const lastSlot = firstDateSlots[firstDateSlots.length - 1];
          const slotDayKorean = dayMapKorean[firstSlot.day] || firstSlot.day;
          targetDestinationInfo = ` 회원님은 ${slotDayKorean} ${firstSlot.startTime}-${lastSlot.endTime}로 이동하게 됩니다.`;
        }
      }

      finalMessage = `${requesterName}님이 회원님의 ${dayKorean} ${timeSlot.startTime}-${timeSlot.endTime} 자리로 이동하고 싶어합니다.${targetDestinationInfo}`;
    } else if (!message && type === 'slot_swap' && targetUserId && targetSlot) {
      // For slot_swap requests
      const requesterMember = room.members.find(m =>
        (m.user._id || m.user).toString() === req.user.id
      );
      const requesterName = requesterMember?.user?.firstName && requesterMember?.user?.lastName
        ? `${requesterMember.user.firstName} ${requesterMember.user.lastName}`
        : requesterMember?.user?.firstName || '요청자';

      const dayMapKorean = {
        'monday': '월요일',
        'tuesday': '화요일',
        'wednesday': '수요일',
        'thursday': '목요일',
        'friday': '금요일'
      };

      const targetDayKorean = dayMapKorean[targetSlot.day] || targetSlot.day;
      const timeSlotDayKorean = dayMapKorean[timeSlot.day] || timeSlot.day;

      finalMessage = `${requesterName}님이 회원님과 자리를 교환하고 싶어합니다. ${requesterName}님은 ${targetDayKorean} ${targetSlot.startTime}-${targetSlot.endTime}에서 ${timeSlotDayKorean} ${timeSlot.startTime}-${timeSlot.endTime}로, 회원님은 ${timeSlotDayKorean} ${timeSlot.startTime}-${timeSlot.endTime}에서 ${targetDayKorean} ${targetSlot.startTime}-${targetSlot.endTime}로 이동합니다.`;
    }

    const requestData = {
      requester: req.user.id,
      type,
      timeSlot,
      message: finalMessage,
      status: 'pending',
      createdAt: new Date(),
    };

    if ((type === 'slot_swap' || type === 'time_request' || type === 'time_change') && targetUserId) {
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
    res.status(500).json({ msg: ERROR_MESSAGES.SERVER_ERROR });
  }
};

// @desc    Handle a request (approve/reject)
// @route   POST /api/coordination/requests/:requestId/:action
// @access  Private
exports.handleRequest = async (req, res) => {
   try {
      const { requestId, action } = req.params;
      const { message } = req.body;

      console.log('🎯 ========== HANDLE REQUEST ==========');
      console.log('📋 Request ID:', requestId);
      console.log('📋 Action:', action);
      console.log('👤 User ID:', req.user.id);

      // 액션 검증
      const validationError = validateAction(action);
      if (validationError) {
         return res.status(validationError.status).json({ msg: validationError.msg });
      }

      const room = await Room.findOne({ 'requests._id': requestId })
         .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions')
         .populate('requests.requester', 'firstName lastName email')
         .populate('requests.targetUser', 'firstName lastName email defaultSchedule scheduleExceptions')
         .populate('timeSlots.user', '_id firstName lastName email')
         .populate('members.user', 'firstName lastName email defaultSchedule scheduleExceptions');

      if (!room) {
         return res.status(404).json({ msg: ERROR_MESSAGES.REQUEST_NOT_FOUND });
      }

      const request = room.requests.id(requestId);
      if (!request) {
         return res.status(404).json({ msg: ERROR_MESSAGES.REQUEST_NOT_FOUND });
      }

      // 권한 검증
      const permissionError = validateHandlePermission(room, request, req.user.id);
      if (permissionError) {
         return res.status(permissionError.status).json({ msg: permissionError.msg });
      }

      if (request.status !== 'pending') {
         return res.status(400).json({ msg: ERROR_MESSAGES.ALREADY_PROCESSED });
      }

      const now = new Date();
      request.status = action;
      request.respondedAt = now;
      request.respondedBy = req.user.id;
      request.response = message || '';

      console.log('📊 Before processing - Total timeSlots:', room.timeSlots.length);

      if (action === 'approved') {
         console.log('✅ Action is APPROVED - processing request...');
         const { type, timeSlot: ts, targetSlot, targetUser, requester } = request;
         const timeSlot = (ts && Object.keys(ts).length > 0) ? ts : targetSlot;
         console.log('📋 Request type:', type);
         console.log('📋 TimeSlot:', JSON.stringify(timeSlot), ts ? '(from timeSlot)' : '(from targetSlot fallback)');
         console.log('📋 TimeSlot.date:', timeSlot?.date ? new Date(timeSlot.date).toISOString() : 'undefined');
         console.log('📋 Requester:', requester._id || requester);

         if (type === 'slot_release') {
            room.timeSlots = room.timeSlots.filter(slot => {
               const slotUserId = slot.user._id || slot.user;
               return !(
                  slotUserId.toString() === requester._id.toString() &&
                  slot.day === timeSlot.day &&
                  slot.startTime === timeSlot.startTime
               );
            });
            room.markModified('timeSlots');
         } else if (type === 'slot_swap' && targetUser) {
            const targetSlotIndex = room.timeSlots.findIndex(slot =>
                slot.user &&
                slot.user._id.toString() === targetUser._id.toString() &&
                slot.day === timeSlot.day &&
                slot.startTime === timeSlot.startTime
            );

            if (targetSlotIndex !== -1) {
                room.timeSlots[targetSlotIndex].user = requester._id;
                room.markModified('timeSlots');
            }
         } else if (type === 'time_request' || type === 'time_change') {
            console.log('🔍 [DEBUG] Entered time_request/time_change block');
            if (targetUser) {
               console.log('🔍 [DEBUG] targetUser exists:', targetUser._id || targetUser);

               const requesterOriginalSlots = [];
               if (request.requesterSlots && request.requesterSlots.length > 0) {
                  requesterOriginalSlots.push(...request.requesterSlots);
               } else {
                  const requesterSlots = room.timeSlots.filter(slot => {
                     const slotUserId = slot.user._id || slot.user;
                     return slotUserId.toString() === requester._id.toString();
                  });
                  requesterSlots.forEach(slot => {
                     requesterOriginalSlots.push({
                        user: requester._id,
                        date: slot.date,
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                        day: slot.day,
                        subject: slot.subject || '자동 배정',
                        status: 'confirmed'
                     });
                  });
               }
               console.log(`💾 [EARLY] Saved ${requesterOriginalSlots.length} requester's original slots for potential restoration`);

               const requesterHasSlot = room.timeSlots.some(slot => {
                  const slotUserId = slot.user._id || slot.user;
                  if (slotUserId.toString() !== requester._id.toString()) return false;
                  if (slot.day !== timeSlot.day) return false;
                  if (timeSlot.date && slot.date) {
                     const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
                     const requestDateStr = new Date(timeSlot.date).toISOString().split('T')[0];
                     if (slotDateStr !== requestDateStr) return false;
                  }
                  return timeRangesOverlap(
                     slot.startTime,
                     slot.endTime,
                     timeSlot.startTime,
                     timeSlot.endTime
                  );
               });

               if (requesterHasSlot) {
                  // 중복이므로 아무것도 하지 않음
               } else {
                  console.log(`📊 Total slots in room: ${room.timeSlots.length}`);
                  console.log(`📊 Target user ID: ${targetUser._id}`);
                  console.log(`📊 Looking for day: ${timeSlot.day}, time: ${timeSlot.startTime}-${timeSlot.endTime}`);

                  const overlappingSlots = findOverlappingSlots(room.timeSlots, targetUser._id, timeSlot);

                  console.log(`📊 Found ${overlappingSlots.length} overlapping slots from target user`);
                  if (overlappingSlots.length > 0) {
                     console.log(`   Overlapping slots:`, overlappingSlots.map(s => ({
                        date: new Date(s.date).toISOString().split('T')[0],
                        time: `${s.startTime}-${s.endTime}`,
                        id: s._id.toString().slice(-6)
                     })));

                     overlappingSlots.sort((a, b) => {
                        const aTime = a.startTime.split(':').map(Number);
                        const bTime = b.startTime.split(':').map(Number);
                        return (aTime[0] * 60 + aTime[1]) - (bTime[0] * 60 + bTime[1]);
                     });

                     const firstSlot = overlappingSlots[0];
                     const lastSlot = overlappingSlots[overlappingSlots.length - 1];

                     const requestStart = toMinutes(timeSlot.startTime);
                     const requestEnd = toMinutes(timeSlot.endTime);

                     const totalDuration = overlappingSlots.reduce((sum, slot) => {
                        const start = toMinutes(slot.startTime);
                        const end = toMinutes(slot.endTime);
                        return sum + (end - start);
                     }, 0);

                     // 🎯 Stage 1: Check if direct exchange is possible (mutual preferred time compatibility)
                     console.log('🔍 Stage 1: Checking mutual preferred time compatibility...');

                     // Get requester's member data
                     const requesterMember = room.members.find(m =>
                        (m.user._id || m.user).toString() === (requester._id || requester).toString()
                     );

                     if (requesterMember && requesterMember.user.defaultSchedule && targetUser.defaultSchedule) {
                        const requesterPreferredTimes = requesterMember.user.defaultSchedule || [];
                        const targetPreferredTimes = targetUser.defaultSchedule || [];

                        // Check if target's slot is in requester's preferred times
                        const isTargetSlotInRequesterPreferred = requesterPreferredTimes.some(pref => {
                           // 우선순위 필터 제거 - 모든 가능시간 체크
                           if (pref.dayOfWeek !== timeSlot.day &&
                               DAY_NAMES[pref.dayOfWeek] !== timeSlot.day) return false;
                           // Check if target slot time is within preferred time range
                           return pref.startTime <= timeSlot.startTime && pref.endTime >= timeSlot.endTime;
                        });

                        // 🔧 FIX: Check if requester's ORIGINAL slots are in target's preferred times
                        // (Before: was checking if target's current slots are in target's preferred times - always true!)
                        let areRequesterSlotsInTargetPreferred = true;
                        if (request.requesterSlots && request.requesterSlots.length > 0) {
                           areRequesterSlotsInTargetPreferred = request.requesterSlots.every(reqSlot => {
                              return targetPreferredTimes.some(pref => {
                                 // 우선순위 필터 제거 - 모든 가능시간 체크
                                 if (pref.dayOfWeek !== reqSlot.day &&
                                     DAY_NAMES[pref.dayOfWeek] !== reqSlot.day) return false;
                                 return pref.startTime <= reqSlot.startTime && pref.endTime >= reqSlot.endTime;
                              });
                           });
                        }

                        console.log('🔍 Stage 1 Results:', {
                           isTargetSlotInRequesterPreferred,
                           areRequesterSlotsInTargetPreferred
                        });

                        // 🔧 교환 요청의 경우: 요청자가 이미 타겟 시간을 원한다고 명시했으므로
                        // 타겟이 요청자의 시간을 받을 수 있는지만 확인하면 됨
                        // If both conditions are met, execute direct exchange
                        if (areRequesterSlotsInTargetPreferred) {
                           console.log('✅ Stage 1: Direct exchange possible! Target can accept requester\'s time.');
                           console.log('🔄 Executing direct exchange...');
                           console.log('📊 Before exchange - Total timeSlots:', room.timeSlots.length);

                           // Step 1: Remove requester's current slots (if any)
                           console.log('🗑️ Removing requester\'s original slots...');
                           if (request.requesterSlots && request.requesterSlots.length > 0) {
                              request.requesterSlots.forEach(reqSlot => {
                                 const reqDateStr = reqSlot.date ? new Date(reqSlot.date).toISOString().split('T')[0] : null;
                                 const index = room.timeSlots.findIndex(slot => {
                                    const slotUserId = slot.user._id || slot.user;
                                    if (slotUserId.toString() !== requester._id.toString()) return false;
                                    if (slot.startTime !== reqSlot.startTime) return false;
                                    if (slot.endTime !== reqSlot.endTime) return false;
                                    if (!slot.date) return false;
                                    if (reqDateStr) {
                                       const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
                                       if (slotDateStr !== reqDateStr) return false;
                                    } else {
                                       return false;
                                    }
                                    return true;
                                 });
                                 if (index !== -1) {
                                    room.timeSlots.splice(index, 1);
                                    console.log(`   ❌ Removed requester's slot: ${reqSlot.startTime}-${reqSlot.endTime}`);
                                 }
                              });
                              room.markModified('timeSlots');
                           }

                           // Step 2: Remove target's slots (overlappingSlots)
                           console.log(`🗑️ Removing ${overlappingSlots.length} target's slots...`);
                           overlappingSlots.forEach(slot => {
                              const index = room.timeSlots.findIndex(s => s._id.equals(slot._id));
                              if (index !== -1) {
                                 room.timeSlots.splice(index, 1);
                                 console.log(`   ❌ Removed target's slot: ${new Date(slot.date).toISOString().split('T')[0]} ${slot.startTime}-${slot.endTime}`);
                              }
                           });
                           room.markModified('timeSlots');

                           // Step 3: Add requester to target's position (requester gets overlappingSlots)
                           console.log(`➕ Adding requester to target's position...`);
                           overlappingSlots.forEach(slot => {
                              room.timeSlots.push({
                                 user: requester._id,
                                 date: slot.date,
                                 startTime: slot.startTime,
                                 endTime: slot.endTime,
                                 day: slot.day,
                                 subject: '직접 교환',
                                 status: 'confirmed',
                                 assignedBy: req.user.id,
                                 assignedAt: new Date()
                              });
                           });
                           console.log(`   ✅ Added ${overlappingSlots.length} slots for requester`);

                           // Step 4: Add target user to requester's original position (if requesterSlots exists)
                           if (request.requesterSlots && request.requesterSlots.length > 0) {
                              console.log(`➕ Adding target user to requester's original position...`);
                              request.requesterSlots.forEach(reqSlot => {
                                 room.timeSlots.push({
                                    user: targetUser._id,
                                    date: reqSlot.date,
                                    startTime: reqSlot.startTime,
                                    endTime: reqSlot.endTime,
                                    day: reqSlot.day,
                                    subject: '직접 교환',
                                    status: 'confirmed',
                                    assignedBy: req.user.id,
                                    assignedAt: new Date()
                                 });
                              });
                              console.log(`   ✅ Added ${request.requesterSlots.length} slots for target user`);
                           }

                           // Step 5: Update request status
                           request.status = 'approved';
                           request.respondedAt = now;
                           request.respondedBy = req.user.id;
                           request.response = '직접 교환이 완료되었습니다.';

                           console.log('📊 After exchange - Total timeSlots:', room.timeSlots.length);
                           room.markModified('timeSlots');
                           room.markModified('requests');

                           await room.save();

                           console.log('✅ Stage 1: Direct exchange completed successfully!');

                           return res.json({
                              success: true,
                              message: '요청을 수락했습니다. 직접 교환이 완료되었습니다.',
                              room
                           });
                        }

                        console.log('⚠️ Stage 1: Direct exchange not possible. Proceeding to Stage 2...');
                     }

                     console.log(`🔍 Stage 2: Checking if B has empty time BEFORE modifying any slots...`);

                     // ✅ Include both defaultSchedule AND scheduleExceptions
                     const targetUserSchedule = [
                        ...(targetUser.defaultSchedule || []),
                        ...(targetUser.scheduleExceptions || [])
                     ];
                     console.log(`🔍 targetUser: ${targetUser.firstName} ${targetUser.lastName}`);
                     console.log(`🔍 targetUserSchedule 길이: ${targetUserSchedule.length} (defaultSchedule: ${targetUser.defaultSchedule?.length || 0}, scheduleExceptions: ${targetUser.scheduleExceptions?.length || 0})`);

                     let bestCandidate = null;

                     if (targetUserSchedule.length > 0 && totalDuration > 0) {
                        const getDayOfWeek = (dayName) => {
                           const days = { 'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6 };
                           return days[dayName.toLowerCase()] || 0;
                        };

                        const originalDayOfWeek = getDayOfWeek(firstSlot.day);
                        const originalDate = new Date(firstSlot.date);
                        const originalStartMinutes = toMinutes(firstSlot.startTime);

                        const scheduleByDay = buildScheduleByDay(targetUserSchedule, originalDate);
                        const candidates = findCandidates(
                           scheduleByDay,
                           originalDayOfWeek,
                           originalDate,
                           originalStartMinutes,
                           totalDuration,
                           requestStart,
                           requestEnd
                        );

                        console.log(`🔍 Generated ${candidates.length} candidates for B's relocation`);

                        for (const candidate of candidates) {
                           const newStartMinutes = candidate.startMinutes;
                           const newEndMinutes = newStartMinutes + totalDuration;
                           const newDateStr = candidate.date.toISOString().split('T')[0];

                           console.log(`   🔍 Checking: ${DAY_NAMES[candidate.dayOfWeek]} ${toTimeString(newStartMinutes)}-${toTimeString(newEndMinutes)} (${newDateStr})`);

                           // 🔒 방장 스케줄 검증 추가
                           const ownerSchedule = [
                              ...(room.owner.defaultSchedule || []),
                              ...(room.owner.scheduleExceptions || [])
                           ];

                           const candidateDayOfWeek = candidate.date.getUTCDay();
                           const ownerAvailableAtTime = ownerSchedule.some(schedule => {
                              // specificDate가 있으면 날짜로 매칭
                              if (schedule.specificDate) {
                                 const scheduleDate = new Date(schedule.specificDate).toISOString().split('T')[0];
                                 if (scheduleDate !== newDateStr) return false;
                              }
                              // specificDate가 없으면 요일로 매칭
                              else if (schedule.dayOfWeek !== candidateDayOfWeek) {
                                 return false;
                              }

                              // 시간 범위 체크
                              const scheduleStart = toMinutes(schedule.startTime);
                              const scheduleEnd = toMinutes(schedule.endTime);

                              // 후보 시간이 방장 스케줄 범위 내에 완전히 포함되는지 확인
                              return newStartMinutes >= scheduleStart && newEndMinutes <= scheduleEnd;
                           });

                           if (!ownerAvailableAtTime) {
                              console.log(`   ❌ Owner not available at this time, skipping...`);
                              continue;
                           }
                           console.log(`   ✅ Owner is available at this time`);

                           const hasConflict = room.timeSlots.some(slot => {
                              const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
                              if (slotDateStr !== newDateStr) return false;

                              const slotStart = toMinutes(slot.startTime);
                              const slotEnd = toMinutes(slot.endTime);
                              const overlaps = newStartMinutes < slotEnd && newEndMinutes > slotStart;

                              if (overlaps) {
                                 const slotUserId = slot.user._id || slot.user;
                                 const slotUserName = slot.user?.firstName || 'Unknown';
                                 console.log(`   ⚠️  Conflict: overlaps with ${slotUserName}'s slot ${slot.startTime}-${slot.endTime}`);
                              }

                              return overlaps;
                           });

                           if (!hasConflict) {
                              console.log(`   ✅ No conflict! Selected this candidate.`);
                              bestCandidate = candidate;
                              break;
                           } else {
                              console.log(`   ❌ Has conflict, trying next candidate...`);
                           }
                        }
                     }

                     if (bestCandidate) {
                        console.log(`✅ B has empty time - Proceeding with normal slot exchange`);

                        console.log(`🗑️ Removing ${request.requesterSlots ? request.requesterSlots.length : 0} requester's original slots`);
                        if (request.requesterSlots && request.requesterSlots.length > 0) {
                           request.requesterSlots.forEach(reqSlot => {
                              const reqDateStr = reqSlot.date ? new Date(reqSlot.date).toISOString().split('T')[0] : null;
                              const index = room.timeSlots.findIndex(slot => {
                                 const slotUserId = slot.user._id || slot.user;
                                 if (slotUserId.toString() !== requester._id.toString()) return false;
                                 if (slot.startTime !== reqSlot.startTime) return false;
                                 if (slot.endTime !== reqSlot.endTime) return false;
                                 if (!slot.date) return false;
                                 if (reqDateStr) {
                                    const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
                                    if (slotDateStr !== reqDateStr) return false;
                                 } else {
                                    return false;
                                 }
                                 return true;
                              });
                              if (index !== -1) {
                                 room.timeSlots.splice(index, 1);
                                 console.log(`   ❌ Removed C's slot: ${reqSlot.startTime}-${reqSlot.endTime}`);
                              }
                           });
                           room.markModified('timeSlots');
                        }

                        console.log(`🗑️ Removing ${overlappingSlots.length} overlapping slots from target user (B)`);
                        overlappingSlots.forEach(slot => {
                           const index = room.timeSlots.findIndex(s => s._id.equals(slot._id));
                           if (index !== -1) {
                              room.timeSlots.splice(index, 1);
                              console.log(`   ❌ Removed B's slot: ${new Date(slot.date).toISOString().split('T')[0]} ${slot.startTime}-${slot.endTime}`);
                           }
                        });
                        room.markModified('timeSlots');

                        console.log(`📊 After removals - Total timeSlots: ${room.timeSlots.length}`);

                        room.timeSlots.push({
                           user: requester._id,
                           date: firstSlot.date,
                           startTime: timeSlot.startTime,
                           endTime: timeSlot.endTime,
                           day: timeSlot.day,
                           subject: firstSlot.subject || '양보받은 시간',
                           status: 'confirmed',
                           assignedBy: req.user.id
                        });

                        const newStartMinutes = bestCandidate.startMinutes;
                        const newEndMinutes = newStartMinutes + totalDuration;

                        const numSlots = Math.ceil(totalDuration / 30);
                        console.log(`📦 Creating ${numSlots} slots (30-min each) from ${toTimeString(newStartMinutes)} to ${toTimeString(newEndMinutes)}`);

                        for (let i = 0; i < numSlots; i++) {
                           const slotStart = newStartMinutes + (i * 30);
                           const slotEnd = slotStart + 30;
                           room.timeSlots.push({
                              user: targetUser._id,
                              date: bestCandidate.date,
                              startTime: toTimeString(slotStart),
                              endTime: toTimeString(slotEnd),
                              day: DAY_NAMES[bestCandidate.dayOfWeek],
                              subject: '자동 재배치',
                              status: 'confirmed',
                              assignedBy: req.user.id
                           });
                        }

                        const targetUserName = targetUser.firstName && targetUser.lastName
                           ? `${targetUser.firstName} ${targetUser.lastName}`
                           : targetUser.email;
                        const requesterNameForLog = requester.firstName && requester.lastName
                           ? `${requester.firstName} ${requester.lastName}`
                           : requester.email;
                        const origMonth = new Date(firstSlot.date).getUTCMonth() + 1;
                        const origDay = new Date(firstSlot.date).getUTCDate();
                        const newMonth = bestCandidate.date.getUTCMonth() + 1;
                        const newDay = bestCandidate.date.getUTCDate();

                        await ActivityLog.logActivity(
                           room._id,
                           targetUser._id,
                           targetUserName,
                           'slot_swap',
                           `${targetUserName}님: ${origMonth}월 ${origDay}일 ${firstSlot.startTime}-${lastSlot.endTime} → ${newMonth}월 ${newDay}일 ${toTimeString(newStartMinutes)}-${toTimeString(newEndMinutes)}로 재배치 (${requesterNameForLog}님에게 양보)`,
                           {
                              prevDate: `${origMonth}월 ${origDay}일`,
                              prevTime: `${firstSlot.startTime}-${lastSlot.endTime}`,
                              targetDate: `${newMonth}월 ${newDay}일`,
                              targetTime: `${toTimeString(newStartMinutes)}-${toTimeString(newEndMinutes)}`,
                              yieldedTo: requesterNameForLog
                           }
                        );

                        console.log('✅ Normal slot exchange completed');

                     } else {
                        console.log(`⚠️ B has NO empty time - Starting chain request WITHOUT modifying any slots`);

                        const requesterOriginalSlots = [];
                        if (request.requesterSlots && request.requesterSlots.length > 0) {
                           requesterOriginalSlots.push(...request.requesterSlots);
                        } else {
                           const requesterSlots = room.timeSlots.filter(slot => {
                              const slotUserId = slot.user._id || slot.user;
                              return slotUserId.toString() === requester._id.toString();
                           });
                           requesterSlots.forEach(slot => {
                              requesterOriginalSlots.push({
                                 user: requester._id,
                                 date: slot.date,
                                 startTime: slot.startTime,
                                 endTime: slot.endTime,
                                 day: slot.day,
                                 subject: slot.subject || '자동 배정',
                                 status: 'confirmed'
                              });
                           });
                        }

                        const intermediateOriginalSlots = overlappingSlots.map(slot => ({
                           user: targetUser._id,
                           date: slot.date,
                           startTime: slot.startTime,
                           endTime: slot.endTime,
                           day: slot.day,
                           subject: slot.subject || '자동 배정',
                           status: 'confirmed'
                        }));

                        const excludeUsers = [requester._id.toString()];
                        const chainCandidates = findChainCandidates(room, targetUser._id.toString(), excludeUsers);

                        if (chainCandidates.length > 0) {
                           const firstCandidate = chainCandidates[0];
                           const candidateUserId = firstCandidate.userId;
                           const candidateSlot = firstCandidate.slot;

                           const candidateAllSlots = room.timeSlots.filter(s =>
                              (s.user._id || s.user).toString() === candidateUserId &&
                              new Date(s.date).toISOString().split('T')[0] === new Date(candidateSlot.date).toISOString().split('T')[0] &&
                              s.day === candidateSlot.day
                           ).sort((a, b) => {
                              const [ah, am] = a.startTime.split(':').map(Number);
                              const [bh, bm] = b.startTime.split(':').map(Number);
                              return (ah * 60 + am) - (bh * 60 + bm);
                           });

                           const dayMapKorean = {
                              'monday': '월요일',
                              'tuesday': '화요일',
                              'wednesday': '수요일',
                              'thursday': '목요일',
                              'friday': '금요일'
                           };

                           const candidateStartTime = candidateAllSlots[0].startTime;
                           const candidateEndTime = candidateAllSlots[candidateAllSlots.length - 1].endTime;

                           room.requests.push({
                              requester: targetUser._id,
                              targetUser: candidateUserId,
                              type: 'chain_request',
                              timeSlot: {
                                 day: candidateSlot.day,
                                 date: candidateSlot.date,
                                 startTime: candidateStartTime,
                                 endTime: candidateEndTime
                              },
                              message: `[연쇄 요청] ${targetUser.firstName && targetUser.lastName ? `${targetUser.firstName} ${targetUser.lastName}` : targetUser.firstName || '알수없음'}님이 다른 멤버에게 자리를 양보하기 위해 회원님의 ${dayMapKorean[candidateSlot.day] || candidateSlot.day} ${candidateStartTime}-${candidateEndTime} 자리가 필요합니다. 회원님은 빈 시간으로 이동하게 됩니다. 수락하시겠습니까?`,
                              status: 'pending',
                              createdAt: new Date(),
                              chainData: {
                                 originalRequester: requester._id,
                                 originalRequest: request._id,
                                 intermediateUser: targetUser._id,
                                 intermediateSlot: timeSlot,
                                 requesterOriginalSlots: requesterOriginalSlots,
                                 intermediateOriginalSlots: intermediateOriginalSlots
                              }
                           });

                           request.status = 'waiting_for_chain';
                           request.response = `${targetUser.firstName}님에게 이동할 빈 시간이 없어, ${firstCandidate.userName}님에게 연쇄 요청을 보냈습니다.`;
                        } else {
                           request.status = 'rejected';
                           request.response = '대체 가능한 시간을 찾을 수 없고, 연쇄 조정할 후보도 없어 조정이 불가능합니다.';
                        }
                     }

                     room.markModified('timeSlots');
                     room.markModified('requests');
                  } else {
                     console.log('⚠️ No overlapping slots found');
                     request.status = 'approved';
                     request.respondedAt = new Date();
                     request.respondedBy = req.user.id;
                     room.markModified('requests');
                  }
               }
            }
         } else if (type === 'chain_request') {
            console.log('🔗 Processing chain_request approval...');

            const chainData = request.chainData;
            if (!chainData) {
               console.log('❌ No chainData found');
            } else {
               const originalRequesterId = chainData.originalRequester.toString();
               const intermediateUserId = chainData.intermediateUser.toString();
               const chainUserId = (targetUser._id || targetUser).toString();

               const dSlotDay = timeSlot.day;
               const dSlotDate = timeSlot.date;
               const dSlotStartTime = timeSlot.startTime;
               const dSlotEndTime = timeSlot.endTime;

               const dSlotsToRemove = room.timeSlots.filter(slot => {
                  const slotUserId = (slot.user._id || slot.user).toString();
                  if (slotUserId !== chainUserId) return false;
                  if (slot.day !== dSlotDay) return false;

                  if (dSlotDate && slot.date) {
                     const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
                     const targetDateStr = new Date(dSlotDate).toISOString().split('T')[0];
                     if (slotDateStr !== targetDateStr) return false;
                  }

                  const slotStart = toMinutes(slot.startTime);
                  const slotEnd = toMinutes(slot.endTime);
                  const requestStart = toMinutes(dSlotStartTime);
                  const requestEnd = toMinutes(dSlotEndTime);

                  return slotStart < requestEnd && requestStart < slotEnd;
               });

               if (dSlotsToRemove.length === 0) {
                  console.log('❌ D has no slots to exchange');
                  request.status = 'rejected';
                  request.response = 'D의 슬롯을 찾을 수 없습니다.';
                  room.markModified('requests');
               } else {
                  const requiredDuration = toMinutes(dSlotEndTime) - toMinutes(dSlotStartTime);

                  const dUserMember = room.members.find(m =>
                     (m.user._id || m.user).toString() === chainUserId
                  );
                  const dUserData = dUserMember?.user || targetUser;
                  // ✅ Include both defaultSchedule AND scheduleExceptions
                  const dUserSchedule = [
                     ...(dUserData?.defaultSchedule || []),
                     ...(dUserData?.scheduleExceptions || [])
                  ];
                  const ownerSchedule = [
                     ...(room.owner?.defaultSchedule || []),
                     ...(room.owner?.scheduleExceptions || [])
                  ];

                  const scheduleByDay = buildScheduleByDay(dUserSchedule, new Date(dSlotDate));

                  const candidates = [];
                  const dDayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(dSlotDay.toLowerCase());

                  if (scheduleByDay[dDayOfWeek]) {
                     scheduleByDay[dDayOfWeek].forEach(block => {
                        const requestStart = toMinutes(dSlotStartTime);
                        const requestEnd = toMinutes(dSlotEndTime);

                        if (block.start < requestStart) {
                           const availableEnd = Math.min(block.end, requestStart);
                           if (availableEnd - block.start >= requiredDuration) {
                              candidates.push({
                                 dayOfWeek: dDayOfWeek,
                                 date: new Date(dSlotDate),
                                 startMinutes: block.start,
                                 distance: block.start
                              });
                           }
                        }

                        if (block.end > requestEnd) {
                           const availableStart = Math.max(block.start, requestEnd);
                           if (block.end - availableStart >= requiredDuration) {
                              candidates.push({
                                 dayOfWeek: dDayOfWeek,
                                 date: new Date(dSlotDate),
                                 startMinutes: availableStart,
                                 distance: availableStart
                              });
                           }
                        }
                     });
                  }

                  Object.keys(scheduleByDay).forEach(scheduleDayStr => {
                     const scheduleDay = parseInt(scheduleDayStr);
                     if (scheduleDay === dDayOfWeek) return;

                     let daysUntil = (scheduleDay - dDayOfWeek + 7) % 7;
                     if (daysUntil === 0) daysUntil = 7;

                     if (daysUntil <= 7) {
                        const checkDate = new Date(dSlotDate);
                        checkDate.setUTCDate(checkDate.getUTCDate() + daysUntil);

                        scheduleByDay[scheduleDay].forEach(block => {
                           if (block.end - block.start >= requiredDuration) {
                              const distance = daysUntil * 1440 + block.start;
                              candidates.push({
                                 dayOfWeek: scheduleDay,
                                 date: checkDate,
                                 startMinutes: block.start,
                                 distance: distance
                              });
                           }
                        });
                     }
                  });

                  candidates.sort((a, b) => a.distance - b.distance);

                  let bestCandidate = null;
                  for (const candidate of candidates) {
                     const candidateDateStr = candidate.date.toISOString().split('T')[0];
                     const candidateDay = DAY_NAMES[candidate.dayOfWeek];

                     const hasConflict = room.timeSlots.some(slot => {
                        if ((slot.user._id || slot.user).toString() !== chainUserId) return false;
                        if (new Date(slot.date).toISOString().split('T')[0] !== candidateDateStr) return false;
                        if (slot.day !== candidateDay) return false;

                        const slotStart = toMinutes(slot.startTime);
                        const slotEnd = toMinutes(slot.endTime);
                        const candStart = candidate.startMinutes;
                        const candEnd = candidate.startMinutes + requiredDuration;

                        return slotStart < candEnd && candStart < slotEnd;
                     });

                     const isInOwnerSchedule = ownerSchedule.some(os => {
                        if (os.dayOfWeek !== candidate.dayOfWeek) return false;

                        const osStart = toMinutes(os.startTime);
                        const osEnd = toMinutes(os.endTime);
                        const candStart = candidate.startMinutes;
                        const candEnd = candidate.startMinutes + requiredDuration;

                        const overlaps = candStart < osEnd && candEnd > osStart;
                        return overlaps;
                     });

                     if (!hasConflict && isInOwnerSchedule) {
                        bestCandidate = candidate;
                        break;
                     }
                  }

                  if (bestCandidate) {
                     if (chainData.requesterOriginalSlots && chainData.requesterOriginalSlots.length > 0) {
                        chainData.requesterOriginalSlots.forEach(reqSlot => {
                           const reqDateStr = reqSlot.date ? new Date(reqSlot.date).toISOString().split('T')[0] : null;
                           const index = room.timeSlots.findIndex(slot => {
                              const slotUserId = slot.user._id || slot.user;
                              if (slotUserId.toString() !== originalRequesterId.toString()) return false;
                              if (slot.startTime !== reqSlot.startTime) return false;
                              if (slot.endTime !== reqSlot.endTime) return false;
                              if (!slot.date || !reqDateStr) return false;
                              const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
                              return slotDateStr === reqDateStr;
                           });
                           if (index !== -1) {
                              room.timeSlots.splice(index, 1);
                           }
                        });
                     }

                     if (chainData.intermediateOriginalSlots && chainData.intermediateOriginalSlots.length > 0) {
                        chainData.intermediateOriginalSlots.forEach(intSlot => {
                           const intDateStr = intSlot.date ? new Date(intSlot.date).toISOString().split('T')[0] : null;
                           const index = room.timeSlots.findIndex(slot => {
                              const slotUserId = slot.user._id || slot.user;
                              if (slotUserId.toString() !== intermediateUserId.toString()) return false;
                              if (slot.startTime !== intSlot.startTime) return false;
                              if (slot.endTime !== intSlot.endTime) return false;
                              if (!slot.date || !intDateStr) return false;
                              const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
                              return slotDateStr === intDateStr;
                           });
                           if (index !== -1) {
                              room.timeSlots.splice(index, 1);
                           }
                        });
                     }

                     dSlotsToRemove.forEach(slot => {
                        const index = room.timeSlots.findIndex(s => s._id && slot._id && s._id.equals(slot._id));
                        if (index !== -1) {
                           room.timeSlots.splice(index, 1);
                        }
                     });

                     room.timeSlots.push({
                        user: chainUserId,
                        date: bestCandidate.date,
                        startTime: toTimeString(bestCandidate.startMinutes),
                        endTime: toTimeString(bestCandidate.startMinutes + requiredDuration),
                        day: DAY_NAMES[bestCandidate.dayOfWeek],
                        subject: '연쇄 조정 결과',
                        status: 'confirmed',
                        assignedBy: req.user.id,
                        assignedAt: new Date()
                     });

                     room.timeSlots.push({
                        user: intermediateUserId,
                        date: dSlotDate,
                        startTime: dSlotStartTime,
                        endTime: dSlotEndTime,
                        day: dSlotDay,
                        subject: '연쇄 조정 결과',
                        status: 'confirmed',
                        assignedBy: req.user.id,
                        assignedAt: new Date()
                     });

                     const bOriginalSlot = chainData.intermediateSlot;
                     room.timeSlots.push({
                        user: originalRequesterId,
                        date: bOriginalSlot.date || dSlotDate,
                        startTime: bOriginalSlot.startTime,
                        endTime: bOriginalSlot.endTime,
                        day: bOriginalSlot.day,
                        subject: '연쇄 조정 결과',
                        status: 'confirmed',
                        assignedBy: req.user.id,
                        assignedAt: new Date()
                     });

                     const originalRequest = room.requests.id(chainData.originalRequest);
                     if (originalRequest) {
                        originalRequest.status = 'approved';
                        originalRequest.respondedAt = new Date();
                        originalRequest.respondedBy = req.user.id;
                        originalRequest.response = `연쇄 조정 완료 - D가 승인`;
                     }

                     console.log('✅ Chain request completed successfully!');
                  } else {
                     request.status = 'rejected';
                     request.response = `D(${dUserData?.firstName})가 이번 주 선호시간이 없어 조정이 실패했습니다. D의 이번 주 선호시간을 확인해주세요.`;

                     const originalRequest = room.requests.id(chainData.originalRequest);
                     if (originalRequest) {
                        originalRequest.status = 'rejected';
                        originalRequest.response = `연쇄 조정 실패 - D(${dUserData?.firstName})가 이번 주 선호시간 없음`;
                     }
                  }

                  room.markModified('timeSlots');
                  room.markModified('requests');
               }
            }
         }

         await room.save();
      } else if (action === 'rejected') {
         console.log('❌ Action is REJECTED - saving status...');
         room.markModified('requests');
         await room.save();
      }

      if (request.status === 'waiting_for_chain') {
         const updatedRoom = await Room.findById(room._id)
            .populate('requests.requester', 'firstName lastName email')
            .populate('requests.targetUser', 'firstName lastName email')
            .populate('timeSlots.user', '_id firstName lastName email')
            .populate('members.user', 'firstName lastName email');
         return res.json(updatedRoom);
      }

      const responder = await User.findById(req.user.id);
      const responderName = responder ? `${responder.firstName} ${responder.lastName}` : 'Unknown';
      const requesterName = request.requester.firstName && request.requester.lastName
         ? `${request.requester.firstName} ${request.requester.lastName}`
         : request.requester.email;

      const timeSlotInfo = request.timeSlot || request.targetSlot;
      const slotDetails = formatSlotDetails(timeSlotInfo);

      if (action === 'approved') {
         let prevSlotDetails = '';
         if (request.requesterSlots && request.requesterSlots.length > 0) {
            const firstReqSlot = request.requesterSlots[0];
            const lastReqSlot = request.requesterSlots[request.requesterSlots.length - 1];
            prevSlotDetails = formatSlotDetails({
               ...firstReqSlot,
               endTime: lastReqSlot.endTime
            });
         }

         await logApproval(room._id, req.user.id, responderName, requesterName, slotDetails, prevSlotDetails);
      } else {
         if (request.type === 'chain_request' && request.chainData) {
            const originalRequest = room.requests.id(request.chainData.originalRequest);
            if (originalRequest) {
               originalRequest.status = 'rejected';
               originalRequest.response = ERROR_MESSAGES.CHAIN_REJECTED;
            }
            room.markModified('requests');
            await room.save();
         }

         await logRejection(room._id, req.user.id, responderName, requesterName, slotDetails);
      }

      const updatedRoom = await Room.findById(room._id)
         .populate('requests.requester', 'firstName lastName email')
         .populate('requests.targetUser', 'firstName lastName email')
         .populate('timeSlots.user', '_id firstName lastName email')
         .populate('members.user', 'firstName lastName email');

      res.json(updatedRoom);
   } catch (error) {
      console.error('❌ handleRequest error:', error);
      console.error('❌ Error stack:', error.stack);
      res.status(500).json({ msg: ERROR_MESSAGES.SERVER_ERROR, error: error.message });
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
      return res.status(404).json({ msg: ERROR_MESSAGES.REQUEST_NOT_FOUND });
    }

    const request = room.requests.id(requestId);
    if (!request) {
      return res.status(404).json({ msg: ERROR_MESSAGES.REQUEST_NOT_FOUND });
    }

    // 권한 검증
    const permissionError = validateDeletePermission(request, req.user.id);
    if (permissionError) {
      return res.status(permissionError.status).json({ msg: permissionError.msg });
    }

    room.requests.pull(requestId);
    await room.save();

    const updatedRoom = await Room.findById(room._id)
      .populate('requests.requester', 'firstName lastName email')
      .populate('requests.targetUser', 'firstName lastName email')
      .populate('timeSlots.user', '_id firstName lastName email')
      .populate('members.user', 'firstName lastName email');

    res.json(updatedRoom);
  } catch (error) {
    res.status(500).json({ msg: ERROR_MESSAGES.SERVER_ERROR });
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
      res.status(500).json({ success: false, msg: 'Server error' });
   }
};

// @desc    Get all requests received by the user
// @route   GET /api/coordination/received-requests
// @access  Private
exports.getReceivedRequests = async (req, res) => {
   try {
      const userId = req.user.id;

      const rooms = await Room.find({
         $or: [{ owner: userId }, { 'members.user': userId }],
      }).populate('requests.requester', 'firstName lastName email');

      const receivedRequests = rooms.flatMap(room => {
         return room.requests.filter(req => {
            const isTarget = req.targetUser && req.targetUser.toString() === userId;
            return isTarget;
         }).map(req => ({ ...req.toObject(), roomId: room._id, roomName: room.name }));
      });

      res.json({ success: true, requests: receivedRequests });
   } catch (error) {
      res.status(500).json({ success: false, msg: 'Server error' });
   }
};

// @desc    Handle chain confirmation (C가 연쇄 조정 진행/취소 결정)
// @route   POST /api/coordination/requests/:requestId/chain-confirm
// @access  Private (Requester only)
exports.handleChainConfirmation = async (req, res) => {
   try {
      const { requestId } = req.params;
      const { action } = req.body; // 'proceed' or 'cancel'

      console.log('🔗 ========== CHAIN CONFIRMATION ==========');
      console.log('📋 Request ID:', requestId);
      console.log('📋 Action:', action);
      console.log('👤 User ID:', req.user.id);

      if (!['proceed', 'cancel'].includes(action)) {
         return res.status(400).json({ msg: '유효하지 않은 액션입니다. proceed 또는 cancel만 허용됩니다.' });
      }

      const room = await Room.findOne({ 'requests._id': requestId })
         .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions')
         .populate('requests.requester', 'firstName lastName email')
         .populate('requests.targetUser', 'firstName lastName email defaultSchedule scheduleExceptions')
         .populate('timeSlots.user', '_id firstName lastName email')
         .populate('members.user', 'firstName lastName email defaultSchedule scheduleExceptions');

      if (!room) {
         return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
      }

      const request = room.requests.id(requestId);
      if (!request) {
         return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
      }

      // 요청자만 연쇄 조정 확인 가능
      const requesterId = request.requester._id ? request.requester._id.toString() : request.requester.toString();
      if (requesterId !== req.user.id) {
         return res.status(403).json({ msg: '이 요청의 연쇄 조정을 확인할 권한이 없습니다.' });
      }

      if (request.status !== 'needs_chain_confirmation') {
         return res.status(400).json({ msg: '연쇄 조정 확인이 필요한 요청이 아닙니다.' });
      }

      if (!request.chainData) {
         return res.status(400).json({ msg: '연쇄 조정 데이터가 없습니다.' });
      }

      if (action === 'cancel') {
         // 취소: 요청 상태를 cancelled로 변경
         request.status = 'cancelled';
         request.response = '요청자가 연쇄 조정을 취소했습니다.';
         request.respondedAt = new Date();

         await room.save();
         console.log('❌ Chain exchange cancelled by requester');

         return res.json({
            success: true,
            msg: '연쇄 조정이 취소되었습니다.',
            room: await Room.findById(room._id)
               .populate('requests.requester', 'firstName lastName email')
               .populate('requests.targetUser', 'firstName lastName email')
               .populate('timeSlots.user', '_id firstName lastName email')
         });
      }

      // action === 'proceed': 연쇄 조정 진행
      console.log('✅ Proceeding with chain exchange');

      const { firstCandidate, intermediateUser, intermediateSlot, candidateUsers } = request.chainData;
      const targetUser = await User.findById(intermediateUser);

      // 연쇄 요청 생성
      const chainRequest = {
         requester: intermediateUser, // B가 요청자
         type: 'chain_exchange_request',
         targetUser: firstCandidate.userId, // 연쇄 조정 대상
         requesterSlots: request.requesterSlots || [],
         targetSlot: firstCandidate.slot,
         timeSlot: {
            day: firstCandidate.slot.day,
            date: firstCandidate.slot.date,
            startTime: firstCandidate.slot.startTime,
            endTime: firstCandidate.slot.endTime
         },
         message: `[연쇄 요청] ${targetUser.firstName && targetUser.lastName ? `${targetUser.firstName} ${targetUser.lastName}` : targetUser.firstName || '알수없음'}님이 다른 멤버에게 자리를 양보하기 위해 회원님의 ${firstCandidate.slot.day} ${firstCandidate.slot.startTime}-${firstCandidate.slot.endTime || ''} 자리가 필요합니다. 회원님은 빈 시간으로 이동하게 됩니다. 수락하시겠습니까?`,
         chainData: {
            originalRequestId: request._id,
            originalRequester: request.requester._id || request.requester,
            intermediateUser: intermediateUser,
            chainUser: firstCandidate.userId,
            intermediateSlot: intermediateSlot,
            chainSlot: firstCandidate.slot,
            rejectedUsers: [],
            candidateUsers: candidateUsers || []
         },
         status: 'pending',
         createdAt: new Date()
      };

      room.requests.push(chainRequest);

      // 원본 요청 상태 업데이트
      request.status = 'pending';
      request.response = `연쇄 조정 진행 중 - ${firstCandidate.userName}님에게 요청 전송됨`;

      await room.save();
      console.log(`✅ Chain exchange request created, waiting for ${firstCandidate.userName}'s response`);

      const updatedRoom = await Room.findById(room._id)
         .populate('requests.requester', 'firstName lastName email')
         .populate('requests.targetUser', 'firstName lastName email')
         .populate('timeSlots.user', '_id firstName lastName email')
         .populate('members.user', 'firstName lastName email');

      res.json({
         success: true,
         msg: `연쇄 조정이 시작되었습니다. ${firstCandidate.userName}님에게 요청이 전송되었습니다.`,
         room: updatedRoom
      });
   } catch (error) {
      console.error('Chain confirmation error:', error);
      res.status(500).json({ success: false, msg: 'Server error' });
   }
};
