// 이동 모드 서비스
const { isTimeInBlockedRange } = require('../../../services/schedulingAlgorithm/validators/prohibitedTimeValidator');
const { VALIDATION_RULES } = require('../constants/validationRules');
const { timeToMinutes, minutesToTime } = require('../utils/timeUtils');

/**
 * 연속된 슬롯 병합 (복잡한 병합 로직)
 * @param {Array} slots - 슬롯 배열
 * @returns {Array} 병합된 슬롯
 */
const mergeConsecutiveClassSlots = (slots) => {
  if (slots.length === 0) return [];

  // 날짜/사용자/시작시간 순으로 정렬
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

    // 병합 조건: 같은 user, 같은 날짜, 같은 subject, 연속된 시간
    if (
      currentUserId === nextUserId &&
      currentDate === nextDate &&
      current.subject === next.subject &&
      current.endTime === next.startTime
    ) {
      // 연속된 슬롯이므로 endTime만 업데이트
      current.endTime = next.endTime;
      // originalEndTime도 업데이트 (있는 경우)
      if (next.originalEndTime) {
        current.originalEndTime = next.originalEndTime;
      }
    } else {
      // 연속되지 않으므로 현재 슬롯을 저장하고 새로운 슬롯 시작
      merged.push(current);
      current = { ...next };
    }
  }

  // 마지막 슬롯 추가
  merged.push(current);

  return merged;
};

/**
 * 금지시간 검증 및 자동 보정
 * @param {Object} room - 방 객체
 * @returns {number} 침범 카운트
 */
const validateAndCorrectBlockedTimes = (room) => {
  const blockedTimes = room.settings?.blockedTimes || [];

  if (blockedTimes.length === 0) {
    console.log(`✅ [금지시간 검증] 침범 없음`);
    return 0;
  }

  console.log('🔒 [금지시간 검증] 시작...');
  let violationCount = 0;

  for (let idx = 0; idx < room.timeSlots.length; idx++) {
    const slot = room.timeSlots[idx];

    if (slot.adjustedForTravelTime) {
      const blockedTime = isTimeInBlockedRange(slot.startTime, slot.endTime, blockedTimes);

      if (blockedTime) {
        violationCount++;
        console.log(`   ⚠️ [침범 감지 ${idx}] ${slot.subject} (${slot.startTime}-${slot.endTime})이(가) ${blockedTime.name || '금지 시간'}(${blockedTime.startTime}-${blockedTime.endTime})과 겹침`);

        // 금지시간 이후로 이동 (자동 보정)
        const blockedEndMinutes = timeToMinutes(blockedTime.endTime);
        const slotDuration = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
        const newStartMinutes = blockedEndMinutes;
        const newEndMinutes = blockedEndMinutes + slotDuration;

        const correctedStart = minutesToTime(newStartMinutes);
        const correctedEnd = minutesToTime(newEndMinutes);

        console.log(`   🔧 [자동 보정] ${slot.startTime}-${slot.endTime} → ${correctedStart}-${correctedEnd}`);

        slot.startTime = correctedStart;
        slot.endTime = correctedEnd;
      }
    }
  }

  if (violationCount > 0) {
    console.log(`⚠️ [금지시간 검증] 총 ${violationCount}개 침범 감지 및 자동 보정 완료`);
  } else {
    console.log(`✅ [금지시간 검증] 침범 없음`);
  }

  return violationCount;
};

/**
 * 일반 모드 적용 (원본 복원)
 * @param {Object} room - 방 객체
 */
const applyNormalMode = (room) => {
  // 🔄 일반 모드로 복원: originalTimeSlots이 있으면 복원
  if (room.originalTimeSlots && room.originalTimeSlots.length > 0) {
    console.log(`   [복원] originalTimeSlots → timeSlots (${room.originalTimeSlots.length}개)`);
    room.timeSlots = room.originalTimeSlots;
    room.originalTimeSlots = [];
  }
  // ✅ 이동시간 슬롯도 비우기 (일반 모드는 이동시간 없음)
  room.travelTimeSlots = [];
  console.log(`   [복원] travelTimeSlots 비움`);
};

/**
 * 이동시간 슬롯 매핑 및 저장
 * @param {Object} room - 방 객체
 * @param {Array} receivedTravelSlots - 수신된 이동시간 슬롯
 * @param {string} travelMode - 이동 모드
 */
const mapAndSaveTravelSlots = (room, receivedTravelSlots, travelMode) => {
  room.travelTimeSlots = receivedTravelSlots.map(e => {
    const dateObj = e.date instanceof Date ? e.date : new Date(e.date);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = dayNames[dateObj.getDay()];  // Date 객체에서 요일 추출

    // 사용자 ID 추출 (e.user 또는 room.owner)
    const userId = e.user?._id || e.user || room.owner._id;

    // ✅ 조원 색상 가져오기
    let userColor = e.color;  // 클라이언트에서 계산한 색상이 있으면 사용
    if (!userColor) {
      // 없으면 room.members에서 찾기
      userColor = room.getUserColor(userId);
    }

    return {
      user: userId,
      date: dateObj,
      day: e.day || dayOfWeek,  // day 필드가 있으면 사용, 없으면 계산
      startTime: e.startTime,
      endTime: e.endTime,
      subject: '이동시간',
      type: 'travel',
      color: userColor,                  // ✅ 색상
      from: e.from,                      // ✅ 출발지
      to: e.to,                          // ✅ 도착지
      travelMode: e.travelMode || travelMode,  // ✅ 이동수단
      travelInfo: e.travelInfo           // ✅ 거리/시간 정보
    };
  });

  console.log(`   [이동시간 저장] ${room.travelTimeSlots.length}개 슬롯 (병합됨, 10분 단위 아님)`);
};

/**
 * 수업시간 슬롯 적용 (이동시간 포함)
 * @param {Object} room - 방 객체
 * @param {Array} receivedTimeSlots - 수신된 수업시간 슬롯
 */
const applyClassTimeSlots = (room, receivedTimeSlots) => {
  // ⚠️ Phase 3: 수업시간 슬롯만 저장 (이동시간 제외)
  // 이동시간 슬롯은 제외하고, 순수 수업시간만 저장

  // 🔧 Step 3-1: 이동시간이 아닌 슬롯만 필터링
  const classTimeSlots = receivedTimeSlots.filter(e => !e.isTravel && e.subject !== '이동시간');

  // 🔧 Step 3-2: 연속된 슬롯 병합
  const mergedSlots = mergeConsecutiveClassSlots(classTimeSlots);
  console.log(`   🔧 슬롯 병합: ${classTimeSlots.length}개 → ${mergedSlots.length}개`);

  // 🔧 Step 3-3: 병합된 슬롯을 DB 형식으로 변환
  room.timeSlots = mergedSlots.map((e, idx) => {
    // ✅ 이동시간이 반영된 수업시간 사용
    const adjustedStartTime = e.startTime;
    const adjustedEndTime = e.endTime;

    const newSlot = {
      user: e.user._id || e.user,
      date: e.date instanceof Date ? e.date : new Date(e.date),
      day: e.day,
      startTime: adjustedStartTime,  // ✅ 이동시간이 반영된 시작 시간
      endTime: adjustedEndTime,      // ✅ 이동시간이 반영된 종료 시간
      subject: e.subject || '자동 배정',
      assignedBy: room.owner._id,
      status: 'confirmed',
      // 🆕 클라이언트에서 넘겨준 메타데이터 보존
      adjustedForTravelTime: e.adjustedForTravelTime || false,
      originalStartTime: e.originalStartTime,
      originalEndTime: e.originalEndTime,
      actualStartTime: e.actualStartTime,  // 이동시간 포함 시작
      travelTimeBefore: e.travelTimeBefore // 이동시간(분)
    };

    if (idx < 5) {
      console.log(`   [적용 ${idx}] ${e.subject}: ${adjustedStartTime}-${adjustedEndTime} (이동전 시작: ${e.actualStartTime || '없음'})`);
    }

    return newSlot;
  });

  console.log(`   ✅ timeSlots 교체 완료: ${room.timeSlots.length}개 (이동시간 슬롯 제외)`);
};

/**
 * 이동 모드 적용 (전체 로직)
 * @param {Object} room - 방 객체
 * @param {Object} enhancedSchedule - 향상된 스케줄 (timeSlots, travelSlots)
 * @param {string} travelMode - 이동 모드
 * @returns {Promise<Object>} 업데이트된 방
 */
const applyTravelModeToRoom = async (room, enhancedSchedule, travelMode) => {
  console.log(`📌 [applyTravelMode] 시작 - 방: ${room._id}, 모드: ${travelMode}`);

  // enhancedSchedule 검증 (객체 형태로 변경)
  const receivedTimeSlots = enhancedSchedule?.timeSlots || (Array.isArray(enhancedSchedule) ? enhancedSchedule : null);
  const receivedTravelSlots = enhancedSchedule?.travelSlots || enhancedSchedule?.travelTimeSlots || [];

  console.log(`🔥🔥🔥 [applyTravelMode] 수신된 데이터 확인:`);
  console.log(`   - travelMode: ${travelMode}`);
  console.log(`   - timeSlots: ${receivedTimeSlots?.length}개`);
  console.log(`   - travelSlots: ${receivedTravelSlots?.length}개`);

  if (!receivedTimeSlots || !Array.isArray(receivedTimeSlots)) {
    throw new Error('enhancedSchedule.timeSlots이 필요합니다.');
  }

  console.log(`✅ [applyTravelMode] 수신 데이터:`, {
    timeSlots개수: receivedTimeSlots.length,
    travelSlots개수: receivedTravelSlots.length
  });
  console.log(`📋 [디버깅] receivedTimeSlots 첫 5개:`, receivedTimeSlots.slice(0, 5).map(e => ({
    user: e.user?._id?.toString() || e.user?.toString() || e.user,
    date: e.date instanceof Date ? e.date.toISOString().split('T')[0] : e.date,
    subject: e.subject,
    startTime: e.startTime,
    endTime: e.endTime,
    originalStartTime: e.originalStartTime,
    isTravel: e.isTravel
  })));

  console.log(`📋 [디버깅] room.timeSlots 첫 3개:`, room.timeSlots.slice(0, 3).map(s => ({
    user: s.user?._id?.toString() || s.user?.toString(),
    date: s.date.toISOString().split('T')[0],
    subject: s.subject,
    startTime: s.startTime,
    endTime: s.endTime,
    originalStartTime: s.originalStartTime
  })));

  // timeSlots 업데이트
  if (travelMode === 'normal') {
    applyNormalMode(room);
  } else {
    // 🚗 이동시간 모드: enhancedSchedule로 완전 교체

    // 원본 저장 (첫 적용 시에만)
    if (!room.originalTimeSlots || room.originalTimeSlots.length === 0) {
      room.originalTimeSlots = JSON.parse(JSON.stringify(room.timeSlots));
      console.log(`   [원본 저장] ${room.originalTimeSlots.length}개 슬롯 백업`);
    }

    console.log(`   [수신 데이터] timeSlots: ${receivedTimeSlots.length}개, travelSlots: ${receivedTravelSlots.length}개`);

    // ✨ 병합된 이동시간 슬롯을 travelTimeSlots에 저장
    mapAndSaveTravelSlots(room, receivedTravelSlots, travelMode);

    // 수업시간 슬롯 적용
    applyClassTimeSlots(room, receivedTimeSlots);
  }

  // 🔒 금지시간 검증 (Step 4)
  if (travelMode !== 'normal') {
    validateAndCorrectBlockedTimes(room);
  }

  // currentTravelMode 설정
  room.currentTravelMode = travelMode;

  // 🔍 디버깅: 저장 직전 데이터 확인
  console.log(`🔍 [저장 직전] room.timeSlots 첫 3개:`, room.timeSlots.slice(0, 3).map(s => ({
    startTime: s.startTime,
    endTime: s.endTime,
    subject: s.subject
  })));

  // 저장 (VersionError 재시도 포함)
  await saveRoomWithRetry(room);

  console.log(`✅ [applyTravelMode] 완료 - ${travelMode} 모드 적용`);
  console.log(`📋 [저장 완료] travelTimeSlots: ${room.travelTimeSlots?.length || 0}개 저장됨`);

  // 🔍 디버깅: 저장된 timeSlots 검증
  console.log('📊 [저장 후 검증] 첫 5개 슬롯:');
  room.timeSlots.slice(0, 5).forEach((slot, idx) => {
    console.log(`  [${idx}] ${slot.subject}:`, {
      user: slot.user._id || slot.user,
      date: slot.date,
      originalStart: slot.originalStartTime,
      adjustedStart: slot.startTime,
      originalEnd: slot.originalEndTime,
      adjustedEnd: slot.endTime,
      isAdjusted: slot.adjustedForTravelTime || false
    });
  });

  return room;
};

/**
 * 재시도가 포함된 방 저장
 * @param {Object} room - 방 객체
 * @returns {Promise<Object>} 저장된 방
 */
const saveRoomWithRetry = async (room) => {
  const Room = require('../../../models/room');
  const maxRetries = VALIDATION_RULES.MAX_RETRIES;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await room.save();

      // 🔍 디버깅: 저장 직후 메모리 확인
      console.log(`🔍 [저장 직후 - 메모리] room.timeSlots 첫 3개:`, room.timeSlots.slice(0, 3).map(s => ({
        startTime: s.startTime,
        endTime: s.endTime,
        subject: s.subject
      })));

      // 🔍 디버깅: DB에서 다시 읽어서 확인
      const verifyRoom = await Room.findById(room._id);
      console.log(`🔍 [저장 직후 - DB 재조회] timeSlots 첫 3개:`, verifyRoom.timeSlots.slice(0, 3).map(s => ({
        startTime: s.startTime,
        endTime: s.endTime,
        subject: s.subject
      })));

      return room; // 성공하면 루프 종료
    } catch (error) {
      if (error.name === 'VersionError' && attempt < maxRetries) {
        console.log(`⚠️ VersionError 발생, 재시도 중 (${attempt}/${maxRetries})...`);
        // 최신 버전 다시 조회
        const freshRoom = await Room.findById(room._id);
        if (freshRoom) {
          // 변경사항 다시 적용
          freshRoom.timeSlots = room.timeSlots;
          freshRoom.originalTimeSlots = room.originalTimeSlots;
          freshRoom.travelTimeSlots = room.travelTimeSlots;
          freshRoom.currentTravelMode = room.currentTravelMode;
          room = freshRoom;
        }
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      } else {
        throw error; // 재시도 횟수 초과 또는 다른 에러
      }
    }
  }
};

/**
 * 이동 모드 확정
 * @param {Object} room - 방 객체
 * @param {string} travelMode - 이동 모드
 * @returns {Promise<Object>} 확정된 방
 */
const confirmTravelModeForRoom = async (room, travelMode) => {
  console.log(`📌 [confirmTravelMode] 시작 - 방: ${room._id}, 모드: ${travelMode}`);

  // 전달받은 travelMode를 confirmedTravelMode로 설정
  // ⚠️ 주의: confirmedAt은 confirmSchedule에서만 설정해야 함!
  // confirmTravelMode는 이동 모드만 확정하는 것이지, 스케줄을 확정하는 것이 아님
  const previousConfirmedMode = room.confirmedTravelMode;
  room.confirmedTravelMode = travelMode;
  room.currentTravelMode = travelMode; // currentTravelMode도 동기화
  // room.confirmedAt은 여기서 설정하지 않음!

  await room.save();

  console.log(`✅ [confirmTravelMode] ${previousConfirmedMode || 'null'} → ${room.confirmedTravelMode} 확정 완료`);

  return { previousMode: previousConfirmedMode, currentMode: travelMode };
};

module.exports = {
  applyTravelModeToRoom,
  confirmTravelModeForRoom,
  mergeConsecutiveClassSlots,
  validateAndCorrectBlockedTimes,
  applyNormalMode,
  mapAndSaveTravelSlots,
  applyClassTimeSlots,
  saveRoomWithRetry,
};
