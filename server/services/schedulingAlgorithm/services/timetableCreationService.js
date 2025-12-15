/**
 * 타임테이블 생성 서비스
 */

const { DEFAULT_SCHEDULE_START_TIME, DEFAULT_SCHEDULE_END_TIME } = require('../constants/timeConstants');
const { generateTimeSlots, createSlotKey } = require('../utils/slotUtils');
const { getHourFromSettings } = require('../utils/timeUtils');
const { convertToOneIndexedDay } = require('../utils/dateUtils');
const { filterValidSchedules, isWeekendDay, isScheduleApplicableToDate } = require('../validators/scheduleValidator');
const { addOrUpdateSlot, addMemberAvailability, removeMemberFromSlot, createOwnerAvailableSlots, removeOwnerPersonalTimes, removeBlockedTimes } = require('../helpers/timetableHelper');
const { getMemberPriority } = require('../helpers/memberHelper');

/**
 * 연속된 선호시간을 병합
 * @param {Array} schedules - 스케줄 배열
 * @returns {Array} 병합된 스케줄 배열
 */
const mergeConsecutiveSchedules = (schedules) => {
  console.log(`🔄 [mergeConsecutiveSchedules] 입력: ${schedules.length}개 스케줄`);
  if (!schedules || schedules.length === 0) {
    console.log('🔄 [mergeConsecutiveSchedules] 빈 배열 반환');
    return schedules;
  }

  // 1. specificDate와 dayOfWeek별로 그룹화
  const groups = {};
  
  schedules.forEach(schedule => {
    // startTime이나 endTime이 없는 스케줄은 건너뛰기
    if (!schedule.startTime || !schedule.endTime) {
      console.log('⚠️ [병합] startTime 또는 endTime이 없는 스케줄 건너뛰기:', schedule);
      return;
    }
    
    const key = schedule.specificDate 
      ? `date-${schedule.specificDate}`
      : `day-${schedule.dayOfWeek}`;
    
    if (!groups[key]) groups[key] = [];
    // 스프레드 연산자 대신 직접 푸시 (Mongoose 객체 호환성)
    groups[key].push(schedule);
  });

  // 2. 각 그룹 내에서 시간순 정렬 및 병합
  const merged = [];
  
  console.log(`   📦 그룹 개수: ${Object.keys(groups).length}`);
  Object.keys(groups).forEach((key, index) => {
    const group = groups[key];
    console.log(`   📦 그룹 ${index + 1} (${key}): ${group.length}개 스케줄`);
    
    if (group.length === 0) {
      console.log(`      ⚠️ 그룹이 비어서 건너뜀`);
      return;
    }
    
    // 시작 시간순으로 정렬
    group.sort((a, b) => {
      // 방어 코드: startTime이 없는 경우 처리
      if (!a.startTime || !b.startTime) {
        console.log('⚠️ [병합 정렬] startTime이 없는 스케줄 발견:', { a, b });
        return 0;
      }
      const timeA = parseInt(a.startTime.replace(':', ''));
      const timeB = parseInt(b.startTime.replace(':', ''));
      return timeA - timeB;
    });

    // 연속된 시간 병합 - 새 객체 생성하여 원본 보존
    let current = {
      specificDate: group[0].specificDate,
      dayOfWeek: group[0].dayOfWeek,
      startTime: group[0].startTime,
      endTime: group[0].endTime,
      priority: group[0].priority
    };
    
    console.log(`      🔗 병합 시작: ${current.startTime}~${current.endTime}`);
    
    for (let i = 1; i < group.length; i++) {
      const next = group[i];
      
      console.log(`      🔍 다음: ${next.startTime}~${next.endTime}, 현재 끝: ${current.endTime}`);
      
      // endTime과 startTime이 같거나 겹치면 병합
      if (current.endTime >= next.startTime) {
        console.log(`         ✅ 병합! (${current.endTime} >= ${next.startTime})`);
        // endTime을 더 늦은 시간으로 업데이트
        if (next.endTime > current.endTime) {
          current.endTime = next.endTime;
          console.log(`         → 끝시간 업데이트: ${current.startTime}~${current.endTime}`);
        }
      } else {
        console.log(`         ❌ 병합 안됨 (${current.endTime} < ${next.startTime}), 새 블록 시작`);
        // 병합 불가능 -> 현재 블록 저장 후 새 블록 시작
        merged.push(current);
        current = {
          specificDate: next.specificDate,
          dayOfWeek: next.dayOfWeek,
          startTime: next.startTime,
          endTime: next.endTime,
          priority: next.priority
        };
      }
    }
    
    // 마지막 블록 저장
    merged.push(current);
    console.log(`      ✅ ${key}에서 병합 완료: 최종 추가됨`);
  });

  console.log(`🔄 [mergeConsecutiveSchedules] 출력: ${merged.length}개 스케줄 (${schedules.length}개에서 병합)`);
  
  // 병합 전후 비교 로그
  if (schedules.length !== merged.length) {
    console.log(`   ✅ ${schedules.length - merged.length}개 스케줄이 병합되었습니다!`);
    
    // 병합된 결과 상세 출력 (날짜별로 그룹화하여 표시)
    const mergedByDate = {};
    merged.forEach(s => {
      const key = s.specificDate || `매주 ${s.dayOfWeek}`;
      if (!mergedByDate[key]) mergedByDate[key] = [];
      mergedByDate[key].push(`${s.startTime}~${s.endTime}`);
    });
    
    console.log('   📋 [병합 후] 스케줄:');
    Object.keys(mergedByDate).sort().forEach(date => {
      console.log(`      ${date}: ${mergedByDate[date].join(', ')}`);
    });
  }
  
  return merged;
};

/**
 * 개인 시간표 기반으로 타임테이블 생성
 * @param {Array} members - 멤버 배열
 * @param {Object} owner - 방장 객체
 * @param {Date} startDate - 시작 날짜
 * @param {number} numWeeks - 주 수
 * @param {Object} roomSettings - 방 설정
 * @param {Date} fullRangeStart - 전체 범위 시작
 * @param {Date} fullRangeEnd - 전체 범위 끝
 * @returns {Object} 타임테이블 객체
 */
const createTimetableFromPersonalSchedules = (members, owner, startDate, numWeeks, roomSettings = {}, fullRangeStart, fullRangeEnd) => {
  const timetable = {};

  const scheduleStartHour = getHourFromSettings(roomSettings.scheduleStartTime, DEFAULT_SCHEDULE_START_TIME);
  const scheduleEndHour = getHourFromSettings(roomSettings.scheduleEndTime, DEFAULT_SCHEDULE_END_TIME);

  // 스케줄링 윈도우 종료일 계산
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + (numWeeks * 7));

  // 방장 가용 시간 계산은 전체 범위 사용 (다중 주 배정 시)
  const ownerRangeStart = fullRangeStart ? new Date(fullRangeStart) : startDate;
  const ownerRangeEnd = fullRangeEnd ? new Date(fullRangeEnd) : endDate;

  const ownerId = owner._id.toString();

  // 타임테이블 생성 로그 (디버깅용)
  const ownerSchedule = owner.user?.defaultSchedule || owner.defaultSchedule || [];
  console.log('\n🔍 [타임테이블] 생성:', ownerRangeStart.toISOString().split('T')[0], '~', ownerRangeEnd.toISOString().split('T')[0]);

  // Step 1: 방장의 가능한 시간대 수집
  const ownerAvailableSlots = createOwnerAvailableSlots(owner, ownerRangeStart, ownerRangeEnd);

  // Step 1.5: 방장의 개인시간 제거
  removeOwnerPersonalTimes(ownerAvailableSlots, owner, ownerRangeStart, ownerRangeEnd);

  // Step 1.6: 방 설정의 금지 시간 제거 (점심시간 등)
  if (roomSettings.ownerBlockedTimes && roomSettings.ownerBlockedTimes.length > 0) {
    removeBlockedTimes(ownerAvailableSlots, roomSettings.ownerBlockedTimes, ownerRangeStart, ownerRangeEnd);
  }

  // Step 2: 조원들의 개인 시간표 추가 (방장 가능 시간대와 겹치는 것만)
  members.forEach(member => {
    const user = member.user;
    const userId = user._id.toString();
    const priority = getMemberPriority(member);

    let memberSlotsAdded = 0;
    let memberSlotsSkipped = 0;

    // 개인 시간표(defaultSchedule) 처리
    if (user.defaultSchedule && Array.isArray(user.defaultSchedule)) {
      console.log(`
   📋 [필터 전] ${userId.substring(0, 8)}... defaultSchedule: ${user.defaultSchedule.length}개`);
      
      const validSchedules = filterValidSchedules(user.defaultSchedule);
      
      console.log(`   📋 [필터 후] ${userId.substring(0, 8)}... validSchedules: ${validSchedules.length}개`);
      
      // 필터링으로 제거된 스케줄이 있으면 상세 출력
      if (user.defaultSchedule.length !== validSchedules.length) {
        const removed = user.defaultSchedule.length - validSchedules.length;
        console.log(`   ⚠️ ${removed}개 스케줄이 필터링으로 제거됨!`);
        
        // 2025-12-16만 상세 확인
        const dec16Original = user.defaultSchedule.filter(s => 
          s.specificDate && s.specificDate.toString().includes('2025-12-16')
        );
        const dec16Valid = validSchedules.filter(s => 
          s.specificDate && s.specificDate.toString().includes('2025-12-16')
        );
        
        if (dec16Original.length !== dec16Valid.length) {
          console.log(`   🔍 2025-12-16 필터 전: ${dec16Original.length}개`);
          dec16Original.forEach(s => {
            console.log(`      - ${s.startTime}~${s.endTime}`);
          });
          console.log(`   🔍 2025-12-16 필터 후: ${dec16Valid.length}개`);
          dec16Valid.forEach(s => {
            console.log(`      - ${s.startTime}~${s.endTime}`);
          });
        }
      }

      // 🆕 선호시간 병합: 같은 날짜의 연속된 시간을 하나로 병합
      const mergedSchedules = mergeConsecutiveSchedules(validSchedules);

      // 병합 결과 로그 (디버깅용)
      if (validSchedules.length !== mergedSchedules.length) {
        console.log(`   🔄 [병합] ${userId.substring(0, 8)}... - ${validSchedules.length}개 → ${mergedSchedules.length}개로 병합됨`);
      }

      // ⚠️ 임시: 병합 문제 디버깅을 위해 원본 사용
      const schedulesToUse = mergedSchedules.length > 0 ? mergedSchedules : validSchedules;
      console.log(`   📊 [사용] ${schedulesToUse.length}개 스케줄 사용 (병합: ${mergedSchedules.length}, 원본: ${validSchedules.length})`);

      schedulesToUse.forEach(schedule => {
        const { dayOfWeek, startTime, endTime, specificDate } = schedule;
        const schedulePriority = schedule.priority || priority;

        // 주말 제외
        if (isWeekendDay(dayOfWeek)) return;

        if (specificDate) {
          // 특정 날짜 처리
          const targetDate = new Date(specificDate);

          if (targetDate >= ownerRangeStart && targetDate < ownerRangeEnd) {
            const slots = generateTimeSlots(startTime, endTime);

            slots.forEach(slotTime => {
              const dateKey = targetDate.toISOString().split('T')[0];
              const key = createSlotKey(dateKey, slotTime);

              // 방장이 가능한 시간대인지 확인
              if (!ownerAvailableSlots.has(key)) {
                memberSlotsSkipped++;
                return;
              }

              if (!timetable[key]) {
                const oneIndexedDayOfWeek = convertToOneIndexedDay(targetDate.getDay());
                timetable[key] = {
                  assignedTo: null,
                  available: [],
                  date: new Date(targetDate),
                  dayOfWeek: oneIndexedDayOfWeek
                };
              }

              addMemberAvailability(timetable[key], userId, schedulePriority, false);
              memberSlotsAdded++;
            });
          }
        } else {
          // 주간 반복 처리
          const currentDate = new Date(ownerRangeStart);
          while (currentDate < ownerRangeEnd) {
            if (currentDate.getUTCDay() === dayOfWeek) {
              const slots = generateTimeSlots(startTime, endTime);

              slots.forEach(slotTime => {
                const dateKey = currentDate.toISOString().split('T')[0];
                const key = createSlotKey(dateKey, slotTime);

                // 방장이 가능한 시간대인지 확인
                if (!ownerAvailableSlots.has(key)) {
                  memberSlotsSkipped++;
                  return;
                }

                if (!timetable[key]) {
                  const oneIndexedDayOfWeek = convertToOneIndexedDay(dayOfWeek);
                  timetable[key] = {
                    assignedTo: null,
                    available: [],
                    date: new Date(currentDate),
                    dayOfWeek: oneIndexedDayOfWeek
                  };
                }

                addMemberAvailability(timetable[key], userId, schedulePriority, false);
                memberSlotsAdded++;
              });
            }
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
          }
        }
      });
    }

    // 선호시간(scheduleExceptions) 처리 - 챗봇으로 추가된 시간
    if (user.scheduleExceptions && Array.isArray(user.scheduleExceptions)) {
      user.scheduleExceptions.forEach(exception => {
        const { specificDate, priority: exceptionPriority } = exception;
        const schedulePriority = exceptionPriority || priority;

        if (!specificDate) return;

        const targetDate = new Date(specificDate);

        // 주말 제외
        if (isWeekendDay(targetDate.getUTCDay())) return;

        if (targetDate >= ownerRangeStart && targetDate < ownerRangeEnd) {
          // ISO datetime에서 HH:MM 추출
          const startDateTime = new Date(exception.startTime);
          const endDateTime = new Date(exception.endTime);

          const startTime = `${String(startDateTime.getHours()).padStart(2, '0')}:${String(startDateTime.getMinutes()).padStart(2, '0')}`;
          const endTime = `${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`;

          const slots = generateTimeSlots(startTime, endTime);

          slots.forEach(slotTime => {
            const dateKey = targetDate.toISOString().split('T')[0];
            const key = createSlotKey(dateKey, slotTime);

            // 방장이 가능한 시간대인지 확인
            if (!ownerAvailableSlots.has(key)) {
              memberSlotsSkipped++;
              return;
            }

            if (!timetable[key]) {
              const oneIndexedDayOfWeek = convertToOneIndexedDay(targetDate.getDay());
              timetable[key] = {
                assignedTo: null,
                available: [],
                date: new Date(targetDate),
                dayOfWeek: oneIndexedDayOfWeek
              };
            }

            addMemberAvailability(timetable[key], userId, schedulePriority, false);
            memberSlotsAdded++;
          });
        }
      });
    }

    // 개인시간(personalTimes) 처리 - 이 시간대는 제외
    if (user.personalTimes && Array.isArray(user.personalTimes)) {
      user.personalTimes.forEach(personalTime => {
        // specificDate가 있는 경우 (일회성 개인 일정 - 채팅으로 추가된 경우)
        if (personalTime.specificDate) {
          const targetDate = new Date(personalTime.specificDate);
          if (targetDate >= ownerRangeStart && targetDate < ownerRangeEnd) {
            const slots = generateTimeSlots(personalTime.startTime, personalTime.endTime);
            slots.forEach(slotTime => {
              const dateKey = targetDate.toISOString().split('T')[0];
              const key = createSlotKey(dateKey, slotTime);
              removeMemberFromSlot(timetable, key, userId);
            });
          }
        }
        // 반복되는 개인 일정
        else if (personalTime.isRecurring !== false && personalTime.days && personalTime.days.length > 0) {
          personalTime.days.forEach(dayOfWeek => {
            const jsDay = dayOfWeek === 7 ? 0 : dayOfWeek;

            const currentDate = new Date(ownerRangeStart);
            while (currentDate < ownerRangeEnd) {
              if (currentDate.getUTCDay() === jsDay) {
                const slots = generateTimeSlots(personalTime.startTime, personalTime.endTime);

                slots.forEach(slotTime => {
                  const dateKey = currentDate.toISOString().split('T')[0];
                  const key = createSlotKey(dateKey, slotTime);
                  removeMemberFromSlot(timetable, key, userId);
                });
              }
              currentDate.setUTCDate(currentDate.getUTCDate() + 1);
            }
          });
        }
      });
    }
  });

  return timetable;
};

/**
 * 기존 roomTimeSlots 기반 타임테이블 생성 (레거시)
 * @param {Array} roomTimeSlots - 방 타임슬롯 배열
 * @param {Date} startDate - 시작 날짜
 * @param {number} numWeeks - 주 수
 * @param {Object} roomSettings - 방 설정
 * @param {Array} members - 멤버 배열
 * @returns {Object} 타임테이블 객체
 */
const createTimetable = (roomTimeSlots, startDate, numWeeks, roomSettings = {}, members = []) => {
  const timetable = {};

  const scheduleStartHour = getHourFromSettings(roomSettings.scheduleStartTime, DEFAULT_SCHEDULE_START_TIME);
  const scheduleEndHour = getHourFromSettings(roomSettings.scheduleEndTime, DEFAULT_SCHEDULE_END_TIME);

  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + (numWeeks * 7));

  // 사용자별로 슬롯 그룹화
  const userSlots = {};
  roomTimeSlots.forEach(slot => {
    let userId;
    if (slot.user && slot.user._id) {
      userId = slot.user._id.toString();
    } else if (slot.user) {
      userId = slot.user.toString();
    } else {
      return;
    }

    if (!userSlots[userId]) {
      userSlots[userId] = [];
    }
    userSlots[userId].push(slot);
  });

  // 각 사용자의 슬롯 처리
  Object.keys(userSlots).forEach(userId => {
    const member = members.find(m => (m.user._id || m.user).toString() === userId);
    if (!member) return;

    const priority = getMemberPriority(member);

    userSlots[userId].forEach(slot => {
      const date = new Date(slot.date);
      const slotDateStr = date.toISOString().split('T')[0];
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      if (slotDateStr < startDateStr || slotDateStr >= endDateStr) return;

      const dateKey = date.toISOString().split('T')[0];
      const key = createSlotKey(dateKey, slot.startTime);

      if (!timetable[key]) {
        const dayOfWeek = date.getDay();
        const oneIndexedDayOfWeek = convertToOneIndexedDay(dayOfWeek);

        timetable[key] = {
          assignedTo: null,
          available: [],
          date: new Date(date),
          dayOfWeek: oneIndexedDayOfWeek
        };
      }

      addMemberAvailability(timetable[key], userId, priority, false);
    });
  });

  return timetable;
};

/**
 * 오늘 이후 날짜만 필터링
 * @param {Object} timetable - 전체 타임테이블
 * @returns {Object} 필터링된 타임테이블
 */
const filterFutureDates = (timetable, todayString) => {
  // Use client-provided date string for consistency, with a fallback to server's UTC date.
  const today = new Date(todayString || new Date().toISOString().slice(0, 10));
  console.log(`[filterFutureDates] Filtering based on date: ${today.toISOString()}`);

  const futureTimetable = {};

  for (const slotKey in timetable) {
    if (Object.prototype.hasOwnProperty.call(timetable, slotKey)) {
      const slotData = timetable[slotKey];
      if (slotData && slotData.date) {
        const slotDate = new Date(slotData.date);
        if (slotDate >= today) {
          futureTimetable[slotKey] = slotData;
        }
      }
    }
  }
  console.log(`[filterFutureDates] Original timetable slots: ${Object.keys(timetable).length}. Filtered to: ${Object.keys(futureTimetable).length}`);
  return futureTimetable;
};

module.exports = {
  createTimetableFromPersonalSchedules,
  createTimetable,
  filterFutureDates
};
