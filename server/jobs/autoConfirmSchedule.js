const cron = require('node-cron');
const Room = require('../models/room');
const { confirmScheduleLogic } = require('../services/confirmScheduleService');

/**
 * 자동 확정 로직 (confirmScheduleService 사용)
 */
async function confirmRoomSchedule(room) {
  try {
    // populate는 processAutoConfirm에서 이미 완료됨
    
    // confirmScheduleService의 공통 로직 사용 (수동 확정과 동일)
    const result = await confirmScheduleLogic(
      room,
      room.currentTravelMode,
      room.owner._id || room.owner,
      `${room.owner.firstName || ''} ${room.owner.lastName || ''}`.trim() || 'System'
    );
    
    console.log(`✅ [자동확정] 방 ${room._id} (${room.name}): 성공적으로 확정됨`);
    console.log(`   - 확정된 슬롯 수: ${result.confirmedSlotsCount}`);
    console.log(`   - 병합된 슬롯 수: ${result.mergedSlotsCount}`);
    console.log(`   - 영향받은 멤버 수: ${result.affectedMembersCount}`);
    console.log(`   - 확정된 이동 모드: ${result.confirmedTravelMode}`);
    
    return { success: true };
  } catch (error) {
    console.error(`❌ [자동확정] 방 ${room._id} 확정 실패:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 자동 확정이 필요한 방들을 찾아서 확정
 */
async function processAutoConfirm() {
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
      return;
    }

    console.log(`\n🔔 [자동확정] ${roomsToConfirm.length}개 방의 자동 확정 시작...`);

    for (const room of roomsToConfirm) {
      await confirmRoomSchedule(room);
    }

    console.log(`✅ [자동확정] 처리 완료\n`);

  } catch (error) {
    console.error('❌ [자동확정] 처리 중 오류:', error);
  }
}

/**
 * Cron Job 시작
 * 매 1분마다 자동 확정 체크
 */
function startAutoConfirmJob() {
  // 매 1분마다 실행 (*/1 * * * *)
  cron.schedule('*/1 * * * *', () => {
    processAutoConfirm();
  });

  console.log('✅ 자동 확정 Cron Job이 시작되었습니다. (매 1분마다 실행)');
}

module.exports = { startAutoConfirmJob };
