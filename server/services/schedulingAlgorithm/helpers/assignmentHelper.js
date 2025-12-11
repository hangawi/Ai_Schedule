/**
 * 배정 관련 헬퍼 함수
 */

const { DAY_MAP, DEFAULT_REQUIRED_SLOTS, AUTO_ASSIGNMENT_SUBJECT, SLOT_STATUS } = require('../constants/schedulingConstants');
const { SLOTS_PER_HOUR, MINUTES_PER_SLOT } = require('../constants/timeConstants');
const { extractDateFromSlotKey, extractTimeFromSlotKey, calculateSlotEndTime, createSlotData } = require('../utils/slotUtils');
const { validateTimeSlotWithTravel } = require('../utils/timeUtils');
const { google } = require('googleapis');
const travelTimeCache = require('../utils/travelTimeCache');

/**
 * 멤버별 assignments 초기화
 * @param {Array} members - 멤버 배열
 * @param {Object} memberRequiredSlots - 멤버별 필요 슬롯 수
 * @returns {Object} 초기화된 assignments 객체
 */
const initializeMemberAssignments = (members, memberRequiredSlots = {}) => {
  const assignments = {};
  members.forEach(m => {
    const memberId = m.user._id.toString();
    assignments[memberId] = {
      memberId: memberId,
      assignedHours: 0,
      requiredSlots: memberRequiredSlots[memberId] || DEFAULT_REQUIRED_SLOTS,
      slots: []
    };
  });
  return assignments;
};

/**
 * 멤버별 필요 슬롯 계산
 * @param {Array} members - 멤버 배열
 * @param {number} minHoursPerWeek - 주당 최소 시간
 * @param {number} actualWeeksInRange - 실제 주 수
 * @returns {Object} 멤버 ID -> 필요 슬롯 수
 */
const calculateMemberRequiredSlots = (members, minHoursPerWeek, actualWeeksInRange = 1) => {
  const memberRequiredSlots = {};
  members.forEach(m => {
    const memberId = m.user._id.toString();
    const carryOverHours = m.carryOver || 0;
    const totalRequiredHours = (minHoursPerWeek * actualWeeksInRange) + carryOverHours;
    memberRequiredSlots[memberId] = totalRequiredHours * SLOTS_PER_HOUR;
  });
  return memberRequiredSlots;
};

/**
 * 타임테이블에 슬롯 배정
 * @param {Object} timetable - 타임테이블 객체
 * @param {Object} assignments - assignments 객체
 * @param {string} key - 슬롯 키
 * @param {string} memberId - 배정할 멤버 ID
 */
const assignSlot = (timetable, assignments, key, memberId) => {
  const lastDashIndex = key.lastIndexOf('-');
  const dateKey = key.substring(0, lastDashIndex);
  const startTimeRaw = key.substring(lastDashIndex + 1);

  if (!timetable[key]) {
    return;
  }

  const endTime = calculateSlotEndTime(startTimeRaw);
  const slotDate = timetable[key].date;
  const slotDayOfWeek = timetable[key].dayOfWeek;

  if (!slotDate || !slotDayOfWeek) {
    return;
  }

  const dayString = DAY_MAP[slotDayOfWeek];
  if (!dayString) {
    return;
  }

  // 타임테이블에 배정 표시
  timetable[key].assignedTo = memberId;

  // assignments 객체 업데이트
  if (!assignments[memberId]) {
    assignments[memberId] = {
      memberId: memberId,
      assignedHours: 0,
      slots: []
    };
  }

  assignments[memberId].assignedHours += 1;

  const slotData = createSlotData({
    date: slotDate,
    dayString,
    startTime: startTimeRaw,
    endTime,
    memberId,
    subject: AUTO_ASSIGNMENT_SUBJECT,
    status: SLOT_STATUS.CONFIRMED
  });

  if (slotData.date && slotData.day && slotData.startTime && slotData.endTime) {
    assignments[memberId].slots.push(slotData);
  }
};

/**
 * 멤버가 필요한 슬롯을 모두 채웠는지 확인
 * @param {Object} assignments - assignments 객체
 * @param {string} memberId - 멤버 ID
 * @param {Object} memberRequiredSlots - 필요 슬롯 정보
 * @returns {boolean}
 */
const isMemberFullyAssigned = (assignments, memberId, memberRequiredSlots) => {
  const requiredSlots = memberRequiredSlots[memberId] || assignments[memberId]?.requiredSlots || DEFAULT_REQUIRED_SLOTS;
  return assignments[memberId].assignedHours >= requiredSlots;
};

/**
 * 미충족 멤버 목록 반환
 * @param {Object} assignments - assignments 객체
 * @param {Object} memberRequiredSlots - 필요 슬롯 정보
 * @param {string} excludeOwnerId - 제외할 방장 ID
 * @returns {Array} 미충족 멤버 ID 배열
 */
const getUnsatisfiedMembers = (assignments, memberRequiredSlots, excludeOwnerId = null) => {
  return Object.keys(assignments).filter(id => {
    if (id === excludeOwnerId) return false;
    return !isMemberFullyAssigned(assignments, id, memberRequiredSlots);
  });
};

/**
 * 자동 배정 처리 (협의 생성 후)
 * @param {Object} assignments - assignments 객체
 * @param {Array} autoAssignments - 자동 배정 목록
 */
const processAutoAssignments = (assignments, autoAssignments) => {
  for (const autoAssign of autoAssignments) {
    const { memberId, dateObj, dayString, startTime, endTime, neededSlots, totalSlots } = autoAssign;

    const [startH, startM] = startTime.split(':').map(Number);
    const slotsToAssign = Math.min(neededSlots, totalSlots);
    const minutesToAssign = slotsToAssign * MINUTES_PER_SLOT;
    const startMinutes = startH * 60 + startM;
    const endMinutes = startMinutes + minutesToAssign;

    for (let currentMin = startMinutes; currentMin < endMinutes; currentMin += MINUTES_PER_SLOT) {
      const slotStart = `${Math.floor(currentMin / 60).toString().padStart(2, '0')}:${(currentMin % 60).toString().padStart(2, '0')}`;
      const slotEnd = `${Math.floor((currentMin + MINUTES_PER_SLOT) / 60).toString().padStart(2, '0')}:${((currentMin + MINUTES_PER_SLOT) % 60).toString().padStart(2, '0')}`;

      if (!assignments[memberId]) {
        assignments[memberId] = { memberId: memberId, assignedHours: 0, slots: [] };
      }

      assignments[memberId].slots.push({
        date: dateObj,
        day: dayString,
        startTime: slotStart,
        endTime: slotEnd,
        subject: AUTO_ASSIGNMENT_SUBJECT,
        user: memberId,
        status: SLOT_STATUS.CONFIRMED
      });
    }
  }
};

/**
 * 기존 슬롯을 assignments에 로드
 * @param {Array} roomTimeSlots - 방 타임슬롯 배열
 * @param {Object} assignments - assignments 객체
 * @param {string} ownerId - 방장 ID
 */
const loadExistingSlots = (roomTimeSlots, assignments, ownerId) => {
  if (!roomTimeSlots || roomTimeSlots.length === 0) return;

  roomTimeSlots.forEach(slot => {
    const slotUserId = slot.user._id ? slot.user._id.toString() : slot.user.toString();
    if (slotUserId === ownerId) return; // 방장 제외

    if (assignments[slotUserId]) {
      assignments[slotUserId].slots.push({
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        subject: slot.subject
      });
      assignments[slotUserId].assignedHours += 1;
    }
  });
};

/**
 * Google Maps Distance Matrix API를 사용하여 이동 시간 계산 (캐싱 포함)
 * @param {Object} origin - 출발지 {lat, lng} 또는 주소 문자열
 * @param {Object} destination - 목적지 {lat, lng} 또는 주소 문자열
 * @param {string} transportMode - 이동 수단 ('public', 'driving', 'walking')
 * @returns {Promise<number>} 이동 시간 (분)
 */
const calculateTravelTime = async (origin, destination, transportMode = 'transit') => {
  try {
    // 좌표 또는 주소 문자열 처리
    const originParam = typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`;
    const destParam = typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`;

    // transportMode 매핑
    const modeMap = {
      'public': 'transit',
      'transit': 'transit',
      'driving': 'driving',
      'bicycling': 'bicycling',
      'walking': 'walking'
    };
    const mode = modeMap[transportMode] || 'transit';

    // 1. 캐시 확인
    const cachedTime = travelTimeCache.get(originParam, destParam, mode);
    if (cachedTime !== null) {
      return cachedTime;
    }

    // 2. API 호출
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API Key가 설정되지 않았습니다.');
      return 60; // 기본값 1시간
    }

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(originParam)}&destinations=${encodeURIComponent(destParam)}&mode=${mode}&key=${apiKey}&language=ko`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.rows || !data.rows[0].elements || !data.rows[0].elements[0]) {
      console.error('Distance Matrix API 응답 오류:', data.status);
      return 60; // 기본값
    }

    const element = data.rows[0].elements[0];
    if (element.status !== 'OK') {
      console.error('경로 찾기 실패:', element.status);
      return 60; // 기본값
    }

    const durationSeconds = element.duration.value;
    const durationMinutes = Math.ceil(durationSeconds / 60);

    // 3. 캐시 저장
    travelTimeCache.set(originParam, destParam, mode, durationMinutes);

    console.log(`🚌 이동시간 계산: ${durationMinutes}분 (${mode}) [API 호출]`);
    return durationMinutes;

  } catch (error) {
    console.error('이동시간 계산 오류:', error);
    return 60; // 오류 시 기본값
  }
};

/**
 * 배치로 여러 목적지까지의 이동 시간 계산 (API 호출 최소화)
 * @param {Object} origin - 출발지 {lat, lng, address}
 * @param {Array} destinations - 목적지 배열 [{lat, lng, address, memberId}]
 * @param {string} transportMode - 이동 수단
 * @returns {Promise<Map>} memberId → travelTime(분) 맵
 */
const calculateTravelTimesBatch = async (origin, destinations, transportMode = 'public') => {
  const results = new Map();

  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API Key가 설정되지 않았습니다.');
      // 기본값으로 채우기
      destinations.forEach(dest => results.set(dest.memberId, 60));
      return results;
    }

    // 좌표 문자열 처리
    const originParam = `${origin.lat},${origin.lng}`;

    // 캐시되지 않은 목적지만 필터링
    const modeMap = {
      'public': 'transit',
      'transit': 'transit',
      'driving': 'driving',
      'bicycling': 'bicycling',
      'walking': 'walking'
    };
    const mode = modeMap[transportMode] || 'transit';

    const uncachedDests = [];
    for (const dest of destinations) {
      const destParam = `${dest.lat},${dest.lng}`;
      const cached = travelTimeCache.get(originParam, destParam, mode);

      if (cached !== null) {
        results.set(dest.memberId, cached);
      } else {
        uncachedDests.push(dest);
      }
    }

    if (uncachedDests.length === 0) {
      console.log(`✅ [배치] 모든 항목 캐시 HIT (${destinations.length}개)`);
      return results;
    }

    // Google Maps API는 최대 25개 목적지까지 지원
    const BATCH_SIZE = 25;

    for (let i = 0; i < uncachedDests.length; i += BATCH_SIZE) {
      const batch = uncachedDests.slice(i, i + BATCH_SIZE);
      const destParams = batch.map(d => `${d.lat},${d.lng}`).join('|');

      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(originParam)}&destinations=${encodeURIComponent(destParams)}&mode=${mode}&key=${apiKey}&language=ko`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.rows && data.rows[0]) {
        const elements = data.rows[0].elements;

        batch.forEach((dest, idx) => {
          if (elements[idx] && elements[idx].status === 'OK') {
            const durationMinutes = Math.ceil(elements[idx].duration.value / 60);
            results.set(dest.memberId, durationMinutes);

            // 캐시 저장
            const destParam = `${dest.lat},${dest.lng}`;
            travelTimeCache.set(originParam, destParam, mode, durationMinutes);
          } else {
            results.set(dest.memberId, 60); // 기본값
          }
        });

        console.log(`🚌 [배치 API] ${batch.length}개 목적지 이동시간 계산 완료`);
      } else {
        // API 오류 시 기본값
        batch.forEach(dest => results.set(dest.memberId, 60));
      }
    }

    console.log(`✅ [배치] 총 ${destinations.length}개 (캐시: ${destinations.length - uncachedDests.length}, API: ${uncachedDests.length})`);
    return results;

  } catch (error) {
    console.error('배치 이동시간 계산 오류:', error);
    // 오류 시 기본값으로 채우기
    destinations.forEach(dest => {
      if (!results.has(dest.memberId)) {
        results.set(dest.memberId, 60);
      }
    });
    return results;
  }
};

/**
 * 후보 학생들을 거리 순으로 정렬 (배치 처리 사용)
 * @param {Object} currentLocation - 현재 위치 {lat, lng, address}
 * @param {Array} candidateMembers - 후보 멤버 배열
 * @param {string} transportMode - 이동 수단
 * @returns {Promise<Array>} 거리 순으로 정렬된 [{member, travelTimeMinutes}] 배열
 */
const sortMembersByDistance = async (currentLocation, candidateMembers, transportMode = 'public') => {
  // 위치 정보가 있는 멤버만 필터링
  const validMembers = candidateMembers.filter(member => {
    const hasLocation = member.user.addressLat && member.user.addressLng;
    if (!hasLocation) {
      console.log(`⚠️ 멤버 ${member.user._id} 위치 정보 없음`);
    }
    return hasLocation;
  });

  if (validMembers.length === 0) {
    return [];
  }

  // 배치 처리용 목적지 배열 생성
  const destinations = validMembers.map(member => ({
    lat: member.user.addressLat,
    lng: member.user.addressLng,
    address: member.user.address,
    memberId: member.user._id.toString()
  }));

  // 배치로 모든 이동시간 계산
  const travelTimes = await calculateTravelTimesBatch(currentLocation, destinations, transportMode);

  // 결과 매핑
  const membersWithDistance = validMembers.map(member => ({
    member,
    travelTimeMinutes: travelTimes.get(member.user._id.toString()) || 60
  }));

  // 거리 순 정렬
  membersWithDistance.sort((a, b) => a.travelTimeMinutes - b.travelTimeMinutes);

  return membersWithDistance;
};

/**
 * 가장 가까우면서 시간이 충족되는 학생 찾기
 * @param {Object} params - 파라미터 객체
 * @param {Object} params.currentLocation - 현재 위치
 * @param {string} params.currentEndTime - 현재 수업 종료 시간
 * @param {Array} params.candidateMembers - 후보 멤버 배열
 * @param {string} params.currentDay - 현재 요일
 * @param {number} params.classDurationMinutes - 수업 시간 (분)
 * @param {string} params.transportMode - 이동 수단
 * @returns {Promise<Object|null>} {member, slot: {startTime, endTime, waitTime}, travelTime} 또는 null
 */
const findNearestMemberWithSufficientTime = async ({
  currentLocation,
  currentEndTime,
  candidateMembers,
  currentDay,
  classDurationMinutes,
  transportMode = 'public',
  roomBlockedTimes = [],  // 추가
  roomExceptions = []     // 추가
}) => {
  // 1. 거리 순으로 정렬
  const sortedMembers = await sortMembersByDistance(currentLocation, candidateMembers, transportMode);

  console.log(`\n📍 [대중교통 모드] 가까운 순서로 ${sortedMembers.length}명 확인`);

  // 2. 각 멤버에 대해 시간 충족 여부 확인
  for (const { member, travelTimeMinutes } of sortedMembers) {
    const memberId = member.user._id.toString();
    const memberName = member.user.displayName || memberId.substring(0, 8);

    // 해당 요일의 선호시간 가져오기
    const daySchedules = member.user.defaultSchedule.filter(s => s.day === currentDay);
    if (daySchedules.length === 0) {
      console.log(`   ⏭️  ${memberName}: ${currentDay} 선호시간 없음`);
      continue;
    }

    // 개인시간 가져오기
    const personalTimes = member.user.personalTimes || [];

    // 각 선호시간 범위에 대해 확인
    for (const schedule of daySchedules) {
      const preferenceStart = schedule.startTime;
      const preferenceEnd = schedule.endTime;

      const validation = validateTimeSlotWithTravel(
        currentEndTime,
        travelTimeMinutes,
        classDurationMinutes,
        preferenceStart,
        preferenceEnd,
        personalTimes,
        currentDay,
        roomBlockedTimes,  // 추가
        roomExceptions     // 추가
      );

      if (validation.isValid) {
        console.log(`   ✅ ${memberName}: 이동 ${travelTimeMinutes}분 → ${validation.slot.startTime}-${validation.slot.endTime}`);
        if (validation.slot.waitTime > 0) {
          console.log(`      (대기시간 ${validation.slot.waitTime}분 - 예외시간 이후 배정)`);
        }

        return {
          member,
          slot: validation.slot,
          travelTimeMinutes
        };
      } else {
        console.log(`   ❌ ${memberName}: ${validation.reason}`);
      }
    }
  }

  console.log(`   → 조건 충족하는 멤버 없음 (다음 날로 이월)`);
  return null;
};

module.exports = {
  initializeMemberAssignments,
  calculateMemberRequiredSlots,
  assignSlot,
  isMemberFullyAssigned,
  getUnsatisfiedMembers,
  processAutoAssignments,
  loadExistingSlots,
  calculateTravelTime,
  calculateTravelTimesBatch,
  sortMembersByDistance,
  findNearestMemberWithSufficientTime
};
