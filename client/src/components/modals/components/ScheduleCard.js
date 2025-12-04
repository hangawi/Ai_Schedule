/**
 * ===================================================================================================
 * ScheduleCard.js - 개별 스케줄 정보를 표시하는 카드 UI 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/components/ScheduleCard.js
 *
 * 🎯 주요 기능:
 *    - 단일 스케줄 객체의 정보를 카드 형태로 시각화.
 *    - 스케줄 제목, 시작/종료 시간, 수업 시간(duration)을 표시.
 *    - 스케줄의 학년(gradeLevel)을 라벨로 표시.
 *    - 수업 시간이 추정된 경우('inferredDuration' flag) "추정" 배지를 표시.
 *
 * 🔗 연결된 파일:
 *    - ../AutoDetectedScheduleModal.js - OCR을 통해 자동 감지된 스케줄 목록을 표시할 때 이 카드를 사용.
 *    - ../constants/modalConstants.js - '초등부', '중등부' 등 학년 라벨을 가져오기 위해 사용.
 *
 * 💡 UI 위치:
 *    - '자동 감지된 시간표' 모달 내에서 각각의 스케줄 항목을 나타내는 카드.
 *
 * ✏️ 수정 가이드:
 *    - 카드에 표시되는 정보(예: 강사 이름)를 추가하려면, `schedule` prop에서 해당 데이터를 받아 JSX에 추가합니다.
 *    - 카드의 전체적인 디자인(색상, 폰트 등)을 변경하려면 이 파일의 Tailwind CSS 클래스를 수정합니다.
 *
 * ===================================================================================================
 */
import React from 'react';
import { Clock } from 'lucide-react';
import { GRADE_LEVEL_LABELS } from '../constants/modalConstants';

/**
 * ScheduleCard
 * @description 단일 스케줄 항목의 세부 정보를 담은 카드 형태의 UI를 렌더링합니다.
 * @param {object} props - 컴포넌트 props
 * @param {object} props.schedule - 표시할 스케줄 데이터 객체. (title, startTime, endTime, duration, gradeLevel 등 포함)
 * @param {number} props.index - React 리스트 렌더링을 위한 고유 key 값.
 * @returns {JSX.Element}
 */
const ScheduleCard = ({ schedule, index }) => {
  return (
    <div
      key={index}
      className="bg-white border border-purple-200 rounded-lg p-3 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-800 text-sm">
            {schedule.title}
          </h4>
          <div className="flex items-center mt-1 text-xs text-gray-600">
            <Clock size={12} className="mr-1" />
            {schedule.startTime} - {schedule.endTime}
            {schedule.inferredDuration && (
              <span className="ml-2 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                추정
              </span>
            )}
          </div>
          {schedule.duration && (
            <div className="text-xs text-gray-500 mt-1">
              {schedule.duration}분 수업
            </div>
          )}
        </div>
        {schedule.gradeLevel && (
          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
            {GRADE_LEVEL_LABELS[schedule.gradeLevel]}
          </span>
        )}
      </div>
    </div>
  );
};

export default ScheduleCard;
