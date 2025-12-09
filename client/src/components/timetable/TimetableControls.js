/**
 * ===================================================================================================
 * TimetableControls.js - 타임테이블 헤더 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/timetable
 *
 * 🎯 주요 기능:
 *    - 타임테이블 그리드의 헤더 행 렌더링
 *    - "시간" 레이블 + 평일 5개 (월~금) 표시
 *    - weekDates 또는 days 배열에서 평일만 추출하여 표시
 *    - 6열 그리드 구조 (시간 1열 + 요일 5열)
 *
 * 🔗 연결된 파일:
 *    - ./TimetableGrid.js - 이 컴포넌트를 헤더로 사용
 *    - ./WeekView.js - 주간 뷰에서 사용
 *    - ../tabs/CoordinationTab/index.js - 조율 탭에서 사용
 *
 * 💡 UI 위치:
 *    - 탭: 조율 탭 (CoordinationTab)
 *    - 섹션: 타임테이블 그리드 상단 (헤더 행)
 *    - 경로: 앱 실행 > 조율 탭 > 주간 뷰 > 헤더
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 타임테이블 헤더의 UI가 변경됨
 *    - 열 개수 변경: grid-cols-6 및 displayItems.slice(0, 5) 수정
 *    - 스타일 변경: className의 Tailwind 클래스 수정
 *    - 표시 형식 변경: item.display 또는 item 렌더링 로직 수정
 *
 * 📝 참고사항:
 *    - 평일만 표시 (월~금, 5일)
 *    - 총 6열 (시간 1열 + 요일 5열)
 *    - weekDates 우선, 없으면 days 배열 사용
 *    - weekDates 형식: [{ display: "월 (12.9)", ... }, ...]
 *    - days 형식: ["월", "화", "수", "목", "금"]
 *    - 배경색: 회색 (bg-gray-100)
 *    - 폰트: 세미볼드 (font-semibold)
 *
 * ===================================================================================================
 */

import React from 'react';

/**
 * TimetableControls - 타임테이블 헤더 컴포넌트
 *
 * @description 타임테이블 그리드의 헤더 행을 렌더링하여 시간 레이블과 평일 표시
 *
 * @component
 *
 * @param {Object} props - 컴포넌트 props
 * @param {Array} props.weekDates - 주간 날짜 배열 (우선 사용)
 *   - 구조: [{ display: "월 (12.9)", fullDate: Date, dayOfWeek: 1 }, ...]
 *   - display: 요일 + 날짜 형식 (예: "월 (12.9)")
 *   - 평일만 사용 (인덱스 0~4: 월~금)
 *
 * @param {Array} props.days - 요일 이름 배열 (fallback)
 *   - 구조: ["월", "화", "수", "목", "금", "토", "일"]
 *   - weekDates가 없을 때 사용
 *   - 평일만 사용 (인덱스 0~4: 월~금)
 *
 * @returns {JSX.Element} 헤더 행 UI (6열 그리드)
 *
 * @example
 * <TimetableControls
 *   weekDates={[
 *     { display: "월 (12.9)", fullDate: new Date(), dayOfWeek: 1 },
 *     { display: "화 (12.10)", fullDate: new Date(), dayOfWeek: 2 },
 *     ...
 *   ]}
 *   days={["월", "화", "수", "목", "금", "토", "일"]}
 * />
 *
 * @note
 * - 평일만 표시 (월~금, 5일)
 * - 총 6열: "시간" + 요일 5개
 * - weekDates가 있으면 item.display, 없으면 item (요일 이름)
 * - 배경색: 회색 (bg-gray-100)
 * - 테두리: 하단 + 좌측 (border-b, border-l)
 */
const TimetableControls = ({ weekDates, days }) => {
  // ===================================================================================================
  // 📌 섹션 1: 표시 항목 준비
  // ===================================================================================================
  //
  // 이 섹션에서는 헤더에 표시할 항목을 준비합니다.
  //
  // 📝 로직:
  //    - weekDates가 있으면 weekDates의 앞 5개 (평일)
  //    - weekDates가 없으면 days의 앞 5개 (평일)
  //
  // ===================================================================================================

  /**
   * displayItems - 헤더에 표시할 항목 배열
   *
   * @type {Array}
   * @description weekDates 또는 days 배열에서 평일 5개 추출
   *
   * @note
   * - weekDates가 있으면: weekDates.slice(0, 5)
   *   - 형식: [{ display: "월 (12.9)", ... }, ...]
   * - weekDates가 없으면: days.slice(0, 5)
   *   - 형식: ["월", "화", "수", "목", "금"]
   * - 평일만 표시 (토, 일 제외)
   */
  const displayItems = weekDates.length > 0 ? weekDates.slice(0, 5) : days.slice(0, 5);

  // ===================================================================================================
  // 📌 섹션 2: 렌더링
  // ===================================================================================================
  //
  // 이 섹션에서는 헤더 행 UI를 렌더링합니다.
  //
  // 📝 렌더링 구조:
  //    1. "시간" 레이블 (1열)
  //    2. 평일 5개 (각 1열씩, 총 5열)
  //
  // ===================================================================================================

  return (
    <div className="grid grid-cols-6 bg-gray-100 border-b border-gray-200">
      {/* ========== "시간" 레이블 (1열) ========== */}
      {/*
       * @description 타임테이블의 첫 번째 열 헤더
       *
       * @content
       * - 텍스트: "시간"
       * - 배경색: 회색 (bg-gray-100)
       * - 폰트: 세미볼드, 회색 (font-semibold, text-gray-700)
       */}
      <div className="col-span-1 p-2 text-center font-semibold text-gray-700">시간</div>

      {/* ========== 평일 5개 (각 1열씩) ========== */}
      {/*
       * @description 타임테이블의 요일 열 헤더
       *
       * @content
       * - weekDates가 있으면: item.display (예: "월 (12.9)")
       * - weekDates가 없으면: item (예: "월")
       *
       * @note
       * - 총 5개 열 (월~금)
       * - 각 열: 좌측 테두리 (border-l)
       * - 배경색: 회색 (bg-gray-100)
       * - 폰트: 세미볼드, 회색 (font-semibold, text-gray-700)
       */}
      {displayItems.map((item, index) => (
        <div key={index} className="col-span-1 p-2 text-center font-semibold text-gray-700 border-l border-gray-200">
          {weekDates.length > 0 ? item.display : item}
        </div>
      ))}
    </div>
  );
};

export default TimetableControls;
