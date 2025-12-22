/**
 * ===================================================================================================
 * autoConfirmSchedule.js - 일정 자동 확정 크론 잡(Cron Job) 서비스
 * ===================================================================================================
 *
 * 📍 위치: 백엔드 > server/jobs > autoConfirmSchedule.js
 * 🎯 주요 기능:
 *    - 시스템이 사전에 설정한 자동 확정 시점(autoConfirmAt)이 도래한 방들을 주기적으로 탐색.
 *    - 조건이 충족된 방들에 대해 confirmScheduleLogic을 호출하여 수동 확정과 동일한 배정 확정 절차 수행.
 *    - 매 1분마다 실행되는 스케줄러를 통해 실시간성에 가까운 자동 확정 서비스 제공.
 *    - 확정 결과 및 오류 내역을 서버 로그에 기록하여 모니터링 지원.
 *
 * 🔗 연결된 파일:
 *    - server/services/confirmScheduleService.js - 실제 확정 비즈니스 로직(공통) 호출.
 *    - server/models/room.js - 자동 확정 대상 방 조회를 위한 모델.
 *
 * ✏️ 수정 가이드:
 *    - 크론 주기를 변경(예: 5분마다)하려면 startAutoConfirmJob 내의 스케줄 패턴 수정.
 *    - 자동 확정 대상을 선별하는 쿼리를 변경하려면 processAutoConfirm 내의 find 조건 수정.
 *
 * 📝 참고사항:
 *    - 이 기능은 사용자가 일일이 '확정' 버튼을 누르지 않아도 일정 시간이 지나면 시스템이 자동으로 일정을 고정해주는 편의를 제공함.
 *
 * ===================================================================================================
 */

const cron = require('node-cron');
const Room = require('../models/room');
const { confirmScheduleLogic } = require('../services/confirmScheduleService');

/**
 * confirmRoomSchedule
 * @description 개별 방에 대해 자동 확정 비즈니스 로직을 실행합니다.
 * @param {Object} room - 작업 대상 방 객체 (populate 완료된 상태).
 * @returns {Promise<Object>} 성공 여부를 담은 객체.
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
    
    console.log(`✅ [자동확정] 방 \$\s*\{\s*room\._id\s*\}\s* (\$\s*\{\s*room\.name\s*\}\s*): 성공적으로 확정됨`);
    console.log(`   - 확정된 슬롯 수: \$\s*\{\s*result\.confirmedSlotsCount\s*\}\s*`);
    console.log(`   - 병합된 슬롯 수: \$\s*\{\s*result\.mergedSlotsCount\s*\}\s*`);
    console.log(`   - 영향받은 멤버 수: \$\s*\{\s*result\.affectedMembersCount\s*\}\s*`);
    console.log(`   - 확정된 이동 모드: \$\s*\{\s*result\.confirmedTravelMode\s*\}\s*`);
    
    return { success: true };
  } catch (error) {
    console.error(`❌ [자동확정] 방 \$\s*\{\s*room\._id\s*\}\s* 확정 실패:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * processAutoConfirm
 * @description DB를 조회하여 확정 대기 시간이 지난 방들을 일괄적으로 처리합니다.
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

    console.log(`\n🔔 [자동확정] \$\s*\{\s*roomsToConfirm\.length\s*\}\s*개 방의 자동 확정 시작...`);

    for (const room of roomsToConfirm) {
      await confirmRoomSchedule(room);
    }

    console.log(`✅ [자동확정] 처리 완료\n`);

  } catch (error) {
    console.error('❌ [자동확정] 처리 중 오류:', error);
  }
}

/**
 * startAutoConfirmJob
 * @description 서버 시작 시 호출되어 매 분마다 자동 확정 로직을 실행하는 스케줄러를 가동합니다.
 */
function startAutoConfirmJob() {
  // 매 1분마다 실행 (*/1 * * * *)
  cron.schedule('*/1 * * * *', () => {
    processAutoConfirm();
  });

  console.log('✅ 자동 확정 Cron Job이 시작되었습니다. (매 1분마다 실행)');
}

module.exports = { startAutoConfirmJob };

