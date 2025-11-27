/**
 * 스케줄링 알고리즘 메인 모듈
 *
 * 이 파일은 모든 서브 모듈을 조율하여 자동 스케줄링을 수행합니다.
 * 원본 schedulingAlgorithm.js (2160줄)을 모듈화하여 ~300줄로 축소했습니다.
 */

// Constants
const { SLOTS_PER_HOUR } = require('./constants/timeConstants');
const { DAY_MAP, DEFAULT_REQUIRED_SLOTS } = require('./constants/schedulingConstants');

// Utils
const { calculateEndTime } = require('./utils/timeUtils');

// Validators
const { createConflictKeysSet } = require('./validators/conflictValidator');

// Helpers
const {
  initializeMemberAssignments,
  calculateMemberRequiredSlots,
  processAutoAssignments,
  loadExistingSlots
} = require('./helpers/assignmentHelper');
const { mergeConsecutiveConflicts, calculateBlockSlotCount } = require('./helpers/conflictMerger');
const {
  filterNonOwnerMembers,
  extractMemberId,
  createUnassignedMembersInfo,
  createCarryOverAssignments
} = require('./helpers/memberHelper');
const { processDeferredAssignments } = require('./helpers/carryOverHelper');

// Services
const { createTimetableFromPersonalSchedules } = require('./services/timetableCreationService');
const { identifyConflictsBeforeAssignment } = require('./services/conflictIdentificationService');
const { assignByTimeOrder, assignUndisputedSlots, iterativeAssignment } = require('./services/slotAssignmentService');
const { resolveConflictsWithOwner, resolveConflictsByOwnerTakingSlot } = require('./services/conflictResolutionService');
const { runMultiWeekSchedule } = require('./services/multiWeekSchedulingService');

/**
 * 스케줄링 알고리즘 클래스
 */
class SchedulingAlgorithm {

  /**
   * 자동 스케줄링 실행 (메인 진입점)
   * @param {Array} members - 멤버 배열
   * @param {Object} owner - 방장 객체
   * @param {Array} roomTimeSlots - 기존 슬롯 배열
   * @param {Object} options - 옵션 객체
   * @param {Array} deferredAssignments - 지연 배정 배열
   * @returns {Object} 스케줄링 결과
   */
  runAutoSchedule(members, owner, roomTimeSlots, options, deferredAssignments = []) {
    // Input validation
    if (!members || !Array.isArray(members)) {
      throw new Error('Invalid members data provided to scheduling algorithm');
    }

    if (!owner || !owner._id) {
      throw new Error('Invalid owner data provided to scheduling algorithm');
    }

    const {
      minHoursPerWeek = 3,
      numWeeks = 2,
      currentWeek,
      ownerPreferences = {},
      roomSettings = {},
      fullRangeStart,
      fullRangeEnd
    } = options;

    // 다중 주 스케줄링
    if (numWeeks > 1) {
      return runMultiWeekSchedule({
        members,
        owner,
        roomTimeSlots,
        options,
        deferredAssignments
      }, this.runAutoSchedule.bind(this));
    }

    // 단일 주 배정
    const ownerId = owner._id.toString();
    const nonOwnerMembers = filterNonOwnerMembers(members, ownerId);

    // 멤버별 필요 슬롯 계산
    const memberRequiredSlots = calculateMemberRequiredSlots(
      members,
      minHoursPerWeek,
      1 // 단일 주
    );

    // 시작 날짜 설정
    const startDate = currentWeek ? new Date(currentWeek) : new Date('2025-09-16T00:00:00.000Z');

    // 타임테이블 생성
    // 타임테이블 생성 로그는 timetableCreationService에서 출력
    
    const timetable = createTimetableFromPersonalSchedules(
      members,
      owner,
      startDate,
      numWeeks,
      roomSettings,
      fullRangeStart,
      fullRangeEnd
    );

    // 타임테이블이 비어있으면 빠르게 종료 (성능 최적화)
    const timetableSize = Object.keys(timetable).length;
    if (timetableSize === 0) {
      const emptyAssignments = {};
      nonOwnerMembers.forEach(m => {
        const memberId = extractMemberId(m);
        emptyAssignments[memberId] = {
          memberId,
          assignedHours: 0,
          requiredSlots: memberRequiredSlots[memberId] || DEFAULT_REQUIRED_SLOTS,
          slots: []
        };
      });
      return {
        assignments: emptyAssignments,
        carryOverAssignments: [],
        unassignedMembersInfo: []
      };
    }

    // 배정 초기화
    let assignments = initializeMemberAssignments(nonOwnerMembers, memberRequiredSlots);

    // 기존 슬롯 로드
    if (roomTimeSlots && roomTimeSlots.length > 0) {
      loadExistingSlots(roomTimeSlots, assignments, ownerId);
    }

    // Phase 0: 지연 배정 처리
    processDeferredAssignments(timetable, assignments, deferredAssignments);

    // Phase 1: 충돌 식별
    const { conflicts, memberAvailableSlots } = identifyConflictsBeforeAssignment(
      timetable,
      ownerId,
      memberRequiredSlots
    );
    const conflictingSlots = conflicts;
    // Negotiation blocks feature removed

    // 새로운 배정 전략: 시간 순서 우선 배정 (1시간 블록씩)
    assignByTimeOrder(timetable, assignments, memberRequiredSlots, ownerId);

    // 기존 Phase 2, 3 비활성화 (단독 슬롯 우선 배정 제거)
    // Phase 2: 논쟁 없는 슬롯 배정 (고우선순위)
    // assignUndisputedSlots(timetable, assignments, 3, memberRequiredSlots, conflictingSlots);

    // Phase 2-2: 논쟁 없는 슬롯 배정 (저우선순위)
    // assignUndisputedSlots(timetable, assignments, 1, memberRequiredSlots, conflictingSlots);

    // Phase 3: 반복적 배정
    // iterativeAssignment(
    //   timetable,
    //   assignments,
    //   2,
    //   memberRequiredSlots,
    //   nonOwnerMembers,
    //   ownerPreferences,
    //   conflictingSlots,
    //   ownerId
    // );

    // Phase 4: 방장 슬롯 가져가기 (현재 미사용)
    // resolveConflictsByOwnerTakingSlot(timetable, assignments, owner, memberRequiredSlots, ownerPreferences);

    // Phase 5: 방장 양보 충돌 해결 (시간 순서 배정 사용으로 비활성화)
    // resolveConflictsWithOwner(timetable, assignments, owner, memberRequiredSlots);

    // Phase 6: 캐리오버 처리
    this._carryOverAssignments(timetable, assignments, memberRequiredSlots, members);

    // 미배정 멤버 정보 생성
    const unassignedMembersInfo = createUnassignedMembersInfo(
      assignments,
      memberRequiredSlots,
      ownerId,
      members
    );

    // 캐리오버 배정 생성
    const carryOverAssignments = createCarryOverAssignments(
      assignments,
      memberRequiredSlots,
      ownerId,
      members,
      startDate
    );

    // Negotiation feature removed

    return {
      assignments,
      carryOverAssignments,
      unassignedMembersInfo
    };
  }

  /**
   * 캐리오버 배정 처리
   * @param {Object} timetable - 타임테이블
   * @param {Object} assignments - 배정 객체
   * @param {Object} memberRequiredSlots - 필요 슬롯
   * @param {Array} members - 멤버 배열
   */
  _carryOverAssignments(timetable, assignments, memberRequiredSlots, members) {
    // 캐리오버가 있는 멤버에게 우선권 부여
    const membersWithCarryOver = members.filter(m => m.carryOver && m.carryOver > 0);

    for (const member of membersWithCarryOver) {
      const memberId = extractMemberId(member);
      if (!assignments[memberId]) continue;

      const requiredSlots = memberRequiredSlots[memberId] || DEFAULT_REQUIRED_SLOTS;
      let needed = requiredSlots - assignments[memberId].assignedHours;

      if (needed <= 0) continue;

      // 빈 슬롯 찾기
      const availableSlots = Object.keys(timetable)
        .filter(key => {
          const slot = timetable[key];
          if (slot.assignedTo) return false;
          return slot.available.some(a => a.memberId === memberId && !a.isOwner);
        })
        .sort();

      // 1시간 블록 단위로 배정
      for (let i = 0; i < availableSlots.length - 1 && needed > 0; i++) {
        const key1 = availableSlots[i];
        const key2 = availableSlots[i + 1];

        // 연속된 슬롯인지 확인
        const time1 = key1.split('-').pop();
        const time2 = key2.split('-').pop();
        const date1 = key1.substring(0, key1.lastIndexOf('-'));
        const date2 = key2.substring(0, key2.lastIndexOf('-'));

        if (date1 !== date2) continue;

        const endTime1 = calculateEndTime(time1);
        if (endTime1 !== time2) continue;

        // 배정
        const slot1 = timetable[key1];
        const slot2 = timetable[key2];

        if (!slot1.assignedTo && !slot2.assignedTo) {
          slot1.assignedTo = memberId;
          slot2.assignedTo = memberId;

          assignments[memberId].assignedHours += 2;
          assignments[memberId].slots.push({
            date: slot1.date,
            startTime: time1,
            endTime: calculateEndTime(time2),
            dayOfWeek: slot1.dayOfWeek
          });

          needed -= 2;
          i++; // 다음 슬롯 건너뛰기
        }
      }

      // 2주 연속 미배정 시 개입 필요 표시
      const consecutiveCarryOvers = (member.carryOverHistory || []).filter(h => {
        const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        return h.timestamp >= twoWeeksAgo;
      }).length;

      if (consecutiveCarryOvers >= 2 && needed > 0) {
        assignments[memberId].needsIntervention = true;
        assignments[memberId].interventionReason =
          `2주 연속 시간 미배정 (부족: ${needed / 2}시간)`;
      }
    }
  }

  /**
   * 멤버 우선순위 반환
   * @param {Object} member - 멤버 객체
   * @returns {number} 우선순위
   */
  getMemberPriority(member) {
    if (!member || !member.user || !member.user.defaultSchedule) return 3;

    const schedules = member.user.defaultSchedule;
    if (schedules.length === 0) return 3;

    const maxPriority = Math.max(...schedules.map(s => s.priority || 3));
    return maxPriority;
  }
}

module.exports = new SchedulingAlgorithm();
