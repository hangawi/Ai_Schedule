/**
 * ===================================================================================================
 * ScheduleHeader.js - 최적 시간표 추천 모달의 헤더 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/components/ScheduleHeader.js
 *
 * 🎯 주요 기능:
 *    - '최적 시간표 추천'이라는 제목과 보조 텍스트('충돌 없는 시간표 조합을 찾았습니다')를 표시.
 *    - 모달을 닫는 기능의 좌/우 버튼을 제공. (뒤로 가기, 닫기)
 *    - `isEmbedded` prop에 따라 렌더링 여부를 결정하여 유연하게 사용 가능.
 *
 * 🔗 연결된 파일:
 *    - ../ScheduleOptimizationModal.js - 이 컴포넌트를 사용하여 모달의 상단 영역을 구성.
 *
 * 💡 UI 위치:
 *    - '최적 시간표 제안' 모달의 최상단 헤더 영역.
 *
 * ✏️ 수정 가이드:
 *    - 헤더의 제목이나 보조 텍스트 내용을 변경하려면 JSX 내의 해당 `h2` 또는 `p` 태그의 내용을 수정합니다.
 *    - 버튼의 아이콘 또는 스타일을 변경하려면 `lucide-react` 아이콘 또는 Tailwind CSS 클래스를 수정합니다.
 *
 * 📝 참고사항:
 *    - `isEmbedded` prop이 `true`일 경우 이 헤더는 렌더링되지 않습니다. 이는 모달이 아닌 전체 페이지 뷰에서 사용될 때 유용합니다.
 *
 * ===================================================================================================
 */
import React from 'react';
import { ChevronLeft, X } from 'lucide-react';

/**
 * ScheduleHeader
 * @description 최적 시간표 추천 모달의 상단 헤더를 렌더링하는 컴포넌트.
 *              제목, 부제목, 그리고 모달을 닫는 버튼을 포함합니다.
 * @param {object} props - 컴포넌트 props
 * @param {function} props.onClose - 모달을 닫기 위해 호출되는 함수.
 * @param {boolean} [props.isEmbedded=false] - 컴포넌트가 임베드된 뷰에서 사용되는지 여부. true이면 렌더링되지 않습니다.
 * @returns {JSX.Element|null}
 */
const ScheduleHeader = ({ onClose, isEmbedded }) => {
  if (isEmbedded) return null;

  return (
    <div className="bg-gradient-to-r from-purple-600 via-purple-500 to-blue-600 text-white px-5 py-3 flex-shrink-0">
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
          title="뒤로 가기"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 text-center">
          <h2 className="text-xl font-bold">최적 시간표 추천</h2>
          <p className="text-xs text-purple-100 mt-1">
            충돌 없는 시간표 조합을 찾았습니다
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
        >
          <X size={24} />
        </button>
      </div>
    </div>
  );
};

export default ScheduleHeader;
