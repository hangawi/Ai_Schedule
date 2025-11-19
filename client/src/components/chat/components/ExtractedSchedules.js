/**
 * ============================================================================
 * ExtractedSchedules.js - 추출된 스케줄 표시 컴포넌트
 * ============================================================================
 */

import React from 'react';

/**
 * 추출된 스케줄 표시 컴포넌트
 */
const ExtractedSchedules = ({ extractedSchedules, onAddSchedules }) => {
  if (!extractedSchedules || extractedSchedules.length === 0) return null;

  return (
    <div className="mt-3 p-2 bg-white bg-opacity-20 rounded border">
      <p className="text-xs font-semibold mb-2">추출된 일정:</p>
      {extractedSchedules.map((schedule, index) => (
        <div key={index} className="text-xs mb-1 p-1 bg-white bg-opacity-30 rounded">
          <div><strong>제목:</strong> {schedule.title}</div>
          <div><strong>날짜:</strong> {schedule.date}</div>
          <div><strong>시간:</strong> {schedule.time}</div>
          {schedule.location && <div><strong>장소:</strong> {schedule.location}</div>}
        </div>
      ))}
      <button
        className="mt-2 px-2 py-1 bg-white bg-opacity-40 hover:bg-opacity-60 rounded text-xs"
        onClick={() => onAddSchedules(extractedSchedules)}
      >
        이 일정들을 추가하시겠습니까?
      </button>
    </div>
  );
};

export default ExtractedSchedules;
