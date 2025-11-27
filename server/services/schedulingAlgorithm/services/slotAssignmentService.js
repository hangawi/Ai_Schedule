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

  // --- 1단계: 우선순위 완전 배정 ---
  // 최고 우선순위 멤버가 유일한 경우에만 완전 배정
  if (hasSlots) {
    console.log("\n--- 1단계: 우선순위 완전 배정 ---");
  }

  let i = 0;
  while (i < sortedKeys.length) {
    const key = sortedKeys[i];
    const slot = timetable[key];

    if (slot.assignedTo) {
      i++;
      continue;
    }

    // 가능한 멤버들과 우선순위 확인
    const availableMembers = slot.available.filter(a => !a.isOwner);
    if (availableMembers.length === 0) {
      i++;
      continue;
    }

    // 최고 우선순위 찾기
    const maxPriority = Math.max(...availableMembers.map(a => a.priority || 2));
    const highestPriorityMembers = availableMembers.filter(a => (a.priority || 2) === maxPriority);

    // 최고 우선순위가 유일한 경우에만 완전 배정 시도
    if (highestPriorityMembers.length === 1) {
      const memberId = highestPriorityMembers[0].memberId;
      const assignedHours = assignments[memberId]?.assignedHours || 0;
      const requiredSlots = memberRequiredSlots[memberId] || DEFAULT_REQUIRED_SLOTS;

      if (assignedHours < requiredSlots) {
        const remainingSlots = requiredSlots - assignedHours;
        const block = findConsecutiveBlock(i, memberId, remainingSlots);

        if (block && block.length >= remainingSlots) {
          const blockToAssign = block.slice(0, remainingSlots);
          logAssignment(memberId, blockToAssign, '완전');

          for (const blockKey of blockToAssign) {
            assignSlot(timetable, assignments, blockKey, memberId);
          }

          i += blockToAssign.length;
          continue;
        }
      }
    }

    i++;
  }

  if (hasSlots) {
    console.log("--- 1단계 완료 ---");
  }

  // --- 2단계: 균등 분할 배정 (남은 멤버) ---
  const remainingMembers = Object.keys(assignments).filter(id => (assignments[id].assignedHours || 0) < (memberRequiredSlots[id] || DEFAULT_REQUIRED_SLOTS));

  if (hasSlots && remainingMembers.length > 0) {
    console.log("\n--- 2단계: 균등 분할 배정 (남은 멤버", remainingMembers.length, "명) ---");
  } else if (!hasSlots) {
    // 슬롯이 없으면 로그 스킵
  } else {
    if (hasSlots) console.log("\n--- 모든 멤버 배정 완료 ---");
  }

  for (const memberId of remainingMembers) {
    if (!hasSlots) continue;
    
    const assignedHours = assignments[memberId]?.assignedHours || 0;
    const requiredSlots = memberRequiredSlots[memberId] || DEFAULT_REQUIRED_SLOTS;
    const remainingSlots = requiredSlots - assignedHours;
    
    console.log(`\n📋 [${memberId.substring(0,6)}] 필요: ${remainingSlots}슬롯`);
    
    // 모든 가능한 블록 찾기
    const findAllAvailableBlocks = () => {
      const blocks = [];
      let totalSlotsChecked = 0;
      let assignedSlotsCount = 0;
      let unavailableSlotsCount = 0;
      let blocksFoundCount = 0;

      console.log(`🔍 블록 탐색 중 (전체 슬롯: ${sortedKeys.length}개)`);

      for (let j = 0; j < sortedKeys.length; j++) {
        const key = sortedKeys[j];
        const slot = timetable[key];
        totalSlotsChecked++;

        if (slot.assignedTo) {
          assignedSlotsCount++;
          continue;
        }

        const isAvailable = slot.available.some(a => a.memberId === memberId && !a.isOwner);
        if (!isAvailable) {
          unavailableSlotsCount++;
          continue;
        }

        const block = findConsecutiveBlock(j, memberId, remainingSlots);
        if (block && block.length > 0) {
          const startKey = block[0];
          const endKey = block[block.length - 1];
          const blockDateStr = extractDateFromSlotKey(startKey);
          const startTime = extractTimeFromSlotKey(startKey);
          const endTime = extractTimeFromSlotKey(endKey);

          blocksFoundCount++;
          console.log(`   찾음 #${blocksFoundCount}: ${blockDateStr} ${startTime}~ (${block.length}슬롯)`);
          blocks.push(block);
        }
      }

      console.log(`   → 체크: ${totalSlotsChecked}슬롯, 이미배정: ${assignedSlotsCount}, 불가: ${unavailableSlotsCount}, 블록발견: ${blocksFoundCount}`);
      return blocks;
    };

    const allBlocks = findAllAvailableBlocks();
    
    if (allBlocks.length === 0) {
      console.log(`   → 가능한 블록 없음`);
      continue;
    }

    // 균등 분할 시도: 남은 슬롯을 2개로 나누기
    const targetSize = Math.ceil(remainingSlots / 2);
    let totalAssigned = 0;

    // 첫 번째 블록
    let firstBlock = null;
    for (const block of allBlocks) {
      if (block.length >= targetSize) {
        firstBlock = block.slice(0, targetSize);
        break;
      }
    }

    if (!firstBlock && allBlocks.length > 0) {
      const longestBlock = allBlocks.reduce((max, block) => 
        block.length > max.length ? block : max
      , allBlocks[0]);
      firstBlock = longestBlock;
    }

    if (firstBlock) {
      logAssignment(memberId, firstBlock, '부분1');
      for (const blockKey of firstBlock) {
        assignSlot(timetable, assignments, blockKey, memberId);
      }
      totalAssigned += firstBlock.length;
    }

    // 두 번째 블록
    const stillNeeded = remainingSlots - totalAssigned;
    if (stillNeeded > 0) {
      
      const secondBlocks = findAllAvailableBlocks();
      
      if (secondBlocks.length > 0) {
        let secondBlock = null;
        for (const block of secondBlocks) {
          if (block.length >= stillNeeded) {
            secondBlock = block.slice(0, stillNeeded);
            break;
          }
        }
        
        if (!secondBlock) {
          const longestBlock = secondBlocks.reduce((max, block) => 
            block.length > max.length ? block : max
          , secondBlocks[0]);
          secondBlock = longestBlock;
        }
        
        if (secondBlock) {
          logAssignment(memberId, secondBlock, '부분2');
          for (const blockKey of secondBlock) {
            assignSlot(timetable, assignments, blockKey, memberId);
          }
          totalAssigned += secondBlock.length;
        }
      }
    }

    // 세 번째 블록
    const finalNeeded = remainingSlots - totalAssigned;
    if (finalNeeded > 0) {
      const thirdBlocks = findAllAvailableBlocks();
      
      if (thirdBlocks.length > 0) {
        let thirdBlock = null;
        for (const block of thirdBlocks) {
          if (block.length >= finalNeeded) {
            thirdBlock = block.slice(0, finalNeeded);
            break;
          }
        }
        
        if (!thirdBlock) {
          const longestBlock = thirdBlocks.reduce((max, block) => 
            block.length > max.length ? block : max
          , thirdBlocks[0]);
          thirdBlock = longestBlock;
        }
        
        if (thirdBlock) {
          logAssignment(memberId, thirdBlock, '부분3');
          for (const blockKey of thirdBlock) {
            assignSlot(timetable, assignments, blockKey, memberId);
          }
          totalAssigned += thirdBlock.length;
        }
      }
    }

    const finalShortage = remainingSlots - totalAssigned;
    if (finalShortage > 0) {
      console.log(`   → 최종: ${totalAssigned}/${remainingSlots}슬롯 (부족: ${finalShortage})`);
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
