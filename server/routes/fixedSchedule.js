const express = require('express');
const router = express.Router();
const { handleFixedScheduleRequest } = require('../utils/fixedScheduleHandler');

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

    // schedulesByImage에서 모든 스케줄 추출
    const allSchedules = schedulesByImage?.flatMap(img => img.schedules || []) || [];
    console.log('전체 원본:', allSchedules.length, '개');

    const kpops = allSchedules.filter(s => s.title?.includes('KPOP'));
    console.log('KPOP:', kpops.map(s =>
      `"${s.title}" (${s.instructor || 'N/A'}) ${s.days} ${s.startTime}-${s.endTime}`
    ));

    const result = await handleFixedScheduleRequest(
      message,
      allSchedules.length > 0 ? allSchedules : currentSchedules,
      fixedSchedules || []
    );

    console.log('결과:', result.success ? '✅ SUCCESS' : '❌ FAIL');
    console.log('메시지:', result.message);
    if (result.schedules) {
      console.log('고정된 스케줄:', result.schedules.map(s =>
        `"${s.title}" ${s.days} ${s.startTime}-${s.endTime}`
      ));
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

module.exports = router;
