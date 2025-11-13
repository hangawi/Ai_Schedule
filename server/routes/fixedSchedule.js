const express = require('express');
const router = express.Router();
const { handleFixedScheduleRequest } = require('../utils/fixedScheduleHandler');
const { handleScheduleMoveRequest } = require('../utils/scheduleMoveHandler');
const {
  reoptimizeWithFixedSchedules,
  checkFixedScheduleConflicts
} = require('../services/fixedSchedule/scheduleReoptimizer');

/**
 * POST /api/schedule/fixed-intent
 * 고정 일정 관련 사용자 입력 처리
 */
router.post('/fixed-intent', async (req, res) => {
  try {
    const { message, currentSchedules, schedulesByImage, fixedSchedules } = req.body;
    // ⭐ 먼저 일정 이동 요청인지 확인
    const moveResult = handleScheduleMoveRequest(message, currentSchedules, fixedSchedules || []);
    if (moveResult.isMoveRequest && moveResult.result) {

      // 이동 성공 시 재최적화
      if (moveResult.result.success) {
        const { optimizeSchedules } = require('../utils/scheduleAutoOptimizer');

        const aiResult = await optimizeSchedules(
          moveResult.result.schedule,
          schedulesByImage || [],
          moveResult.result.fixedSchedules || []
        );

        return res.json({
          success: true,
          message: moveResult.result.explanation + '\n\n✨ AI가 최적 시간표를 다시 생성했습니다!',
          optimizedSchedule: aiResult.optimizedSchedules || aiResult,
          optimizedCombinations: [aiResult.optimizedSchedules || aiResult],
          fixedSchedules: moveResult.result.fixedSchedules
        });
      } else {
        // 이동 실패
        return res.json(moveResult.result);
      }
    }

    // ⭐ 고정 일정 "찾기"는 원본 전체에서, "재최적화"는 현재 시간표 기준으로
    // schedulesByImage: 원본 전체 스케줄 (고정 일정 찾기용)
    // currentSchedules: 현재 최적화된 시간표 (재최적화 기준)
    const allSchedulesForSearch = schedulesByImage?.flatMap(img => img.schedules || []) || [];
    const allSchedules = allSchedulesForSearch; // 일단 검색은 원본에서

    const kpops = allSchedules.filter(s => s.title?.includes('KPOP') || s.title?.includes('주니어'));

    const result = await handleFixedScheduleRequest(
      message,
      allSchedules,
      fixedSchedules || []
    );

    // 고정 일정 추가 성공 시, 기존 고정과 충돌 체크
    if (result.success && result.action === 'add' && result.schedules) {

      const newFixed = result.schedules[0]; // 새로 추가된 고정 일정
      const existingFixed = fixedSchedules || [];

      // 기존 고정 일정과 충돌 체크
      const conflictCheck = checkFixedScheduleConflicts(newFixed, existingFixed);

      let finalExistingFixed = existingFixed;
      let removedFixedSchedules = [];

      if (conflictCheck.hasConflict) {
        const conflictIds = conflictCheck.conflicts.map(c => c.id);
        finalExistingFixed = existingFixed.filter(f => !conflictIds.includes(f.id));
        removedFixedSchedules = existingFixed.filter(f => conflictIds.includes(f.id));
      }

      // AI 재최적화 호출 (충돌하는 고정 일정 제외)
      const allFixedSchedules = [...finalExistingFixed, newFixed];
      const { optimizeSchedules } = require('../utils/scheduleAutoOptimizer');

      // ⭐ 재최적화는 현재 시간표 + 고정 일정의 원본을 합쳐서 진행
      // currentSchedules: 현재 최적화된 시간표 (겹치는 것 제외된 상태)
      // 고정 일정의 원본: schedulesByImage에서 찾아서 추가
      const fixedOriginals = allFixedSchedules.map(fixed => {
        if (fixed.originalSchedule) return fixed.originalSchedule;
        // originalSchedule이 없으면 schedulesByImage에서 찾기
        const found = allSchedulesForSearch.find(s =>
          s.title === fixed.title &&
          s.startTime === fixed.startTime &&
          s.endTime === fixed.endTime
        );
        return found || fixed;
      });

      // 현재 시간표 + 고정 일정 원본 합치기
      const schedulesForReoptimization = [...currentSchedules, ...fixedOriginals];
      // 충돌 없는 스케줄로 AI 최적화 다시 실행
      const aiResult = await optimizeSchedules(
        schedulesForReoptimization, // 현재 시간표 + 고정 일정 원본
        schedulesByImage || [], // 이미지별 스케줄 (메타데이터용)
        allFixedSchedules // 고정 일정들
      );

      // optimizeSchedules는 객체를 반환 (배열이 아님!)
      const optimizedSchedule = aiResult.optimizedSchedules || [];

      // 🔍 김다희 강사가 있는지 확인
      const hasDahee = optimizedSchedule.some(s => s.title?.includes('김다희'));

      // 사용자 메시지 생성
      let userMessage = result.message;

      if (removedFixedSchedules.length > 0) {
        const removedList = removedFixedSchedules.map(f =>
          `• ${f.title} (${f.days?.join(', ')} ${f.startTime}-${f.endTime})`
        ).join('\n');
        userMessage += `\n\n⚠️ 기존 고정 일정과 겹쳐서 자동으로 제거되었습니다:\n${removedList}`;
      }

      userMessage += `\n\n✨ AI가 고정 일정을 포함한 최적 시간표를 다시 생성했습니다!`;

      // 커스텀 일정들을 범례용으로 별도 추출
      const customSchedules = allFixedSchedules
        .filter(f => f.type === 'custom')
        .map(custom => ({
          title: custom.academyName || custom.title,
          sourceImageIndex: custom.sourceImageIndex,
          schedules: [custom]
        }));

      return res.json({
        ...result,
        message: userMessage,
        hasConflict: false,
        optimizedSchedule: optimizedSchedule,
        optimizedCombinations: [optimizedSchedule], // 배열로 감싸기
        fixedSchedules: allFixedSchedules,
        customSchedules: customSchedules, // ⭐ 범례용 커스텀 일정
        removedFixedSchedules: removedFixedSchedules,
        stats: {
          total: optimizedSchedule.length,
          fixed: allFixedSchedules.length,
          combinations: 1,
          removedFixed: removedFixedSchedules.length
        }
      });
    }

    // 고정 일정 수정 (modify) 처리
    if (result.success && result.action === 'modify' && result.targetSchedule) {

      const existingFixed = fixedSchedules || [];

      // 기존 고정 일정에서 대상 제거
      const updatedFixed = existingFixed.filter(f => f.id !== result.targetSchedule.id);

      // Duration 계산 (원본 일정의 길이 유지)
      const calculateDuration = (startTime, endTime) => {
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);
        return (endHour * 60 + endMin) - (startHour * 60 + startMin);
      };

      const addMinutesToTime = (timeStr, minutes) => {
        const [hour, min] = timeStr.split(':').map(Number);
        const totalMinutes = hour * 60 + min + minutes;
        const newHour = Math.floor(totalMinutes / 60) % 24;
        const newMin = totalMinutes % 60;
        return `${newHour.toString().padStart(2, '0')}:${newMin.toString().padStart(2, '0')}`;
      };

      const duration = calculateDuration(result.targetSchedule.startTime, result.targetSchedule.endTime);
      const calculatedEndTime = addMinutesToTime(result.newSchedule.startTime, duration);

      // 새로운 시간으로 수정된 고정 일정 생성
      const modifiedFixed = {
        ...result.targetSchedule,
        days: result.newSchedule.days,
        startTime: result.newSchedule.startTime,
        endTime: result.newSchedule.endTime || calculatedEndTime // ⭐ duration 유지
      };

      const allFixedSchedules = [...updatedFixed, modifiedFixed];


      // AI 재최적화
      const { optimizeSchedules } = require('../utils/scheduleAutoOptimizer');

      const fixedOriginals = allFixedSchedules.map(fixed => {
        if (fixed.originalSchedule) return fixed.originalSchedule;
        const found = allSchedulesForSearch.find(s =>
          s.title === fixed.title &&
          s.startTime === fixed.startTime &&
          s.endTime === fixed.endTime
        );
        return found || fixed;
      });

      const schedulesForReoptimization = [...currentSchedules, ...fixedOriginals];

      const aiResult = await optimizeSchedules(
        schedulesForReoptimization,
        schedulesByImage || [],
        allFixedSchedules
      );

      const optimizedSchedule = aiResult.optimizedSchedules || [];

      return res.json({
        success: true,
        intent: result.intent,
        optimizedSchedule,
        fixedSchedules: allFixedSchedules,
        message: result.message,
        stats: {
          total: optimizedSchedule.length,
          fixed: allFixedSchedules.length
        }
      });
    }

    // 고정 일정 삭제 (remove) 처리
    if (result.success && result.action === 'remove' && result.scheduleIds) {

      const existingFixed = fixedSchedules || [];
      const updatedFixed = existingFixed.filter(f => !result.scheduleIds.includes(f.id));

      // AI 재최적화
      const { optimizeSchedules } = require('../utils/scheduleAutoOptimizer');

      const fixedOriginals = updatedFixed.map(fixed => {
        if (fixed.originalSchedule) return fixed.originalSchedule;
        const found = allSchedulesForSearch.find(s =>
          s.title === fixed.title &&
          s.startTime === fixed.startTime &&
          s.endTime === fixed.endTime
        );
        return found || fixed;
      });

      const schedulesForReoptimization = [...currentSchedules, ...fixedOriginals];

      const aiResult = await optimizeSchedules(
        schedulesForReoptimization,
        schedulesByImage || [],
        updatedFixed
      );

      const optimizedSchedule = aiResult.optimizedSchedules || [];

      // 삭제된 일정의 제목 확인 후 범례 제거
      const deletedSchedules = existingFixed.filter(f => result.scheduleIds.includes(f.id));
      const deletedTitles = deletedSchedules.map(s => s.title);

      const allRemainingSchedules = [...optimizedSchedule, ...updatedFixed];

      const titlesToRemoveFromLegend = deletedTitles.filter(title =>
        !allRemainingSchedules.some(s => s.title === title)
      );

      return res.json({
        success: true,
        intent: result.intent,
        optimizedSchedule,
        fixedSchedules: updatedFixed,
        titlesToRemoveFromLegend,
        message: result.message,
        stats: {
          total: optimizedSchedule.length,
          fixed: updatedFixed.length,
          removed: result.scheduleIds.length
        }
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/schedule/select-fixed-option
 * 사용자가 여러 옵션 중 하나를 선택
 */
router.post('/select-fixed-option', async (req, res) => {
  try {
    const { selectedSchedule, fixedSchedules, allSchedules, schedulesByImage } = req.body;

    const { convertToFixedSchedule } = require('../utils/fixedScheduleHandler');
    const newFixed = convertToFixedSchedule(selectedSchedule);

    // 기존 고정 일정과 합치기
    const allFixedSchedules = [...(fixedSchedules || []), newFixed];

    const { optimizeSchedules } = require('../utils/scheduleAutoOptimizer');

    // ⭐ 재최적화는 현재 시간표(allSchedules) + 고정 일정 원본 합치기
    const allSchedulesForSearch = schedulesByImage?.flatMap(img => img.schedules || []) || [];
    const fixedOriginals = allFixedSchedules.map(fixed => {
      if (fixed.originalSchedule) return fixed.originalSchedule;
      const found = allSchedulesForSearch.find(s =>
        s.title === fixed.title &&
        s.startTime === fixed.startTime &&
        s.endTime === fixed.endTime
      );
      return found || fixed;
    });

    const schedulesForReoptimization = [...allSchedules, ...fixedOriginals];

    // AI 최적화 실행
    const aiResult = await optimizeSchedules(
      schedulesForReoptimization,
      schedulesByImage || [],
      allFixedSchedules
    );

    const optimizedSchedule = aiResult.optimizedSchedules || [];

    return res.json({
      success: true,
      message: `"${selectedSchedule.title}" (${selectedSchedule.startTime})을 고정했습니다! ✨\n\n✨ AI가 고정 일정을 포함한 최적 시간표를 다시 생성했습니다!`,
      optimizedSchedule: optimizedSchedule,
      optimizedCombinations: [optimizedSchedule],
      fixedSchedules: allFixedSchedules,
      stats: {
        total: optimizedSchedule.length,
        fixed: allFixedSchedules.length,
        combinations: 1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/schedule/resolve-fixed-conflict
 * 고정 일정 충돌 해결
 */
router.post('/resolve-fixed-conflict', async (req, res) => {
  try {
    const {
      resolution, // 'keep_new' | 'keep_existing' | 'keep_both'
      pendingFixed,
      conflictingFixed,
      allSchedules,
      existingFixedSchedules
    } = req.body;

    let updatedFixed = [...existingFixedSchedules];

    if (resolution === 'keep_new') {
      // 기존 충돌 일정 제거, 신규 추가
      const conflictIds = new Set(conflictingFixed.map(c => c.id));
      updatedFixed = updatedFixed.filter(f => !conflictIds.has(f.id));
      updatedFixed.push(pendingFixed);

    } else if (resolution === 'keep_existing') {
      // 신규 추가 안 함, 기존 유지
    } else if (resolution === 'keep_both') {
      // 둘 다 유지 (겹침 허용)
      updatedFixed.push(pendingFixed);
    }

    // 시간표 재최적화
    const reoptResult = reoptimizeWithFixedSchedules(
      allSchedules,
      updatedFixed
    );

    res.json({
      success: true,
      resolution,
      optimizedSchedule: reoptResult.optimizedSchedule,
      fixedSchedules: reoptResult.fixedSchedules,
      stats: {
        total: reoptResult.totalCount,
        fixed: reoptResult.fixedSchedules.length,
        removed: reoptResult.removedCount
      },
      message: resolution === 'keep_new'
        ? `"${pendingFixed.title}"을(를) 고정했습니다!`
        : resolution === 'keep_existing'
          ? '기존 고정 일정을 유지합니다.'
          : '두 일정 모두 유지합니다. (겹침 허용)'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
