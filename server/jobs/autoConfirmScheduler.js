/**
 * 자동 확정 스케줄러
 *
 * 매 10초마다 autoConfirmAt이 지난 방들을 찾아서 자동으로 확정
 */

const cron = require('node-cron');
const Room = require('../models/room');

/**
 * 만료된 타이머를 가진 방들을 자동 확정
 */
async function processAutoConfirmations() {
  try {
    const now = new Date();

    // autoConfirmAt이 현재 시간보다 이전이고, 아직 확정되지 않은 방들 찾기
    const roomsToConfirm = await Room.find({
      autoConfirmAt: { $lte: now },
      confirmedAt: null,
      currentTravelMode: { $ne: null }
    })
      .populate('owner', 'firstName lastName email personalTimes defaultSchedule scheduleExceptions')
      .populate('members.user', '_id firstName lastName email personalTimes defaultSchedule scheduleExceptions');

    if (roomsToConfirm.length === 0) {
      return; // 확정할 방이 없음
    }

    console.log(`🔔 [자동 확정] ${roomsToConfirm.length}개 방 확정 시작`);

    const { confirmScheduleLogic } = require('../services/confirmScheduleService');

    for (const room of roomsToConfirm) {
      try {
        // confirmScheduleService를 사용하여 수동 확정과 동일한 로직 실행
        const result = await confirmScheduleLogic(
          room,
          room.currentTravelMode,
          room.owner._id || room.owner,
          `${room.owner.firstName || ''} ${room.owner.lastName || ''}`.trim() || 'System'
        );

        console.log(`✅ [자동 확정 완료] 방 ${room._id}:`, result);

      } catch (error) {
        console.error(`❌ [자동 확정 실패] 방 ${room._id}:`, error.message);
      }
    }

    console.log(`🎉 [자동 확정 완료] 총 ${roomsToConfirm.length}개 방 확정됨`);
  } catch (error) {
    console.error('❌ [자동 확정 스케줄러 오류]:', error);
  }
}

/**
 * 스케줄러 시작
 */
function startAutoConfirmScheduler() {
  // 매 10초마다 실행
  cron.schedule('*/10 * * * * *', async () => {
    await processAutoConfirmations();
  });

  console.log('⏰ [자동 확정 스케줄러] 시작 (10초마다 실행)');
}

module.exports = { startAutoConfirmScheduler, processAutoConfirmations };
