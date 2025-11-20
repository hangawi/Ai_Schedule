// Schedule alerts and error displays

import React from 'react';

export const ScheduleErrorAlert = ({ scheduleError }) => {
  if (!scheduleError) return null;

  return (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4" role="alert">
      <strong className="font-bold">오류!</strong>
      <span className="block sm:inline"> {scheduleError}</span>
    </div>
  );
};

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

export const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-64">
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
  </div>
);

export const ErrorDisplay = ({ error }) => (
  <div className="text-center text-red-500 bg-red-100 p-4 rounded-lg">
    오류 발생: {error}
  </div>
);
