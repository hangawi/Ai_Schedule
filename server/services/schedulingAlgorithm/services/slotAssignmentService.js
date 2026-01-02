/**
 * 슬롯 배정 서비스
 */

console.log('🚀🚀🚀 slotAssignmentService.js 로드됨 - 수정버전 (priority 체크 포함)');

const { DEFAULT_REQUIRED_SLOTS, MAX_ITERATION_ROUNDS, FAIRNESS_GAP_THRESHOLD } = require('../constants/schedulingConstants');
const { PREFERRED_TIME_PRIORITY_THRESHOLD } = require('../constants/priorityConstants');
const { MINUTES_PER_SLOT } = require('../constants/timeConstants');
const { timeToMinutes, minutesToTime } = require('../utils/timeUtils');
const { extractDateFromSlotKey, extractTimeFromSlotKey, areConsecutiveSlots } = require('../utils/slotUtils');
const { createConflictKeysSet, createConflictingMembersSet, getMemberConflicts, getMemberConflictDates, isMemberHighestPriority, isUniqueHighestPriority, getCoConflictingMembers } = require('../validators/conflictValidator');
const { assignSlot, isMemberFullyAssigned } = require('../helpers/assignmentHelper');
const { getMemberPriority, findMemberById } = require('../helpers/memberHelper');
const { isTimeInBlockedRange } = require('../validators/prohibitedTimeValidator');

/**
 * 배정 모드에 따라 멤버 정렬
 */
const sortMembersByMode = (
  memberIds,
  assignmentMode,
  members,
  memberAvailableSlots,
  memberMaxPriority
) => {
  return memberIds.sort((a, b) => {
    // 1순위: 우선순위 (모든 모드 공통)
    const priorityDiff = memberMaxPriority[b] - memberMaxPriority[a];
    if (priorityDiff !== 0) return priorityDiff;

    // 2순위: 모드별 정렬
    switch (assignmentMode) {
      case 'first_come_first_served': {
        // 선착순: joinedAt 빠른 순
        const memberA = members.find(m => (m.user?._id?.toString() || m.user?.toString()) === a);
        const memberB = members.find(m => (m.user?._id?.toString() || m.user?.toString()) === b);

        if (!memberA || !memberB) return 0;

        const dateA = new Date(memberA.joinedAt || 0);
        const dateB = new Date(memberB.joinedAt || 0);
        return dateA - dateB;
      }

      case 'from_today':
      case 'normal':
      default:
        // 보통/오늘 기준: 가용 슬롯 적은 순
        return memberAvailableSlots[a] - memberAvailableSlots[b];
    }
  });
};

/**
 * 시간 순서 우선 배정 (수정 3: 자투리 회피 및 블록 탐색 버그 수정)
 * 한 멤버의 필요 시간을 모두 채운 후 다음 멤버로 넘어가는 방식으로 분할을 최소화합니다.
 */
const assignByTimeOrder = (timetable, assignments, memberRequiredSlots, ownerId, members, assignmentMode = 'normal', minClassDurationMinutes = 60, blockedTimes = []) => {
  console.log('🔥🔥🔥 assignByTimeOrder 호출됨 - 수정버전 (priority >= 2만 배정)');
  const sortedKeys = Object.keys(timetable).sort();
  if (sortedKeys.length === 0) {
    console.log('🕐 배정할 슬롯이 없어 시간 순서 배정을 건너뜁니다.');
    return;
  }

  console.log('🕐 ===== 시간 순서 배정 시작 (멤버 우선, 자투리 회피) =====');
  
  // 헬퍼: 로그
  const logAssignment = (memberId, block, type) => {
    const startKey = block[0];
    const dateStr = extractDateFromSlotKey(startKey);
    const startTime = extractTimeFromSlotKey(startKey);
    const endTime = extractTimeFromSlotKey(block[block.length - 1]);
    const finalEndTime = minutesToTime(timeToMinutes(endTime) + MINUTES_PER_SLOT);
    const before = assignments[memberId]?.assignedHours || 0;
    const after = before + block.length;
    console.log(`  ✅ [${type}] ${memberId.substring(0, 8)} → ${dateStr} ${startTime}-${finalEndTime} (${block.length}슬롯)`);
  };

  // 헬퍼: 특정 인덱스부터 시작하는 연속 블록 하나를 찾음
  const findConsecutiveBlock = (startIndex, memberId, maxSlots) => {
    const blockKeys = [];
    for (let i = startIndex; i < sortedKeys.length; i++) {
        const key = sortedKeys[i];
        const slot = timetable[key];
        if (slot.assignedTo) break;
        
        // 🔧 선호시간 내에서만 배정 (priority >= 2)
        const memberAvail = slot.available.find(a => a.memberId === memberId && !a.isOwner);
        if (!memberAvail) break;
        if (memberAvail.priority < PREFERRED_TIME_PRIORITY_THRESHOLD) {
          console.log(`   ⚠️  슬롯 ${key} 스킵: ${memberId.substring(0,6)}의 priority ${memberAvail.priority} < ${PREFERRED_TIME_PRIORITY_THRESHOLD}`);
          break;
        }
        if (blockKeys.length > 0 && !areConsecutiveSlots(blockKeys[blockKeys.length - 1], key)) break;
        blockKeys.push(key);
        if (blockKeys.length >= maxSlots) break;
    }
    return blockKeys.length > 0 ? blockKeys : null;
  };
  
  // 1. 멤버 처리 순서 결정
  const memberAvailableSlots = {};
  const memberMaxPriority = {};
  Object.keys(assignments).forEach(memberId => {
    let count = 0, maxPriority = 0;
    sortedKeys.forEach(key => {
      const slot = timetable[key];
      if (!slot.assignedTo) {
        const memberAvail = slot.available.find(a => a.memberId === memberId && !a.isOwner);
        if (memberAvail) {
          count++;
          maxPriority = Math.max(maxPriority, memberAvail.priority || 2);
        }
      }
    });
    memberAvailableSlots[memberId] = count;
    memberMaxPriority[memberId] = maxPriority;
  });

  const membersToProcess = Object.keys(assignments).filter(id => !isMemberFullyAssigned(assignments, id, memberRequiredSlots));
  const sortedMembers = sortMembersByMode(membersToProcess, assignmentMode, members, memberAvailableSlots, memberMaxPriority);
  
  console.log("📊 멤버 처리 순서:", sortedMembers.map(id => id.substring(0,6)).join(', '));

  // 2. 멤버 순회하며 배정
  for (const memberId of sortedMembers) {
    const requiredSlots = memberRequiredSlots[memberId] || DEFAULT_REQUIRED_SLOTS;
    console.log(`\n--- 📋 [${memberId.substring(0,6)}] 배정 시작 (총 필요량: ${requiredSlots}슬롯) ---`);

    while (!isMemberFullyAssigned(assignments, memberId, memberRequiredSlots)) {
      const assignedHours = assignments[memberId]?.assignedHours || 0;
      const remainingSlots = requiredSlots - assignedHours;

      // 2.1. 현재 멤버의 모든 가용 블록 다시 찾기 (버그 수정된 방식)
      const allPossibleBlocks = [];
      for (let i = 0; i < sortedKeys.length; i++) {
        const slot = timetable[sortedKeys[i]];
        if (!slot.assignedTo && slot.available.some(a => a.memberId === memberId && !a.isOwner)) {
            const block = findConsecutiveBlock(i, memberId, remainingSlots);
            if (block) {
                allPossibleBlocks.push({ block, startIndex: i });
            }
        }
      }

      if (allPossibleBlocks.length === 0) {
        console.log(`   → [${memberId.substring(0,6)}] 더 이상 배정 가능한 블록 없음.`);
        break;
      }
      
      // 2.2. 최적 블록 선택 (자투리 시간 회피 로직 - 개선된 3단계 정렬)
      const MINIMUM_ACCEPTABLE_BLOCK_SLOTS = Math.ceil(minClassDurationMinutes / MINUTES_PER_SLOT);
      
      allPossibleBlocks.sort((a, b) => {
        const aIsShort = a.block.length < MINIMUM_ACCEPTABLE_BLOCK_SLOTS;
        const bIsShort = b.block.length < MINIMUM_ACCEPTABLE_BLOCK_SLOTS;

        // 1. Primary: Long blocks first
        if (aIsShort && !bIsShort) return 1; // a(자투리)를 뒤로
        if (!aIsShort && bIsShort) return -1; // b(자투리)를 뒤로

        // Both are short or both are long.
        // 2. Secondary: Sort by length, descending (더 긴 블록 우선)
        const lengthDifference = b.block.length - a.block.length;
        if (lengthDifference !== 0) {
            return lengthDifference;
        }

        // 3. Tertiary: Sort by time (길이까지 같으면 시간 순)
        return a.startIndex - b.startIndex;
      });

      // ======================= DEBUG LOGGING START =======================
      console.log(`   [DEBUG] 자투리 기준: ${MINIMUM_ACCEPTABLE_BLOCK_SLOTS}슬롯 (minClassDuration: ${minClassDurationMinutes}분). 정렬 후 블록 순서:`);
      allPossibleBlocks.slice(0, 10).forEach(b => {
        const startKey = b.block[0];
        const isShort = b.block.length < MINIMUM_ACCEPTABLE_BLOCK_SLOTS;
        console.log(`     - ${extractDateFromSlotKey(startKey)} ${extractTimeFromSlotKey(startKey)} ~ (${b.block.length} 슬롯) ${isShort ? '[자투리]' : '[충분]'}`);
      });
      // ======================= DEBUG LOGGING END =======================

      const bestBlockData = allPossibleBlocks[0];
      
      // ======================= DEBUG LOGGING START =======================
      if(bestBlockData) {
        const startKey = bestBlockData.block[0];
        console.log(`   [DEBUG] 최종 선택된 블록: ${extractDateFromSlotKey(startKey)} ${extractTimeFromSlotKey(startKey)} ~ (${bestBlockData.block.length} 슬롯)`);
      }
      // ======================= DEBUG LOGGING END =======================

      if (bestBlockData.block.length === 0) {
        console.log(`   → [${memberId.substring(0,6)}] 배정 가능한 블록이 없습니다.`);
        break; // 더 이상 진행 불가
      }

      // 2.3. 금지시간 검증
      const blockEndTime = extractTimeFromSlotKey(bestBlockData.block[bestBlockData.block.length - 1]);
      const finalEndTime = minutesToTime(timeToMinutes(blockEndTime) + MINUTES_PER_SLOT);
      const blockedTime = isTimeInBlockedRange(extractTimeFromSlotKey(bestBlockData.block[0]), finalEndTime, blockedTimes);

      if (blockedTime) {
          console.log(`   ⚠️ [금지시간] 최적 블록이 '${blockedTime.name}'과 겹쳐 이번 턴 배정 중단.`);
          break;
      }

      // 2.4. 블록 배정
      const slotsToAssignCount = Math.min(bestBlockData.block.length, remainingSlots);
      const blockToAssign = bestBlockData.block.slice(0, slotsToAssignCount);

      logAssignment(memberId, blockToAssign, '배정');
      
      for (const blockKey of blockToAssign) {
        assignSlot(timetable, assignments, blockKey, memberId);
      }
    }

    const finalAssigned = assignments[memberId]?.assignedHours || 0;
    if (finalAssigned < requiredSlots) {
      console.log(`   → [${memberId.substring(0,6)}] 최종 결과: ${finalAssigned}/${requiredSlots} (${requiredSlots - finalAssigned}슬롯 부족)`);
    } else {
      console.log(`   → [${memberId.substring(0,6)}] 배정 완료: ${finalAssigned}/${requiredSlots} ✓`);
    }
  }
  console.log('\n✅ 모든 멤버 배정 완료\n');
};

/**
 * 논쟁 없는 슬롯 배정 (Phase 2)
 * @param {Object} timetable - 타임테이블 객체
 * @param {Object} assignments - assignments 객체
 * @param {number} priority - 최소 우선순위
 * @param {Object} memberRequiredSlots - 필요 슬롯 정보
 * @param {Array} conflictingSlots - 충돌 슬롯 배열
 */
const assignUndisputedSlots = (timetable, assignments, priority, memberRequiredSlots, conflictingSlots = []) => {
  let assignedCount = 0;

  // 충돌 슬롯 Set과 충돌 멤버 Set 생성
  const conflictKeys = createConflictKeysSet(conflictingSlots);
  const conflictingMembers = createConflictingMembersSet(conflictingSlots);

  // 1시간 블록(연속된 2개 슬롯) 찾기
  const findOneHourBlock = (memberId) => {
    const sortedKeys = Object.keys(timetable).sort();
    const isConflictingMember = conflictingMembers.has(memberId);

    for (let i = 0; i < sortedKeys.length - 1; i++) {
      const key1 = sortedKeys[i];
      const key2 = sortedKeys[i + 1];

      const slot1 = timetable[key1];
      const slot2 = timetable[key2];

      // 두 슬롯 모두 비어있고, 충돌 슬롯이 아님
      if (!slot1.assignedTo && !slot2.assignedTo &&
          !conflictKeys.has(key1) && !conflictKeys.has(key2)) {

        const avail1 = slot1.available.filter(a => a.priority >= priority && !a.isOwner);
        const avail2 = slot2.available.filter(a => a.priority >= priority && !a.isOwner);

        const currentDate = extractDateFromSlotKey(key1);

        // 조건 1: 멤버가 단독으로 사용 가능
        let isAlone = avail1.length === 1 && avail2.length === 1 &&
                      avail1[0].memberId === memberId && avail2[0].memberId === memberId;

        // 협의 멤버인 경우 추가 체크
        const isCurrentSlotConflict = conflictKeys.has(key1) || conflictKeys.has(key2);

        if (isAlone && isConflictingMember && !isCurrentSlotConflict) {
          const memberConflicts = getMemberConflicts(conflictingSlots, memberId);
          const conflictDates = getMemberConflictDates(memberConflicts);

          if (conflictDates.has(currentDate)) {
            isAlone = false;
          }
        }

        // 조건 2: 협의 멤버가 명확한 우선순위 우위를 가진 경우
        let hasClearPriorityAdvantage = false;
        if (isConflictingMember && !isCurrentSlotConflict) {
          const memberAvail1 = avail1.find(a => a.memberId === memberId);
          const memberAvail2 = avail2.find(a => a.memberId === memberId);

          if (memberAvail1 && memberAvail2) {
            const originalContenders1 = slot1.available.filter(a => !a.isOwner).length;
            const originalContenders2 = slot2.available.filter(a => !a.isOwner).length;

            if (originalContenders1 > 1 || originalContenders2 > 1) {
              const isHighest1 = isMemberHighestPriority(memberAvail1, avail1);
              const isHighest2 = isMemberHighestPriority(memberAvail2, avail2);
              const isUnique1 = isUniqueHighestPriority(avail1);
              const isUnique2 = isUniqueHighestPriority(avail2);

              const memberConflicts = getMemberConflicts(conflictingSlots, memberId);
              const conflictDates = getMemberConflictDates(memberConflicts);

              hasClearPriorityAdvantage = isHighest1 && isHighest2 &&
                                          isUnique1 && isUnique2 &&
                                          !conflictDates.has(currentDate);
            }
          }
        }

        // 두 조건 중 하나라도 만족하면 배정 가능
        if (isAlone || hasClearPriorityAdvantage) {
          // 시간이 연속되는지 확인 (30분 차이)
          if (areConsecutiveSlots(key1, key2)) {
            const finalReason = hasClearPriorityAdvantage ? 'hasClearPriorityAdvantage' : 'isAlone';
            return { block: [key1, key2], reason: finalReason };
          }
        }
      }
    }
    return null;
  };

  // 공평한 분배를 위해 라운드 로빈 방식으로 할당
  let allMembersAssigned = false;
  let roundCount = 0;

  while (!allMembersAssigned) {
    allMembersAssigned = true;
    roundCount++;

    for (const memberId in assignments) {
      const requiredSlots = memberRequiredSlots[memberId] || assignments[memberId]?.requiredSlots || DEFAULT_REQUIRED_SLOTS;

      if (assignments[memberId].assignedHours < requiredSlots) {
        const isConflictingMember = conflictingMembers.has(memberId);

        const result = findOneHourBlock(memberId);

        if (result) {
          // 협의 멤버라도 다른 요일이면 배정 허용
          if (isConflictingMember) {
            const blockDate = extractDateFromSlotKey(result.block[0]);
            const memberConflicts = getMemberConflicts(conflictingSlots, memberId);
            const conflictDates = getMemberConflictDates(memberConflicts);

            if (conflictDates.has(blockDate)) {
              continue;
            }
          }

          assignSlot(timetable, assignments, result.block[0], memberId);
          assignSlot(timetable, assignments, result.block[1], memberId);
          assignedCount += 2;
          allMembersAssigned = false;
          break;
        }
      }
    }

    if (roundCount > MAX_ITERATION_ROUNDS) {
      break;
    }

    if (allMembersAssigned) {
      break;
    }
  }
};

/**
 * 반복적 배정 (Phase 3)
 * @param {Object} timetable - 타임테이블 객체
 * @param {Object} assignments - assignments 객체
 * @param {number} priority - 최소 우선순위
 * @param {Object} memberRequiredSlots - 필요 슬롯 정보
 * @param {Array} members - 멤버 배열
 * @param {Object} ownerPreferences - 방장 선호 설정
 * @param {Array} conflictingSlots - 충돌 슬롯 배열
 * @param {string} ownerId - 방장 ID
 */
const iterativeAssignment = (timetable, assignments, priority, memberRequiredSlots, members = [], ownerPreferences = {}, conflictingSlots = [], ownerId = null) => {
  let changed = true;
  let iterationCount = 0;

  const conflictingMembers = createConflictingMembersSet(conflictingSlots);
  const conflictKeys = createConflictKeysSet(conflictingSlots);

  // 1시간 블록 찾기 함수 - 시간 순서대로 가장 이른 블록을 반환
  const findOneHourBlock = (memberId, conflicts, debugMode = false) => {
    const sortedKeys = Object.keys(timetable).sort();

    for (let i = 0; i < sortedKeys.length - 1; i++) {
      const key1 = sortedKeys[i];
      const key2 = sortedKeys[i + 1];

      const slot1 = timetable[key1];
      const slot2 = timetable[key2];

      if (!slot1.assignedTo && !slot2.assignedTo &&
          !conflictKeys.has(key1) && !conflictKeys.has(key2)) {

        const avail1 = slot1.available.find(a => a.memberId === memberId && a.priority >= priority && !a.isOwner);
        const avail2 = slot2.available.find(a => a.memberId === memberId && a.priority >= priority && !a.isOwner);

        if (avail1 && avail2) {
          const allAvail1 = slot1.available.filter(a => a.priority >= priority && !a.isOwner);
          const allAvail2 = slot2.available.filter(a => a.priority >= priority && !a.isOwner);

          // 최고 우선순위 체크
          if (!isMemberHighestPriority(avail1, allAvail1) || !isMemberHighestPriority(avail2, allAvail2)) {
            continue;
          }

          // 최고 우선순위가 여러 명이면 건너뜀
          if (!isUniqueHighestPriority(allAvail1) || !isUniqueHighestPriority(allAvail2)) {
            continue;
          }

          // 협의 멤버인 경우 추가 체크
          const isConflictMember = conflictingMembers.has(memberId);
          if (isConflictMember) {
            const memberConflicts = getMemberConflicts(conflicts, memberId);

            // 현재 블록이 충돌 슬롯이면 차단
            if (memberConflicts.some(c => c.slotKey === key1 || c.slotKey === key2)) {
              continue;
            }

            // 같은 우선순위 충돌 멤버가 있는지 확인
            const coConflictingMembers = getCoConflictingMembers(memberConflicts, memberId);

            const avail1InBlock = (slot1.available || []).filter(a => a.memberId !== ownerId);
            const avail2InBlock = (slot2.available || []).filter(a => a.memberId !== ownerId);

            const member1Priority = avail1InBlock.find(a => a.memberId === memberId)?.priority || 2;
            const member2Priority = avail2InBlock.find(a => a.memberId === memberId)?.priority || 2;

            const hasCoConflictSamePriority1 = avail1InBlock.some(a =>
              coConflictingMembers.has(a.memberId) && a.priority === member1Priority
            );
            const hasCoConflictSamePriority2 = avail2InBlock.some(a =>
              coConflictingMembers.has(a.memberId) && a.priority === member2Priority
            );

            if (hasCoConflictSamePriority1 || hasCoConflictSamePriority2) {
              continue;
            }

            // 충돌 날짜와 다른 요일인지 확인
            const blockDate = extractDateFromSlotKey(key1);
            const conflictDates = getMemberConflictDates(memberConflicts);

            if (conflictDates.has(blockDate)) {
              continue;
            }
          }

          // 연속 슬롯인지 확인
          if (areConsecutiveSlots(key1, key2)) {
            // 시간 순서대로 가장 이른 블록 반환 (이미 sortedKeys로 정렬됨)
            return [key1, key2];
          }
        }
      }
    }

    return null;
  };

  // 배정 루프
  while (changed) {
    changed = false;

    // 배정이 필요한 멤버 찾기 (우선순위, 배정 시간 순)
    const membersToAssign = Object.keys(assignments)
      .filter(id => {
        const requiredSlots = memberRequiredSlots[id] || assignments[id]?.requiredSlots || DEFAULT_REQUIRED_SLOTS;
        return assignments[id].assignedHours < requiredSlots;
      })
      .sort((a, b) => {
        const memberA = findMemberById(members, a);
        const memberB = findMemberById(members, b);

        const priorityA = getMemberPriority(memberA);
        const priorityB = getMemberPriority(memberB);

        if (priorityA !== priorityB) {
          return priorityB - priorityA;
        }

        return assignments[a].assignedHours - assignments[b].assignedHours;
      });

    if (membersToAssign.length === 0) break;

    for (const memberId of membersToAssign) {
      const block = findOneHourBlock(memberId, conflictingSlots, true);
      if (block) {
        assignSlot(timetable, assignments, block[0], memberId);
        assignSlot(timetable, assignments, block[1], memberId);
        changed = true;
        iterationCount++;
        break;
      }
    }
  }
};

module.exports = {
  assignByTimeOrder,
  assignUndisputedSlots,
  iterativeAssignment
};
