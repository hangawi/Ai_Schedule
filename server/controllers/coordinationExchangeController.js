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

const Room = require('../models/Room');
const ActivityLog = require('../models/ActivityLog');
const { parseMessage } = require('./coordinationExchangeController/services/geminiService');
const { handleDateChange } = require('./coordinationExchangeController/services/dateChangeService');
const { validateRoomExists, validateIsMember, validateMessage } = require('./coordinationExchangeController/validators/roomValidator');
const { DAY_MAP_KO_TO_EN } = require('./coordinationExchangeController/constants/dayMappings');
const { addHours, getHoursDifference } = require('./coordinationExchangeController/utils/timeUtils');

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
    console.error('Parse exchange request error:', error);
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

    console.log('🚀 ========== SMART EXCHANGE REQUEST (FULLY REFACTORED) ==========');
    console.log('📝 Request params:', { roomId, type, targetDay, targetTime, viewMode, weekNumber, weekOffset, sourceWeekOffset, sourceDay, sourceTime, sourceDayStr, sourceMonth, sourceYear, targetMonth, targetYear, targetDateNum });
    console.log('👤 Requester user ID:', req.user.id);

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
      console.log('✅ Using refactored dateChangeService');
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

    console.log(`📅 Current week Monday: ${monday.toISOString().split('T')[0]} (from today: ${now.toISOString().split('T')[0]})`);

    // currentWeekStartDate가 제공되고 weekOffset이 없으면 해당 주 기준으로 계산
    if (currentWeekStartDate && !weekOffset && weekOffset !== 0) {
      const providedDate = new Date(currentWeekStartDate);
      const providedDay = providedDate.getUTCDay();
      const providedDiff = providedDate.getUTCDate() - providedDay + (providedDay === 0 ? -6 : 1);
      monday = new Date(providedDate);
      monday.setUTCDate(providedDiff);
      monday.setUTCHours(0, 0, 0, 0);
      console.log(`📅 Using provided week Monday: ${monday.toISOString().split('T')[0]}`);
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
      console.log(`📅 Week offset ${weekOffset}: Target date = ${targetDate.toISOString().split('T')[0]}`);
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
      console.log(`📅 ${targetMonth ? `${targetMonth}월` : 'Current month'} ${weekNumber}번째 ${targetDay}: Target date = ${targetDate.toISOString().split('T')[0]}`);
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

    console.log(`🔍 [방장 검증] Target day: ${targetDayEnglish} (dayOfWeek: ${targetDayOfWeek}), date: ${targetDateStr}`);
    console.log(`👑 Owner defaultSchedule: ${ownerDefaultSchedule.length} entries`);

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

    console.log(`📅 [방장 검증] Owner schedules for ${targetDateStr}: ${ownerTargetSchedules.length} entries`);

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
        targetTimeMinutes >= block.start
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

      console.log(`✅ [방장 검증] 통과: ${targetTime}은 방장의 선호시간 내에 있습니다.`);
    }

    // Find requester's current slots
    const requesterCurrentSlots = room.timeSlots.filter(slot => {
      const slotUserId = (slot.user._id || slot.user).toString();
      const isUserSlot = slotUserId === req.user.id.toString();
      const isValidSubject = slot.subject === '자동 배정' || slot.subject === '교환 결과' || slot.subject === '자동 재배치';
      return isUserSlot && isValidSubject;
    });

    if (requesterCurrentSlots.length === 0) {
      return res.status(400).json({
        success: false,
        message: '현재 배정된 시간이 없습니다. 먼저 자동 배정을 받으세요.'
      });
    }

    console.log(`📋 Found ${requesterCurrentSlots.length} slots for user`);

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

    console.log(`📦 Found ${continuousBlocks.length} continuous blocks`);
    continuousBlocks.forEach((block, idx) => {
      console.log(`   Block ${idx + 1}: ${block[0].day} ${new Date(block[0].date).toISOString().split('T')[0]} ${block[0].startTime}-${block[block.length - 1].endTime} (${block.length} slots)`);
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

    console.log(`📅 Source week: ${sourceWeekMonday.toISOString().split('T')[0]} ~ ${sourceWeekSunday.toISOString().split('T')[0]}`);

    const sourceWeekBlocks = continuousBlocks.filter(block => {
      const blockDate = new Date(block[0].date);
      return blockDate >= sourceWeekMonday && blockDate <= sourceWeekSunday;
    });

    console.log(`📊 Found ${sourceWeekBlocks.length} blocks in source week`);
    sourceWeekBlocks.forEach((block, idx) => {
      console.log(`   Week Block ${idx + 1}: ${block[0].day} ${new Date(block[0].date).toISOString().split('T')[0]}`);
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
      console.log(`🔍 Filtering by source day: "${sourceDayStr}" → "${sourceDayEnglish}"`);
      candidateBlocks = sourceWeekBlocks.filter(block => {
        const match = block[0].day === sourceDayEnglish;
        console.log(`   Checking block: ${block[0].day} === ${sourceDayEnglish} ? ${match}`);
        return match;
      });
    }

    console.log(`✅ Final candidate blocks: ${candidateBlocks.length}`);

    if (candidateBlocks.length > 0) {
      const blocksNotOnTargetDay = candidateBlocks.filter(block => block[0].day !== targetDayEnglish);
      const blocksOnTargetDay = candidateBlocks.filter(block => block[0].day === targetDayEnglish);
      selectedBlock = blocksNotOnTargetDay.length > 0 ? blocksNotOnTargetDay[0] :
                     blocksOnTargetDay.length > 0 ? blocksOnTargetDay[0] : candidateBlocks[0];
    } else {
      if (sourceWeekOffset !== null && sourceWeekOffset !== undefined) {
        const weekNames = { '-2': '지지난주', '-1': '저번주', '0': '이번주', '1': '다음주' };
        const weekName = weekNames[sourceWeekOffset.toString()] || `${sourceWeekOffset}주 전`;
        return res.status(400).json({
          success: false,
          message: `${weekName} ${sourceDayStr || '해당'}에 배정된 일정이 없습니다.`
        });
      }
      const blocksNotOnTargetDay = continuousBlocks.filter(block => block[0].day !== targetDayEnglish);
      selectedBlock = blocksNotOnTargetDay.length > 0 ? blocksNotOnTargetDay[0] : continuousBlocks[0];
    }

    const allSlotsInBlock = selectedBlock;
    const blockStartTime = allSlotsInBlock[0].startTime;
    const blockEndTime = allSlotsInBlock[allSlotsInBlock.length - 1].endTime;
    const totalHours = getHoursDifference(blockStartTime, blockEndTime);
    const newStartTime = targetTime || blockStartTime;
    const newEndTime = addHours(newStartTime, totalHours);

    // ✅ Owner validation already done above (lines 240-267) - removed duplicate

    // Check MEMBER's preferred schedule
    const requesterUser = memberData.user;
    const requesterDefaultSchedule = requesterUser.defaultSchedule || [];
    const memberTargetDaySchedules = requesterDefaultSchedule.filter(s => s.dayOfWeek === targetDayOfWeek);

    if (memberTargetDaySchedules.length === 0) {
      return res.status(400).json({
        success: false,
        message: `${targetDay}는 당신의 선호 시간이 아닙니다. 본인이 설정한 선호 요일로만 변경할 수 있습니다.`
      });
    }

    // Merge and find overlapping time ranges
    const mergeSlots = (schedules) => {
      const sorted = [...schedules].sort((a, b) => {
        const [aH, aM] = a.startTime.split(':').map(Number);
        const [bH, bM] = b.startTime.split(':').map(Number);
        return (aH * 60 + aM) - (bH * 60 + bM);
      });

      const merged = [];
      let current = null;

      for (const schedule of sorted) {
        const [startH, startM] = schedule.startTime.split(':').map(Number);
        const [endH, endM] = schedule.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (!current) {
          current = { startMinutes, endMinutes, startTime: schedule.startTime, endTime: schedule.endTime };
        } else {
          if (startMinutes <= current.endMinutes) {
            current.endMinutes = Math.max(current.endMinutes, endMinutes);
            current.endTime = schedule.endTime;
          } else {
            merged.push({ ...current });
            current = { startMinutes, endMinutes, startTime: schedule.startTime, endTime: schedule.endTime };
          }
        }
      }
      if (current) merged.push(current);
      return merged;
    };

    const ownerMergedRanges = mergeSlots(ownerTargetDaySchedules);
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

      // Remove old slots
      const slotIdsToRemove = allSlotsInBlock.map(slot => slot._id.toString());
      for (const slotId of slotIdsToRemove) {
        const index = room.timeSlots.findIndex(slot => slot._id.toString() === slotId);
        if (index !== -1) room.timeSlots.splice(index, 1);
      }

      // Create new slots
      const totalMinutes = (parseInt(finalNewEndTime.split(':')[0]) * 60 + parseInt(finalNewEndTime.split(':')[1])) -
                          (parseInt(finalNewStartTime.split(':')[0]) * 60 + parseInt(finalNewStartTime.split(':')[1]));
      const numSlots = Math.ceil(totalMinutes / 30);
      const newSlots = [];
      let currentTime = finalNewStartTime;

      for (let i = 0; i < numSlots; i++) {
        const slotEndTime = addHours(currentTime, 0.5);
        newSlots.push({
          user: req.user.id,
          date: targetDate,
          startTime: currentTime,
          endTime: slotEndTime,
          day: targetDayEnglish,
          priority: allSlotsInBlock[0]?.priority || 3,
          subject: '자동 배정',
          assignedBy: room.owner._id,
          assignedAt: new Date(),
          status: 'confirmed'
        });
        currentTime = slotEndTime;
      }

      room.timeSlots.push(...newSlots);
      await room.save();
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

      return res.json({
        success: true,
        message: `${formattedDate} ${finalNewStartTime}-${finalNewEndTime}로 즉시 변경되었습니다!`,
        immediateSwap: true,
        targetDay,
        targetTime: finalNewStartTime
      });
    }

    // Case 2: Target slot is occupied
    console.log('🔔 Target slot is occupied');

    // Auto-placement if no specific time requested
    if (!targetTime) {
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
          currentStart += 30;
        }
        if (foundSlot) break;
      }

      if (foundSlot) {
        const autoStartTime = `${String(Math.floor(foundSlot.start / 60)).padStart(2, '0')}:${String(foundSlot.start % 60).padStart(2, '0')}`;
        const autoEndTime = `${String(Math.floor(foundSlot.end / 60)).padStart(2, '0')}:${String(foundSlot.end % 60).padStart(2, '0')}`;

        const slotIdsToRemove = allSlotsInBlock.map(slot => slot._id.toString());
        for (const slotId of slotIdsToRemove) {
          const index = room.timeSlots.findIndex(slot => slot._id.toString() === slotId);
          if (index !== -1) room.timeSlots.splice(index, 1);
        }

        let currentTime = autoStartTime;
        for (let i = 0; i < allSlotsInBlock.length; i++) {
          const slotEndTime = addHours(currentTime, 0.5);
          room.timeSlots.push({
            user: req.user.id,
            date: targetDate,
            startTime: currentTime,
            endTime: slotEndTime,
            day: targetDayEnglish,
            priority: allSlotsInBlock[i].priority || 3,
            subject: '자동 배정',
            assignedBy: room.owner._id,
            assignedAt: new Date(),
            status: 'confirmed'
          });
          currentTime = slotEndTime;
        }

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

        return res.json({
          success: true,
          message: `${autoFormattedDate} ${autoStartTime}-${autoEndTime}로 자동 배치되었습니다!`,
          immediateSwap: true,
          targetDay,
          targetTime: autoStartTime
        });
      }
    }

    // Create yield request
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
    console.error('Smart exchange error:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      details: error.message
    });
  }
};
