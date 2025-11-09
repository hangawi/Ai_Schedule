const express = require('express');
const router = express.Router();
const { handleFixedScheduleRequest } = require('../utils/fixedScheduleHandler');
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

    // ⭐ 범례의 원본 시간표를 사용 (schedulesByImage가 이미 academyName, subjectName 포함)
    // schedulesByImage는 optimizeSchedules를 거쳐서 academyName, subjectName이 추가된 상태
    const allSchedules = schedulesByImage?.flatMap(img => img.schedules || []) || [];

    console.log('사용할 스케줄 (원본):', allSchedules.length, '개');

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

      if (conflictCheck.hasConflict) {
        // 충돌 발생 → 사용자에게 선택 요청
        console.warn('⚠️ 기존 고정 일정과 충돌 발견:', conflictCheck.conflicts);

        return res.json({
          ...result,
          hasConflict: true,
          conflictType: 'fixed_schedule',
          conflicts: conflictCheck.conflicts,
          pendingFixed: newFixed, // 추가 대기 중인 고정 일정
          message: `"${newFixed.title}"이(가) 기존 고정 일정과 겹칩니다.\n\n겹치는 일정:\n${conflictCheck.conflicts.map(c => `• ${c.title} (${c.days?.join(', ')} ${c.time})`).join('\n')}\n\n어떻게 하시겠어요?`
        });
      }

      // 충돌 없음 → 시간표 재최적화
      const reoptResult = reoptimizeWithFixedSchedules(
        allSchedules,
        existingFixed,
        newFixed
      );

      console.log(`✅ 재최적화 완료: ${reoptResult.totalCount}개 (제외: ${reoptResult.removedCount}개)`);

      return res.json({
        ...result,
        hasConflict: false,
        optimizedSchedule: reoptResult.optimizedSchedule,
        fixedSchedules: reoptResult.fixedSchedules,
        removedSchedules: reoptResult.conflicts,
        stats: {
          total: reoptResult.totalCount,
          fixed: reoptResult.fixedSchedules.length,
          removed: reoptResult.removedCount
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
