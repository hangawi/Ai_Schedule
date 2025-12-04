/**
 * ===================================================================================================
 * [ExtractedSchedules.js] - OCR로 추출된 스케줄을 목록으로 표시하는 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > client/src/components/chat/components/ExtractedSchedules.js
 *
 * 🎯 주요 기능:
 *    - OCR 분석을 통해 추출된 개별 스케줄 정보를 목록 형태로 표시
 *    - 사용자에게 추출된 스케줄을 캘린더에 추가할 수 있는 버튼 제공
 *
 * 🔗 연결된 파일:
 *    - ./MessageBubble.js: AI 응답 메시지 내에서 추출된 스케줄 정보를 시각화할 때 이 컴포넌트를 사용
 *
 * 💡 UI 위치:
 *    - AI 채팅창 내, AI가 시간표 이미지에서 스케줄을 추출했을 때 그 결과 메시지 아래에 표시됨
 *
 * ✏️ 수정 가이드:
 *    - 각 스케줄 항목의 표시 형식을 변경하려면: `extractedSchedules.map` 내부의 JSX 구조를 수정합니다.
 *    - '이 일정들을 추가하시겠습니까?' 버튼의 텍스트나 스타일을 변경하려면: 해당 `<button>` 요소의 내용을 수정합니다.
 *
 * 📝 참고사항:
 *    - `extractedSchedules` prop이 비어있거나 `null`이면 아무것도 렌더링하지 않습니다.
 *    - `onAddSchedules` 함수는 추출된 모든 스케줄을 인자로 받아 상위 컴포넌트의 캘린더 추가 로직을 호출합니다.
 *
 * ===================================================================================================
 */
import React from 'react';

/**
 * ExtractedSchedules
 *
 * @description OCR 분석을 통해 추출된 스케줄 정보를 목록 형태로 표시하고, 캘린더에 추가하는 액션 버튼을 제공하는 컴포넌트.
 * @param {object} props - 컴포넌트 props
 * @param {Array<object>} props.extractedSchedules - 표시할 추출된 스케줄 객체 배열. 각 스케줄은 title, date, time, location 등의 속성을 가짐.
 * @param {function} props.onAddSchedules - '이 일정들을 추가하시겠습니까?' 버튼 클릭 시 호출되는 콜백 함수.
 * @returns {JSX.Element|null} `extractedSchedules`가 없으면 null을 반환, 있으면 추출된 스케줄 목록과 추가 버튼을 렌더링.
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