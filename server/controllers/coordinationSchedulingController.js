// 조정 스케줄링 컨트롤러 (리팩토링 버전)
const Room = require('../../models/room');
const ActivityLog = require('../../models/ActivityLog');
const schedulingAlgorithm = require('../../services/schedulingAlgorithm');
const dynamicTravelTimeCalculator = require('../../services/dynamicTravelTimeCalculator');

// Constants
const { ERROR_MESSAGES, HTTP_STATUS } = require('./constants/errorMessages');
const { VALIDATION_RULES, DEFAULTS } = require('./constants/validationRules');
const { VALID_ASSIGNMENT_MODES, SLOT_TYPES } = require('./constants/travelModes');

// Validators
const {
  validateMinHoursPerWeek,
  validateOwnerSchedule,
  validateMembersSchedule,
  validateAutoConfirmDuration,
} = require('./validators/scheduleValidator');
const {
  validateRoomExists,
  validateOwnerPermission,
  isScheduleConfirmed,
  isConfirmationTimerRunning,
} = require('./validators/roomPermissionValidator');

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
} = require('./helpers/roomHelper');
const { shouldPreserveSlot, filterAutoAssignedSlots, filterNonTravelSlots } = require('./utils/slotUtils');

// Services
const {
  runAutoScheduling,
  checkLongTermCarryOvers,
  applySchedulingResult,
} = require('./services/autoScheduleService');
const { confirmSlotsToPersonalCalendar } = require('./services/scheduleConfirmService');
const {
  applyTravelModeToRoom,
  confirmTravelModeForRoom,
} = require('./services/travelModeService');

// @desc    Run auto-schedule algorithm for the room
// @route   POST /api/coordination/rooms/:roomId/auto-schedule
// @access  Private (Room Owner only)
exports.runAutoSchedule = async (req, res) => {
  try {
    const { roomId } = req.params;
    const {
      minHoursPerWeek = DEFAULTS.MIN_HOURS_PER_WEEK,
      numWeeks = DEFAULTS.NUM_WEEKS,
      currentWeek,
      assignmentMode,
      transportMode = DEFAULTS.TRANSPORT_MODE,
      minClassDurationMinutes = DEFAULTS.MIN_CLASS_DURATION_MINUTES
    } = req.body;

    // 배정 모드 검증
    const mode = assignmentMode && VALID_ASSIGNMENT_MODES.includes(assignmentMode)
      ? assignmentMode
      : DEFAULTS.ASSIGNMENT_MODE;

    const startDate = currentWeek ? new Date(currentWeek) : new Date();

    // 방 조회
    const room = await getRoomWithMembers(roomId);
    if (!validateRoomExists(room, res)) return;
    if (!validateOwnerPermission(room, req.user.id, res)) return;

    // 이전 자동 배정 슬롯 제거 (협의/확정 슬롯 보존)
    removeAutoAssignedSlots(room, shouldPreserveSlot);
    clearTravelModeData(room);

    // 시간 검증
    validateMinHoursPerWeek(minHoursPerWeek);

    // 설정 저장
    updateRoomSettings(room, { minHoursPerWeek, assignmentMode: mode });
    await room.save();

    // 조원 추출
    const membersOnly = getMembersOnly(room);
    const memberIds = getMemberIds(membersOnly);

    // 선호시간 검증
    if (!validateOwnerSchedule(room.owner)) {
      const ownerName = `${room.owner?.firstName || ''} ${room.owner?.lastName || ''}`.trim() || '방장';
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        msg: ERROR_MESSAGES.OWNER_NO_SCHEDULE(ownerName)
      });
    }

    const membersWithoutSchedule = validateMembersSchedule(membersOnly);
    if (membersWithoutSchedule.length > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        msg: ERROR_MESSAGES.MEMBERS_NO_SCHEDULE(membersWithoutSchedule.join(', '))
      });
    }

    // 이월 정보 수집
    const existingCarryOvers = getExistingCarryOvers(room.members, startDate);

    // 자동 스케줄링 실행
    const result = await runAutoScheduling(
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
      existingCarryOvers
    );

    // 장기 이월 확인
    const conflictSuggestions = await checkLongTermCarryOvers(room.members, startDate);

    // 결과 적용
    applySchedulingResult(room, result);
    await room.save();

    res.json({
      success: true,
      msg: '자동 배정이 완료되었습니다.',
      data: {
        newSlots: result.newSlots,
        updatedMembers: result.updatedMembers,
        conflictSuggestions
      }
    });

  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      msg: '자동 배정 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};

// @desc    Delete all time slots
// @route   DELETE /api/coordination/rooms/:roomId/slots
// @access  Private (Room Owner only)
exports.deleteAllTimeSlots = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await getRoomById(roomId);
    if (!validateRoomExists(room, res)) return;
    if (!validateOwnerPermission(room, req.user.id, res)) return;

    room.timeSlots = [];
    clearTravelModeData(room);
    await room.save();

    res.json({
      success: true,
      msg: '모든 타임 슬롯이 삭제되었습니다.',
      data: { timeSlots: [] }
    });

  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      msg: '슬롯 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};

// @desc    Confirm schedule
// @route   POST /api/coordination/rooms/:roomId/confirm
// @access  Private (Room Owner only)
exports.confirmSchedule = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { travelMode } = req.body;

    // 방 조회 (populate members)
    const room = await Room.findById(roomId)
      .populate('owner', 'firstName lastName email personalTimes defaultSchedule scheduleExceptions')
      .populate('members.user', '_id firstName lastName email personalTimes defaultSchedule scheduleExceptions');

    if (!validateRoomExists(room, res)) return;
    if (!validateOwnerPermission(room, req.user.id, res)) return;

    // 중복 확정 방지
    if (isScheduleConfirmed(room)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        msg: ERROR_MESSAGES.ALREADY_CONFIRMED
      });
    }

    // 자동배정된 슬롯 필터링 (assignedBy가 있고 status가 'confirmed'인 것, 이동시간 제외)
    const autoAssignedSlots = room.timeSlots.filter(slot =>
      slot.assignedBy && slot.status === 'confirmed' && !slot.isTravel
    );
    if (autoAssignedSlots.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        msg: '확정할 자동배정 시간이 없습니다.'
      });
    }

    // 사용자 정보
    const userName = `${req.user.firstName} ${req.user.lastName}`;

    // 개인 일정에 확정 (완전한 로직 사용)
    const result = await confirmSlotsToPersonalCalendar(
      autoAssignedSlots,
      room,
      travelMode,
      req.user.id,
      userName
    );

    // 확정 타이머 취소
    if (isConfirmationTimerRunning(room)) {
      cancelConfirmationTimer(room);
      await room.save();
    }

    // Socket.io 이벤트 전송
    if (req.io) {
      req.io.to(`room-${roomId}`).emit('schedule-confirmed', {
        roomId: room._id,
        confirmedAt: room.confirmedAt,
        travelMode: room.confirmedTravelMode
      });
    }res.json({
      success: true,
      msg: '배정 시간이 각 조원과 방장의 개인일정으로 확정되었습니다.',
      data: {
        confirmedAt: room.confirmedAt,
        confirmedTravelMode: room.confirmedTravelMode,
        ...result
      }
    });

  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      msg: '스케줄 확정 중 오류가 발생했습니다.',
      error: error.message
    });
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
exports.applyTravelMode = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { travelMode, enhancedSchedule } = req.body;

    // 방 조회
    const room = await Room.findById(roomId).populate('members', 'name email').populate('owner', 'name email');
    if (!validateRoomExists(room, res)) return;
    if (!validateOwnerPermission(room, req.user.id, res)) return;

    // 이미 확정된 스케줄인지 확인
    if (room.confirmedAt) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        msg: '이미 확정된 스케줄입니다. 확정 이후에는 이동시간 모드를 변경할 수 없습니다.',
        confirmedAt: room.confirmedAt
      });
    }

    // enhancedSchedule 검증
    const receivedTimeSlots = enhancedSchedule?.timeSlots || (Array.isArray(enhancedSchedule) ? enhancedSchedule : null);
    const receivedTravelSlots = enhancedSchedule?.travelSlots || [];

    if (!receivedTimeSlots || !Array.isArray(receivedTimeSlots)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        msg: 'enhancedSchedule.timeSlots이 필요합니다.',
        received: typeof enhancedSchedule,
        hasTimeSlots: !!enhancedSchedule?.timeSlots
      });
    }

    // 이동 모드 적용 (완전한 로직)
    await applyTravelModeToRoom(room, enhancedSchedule, travelMode);

    // Socket.io로 모든 사용자에게 알림
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
      timeSlotsCount: room.timeSlots.length,
      data: {
        timeSlots: room.timeSlots,
        travelTimeSlots: room.travelTimeSlots
      }
    });

  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      msg: '이동 모드 적용 중 오류가 발생했습니다.',
      error: error.message
    });
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
exports.validateScheduleWithTransportMode = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { transportMode, viewMode, weekStartDate } = req.body;

    // 1. 방 조회
    const room = await Room.findById(roomId)
      .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority address addressLat addressLng')
      .populate('members.user', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority address addressLat addressLng');

    if (!validateRoomExists(room, res)) return;
    if (!validateOwnerPermission(room, req.user.id, res)) return;

    // 3. 현재 스케줄 확인 (자동배정된 슬롯만)
    let autoAssignedSlots = room.timeSlots.filter(slot =>
      slot.assignedBy && slot.status === 'confirmed' && !slot.isTravel
    );

    // ✅ viewMode에 따라 슬롯 필터링
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
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        msg: '검증할 스케줄이 없습니다. 먼저 자동배정을 실행하세요.'
      });
    }

    // 4. 일반 모드면 항상 검증 성공
    if (transportMode === 'normal') {
      return res.json({
        success: true,
        isValid: true,
        transportMode: 'normal',
        warnings: [],
        msg: '일반 모드는 항상 유효합니다.'
      });
    }

    // 5. 이동시간 모드 검증
    const warnings = [];
    const membersOnly = room.members.filter(m => {
      const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
      const ownerId = room.owner._id ? room.owner._id.toString() : room.owner.toString();
      return memberId !== ownerId;
    });
    membersOnly.forEach((m, idx) => {
      const memberUser = m.user;
      const memberName = `${memberUser.firstName} ${memberUser.lastName}`;
    });

    const ownerLocation = {
      lat: room.owner.addressLat,
      lng: room.owner.addressLng,
      address: room.owner.address
    };

    // 방장 위치 정보 확인
    if (!ownerLocation.lat || !ownerLocation.lng) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        msg: '방장의 주소 정보가 없습니다. 프로필에서 주소를 설정해주세요.'
      });
    }

    // 6. 각 멤버별로 검증
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
        continue;
      }

      // 요일별 한글 변환 및 dayOfWeek 매핑
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

      // 요일별로 슬롯 그룹화 (각 요일에 대해 한 번만 검증)
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

        // 이 요일의 총 필요시간 = 이동시간 + 수업시간
        const totalRequiredMinutes = travelTimeMinutes + totalClassMinutes;

        // 이 요일의 선호시간 확인
        const targetDayOfWeek = dayOfWeekMap[dayEn];

        // 해당 요일의 실제 날짜 찾기
        let targetDate = null;
        daySlots.forEach(slot => {
          if (!targetDate) {
            targetDate = new Date(slot.date);
          }
        });
        const preferredSchedules = (memberUser.defaultSchedule || []).filter(s => {
          // specificDate가 있으면 정확한 날짜로 필터링
          if (s.specificDate) {
            const scheduleDate = new Date(s.specificDate);
            const targetDateStr = targetDate ? targetDate.toISOString().split('T')[0] : null;
            const scheduleDateStr = scheduleDate.toISOString().split('T')[0];
            return scheduleDateStr === targetDateStr;
          }

          // specificDate가 없으면 dayOfWeek로 필터링
          return s.dayOfWeek === targetDayOfWeek || s.day === dayEn;
        });
        preferredSchedules.forEach((pref, idx) => {
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

        // 겹치는 시간대를 머지해서 실제 총 가용시간 계산
        const mergedIntervals = [];
        const sortedPrefs = preferredSchedules
          .map(pref => ({
            start: timeToMinutes(pref.startTime),
            end: timeToMinutes(pref.endTime)
          }))
          .sort((a, b) => a.start - b.start);

        for (const interval of sortedPrefs) {
          if (mergedIntervals.length === 0 || mergedIntervals[mergedIntervals.length - 1].end < interval.start) {
            // 겹치지 않음 - 새로운 인터벌 추가
            mergedIntervals.push({ start: interval.start, end: interval.end });
          } else {
            // 겹침 - 마지막 인터벌 확장
            mergedIntervals[mergedIntervals.length - 1].end = Math.max(
              mergedIntervals[mergedIntervals.length - 1].end,
              interval.end
            );
          }
        }
        mergedIntervals.forEach((interval, idx) => {
          const startH = Math.floor(interval.start / 60);
          const startM = interval.start % 60;
          const endH = Math.floor(interval.end / 60);
          const endM = interval.end % 60;
          const duration = interval.end - interval.start;
          console.log(`         머지${idx+1}: ${String(startH).padStart(2,'0')}:${String(startM).padStart(2,'0')} ~ ${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')} (${duration}분)`);
        });

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
        } else {
        }
      }
    }

    // 7. 결과 반환
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
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      success: false,
      msg: '서버 오류가 발생했습니다.',
      error: error.message
    });
  }
};;

module.exports = exports;
