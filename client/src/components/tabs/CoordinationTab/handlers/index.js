/**
 * ===================================================================================================
 * [파일명] handlers/index.js - CoordinationTab 이벤트 핸들러 통합 export 파일
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > [client/src/components/tabs/CoordinationTab/handlers/index.js]
 *
 * 🎯 주요 기능:
 *    - 'handlers' 디렉토리 내의 다른 파일들(room, slot, request 핸들러)에서 export된 모든 함수들을 다시 한번에 export.
 *    - 관련된 핸들러 함수들을 하나의 경로에서 import 할 수 있도록 하여 코드 구조를 간소화 (Barrel file).
 *
 * 🔗 연결된 파일:
 *    - ./roomHandlers.js: 방 관련 핸들러들을 export.
 *    - ./slotHandlers.js: 시간 슬롯 관련 핸들러들을 export.
 *    - ./requestHandlers.js: 요청 관련 핸들러들을 export.
 *    - ../index.js (CoordinationTab): 이 파일에서 export된 핸들러들을 import하여 사용.
 *
 * ✏️ 수정 가이드:
 *    - 이 디렉토리에 새로운 핸들러 파일을 추가할 경우, 이 파일에도 `export * from './[새로운 파일]';` 구문을 추가하여 일관성을 유지합니다.
 *
 * 📝 참고사항:
 *    - 이 파일은 직접적인 로직을 포함하지 않고, 다른 모듈의 export를 집계하고 다시 배포하는 역할만 수행합니다.
 *    - `export * from '...'` 구문은 해당 파일의 모든 named export를 그대로 다시 export하는 편리한 방법입니다.
 *
 * ===================================================================================================
 */
export * from './roomHandlers';
export * from './slotHandlers';
export * from './requestHandlers';