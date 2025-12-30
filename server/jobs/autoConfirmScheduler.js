/**
 * ===================================================================================================
 * autoConfirmScheduler.js - 고정밀 일정 자동 확정 스케줄러 (10초 단위)
 * ===================================================================================================
 *
 * 📍 위치: 백엔드 > server/jobs > autoConfirmScheduler.js
 * 🎯 주요 기능:
 *    - 매우 짧은 주기(10초)로 자동 확정 대기 중인 방들을 탐색하여 정밀한 자동 확정 서비스 제공.
 *    - autoConfirmSchedule.js 보다 더 빈번하게 실행되어 사용자 경험상의 대기 시간을 최소화함.
 *    - 만료된 타이머를 가진 방들에 대해 공통 확정 비즈니스 로직(confirmScheduleLogic)을 호출하여 데이터 일관성 유지.
 *
 * 🔗 연결된 파일:
 *    - server/services/confirmScheduleService.js - 실제 확정 비즈니스 로직 호출.
 *    - server/models/room.js - 자동 확정 대상 방 조회를 위한 모델.
 *
 * ✏️ 수정 가이드:
 *    - 실행 빈도를 조정하려면 startAutoConfirmScheduler 내의 cron 패턴(*10 * * * * *) 수정.
 *    - 특정 주차나 상태의 방만 확정하고 싶다면 processAutoConfirmations의 쿼리 필터 보강.
 *
 * 📝 참고사항:
 *    - 이 파일은 autoConfirmSchedule.js와 유사한 역할을 수행하나, 더 높은 정밀도가 요구되는 환경을 위해 별도로 구성됨.
 *
 * ===================================================================================================
 **/

const cron = require('node-cron');
const Room = require('../models/room');

/**
 * processAutoConfirmations
 * @description 현재 시점 기준으로 확정 시간이 경과한 모든 방을 찾아 순차적으로 확정 로직을 실행합니다.
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

      } catch (error) {
      }
    }
  } catch (error) {
  }
}

/**
 * startAutoConfirmScheduler
 * @description 서버 기동 시 10초 주기의 자동 확정 작업을 활성화합니다.
 */
function startAutoConfirmScheduler() {
  // 매 10초마다 실행
  cron.schedule('*/10 * * * * *', async () => {
    await processAutoConfirmations();
  });
}

module.exports = { startAutoConfirmScheduler, processAutoConfirmations };

