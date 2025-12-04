/**
 * ===================================================================================================
 * OriginalScheduleModal.js - OCR로 추출된 원본 시간표를 보여주는 모달
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/OriginalScheduleModal.js
 *
 * 🎯 주요 기능:
 *    - OCR(이미지 텍스트 인식)을 통해 추출된, 아직 최적화되지 않은 원본 스케줄 데이터를 시각적으로 표시.
 *    - `ScheduleGridSelector` 컴포넌트를 재사용하여 시간표를 그리드 형태로 보여줌.
 *    - 원본 스케줄 데이터(`imageData`)를 `ScheduleGridSelector`가 요구하는 `personalTimes` 데이터 형식으로 변환.
 *      (요일 문자 -> 숫자, 이미지별 고유 색상 할당 등)
 *    - 표시할 스케줄의 시작/종료 시간에 맞춰 그리드의 시간 범위를 동적으로 조절.
 *
 * 🔗 연결된 파일:
 *    - ../../chat/components/ScheduleView.js (추정) - 최적화된 시간표 뷰의 범례(legend)에서 원본 이미지를 클릭했을 때 이 모달을 호출.
 *    - ../tabs/ScheduleGridSelector/index.js - 시간표 UI를 렌더링하는 핵심 재사용 컴포넌트.
 *    - ../../utils/scheduleAnalysis/assignScheduleColors.js - 이미지 인덱스에 따라 고유한 색상을 반환.
 *
 * 💡 UI 위치:
 *    - AI 채팅을 통해 시간표 이미지(OCR)를 올린 후, 최적화 결과 화면의 범례에서 특정 이미지 출처를 클릭하면 나타나는 팝업 모달.
 *
 * ✏️ 수정 가이드:
 *    - 원본 스케줄 데이터(`imageData.schedules`)의 형식이 변경될 경우, `personalTimes`로 변환하는 `map` 로직을 수정해야 합니다.
 *    - 그리드에 표시되는 시간대의 기본 범위를 변경하려면 `startHour`, `endHour`의 초기값을 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 모달은 사용자에게 AI의 데이터 추출 원본을 투명하게 보여줌으로써 신뢰를 높이는 역할을 합니다.
 *    - 모든 데이터는 읽기 전용(`readOnly={true}`)으로 표시됩니다.
 *
 * ===================================================================================================
 */
import React from 'react';
import { X } from 'lucide-react';
import ScheduleGridSelector from '../tabs/ScheduleGridSelector';
import { getColorForImageIndex } from '../../utils/scheduleAnalysis/assignScheduleColors';

/**
 * 원본 시간표 전체를 보여주는 모달
 * - 최적화 전 OCR로 추출한 전체 스케줄 표시
 * - 범례 클릭 시 해당 이미지의 원본 시간표만 표시
 */
const OriginalScheduleModal = ({ imageData, imageIndex, onClose }) => {
  if (!imageData) return null;
  // 원본 스케줄을 personalTimes 형식으로 변환
  const personalTimes = imageData.schedules.map((schedule, index) => {
    const dayMap = {
      'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4,
      'FRI': 5, 'SAT': 6, 'SUN': 7,
      '월': 1, '화': 2, '수': 3, '목': 4,
      '금': 5, '토': 6, '일': 7
    };

    const daysArray = Array.isArray(schedule.days) ? schedule.days : [schedule.days];
    const mappedDays = daysArray.map(day => dayMap[day] || day).filter(d => d && typeof d === 'number');

    // 이미지 색상 가져오기
    const color = getColorForImageIndex(imageIndex);

    return {
      id: Date.now() + index,
      type: 'study',
      days: mappedDays,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      title: schedule.title || '수업',
      academyName: schedule.academyName,  // 학원 이름 추가
      subjectName: schedule.subjectName,  // 과목명 추가
      instructor: schedule.instructor,  // 강사명 추가
      color: color.border,
      description: schedule.description || '',
      isRecurring: true
    };
  }).filter(item => item.days && item.days.length > 0);
  // 시간 범위 계산 - 전체 시간 포함하도록 수정
  const timeToMinutes = (time) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };
  const minutesToTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  let startHour = 9;
  let endHour = 22;

  if (personalTimes.length > 0) {
    const allStartTimes = personalTimes.map(pt => timeToMinutes(pt.startTime));
    const allEndTimes = personalTimes.map(pt => timeToMinutes(pt.endTime));

    const minMinutes = Math.min(...allStartTimes);
    const maxMinutes = Math.max(...allEndTimes);

    // 시간 단위로 계산 (숫자 형식으로)
    startHour = Math.floor(minMinutes / 60);
    // 19:10이면 20시까지 (ceil로 올림)
    endHour = Math.ceil(maxMinutes / 60);
  }

  const timeRange = { start: startHour, end: endHour };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-8" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-2xl w-[75%] max-w-5xl h-[75vh] flex flex-col relative z-[10000]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-5 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-t-lg flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">
                {imageData.title || `이미지 ${imageIndex + 1}`} - 원본 시간표
              </h2>
              <p className="text-xs text-purple-100 mt-1">
                총 {personalTimes.length}개 수업 · 최적화 전 전체 데이터
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 시간표 그리드 */}
        <div className="px-4 py-3 overflow-y-auto flex-1">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden h-full">
            <ScheduleGridSelector
              schedule={[]}
              exceptions={[]}
              personalTimes={personalTimes}
              readOnly={true}
              enableMonthView={false}
              showViewControls={false}
              initialTimeRange={timeRange}
              defaultShowMerged={true}
            />
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex justify-end rounded-b-lg flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default OriginalScheduleModal;
