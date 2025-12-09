/**
 * ===================================================================================================
 * TimeSlot.js - 타임테이블 개별 슬롯 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/timetable
 *
 * 🎯 주요 기능:
 *    - 타임테이블 그리드의 개별 슬롯 셀 렌더링
 *    - 슬롯 상태별 색상 및 스타일 적용 (배정됨/차단됨/선택됨/빈 슬롯)
 *    - 클릭 가능 여부 제어 (차단된 슬롯은 클릭 불가)
 *    - 병합된 슬롯 표시 (테두리 강조)
 *    - 이동 시간 슬롯 표시 (소요 시간 표시)
 *    - 방장의 스케줄 타입별 색상 구분 (불가능/개인/예외)
 *    - 방 예외 일정 표시 (청록색)
 *    - 멤버 이름 표시 (6자 초과 시 말줄임)
 *
 * 🔗 연결된 파일:
 *    - ./TimetableGrid.js - 이 컴포넌트를 배열로 렌더링하여 그리드 생성
 *    - ./WeekView.js - 주간 뷰에서 TimeSlot 배열 사용
 *    - ../tabs/CoordinationTab/index.js - 조율 탭에서 사용
 *
 * 💡 UI 위치:
 *    - 탭: 조율 탭 (CoordinationTab)
 *    - 섹션: 타임테이블 그리드의 각 셀
 *    - 경로: 앱 실행 > 조율 탭 > 주간/월간 뷰 > 각 시간 슬롯
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 타임테이블의 모든 슬롯 셀 UI가 변경됨
 *    - 슬롯 색상 변경: style 객체의 backgroundColor, borderColor 수정
 *    - 높이 변경: h-8 클래스 수정
 *    - 텍스트 길이 제한 변경: substring(0, 4) 값 수정
 *    - 새로운 슬롯 타입 추가: isEffectivelyBlocked 로직 및 style 조건 추가
 *
 * 📝 참고사항:
 *    - 슬롯 높이: h-8 (32px 고정)
 *    - 멤버 색상: hex + CC (80% 투명도)
 *    - 차단된 슬롯 종류:
 *      1. non_preferred (불가능): 연한 보라 (#E9D5FF)
 *      2. personal (개인시간): 연한 주황 (#FED7AA)
 *      3. exception (예외일정): 연한 노란색 (#FEF3C7)
 *      4. roomException (방 예외): 연한 청록 (#99F6E4)
 *      5. 기타: 연한 회색 (#F3F4F6)
 *    - 병합 슬롯: 테두리 2px 표시 (isMergedSlot=true)
 *    - 이동 시간 슬롯: 소요 시간 텍스트 표시 (isTravel=true)
 *
 * ===================================================================================================
 */

import React from 'react';

/**
 * TimeSlot - 타임테이블 개별 슬롯 셀 컴포넌트
 *
 * @description 타임테이블 그리드의 각 시간 슬롯을 렌더링하고, 상태에 따라 색상 및 동작 제어
 *
 * @component
 *
 * @param {Object} props - 컴포넌트 props
 * @param {Date} props.date - 슬롯의 날짜 객체
 *   - 클릭 이벤트 시 onSlotClick에 전달됨
 *
 * @param {number} props.day - 요일 인덱스 (0=일, 1=월, ..., 6=토)
 *   - 현재 미사용 (향후 확장용)
 *
 * @param {string} props.time - 슬롯 시작 시간 (HH:MM 형식)
 *   - 예: "09:00", "14:30"
 *   - 클릭 이벤트 시 onSlotClick에 전달됨
 *
 * @param {Object|null} props.ownerInfo - 슬롯 소유자 정보 (배정된 멤버 정보)
 *   - null이면 빈 슬롯
 *   - 구조: {
 *       name: 멤버 이름,
 *       color: 멤버 색상 (hex),
 *       subject: 과목명 (이동 시간인 경우),
 *       isTravel: 이동 시간 여부,
 *       travelInfo: { durationText: "15분" },
 *       isMergedSlot: 병합된 슬롯 여부,
 *       mergedDuration: 병합된 슬롯의 총 시간 (분)
 *     }
 *
 * @param {boolean} props.isSelected - 사용자가 선택한 슬롯 여부
 *   - true: 파란색 배경 + 테두리 (bg-blue-200, border-blue-400)
 *   - 방장이 아닌 멤버가 선택 시 사용
 *
 * @param {Object|null} props.blockedInfo - 차단된 슬롯 정보 (방장의 스케줄)
 *   - null이면 차단되지 않음
 *   - 구조: {
 *       name: 스케줄 이름,
 *       ownerScheduleType: 'non_preferred' | 'personal' | 'exception'
 *     }
 *   - ownerScheduleType:
 *     - non_preferred: 불가능한 시간 (우선순위 낮음)
 *     - personal: 개인 시간 (식사, 수면 등)
 *     - exception: 예외 일정 (특정 날짜 스케줄)
 *
 * @param {Object|null} props.roomExceptionInfo - 방 예외 일정 정보
 *   - null이면 방 예외 없음
 *   - 구조: { name: 예외 일정 이름 }
 *   - 방 전체에 적용되는 예외 일정 (예: 공휴일, 방학 등)
 *
 * @param {boolean} props.isBlocked - 차단된 슬롯 여부 (기본)
 *   - blockedInfo 또는 roomExceptionInfo가 있으면 true로 간주됨
 *
 * @param {boolean} props.isRoomOwner - 현재 사용자가 방장 여부
 *   - true: 빈 슬롯에 hover 시 초록색 배경 (bg-green-50)
 *   - false: 빈 슬롯에 hover 시 파란색 배경 (bg-blue-50)
 *
 * @param {Object} props.currentUser - 현재 사용자 정보
 *   - 사용자가 로그인되어 있으면 객체, 아니면 null
 *   - null이면 클릭 불가
 *
 * @param {Function} props.onSlotClick - 슬롯 클릭 핸들러
 *   - 파라미터: (date, time)
 *   - 동작: 슬롯 선택/배정 처리
 *   - 차단된 슬롯은 클릭해도 호출되지 않음
 *
 * @param {boolean} props.showMerged - 병합 모드 여부 (기본값: true)
 *   - true: 병합된 슬롯에 테두리 표시
 *   - false: 병합 표시 없음
 *
 * @returns {JSX.Element} 슬롯 셀 UI
 *
 * @example
 * // 빈 슬롯
 * <TimeSlot
 *   date={new Date()}
 *   day={1}
 *   time="09:00"
 *   ownerInfo={null}
 *   isSelected={false}
 *   blockedInfo={null}
 *   roomExceptionInfo={null}
 *   isBlocked={false}
 *   isRoomOwner={false}
 *   currentUser={user}
 *   onSlotClick={handleSlotClick}
 * />
 *
 * @example
 * // 배정된 슬롯
 * <TimeSlot
 *   date={new Date()}
 *   day={1}
 *   time="09:00"
 *   ownerInfo={{ name: "홍길동", color: "#FF6B6B" }}
 *   isSelected={false}
 *   blockedInfo={null}
 *   roomExceptionInfo={null}
 *   isBlocked={false}
 *   isRoomOwner={true}
 *   currentUser={user}
 *   onSlotClick={handleSlotClick}
 * />
 *
 * @note
 * - 슬롯 상태 우선순위: 차단됨 > 배정됨 > 선택됨 > 빈 슬롯
 * - 차단된 슬롯은 클릭 불가 (cursor-not-allowed)
 * - 배정된 슬롯은 클릭 가능 (삭제 또는 정보 보기용)
 * - 병합 슬롯은 테두리 2px 표시 (border-2)
 * - 이동 시간 슬롯은 소요 시간 표시 (예: "15분")
 * - 멤버 이름이 6자 초과 시 "홍길..."로 표시
 * - 멤버 색상: hex + CC (80% 투명도)
 */
const TimeSlot = ({
  date,
  day,
  time,
  ownerInfo,
  isSelected,
  blockedInfo,
  roomExceptionInfo,
  isBlocked,
  isRoomOwner,
  currentUser,
  onSlotClick,
  showMerged = true
}) => {
  // ===================================================================================================
  // 📌 섹션 1: 파생 상태 계산
  // ===================================================================================================
  //
  // 이 섹션에서는 props로부터 파생된 상태를 계산합니다.
  //
  // 📝 파생 상태:
  //    - isEffectivelyBlocked: 실제로 차단된 슬롯 여부 (blockedInfo 또는 roomExceptionInfo)
  //
  // ===================================================================================================

  /**
   * isEffectivelyBlocked - 실제로 차단된 슬롯 여부
   *
   * @type {boolean}
   * @description blockedInfo 또는 roomExceptionInfo가 있으면 true
   *
   * @note
   * - isBlocked prop은 기본 차단 상태
   * - roomExceptionInfo가 추가되면서 두 가지를 모두 고려
   * - 이 값이 true면 클릭 불가 (cursor-not-allowed)
   */
  const isEffectivelyBlocked = isBlocked || !!roomExceptionInfo;

  // ===================================================================================================
  // 📌 섹션 2: 이벤트 핸들러
  // ===================================================================================================
  //
  // 이 섹션에서는 사용자 인터랙션을 처리하는 핸들러 함수를 정의합니다.
  //
  // 📝 핸들러:
  //    - handleClick: 슬롯 클릭 핸들러
  //
  // ===================================================================================================

  /**
   * handleClick - 슬롯 클릭 핸들러
   *
   * @description 슬롯 클릭 시 onSlotClick prop 호출 (차단된 슬롯 제외)
   *
   * @process
   * 1. isEffectivelyBlocked가 true면 early return (클릭 무시)
   * 2. onSlotClick(date, time) 호출
   *    - date: 슬롯의 날짜 객체
   *    - time: 슬롯 시작 시간 (HH:MM)
   *
   * @note
   * - 차단된 슬롯은 클릭해도 아무 동작 없음
   * - 부모 컴포넌트에서 onSlotClick을 통해 슬롯 선택/배정 처리
   * - date 객체를 전달하여 정확한 날짜 식별 가능
   */
  const handleClick = () => {
    if (isEffectivelyBlocked) return; // 차단된 슬롯은 클릭 불가
    onSlotClick(date, time); // 날짜 객체와 시간 전달
  };

  // ===================================================================================================
  // 📌 섹션 3: 렌더링
  // ===================================================================================================
  //
  // 이 섹션에서는 슬롯 셀의 UI를 렌더링합니다.
  //
  // 📝 렌더링 구조:
  //    1. 슬롯 셀 (div)
  //       - 조건부 className (차단/배정/선택/빈 슬롯별 스타일)
  //       - 조건부 style (배경색, 테두리색)
  //    2. 슬롯 내용
  //       - 차단된 슬롯: 스케줄 이름 표시
  //       - 배정된 슬롯: 멤버 이름 표시 (병합/이동 시간 정보 포함)
  //       - 선택된 빈 슬롯: "선택됨" 텍스트 표시
  //       - 일반 빈 슬롯: 빈 상태
  //
  // ===================================================================================================

  return (
    <div
      key={`${date.toISOString().split('T')[0]}-${time}`}
      className={`col-span-1 border-l border-gray-200 h-8 flex items-center justify-center
        ${isEffectivelyBlocked ? 'cursor-not-allowed' : ''}
        ${!isEffectivelyBlocked && !ownerInfo && isSelected ? 'bg-blue-200 border-2 border-blue-400' : ''}
        ${!isEffectivelyBlocked && !ownerInfo && !isSelected && currentUser ? 'hover:bg-blue-50 cursor-pointer' : ''}
        ${!isEffectivelyBlocked && ownerInfo && currentUser ? 'cursor-pointer hover:opacity-80' : ''}
        ${!isEffectivelyBlocked && isRoomOwner && !ownerInfo ? 'cursor-pointer hover:bg-green-50' : ''}
      `}
      // ========== 조건부 스타일: 배경색 및 테두리색 ========== //
      //
      // 우선순위:
      // 1. 배정된 슬롯 (!isEffectivelyBlocked && ownerInfo)
      //    - 배경색: 멤버 색상 + CC (80% 투명도)
      //    - 테두리색: 멤버 색상
      //
      // 2. 방장의 불가능한 시간 (isEffectivelyBlocked && blockedInfo?.ownerScheduleType === 'non_preferred')
      //    - 배경색: 연한 보라 (#E9D5FF)
      //    - 테두리색: 보라 (#C084FC)
      //
      // 3. 방장의 개인시간 (isEffectivelyBlocked && blockedInfo?.ownerScheduleType === 'personal')
      //    - 배경색: 연한 주황 (#FED7AA)
      //    - 테두리색: 주황 (#FB923C)
      //
      // 4. 방장의 예외일정 (isEffectivelyBlocked && blockedInfo?.ownerScheduleType === 'exception')
      //    - 배경색: 연한 노란색 (#FEF3C7)
      //    - 테두리색: 노란색 (#FBBF24)
      //
      // 5. 방 예외 일정 (isEffectivelyBlocked && roomExceptionInfo && !blockedInfo?.ownerScheduleType)
      //    - 배경색: 연한 청록 (#99F6E4)
      //    - 테두리색: 청록 (#2DD4BF)
      //
      // 6. 기타 차단 (isEffectivelyBlocked && !blockedInfo?.ownerScheduleType && !roomExceptionInfo)
      //    - 배경색: 연한 회색 (#F3F4F6)
      //    - 테두리색: 회색 (#D1D5DB)
      //
      // 7. 기본 (빈 슬롯 또는 선택된 슬롯)
      //    - 스타일 없음 (className으로 제어)
      style={!isEffectivelyBlocked && ownerInfo ? { backgroundColor: `${ownerInfo.color}CC`, borderColor: ownerInfo.color } :
             // 방장의 불가능한 시간 (non_preferred) - 연한 보라/라벤더
             isEffectivelyBlocked && blockedInfo?.ownerScheduleType === 'non_preferred' ? { backgroundColor: '#E9D5FF', borderColor: '#C084FC' } :
             // 방장의 개인시간 (personal) - 연한 주황/피치
             isEffectivelyBlocked && blockedInfo?.ownerScheduleType === 'personal' ? { backgroundColor: '#FED7AA', borderColor: '#FB923C' } :
             // 방장의 예외일정 (exception) - 연한 노란색
             isEffectivelyBlocked && blockedInfo?.ownerScheduleType === 'exception' ? { backgroundColor: '#FEF3C7', borderColor: '#FBBF24' } :
             // 그 외 roomException - 연한 청록
             isEffectivelyBlocked && roomExceptionInfo && !blockedInfo?.ownerScheduleType ? { backgroundColor: '#99F6E4', borderColor: '#2DD4BF' } :
             // 기타 blocked - 연한 회색 (fallback)
             isEffectivelyBlocked && !blockedInfo?.ownerScheduleType && !roomExceptionInfo ? { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' } : {}
            }
      onClick={handleClick}
    >
      {/* ========== 슬롯 내용 렌더링 ========== */}
      {/*
       * @structure
       * - 차단된 슬롯: 스케줄 이름 표시 (roomExceptionInfo 또는 blockedInfo.name)
       * - 배정된 슬롯: 멤버 이름 + 병합/이동 시간 정보
       * - 선택된 빈 슬롯 (비방장): "선택됨" 텍스트
       * - 일반 빈 슬롯: 빈 상태
       */}
      {isEffectivelyBlocked ? (
        /* ========== 차단된 슬롯 ========== */
        /*
         * @description 차단된 슬롯의 이름 표시
         *
         * @content
         * - roomExceptionInfo가 있으면 roomExceptionInfo.name
         * - 없으면 blockedInfo.name
         * - 예: "불가능한 시간", "식사 시간", "공휴일"
         *
         * @note
         * - 텍스트 색상: 회색 (text-gray-600)
         * - 폰트 크기: text-xs
         * - title 속성: hover 시 전체 이름 표시
         */
        <span className="text-xs text-gray-600 font-medium" title={roomExceptionInfo ? roomExceptionInfo.name : blockedInfo.name}>
          {roomExceptionInfo ? roomExceptionInfo.name : blockedInfo.name}
        </span>
      ) : (
        <>
          {/* ========== 배정된 슬롯 ========== */}
          {/*
           * @description 멤버가 배정된 슬롯의 정보 표시
           *
           * @content
           * - 이동 시간 슬롯: 과목명 + 소요 시간 (예: "국어 (15분)")
           * - 병합 슬롯: 멤버 이름 + 테두리 2px + 병합 정보 (예: "홍길동 - 병합됨 (60분)")
           * - 일반 슬롯: 멤버 이름 (6자 초과 시 말줄임: "홍길...")
           *
           * @note
           * - 배경색: 멤버 색상 + CC (80% 투명도)
           * - 병합 슬롯: 테두리 2px (border-2), 테두리색: 멤버 색상
           * - 이동 시간 슬롯: 소요 시간 별도 div로 표시 (text-gray-600)
           */}
          {ownerInfo && (
            <span
              className={`text-xs font-medium px-1 py-0.5 rounded ${showMerged && ownerInfo.isMergedSlot ? 'border-2' : ''}`}
              style={{
                color: '#000000',
                backgroundColor: `${ownerInfo.color}CC`,
                ...(showMerged && ownerInfo.isMergedSlot ? {
                  borderColor: ownerInfo.color,
                  borderStyle: 'solid'
                } : {})
              }}
              title={ownerInfo.isTravel && ownerInfo.travelInfo ? `${ownerInfo.subject} (${ownerInfo.travelInfo.durationText})` :
                (showMerged && ownerInfo.isMergedSlot && ownerInfo.mergedDuration ?
                  `${ownerInfo.subject || ownerInfo.name} - 병합됨 (${ownerInfo.mergedDuration}분)` :
                  ownerInfo.subject || ownerInfo.name)
              }
            >
              {ownerInfo.isTravel ? ownerInfo.subject : (ownerInfo.name.length > 6 ? ownerInfo.name.substring(0, 4) + '...' : ownerInfo.name)}
              {ownerInfo.isTravel && ownerInfo.travelInfo && (
                <div className="text-xs text-gray-600">
                  {ownerInfo.travelInfo.durationText}
                </div>
              )}
            </span>
          )}

          {/* ========== 선택된 빈 슬롯 (비방장) ========== */}
          {/*
           * @description 방장이 아닌 멤버가 선택한 빈 슬롯 표시
           *
           * @condition
           * - !ownerInfo: 빈 슬롯
           * - isSelected: 선택됨
           * - !isRoomOwner: 방장이 아님
           *
           * @content
           * - "선택됨" 텍스트
           * - 파란색 배경 (bg-blue-100)
           * - 파란색 텍스트 (text-blue-700)
           *
           * @note
           * - 방장은 직접 배정하므로 "선택됨" 표시 불필요
           * - 멤버는 선택 후 방장이 배정함
           */}
          {!ownerInfo && isSelected && !isRoomOwner && (
            <span className="text-xs font-medium text-blue-700 px-1 py-0.5 rounded bg-blue-100">
              선택됨
            </span>
          )}
        </>
      )}
    </div>
  );
};

export default TimeSlot;
