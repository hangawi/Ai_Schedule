/**
 * ===================================================================================================
 * [ProgressBar.js] - 작업 진행률을 시각적으로 표시하는 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > client/src/components/chat/components/ProgressBar.js
 *
 * 🎯 주요 기능:
 *    - 현재 진행 중인 작업의 상태(메시지)와 진행률(%)을 표시
 *    - 진행률 변화에 따른 시각적인 프로그레스 바 애니메이션 제공
 *
 * 🔗 연결된 파일:
 *    - ../TimetableUploadWithChat.js: 시간표 이미지 처리 과정의 진행률을 사용자에게 보여줄 때 사용
 *
 * 💡 UI 위치:
 *    - '시간표 이미지 업로드' 모달 내에서 이미지 처리 중일 때 하단에 표시됨
 *
 * ✏️ 수정 가이드:
 *    - 진행률 바의 색상이나 높이 등 스타일을 변경하려면: 내부 `<div>` 요소들의 className을 수정합니다.
 *    - 진행률 메시지의 폰트 크기나 색상을 변경하려면: 관련 `<span>` 요소의 className을 수정합니다.
 *
 * 📝 참고사항:
 *    - `isProcessing` prop이 false일 때는 아무것도 렌더링하지 않습니다.
 *    - `progress.current`는 현재 진행률(%), `progress.message`는 사용자에게 보여줄 상태 메시지를 담고 있습니다.
 *
 * ===================================================================================================
 */
import React from 'react';

/**
 * ProgressBar
 *
 * @description 현재 진행 중인 작업의 진행률과 상태 메시지를 표시하는 시각적인 프로그레스 바 컴포넌트.
 * @param {object} props - 컴포넌트 props
 * @param {object} props.progress - 진행률 정보 객체. { current: number (0-100), total: number, message: string }
 * @param {boolean} props.isProcessing - 작업이 현재 진행 중인지 여부를 나타내는 boolean 값. false이면 컴포넌트 렌더링 안 함.
 * @returns {JSX.Element|null} `isProcessing`이 false이면 null을 반환, 그렇지 않으면 진행률 바를 렌더링.
 */
const ProgressBar = ({ progress, isProcessing }) => {
  if (!isProcessing) return null;

  return (
    <div className="px-4 pt-3 pb-2">
      <div className="flex justify-between text-sm mb-1">
        <span>{progress.message}</span>
        <span>{progress.current}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress.current}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;