/**
 * ===================================================================================================
 * PreferenceTimeSection.js - '내 프로필' 탭의 선호시간 관리 섹션 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ProfileTab/components/PreferenceTimeSection.js
 *
 * 🎯 주요 기능:
 *    - 사용자가 설정한 '선호시간' 목록을 날짜별로 그룹화하여 표시.
 *    - 자동 배정 알고리즘에 사용될 시간 정보를 시각적으로 제공.
 *    - 연속된 시간대를 병합하여 깔끔하게 표시.
 *    - 각 시간대의 우선순위(꼭, 가능 등)를 라벨과 색상으로 구분하여 표시.
 *
 * 🔗 연결된 파일:
 *    - ../index.js (ProfileTab) - 이 컴포넌트를 사용하는 부모 컴포넌트.
 *    - ../utils/scheduleGrouper.js - 스케줄을 날짜별로 그룹화하는 유틸리티.
 *    - ../utils/slotMerger.js - 연속된 시간대를 병합하는 유틸리티.
 *    - ../utils/dateFormatter.js - 날짜 포맷팅 유틸리티.
 *    - ../constants/priorityConfig.js - 우선순위 관련 색상 및 라벨 상수.
 *
 * 💡 UI 위치:
 *    - '내 프로필' 탭 > '선호시간 관리' 섹션.
 *
 * ✏️ 수정 가이드:
 *    - 선호시간이 표시되는 방식을 변경하려면 이 파일을 수정합니다. (예: 정렬 순서, UI 구조)
 *    - 연속 시간대 병합 로직을 변경하려면 `../utils/slotMerger.js` 파일을 수정해야 합니다.
 *    - 날짜별 그룹화 로직을 변경하려면 `../utils/scheduleGrouper.js` 파일을 수정해야 합니다.
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 오직 '선호시간'(`defaultSchedule`) 데이터만 표시하며, 개인시간은 표시하지 않습니다.
 *    - 데이터 처리는 `useMemo`를 사용하여 렌더링 성능을 최적화하고 있습니다.
 *    - 표시되는 데이터는 상위 컴포넌트에서 이미 월별로 필터링된 `filteredDefaultSchedule` 입니다.
 *
 * ===================================================================================================
 */

import React, { useMemo } from 'react';
import { mergeDefaultSchedule } from '../../../../utils/timetableHelpers';
import { groupScheduleByDate } from '../utils/scheduleGrouper';
import { mergeConsecutiveSlots } from '../utils/slotMerger';
import { formatDateWithDay } from '../utils/dateFormatter';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../constants/priorityConfig';
import { MESSAGES } from '../constants/messages';

/**
 * PreferenceTimeSection
 * @description 사용자의 선호시간 목록을 날짜별로 그룹화하고, 연속된 시간을 병합하여 보여주는 UI 컴포넌트.
 * @param {object} props - 컴포넌트 props
 * @param {Array} props.filteredDefaultSchedule - 현재 뷰(월)에 따라 필터링된 기본 스케줄(선호시간).
 * @param {Array} props.defaultSchedule - 필터링되지 않은 전체 기본 스케줄. 총 개수 표시에 사용.
 * @returns {JSX.Element}
 */
export const PreferenceTimeSection = ({
  filteredDefaultSchedule,
  defaultSchedule,
  filteredScheduleExceptions = [],
  scheduleExceptions = []
}) => {
  // 🔥 수정: 이제 선호시간은 모두 defaultSchedule에 저장되므로 
  // scheduleExceptions는 사용하지 않음 (버튼과 채팅 모두 동일)

  // 🔥 수정: defaultSchedule만 사용 (채팅과 버튼 모두 여기 저장됨)
  const mergedSchedule = useMemo(() => {
    return filteredDefaultSchedule;
  }, [filteredDefaultSchedule]);

  // 전체 개수 (필터링 전)
  const totalCount = useMemo(() => {
    return mergeDefaultSchedule([...defaultSchedule]).length;
  }, [defaultSchedule]);
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-blue-600">선호시간 관리</h3>
          <p className="text-sm text-gray-500 mt-1">
            클릭 또는 챗봇으로 추가한 가능한 시간들 (자동배정 시 사용됨)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {totalCount}개 시간대
          </span>
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
        </div>
      </div>

      {defaultSchedule.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="mb-2">{MESSAGES.NO_PREFERENCE_TIME}</p>
          <p className="text-sm">{MESSAGES.NO_PREFERENCE_TIME_HELP}</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {(() => {
            // 날짜별로 그룹화 (병합된 스케줄 사용)
            const dateGroups = groupScheduleByDate(mergedSchedule);

            // 날짜순 정렬
            const sortedDates = Object.keys(dateGroups).sort();

            if (sortedDates.length === 0) {
              return (
                <div className="text-center py-8 text-gray-500">
                  <p className="mb-2">{MESSAGES.NO_SPECIFIC_DATE_PREFERENCE}</p>
                  <p className="text-sm">{MESSAGES.NO_SPECIFIC_DATE_HELP}</p>
                </div>
              );
            }

            return sortedDates.map(dateStr => {
              const slots = dateGroups[dateStr].sort((a, b) => a.startTime.localeCompare(b.startTime));

              // 연속된 시간대 병합 (출처 정보 보존)
              const mergedSlots = mergeConsecutiveSlots(slots);

              const formattedDate = formatDateWithDay(dateStr);

              return (
                <div key={dateStr} className="border-l-4 border-blue-500 bg-blue-50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-[140px]">
                      <span className="font-semibold text-blue-700">{formattedDate}</span>
                    </div>
                    <div className="flex-1 space-y-2">
                      {mergedSlots.map((slot, idx) => {
                        return (
                          <div
                            key={idx}
                            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 ${PRIORITY_COLORS[slot.priority]} mr-2 mb-2`}
                          >
                            <span className="font-medium">{slot.startTime} - {slot.endTime}</span>
                            <span className="text-xs opacity-90">
                              ({PRIORITY_LABELS[slot.priority]})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
};
