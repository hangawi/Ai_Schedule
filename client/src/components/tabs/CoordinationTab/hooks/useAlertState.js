/**
 * ===================================================================================================
 * useAlertState.js - CoordinationTab 알림 상태 관리 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/CoordinationTab/hooks
 *
 * 🎯 주요 기능:
 *    - 커스텀 알림(경고/에러) 상태 관리
 *    - 알림 표시 및 닫기 함수 제공
 *    - useCallback을 사용한 함수 메모이제이션으로 성능 최적화
 *
 * 🔗 연결된 파일:
 *    - ../constants/index.js - INITIAL_CUSTOM_ALERT 초기값 상수
 *    - ../index.js - CoordinationTab 메인 컴포넌트에서 사용
 *
 * 💡 UI 위치:
 *    - 탭: 조율 탭 (CoordinationTab)
 *    - 섹션: 전체 영역에서 발생하는 알림 메시지
 *    - 경로: 앱 실행 > 조율 탭 > 알림 메시지
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: CoordinationTab 내 알림 표시 방식 변경
 *    - 알림 타입 추가: showAlert 함수의 type 파라미터 옵션 확장
 *    - 알림 자동 닫기 기능 추가: useEffect와 타이머 로직 추가
 *    - 알림 초기 상태 변경: constants/index.js의 INITIAL_CUSTOM_ALERT 수정
 *
 * 📝 참고사항:
 *    - 알림 타입: 'warning', 'error', 'success', 'info' 등 사용 가능
 *    - useCallback 사용으로 불필요한 리렌더링 방지
 *    - 알림은 사용자가 직접 닫기 버튼을 클릭할 때까지 유지됨
 *
 * ===================================================================================================
 */

import { useState, useCallback } from 'react';
import { INITIAL_CUSTOM_ALERT } from '../constants';

/**
 * useAlertState - 알림 상태 관리 훅
 *
 * @description CoordinationTab에서 발생하는 알림(경고, 에러 등)을 관리하는 커스텀 훅
 * @returns {Object} 알림 상태 및 제어 함수
 * @returns {Object} returns.customAlert - 현재 알림 상태 { show, message, type }
 * @returns {Function} returns.showAlert - 알림 표시 함수
 * @returns {Function} returns.closeAlert - 알림 닫기 함수
 *
 * @example
 * const { customAlert, showAlert, closeAlert } = useAlertState();
 * showAlert('요청을 처리할 수 없습니다', 'error');
 *
 * @note
 * - 알림은 자동으로 닫히지 않으며 사용자가 직접 닫아야 함
 * - 여러 알림이 연속으로 발생하면 마지막 알림만 표시됨
 */
export const useAlertState = () => {
  const [customAlert, setCustomAlert] = useState(INITIAL_CUSTOM_ALERT);

  const showAlert = useCallback((message, type = 'warning') => {
    setCustomAlert({ show: true, message, type });
  }, []);

  const closeAlert = useCallback(() => {
    setCustomAlert(INITIAL_CUSTOM_ALERT);
  }, []);

  return {
    customAlert,
    showAlert,
    closeAlert
  };
};
