/**
 * ===================================================================================================
 * [파일명] ScheduleAlerts.js - 스케줄링 관련 알림 컴포넌트 모음
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > [client/src/components/tabs/CoordinationTab/components/ScheduleAlerts.js]
 *
 * 🎯 주요 기능:
 *    - 스케줄링 과정에서 발생하는 다양한 상태(오류, 경고, 알림, 로딩 등)를 사용자에게 알려주는 UI 컴포넌트들을 모아놓은 파일.
 *    - 각 컴포넌트는 특정 데이터(prop)의 존재 여부에 따라 조건부로 렌더링됨.
 *
 * 🔗 연결된 파일:
 *    - ./index.js: 이 파일의 컴포넌트들을 export 하여 다른 곳에서 쉽게 사용할 수 있도록 함.
 *    - ../index.js (CoordinationTab): 이 파일에서 export된 알림 컴포넌트들을 실제로 사용하는 부모 컴포넌트.
 *
 * 💡 UI 위치:
 *    - [협업] 탭 > (방 선택 후): 자동 배정 실행 결과나 오류 발생 시 동적으로 표시됨.
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 각종 알림, 오류 메시지의 UI/UX가 변경됩니다.
 *    - 새로운 알림 유형 추가: 이 파일에 새로운 알림 컴포넌트를 export 하고, `components/index.js`에도 추가하여 사용합니다.
 *
 * 📝 참고사항:
 *    - 이 파일의 컴포넌트들은 모두 순수한 Presentational Component입니다.
 *    - 각 컴포넌트는 관련된 데이터 prop이 `null`이거나 비어있으면 `null`을 반환하여 아무것도 렌더링하지 않습니다.
 *    - 복잡한 `CoordinationTab`의 JSX 구조를 단순화하기 위해 알림 관련 UI를 별도 파일로 분리한 좋은 예시입니다.
 *
 * ===================================================================================================
 */
import React from 'react';

/**
 * [ScheduleErrorAlert]
 * @description 자동 배정 실행 중 발생한 오류 메시지를 표시하는 알림 컴포넌트.
 * @param {string} scheduleError - 표시할 오류 메시지 문자열.
 * @returns {JSX.Element|null} 오류가 있을 경우에만 JSX를 반환.
 */
export const ScheduleErrorAlert = ({ scheduleError }) => {
  if (!scheduleError) return null;

  return (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4" role="alert">
      <strong className="font-bold">오류!</strong>
      <span className="block sm:inline"> {scheduleError}</span>
    </div>
  );
};

/**
 * [UnassignedMembersAlert]
 * @description 자동 배정 후 최소 할당 시간을 채우지 못한 멤버 목록을 표시하는 알림 컴포넌트.
 * @param {Array<object>} unassignedMembersInfo - 미배정 멤버 정보 배열.
 * @returns {JSX.Element|null} 미배정 멤버가 있을 경우에만 JSX를 반환.
 */
export const UnassignedMembersAlert = ({ unassignedMembersInfo }) => {
  if (!unassignedMembersInfo || unassignedMembersInfo.length === 0) return null;

  return (
    <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mt-4" role="alert">
      <strong className="font-bold">알림!</strong>
      <p className="block sm:inline"> 다음 멤버들은 최소 할당 시간을 채우지 못했습니다:</p>
      <ul className="list-disc list-inside mt-2">
        {unassignedMembersInfo.map((info, index) => (
          <li key={index}>멤버 ID: {info.memberId}, 부족 시간: {info.neededHours}시간</li>
        ))}
      </ul>
      <p className="text-sm mt-2">이들은 협의가 필요하거나 다음 주로 이월될 수 있습니다.</p>
    </div>
  );
};

/**
 * [ConflictSuggestionsAlert]
 * @description 자동 배정 중 발생한 충돌에 대한 해결 제안을 표시하는 알림 컴포넌트.
 * @param {Array<object>} conflictSuggestions - 충돌 해결 제안 정보 배열.
 * @returns {JSX.Element|null} 해결 제안이 있을 경우에만 JSX를 반환.
 */
export const ConflictSuggestionsAlert = ({ conflictSuggestions }) => {
  if (!conflictSuggestions || conflictSuggestions.length === 0) return null;

  return (
    <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded relative mt-4" role="alert">
      {conflictSuggestions.map((suggestion, index) => (
        <div key={index} className="mb-4 last:mb-0">
          <strong className="font-bold">{suggestion.title}</strong>
          <div className="mt-2 text-sm whitespace-pre-line">
            {suggestion.content}
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * [WarningsAlert]
 * @description 자동 배정 중 발생한 경고 메시지들을 표시하는 알림 컴포넌트.
 * @param {Array<object>} warnings - 경고 정보 배열. 각 객체는 { type, message } 구조.
 * @returns {JSX.Element|null} 경고가 있을 경우에만 JSX를 반환.
 */
export const WarningsAlert = ({ warnings }) => {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mt-4" role="alert">
      <strong className="font-bold">배정 경고</strong>
      <p className="block sm:inline"> 다음 배정에서 문제가 발생했습니다:</p>
      <ul className="list-disc list-inside mt-2 text-sm">
        {warnings.map((warning, index) => (
          <li key={index}>{warning.message}</li>
        ))}
      </ul>
    </div>
  );
};

/**
 * [TravelErrorAlert]
 * @description 이동 시간 계산 중 발생한 오류를 표시하는 알림 컴포넌트.
 * @param {string} travelError - 표시할 오류 메시지 문자열.
 * @returns {JSX.Element|null} 오류가 있을 경우에만 JSX를 반환.
 */
export const TravelErrorAlert = ({ travelError }) => {
  if (!travelError) return null;

  return (
    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">이동 시간 계산 불가</h3>
          <div className="mt-2 text-sm text-red-700 whitespace-pre-line">
            {travelError}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * [LoadingSpinner]
 * @description 데이터 로딩 중임을 나타내는 스피너 UI 컴포넌트.
 * @returns {JSX.Element} 로딩 스피너 JSX 엘리먼트.
 */
export const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-64">
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
  </div>
);

/**
 * [ErrorDisplay]
 * @description 일반적인 오류 메시지를 표시하는 UI 컴포넌트.
 * @param {string} error - 표시할 오류 메시지 문자열.
 * @returns {JSX.Element} 오류 표시 JSX 엘리먼트.
 */
export const ErrorDisplay = ({ error }) => (
  <div className="text-center text-red-500 bg-red-100 p-4 rounded-lg">
    오류 발생: {error}
  </div>
);