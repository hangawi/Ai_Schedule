/**
 * ===================================================================================================
 * requestUtils.js - CoordinationTab 요청 관련 유틸리티 함수
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/CoordinationTab/utils
 *
 * 🎯 주요 기능:
 *    - 슬롯 취소 요청 데이터 생성
 *    - 시간 요청 데이터 생성
 *    - 변경 요청 데이터 생성 (취소/요청 자동 구분)
 *    - 슬롯 요청 데이터 생성 (RequestSlotModal용)
 *    - 요청자 및 대상 사용자 이름 추출
 *
 * 🔗 연결된 파일:
 *    - ../../../../utils/coordinationUtils.js - days, calculateEndTime 유틸리티
 *    - ./dateUtils.js - getDayIndex, getRequestDate 함수
 *    - ../handlers/requestHandlers.js - 요청 핸들러에서 사용
 *    - ../../modals/ChangeRequestModal.js - 변경 요청 모달에서 사용
 *    - ../../modals/RequestSlotModal.js - 슬롯 요청 모달에서 사용
 *
 * 💡 UI 위치:
 *    - 탭: 조율 탭 (CoordinationTab)
 *    - 섹션: 요청 관리, 슬롯 선택
 *    - 경로: 앱 실행 > 조율 탭 > 슬롯 클릭 > 요청 보내기
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 요청 데이터 구조가 변경됨
 *    - 새로운 요청 타입 추가: createXXXRequestData 함수 추가 및 buildChangeRequestData 수정
 *    - 요청 필드 추가/수정: 각 createXXXRequestData 함수의 반환 객체 수정
 *    - 메시지 기본값 변경: 각 함수의 message 기본값 수정
 *
 * 📝 참고사항:
 *    - 요청 타입: 'slot_release'(취소), 'time_request'(요청)
 *    - endTime은 자동 계산됨 (30분 단위)
 *    - 날짜 형식: YYYY-MM-DD
 *
 * ===================================================================================================
 */

import { days } from '../../../../utils/coordinationUtils';
import { getDayIndex, getRequestDate } from './dateUtils';
import { calculateEndTime } from '../../../../utils/coordinationUtils';

/**
 * createReleaseRequestData - 슬롯 취소 요청 데이터 생성
 *
 * @description 배정된 슬롯을 취소하기 위한 요청 데이터 객체를 생성
 * @param {string} roomId - 방 ID
 * @param {Object} slotToChange - 변경할 슬롯 데이터
 * @param {string} dayKey - 요일 키 ('월', '화', '수', '목', '금')
 * @param {string} requestDate - 요청 날짜 (YYYY-MM-DD 형식)
 * @param {string} message - 요청 메시지 (옵션, 기본값: '시간을 취소합니다.')
 * @returns {Object} 취소 요청 데이터 객체
 *
 * @example
 * const releaseData = createReleaseRequestData(
 *   'room123',
 *   { startTime: '09:00', endTime: '09:30' },
 *   '월',
 *   '2025-12-08',
 *   '일정이 변경되어 취소합니다.'
 * );
 *
 * @note
 * - type은 항상 'slot_release'로 설정됨
 * - endTime이 없으면 자동으로 계산됨 (30분 추가)
 */
export const createReleaseRequestData = (roomId, slotToChange, dayKey, requestDate, message) => {
  return {
    roomId,
    type: 'slot_release',
    timeSlot: {
      day: dayKey,
      date: requestDate,
      startTime: slotToChange.startTime || slotToChange.time,
      endTime: slotToChange.endTime || calculateEndTime(slotToChange.time),
    },
    message: message || '시간을 취소합니다.',
  };
};

/**
 * createTimeRequestData - 시간 요청 데이터 생성
 *
 * @description 다른 멤버의 슬롯이나 블록 자리를 요청하기 위한 데이터 객체를 생성
 * @param {string} roomId - 방 ID
 * @param {Object} slotToChange - 변경할 슬롯 데이터
 * @param {string} slotToChange.targetUserId - 대상 사용자 ID
 * @param {boolean} [slotToChange.isBlockRequest] - 블록 요청 여부
 * @param {Object} [slotToChange.targetSlot] - 블록 요청 시 대상 슬롯
 * @param {string} dayKey - 요일 키 ('월', '화', '수', '목', '금')
 * @param {string} requestDate - 요청 날짜 (YYYY-MM-DD 형식)
 * @param {string} message - 요청 메시지 (옵션)
 * @returns {Object} 시간 요청 데이터 객체
 *
 * @example
 * // 일반 요청
 * const requestData = createTimeRequestData(
 *   'room123',
 *   { startTime: '09:00', targetUserId: 'user456' },
 *   '월',
 *   '2025-12-08',
 *   '이 시간에 미팅이 있어 요청드립니다.'
 * );
 *
 * // 블록 요청
 * const blockRequestData = createTimeRequestData(
 *   'room123',
 *   {
 *     startTime: '09:00',
 *     targetUserId: 'user456',
 *     isBlockRequest: true,
 *     targetSlot: { endTime: '10:00' }
 *   },
 *   '월',
 *   '2025-12-08'
 * );
 *
 * @note
 * - type은 항상 'time_request'로 설정됨
 * - 블록 요청인 경우 endTime은 targetSlot.endTime 사용
 * - 일반 요청인 경우 endTime은 자동 계산됨 (30분 추가)
 * - message 기본값은 블록 요청 여부에 따라 다름
 */
export const createTimeRequestData = (roomId, slotToChange, dayKey, requestDate, message) => {
  const startTime = slotToChange.startTime || slotToChange.time;
  const endTime = slotToChange.endTime || (slotToChange.isBlockRequest && slotToChange.targetSlot
    ? slotToChange.targetSlot.endTime
    : calculateEndTime(slotToChange.time));

  return {
    roomId,
    type: 'time_request',
    timeSlot: {
      day: dayKey,
      date: requestDate,
      startTime: startTime,
      endTime: endTime,
    },
    targetUserId: slotToChange.targetUserId,
    message: message || (slotToChange.isBlockRequest ? '블록 자리를 요청합니다.' : '자리를 요청합니다.'),
    isBlockRequest: slotToChange.isBlockRequest,
  };
};

/**
 * getDayKey - 슬롯 데이터에서 요일 키 추출
 *
 * @description 슬롯 데이터에서 date 또는 dayIndex를 사용하여 요일 키('월', '화' 등) 반환
 * @param {Object} slotToChange - 슬롯 데이터
 * @param {Date|string} [slotToChange.date] - 날짜 (우선순위 높음)
 * @param {number} [slotToChange.dayIndex] - 요일 인덱스 (1-5)
 * @returns {string} 요일 키 ('월', '화', '수', '목', '금')
 *
 * @example
 * getDayKey({ date: new Date('2025-12-08') }); // '월' (월요일)
 * getDayKey({ dayIndex: 1 }); // '월'
 * getDayKey({ dayIndex: 5 }); // '금'
 *
 * @note
 * - date가 있으면 dayIndex 무시
 * - dayIndex는 1부터 시작 (1=월요일)
 */
export const getDayKey = (slotToChange) => {
  return slotToChange.date
    ? days[getDayIndex(slotToChange.date)]
    : days[slotToChange.dayIndex - 1];
};

/**
 * buildChangeRequestData - 변경 요청 데이터 생성
 *
 * @description 슬롯 데이터의 action 또는 requestType에 따라 취소/요청 데이터를 자동으로 생성
 * @param {string} roomId - 방 ID
 * @param {Object} slotToChange - 변경할 슬롯 데이터
 * @param {string} [slotToChange.action] - 액션 타입 ('release' 또는 'request')
 * @param {string} message - 요청 메시지
 * @param {string} requestType - 요청 타입 (slotToChange.action보다 우선순위 높음)
 * @returns {Object} 요청 데이터 객체 (취소 또는 시간 요청)
 *
 * @example
 * // 취소 요청
 * const releaseData = buildChangeRequestData(
 *   'room123',
 *   { startTime: '09:00', action: 'release' },
 *   '일정 변경으로 취소합니다.'
 * );
 *
 * // 시간 요청
 * const requestData = buildChangeRequestData(
 *   'room123',
 *   { startTime: '09:00', targetUserId: 'user456' },
 *   '요청드립니다.',
 *   'request'
 * );
 *
 * @note
 * - actionType 결정 순서: requestType > slotToChange.action > 기본값('request')
 * - actionType === 'release'면 createReleaseRequestData 호출
 * - 그 외에는 createTimeRequestData 호출
 */
export const buildChangeRequestData = (roomId, slotToChange, message, requestType) => {
  const dayKey = getDayKey(slotToChange);
  const requestDate = getRequestDate(slotToChange);
  const actionType = requestType || slotToChange.action || 'request';

  if (actionType === 'release') {
    return createReleaseRequestData(roomId, slotToChange, dayKey, requestDate, message);
  } else {
    return createTimeRequestData(roomId, slotToChange, dayKey, requestDate, message);
  }
};

/**
 * buildSlotRequestData - RequestSlotModal용 슬롯 요청 데이터 생성
 *
 * @description RequestSlotModal에서 사용하는 간단한 슬롯 요청 데이터 생성
 * @param {string} roomId - 방 ID
 * @param {Object} slotToRequest - 요청할 슬롯 데이터
 * @param {number} slotToRequest.dayIndex - 요일 인덱스 (1-5)
 * @param {string} slotToRequest.time - 시작 시간 (HH:mm 형식)
 * @param {string} message - 요청 메시지
 * @returns {Object} 시간 요청 데이터 객체
 *
 * @example
 * const requestData = buildSlotRequestData(
 *   'room123',
 *   { dayIndex: 1, time: '09:00' },
 *   '이 시간에 회의가 있어 요청드립니다.'
 * );
 * // Returns: {
 * //   roomId: 'room123',
 * //   type: 'time_request',
 * //   timeSlot: {
 * //     day: '월',
 * //     date: '2025-12-08',
 * //     startTime: '09:00',
 * //     endTime: '09:30'
 * //   },
 * //   message: '이 시간에 회의가 있어 요청드립니다.'
 * // }
 *
 * @note
 * - endTime은 자동으로 계산됨 (30분 추가)
 * - targetUserId는 포함되지 않음 (서버에서 처리)
 */
export const buildSlotRequestData = (roomId, slotToRequest, message) => {
  const requestDate = getRequestDate(slotToRequest);

  return {
    roomId,
    type: 'time_request',
    timeSlot: {
      day: days[slotToRequest.dayIndex - 1],
      date: requestDate,
      startTime: slotToRequest.time,
      endTime: calculateEndTime(slotToRequest.time),
    },
    message: message
  };
};

/**
 * getRequesterName - 요청자 이름 추출
 *
 * @description 요청자 데이터에서 이름 추출 (firstName + lastName 조합)
 * @param {Object} requesterData - 요청자 데이터
 * @param {string} [requesterData.firstName] - 이름
 * @param {string} [requesterData.lastName] - 성
 * @returns {string} 전체 이름 (없으면 '알 수 없음')
 *
 * @example
 * getRequesterName({ firstName: '철수', lastName: '김' }); // '김 철수'
 * getRequesterName({ firstName: '영희' }); // '영희'
 * getRequesterName({}); // '알 수 없음'
 *
 * @note
 * - firstName과 lastName 사이에 공백 추가
 * - trim()으로 앞뒤 공백 제거
 */
export const getRequesterName = (requesterData) => {
  return `${requesterData?.firstName || ''} ${requesterData?.lastName || ''}`.trim() || '알 수 없음';
};

/**
 * getTargetUserName - 대상 사용자 이름 추출
 *
 * @description 대상 사용자 데이터에서 이름 추출 (firstName + lastName 조합)
 * @param {Object} targetUserData - 대상 사용자 데이터
 * @param {string} [targetUserData.firstName] - 이름
 * @param {string} [targetUserData.lastName] - 성
 * @returns {string} 전체 이름 (없으면 '방장')
 *
 * @example
 * getTargetUserName({ firstName: '영희', lastName: '박' }); // '박 영희'
 * getTargetUserName({ firstName: '민수' }); // '민수'
 * getTargetUserName({}); // '방장'
 *
 * @note
 * - firstName과 lastName 사이에 공백 추가
 * - trim()으로 앞뒤 공백 제거
 * - 기본값은 '방장' (요청자와 다름)
 */
export const getTargetUserName = (targetUserData) => {
  return `${targetUserData?.firstName || ''} ${targetUserData?.lastName || ''}`.trim() || '방장';
};
