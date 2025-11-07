import React from 'react';
import { Pin, X } from 'lucide-react';

/**
 * 고정 일정 표시 컴포넌트 (표시 전용)
 * 추가/삭제는 채팅으로만 가능
 */
const FixedScheduleDisplay = ({ fixedSchedules = [] }) => {
  if (fixedSchedules.length === 0) {
    return null; // 고정 일정이 없으면 아예 표시 안 함
  }

  return (
    <div className="bg-purple-50 rounded-lg border border-purple-200 p-3 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Pin className="w-4 h-4 text-purple-600" />
        <h4 className="font-semibold text-sm text-gray-800">고정된 일정</h4>
        <span className="text-xs text-gray-500">({fixedSchedules.length})</span>
      </div>

      <div className="space-y-1.5">
        {fixedSchedules.map((schedule) => (
          <div
            key={schedule.id}
            className="flex items-center gap-2 p-2 bg-white rounded border border-purple-100"
          >
            <Pin className="w-3 h-3 text-purple-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-xs text-gray-800 truncate">
                {schedule.title}
              </div>
              <div className="text-[10px] text-gray-600">
                {schedule.days?.join(', ')} {schedule.startTime}-{schedule.endTime}
              </div>
            </div>
            {schedule.type === 'custom' && (
              <span className="text-[10px] bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded flex-shrink-0">
                개인
              </span>
            )}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-500 mt-2 text-center">
        💬 채팅으로 추가/삭제 가능
      </p>
    </div>
  );
};

export default FixedScheduleDisplay;
