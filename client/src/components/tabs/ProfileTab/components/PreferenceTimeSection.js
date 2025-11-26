// 선호시간 관리 섹션 컴포넌트

import React from 'react';
import { mergeDefaultSchedule } from '../../../../utils/timetableHelpers';
import { groupScheduleByDate } from '../utils/scheduleGrouper';
import { mergeConsecutiveSlots } from '../utils/slotMerger';
import { formatDateWithDay } from '../utils/dateFormatter';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../constants/priorityConfig';
import { MESSAGES } from '../constants/messages';

export const PreferenceTimeSection = ({ filteredDefaultSchedule, defaultSchedule }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-blue-600">선호시간 관리</h3>
          <p className="text-sm text-gray-500 mt-1">
            직접 클릭하여 추가한 가능한 시간들 (자동배정 시 사용됨)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {mergeDefaultSchedule(filteredDefaultSchedule).length}개 시간대
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
            // 날짜별로 그룹화
            const dateGroups = groupScheduleByDate(filteredDefaultSchedule);

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

              // 연속된 시간대 병합
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
