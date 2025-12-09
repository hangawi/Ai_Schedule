/**
 * ===================================================================================================
 * [파일명] hooks/index.js - CoordinationTab 커스텀 훅 통합 export 파일
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > [client/src/components/tabs/CoordinationTab/hooks/index.js]
 *
 * 🎯 주요 기능:
 *    - 'hooks' 디렉토리 내의 모든 커스텀 훅(custom hook)들을 다시 한번에 export.
 *    - `CoordinationTab` 컴포넌트에서 여러 훅들을 하나의 경로에서 간결하게 import 할 수 있도록 지원 (Barrel file).
 *
 * 🔗 연결된 파일:
 *    - ./useAlertState.js: 알림 상태 관리 훅.
 *    - ./useRequests.js: 요청 데이터 관리 훅.
 *    - ./useViewState.js: 뷰(UI) 상태 관리 훅.
 *    - ./useSchedulerState.js: 스케줄러 및 멤버 모달 상태 관리 훅.
 *    - ../index.js (CoordinationTab): 이 파일에서 export된 훅들을 import하여 사용.
 *
 * ✏️ 수정 가이드:
 *    - 이 디렉토리에 새로운 커스텀 훅 파일을 추가하고 외부에서 사용해야 할 경우, 이 파일에 export 구문을 추가해야 합니다.
 *
 * 📝 참고사항:
 *    - 이 파일은 직접적인 로직을 포함하지 않으며, 다른 모듈의 export를 집계하고 다시 배포하는 역할만 수행합니다.
 *    - 이 패턴은 `CoordinationTab`의 복잡한 로직을 여러 개의 커스텀 훅으로 분리하여 관리하는 좋은 구조화 전략의 일부입니다.
 *
 * ===================================================================================================
 */
export { useAlertState } from './useAlertState';
export { useRequests, useRoomExchangeCounts } from './useRequests';
export { useViewState } from './useViewState';
export { useSchedulerState, useMemberModalState } from './useSchedulerState';