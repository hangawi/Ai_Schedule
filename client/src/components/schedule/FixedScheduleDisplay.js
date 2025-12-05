/**
 * ===================================================================================================
 * FixedScheduleDisplay.js - 고정된 일정을 표시하는 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/schedule
 *
 * 🎯 주요 기능:
 *    - 사용자가 채팅을 통해 '고정'한 일정 목록을 시각적으로 표시
 *    - 고정된 일정의 제목, 요일, 시간 정보를 보여줌
 *    - '개인'적으로 추가된 일정인지 여부를 태그로 표시
 *    - 고정된 일정이 없을 경우 아무것도 렌더링하지 않음
 *
 * 🔗 연결된 파일:
 *    - ScheduleOptimizerModal.js - 이 컴포넌트를 사용하여 고정된 일정 목록을 사용자에게 보여줌
 *
 * 💡 UI 위치:
 *    - '일정 최적화 모달' 내부
 *
 * ✏️ 수정 가이드:
 *    - 고정 일정 아이템의 디자인 변경: `fixedSchedules.map(...)` 내부의 JSX 구조 및 스타일 수정
 *    - "채팅으로 추가/삭제 가능" 안내 문구 변경: JSX 하단의 `<p>` 태그 내용 수정
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 표시 전용(read-only)입니다. 실제 일정 고정/해제 로직은 챗봇 핸들러를 통해 처리됩니다.
 *    - `fixedSchedules` 배열이 비어있으면 null을 반환하여 UI에 아무것도 표시하지 않습니다.
 *
 * ===================================================================================================
 */

import React from 'react';
import { Pin } from 'lucide-react';

/**
 * FixedScheduleDisplay
 *
 * @description 사용자가 채팅을 통해 고정한 일정 목록을 보여주는 표시 전용 컴포넌트입니다.
 * @param {Object} props - 컴포넌트 프롭스
 * @param {Array<Object>} [props.fixedSchedules=[]] - 고정된 일정 객체들의 배열
 * @returns {JSX.Element | null} 고정 일정 목록 UI 또는 null
 *
 * @example
 * const fixedSchedules = [
 *   { id: 1, title: '팀 회의', days: ['월'], startTime: '10:00', endTime: '11:00' },
 *   { id: 2, title: '요가', days: ['수'], startTime: '19:00', endTime: '20:00', type: 'custom' }
 * ];
 * <FixedScheduleDisplay fixedSchedules={fixedSchedules} />
 */
const FixedScheduleDisplay = ({ fixedSchedules = [] }) => {
  if (!fixedSchedules || fixedSchedules.length === 0) {
    return null;
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