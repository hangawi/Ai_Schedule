// 조정 스케줄링 컨트롤러 (리팩토링 버전)
console.log('🚀🚀🚀 coordinationSchedulingController.js 로드됨 - 수정버전 실행중');
const Room = require('../models/room');
const User = require('../models/user');
const ActivityLog = require('../models/ActivityLog');
const schedulingAlgorithm = require('../services/schedulingAlgorithm');
const dynamicTravelTimeCalculator = require('../services/dynamicTravelTimeCalculator');

// Constants
const { ERROR_MESSAGES, HTTP_STATUS } = require('./coordinationSchedulingController/constants/errorMessages');
const { VALIDATION_RULES, DEFAULTS } = require('./coordinationSchedulingController/constants/validationRules');
const { VALID_ASSIGNMENT_MODES, SLOT_TYPES } = require('./coordinationSchedulingController/constants/travelModes');

// Validators
const {
  validateMinHoursPerWeek,
  validateOwnerSchedule,
  validateMembersSchedule,
  validateAutoConfirmDuration,
} = require('./coordinationSchedulingController/validators/scheduleValidator');
const {
  validateRoomExists,
  validateOwnerPermission,
  isScheduleConfirmed,
  isConfirmationTimerRunning,
} = require('./coordinationSchedulingController/validators/roomPermissionValidator');

// Helpers
const {
  getRoomWithMembers,
  getRoomById,
  clearTravelModeData,
  removeAutoAssignedSlots,
  updateRoomSettings,
  getMembersOnly,
  getMemberIds,
  getExistingCarryOvers,
  cancelConfirmationTimer,
  setConfirmationTimer,
} = require('./coordinationSchedulingController/helpers/roomHelper');
const { shouldPreserveSlot, filterAutoAssignedSlots, filterNonTravelSlots } = require('./coordinationSchedulingController/utils/slotUtils');

// Services
const {
  runAutoScheduling,
  checkLongTermCarryOvers,
  applySchedulingResult,
} = require('./coordinationSchedulingController/services/autoScheduleService');
const { confirmSlotsToPersonalCalendar } = require('./coordinationSchedulingController/services/scheduleConfirmService');
const {
  applyTravelModeToRoom,
  confirmTravelModeForRoom,
} = require('./coordinationSchedulingController/services/travelModeService');

// @desc    Run auto-schedule algorithm for the room
// @route   POST /api/coordination/rooms/:roomId/auto-schedule
// @access  Private (Room Owner only)
exports.runAutoSchedule = async (req, res) => {
  console.log('>>> runAutoSchedule 시작 - 선호시간 체크 적용 버전 <<<');
  try {
    const { roomId } = req.params;
    const { 
      minHoursPerWeek = 3, 
      numWeeks = 4, 
      currentWeek, 
      assignmentMode,
      transportMode = 'normal',
      minClassDurationMinutes = 60,
      skipConfirmation = false  // 사전 확인 건너뛰기 플래그
    } = req.body;
      
    const validModes = ['normal', 'first_come_first_served', 'from_today'];
    const mode = assignmentMode && validModes.includes(assignmentMode)
      ? assignmentMode
      : 'normal';

    const startDate = currentWeek ? new Date(currentWeek) : new Date();
    
    // 방 조회
    const room = await Room.findById(roomId)
      .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority')
      .populate('members.user', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority');

    if (!validateRoomExists(room, res)) return;
    if (!validateOwnerPermission(room, req.user.id, res)) return;

    // 이전 자동 배정 슬롯 제거 (협의/확정 보존)
    removeAutoAssignedSlots(room, shouldPreserveSlot);
    clearTravelModeData(room);

    // 시간 검증
    if (minHoursPerWeek < 0.167 || minHoursPerWeek > 10) {
      return res.status(400).json({ msg: '주당 최소 할당 시간은 10분-10시간 사이여야 합니다.' });
    }
    
    // 설정 저장
    updateRoomSettings(room, { minHoursPerWeek, assignmentMode: mode });
    await room.save();

    // 조원 추출
    const membersOnly = getMembersOnly(room);
    const memberIds = getMemberIds(membersOnly);

    // 선호시간 검증
    if (!validateOwnerSchedule(room.owner)) {
      const ownerName = `${room.owner?.firstName || ''} ${room.owner?.lastName || ''}`.trim() || '방장';
      return res.status(400).json({
        msg: `방장(${ownerName})이 선호시간표를 설정하지 않았습니다. 내프로필에서 선호시간표를 설정해주세요.`
      });
    }

    const membersWithoutSchedule = validateMembersSchedule(membersOnly);
    if (membersWithoutSchedule.length > 0) {
      return res.status(400).json({
        msg: `다음 멤버들이 선호시간표를 설정하지 않았습니다: ${membersWithoutSchedule.join(', ')}. 각 멤버는 내프로필에서 선호시간표를 설정해야 합니다.`
      });
    }

    // 이월 정보 수집
    const existingCarryOvers = getExistingCarryOvers(room.members, startDate);

    // 🔍 사전 선호시간 체크 (skipConfirmation이 false일 때만)
    if (!skipConfirmation) {
      const insufficientMembers = [];
      const requiredMinutesPerWeek = minHoursPerWeek * 60;

      // 각 멤버의 전체 기간 선호시간 계산
      for (const member of membersOnly) {
        const user = member.user;
        const memberName = user?.firstName || user?.name || 'Unknown';
        
        console.log(`
🔍 [사전체크] ${memberName} 선호시간 계산 시작`);
        console.log(`  - defaultSchedule 개수: ${(user.defaultSchedule || []).length}`);
        
        let totalPreferredMinutes = 0;
        
        // numWeeks만큼 반복하여 각 주의 선호시간 계산
        for (let weekIndex = 0; weekIndex < numWeeks; weekIndex++) {
          const weekStartDate = new Date(startDate);
          weekStartDate.setUTCDate(startDate.getUTCDate() + (weekIndex * 7));
          
          const weekDays = [];
          for (let i = 0; i < 7; i++) {
            const day = new Date(weekStartDate);
            day.setUTCDate(weekStartDate.getUTCDate() + i);
            weekDays.push(day);
          }

          let weekPreferredMinutes = 0;
          for (const day of weekDays) {
            const dayOfWeek = day.getUTCDay();
            const dateStr = day.toISOString().split('T')[0];
            
            console.log(`  [${dateStr}] dayOfWeek=${dayOfWeek}`);
            
            const daySchedules = (user.defaultSchedule || []).filter(s => {
              if (s.priority < 2) return false;
              if (s.specificDate) {
                const specificDateStr = new Date(s.specificDate).toISOString().split('T')[0];
                return specificDateStr === dateStr;
              }
              return s.dayOfWeek === dayOfWeek;
            });
            
            console.log(`    매칭된 스케줄: ${daySchedules.length}개`);
            
            for (const schedule of daySchedules) {
              const [startHour, startMin] = schedule.startTime.split(':').map(Number);
              const [endHour, endMin] = schedule.endTime.split(':').map(Number);
              const minutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
              weekPreferredMinutes += minutes;
              console.log(`      ${schedule.startTime}-${schedule.endTime}: ${minutes}분 추가 (priority=${schedule.priority})`);
            }
          }
          
          console.log(`  [${weekIndex + 1}주차] 선호시간 합계: ${weekPreferredMinutes}분 (필요: ${requiredMinutesPerWeek}분)`);
          
          totalPreferredMinutes += weekPreferredMinutes;
          
          // 이번 주 선호시간이 부족하면 기록하고 중단
          if (weekPreferredMinutes < requiredMinutesPerWeek) {
            console.log(`    ⚠️ 부족! (부족분: ${requiredMinutesPerWeek - weekPreferredMinutes}분)`);
            break; // 한 주라도 부족하면 중단 (하지만 totalPreferredMinutes는 유지)
          }
        }

        // 한 주라도 부족하면 insufficientMembers에 추가
        if (totalPreferredMinutes < requiredMinutesPerWeek * numWeeks) {
          insufficientMembers.push({
            memberName,
            memberId: member.user._id.toString(),
            availableMinutes: totalPreferredMinutes,
            requiredMinutes: requiredMinutesPerWeek * numWeeks
          });
        }
      }

      // 부족한 멤버가 있으면 확인 요청 응답
      if (insufficientMembers.length > 0) {
        console.log('⚠️ 선호시간 부족한 멤버 발견:', insufficientMembers);
        return res.status(200).json({
          needsConfirmation: true,
          insufficientMembers,
          message: '일부 멤버의 선호시간이 부족합니다. 해당 멤버를 제외하고 배정하시겠습니까?'
        });
      }
    }

    // 자동 스케줄링 실행 (주별 선호시간 체크는 알고리즘 내부에서 처리)
    const result = await schedulingAlgorithm.runAutoSchedule(
      membersOnly,
      room.owner,
      room.timeSlots,
      {
        assignmentMode: mode,
        minHoursPerWeek,
        numWeeks,
        currentWeek,
        roomSettings: {
          ...room.settings,
          ownerBlockedTimes: room.settings.blockedTimes || []
        },
        transportMode,
        minClassDurationMinutes
      },
      existingCarryOvers,
    );

    // 🔧 선호시간 부족 경고 (주별) - 배정은 계속 진행
    const preferenceWarnings = (result.warnings || []).filter(
      w => w.type === 'insufficient_preferred_time'
    );

    if (preferenceWarnings.length > 0) {
      console.log(`⚠️  [경고] ${preferenceWarnings.length}개 주차에서 선호시간 부족:`);
      preferenceWarnings.forEach(w => {
        console.log(`   - ${w.message}`);
      });
    }

    // 장기 이월 확인
    const twoWeeksAgo = new Date(startDate);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const oneWeekAgo = new Date(startDate);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const conflictSuggestions = [];

    for (const member of room.members) {
      const memberUser = await User.findById(member.user);
      if (member.carryOver > 0) {
        const history = member.carryOverHistory || [];

        const hasConsecutiveCarryOver = history.some(h =>
          new Date(h.week).getTime() >= twoWeeksAgo.getTime() &&
          new Date(h.week).getTime() < oneWeekAgo.getTime() &&
          h.amount > 0
        );

        if (hasConsecutiveCarryOver) {
          const memberName = memberUser.name || `${memberUser.firstName} ${memberUser.lastName}`;
          conflictSuggestions.push({
            title: '장기 이월 멤버 발생',
            content: `멤버 '${memberName}'의 시간이 2주 이상 연속으로 이월되었습니다. 최소 할당 시간을 줄이거나, 멤버의 참여 가능 시간을 늘리거나, 직접 시간을 할당하여 문제를 해결해야 합니다.`
          });
        }
      }
    }

    // 슬롯을 room.timeSlots에 직접 추가
    const addedSlots = new Set();

    Object.values(result.assignments).forEach(assignment => {
      if (assignment.slots && assignment.slots.length > 0) {
        assignment.slots.forEach((slot, idx) => {
          // 필수 필드 검증
          if (!slot.day || !slot.startTime || !slot.endTime || !slot.date) {
            return;
          }

          // 중복 체크를 위한 유니크 키 생성
          const slotKey = `${assignment.memberId}-${slot.day}-${slot.startTime}-${slot.endTime}-${new Date(slot.date).toISOString().split('T')[0]}`;

          if (!addedSlots.has(slotKey)) {
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

            room.timeSlots.push(newSlot);
            addedSlots.add(slotKey);
          }
        });
      }
    });

    // 이월 시간 처리
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
          member.carryOver = (member.carryOver || 0) + carryOver.neededHours;

          if (carryOver.neededHours > 0) {
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
              member.needsIntervention = true;
              member.interventionReason = 'consecutive_carryover';
            }
          }
        }
      }
    }

    // 우선도에 따른 다음 주 우선 배정
    Object.values(result.assignments).forEach(assignment => {
      if (assignment.carryOver && assignment.carryOver > 0) {
        const memberIndex = room.members.findIndex(m =>
          m.user.toString() === assignment.memberId
        );

        if (memberIndex !== -1) {
          const member = room.members[memberIndex];
          if (!member.tempPriorityBoost) {
            member.tempPriorityBoost = assignment.carryOver;
          }
        }
      }
    });

    // 자동 확정 타이머 설정
    const autoConfirmDurationMinutes = room.autoConfirmDuration || 5;
    const autoConfirmDelay = autoConfirmDurationMinutes * 60 * 1000;
    room.autoConfirmAt = new Date(Date.now() + autoConfirmDelay);
    console.log(`⏰ [자동배정] 자동 확정 타이머 설정: ${autoConfirmDurationMinutes}분 후`);

    // 자동배정은 항상 normal 모드로 실행
    room.currentTravelMode = 'normal';
    room.confirmedTravelMode = null;
    room.travelTimeSlots = [];

    await room.save();

    // 활동 로그 기록
    try {
      const ownerUser = await User.findById(req.user.id);
      const ownerName = ownerUser ? `${ownerUser.firstName} ${ownerUser.lastName}` : 'Unknown';
      await ActivityLog.logActivity(
        roomId,
        req.user.id,
        ownerName,
        'auto_assign',
        `자동배정 실행 완료 (주당 ${minHoursPerWeek}시간, ${membersOnly.length}명 배정)`
      );
    } catch (logError) {
      console.error('Activity log error:', logError);
    }

    // freshRoom populate 후 반환
    const freshRoom = await Room.findById(roomId)
      .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes address addressDetail addressLat addressLng')
      .populate('members.user', 'firstName lastName email defaultSchedule address addressDetail addressLat addressLng')
      .populate('timeSlots.user', '_id firstName lastName email')
      .populate('requests.requester', 'firstName lastName email')
      .populate('requests.targetUser', 'firstName lastName email')
      .lean();

    res.json({
      room: freshRoom,
      unassignedMembersInfo: result.unassignedMembersInfo,
      conflictSuggestions: conflictSuggestions,
      assignmentMode: mode,
      warnings: preferenceWarnings.length > 0 ? preferenceWarnings : undefined, // 선호시간 부족 경고
    });
  } catch (error) {
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

// @desc    Delete all time slots
// @route   DELETE /api/coordination/rooms/:roomId/slots
// @access  Private (Room Owner only)
exports.deleteAllTimeSlots = exports.deleteAllTimeSlots = async (req, res) => {
  // Retry 헬퍼 함수 (VersionError 처리)
  const saveWithRetry = async (doc, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await doc.save();
        return;
      } catch (error) {
        if (error.name === 'VersionError' && attempt < maxRetries) {
          // 최신 버전 다시 불러오기
          const Model = doc.constructor;
          const fresh = await Model.findById(doc._id);
          if (fresh) {
            // 변경사항 재적용
            if (doc.personalTimes !== undefined) fresh.personalTimes = doc.personalTimes;
            if (doc.defaultSchedule !== undefined) fresh.defaultSchedule = doc.defaultSchedule;
            if (doc.deletedPreferencesByRoom !== undefined) fresh.deletedPreferencesByRoom = doc.deletedPreferencesByRoom;
            doc = fresh;
          }
        } else {
          throw error;
        }
      }
    }
  };

  try {
    const { roomId } = req.params;
    const room = await Room.findById(roomId)
      .populate('owner', 'personalTimes')
      .populate('members.user', 'personalTimes');

    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    if (!room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
    }

    // Clear the timeSlots array
    room.timeSlots = [];

    // 자동 확정 타이머 해제 (전체 비우기)
    room.autoConfirmAt = null;

    // 확정된 이동수단 모드 초기화
    room.confirmedTravelMode = null;
    room.confirmedAt = null;

    // ✨ 이동시간 관련 데이터 모두 초기화
    room.travelTimeSlots = [];
    room.originalTimeSlots = [];
    room.currentTravelMode = 'normal';

    // Also clear non-pending requests as they are linked to slots
    room.requests = room.requests.filter(r => r.status === 'pending');

    await room.save();

    // 확정된 개인일정 삭제 + 선호시간 복구
    const updatePromises = [];

    // 조원들의 personalTimes에서 해당 방 관련 항목 삭제 + 선호시간 복구
    for (const member of room.members) {
      const memberUser = await User.findById(member.user._id || member.user);
      if (memberUser) {
        // personalTimes에서 해당 방 관련 항목 삭제
        if (memberUser.personalTimes) {
          memberUser.personalTimes = memberUser.personalTimes.filter(pt =>
            !pt.title || !pt.title.includes(room.name)
          );
        }

        // 백업된 선호시간 복구
        if (memberUser.deletedPreferencesByRoom) {
          const backup = memberUser.deletedPreferencesByRoom.find(
            item => item.roomId.toString() === roomId.toString()
          );

          if (backup && backup.deletedTimes && backup.deletedTimes.length > 0) {
            // defaultSchedule 초기화 (없으면)
            if (!memberUser.defaultSchedule) {
              memberUser.defaultSchedule = [];
            }

            // 백업된 선호시간을 defaultSchedule에 다시 추가
            backup.deletedTimes.forEach(deletedTime => {
              // 중복 체크 (같은 dayOfWeek, startTime, endTime)
              const isDuplicate = memberUser.defaultSchedule.some(schedule =>
                schedule.dayOfWeek === deletedTime.dayOfWeek &&
                schedule.startTime === deletedTime.startTime &&
                schedule.endTime === deletedTime.endTime &&
                schedule.specificDate === deletedTime.specificDate
              );

              if (!isDuplicate) {
                memberUser.defaultSchedule.push(deletedTime);
              }
            });

            // 백업 삭제 (복구 완료)
            memberUser.deletedPreferencesByRoom = memberUser.deletedPreferencesByRoom.filter(
              item => item.roomId.toString() !== roomId.toString()
            );
          }
        }

        updatePromises.push(saveWithRetry(memberUser));
      }
    }

    // 방장의 personalTimes에서 해당 방 관련 항목 삭제 + 선호시간 복구
    const owner = await User.findById(room.owner._id || room.owner);
    if (owner) {
      // personalTimes에서 해당 방 관련 항목 삭제
      if (owner.personalTimes) {
        owner.personalTimes = owner.personalTimes.filter(pt =>
          !pt.title || !pt.title.includes(room.name)
        );
      }

      // 백업된 선호시간 복구
      if (owner.deletedPreferencesByRoom) {
        const backup = owner.deletedPreferencesByRoom.find(
          item => item.roomId.toString() === roomId.toString()
        );

        if (backup && backup.deletedTimes && backup.deletedTimes.length > 0) {
          // defaultSchedule 초기화 (없으면)
          if (!owner.defaultSchedule) {
            owner.defaultSchedule = [];
          }

          // 백업된 선호시간을 defaultSchedule에 다시 추가
          backup.deletedTimes.forEach(deletedTime => {
            // 중복 체크 (같은 dayOfWeek, startTime, endTime)
            const isDuplicate = owner.defaultSchedule.some(schedule =>
              schedule.dayOfWeek === deletedTime.dayOfWeek &&
              schedule.startTime === deletedTime.startTime &&
              schedule.endTime === deletedTime.endTime &&
              schedule.specificDate === deletedTime.specificDate
            );

            if (!isDuplicate) {
              owner.defaultSchedule.push(deletedTime);
            }
          });

          // 백업 삭제 (복구 완료)
          owner.deletedPreferencesByRoom = owner.deletedPreferencesByRoom.filter(
            item => item.roomId.toString() !== roomId.toString()
          );
        }
      }

      updatePromises.push(saveWithRetry(owner));
    }

    await Promise.all(updatePromises);

    const updatedRoom = await Room.findById(room._id)
       .populate('owner', 'firstName lastName email address addressLat addressLng')
       .populate('members.user', 'firstName lastName email address addressLat addressLng')
       .populate('timeSlots.user', '_id firstName lastName email');

    res.json(updatedRoom);

  } catch (error) {
    console.error('Error deleting all time slots:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Confirm schedule
// @route   POST /api/coordination/rooms/:roomId/confirm
// @access  Private (Room Owner only)
exports.confirmSchedule = exports.confirmSchedule = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { travelMode } = req.body;

    // 방 조회
    const room = await Room.findById(roomId)
      .populate('owner', 'firstName lastName email personalTimes defaultSchedule scheduleExceptions')
      .populate('members.user', '_id firstName lastName email personalTimes defaultSchedule scheduleExceptions');

    if (!validateRoomExists(room, res)) return;
    if (!validateOwnerPermission(room, req.user.id, res)) return;

    // 중복 확정 방지
    if (room.confirmedAt) {
      return res.status(400).json({ msg: '이미 확정된 스케줄입니다.' });
    }

    // 자동배정된 슬롯 필터링
    const autoAssignedSlots = room.timeSlots.filter(slot =>
      slot.assignedBy && slot.status === 'confirmed' && !slot.isTravel
    );

    if (autoAssignedSlots.length === 0) {
      return res.status(400).json({ msg: '확정할 자동배정 시간이 없습니다.' });
    }
    
    // 헬퍼 함수들
    const timeToMinutes = (timeStr) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const minutesToTime = (minutes) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };
    
    const mergeConsecutiveSlots = (slots) => {
      if (slots.length === 0) return [];
      slots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      const merged = [];
      let current = { startTime: slots[0].startTime, endTime: slots[0].endTime };
      for (let i = 1; i < slots.length; i++) {
        const slot = slots[i];
        if (current.endTime === slot.startTime) {
          current.endTime = slot.endTime;
        } else {
          merged.push(current);
          current = { startTime: slot.startTime, endTime: slot.endTime };
        }
      }
      merged.push(current);
      return merged;
    };
    
    const getDayOfWeekNumber = (day) => {
      const dayMap = { 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 7 };
      return dayMap[day] || 1;
    };
    
    const removePreferenceTimes = (user, slots, roomId) => {
      const deletedTimes = [];
      const newDefaultSchedule = [];
      const assignedRangesByDate = {};

      slots.forEach(slot => {
        const dateStr = slot.date.toISOString().split('T')[0];
        const dayOfWeek = getDayOfWeekNumber(slot.day);
        if (!assignedRangesByDate[dateStr]) {
          assignedRangesByDate[dateStr] = { dateStr, dayOfWeek, ranges: [] };
        }
        assignedRangesByDate[dateStr].ranges.push({
          start: timeToMinutes(slot.startTime),
          end: timeToMinutes(slot.endTime)
        });
      });

      if (user.defaultSchedule) {
        user.defaultSchedule.forEach(schedule => {
          const prefStart = timeToMinutes(schedule.startTime);
          const prefEnd = timeToMinutes(schedule.endTime);
          const scheduleDayOfWeekForMatch = schedule.dayOfWeek === 0 ? 7 : schedule.dayOfWeek;
          
          let matchingDateRanges = null;
          for (const [dateStr, dateData] of Object.entries(assignedRangesByDate)) {
            const matches = schedule.specificDate
              ? schedule.specificDate === dateStr
              : scheduleDayOfWeekForMatch === dateData.dayOfWeek;
            if (matches) {
              matchingDateRanges = dateData;
              break;
            }
          }

          if (!matchingDateRanges) {
            newDefaultSchedule.push(schedule);
          } else {
            let currentSegments = [{ start: prefStart, end: prefEnd }];
            for (const assignedRange of matchingDateRanges.ranges) {
              const newSegments = [];
              for (const segment of currentSegments) {
                const overlapStart = Math.max(segment.start, assignedRange.start);
                const overlapEnd = Math.min(segment.end, assignedRange.end);
                if (overlapStart < overlapEnd) {
                  deletedTimes.push({
                    dayOfWeek: schedule.dayOfWeek,
                    startTime: minutesToTime(overlapStart),
                    endTime: minutesToTime(overlapEnd),
                    priority: schedule.priority,
                    specificDate: schedule.specificDate
                  });
                  if (segment.start < assignedRange.start) {
                    newSegments.push({ start: segment.start, end: assignedRange.start });
                  }
                  if (segment.end > assignedRange.end) {
                    newSegments.push({ start: assignedRange.end, end: segment.end });
                  }
                } else {
                  newSegments.push(segment);
                }
              }
              currentSegments = newSegments;
            }
            for (const segment of currentSegments) {
              newDefaultSchedule.push({
                dayOfWeek: schedule.dayOfWeek,
                startTime: minutesToTime(segment.start),
                endTime: minutesToTime(segment.end),
                priority: schedule.priority,
                specificDate: schedule.specificDate
              });
            }
          }
        });
        user.defaultSchedule = newDefaultSchedule;
      }

      if (user.scheduleExceptions) {
        slots.forEach(slot => {
          const dateStr = slot.date.toISOString().split('T')[0];
          user.scheduleExceptions = user.scheduleExceptions.filter(exception => {
            if (exception.specificDate) {
              return exception.specificDate !== dateStr;
            }
            return true;
          });
        });
      }

      if (deletedTimes.length > 0) {
        if (!user.deletedPreferencesByRoom) {
          user.deletedPreferencesByRoom = [];
        }
        user.deletedPreferencesByRoom = user.deletedPreferencesByRoom.filter(
          item => item.roomId.toString() !== roomId.toString()
        );
        user.deletedPreferencesByRoom.push({
          roomId: roomId,
          deletedTimes: deletedTimes,
          deletedAt: new Date()
        });
      }
    };
    
    // 조원별, 날짜별로 그룹화 후 병합
    const slotsByUserAndDate = {};
    autoAssignedSlots.forEach(slot => {
      const userId = slot.user.toString();
      const dateStr = slot.date.toISOString().split('T')[0];
      const key = `${userId}_${dateStr}`;
      if (!slotsByUserAndDate[key]) {
        slotsByUserAndDate[key] = { userId, date: slot.date, day: slot.day, slots: [] };
      }
      slotsByUserAndDate[key].slots.push(slot);
    });

    const mergedSlotsByUser = {};
    for (const [key, group] of Object.entries(slotsByUserAndDate)) {
      const mergedSlots = mergeConsecutiveSlots(group.slots);
      if (!mergedSlotsByUser[group.userId]) {
        mergedSlotsByUser[group.userId] = [];
      }
      mergedSlots.forEach(slot => {
        mergedSlotsByUser[group.userId].push({
          startTime: slot.startTime,
          endTime: slot.endTime,
          date: group.date,
          day: group.day
        });
      });
    }
    
    // User 객체를 Map으로 관리
    const userMap = new Map();
    const ownerName = `${room.owner.firstName || ''} ${room.owner.lastName || ''}`.trim() || '방장';
    
    // 조원들 처리
    for (const [userId, mergedSlots] of Object.entries(mergedSlotsByUser)) {
      let user = userMap.get(userId);
      if (!user) {
        user = await User.findById(userId);
        if (!user) continue;
        userMap.set(userId, user);
      }
      
      if (!user.personalTimes) {
        user.personalTimes = [];
      }
      
      const originalSlots = autoAssignedSlots.filter(s => s.user.toString() === userId);
      removePreferenceTimes(user, originalSlots, roomId);
      
      const maxId = user.personalTimes.reduce((max, pt) => Math.max(max, pt.id || 0), 0);
      let nextId = maxId + 1;
      
      mergedSlots.forEach(slot => {
        const dayOfWeek = getDayOfWeekNumber(slot.day);
        const dateStr = slot.date.toISOString().split('T')[0];
        const isDuplicate = user.personalTimes.some(pt =>
          pt.specificDate === dateStr &&
          pt.startTime === slot.startTime &&
          pt.endTime === slot.endTime
        );
        if (!isDuplicate) {
          // 🔧 조원: 방장의 주소 저장
          const ownerLocation = room.owner.addressDetail
            ? `${room.owner.address} ${room.owner.addressDetail}`
            : room.owner.address;

          user.personalTimes.push({
            id: nextId++,
            title: `${room.name} - ${ownerName}`,
            type: 'personal',
            startTime: slot.originalStartTime || slot.startTime,
            endTime: slot.originalEndTime || slot.endTime,
            days: [dayOfWeek],
            isRecurring: false,
            specificDate: dateStr,
            color: '#10B981',
            location: ownerLocation || null, // 방장의 주소
            locationLat: room.owner.addressLat || null,
            locationLng: room.owner.addressLng || null,
            transportMode: travelMode || null, // 교통수단
            roomId: room._id.toString() // 방 ID
          });
        }
      });
    }
    
    // 방장 처리
    const ownerId = (room.owner._id || room.owner).toString();
    let owner = userMap.get(ownerId);
    if (!owner) {
      owner = await User.findById(ownerId);
      if (owner) {
        userMap.set(ownerId, owner);
      }
    }
    
    if (owner) {
      if (!owner.personalTimes) {
        owner.personalTimes = [];
      }
      
      const ownerSlotsForDeletion = [...autoAssignedSlots];
      if (room.travelTimeSlots && room.travelTimeSlots.length > 0) {
        ownerSlotsForDeletion.push(...room.travelTimeSlots);
      }
      removePreferenceTimes(owner, ownerSlotsForDeletion, roomId);
      
      const maxId = owner.personalTimes.reduce((max, pt) => Math.max(max, pt.id || 0), 0);
      let nextId = maxId + 1;
      
      for (const [userId, mergedSlots] of Object.entries(mergedSlotsByUser)) {
        const memberUser = room.members.find(m => 
          m.user._id?.toString() === userId || m.user.toString() === userId
        );
        if (!memberUser) continue;
        const memberName = `${memberUser.user.firstName || ''} ${memberUser.user.lastName || ''}`.trim() || '조원';
        
        mergedSlots.forEach(slot => {
          const dayOfWeek = getDayOfWeekNumber(slot.day);
          const dateStr = slot.date.toISOString().split('T')[0];
          const isDuplicate = owner.personalTimes.some(pt =>
            pt.specificDate === dateStr &&
            pt.startTime === slot.startTime &&
            pt.endTime === slot.endTime &&
            pt.title.includes(memberName)
          );
          if (!isDuplicate) {
            // 🔧 방장 수업시간: 조원의 주소 저장
            const member = userMap.get(userId);
            const memberLocation = member && member.addressDetail
              ? `${member.address} ${member.addressDetail}`
              : member?.address;

            owner.personalTimes.push({
              id: nextId++,
              title: `${room.name} - ${memberName}`,
              type: 'personal',
              startTime: slot.startTime,
              endTime: slot.endTime,
              days: [dayOfWeek],
              isRecurring: false,
              specificDate: dateStr,
              color: '#3B82F6',
              location: memberLocation || null, // 조원의 주소
              locationLat: member?.addressLat || null,
              locationLng: member?.addressLng || null,
              transportMode: travelMode || null, // 교통수단
              roomId: room._id.toString(), // 방 ID
              hasTravelTime: room.travelTimeSlots && room.travelTimeSlots.length > 0 // 이동시간 존재 여부
            });
          }
        });
      }
      
      // 방장의 이동시간 슬롯 추가
      console.log('🔍 [방장 이동시간 처리 시작]', {
        hasTravelTimeSlots: !!(room.travelTimeSlots && room.travelTimeSlots.length > 0),
        travelTimeSlotsCount: room.travelTimeSlots?.length || 0,
        roomName: room.name
      });

      if (room.travelTimeSlots && room.travelTimeSlots.length > 0) {
        room.travelTimeSlots.forEach(travelSlot => {
          const dayOfWeek = getDayOfWeekNumber(travelSlot.day);
          const dateStr = travelSlot.date.toISOString().split('T')[0];
          const isDuplicate = owner.personalTimes.some(pt =>
            pt.specificDate === dateStr &&
            pt.startTime === travelSlot.startTime &&
            pt.endTime === travelSlot.endTime &&
            pt.title.includes('이동시간')
          );
          if (!isDuplicate) {
            // 🔧 이동시간의 목적지는 해당 조원의 주소
            const travelUserId = (travelSlot.user._id || travelSlot.user).toString();
            const travelMember = userMap.get(travelUserId);
            const memberLocation = travelMember && travelMember.addressDetail
              ? `${travelMember.address} ${travelMember.addressDetail}`
              : travelMember?.address;

            console.log('🚗 [이동시간 저장]', {
              travelUserId,
              travelMember: travelMember ? {
                name: `${travelMember.firstName} ${travelMember.lastName}`,
                address: travelMember.address,
                addressDetail: travelMember.addressDetail
              } : null,
              memberLocation,
              dateStr,
              startTime: travelSlot.startTime,
              endTime: travelSlot.endTime
            });

            owner.personalTimes.push({
              id: nextId++,
              title: `${room.name} - 이동시간`,
              type: 'personal',
              startTime: travelSlot.startTime,
              endTime: travelSlot.endTime,
              days: [dayOfWeek],
              isRecurring: false,
              specificDate: dateStr,
              color: '#FFA500',
              location: memberLocation || null, // 조원의 주소
              locationLat: travelMember?.addressLat || null,
              locationLng: travelMember?.addressLng || null,
              transportMode: travelMode || null, // 교통수단
              roomId: room._id.toString(), // 방 ID
              isTravelTime: true // 이동시간 플래그
            });
          }
        });
      }
    }
    
    // 모든 사용자 저장 with retry
    const saveUserWithRetry = async (user, maxRetries = 3) => {
      let currentUser = user;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await currentUser.save();
          return;
        } catch (error) {
          if (error.name === 'VersionError' && attempt < maxRetries) {
            const freshUser = await User.findById(user._id);
            if (!freshUser) throw new Error(`User ${user._id} not found during retry`);
            freshUser.personalTimes = user.personalTimes;
            freshUser.defaultSchedule = user.defaultSchedule;
            if (user.deletedPreferencesByRoom) {
              freshUser.deletedPreferencesByRoom = user.deletedPreferencesByRoom;
            }
            currentUser = freshUser;
            await new Promise(resolve => setTimeout(resolve, 100 * attempt));
          } else {
            throw error;
          }
        }
      }
    };
    
    const updatePromises = Array.from(userMap.values()).map(user => saveUserWithRetry(user));
    await Promise.all(updatePromises);

    // 자동 확정 타이머 해제
    room.autoConfirmAt = null;
    
    let roomSaved = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await room.save();
        roomSaved = true;
        break;
      } catch (error) {
        if (error.name === 'VersionError' && attempt < 3) {
          const freshRoom = await Room.findById(roomId);
          if (freshRoom) {
            freshRoom.autoConfirmAt = null;
            room = freshRoom;
          }
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        } else {
          throw error;
        }
      }
    }
    if (!roomSaved) throw new Error('Failed to save room after multiple retries');

    // 확정된 슬롯 표시
    autoAssignedSlots.forEach(slot => {
      slot.confirmedToPersonalCalendar = true;
    });

    // 확정된 이동수단 모드 저장
    room.confirmedAt = new Date();
    if (travelMode) {
      room.confirmedTravelMode = travelMode;
      if (travelMode === 'normal') {
        room.timeSlots = room.timeSlots.filter(slot => !slot.isTravel);
        room.travelTimeSlots = [];
      }
    }
    await room.save();

    // 활동 로그 기록
    await ActivityLog.logActivity(
      roomId,
      req.user.id,
      `${req.user.firstName} ${req.user.lastName}`,
      'confirm_schedule',
      `자동배정 시간 확정 완료 (${autoAssignedSlots.length}개 슬롯 → ${Object.values(mergedSlotsByUser).reduce((sum, slots) => sum + slots.length, 0)}개 병합, 조원 ${Object.keys(mergedSlotsByUser).length}명 + 방장)`
    );
    
    // Socket.io 이벤트
    if (global.io) {
      global.io.to(`room-${roomId}`).emit('schedule-confirmed', {
        roomId: roomId,
        message: '자동배정 시간이 확정되었습니다.',
        timestamp: new Date()
      });
    }
    
    res.json({
      msg: '배정 시간이 각 조원과 방장의 개인일정으로 확정되었습니다.',
      confirmedSlotsCount: autoAssignedSlots.length,
      mergedSlotsCount: Object.values(mergedSlotsByUser).reduce((sum, slots) => sum + slots.length, 0),
      affectedMembersCount: Object.keys(mergedSlotsByUser).length,
      confirmedTravelMode: travelMode || 'normal'
    });
    
  } catch (error) {
    console.error('Error confirming schedule:', error);
    res.status(500).json({ msg: `확정 처리 중 오류가 발생했습니다: ${error.message}` });
  }
};;

// @desc    Get available slots
// @route   GET /api/coordination/rooms/:roomId/available-slots
// @access  Private
exports.getAvailableSlots = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await getRoomWithMembers(roomId);
    if (!validateRoomExists(room, res)) return;

    // 현재 슬롯 반환
    res.json({
      success: true,
      data: {
        timeSlots: room.timeSlots,
        travelTimeSlots: room.travelTimeSlots || []
      }
    });

  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      msg: '슬롯 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};

// @desc    Start confirmation timer
// @route   POST /api/coordination/rooms/:roomId/confirmation-timer
// @access  Private (Room Owner only)
exports.startConfirmationTimer = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { hours } = req.body;

    const room = await getRoomById(roomId);
    if (!validateRoomExists(room, res)) return;
    if (!validateOwnerPermission(room, req.user.id, res)) return;

    validateAutoConfirmDuration(hours);

    setConfirmationTimer(room, hours);
    await room.save();

    res.json({
      success: true,
      msg: `확정 타이머가 설정되었습니다. (${hours}시간 후 자동 확정)`,
      data: {
        autoConfirmAt: room.autoConfirmAt,
        autoConfirmDuration: room.autoConfirmDuration
      }
    });

  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      msg: '확정 타이머 설정 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};

// @desc    Apply travel mode
// @route   POST /api/coordination/rooms/:roomId/apply-travel-mode
// @access  Private (Room Owner only)
exports.applyTravelMode = exports.applyTravelMode = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { travelMode, enhancedSchedule } = req.body;

    // 방 조회
    const room = await Room.findById(roomId).populate('members', 'name email').populate('owner', 'name email');
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // 방장 권한 확인
    if (!room.owner._id.equals(req.user.id)) {
      return res.status(403).json({ msg: '방장만 이동시간 모드를 변경할 수 있습니다.' });
    }

    // 이미 확정된 스케줄인지 확인
    if (room.confirmedAt) {
      return res.status(400).json({
        msg: '이미 확정된 스케줄입니다. 확정 이후에는 이동시간 모드를 변경할 수 없습니다.',
        confirmedAt: room.confirmedAt
      });
    }

    // enhancedSchedule 검증
    const receivedTimeSlots = enhancedSchedule?.timeSlots || (Array.isArray(enhancedSchedule) ? enhancedSchedule : null);
    const receivedTravelSlots = enhancedSchedule?.travelSlots || [];
    
    if (!receivedTimeSlots || !Array.isArray(receivedTimeSlots)) {
      return res.status(400).json({ 
        msg: 'enhancedSchedule.timeSlots이 필요합니다.',
        received: typeof enhancedSchedule,
        hasTimeSlots: !!enhancedSchedule?.timeSlots
      });
    }

    // timeSlots 업데이트
    if (travelMode === 'normal') {
      // 일반 모드로 복원
      if (room.originalTimeSlots && room.originalTimeSlots.length > 0) {
        room.timeSlots = room.originalTimeSlots;
        room.originalTimeSlots = [];
      }
      room.travelTimeSlots = [];
    } else {
      // 이동시간 모드

      // 원본 저장 (첫 적용 시에만)
      if (!room.originalTimeSlots || room.originalTimeSlots.length === 0) {
        room.originalTimeSlots = JSON.parse(JSON.stringify(room.timeSlots));
      }

      // 이동시간 슬롯을 travelTimeSlots에 저장
      room.travelTimeSlots = receivedTravelSlots.map(e => {
        const dateObj = e.date instanceof Date ? e.date : new Date(e.date);
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayOfWeek = dayNames[dateObj.getDay()];
        const userId = e.user?._id || e.user || room.owner._id;
        let userColor = e.color;
        if (!userColor) {
          userColor = room.getUserColor(userId);
        }
        
        return {
          user: userId,
          date: dateObj,
          day: e.day || dayOfWeek,
          startTime: e.startTime,
          endTime: e.endTime,
          subject: '이동시간',
          type: 'travel',
          color: userColor,
          from: e.from,
          to: e.to,
          travelMode: e.travelMode || travelMode,
          travelInfo: e.travelInfo
        };
      });

      // 수업시간 슬롯만 저장 (이동시간 제외)
      const classTimeSlots = receivedTimeSlots.filter(e => !e.isTravel && e.subject !== '이동시간');
      
      // 연속된 슬롯 병합
      const mergeConsecutiveSlots = (slots) => {
        if (slots.length === 0) return [];
        
        const sorted = [...slots].sort((a, b) => {
          const dateCompare = new Date(a.date) - new Date(b.date);
          if (dateCompare !== 0) return dateCompare;
          const userA = (a.user._id || a.user).toString();
          const userB = (b.user._id || b.user).toString();
          const userCompare = userA.localeCompare(userB);
          if (userCompare !== 0) return userCompare;
          return a.startTime.localeCompare(b.startTime);
        });
        
        const merged = [];
        let current = { ...sorted[0] };
        
        for (let i = 1; i < sorted.length; i++) {
          const next = sorted[i];
          const currentUserId = (current.user._id || current.user).toString();
          const nextUserId = (next.user._id || next.user).toString();
          const currentDate = new Date(current.date).toISOString().split('T')[0];
          const nextDate = new Date(next.date).toISOString().split('T')[0];
          
          if (
            currentUserId === nextUserId &&
            currentDate === nextDate &&
            current.subject === next.subject &&
            current.endTime === next.startTime
          ) {
            current.endTime = next.endTime;
            if (next.originalEndTime) {
              current.originalEndTime = next.originalEndTime;
            }
          } else {
            merged.push(current);
            current = { ...next };
          }
        }
        merged.push(current);
        return merged;
      };
      
      const mergedSlots = mergeConsecutiveSlots(classTimeSlots);
      
      // 병합된 슬롯을 DB 형식으로 변환
      room.timeSlots = mergedSlots.map(e => {
        return {
          user: e.user._id || e.user,
          date: e.date instanceof Date ? e.date : new Date(e.date),
          day: e.day,
          startTime: e.startTime,
          endTime: e.endTime,
          subject: e.subject || '자동 배정',
          assignedBy: room.owner._id,
          status: 'confirmed',
          adjustedForTravelTime: e.adjustedForTravelTime || false,
          originalStartTime: e.originalStartTime,
          originalEndTime: e.originalEndTime,
          actualStartTime: e.actualStartTime,
          travelTimeBefore: e.travelTimeBefore
        };
      });
    }

    // 금지시간 검증
    if (travelMode !== 'normal') {
      const blockedTimes = room.settings?.blockedTimes || [];

      if (blockedTimes.length > 0) {
        const timeToMinutes = (timeStr) => {
          const [hours, minutes] = timeStr.split(':').map(Number);
          return hours * 60 + minutes;
        };

        const minutesToTime = (minutes) => {
          const hours = Math.floor(minutes / 60);
          const mins = minutes % 60;
          return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        };

        const isTimeInBlockedRange = (startTime, endTime, blockedTimes) => {
          const start = timeToMinutes(startTime);
          const end = timeToMinutes(endTime);
          
          for (const blocked of blockedTimes) {
            const blockedStart = timeToMinutes(blocked.startTime);
            const blockedEnd = timeToMinutes(blocked.endTime);
            
            if (start < blockedEnd && end > blockedStart) {
              return blocked;
            }
          }
          return null;
        };

        room.timeSlots.forEach(slot => {
          if (slot.adjustedForTravelTime) {
            const blockedTime = isTimeInBlockedRange(slot.startTime, slot.endTime, blockedTimes);

            if (blockedTime) {
              const blockedEndMinutes = timeToMinutes(blockedTime.endTime);
              const slotDuration = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
              const newStartMinutes = blockedEndMinutes;
              const newEndMinutes = blockedEndMinutes + slotDuration;

              slot.startTime = minutesToTime(newStartMinutes);
              slot.endTime = minutesToTime(newEndMinutes);
            }
          }
        });
      }
    }

    // currentTravelMode 설정
    room.currentTravelMode = travelMode;

    // VersionError 처리하면서 저장
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await room.save();
        break;
      } catch (error) {
        if (error.name === 'VersionError' && attempt < maxRetries) {
          const freshRoom = await Room.findById(room._id);
          if (freshRoom) {
            freshRoom.timeSlots = room.timeSlots;
            freshRoom.originalTimeSlots = room.originalTimeSlots;
            freshRoom.travelTimeSlots = room.travelTimeSlots;
            freshRoom.currentTravelMode = room.currentTravelMode;
            room = freshRoom;
          }
        } else {
          throw error;
        }
      }
    }

    // Socket.io 이벤트
    const io = req.app.get('io');
    if (io) {
      io.to(`room-${roomId}`).emit('travelModeChanged', {
        roomId: room._id.toString(),
        travelMode: travelMode,
        timeSlots: room.timeSlots,
        currentTravelMode: room.currentTravelMode
      });
    }

    res.json({
      success: true,
      travelMode: travelMode,
      timeSlotsCount: room.timeSlots.length
    });

  } catch (error) {
    console.error('applyTravelMode error:', error);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.', error: error.message });
  }
};;

// @desc    Confirm travel mode
// @route   POST /api/coordination/rooms/:roomId/confirm-travel-mode
// @access  Private (Room Owner only)
exports.confirmTravelMode = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { travelMode } = req.body;

    const room = await getRoomById(roomId);
    if (!validateRoomExists(room, res)) return;
    if (!validateOwnerPermission(room, req.user.id, res)) return;

    const { previousMode, currentMode } = await confirmTravelModeForRoom(room, travelMode);

    res.json({
      success: true,
      msg: `${currentMode} 모드가 확정되었습니다.`,
      data: {
        previousMode,
        currentMode,
        confirmedTravelMode: room.confirmedTravelMode
      }
    });

  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      msg: '이동 모드 확정 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};

// @desc    Set auto confirm duration
// @route   POST /api/coordination/rooms/:roomId/auto-confirm-duration
// @access  Private (Room Owner only)
exports.setAutoConfirmDuration = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { hours } = req.body;

    const room = await getRoomById(roomId);
    if (!validateRoomExists(room, res)) return;
    if (!validateOwnerPermission(room, req.user.id, res)) return;

    validateAutoConfirmDuration(hours);

    setConfirmationTimer(room, hours);
    await room.save();

    res.json({
      success: true,
      msg: `자동 확정 기간이 ${hours}시간으로 설정되었습니다.`,
      data: {
        autoConfirmAt: room.autoConfirmAt,
        autoConfirmDuration: hours
      }
    });

  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      msg: '자동 확정 기간 설정 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};

// @desc    Validate schedule with transport mode
// @route   POST /api/coordination/rooms/:roomId/validate-transport-mode
// @access  Private (Room Owner only)
exports.validateScheduleWithTransportMode = exports.validateScheduleWithTransportMode = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { transportMode, viewMode, weekStartDate } = req.body;

    // 방 조회
    const room = await Room.findById(roomId)
      .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority address addressLat addressLng')
      .populate('members.user', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority address addressLat addressLng');

    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // 방장 권한 확인
    if (!room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
    }

    // 현재 스케줄 확인 (자동배정된 슬롯만)
    let autoAssignedSlots = room.timeSlots.filter(slot =>
      slot.assignedBy && slot.status === 'confirmed' && !slot.isTravel
    );

    // viewMode에 따라 슬롯 필터링
    if (viewMode === 'week' && weekStartDate) {
      const weekStart = new Date(weekStartDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      autoAssignedSlots = autoAssignedSlots.filter(slot => {
        const slotDate = new Date(slot.date);
        return slotDate >= weekStart && slotDate < weekEnd;
      });
    }

    if (autoAssignedSlots.length === 0) {
      return res.status(400).json({ 
        success: false,
        msg: '검증할 스케줄이 없습니다. 먼저 자동배정을 실행하세요.' 
      });
    }

    // 일반 모드면 항상 검증 성공
    if (transportMode === 'normal') {
      return res.json({
        success: true,
        isValid: true,
        transportMode: 'normal',
        warnings: [],
        msg: '일반 모드는 항상 유효합니다.'
      });
    }

    // 이동시간 모드 검증
    const warnings = [];
    const membersOnly = room.members.filter(m => {
      const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
      const ownerId = room.owner._id ? room.owner._id.toString() : room.owner.toString();
      return memberId !== ownerId;
    });

    const ownerLocation = {
      lat: room.owner.addressLat,
      lng: room.owner.addressLng,
      address: room.owner.address
    };

    // 방장 위치 정보 확인
    if (!ownerLocation.lat || !ownerLocation.lng) {
      return res.status(400).json({
        success: false,
        msg: '방장의 주소 정보가 없습니다. 프로필에서 주소를 설정해주세요.'
      });
    }

    // 각 멤버별로 검증
    for (const member of membersOnly) {
      const memberUser = member.user;
      const memberId = memberUser._id.toString();
      const memberName = `${memberUser.firstName} ${memberUser.lastName}`;

      // 멤버의 위치 정보 확인
      if (!memberUser.addressLat || !memberUser.addressLng) {
        warnings.push({
          type: 'no_address',
          memberId: memberId,
          memberName: memberName,
          reason: '주소 정보 없음'
        });
        continue;
      }

      // 이 멤버에게 배정된 슬롯들
      const memberSlots = autoAssignedSlots.filter(slot => 
        slot.user.toString() === memberId
      );

      if (memberSlots.length === 0) {
        warnings.push({
          type: 'not_assigned',
          memberId: memberId,
          memberName: memberName,
          reason: '스케줄에 배정되지 않음'
        });
        continue;
      }

      // 이동시간 계산
      const memberLocation = {
        coordinates: {
          lat: memberUser.addressLat,
          lng: memberUser.addressLng
        },
        address: memberUser.address
      };

      const ownerLocationFormatted = {
        coordinates: {
          lat: ownerLocation.lat,
          lng: ownerLocation.lng
        },
        address: ownerLocation.address
      };

      let travelTimeMinutes = 0;
      try {
        travelTimeMinutes = await dynamicTravelTimeCalculator.calculateTravelTimeBetween(
          memberLocation,
          ownerLocationFormatted,
          transportMode
        );
      } catch (error) {
        warnings.push({
          type: 'travel_time_error',
          memberId: memberId,
          memberName: memberName,
          reason: '이동시간 계산 실패'
        });
        continue;
      }

      const dayTranslation = {
        'monday': '월요일',
        'tuesday': '화요일',
        'wednesday': '수요일',
        'thursday': '목요일',
        'friday': '금요일',
        'saturday': '토요일',
        'sunday': '일요일'
      };

      const dayOfWeekMap = {
        'sunday': 0,
        'monday': 1,
        'tuesday': 2,
        'wednesday': 3,
        'thursday': 4,
        'friday': 5,
        'saturday': 6
      };

      const timeToMinutes = (timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };

      // 요일별로 슬롯 그룹화
      const slotsByDay = {};
      memberSlots.forEach(slot => {
        if (!slotsByDay[slot.day]) {
          slotsByDay[slot.day] = [];
        }
        slotsByDay[slot.day].push(slot);
      });

      // 각 요일별로 검증
      for (const [dayEn, daySlots] of Object.entries(slotsByDay)) {
        const dayKo = dayTranslation[dayEn] || dayEn;
        
        // 이 요일의 총 수업시간 계산
        let totalClassMinutes = 0;
        daySlots.forEach(slot => {
          const duration = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
          totalClassMinutes += duration;
        });

        // 총 필요시간 = 이동시간 + 수업시간
        const totalRequiredMinutes = travelTimeMinutes + totalClassMinutes;

        const targetDayOfWeek = dayOfWeekMap[dayEn];
        
        // 해당 요일의 실제 날짜 찾기
        let targetDate = null;
        daySlots.forEach(slot => {
          if (!targetDate) {
            targetDate = new Date(slot.date);
          }
        });

        const preferredSchedules = (memberUser.defaultSchedule || []).filter(s => {
          if (s.specificDate) {
            const scheduleDate = new Date(s.specificDate);
            const targetDateStr = targetDate ? targetDate.toISOString().split('T')[0] : null;
            const scheduleDateStr = scheduleDate.toISOString().split('T')[0];
            return scheduleDateStr === targetDateStr;
          }
          return s.dayOfWeek === targetDayOfWeek || s.day === dayEn;
        });
        
        if (preferredSchedules.length === 0) {
          warnings.push({
            type: 'no_preference_for_day',
            memberId: memberId,
            memberName: memberName,
            day: dayKo,
            dayEn: dayEn,
            reason: `${dayKo}에 선호시간 없음`
          });
          continue;
        }

        // 겹치는 시간대를 머지해서 총 가용시간 계산
        const mergedIntervals = [];
        const sortedPrefs = preferredSchedules
          .map(pref => ({
            start: timeToMinutes(pref.startTime),
            end: timeToMinutes(pref.endTime)
          }))
          .sort((a, b) => a.start - b.start);

        for (const interval of sortedPrefs) {
          if (mergedIntervals.length === 0 || mergedIntervals[mergedIntervals.length - 1].end < interval.start) {
            mergedIntervals.push({ start: interval.start, end: interval.end });
          } else {
            mergedIntervals[mergedIntervals.length - 1].end = Math.max(
              mergedIntervals[mergedIntervals.length - 1].end,
              interval.end
            );
          }
        }

        // 선호시간 총합 계산
        let totalAvailableMinutes = 0;
        mergedIntervals.forEach(interval => {
          totalAvailableMinutes += (interval.end - interval.start);
        });

        // 검증: 필요시간 <= 선호시간
        if (totalRequiredMinutes > totalAvailableMinutes) {
          warnings.push({
            type: 'insufficient_preference',
            memberId: memberId,
            memberName: memberName,
            day: dayKo,
            dayEn: dayEn,
            requiredMinutes: totalRequiredMinutes,
            availableMinutes: totalAvailableMinutes,
            travelMinutes: travelTimeMinutes,
            classMinutes: totalClassMinutes,
            reason: `${dayKo} 선호시간 부족 (필요 ${totalRequiredMinutes}분, 가용 ${totalAvailableMinutes}분)`
          });
        }
      }
    }

    // 결과 반환
    const isValid = warnings.length === 0;

    res.json({
      success: true,
      isValid: isValid,
      transportMode: transportMode,
      warnings: warnings,
      msg: isValid 
        ? `${transportMode} 모드로 스케줄이 유효합니다.`
        : `${transportMode} 모드로 스케줄 검증에 ${warnings.length}개의 문제가 발견되었습니다.`
    });

  } catch (error) {
    console.error('validateScheduleWithTransportMode error:', error);
    res.status(500).json({ 
      success: false,
      msg: '서버 오류가 발생했습니다.', 
      error: error.message 
    });
  }
};;

module.exports = exports;
