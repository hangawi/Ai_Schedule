/**
 * ============================================================================
 * coordinationExchangeController - 일정맞추기 교환 API (리팩토링 버전)
 * ============================================================================
 *
 * 원본: 1,951줄 → 리팩토링: 메인 150줄 + 모듈 17개
 *
 * [주요 API]
 * - parseExchangeRequest: Gemini로 자연어 메시지 파싱
 * - smartExchange: 시간 변경/교환 실행
 *
 * [리팩토링 구조]
 * constants/    - 상수 정의 (dayMappings, errorMessages, weekOffsets, timeFormats)
 * utils/        - 유틸리티 함수 (timeUtils, dateUtils, slotMerger)
 * validators/   - 검증 로직 (dayValidator, timeRangeValidator, scheduleValidator, roomValidator)
 * services/     - 비즈니스 로직 (geminiService, dateChangeService)
 * helpers/      - 헬퍼 함수 (slotFinder, scheduleOverlap, autoPlacement, activityLogger)
 */

const Room = require('../models/room');
const User = require('../models/user');

/**
 * 거리 계산 (Haversine formula)
 * @param {number} lat1 - 위도 1
 * @param {number} lon1 - 경도 1
 * @param {number} lat2 - 위도 2
 * @param {number} lon2 - 경도 2
 * @returns {number} 거리 (km)
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) {
    return 0;
  }
  const R = 6371; // 지구 반지름 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    0.5 - Math.cos(dLat)/2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    (1 - Math.cos(dLon))/2;
  return R * 2 * Math.asin(Math.sqrt(a));
};

/**
 * 특정 날짜의 모든 이동시간 슬롯을 재계산
 * @param {Object} room - Room 객체
 * @param {Date} date - 재계산할 날짜
 * @param {string} ownerId - 방장 ID
 * @returns {Promise<void>}
 */
const recalculateTravelTimeSlotsForDate = async (room, date, ownerId, forceTravelMode = null) => {
  console.log('🔥🔥🔥 [recalculateTravelTimeSlotsForDate] 함수 호출됨!', {
    날짜: new Date(date).toISOString().split('T')[0],
    forceTravelMode: forceTravelMode,
    'room.confirmedTravelMode': room.confirmedTravelMode,
    'room.currentTravelMode': room.currentTravelMode,
    'room.travelMode': room.travelMode
  });

  // 🔧 수정: forceTravelMode 파라미터 우선 사용
  const effectiveTravelMode = forceTravelMode || room.confirmedTravelMode || room.currentTravelMode || room.travelMode;

  console.log('🔥🔥🔥 [effectiveTravelMode 계산 결과]:', effectiveTravelMode);

  if (!effectiveTravelMode || effectiveTravelMode === 'normal') {
    console.log('⏭️ [이동시간 재계산] 일반 모드이므로 스킵:', effectiveTravelMode);
    return; // 일반 모드면 이동시간 없음
  }

  console.log('✅ [이동시간 재계산] 시작:', { date: new Date(date).toISOString().split('T')[0], mode: effectiveTravelMode });

  const dateStr = new Date(date).toISOString().split('T')[0];

  // ① 해당 날짜의 이동시간 슬롯 모두 삭제 (isTravel 또는 subject로 판별)
  console.log('🗑️ [삭제 시작] 삭제 전 전체 슬롯:', room.timeSlots.length);
  console.log('🔍 [room.travelTimeSlots]:', room.travelTimeSlots?.length || 0, '개');
  
  // ✅ room.travelTimeSlots에서 해당 날짜의 이동시간 삭제 (핵심 수정!)
  if (room.travelTimeSlots && room.travelTimeSlots.length > 0) {
    const beforeCount = room.travelTimeSlots.length;
    const deletedFromTravelTimeSlots = [];
    
    room.travelTimeSlots = room.travelTimeSlots.filter(slot => {
      const slotDate = new Date(slot.date).toISOString().split('T')[0];
      const shouldDelete = slotDate === dateStr;
      
      if (shouldDelete) {
        deletedFromTravelTimeSlots.push({
          시간: `${slot.startTime}-${slot.endTime}`,
          subject: slot.subject,
          user: slot.user
        });
      }
      
      return !shouldDelete;
    });
    
    const afterCount = room.travelTimeSlots.length;
    console.log(`🗑️ [travelTimeSlots 삭제] ${beforeCount}개 → ${afterCount}개 (${deletedFromTravelTimeSlots.length}개 삭제)`);
    if (deletedFromTravelTimeSlots.length > 0) {
      console.log('🗑️ [삭제된 travelTimeSlots]:', deletedFromTravelTimeSlots);
    }
  }
  
  // 🔍 12월 22일의 12:00-14:00 사이 모든 슬롯 출력
  const dec22Slots = room.timeSlots.filter(slot => {
    const slotDate = new Date(slot.date).toISOString().split('T')[0];
    if (slotDate !== '2025-12-22') return false;
    
    const hour = parseInt(slot.startTime.split(':')[0]);
    return hour >= 12 && hour <= 14;
  });
  
  if (dec22Slots.length > 0) {
    console.log('🔍🔍🔍 [12/22 12:00-14:00 사이 슬롯들]:', dec22Slots.map(s => ({
      시간: `${s.startTime}-${s.endTime}`,
      subject: s.subject,
      isTravel: s.isTravel,
      '모든_속성': Object.keys(s).filter(k => k !== '_id' && k !== '__v')
    })));
  } else {
    console.log('⚠️ [12/22 12:00-14:00 사이에 슬롯 없음]');
  }
  
  // 🔍 해당 날짜의 모든 슬롯 출력
  const targetDateSlots = room.timeSlots.filter(slot => {
    const slotDate = new Date(slot.date).toISOString().split('T')[0];
    return slotDate === dateStr;
  });
  
  console.log(`🔍 [${dateStr}] 해당 날짜의 모든 슬롯 (${targetDateSlots.length}개):`);
  targetDateSlots.forEach((slot, idx) => {
    console.log(`  [${idx + 1}] ${slot.startTime}-${slot.endTime}:`, {
      subject: slot.subject,
      isTravel: slot.isTravel,
      'typeof_isTravel': typeof slot.isTravel,
      user: slot.user._id || slot.user
    });
  });
  
  const slotsToDelete = [];
  room.timeSlots = room.timeSlots.filter(slot => {
    const slotDate = new Date(slot.date).toISOString().split('T')[0];
    const isTravelSlot = slot.isTravel === true || slot.subject === '이동시간';
    const shouldDelete = slotDate === dateStr && isTravelSlot;
    
    if (shouldDelete) {
      slotsToDelete.push({
        시간: `${slot.startTime}-${slot.endTime}`,
        isTravel: slot.isTravel,
        subject: slot.subject,
        날짜: slotDate
      });
    }
    
    return !shouldDelete;
  });
  
  console.log('🗑️ [삭제 완료]', {
    삭제된_슬롯: slotsToDelete.length,
    삭제_후_전체: room.timeSlots.length,
    삭제된_상세: slotsToDelete
  });

  // ② 해당 날짜의 수업 슬롯들만 가져와서 시간순 정렬
  const classSlots = room.timeSlots
    .filter(slot => {
      const slotDate = new Date(slot.date).toISOString().split('T')[0];
      return slotDate === dateStr && !slot.isTravel;
    })
    .sort((a, b) => {
      const aMinutes = parseInt(a.startTime.split(':')[0]) * 60 + parseInt(a.startTime.split(':')[1]);
      const bMinutes = parseInt(b.startTime.split(':')[0]) * 60 + parseInt(b.startTime.split(':')[1]);
      return aMinutes - bMinutes;
    });

  if (classSlots.length === 0) {
    return; // 수업 슬롯이 없으면 이동시간도 없음
  }

  // ③ 각 슬롯의 이동시간 계산 및 슬롯 생성
  for (let i = 0; i < classSlots.length; i++) {
    const slot = classSlots[i];
    const previousSlot = i > 0 ? classSlots[i - 1] : null;

    let travelDurationMinutes = 0;

    try {
      const currentUserId = slot.user._id || slot.user;
      const currentUser = await User.findById(currentUserId);

      if (!currentUser || !currentUser.addressLat) {
        continue; // 주소 정보 없으면 이동시간 0
      }

      let previousLat, previousLng;

      if (previousSlot) {
        // 이전 슬롯이 있으면: 이전 사용자 → 현재 사용자
        const previousUserId = previousSlot.user._id || previousSlot.user;

        if (previousUserId.toString() === ownerId.toString()) {
          // 이전이 방장
          const owner = await User.findById(ownerId);
          previousLat = owner.addressLat;
          previousLng = owner.addressLng;
        } else {
          // 이전이 다른 학생
          const previousUser = await User.findById(previousUserId);
          if (previousUser) {
            previousLat = previousUser.addressLat;
            previousLng = previousUser.addressLng;
          }
        }
      } else {
        // 첫 슬롯이면: 방장 → 현재 사용자
        const owner = await User.findById(ownerId);
        previousLat = owner.addressLat;
        previousLng = owner.addressLng;
      }

      if (previousLat && previousLng && currentUser.addressLat && currentUser.addressLng) {
        const distance = calculateDistance(
          previousLat,
          previousLng,
          currentUser.addressLat,
          currentUser.addressLng
        );

        const speeds = {
          driving: 40,
          transit: 30,
          walking: 5,
          bicycling: 15
        };
        const speed = speeds[effectiveTravelMode] || 30;

        travelDurationMinutes = Math.ceil((distance / speed) * 60 / 10) * 10;
      }
    } catch (error) {
      console.error(`이동시간 계산 오류 (날짜: ${dateStr}, 슬롯: ${slot.startTime}):`, error);
      travelDurationMinutes = 0;
    }

    // ④ 이동시간 슬롯 생성
    console.log(`  📊 [슬롯 ${i+1}/${classSlots.length}] ${slot.startTime}-${slot.endTime}, 이동시간: ${travelDurationMinutes}분`);

    if (travelDurationMinutes > 0) {
      const classStartMinutes = parseInt(slot.startTime.split(':')[0]) * 60 + parseInt(slot.startTime.split(':')[1]);
      const travelStartMinutes = classStartMinutes - travelDurationMinutes;
      const travelEndMinutes = classStartMinutes;

      // 시작 시간 계산
      const startHours = Math.floor(travelStartMinutes / 60);
      const startMinutes = travelStartMinutes % 60;
      const startTime = `${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}`;
      
      // 종료 시간 계산
      const endHours = Math.floor(travelEndMinutes / 60);
      const endMinutes = travelEndMinutes % 60;
      const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;

      // 🔍 출발지/도착지 정보 수집
      let fromAddress = '출발지';
      let toAddress = '도착지';
      
      try {
        const currentUserId = slot.user._id || slot.user;
        const currentUser = await User.findById(currentUserId);
        
        if (currentUser && currentUser.address) {
          toAddress = currentUser.address;
        }
        
        if (previousSlot) {
          const previousUserId = previousSlot.user._id || previousSlot.user;
          const previousUser = await User.findById(previousUserId);
          if (previousUser && previousUser.address) {
            fromAddress = previousUser.address;
          }
        } else {
          const owner = await User.findById(ownerId);
          if (owner && owner.address) {
            fromAddress = owner.address;
          }
        }
      } catch (err) {
        console.error('주소 정보 가져오기 실패:', err);
      }

      // 🔍 members에서 조원의 색상 가져오기
      const userId = slot.user._id || slot.user;
      const userColor = room.getUserColor(userId);
      console.log(`  🎨 [색상 확인] userId: ${userId}, userColor: ${userColor}`);
      console.log(`  ➕ [이동시간 슬롯 생성] ${startTime}-${endTime} (${travelDurationMinutes}분)`);
      
      // 거리 정보 계산
      const speeds = {
        driving: 40,
        transit: 30,
        walking: 5,
        bicycling: 15
      };
      const speed = speeds[effectiveTravelMode] || 30;
      const distanceKm = (travelDurationMinutes / 60) * speed;
      
      const travelSlot = {
        user: slot.user,
        date: slot.date,
        startTime: startTime,
        endTime: endTime,
        day: slot.day,
        subject: '이동시간',
        isTravel: true,
        assignedBy: ownerId,
        assignedAt: new Date(),
        status: 'confirmed',
        color: userColor,  // ✅ room.members에서 가져온 조원의 색상
        from: fromAddress,  // ✅ 출발지
        to: toAddress,      // ✅ 도착지
        travelMode: effectiveTravelMode,  // ✅ 이동수단
        travelInfo: {
          durationText: `${travelDurationMinutes}분`,
          distanceText: `${distanceKm.toFixed(1)}km`
        }
      };

      console.log(`    ✅ [생성] ${startTime}-${endTime}`);
      console.log(`       🔍 [travelSlot 상세]:`, {
        color: travelSlot.color,
        from: travelSlot.from,
        to: travelSlot.to,
        travelMode: travelSlot.travelMode,
        travelInfo: travelSlot.travelInfo,
        isTravel: travelSlot.isTravel
      });

      room.timeSlots.push(travelSlot);
    } else {
      console.log(`  ⏭️ [이동시간 없음] ${travelDurationMinutes}분`);
    }
  }

  // 디버깅: 실제로 추가되었는지 확인
  const travelSlotsCount = room.timeSlots.filter(s => s.isTravel === true).length;
  const travelSlotsBySubject = room.timeSlots.filter(s => s.subject === '이동시간').length;
  console.log(`✅ [이동시간 재계산] ${dateStr}: ${classSlots.length}개 수업 슬롯 처리 완료`);
  console.log(`   📊 [확인] isTravel===true: ${travelSlotsCount}개, subject==='이동시간': ${travelSlotsBySubject}개`);
  
  // ✅ room.timeSlots의 이동시간을 room.travelTimeSlots에도 추가
  const newTravelSlots = room.timeSlots.filter(slot => {
    const slotDate = new Date(slot.date).toISOString().split('T')[0];
    return slotDate === dateStr && slot.isTravel === true;
  });
  
  if (newTravelSlots.length > 0) {
    if (!room.travelTimeSlots) {
      room.travelTimeSlots = [];
    }
    room.travelTimeSlots.push(...newTravelSlots);
    console.log(`✅ [travelTimeSlots 추가] ${newTravelSlots.length}개 추가, 총 ${room.travelTimeSlots.length}개`);
  }
};

/**
 * 시간이 금지 시간대와 겹치는지 확인
 * @param {string} startTime - HH:MM 형식
 * @param {string} endTime - HH:MM 형식
 * @param {Array} blockedTimes - 금지 시간 배열
 * @returns {Object|null} 겹치는 금지 시간 객체 또는 null
 */
const isTimeInBlockedRange = (startTime, endTime, blockedTimes) => {
  if (!blockedTimes || blockedTimes.length === 0) return null;

  const slotStart = timeToMinutes(startTime);
  const slotEnd = timeToMinutes(endTime);

  for (const blocked of blockedTimes) {
    const blockedStart = timeToMinutes(blocked.startTime);
    const blockedEnd = timeToMinutes(blocked.endTime);

    if (
      (slotStart >= blockedStart && slotStart < blockedEnd) ||
      (slotEnd > blockedStart && slotEnd <= blockedEnd) ||
      (slotStart <= blockedStart && slotEnd >= blockedEnd)
    ) {
      return blocked;
    }
  }

  return null;
};

/**
 * 시간을 분 단위로 변환
 * @param {string} time - HH:MM 형식
 * @returns {number} 분 단위
 */
const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * 시간에 분을 더함
 * @param {string} time - HH:MM 형식
 * @param {number} minutesToAdd - 더할 분
 * @returns {string} HH:MM 형식
 */
const addMinutes = (time, minutesToAdd) => {
  const totalMinutes = timeToMinutes(time) + minutesToAdd;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};
const ActivityLog = require('../models/ActivityLog');
const { parseMessage } = require('./coordinationExchangeController/services/geminiService');
const { handleDateChange } = require('./coordinationExchangeController/services/dateChangeService');
const { validateRoomExists, validateIsMember, validateMessage } = require('./coordinationExchangeController/validators/roomValidator');
const { DAY_MAP_KO_TO_EN } = require('./coordinationExchangeController/constants/dayMappings');
const { addHours, getHoursDifference, timeToMinutes: timeToMinutesUtil, minutesToTime } = require('./coordinationExchangeController/utils/timeUtils');

/**
 * Parse natural language exchange request using Gemini
 * POST /api/coordination/rooms/:roomId/parse-exchange-request
 */
exports.parseExchangeRequest = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { message, recentMessages } = req.body;

    // 검증
    validateMessage(message);

    // Room 조회
    const room = await Room.findById(roomId);
    validateRoomExists(room);
    validateIsMember(room, req.user.id);

    // Gemini로 파싱
    const parsed = await parseMessage(message, recentMessages);

    res.json({ parsed });

  } catch (error) {
    res.status(500).json({
      error: error.message || '서버 오류가 발생했습니다.',
      details: error.message
    });
  }
};

/**
 * Execute smart exchange with validation
 * POST /api/coordination/rooms/:roomId/smart-exchange
 *
 * ✅ 완전 리팩토링됨 - 백업 파일 불필요
 * - date_change: dateChangeService 사용
 * - time_change: 모든 로직 포함
 */
exports.smartExchange = async (req, res) => {
  try {
    const { roomId } = req.params;
    const {
      type,
      targetDay,
      targetTime,
      viewMode,
      currentWeekStartDate,
      weekNumber,
      weekOffset,
      sourceWeekOffset,
      sourceDay,  // date_change: 숫자 (3일 → 3), time_change: 문자열 ("월요일")
      sourceTime, // date_change에서 소스 시간 (예: "13:00")
      sourceMonth,
      sourceYear, // 출발 년도 (예: 2025, 2026)
      targetMonth,
      targetYear, // 목표 년도 (예: 2025, 2026)
      targetDate: targetDateNum
    } = req.body;

    // time_change용으로 sourceDayStr 별도 변수 생성
    const sourceDayStr = (type === 'time_change' && sourceDay) ? sourceDay : null;

    // 🚀🚀🚀 [ENTRY POINT] 함수 진입 확인
    console.log('🚀🚀🚀 [smartExchange] API 호출됨!', {
      userId: req.user.id,
      roomId,
      type,
      targetDay,
      targetTime,
      sourceDayStr,
      sourceWeekOffset,
      viewMode
    });

    // Verify room exists
    const room = await Room.findById(roomId)
      .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes')
      .populate('members.user', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes')
      .populate('timeSlots.user', '_id firstName lastName email');

    if (!room) {
      return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
    }

    // Verify user is a member
    const memberData = room.members.find(m =>
      (m.user._id || m.user).toString() === req.user.id.toString()
    );
    if (!memberData) {
      return res.status(403).json({ success: false, message: '방 멤버만 이 기능을 사용할 수 있습니다.' });
    }

    // 🔍 [ROOM INFO] 방 정보 확인
    const effectiveTravelMode = room.confirmedTravelMode || room.currentTravelMode || room.travelMode;
    console.log('🔥🔥🔥 [smartExchange] effectiveTravelMode 계산:', {
      confirmedTravelMode: room.confirmedTravelMode,
      currentTravelMode: room.currentTravelMode,
      travelMode: room.travelMode,
      '최종_effectiveTravelMode': effectiveTravelMode
    });
    console.log('🔍 [smartExchange] 방 정보:', {
      travelMode: room.travelMode,
      currentTravelMode: room.currentTravelMode,
      confirmedTravelMode: room.confirmedTravelMode,
      effectiveTravelMode: effectiveTravelMode,
      totalTimeSlots: room.timeSlots.length,
      travelSlots: room.timeSlots.filter(s => s.isTravel).length,
      classSlots: room.timeSlots.filter(s => !s.isTravel).length
    });

    // Map day names to English
    const dayMap = {
      '월요일': 'monday',
      '화요일': 'tuesday',
      '수요일': 'wednesday',
      '목요일': 'thursday',
      '금요일': 'friday'
    };

    // Handle date_change type (날짜 기반 이동) - 완전 리팩토링됨
    if (type === 'date_change') {
      return await handleDateChange(req, res, room, memberData, {
        sourceMonth,
        sourceDay,
        sourceTime,
        sourceYear,
        targetMonth,
        targetDateNum,
        targetTime,
        targetYear,
        viewMode,
        currentWeekStartDate
      });
    }

    // For time_change type, validate targetDay
    const targetDayEnglish = dayMap[targetDay];
    if (!targetDayEnglish) {
      return res.status(400).json({ success: false, message: '유효하지 않은 요일입니다.' });
    }

    // ========== time_change 로직 (모두 포함됨) ==========

    // Get current week's Monday
    let monday;
    const now = new Date();
    const day = now.getUTCDay();
    const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
    monday = new Date(now);
    monday.setUTCDate(diff);
    monday.setUTCHours(0, 0, 0, 0);

    // currentWeekStartDate가 제공되고 weekOffset이 없으면 해당 주 기준으로 계산
    if (currentWeekStartDate && !weekOffset && weekOffset !== 0) {
      const providedDate = new Date(currentWeekStartDate);
      const providedDay = providedDate.getUTCDay();
      const providedDiff = providedDate.getUTCDate() - providedDay + (providedDay === 0 ? -6 : 1);
      monday = new Date(providedDate);
      monday.setUTCDate(providedDiff);
      monday.setUTCHours(0, 0, 0, 0);
    }

    // Calculate target date
    const dayNumbers = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5 };
    const targetDayNumber = dayNumbers[targetDayEnglish];
    let targetDate;

    // weekOffset 처리
    if (weekOffset !== null && weekOffset !== undefined) {
      const targetWeekMonday = new Date(monday);
      targetWeekMonday.setUTCDate(monday.getUTCDate() + (weekOffset * 7));
      targetDate = new Date(targetWeekMonday);
      targetDate.setUTCDate(targetWeekMonday.getUTCDate() + targetDayNumber - 1);
    }
    // weekNumber가 제공된 경우
    else if (weekNumber) {
      const year = monday.getFullYear();
      const month = targetMonth ? targetMonth - 1 : monday.getMonth();
      const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
      const firstDayWeekday = firstDayOfMonth.getUTCDay();
      const targetDayOfWeekNum = targetDayNumber;
      let daysToFirstTargetDay = targetDayOfWeekNum - firstDayWeekday;
      if (daysToFirstTargetDay < 0) daysToFirstTargetDay += 7;
      if (daysToFirstTargetDay === 0 && firstDayWeekday === 0) daysToFirstTargetDay = 1;
      const firstTargetDay = new Date(Date.UTC(year, month, 1 + daysToFirstTargetDay));
      targetDate = new Date(firstTargetDay);
      targetDate.setUTCDate(firstTargetDay.getUTCDate() + (weekNumber - 1) * 7);
    } else {
      targetDate = new Date(monday);
      targetDate.setUTCDate(monday.getUTCDate() + targetDayNumber - 1);
    }

    // viewMode 검증
    if (viewMode === 'week') {
      const weekStart = new Date(monday);
      const weekEnd = new Date(monday);
      weekEnd.setUTCDate(monday.getUTCDate() + 6);
      weekEnd.setUTCHours(23, 59, 59, 999);
      if (targetDate < weekStart || targetDate > weekEnd) {
        const weekStartStr = weekStart.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
        const weekEndStr = weekEnd.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
        return res.status(400).json({
          success: false,
          message: `주간 모드에서는 이번 주(${weekStartStr} ~ ${weekEndStr}) 내에서만 이동할 수 있습니다. 다른 주로 이동하려면 월간 모드로 전환해주세요.`
        });
      }
    } else if (viewMode === 'month') {
      const year = monday.getFullYear();
      const month = monday.getMonth();
      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);
      const firstDayOfWeek = firstDayOfMonth.getDay();
      const daysToFirstMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
      const monthStart = new Date(firstDayOfMonth);
      monthStart.setDate(firstDayOfMonth.getDate() - daysToFirstMonday);
      monthStart.setUTCHours(0, 0, 0, 0);
      const lastDayOfWeek = lastDayOfMonth.getDay();
      const daysToLastSunday = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
      const monthEnd = new Date(lastDayOfMonth);
      monthEnd.setDate(lastDayOfMonth.getDate() + daysToLastSunday);
      monthEnd.setUTCHours(23, 59, 59, 999);
      if (targetDate < monthStart || targetDate > monthEnd) {
        const monthName = firstDayOfMonth.toLocaleDateString('ko-KR', { month: 'long' });
        return res.status(400).json({
          success: false,
          message: `${monthName} 범위를 벗어나는 이동입니다. 다른 달로 이동하시겠습니까?`,
          warning: 'out_of_month_range'
        });
      }
    }

    // 🔒 Validate: Check if target day/time is in OWNER's preferred schedule
    const owner = room.owner;
    const ownerDefaultSchedule = owner.defaultSchedule || [];
    const targetDateStr = targetDate.toISOString().split('T')[0];
    const targetDayOfWeek = targetDate.getDay();

    // Check if owner has schedule for this date/day
    const ownerTargetSchedules = ownerDefaultSchedule.filter(s => {
      // 🔧 specificDate가 있으면 그 날짜에만 적용
      if (s.specificDate) {
        return s.specificDate === targetDateStr;
      } else {
        // specificDate가 없으면 dayOfWeek로 체크 (반복 일정)
        return s.dayOfWeek === targetDayOfWeek;
      }
    });

    if (ownerTargetSchedules.length === 0) {
      return res.status(400).json({
        success: false,
        message: `❌ ${targetDay}은 방장의 선호시간이 아닙니다. 방장이 가능한 날짜/시간으로만 이동할 수 있습니다.`
      });
    }

    // Check if the requested time fits within owner's schedule (if targetTime is specified)
    if (targetTime) {
      const timeToMinutes = (timeStr) => {
        const [hour, minute] = timeStr.split(':').map(Number);
        return hour * 60 + minute;
      };

      const targetTimeMinutes = timeToMinutes(targetTime);

      const ownerScheduleTimes = ownerTargetSchedules.map(s => ({
        start: timeToMinutes(s.startTime),
        end: timeToMinutes(s.endTime)
      })).sort((a, b) => a.start - b.start);

      const ownerMergedBlocks = [];
      ownerScheduleTimes.forEach(slot => {
        if (ownerMergedBlocks.length === 0) {
          ownerMergedBlocks.push({ start: slot.start, end: slot.end });
        } else {
          const lastBlock = ownerMergedBlocks[ownerMergedBlocks.length - 1];
          if (slot.start <= lastBlock.end) {
            lastBlock.end = Math.max(lastBlock.end, slot.end);
          } else {
            ownerMergedBlocks.push({ start: slot.start, end: slot.end });
          }
        }
      });

      const fitsInOwnerSchedule = ownerMergedBlocks.some(block =>
        targetTimeMinutes >= block.start && targetTimeMinutes < block.end
      );

      if (!fitsInOwnerSchedule) {
        const ownerScheduleRanges = ownerMergedBlocks.map(b => {
          const startHour = Math.floor(b.start / 60);
          const startMin = b.start % 60;
          const endHour = Math.floor(b.end / 60);
          const endMin = b.end % 60;
          return `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}-${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
        }).join(', ');

        return res.status(400).json({
          success: false,
          message: `❌ ${targetTime}는 방장의 선호시간(${ownerScheduleRanges})에 포함되지 않습니다.`
        });
      }
    }

    // Find requester's current slots
    const requesterCurrentSlots = room.timeSlots.filter(slot => {
      const slotUserId = (slot.user._id || slot.user).toString();
      const isUserSlot = slotUserId === req.user.id.toString();
      const isValidSubject = slot.subject === '자동 배정' ||
                             slot.subject === '교환 결과' ||
                             slot.subject === '자동 재배치' ||
                             slot.subject === '연쇄 교환 결과' ||
                             slot.subject === '연쇄 조정 결과' ||
                             slot.subject === '직접 교환';
      return isUserSlot && isValidSubject;
    });

    if (requesterCurrentSlots.length === 0) {
      return res.status(400).json({
        success: false,
        message: '현재 배정된 시간이 없습니다. 먼저 자동 배정을 받으세요.'
      });
    }


    // Group slots by date to find continuous blocks
    const slotsByDate = {};
    requesterCurrentSlots.forEach(slot => {
      const dateKey = new Date(slot.date).toISOString().split('T')[0];
      if (!slotsByDate[dateKey]) slotsByDate[dateKey] = [];
      slotsByDate[dateKey].push(slot);
    });

    // Find continuous blocks
    const continuousBlocks = [];
    Object.entries(slotsByDate).forEach(([dateKey, slots]) => {
      slots.sort((a, b) => {
        const [aH, aM] = a.startTime.split(':').map(Number);
        const [bH, bM] = b.startTime.split(':').map(Number);
        return (aH * 60 + aM) - (bH * 60 + bM);
      });

      let currentBlock = [slots[0]];
      for (let i = 1; i < slots.length; i++) {
        const prev = currentBlock[currentBlock.length - 1];
        const curr = slots[i];
        if (prev.endTime === curr.startTime) {
          currentBlock.push(curr);
        } else {
          continuousBlocks.push([...currentBlock]);
          currentBlock = [curr];
        }
      }
      continuousBlocks.push(currentBlock);
    });

    // Select block to move (source filtering logic)
    let selectedBlock;
    let sourceWeekMonday, sourceWeekSunday;

    if (sourceWeekOffset !== null && sourceWeekOffset !== undefined) {
      const todayMonday = new Date(now);
      const todayDay = now.getUTCDay();
      const todayDiff = now.getUTCDate() - todayDay + (todayDay === 0 ? -6 : 1);
      todayMonday.setUTCDate(todayDiff);
      todayMonday.setUTCHours(0, 0, 0, 0);
      sourceWeekMonday = new Date(todayMonday);
      sourceWeekMonday.setUTCDate(todayMonday.getUTCDate() + (sourceWeekOffset * 7));
      sourceWeekSunday = new Date(sourceWeekMonday);
      sourceWeekSunday.setUTCDate(sourceWeekMonday.getUTCDate() + 6);
    } else {
      sourceWeekMonday = new Date(monday);
      sourceWeekSunday = new Date(monday);
      sourceWeekSunday.setUTCDate(sourceWeekMonday.getUTCDate() + 6);
    }

    const sourceWeekBlocks = continuousBlocks.filter(block => {
      const blockDate = new Date(block[0].date);
      return blockDate >= sourceWeekMonday && blockDate <= sourceWeekSunday;
    });


    let candidateBlocks = sourceWeekBlocks;

    if (sourceDayStr) {
      const sourceDayMap = {
        '월요일': 'monday', '월': 'monday',
        '화요일': 'tuesday', '화': 'tuesday',
        '수요일': 'wednesday', '수': 'wednesday',
        '목요일': 'thursday', '목': 'thursday',
        '금요일': 'friday', '금': 'friday'
      };
      const sourceDayEnglish = sourceDayMap[sourceDayStr] || sourceDayStr.toLowerCase();
      candidateBlocks = sourceWeekBlocks.filter(block => {
        const match = block[0].day === sourceDayEnglish;
        return match;
      });
    }

    if (candidateBlocks.length > 0) {
      const blocksNotOnTargetDay = candidateBlocks.filter(block => block[0].day !== targetDayEnglish);
      const blocksOnTargetDay = candidateBlocks.filter(block => block[0].day === targetDayEnglish);
      selectedBlock = blocksNotOnTargetDay.length > 0 ? blocksNotOnTargetDay[0] :
                     blocksOnTargetDay.length > 0 ? blocksOnTargetDay[0] : candidateBlocks[0];
    } else {
      // 주차 필터링에서 찾지 못한 경우, 전체 블록에서 sourceDayStr로 찾기
      if (sourceDayStr) {
        const sourceDayMap = {
          '월요일': 'monday', '월': 'monday',
          '화요일': 'tuesday', '화': 'tuesday',
          '수요일': 'wednesday', '수': 'wednesday',
          '목요일': 'thursday', '목': 'thursday',
          '금요일': 'friday', '금': 'friday'
        };
        const sourceDayEnglish = sourceDayMap[sourceDayStr] || sourceDayStr.toLowerCase();

        const allDayBlocks = continuousBlocks.filter(block => block[0].day === sourceDayEnglish);
        if (allDayBlocks.length > 0) {
          allDayBlocks.forEach((block, idx) => {
          });
          const blocksNotOnTargetDay = allDayBlocks.filter(block => block[0].day !== targetDayEnglish);
          selectedBlock = blocksNotOnTargetDay.length > 0 ? blocksNotOnTargetDay[0] : allDayBlocks[0];
        } else {
          return res.status(400).json({
            success: false,
            message: `${sourceDayStr}에 배정된 일정이 없습니다.`
          });
        }
      } else if (sourceWeekOffset !== null && sourceWeekOffset !== undefined) {
        const weekNames = { '-2': '지지난주', '-1': '저번주', '0': '이번주', '1': '다음주' };
        const weekName = weekNames[sourceWeekOffset.toString()] || `${sourceWeekOffset}주 전`;
        return res.status(400).json({
          success: false,
          message: `${weekName}에 배정된 일정이 없습니다.`
        });
      } else {
        const blocksNotOnTargetDay = continuousBlocks.filter(block => block[0].day !== targetDayEnglish);
        selectedBlock = blocksNotOnTargetDay.length > 0 ? blocksNotOnTargetDay[0] : continuousBlocks[0];
      }
    }

    const allSlotsInBlock = selectedBlock;
    const blockStartTime = allSlotsInBlock[0].startTime;
    const blockEndTime = allSlotsInBlock[allSlotsInBlock.length - 1].endTime;
    const totalHours = getHoursDifference(blockStartTime, blockEndTime);
    const newStartTime = targetTime || blockStartTime;
    const newEndTime = addHours(newStartTime, totalHours);

    // ✅ Owner validation already done above (lines 240-267) - removed duplicate

    // 금지 시간 검증 (전체 일정 길이 확인)
    const blockedTimes = room.settings?.blockedTimes || [];
    if (blockedTimes.length > 0) {
      const blockedTime = isTimeInBlockedRange(newStartTime, newEndTime, blockedTimes);
      if (blockedTime) {
        return res.status(400).json({
          success: false,
          message: `${blockedTime.name || '금지 시간'}(${blockedTime.startTime}-${blockedTime.endTime})에는 일정을 배정할 수 없습니다. ${newStartTime}-${newEndTime} 일정이 겹칩니다.`
        });
      }
    }

    // Check MEMBER's preferred schedule
    const requesterUser = memberData.user;
    const requesterDefaultSchedule = requesterUser.defaultSchedule || [];
    const requesterExceptions = requesterUser.scheduleExceptions || []; // <-- 💥 GET EXCEPTIONS

    // Find all schedules applicable to the target date by combining default and exceptions
    const memberTargetDaySchedules = [
      // 1. Recurring schedules for that day of the week (from defaultSchedule)
      ...requesterDefaultSchedule.filter(s => !s.specificDate && s.dayOfWeek === targetDayOfWeek),
      // 2. Specific date schedules (from exceptions)
      ...requesterExceptions.filter(s => s.specificDate === targetDateStr),
      // 3. Specific date schedules (from defaultSchedule - to handle data corruption)
      ...requesterDefaultSchedule.filter(s => s.specificDate === targetDateStr)
    ];


    if (memberTargetDaySchedules.length === 0) {
      return res.status(400).json({
        success: false,
        message: `${targetDay}는 당신의 선호 시간이 아닙니다. 본인이 설정한 선호 요일/날짜로만 변경할 수 있습니다.`
      });
    }

    // Merge and find overlapping time ranges
    const mergeSlots = (schedules) => {
      // Helper: Convert time to "HH:MM" format (handles ISO datetime)
      const normalizeTime = (timeStr) => {
        if (!timeStr) return '00:00';

        // ✅ Date 객체나 다른 객체인 경우 문자열로 변환
        if (typeof timeStr !== 'string') {
          if (timeStr instanceof Date) {
            timeStr = timeStr.toISOString();
          } else if (typeof timeStr === 'object') {
            timeStr = timeStr.toString();
          } else {
            return '00:00';
          }
        }

        // If already "HH:MM" format
        if (timeStr.match(/^\d{2}:\d{2}$/)) return timeStr;
        // If ISO format (contains 'T')
        if (timeStr.includes('T')) {
          const date = new Date(timeStr);
          const result = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
          return result;
        }
        return timeStr;
      };

      const sorted = [...schedules].sort((a, b) => {
        const aTime = normalizeTime(a.startTime);
        const bTime = normalizeTime(b.startTime);
        const [aH, aM] = aTime.split(':').map(Number);
        const [bH, bM] = bTime.split(':').map(Number);
        return (aH * 60 + aM) - (bH * 60 + bM);
      });

      const merged = [];
      let current = null;

      for (const schedule of sorted) {
        const startTime = normalizeTime(schedule.startTime);
        const endTime = normalizeTime(schedule.endTime);
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (!current) {
          current = { startMinutes, endMinutes, startTime: startTime, endTime: endTime };
        } else {
          if (startMinutes <= current.endMinutes) {
            current.endMinutes = Math.max(current.endMinutes, endMinutes);
            current.endTime = endTime;
          } else {
            merged.push({ ...current });
            current = { startMinutes, endMinutes, startTime: startTime, endTime: endTime };
          }
        }
      }
      if (current) merged.push(current);
      return merged;
    };

    const ownerMergedRanges = mergeSlots(ownerTargetSchedules);
    const memberMergedRanges = mergeSlots(memberTargetDaySchedules);

    const overlappingRanges = [];
    for (const ownerRange of ownerMergedRanges) {
      for (const memberRange of memberMergedRanges) {
        const overlapStart = Math.max(ownerRange.startMinutes, memberRange.startMinutes);
        const overlapEnd = Math.min(ownerRange.endMinutes, memberRange.endMinutes);

        if (overlapStart < overlapEnd) {
          const startH = Math.floor(overlapStart / 60);
          const startM = overlapStart % 60;
          const endH = Math.floor(overlapEnd / 60);
          const endM = overlapEnd % 60;
          overlappingRanges.push({
            startMinutes: overlapStart,
            endMinutes: overlapEnd,
            startTime: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
            endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
          });
        }
      }
    }

    if (overlappingRanges.length === 0) {
      return res.status(400).json({
        success: false,
        message: `${targetDay}에 방장과 당신의 선호 시간이 겹치지 않습니다.`
      });
    }

    let finalNewStartTime = newStartTime;
    let finalNewEndTime = newEndTime;

    if (!targetTime && selectedBlock[0].day !== targetDayEnglish) {
      finalNewStartTime = overlappingRanges[0].startTime;
      finalNewEndTime = addHours(finalNewStartTime, totalHours);
    }

    const [newStartH, newStartM] = finalNewStartTime.split(':').map(Number);
    const [newEndH, newEndM] = finalNewEndTime.split(':').map(Number);
    const newStartMinutes = newStartH * 60 + newStartM;
    const newEndMinutes = newEndH * 60 + newEndM;

    let isWithinOverlap = false;
    for (const range of overlappingRanges) {
      if (newStartMinutes >= range.startMinutes && newEndMinutes <= range.endMinutes) {
        isWithinOverlap = true;
        break;
      }
    }

    if (!isWithinOverlap) {
      const availableRanges = overlappingRanges.map(r => `${r.startTime}-${r.endTime}`).join(', ');
      return res.status(400).json({
        success: false,
        message: `${targetDay} ${newStartTime}-${newEndTime}는 사용할 수 없습니다. 가능한 시간: ${availableRanges}`
      });
    }

    // 🆕 이동시간 모드일 때 시뮬레이션으로 검증
    if (effectiveTravelMode && effectiveTravelMode !== 'normal') {
      console.log(`🔍 [검증] 이동시간 시뮬레이션 시작: ${targetDay} ${finalNewStartTime}`);

      const { simulateScheduleWithNewSlot } = require('../services/scheduleSimulator');

      const duration = (newEndH * 60 + newEndM) - (newStartH * 60 + newStartM);

      const simulationResult = await simulateScheduleWithNewSlot(
        roomId,
        req.user.id,
        targetDate,
        finalNewStartTime,
        duration
      );

      if (!simulationResult.isValid) {
        console.log(`❌ [검증 실패] ${simulationResult.reason}`);
        return res.status(400).json({
          success: false,
          message: '해당 시간에 배치할 수 없습니다. 다른 시간을 선택해주세요.',
          reason: 'travel_time_conflict'
        });
      }

      console.log(`✅ [검증 통과] 시뮬레이션 성공`);
    }

    // Check if target slot exists
    const targetSlots = room.timeSlots.filter(slot => {
      const slotDate = new Date(slot.date);
      return slotDate.toISOString().split('T')[0] === targetDate.toISOString().split('T')[0] &&
             (!targetTime || slot.startTime === targetTime);
    });

    const occupiedSlot = targetSlots.find(slot =>
      (slot.user._id || slot.user).toString() !== req.user.id.toString()
    );

    // Case 1: Target slot is empty → Immediate swap
    if (!occupiedSlot) {
      console.log('📍 [smartExchange] Case 1 진입: 타겟 슬롯이 비어있음 (즉시 이동)');

      // 🛑 [검증 Phase] 이동시간 포함 시 선호시간 침범 여부 확인
      if (effectiveTravelMode && effectiveTravelMode !== 'normal') {
        let predictedTravelMinutes = 0;
        try {
           console.log('🔍 [검증] 이동시간 예측 시작...');
           // 1. 해당 날짜(targetDate)의 기존 슬롯들 가져오기
           const slotsOnTargetDate = room.timeSlots.filter(slot => {
             const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
             const targetDateStr = targetDate.toISOString().split('T')[0];
             return slotDateStr === targetDateStr && !slot.isTravel;
           });

           // 2. 이전 슬롯 찾기
           let prevSlot = null;
           let prevEndMin = 0;
           const targetStartMin = newStartH * 60 + newStartM;

           for (const slot of slotsOnTargetDate) {
             const [h, m] = slot.endTime.split(':').map(Number);
             const endMin = h * 60 + m;
             if (endMin <= targetStartMin && endMin > prevEndMin) {
               prevSlot = slot;
               prevEndMin = endMin;
             }
           }

           // 3. 이동시간 계산
           let fromLat, fromLng;
           if (prevSlot) {
             const prevUserId = prevSlot.user._id || prevSlot.user;
             const prevUser = await User.findById(prevUserId);
             fromLat = prevUser?.addressLat;
             fromLng = prevUser?.addressLng;
             console.log(`  - 이전 수업(${prevSlot.subject}) 종료 위치: ${prevUser?.firstName}`);
             
             // 만약 이전 수업이 있는데 주소가 없으면? 방장 집에서 출발하는 것으로 가정? 아니면 0분?
             // 일단 방장 집 체크
             if (!fromLat && prevUserId.toString() === room.owner._id.toString()) {
                fromLat = room.owner.addressLat;
                fromLng = room.owner.addressLng;
                console.log('  - 이전 수업 주소 없음 -> 방장 집 위치 사용');
             }
           } else {
             fromLat = room.owner.addressLat;
             fromLng = room.owner.addressLng;
             console.log('  - 이전 수업 없음 -> 방장 집 위치 사용');
           }

           const myUser = await User.findById(req.user.id);
           console.log(`  🔍 [좌표 확인] 출발(${fromLat}, ${fromLng}) -> 도착(${myUser?.firstName}: ${myUser?.addressLat}, ${myUser?.addressLng})`);
           
           if (fromLat && fromLng && myUser?.addressLat && myUser?.addressLng) {
              const distance = calculateDistance(fromLat, fromLng, myUser.addressLat, myUser.addressLng);
              const speed = { driving: 40, transit: 30, walking: 5, bicycling: 15 }[effectiveTravelMode] || 30;
              predictedTravelMinutes = Math.ceil((distance / speed) * 60 / 10) * 10;
              console.log(`  ✅ [계산 성공] 거리: ${distance.toFixed(2)}km, 속도: ${speed}km/h, 시간: ${predictedTravelMinutes}분`);
           } else {
              console.warn(`  ⚠️ [계산 실패] 좌표 정보 누락. fromLat: ${!!fromLat}, fromLng: ${!!fromLng}, toLat: ${!!myUser?.addressLat}`);
           }
        } catch (e) {
          console.error('❌ 검증 중 이동시간 계산 실패:', e);
        }

        // 4. 선호시간 침범 확인
        if (predictedTravelMinutes > 0) {
           const actualStartMin = (newStartH * 60 + newStartM) - predictedTravelMinutes;
           console.log(`🔍 [검증] 요청시간: ${newStartTime}, 실제시작: ${minutesToTime(actualStartMin)} (${predictedTravelMinutes}분 이동)`);
           console.log('  - 선호시간 범위:', memberMergedRanges.map(r => `${minutesToTime(r.startMinutes)}~${minutesToTime(r.endMinutes)}`).join(', '));

           // memberMergedRanges가 비어있으면(전체 가능) 통과, 아니면 범위 체크
           const isPreferred = memberMergedRanges.length === 0 || memberMergedRanges.some(range => 
              actualStartMin >= range.startMinutes && (newEndH * 60 + newEndM) <= range.endMinutes
           );
           
           if (!isPreferred) {
              const minPossibleTime = minutesToTime(memberMergedRanges[0].startMinutes + predictedTravelMinutes);
              console.log(`⛔ [거부] 선호시간 침범! 최소 가능 시간: ${minPossibleTime}`);
              return res.status(400).json({
                  success: false,
                  message: `이동시간(${predictedTravelMinutes}분)을 고려하면 ${minutesToTime(actualStartMin)}에 시작해야 합니다. 이는 선호시간을 벗어납니다. 최소 ${minPossibleTime}부터 가능합니다.`,
                  reason: 'travel_time_preference_conflict'
              });
           }
        }
      }

      const currentBlockDate = new Date(allSlotsInBlock[0].date);
      const isSameDay = currentBlockDate.toISOString().split('T')[0] === targetDate.toISOString().split('T')[0];
      const isSameTime = blockStartTime === newStartTime && blockEndTime === newEndTime;

      if (isSameDay && isSameTime) {
        return res.json({
          success: true,
          message: `이미 ${targetDay} ${newStartTime}-${newEndTime}에 배정되어 있습니다.`,
          immediateSwap: true,
          targetDay,
          targetTime: newStartTime
        });
      }

      // 🧹 [문제 2 해결] 강력한 삭제 로직
      const slotIdsToRemove = allSlotsInBlock.map(slot => String(slot._id));
      const oldSlotDate = new Date(allSlotsInBlock[0].date).toISOString().split('T')[0];
      const targetDateStr = targetDate.toISOString().split('T')[0];
      const myUserIdStr = String(req.user.id);

      // 1. 수업 슬롯 삭제
      room.timeSlots = room.timeSlots.filter(slot => !slotIdsToRemove.includes(String(slot._id)));

      // 2. 이동시간 슬롯 삭제 (원본 날짜 + 목표 날짜, 내꺼만)
      const initialCount = room.timeSlots.length;
      room.timeSlots = room.timeSlots.filter(slot => {
         const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
         const slotUserIdStr = String(slot.user._id || slot.user);
         const isTravel = slot.isTravel === true || slot.subject === '이동시간' || slot.subject === 'Travel Time';
         
         if (isTravel && slotUserIdStr === myUserIdStr && (slotDateStr === oldSlotDate || slotDateStr === targetDateStr)) {
            console.log(`  🔥 [삭제] 고아 슬롯 방지: ${slotDateStr} ${slot.startTime}`);
            return false; 
         }
         return true;
      });
      console.log(`🗑️ 삭제 완료: ${initialCount - room.timeSlots.length}개 슬롯 제거됨`);


      // 🆕 이동시간 재계산 및 새 수업 배치 로직 시작...
      // (아래 로직은 기존 유지)
      const newStartMinutes = timeToMinutesUtil(finalNewStartTime);

      // 1. 해당 날짜의 기존 슬롯 찾기
      const slotsOnDate = room.timeSlots.filter(slot => {
        const slotDate = new Date(slot.date).toISOString().split('T')[0];
        return slotDate === targetDateStr;
      });

      // 2. 마지막 슬롯 찾기 (새 시작 시간보다 먼저 끝나는 것 중 가장 늦게 끝나는 것)
      let previousSlot = null;
      let previousEndMinutes = 0;

      for (const slot of slotsOnDate) {
        const slotEndMinutes = timeToMinutesUtil(slot.endTime);
        if (slotEndMinutes <= newStartMinutes && slotEndMinutes > previousEndMinutes) {
          previousSlot = slot;
          previousEndMinutes = slotEndMinutes;
        }
      }

      // 3. 이동시간 계산 (실제 적용용)
      let travelDurationMinutes = 0;
      let travelFromLocation = '방장';

      // effectiveTravelMode 사용 (room.travelMode가 아직 없을 수 있음)
      const calcMode = effectiveTravelMode || room.travelMode;

      if (calcMode && calcMode !== 'normal') {
        try {
          console.log(`🔍 [실제 적용] 이동시간 계산 시작 (${calcMode})`);
          
          let fromLat, fromLng;
          if (previousSlot) {
             const previousUserId = previousSlot.user._id || previousSlot.user;
             const previousUser = await User.findById(previousUserId);
             fromLat = previousUser?.addressLat;
             fromLng = previousUser?.addressLng;
             
             if (!fromLat && String(previousUserId) === String(room.owner._id)) {
                fromLat = room.owner.addressLat;
                fromLng = room.owner.addressLng;
             }
          } else {
             // 이전 슬롯 없으면 방장 집에서 출발
             fromLat = room.owner.addressLat;
             fromLng = room.owner.addressLng;
          }

          const currentUser = await User.findById(req.user.id);
          console.log(`  - 좌표: 출발(${fromLat}, ${fromLng}) -> 도착(${currentUser?.addressLat}, ${currentUser?.addressLng})`);

          if (fromLat && fromLng && currentUser?.addressLat && currentUser?.addressLng) {
            const distance = calculateDistance(fromLat, fromLng, currentUser.addressLat, currentUser.addressLng);
            const speed = { driving: 40, transit: 30, walking: 5, bicycling: 15 }[calcMode] || 30;
            travelDurationMinutes = Math.ceil((distance / speed) * 60 / 10) * 10;
            console.log(`  ✅ [계산 성공] ${travelDurationMinutes}분`);
          } else {
            console.warn(`  ⚠️ [계산 실패] 좌표 누락`);
          }
        } catch (error) {
          console.error('❌ 이동시간 계산 중 오류:', error);
          travelDurationMinutes = 0;
        }
      }

      // 🆕 수업 슬롯만 생성 (이동시간은 recalculateTravelTimeSlotsForDate에서 처리)
      const totalMinutes = (parseInt(finalNewEndTime.split(':')[0]) * 60 + parseInt(finalNewEndTime.split(':')[1])) -
                          (parseInt(finalNewStartTime.split(':')[0]) * 60 + parseInt(finalNewStartTime.split(':')[1]));
      const activityDurationMinutes = totalMinutes; // 원래 수업 시간

      const newSlots = [];

      // 수업 슬롯 생성 (사용자가 요청한 시간에 배치)
      const activityStartMinutes = newStartMinutes;
      const numActivitySlots = Math.ceil(activityDurationMinutes / 10);

      for (let i = 0; i < numActivitySlots; i++) {
        const slotStartMinutes = activityStartMinutes + (i * 10);
        const slotEndMinutes = slotStartMinutes + 10;
        const currentTime = minutesToTime(slotStartMinutes);
        const slotEndTime = minutesToTime(slotEndMinutes);

        // 🆕 Phase 3: 조원 프라이버시 보호 - 첫 번째 슬롯에만 이동시간 메타데이터 저장
        const slotData = {
          user: req.user.id,
          date: targetDate,
          startTime: currentTime,  // ✅ 조원이 요청한 순수 수업 시간
          endTime: slotEndTime,
          day: targetDayEnglish,
          priority: allSlotsInBlock[0]?.priority || 3,
          subject: '자동 배정',
          assignedBy: room.owner._id,
          assignedAt: new Date(),
          status: 'confirmed',
          // 이동시간 관련 메타데이터 유지
          originalStartTime: allSlotsInBlock[0]?.originalStartTime,
          originalEndTime: allSlotsInBlock[0]?.originalEndTime,
          adjustedForTravelTime: allSlotsInBlock[0]?.adjustedForTravelTime,
          location: allSlotsInBlock[0]?.location
        };

        // 🆕 첫 번째 슬롯: 이동시간 메타데이터 저장 (조원에게 절대 노출 금지!)
        if (i === 0 && travelDurationMinutes > 0) {
          const actualStartMinutes = activityStartMinutes - travelDurationMinutes;
          slotData.actualStartTime = minutesToTime(actualStartMinutes);
          slotData.travelTimeBefore = travelDurationMinutes;
        }

        newSlots.push(slotData);
      }

      room.timeSlots.push(...newSlots);

      // 🆕 이동시간 재계산: 원본 날짜와 목표 날짜 모두
      console.log('🔥🔥🔥 [smartExchange Case 1] 이동시간 재계산 시작!', {
        travelMode: effectiveTravelMode,
        oldDate: new Date(allSlotsInBlock[0].date).toISOString().split('T')[0],
        newDate: targetDate.toISOString().split('T')[0]
      });
      console.log('🔥 [Case 1] 재계산 전 슬롯 개수:', room.timeSlots.length);
      
      // ✅ 수정: effectiveTravelMode를 명시적으로 전달
      await recalculateTravelTimeSlotsForDate(room, new Date(allSlotsInBlock[0].date), room.owner._id, effectiveTravelMode);
      console.log('🔥 [Case 1] 첫 번째 재계산 완료');
      
      await recalculateTravelTimeSlotsForDate(room, targetDate, room.owner._id, effectiveTravelMode);
      console.log('🔥 [Case 1] 두 번째 재계산 완료');

      console.log('✅ [smartExchange Case 1] 이동시간 재계산 완료');
      const travelSlots = room.timeSlots.filter(s => s.isTravel);
      console.log('📊 [재계산 후] 전체 슬롯:', room.timeSlots.length, '개, 이동시간:', travelSlots.length, '개');

      await room.save();
      console.log('💾 [DB 저장] 완료');
      await room.populate('timeSlots.user', '_id firstName lastName email');

      // Log activity
      const targetMonth = targetDate.getUTCMonth() + 1;
      const targetDateNum = targetDate.getUTCDate();
      const formattedDate = `${targetMonth}월 ${targetDateNum}일`;
      const prevSlot = allSlotsInBlock[0];
      const prevDate = new Date(prevSlot.date);
      const prevMonth = prevDate.getUTCMonth() + 1;
      const prevDateNum = prevDate.getUTCDate();
      const prevTimeRange = `${prevSlot.startTime}-${allSlotsInBlock[allSlotsInBlock.length - 1].endTime}`;
      const userName = requesterUser.firstName && requesterUser.lastName
        ? `${requesterUser.firstName} ${requesterUser.lastName}`
        : requesterUser.email;

      await ActivityLog.logActivity(
        room._id,
        req.user.id,
        userName,
        'slot_swap',
        `${userName}님: ${prevMonth}월 ${prevDateNum}일 ${prevTimeRange} → ${formattedDate} ${finalNewStartTime}-${finalNewEndTime}로 즉시 변경`,
        {
          prevDate: `${prevMonth}월 ${prevDateNum}일`,
          prevTime: prevTimeRange,
          targetDate: formattedDate,
          targetTime: `${finalNewStartTime}-${finalNewEndTime}`
        }
      );

      // Socket.io로 실시간 업데이트 알림
      if (global.io) {
        global.io.to(`room-${roomId}`).emit('schedule-updated', {
          roomId,
          message: '시간표가 업데이트되었습니다.'
        });
      }

      return res.json({
        success: true,
        message: `${formattedDate} ${finalNewStartTime}-${finalNewEndTime}로 즉시 변경되었습니다!`,
        immediateSwap: true,
        targetDay,
        targetTime: finalNewStartTime
      });
    }

    // Auto-placement if no specific time requested
    if (!targetTime) {
      console.log('📍 [smartExchange] Case 2 진입: 자동 배치 (targetTime 없음)');
      const allSlotsOnTargetDate = room.timeSlots.filter(slot => {
        const slotDate = new Date(slot.date).toISOString().split('T')[0];
        return slotDate === targetDate.toISOString().split('T')[0];
      });

      let foundSlot = null;
      for (const range of overlappingRanges) {
        let currentStart = range.startMinutes;

        while (currentStart + (totalHours * 60) <= range.endMinutes) {
          const currentEnd = currentStart + (totalHours * 60);
          const hasConflict = allSlotsOnTargetDate.some(slot => {
            const slotStartMin = parseInt(slot.startTime.split(':')[0]) * 60 + parseInt(slot.startTime.split(':')[1]);
            const slotEndMin = parseInt(slot.endTime.split(':')[0]) * 60 + parseInt(slot.endTime.split(':')[1]);
            return currentStart < slotEndMin && currentEnd > slotStartMin;
          });

          if (!hasConflict) {
            foundSlot = { start: currentStart, end: currentEnd };
            break;
          }
          currentStart += 10; // 10분 단위로 이동
        }
        if (foundSlot) break;
      }

      if (foundSlot) {
        const autoStartTime = `${String(Math.floor(foundSlot.start / 60)).padStart(2, '0')}:${String(foundSlot.start % 60).padStart(2, '0')}`;
        const autoEndTime = `${String(Math.floor(foundSlot.end / 60)).padStart(2, '0')}:${String(foundSlot.end % 60).padStart(2, '0')}`;

        const slotIdsToRemove = allSlotsInBlock.map(slot => slot._id.toString());
        const oldSlotDate = new Date(allSlotsInBlock[0].date).toISOString().split('T')[0];

        for (const slotId of slotIdsToRemove) {
          const index = room.timeSlots.findIndex(slot => slot._id.toString() === slotId);
          if (index !== -1) room.timeSlots.splice(index, 1);
        }

        // ✅ Case 2도 재계산 함수 사용하도록 수정
        const targetDateStr = targetDate.toISOString().split('T')[0];

        // 기존 이동시간 슬롯 삭제 (재계산될 예정)
        room.timeSlots = room.timeSlots.filter(slot => {
          const slotDate = new Date(slot.date).toISOString().split('T')[0];
          const slotUserIdStr = String(slot.user._id || slot.user);
          const myUserIdStr = String(req.user.id);
          return !((slotDate === oldSlotDate || slotDate === targetDateStr) && slot.isTravel && slotUserIdStr === myUserIdStr);
        });

        // 수업 슬롯 생성 (이동시간 없이)
        const classStartMinutes = foundSlot.start;
        const classEndMinutes = foundSlot.end;
        const classTotalMinutes = classEndMinutes - classStartMinutes;
        const classNumSlots = Math.ceil(classTotalMinutes / 10);

        let currentTimeMinutes = classStartMinutes;
        for (let i = 0; i < classNumSlots; i++) {
          const slotEndTimeMinutes = currentTimeMinutes + 10;
          const currentTime = minutesToTime(currentTimeMinutes);
          const slotEndTime = minutesToTime(slotEndTimeMinutes);

          // 🆕 Phase 3: 조원 프라이버시 보호
          const classSlotData = {
            user: req.user.id,
            date: targetDate,
            startTime: currentTime,  // ✅ 조원에게 보이는 수업 시작 시간
            endTime: slotEndTime,
            day: targetDayEnglish,
            priority: allSlotsInBlock[i % allSlotsInBlock.length].priority || 3,
            subject: allSlotsInBlock[i % allSlotsInBlock.length].subject || '자동 배정',
            assignedBy: room.owner._id,
            assignedAt: new Date(),
            status: 'confirmed',
            location: allSlotsInBlock[0]?.location
          };

          room.timeSlots.push(classSlotData);
          currentTimeMinutes = slotEndTimeMinutes;
        }

        // ✅ 이동시간 재계산 (Case 1과 동일한 방식)
        console.log('🔥🔥🔥 [smartExchange Case 2] 이동시간 재계산 시작!', {
          travelMode: effectiveTravelMode,
          oldDate: oldSlotDate,
          newDate: targetDateStr
        });
        console.log('🔥 [Case 2] 재계산 전 슬롯 개수:', room.timeSlots.length);
        
        await recalculateTravelTimeSlotsForDate(room, new Date(oldSlotDate), room.owner._id, effectiveTravelMode);
        console.log('🔥 [Case 2] 첫 번째 재계산 완료');
        
        await recalculateTravelTimeSlotsForDate(room, targetDate, room.owner._id, effectiveTravelMode);
        console.log('🔥 [Case 2] 두 번째 재계산 완료');
        
        console.log('✅ [smartExchange Case 2] 이동시간 재계산 완료');
        const travelSlots = room.timeSlots.filter(s => s.isTravel);
        console.log('📊 [재계산 후] 전체 슬롯:', room.timeSlots.length, '개, 이동시간:', travelSlots.length, '개');

        await room.save();
        await room.populate('timeSlots.user', '_id firstName lastName email');

        const autoTargetMonth = targetDate.getUTCMonth() + 1;
        const autoTargetDateNum = targetDate.getUTCDate();
        const autoFormattedDate = `${autoTargetMonth}월 ${autoTargetDateNum}일`;
        const prevSlot = allSlotsInBlock[0];
        const prevDate = new Date(prevSlot.date);
        const prevMonth = prevDate.getUTCMonth() + 1;
        const prevDateNum = prevDate.getUTCDate();
        const prevTimeRange = `${prevSlot.startTime}-${allSlotsInBlock[allSlotsInBlock.length - 1].endTime}`;
        const userName = requesterUser.firstName && requesterUser.lastName
          ? `${requesterUser.firstName} ${requesterUser.lastName}`
          : requesterUser.email;

        await ActivityLog.logActivity(
          room._id,
          req.user.id,
          userName,
          'slot_swap',
          `${userName}님: ${prevMonth}월 ${prevDateNum}일 ${prevTimeRange} → ${autoFormattedDate} ${autoStartTime}-${autoEndTime}로 자동 배치`,
          {
            prevDate: `${prevMonth}월 ${prevDateNum}일`,
            prevTime: prevTimeRange,
            targetDate: autoFormattedDate,
            targetTime: `${autoStartTime}-${autoEndTime}`
          }
        );

        // Socket.io로 실시간 업데이트 알림
        if (global.io) {
          global.io.to(`room-${roomId}`).emit('schedule-updated', {
            roomId,
            message: '시간표가 업데이트되었습니다.'
          });
        }

        return res.json({
          success: true,
          message: `${autoFormattedDate} ${autoStartTime}-${autoEndTime}로 자동 배치되었습니다!`,
          immediateSwap: true,
          targetDay,
          targetTime: autoStartTime
        });
      }
    }

    // Case 3: Create yield request (target slot is occupied)
    console.log('📍 [smartExchange] Case 3 진입: 타겟 슬롯이 다른 사용자에게 점유됨 (양보 요청 생성)');
    const occupiedUserId = (occupiedSlot.user._id || occupiedSlot.user).toString();

    const yieldRequest = {
      requester: req.user.id,
      type: 'time_change',
      targetUser: occupiedUserId,
      requesterSlots: allSlotsInBlock.map(s => ({
        day: s.day,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        subject: s.subject,
        user: req.user.id
      })),
      timeSlot: {
        day: targetDayEnglish,
        date: targetDate,
        startTime: finalNewStartTime,
        endTime: finalNewEndTime,
        subject: allSlotsInBlock[0]?.subject || '자동 배정',
        user: occupiedUserId
      },
      desiredDay: targetDay,
      desiredTime: finalNewStartTime,
      message: `${targetDate.toISOString().split('T')[0]} ${finalNewStartTime}-${finalNewEndTime}를 양보 요청`,
      status: 'pending',
      createdAt: new Date()
    };

    room.requests.push(yieldRequest);
    await room.save();
    await room.populate('requests.requester', 'firstName lastName email');
    await room.populate('requests.targetUser', 'firstName lastName email');

    const createdRequest = room.requests[room.requests.length - 1];
    const yieldMonth = targetDate.getUTCMonth() + 1;
    const yieldDay = targetDate.getUTCDate();
    const yieldDateFormatted = `${yieldMonth}월 ${yieldDay}일`;
    const requesterName = requesterUser.firstName && requesterUser.lastName
      ? `${requesterUser.firstName} ${requesterUser.lastName}`
      : requesterUser.email;
    const targetUserName = `${occupiedSlot.user.firstName} ${occupiedSlot.user.lastName}`;
    const yieldFirstSlot = allSlotsInBlock[0];
    const yieldLastSlot = allSlotsInBlock[allSlotsInBlock.length - 1];
    const yieldPrevDate = new Date(yieldFirstSlot.date);
    const yieldPrevMonth = yieldPrevDate.getUTCMonth() + 1;
    const yieldPrevDay = yieldPrevDate.getUTCDate();
    const yieldPrevTimeRange = `${yieldFirstSlot.startTime}-${yieldLastSlot.endTime}`;

    await ActivityLog.logActivity(
      room._id,
      req.user.id,
      requesterName,
      'change_request',
      `${requesterName}님(${yieldPrevMonth}월 ${yieldPrevDay}일 ${yieldPrevTimeRange})이 ${targetUserName}님에게 ${yieldDateFormatted} ${finalNewStartTime}-${finalNewEndTime} 양보 요청`,
      {
        prevDate: `${yieldPrevMonth}월 ${yieldPrevDay}일`,
        prevTime: yieldPrevTimeRange,
        targetDate: yieldDateFormatted,
        targetTime: `${finalNewStartTime}-${finalNewEndTime}`,
        requester: requesterName,
        targetUser: targetUserName
      }
    );

    res.json({
      success: true,
      message: `${yieldDateFormatted} ${finalNewStartTime}는 ${occupiedSlot.user.firstName}님이 사용 중입니다. 자리요청관리에 요청을 보냈습니다.`,
      immediateSwap: false,
      needsApproval: true,
      targetDay,
      targetTime: finalNewStartTime,
      occupiedBy: occupiedSlot.user.firstName + ' ' + occupiedSlot.user.lastName,
      requestId: createdRequest._id
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      details: error.message
    });
  }
};

/**
 * 대기 중인 연쇄 교환 요청 조회
 * @route   GET /api/coordination/chain-exchange-requests/pending
 * @access  Private
 */
exports.getPendingChainExchangeRequests = async (req, res) => {
  try {
    // TODO: 연쇄 교환 요청 로직 구현 예정
    // 현재는 빈 배열 반환
    res.json([]);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      details: error.message
    });
  }
};
