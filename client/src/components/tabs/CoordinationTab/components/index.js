/**
 * ===================================================================================================
 * [파일명] components/index.js - CoordinationTab 내부 컴포넌트 통합 export 파일
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > [client/src/components/tabs/CoordinationTab/components/index.js]
 *
 * 🎯 주요 기능:
 *    - 'CoordinationTab/components' 디렉토리 내의 모든 주요 컴포넌트들을 import하여 한 번에 export.
 *    - 다른 파일에서 이 디렉토리의 컴포넌트들을 보다 쉽게 import할 수 있도록 경로를 단축시켜주는 역할 (Barrel file).
 *
 * 🔗 연결된 파일:
 *    - ./RoomHeader.js: RoomHeader 컴포넌트를 export.
 *    - ./TimetableControls.js: TimetableControls 컴포넌트를 export.
 *    - ./RequestSection.js: RequestSection 컴포넌트를 export.
 *    - ./RoomList.js: RoomList 컴포넌트를 export.
 *    - ./ScheduleAlerts.js: 다양한 알림 관련 컴포넌트들을 export.
 *    - ../index.js: 이 파일에서 export된 컴포넌트들을 import하여 사용.
 *
 * ✏️ 수정 가이드:
 *    - 이 디렉토리에 새로운 컴포넌트를 추가하고 외부에서 사용해야 할 경우, 이 파일에 export 구문을 추가해야 합니다.
 *
 * 📝 참고사항:
 *    - 이 파일은 직접적인 UI나 로직을 포함하지 않는, 순수하게 코드 구성을 위한 파일입니다.
 *    - 이런 패턴을 '배럴(Barrel) 파일'이라고 부르며, 프로젝트의 import 구문을 간결하게 유지하는 데 도움을 줍니다.
 *
 * ===================================================================================================
 */
export { default as RoomHeader } from './RoomHeader';
export { default as TimetableControls } from './TimetableControls';
export { default as RequestSection } from './RequestSection';
export { default as RoomList } from './RoomList';
export {
  ScheduleErrorAlert,
  UnassignedMembersAlert,
  ConflictSuggestionsAlert,
  WarningsAlert,
  TravelErrorAlert,
  LoadingSpinner,
  ErrorDisplay
} from './ScheduleAlerts';