/**
 * 협의 관련 헬퍼 함수
 */

const { DAY_MAP, NEGOTIATION_TYPES, NEGOTIATION_STATUS, MEMBER_RESPONSE_STATUS } = require('../constants/schedulingConstants');
const { getMemberPriority, findMemberById } = require('./memberHelper');

/**
 * 협의 타입 결정
 * @param {Array} unsatisfiedMembers - 미충족 멤버 배열
 * @param {number} totalNeeded - 총 필요 슬롯
 * @param {number} totalSlots - 총 가용 슬롯
 * @returns {string} 협의 타입
 */
const determineNegotiationType = (unsatisfiedMembers, totalNeeded, totalSlots) => {
  // 모든 멤버가 같은 원래 필요량인지 확인
  const allNeedSameOriginalAmount = unsatisfiedMembers.every(m =>
    m.originallyNeededSlots === unsatisfiedMembers[0].originallyNeededSlots
  );

  if (allNeedSameOriginalAmount) {
    const originalNeededPerMember = unsatisfiedMembers[0].originallyNeededSlots;
    const numberOfOptions = totalSlots - originalNeededPerMember + 1;

    if (numberOfOptions >= 2) {
      return NEGOTIATION_TYPES.TIME_SLOT_CHOICE;
    }
  }

  if (totalNeeded === totalSlots && unsatisfiedMembers.length === 2) {
    return NEGOTIATION_TYPES.PARTIAL_CONFLICT;
  }

  return NEGOTIATION_TYPES.FULL_CONFLICT;
};

/**
 * 협의 객체 생성
 * @param {Object} params - 파라미터
 * @returns {Object} 협의 객체
 */
const createNegotiation = ({
  type,
  block,
  unsatisfiedMembers,
  memberTimeSlotOptions,
  availableTimeSlots,
  nonOwnerMembers,
  ownerId,
  startDate
}) => {
  const dayString = DAY_MAP[block.dayOfWeek];
  const unsatisfiedMemberIds = unsatisfiedMembers.map(m => m.memberId);

  return {
    type: type,
    availableTimeSlots: availableTimeSlots,
    memberSpecificTimeSlots: memberTimeSlotOptions || {},
    slotInfo: {
      day: dayString,
      startTime: block.startTime,
      endTime: block.endTime,
      date: block.dateObj
    },
    conflictingMembers: unsatisfiedMembers.map(m => {
      const member = findMemberById(nonOwnerMembers, m.memberId);
      return {
        user: m.memberId,
        priority: member ? getMemberPriority(member) : 3,
        requiredSlots: m.neededSlots,
        response: MEMBER_RESPONSE_STATUS.PENDING
      };
    }),
    participants: [...unsatisfiedMemberIds, ownerId],
    messages: [],
    status: NEGOTIATION_STATUS.ACTIVE,
    weekStartDate: startDate.toISOString().split('T')[0],
    createdAt: new Date()
  };
};

/**
 * 멤버별 시간대 옵션 생성 (time_slot_choice 협의용)
 * @param {Array} unsatisfiedMembers - 미충족 멤버 배열
 * @param {Object} block - 충돌 블록
 * @param {Object} timetable - 타임테이블
 * @param {number} requiredDuration - 필요한 기간(분)
 * @returns {Object} 멤버별 시간대 옵션
 */
const generateMemberTimeSlotOptions = (unsatisfiedMembers, block, timetable, requiredDuration) => {
  const memberTimeSlotOptions = {};
  const [startH, startM] = block.startTime.split(':').map(Number);
  const [endH, endM] = block.endTime.split(':').map(Number);
  const blockStartMinutes = startH * 60 + startM;
  const blockEndMinutes = endH * 60 + endM;

  for (const member of unsatisfiedMembers) {
    const memberId = member.memberId;
    const memberAvailableSlots = [];

    // 블록 내 각 30분 슬롯 확인
    let currentMinutes = blockStartMinutes;
    while (currentMinutes < blockEndMinutes) {
      const slotH = Math.floor(currentMinutes / 60);
      const slotM = currentMinutes % 60;
      const slotTime = `${String(slotH).padStart(2, '0')}:${String(slotM).padStart(2, '0')}`;
      const slotKey = `${block.startDate}-${slotTime}`;

      // 해당 멤버가 이 슬롯을 사용 가능한지 확인
      if (timetable[slotKey] && timetable[slotKey].available) {
        const memberAvailable = timetable[slotKey].available.find(a => a.memberId === memberId);
        if (memberAvailable) {
          memberAvailableSlots.push(currentMinutes);
        }
      }

      currentMinutes += 30;
    }

    // 연속된 슬롯에서 옵션 생성
    const memberOptions = generateOptionsFromAvailableSlots(memberAvailableSlots, requiredDuration);
    memberTimeSlotOptions[memberId] = memberOptions;
  }

  return memberTimeSlotOptions;
};

/**
 * 가용 슬롯에서 시간대 옵션 생성
 * @param {Array} availableSlots - 가용 슬롯 (분 단위) 배열
 * @param {number} requiredDuration - 필요한 기간(분)
 * @returns {Array} 시간대 옵션 배열
 */
const generateOptionsFromAvailableSlots = (availableSlots, requiredDuration) => {
  const sortedSlots = [...availableSlots].sort((a, b) => a - b);
  const consecutiveRanges = [];
  let currentRange = [];

  // 연속된 슬롯 범위 추출
  for (let i = 0; i < sortedSlots.length; i++) {
    const currentMin = sortedSlots[i];

    if (currentRange.length === 0) {
      currentRange.push(currentMin);
    } else {
      const lastMin = currentRange[currentRange.length - 1];
      if (currentMin - lastMin === 30) {
        currentRange.push(currentMin);
      } else {
        if (currentRange.length > 0) {
          consecutiveRanges.push([...currentRange]);
        }
        currentRange = [currentMin];
      }
    }
  }
  if (currentRange.length > 0) {
    consecutiveRanges.push(currentRange);
  }

  // 각 연속 범위에서 옵션 생성
  const options = [];
  for (const range of consecutiveRanges) {
    const rangeStartMinutes = range[0];
    const rangeEndMinutes = range[range.length - 1] + 30;

    // 1시간 단위로 슬라이딩
    for (let startMinutes = rangeStartMinutes; startMinutes + requiredDuration <= rangeEndMinutes; startMinutes += 60) {
      // 정시(00분)가 아니면 건너뛰기
      if (startMinutes % 60 !== 0) continue;

      const endMinutes = startMinutes + requiredDuration;

      // 구간이 범위 내에 있는지 확인
      let isValidRange = true;
      for (let checkMin = startMinutes; checkMin < endMinutes; checkMin += 30) {
        if (!range.includes(checkMin)) {
          isValidRange = false;
          break;
        }
      }

      if (isValidRange) {
        const optionStart = `${String(Math.floor(startMinutes / 60)).padStart(2, '0')}:${String(startMinutes % 60).padStart(2, '0')}`;
        const optionEnd = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

        // 중복 방지
        const isDuplicate = options.some(opt => opt.startTime === optionStart && opt.endTime === optionEnd);
        if (!isDuplicate) {
          options.push({ startTime: optionStart, endTime: optionEnd });
        }
      }
    }
  }

  return options;
};

/**
 * 모든 멤버의 시간대 옵션을 합집합으로 생성
 * @param {Object} memberTimeSlotOptions - 멤버별 시간대 옵션
 * @returns {Array} 합집합 시간대 옵션 배열
 */
const mergeAllTimeSlotOptions = (memberTimeSlotOptions) => {
  const allOptionsSet = new Set();

  for (const memberId in memberTimeSlotOptions) {
    memberTimeSlotOptions[memberId].forEach(option => {
      const key = `${option.startTime}-${option.endTime}`;
      allOptionsSet.add(key);
    });
  }

  return Array.from(allOptionsSet).map(key => {
    const [startTime, endTime] = key.split('-');
    return { startTime, endTime };
  }).sort((a, b) => a.startTime.localeCompare(b.startTime));
};

module.exports = {
  determineNegotiationType,
  createNegotiation,
  generateMemberTimeSlotOptions,
  generateOptionsFromAvailableSlots,
  mergeAllTimeSlotOptions
};
