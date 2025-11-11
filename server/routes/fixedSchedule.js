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

    console.log('\n🔥 요청:', message);
    console.log('현재:', currentSchedules?.length, '개');
    console.log('이미지:', schedulesByImage?.length, '개');

    // ⭐ 먼저 일정 이동 요청인지 확인
    const moveResult = handleScheduleMoveRequest(message, currentSchedules, fixedSchedules || []);
    if (moveResult.isMoveRequest && moveResult.result) {
      console.log('✅ 일정 이동 요청 처리 완료');

      // 이동 성공 시 재최적화
      if (moveResult.result.success) {
        console.log('\n🤖 AI 재최적화 시작...');
        const { optimizeSchedules } = require('../utils/scheduleAutoOptimizer');

        const aiResult = await optimizeSchedules(
          moveResult.result.schedule,
          schedulesByImage || [],
          moveResult.result.fixedSchedules || []
        );

        console.log('✅ AI 재최적화 완료:', aiResult.optimizedSchedules?.length, '개');

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

    console.log('사용할 스케줄 (검색용 - 원본):', allSchedules.length, '개');

    const kpops = allSchedules.filter(s => s.title?.includes('KPOP') || s.title?.includes('주니어'));
    console.log('KPOP/주니어:', kpops.map(s =>
      `"${s.title}" (${s.instructor || 'N/A'}) ${s.days} ${s.startTime}-${s.endTime} academyName=${s.academyName || 'X'}`
    ));

    const result = await handleFixedScheduleRequest(
      message,
      allSchedules,
      fixedSchedules || []
    );

    console.log('결과:', result.success ? '✅ SUCCESS' : '❌ FAIL');
    console.log('메시지:', result.message);

    // 고정 일정 추가 성공 시, 기존 고정과 충돌 체크
    if (result.success && result.action === 'add' && result.schedules) {
      console.log('고정된 스케줄:', result.schedules.map(s =>
        `"${s.title}" ${s.days} ${s.startTime}-${s.endTime}`
      ));

      const newFixed = result.schedules[0]; // 새로 추가된 고정 일정
      const existingFixed = fixedSchedules || [];

      // 기존 고정 일정과 충돌 체크
      const conflictCheck = checkFixedScheduleConflicts(newFixed, existingFixed);

      let finalExistingFixed = existingFixed;
      let removedFixedSchedules = [];

      if (conflictCheck.hasConflict) {
        // 충돌 발생 → 자동으로 충돌하는 기존 고정 일정 제거
        console.warn('⚠️ 기존 고정 일정과 충돌 발견:', conflictCheck.conflicts);
        console.log('🔧 충돌하는 고정 일정을 자동으로 제거합니다...');

        const conflictIds = conflictCheck.conflicts.map(c => c.id);
        finalExistingFixed = existingFixed.filter(f => !conflictIds.includes(f.id));
        removedFixedSchedules = existingFixed.filter(f => conflictIds.includes(f.id));

        console.log(`✅ 제거된 고정 일정: ${removedFixedSchedules.length}개`);
        removedFixedSchedules.forEach(f => {
          console.log(`   - ${f.title} (${f.days?.join(', ')} ${f.startTime}-${f.endTime})`);
        });
      }

      // AI 재최적화 호출 (충돌하는 고정 일정 제외)
      const allFixedSchedules = [...finalExistingFixed, newFixed];

      console.log('\n🤖 AI 재최적화 시작...');
      console.log('  - 전체 고정 일정:', allFixedSchedules.length, '개');

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

      console.log('  - 재최적화 입력:', schedulesForReoptimization.length, '개');
      console.log('    (현재:', currentSchedules.length, '+ 고정 원본:', fixedOriginals.length, ')');

      // 충돌 없는 스케줄로 AI 최적화 다시 실행
      const aiResult = await optimizeSchedules(
        schedulesForReoptimization, // 현재 시간표 + 고정 일정 원본
        schedulesByImage || [], // 이미지별 스케줄 (메타데이터용)
        allFixedSchedules // 고정 일정들
      );

      console.log(`✅ AI 재최적화 완료`);
      console.log('  - optimizedSchedules:', aiResult.optimizedSchedules?.length, '개');

      // optimizeSchedules는 객체를 반환 (배열이 아님!)
      const optimizedSchedule = aiResult.optimizedSchedules || [];

      console.log('\n📊 재최적화 결과 상세:');
      console.log('  - optimizedSchedule:', optimizedSchedule.length, '개');
      console.log('  - 고정 일정:', allFixedSchedules.length, '개');
      console.log('  - 첫 5개 스케줄:', optimizedSchedule.slice(0, 5).map(s =>
        `${s.title} (${s.days} ${s.startTime}-${s.endTime})`
      ));

      // 🔍 김다희 강사가 있는지 확인
      const hasDahee = optimizedSchedule.some(s => s.title?.includes('김다희'));
      console.log('  - 🔍 김다희 강사 포함 여부:', hasDahee);
      if (hasDahee) {
        const daheeSchedules = optimizedSchedule.filter(s => s.title?.includes('김다희'));
        console.log('  - ⚠️ 김다희 강사 스케줄:', daheeSchedules.map(s =>
          `${s.title} (${s.days} ${s.startTime}-${s.endTime})`
        ));
      }

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

      console.log('📌 customSchedules 생성:', customSchedules.length, '개');
      customSchedules.forEach(c => {
        console.log(`  - ${c.title} (sourceImageIndex: ${c.sourceImageIndex})`);
      });

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

    res.json(result);
  } catch (error) {
    console.error('❌ 고정 일정 처리 오류:', error);
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

    console.log('\n✅ 사용자 선택:', selectedSchedule.title, selectedSchedule.startTime);

    const { convertToFixedSchedule } = require('../utils/fixedScheduleHandler');
    const newFixed = convertToFixedSchedule(selectedSchedule);

    // 기존 고정 일정과 합치기
    const allFixedSchedules = [...(fixedSchedules || []), newFixed];

    console.log('\n🤖 AI 재최적화 시작...');
    console.log('  - 전체 고정 일정:', allFixedSchedules.length, '개');

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

    console.log('  - 재최적화 입력:', schedulesForReoptimization.length, '개');
    console.log('    (현재:', allSchedules.length, '+ 고정 원본:', fixedOriginals.length, ')');

    // AI 최적화 실행
    const aiResult = await optimizeSchedules(
      schedulesForReoptimization,
      schedulesByImage || [],
      allFixedSchedules
    );

    console.log(`✅ AI 재최적화 완료`);
    console.log('  - optimizedSchedules:', aiResult.optimizedSchedules?.length, '개');

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
    console.error('❌ 옵션 선택 오류:', error);
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

    console.log('\n🔧 충돌 해결:', resolution);
    console.log('  신규:', pendingFixed?.title);
    console.log('  기존:', conflictingFixed?.map(c => c.title).join(', '));

    let updatedFixed = [...existingFixedSchedules];

    if (resolution === 'keep_new') {
      // 기존 충돌 일정 제거, 신규 추가
      const conflictIds = new Set(conflictingFixed.map(c => c.id));
      updatedFixed = updatedFixed.filter(f => !conflictIds.has(f.id));
      updatedFixed.push(pendingFixed);

      console.log('✅ 신규 유지, 기존 제거');
    } else if (resolution === 'keep_existing') {
      // 신규 추가 안 함, 기존 유지
      console.log('✅ 기존 유지, 신규 취소');
    } else if (resolution === 'keep_both') {
      // 둘 다 유지 (겹침 허용)
      updatedFixed.push(pendingFixed);
      console.log('⚠️ 둘 다 유지 (겹침 허용)');
    }

    // 시간표 재최적화
    const reoptResult = reoptimizeWithFixedSchedules(
      allSchedules,
      updatedFixed
    );

    console.log(`✅ 재최적화 완료: ${reoptResult.totalCount}개`);

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
    console.error('❌ 충돌 해결 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
