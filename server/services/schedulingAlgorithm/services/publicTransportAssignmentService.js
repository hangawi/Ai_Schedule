/**
 * 대중교통 모드 - 최단거리 우선 배정 서비스
 *
 * 한 학생의 수업이 끝나면 가장 가까운 학생에게 이동하여 배정하는 전략.
 * 이동시간 + 수업시간이 선호시간 내에 모두 들어가야 하며,
 * 예외시간(점심, 저녁 등) 충돌 시 예외시간 이후로 자동 이동.
 */

const { findNearestMemberWithSufficientTime } = require('../helpers/assignmentHelper');
const { assignSlot } = require('../helpers/assignmentHelper');
const { DAY_MAP, DEFAULT_REQUIRED_SLOTS } = require('../constants/schedulingConstants');
const { timeToMinutes, minutesToTime } = require('../utils/timeUtils');
const { SLOTS_PER_HOUR, MINUTES_PER_SLOT } = require('../constants/timeConstants');
const { isTimeInBlockedRange } = require('../validators/prohibitedTimeValidator');

/**
 * 대중교통 모드로 순차 배정
 * @param {Object} timetable - 타임테이블
 * @param {Object} assignments - 배정 객체
 * @param {Object} memberRequiredSlots - 멤버별 필요 슬롯
 * @param {string} ownerId - 방장 ID
 * @param {Array} members - 전체 멤버 배열
 * @param {Object} options - 옵션
 * @returns {void}
 */
const assignByPublicTransport = async (
  timetable,
  assignments,
  memberRequiredSlots,
  ownerId,
  members,
  owner,      // 추가: 방장 객체
  options = {}
) => {
  const {
    transportMode = 'public',
    minClassDurationMinutes = 60, // 최소 수업 시간 (기본 1시간)
    roomBlockedTimes = [],  // 추가
    roomExceptions = []     // 추가
  } = options;

  console.log('\n🚌 ===== 대중교통 모드 배정 시작 =====');
  console.log(`   이동수단: ${transportMode}, 최소 수업시간: ${minClassDurationMinutes}분`);

  // 모든 슬롯을 날짜/시간 순으로 정렬
  const sortedKeys = Object.keys(timetable).sort();
  if (sortedKeys.length === 0) {
    console.log('   → 배정 가능한 슬롯 없음');
    return;
  }

  // 각 요일별로 처리
  const slotsByDay = {};
  sortedKeys.forEach(key => {
    const slot = timetable[key];
    const day = slot.dayOfWeek;
    if (!slotsByDay[day]) {
      slotsByDay[day] = [];
    }
    slotsByDay[day].push(key);
  });

  // 요일별 순차 배정
  for (const [dayOfWeek, daySlotKeys] of Object.entries(slotsByDay)) {
    console.log(`\n📅 [${DAY_MAP[dayOfWeek]}] 배정 시작`);

    // 아직 배정되지 않은 멤버 목록
    let unassignedMembers = members.filter(m => {
      const memberId = m.user._id.toString();
      if (memberId === ownerId) return false;
      const assigned = assignments[memberId]?.assignedHours || 0;
      const required = memberRequiredSlots[memberId] || DEFAULT_REQUIRED_SLOTS;
      return assigned < required;
    });

    if (unassignedMembers.length === 0) {
      console.log('   → 모든 멤버 배정 완료');
      continue;
    }

    // 첫 번째 학생은 가장 이른 시간에 배정 (방장 위치 기준)
    // owner는 파라미터로 전달받음
    if (!owner || !owner.user?.addressLat || !owner.user?.addressLng) {
      console.log('   ⚠️  방장 위치 정보 없음 - 대중교통 모드 사용 불가');
      return;
    }

    let currentLocation = {
      lat: owner.user.addressLat,
      lng: owner.user.addressLng,
      address: owner.user.address
    };
    let currentEndTime = null;

    // Bug 6 수정: 첫 번째 배정 전, 방장 위치 기준으로 멤버 거리 순 정렬
    console.log(`
📍 [초기화] 방장 위치 기준 거리 순 정렬`);
    const { sortMembersByDistance } = require('../helpers/assignmentHelper');

    const initialSorted = await sortMembersByDistance(
      currentLocation,
      unassignedMembers,
      transportMode
    );

    // 거리 순으로 재정렬
    unassignedMembers = initialSorted.map(item => item.member);

    console.log(`   정렬 결과:`);
    initialSorted.forEach((item, idx) => {
      const name = item.member.user.displayName || item.member.user._id.toString().substring(0, 8);
      console.log(`   ${idx + 1}. ${name}: ${item.travelTimeMinutes}분`);
    });

    // 순차적으로 가장 가까운 멤버 찾아서 배정
    while (unassignedMembers.length > 0) {
      const result = await findNearestMemberWithSufficientTime({
        currentLocation,
        currentEndTime: currentEndTime || '09:00', // 첫 배정은 09:00부터
        candidateMembers: unassignedMembers,
        currentDay: DAY_MAP[dayOfWeek],
        classDurationMinutes: minClassDurationMinutes,
        transportMode,
        roomBlockedTimes,  // 추가
        roomExceptions     // 추가
      });

      if (!result) {
        // 조건 충족하는 멤버 없음 - 다음 날로
        console.log(`   → [${DAY_MAP[dayOfWeek]}] 더 이상 배정 불가, 다음 요일로 이동`);
        break;
      }

      const { member, slot, travelTimeMinutes } = result;
      const memberId = member.user._id.toString();
      const memberName = member.user.displayName || memberId.substring(0, 8);

      // 배정 슬롯 생성 및 할당
      const assignedSlots = await assignTimeSlot(
        timetable,
        assignments,
        memberId,
        dayOfWeek,
        slot.startTime,
        slot.endTime,
        daySlotKeys,
        roomBlockedTimes  // 방 금지시간 전달
      );

      if (assignedSlots > 0) {
        const travelInfo = slot.travelStartTime ? ` (이동: ${slot.travelStartTime}-${slot.travelEndTime})` : '';
        console.log(`   ✅ ${memberName} 배정 완료: ${slot.startTime}-${slot.endTime}${travelInfo} (${assignedSlots}슬롯)`);

        // 현재 위치를 이 멤버 위치로 업데이트
        currentLocation = {
          lat: member.user.addressLat,
          lng: member.user.addressLng,
          address: member.user.address
        };
        currentEndTime = slot.endTime;

        // 이 멤버가 필요량을 채웠는지 확인
        const assigned = assignments[memberId]?.assignedHours || 0;
        const required = memberRequiredSlots[memberId] || DEFAULT_REQUIRED_SLOTS;
        if (assigned >= required) {
          // 완료된 멤버는 목록에서 제거
          unassignedMembers = unassignedMembers.filter(m => m.user._id.toString() !== memberId);
          console.log(`      → ${memberName} 필요량 충족 (${assigned}/${required}슬롯)`);
        }
      } else {
        console.log(`   ⚠️  ${memberName} 슬롯 배정 실패`);
        // 배정 실패한 멤버는 목록에서 제거 (무한루프 방지)
        unassignedMembers = unassignedMembers.filter(m => m.user._id.toString() !== memberId);
      }
    }
  }

  console.log('\n🚌 ===== 대중교통 모드 배정 완료 =====');
};

/**
 * 시간 슬롯 배정 (30분 단위로 분할하여 타임테이블에 배정)
 * @param {Object} timetable - 타임테이블
 * @param {Object} assignments - 배정 객체
 * @param {string} memberId - 멤버 ID
 * @param {number} dayOfWeek - 요일 (0-6)
 * @param {string} startTime - 시작 시간 (HH:MM)
 * @param {string} endTime - 종료 시간 (HH:MM)
 * @param {Array} daySlotKeys - 해당 요일의 슬롯 키 배열
 * @returns {Promise<number>} 배정된 슬롯 수
 */
const assignTimeSlot = async (
  timetable,
  assignments,
  memberId,
  dayOfWeek,
  startTime,
  endTime,
  daySlotKeys,
  roomBlockedTimes = []  // 추가: 방 금지시간
) => {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  let assignedCount = 0;

  // 17-24시 절대 금지시간 추가
  const absoluteBlockedTime = {
    name: '17-24시 절대 금지시간',
    startTime: '17:00',
    endTime: '24:00'
  };
  const allBlockedTimes = [...(roomBlockedTimes || []), absoluteBlockedTime];

  // 30분 단위로 슬롯 찾아서 배정
  for (let currentMinutes = startMinutes; currentMinutes < endMinutes; currentMinutes += MINUTES_PER_SLOT) {
    const slotTime = minutesToTime(currentMinutes);

    // 해당 시간의 슬롯 키 찾기
    const slotKey = daySlotKeys.find(key => {
      const keyTime = key.split('-').pop();
      return keyTime === slotTime;
    });

    if (!slotKey) {
      console.log(`      ⚠️  슬롯 키 없음: ${slotTime}`);
      continue;
    }

    const slot = timetable[slotKey];
    if (!slot) {
      console.log(`      ⚠️  슬롯 데이터 없음: ${slotKey}`);
      continue;
    }

    if (slot.assignedTo) {
      console.log(`      ⚠️  이미 배정된 슬롯: ${slotTime}`);
      continue;
    }

    // 멤버가 이 슬롯을 사용 가능한지 확인
    const canUse = slot.available.some(a => a.memberId === memberId && !a.isOwner);
    if (!canUse) {
      console.log(`      ⚠️  사용 불가 슬롯: ${slotTime}`);
      continue;
    }

    // 🔒 금지시간 검증 (17-24시 포함)
    const slotStartTime = slotTime;
    const slotStartMinutes = timeToMinutes(slotStartTime);
    const slotEndMinutes = slotStartMinutes + MINUTES_PER_SLOT;
    const slotEndTime = minutesToTime(slotEndMinutes);

    const blockedTime = isTimeInBlockedRange(slotStartTime, slotEndTime, allBlockedTimes);
    if (blockedTime) {
      console.log(`      ❌ [금지시간 침범] ${slotStartTime}-${slotEndTime}이(가) ${blockedTime.name || '금지 시간'}(${blockedTime.startTime}-${blockedTime.endTime})과 겹침`);
      continue; // 금지시간을 침범하는 슬롯은 건너뜀
    }

    // 슬롯 배정
    assignSlot(timetable, assignments, slotKey, memberId);
    assignedCount++;
  }

  return assignedCount;
};;

module.exports = {
  assignByPublicTransport
};
