/**
 * 슬롯 배정 서비스
 */

const { DEFAULT_REQUIRED_SLOTS, MAX_ITERATION_ROUNDS, FAIRNESS_GAP_THRESHOLD } = require('../constants/schedulingConstants');
const { extractDateFromSlotKey, extractTimeFromSlotKey, areConsecutiveSlots } = require('../utils/slotUtils');
const { createConflictKeysSet, createConflictingMembersSet, getMemberConflicts, getMemberConflictDates, isMemberHighestPriority, isUniqueHighestPriority, getCoConflictingMembers } = require('../validators/conflictValidator');
const { assignSlot, isMemberFullyAssigned } = require('../helpers/assignmentHelper');
const { getMemberPriority, findMemberById } = require('../helpers/memberHelper');

/**
 * 시간 순서 우선 배정 (연속 블록 단위로 배정)
 * @param {Object} timetable - 타임테이블 객체
 * @param {Object} assignments - assignments 객체
 * @param {Object} memberRequiredSlots - 필요 슬롯 정보
 * @param {string} ownerId - 방장 ID
 */
const assignByTimeOrder = (timetable, assignments, memberRequiredSlots, ownerId) => {
  const sortedKeys = Object.keys(timetable).sort();
  const hasSlots = sortedKeys.length > 0;

  if (hasSlots) {
    console.log('\n🕐 시간 순서 배정 시작 (슬롯:', sortedKeys.length, '개)');
  }

  const findConsecutiveBlock = (startIndex, memberId, maxSlots) => {
    const blockKeys = [];
    for (let i = startIndex; i < sortedKeys.length; i++) {
      const key = sortedKeys[i];
      const slot = timetable[key];
      if (slot.assignedTo) break;
      const canUse = slot.available.some(a => a.memberId === memberId && !a.isOwner);
      if (!canUse) break;
      if (blockKeys.length > 0 && !areConsecutiveSlots(blockKeys[blockKeys.length - 1], key)) break;
      blockKeys.push(key);
      if (blockKeys.length >= maxSlots) break;
    }
    return blockKeys.length > 0 ? blockKeys : null;
  };

  const logAssignment = (memberId, block, fitType) => {
      const startKey = block[0];
      const endKey = block[block.length - 1];
      const blockDateStr = extractDateFromSlotKey(startKey);
      const startTime = extractTimeFromSlotKey(startKey);
      const endTime = extractTimeFromSlotKey(endKey);

      const [endH, endM] = endTime.split(':').map(Number);
      let finalEndH = endH;
      let finalEndM = endM + 30;
      if (finalEndM >= 60) {
        finalEndM = 0;
        finalEndH++;
      }
      const finalEndTime = `${String(finalEndH).padStart(2, '0')}:${String(finalEndM).padStart(2, '0')}`;

      const beforeAssigned = assignments[memberId]?.assignedHours || 0;
      const afterAssigned = beforeAssigned + block.length;
      const remainingAfter = (memberRequiredSlots[memberId] || DEFAULT_REQUIRED_SLOTS) - afterAssigned;

      console.log(`  ✅ [${fitType}] ${memberId.substring(0, 8)}... → ${blockDateStr} ${startTime}-${finalEndTime} (${block.length} 슬롯)`);
      console.log(`     (통계: ${beforeAssigned}→${afterAssigned} 슬롯, 남은 필요량: ${remainingAfter})`);
  };

  // 🆕 1단계: 가용 슬롯이 적은 멤버 우선 배정 (선택지 적은 멤버 우선)
  if (hasSlots) {
    console.log("\n--- 1단계: 선택지 적은 멤버 우선 배정 ---");
  }

  // 각 멤버의 가용 슬롯 수 계산
  const memberAvailableSlots = {};
  const memberMaxPriority = {};

  Object.keys(assignments).forEach(memberId => {
    let availableCount = 0;
    let maxPriority = 0;

    sortedKeys.forEach(key => {
      const slot = timetable[key];
      if (!slot.assignedTo) {
        const memberAvail = slot.available.find(a => a.memberId === memberId && !a.isOwner);
        if (memberAvail) {
          availableCount++;
          maxPriority = Math.max(maxPriority, memberAvail.priority || 2);
        }
      }
    });

    memberAvailableSlots[memberId] = availableCount;
    memberMaxPriority[memberId] = maxPriority;
  });

  // 가용 슬롯이 적은 멤버부터 처리 (선택지가 적은 멤버 우선)
  const membersByAvailability = Object.keys(assignments)
    .filter(memberId => {
      const assignedHours = assignments[memberId]?.assignedHours || 0;
      const requiredSlots = memberRequiredSlots[memberId] || DEFAULT_REQUIRED_SLOTS;
      return assignedHours < requiredSlots;
    })
    .sort((a, b) => {
      // 우선순위가 다르면 우선순위 높은 순
      const priorityDiff = memberMaxPriority[b] - memberMaxPriority[a];
      if (priorityDiff !== 0) return priorityDiff;

      // 우선순위가 같으면 가용 슬롯 적은 순 (선택지 적은 순)
      return memberAvailableSlots[a] - memberAvailableSlots[b];
    });

  if (hasSlots && membersByAvailability.length > 0) {
    console.log("📊 멤버 처리 순서 (우선순위 높음→가용슬롯 적음):");
    membersByAvailability.forEach(memberId => {
      console.log(`   ${memberId.substring(0,6)}: 우선순위 ${memberMaxPriority[memberId]}, 가용 ${memberAvailableSlots[memberId]}슬롯`);
    });
  }

  // 각 멤버를 순서대로 배정
  for (const memberId of membersByAvailability) {
    const assignedHours = assignments[memberId]?.assignedHours || 0;
    const requiredSlots = memberRequiredSlots[memberId] || DEFAULT_REQUIRED_SLOTS;
    const remainingSlots = requiredSlots - assignedHours;

    if (remainingSlots <= 0) continue;

    console.log(`\n📋 [${memberId.substring(0,6)}] 필요: ${remainingSlots}슬롯, 가용: ${memberAvailableSlots[memberId]}슬롯`);

    // 시간 순서대로 가장 이른 블록 찾기
    for (let i = 0; i < sortedKeys.length; i++) {
      const key = sortedKeys[i];
      const slot = timetable[key];

      if (slot.assignedTo) continue;

      const canUse = slot.available.some(a => a.memberId === memberId && !a.isOwner);
      if (!canUse) continue;

      // 연속 블록 찾기
      const block = findConsecutiveBlock(i, memberId, remainingSlots);

      if (block && block.length > 0) {
        const assignedHoursBefore = assignments[memberId]?.assignedHours || 0;
        const stillNeeded = requiredSlots - assignedHoursBefore;

        const blockToAssign = block.slice(0, Math.min(block.length, stillNeeded));
        logAssignment(memberId, blockToAssign, '배정');

        for (const blockKey of blockToAssign) {
          assignSlot(timetable, assignments, blockKey, memberId);
        }

        // 배정 완료 여부 확인
        const assignedHoursAfter = assignments[memberId]?.assignedHours || 0;
        if (assignedHoursAfter >= requiredSlots) {
          console.log(`   → 완료: ${assignedHoursAfter}/${requiredSlots}슬롯 ✓`);
          break;
        }
      }
    }

    // 최종 상태 확인
    const finalAssigned = assignments[memberId]?.assignedHours || 0;
    const finalShortage = requiredSlots - finalAssigned;
    if (finalShortage > 0) {
      console.log(`   → 부족: ${finalAssigned}/${requiredSlots}슬롯 (부족: ${finalShortage})`);
    }
  }

  if (hasSlots) {
    console.log("--- 1단계 완료 ---");
  }

  // 🆕 2단계: 남은 슬롯 추가 배정 (부족분 처리)
  if (hasSlots) {
    console.log("\n--- 2단계: 남은 슬롯 추가 배정 ---");
  }

  // 아직 부족한 멤버들 찾기
  const stillNeedingMembers = Object.keys(assignments)
    .filter(memberId => {
      const assignedHours = assignments[memberId]?.assignedHours || 0;
      const requiredSlots = memberRequiredSlots[memberId] || DEFAULT_REQUIRED_SLOTS;
      return assignedHours < requiredSlots;
    })
    .sort((a, b) => {
      // 우선순위 높은 순
      const priorityDiff = memberMaxPriority[b] - memberMaxPriority[a];
      if (priorityDiff !== 0) return priorityDiff;

      // 배정된 시간이 적은 순
      const assignedA = assignments[a]?.assignedHours || 0;
      const assignedB = assignments[b]?.assignedHours || 0;
      return assignedA - assignedB;
    });

  for (const memberId of stillNeedingMembers) {
    const assignedHours = assignments[memberId]?.assignedHours || 0;
    const requiredSlots = memberRequiredSlots[memberId] || DEFAULT_REQUIRED_SLOTS;
    const remainingSlots = requiredSlots - assignedHours;

    console.log(`\n📋 [${memberId.substring(0,6)}] 추가 필요: ${remainingSlots}슬롯`);

    // 가능한 모든 블록 찾기
    const allBlocks = [];
    for (let i = 0; i < sortedKeys.length; i++) {
      const key = sortedKeys[i];
      const slot = timetable[key];

      if (slot.assignedTo) continue;

      const canUse = slot.available.some(a => a.memberId === memberId && !a.isOwner);
      if (!canUse) continue;

      const block = findConsecutiveBlock(i, memberId, remainingSlots);
      if (block && block.length > 0) {
        allBlocks.push(block);
      }
    }

    if (allBlocks.length === 0) {
      console.log(`   → 가능한 블록 없음`);
      continue;
    }

    // 가장 긴 블록부터 배정
    allBlocks.sort((a, b) => b.length - a.length);

    let totalAssigned = 0;
    for (const block of allBlocks) {
      if (totalAssigned >= remainingSlots) break;

      const stillNeeded = remainingSlots - totalAssigned;
      const blockToAssign = block.slice(0, Math.min(block.length, stillNeeded));

      // 이미 배정된 슬롯이 있는지 확인
      const hasAssigned = blockToAssign.some(key => timetable[key].assignedTo);
      if (hasAssigned) continue;

      logAssignment(memberId, blockToAssign, '추가');

      for (const blockKey of blockToAssign) {
        assignSlot(timetable, assignments, blockKey, memberId);
      }

      totalAssigned += blockToAssign.length;
    }

    const finalShortage = remainingSlots - totalAssigned;
    if (finalShortage > 0) {
      console.log(`   → 최종 부족: ${totalAssigned}/${remainingSlots}슬롯 (부족: ${finalShortage})`);
    } else {
      console.log(`   → 완료: ${totalAssigned}/${remainingSlots}슬롯 ✓`);
    }
  }

  if (hasSlots) {
    console.log("\n✅ 배정 완료\n");
  }
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
