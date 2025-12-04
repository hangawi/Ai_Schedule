/**
 * ===================================================================================================
 * [DuplicateModal.js] - 중복 이미지 업로드 확인 모달 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > client/src/components/chat/components/DuplicateModal.js
 *
 * 🎯 주요 기능:
 *    - 이미지 업로드 시 중복이 감지되었을 때 사용자에게 알림
 *    - 어떤 이미지가 어떤 이미지와 얼마나 유사한지 정보를 표시
 *    - '중복 제거하고 계속' 또는 '중복 무시하고 계속' 액션 버튼 제공
 *
 * 🔗 연결된 파일:
 *    - ../TimetableUploadWithChat.js: 이 모달을 호출하고, 모달의 액션에 대한 핸들러(`handleDuplicateRemove`, `handleDuplicateIgnore`)를 제공
 *
 * 💡 UI 위치:
 *    - '시간표 이미지 업로드' 과정에서 중복 이미지가 발견될 경우 모달 형태로 화면 중앙에 표시됨
 *
 * ✏️ 수정 가이드:
 *    - 모달의 텍스트나 스타일을 변경하려면 이 파일의 JSX 구조를 직접 수정합니다.
 *    - 버튼 클릭 시의 동작을 변경하려면 상위 컴포넌트인 `TimetableUploadWithChat.js`에 주입된 핸들러 함수들을 수정해야 합니다.
 *
 * 📝 참고사항:
 *    - `showDuplicateModal` prop이 true일 때만 모달이 표시됩니다.
 *
 * ===================================================================================================
 */
import React from 'react';

/**
 * DuplicateModal
 *
 * @description 중복된 이미지가 감지되었을 때, 사용자에게 확인을 요청하는 모달 UI를 렌더링합니다.
 * @param {object} props - 컴포넌트 props
 * @param {boolean} props.showDuplicateModal - 모달의 표시 여부를 결정하는 boolean 값.
 * @param {object|null} props.duplicateInfo - 중복 이미지에 대한 정보 객체.
 * @param {Array<object>} props.duplicateInfo.duplicates - 중복된 파일 정보 배열. 각 객체는 { filename, duplicateWith, similarity }를 포함.
 * @param {function} props.handleDuplicateRemove - '중복 제거' 버튼 클릭 시 실행될 콜백 함수.
 * @param {function} props.handleDuplicateIgnore - '중복 무시' 버튼 클릭 시 실행될 콜백 함수.
 * @returns {JSX.Element|null} `showDuplicateModal`이 false이거나 `duplicateInfo`가 없으면 null을 반환.
 */
const DuplicateModal = ({
  showDuplicateModal,
  duplicateInfo,
  handleDuplicateRemove,
  handleDuplicateIgnore
}) => {
  if (!showDuplicateModal || !duplicateInfo) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-bold mb-4">⚠️ 중복된 이미지 발견</h3>
        <div className="space-y-3 mb-6">
          <p className="text-gray-700">다음 이미지가 이미 업로드된 이미지와 중복됩니다:</p>
          {duplicateInfo.duplicates.map((dup, idx) => (
            <div key={idx} className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="font-semibold text-sm">"{dup.filename}"</p>
              <p className="text-xs text-gray-600 mt-1">
                → "{dup.duplicateWith}"와 {dup.similarity}% 유사
              </p>
            </div>
          ))}
          <p className="text-sm text-gray-600 mt-4">
            중복된 이미지를 제거하고 계속하시겠습니까?
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDuplicateRemove}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            중복 제거하고 계속
          </button>
          <button
            onClick={handleDuplicateIgnore}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            중복 무시하고 계속
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateModal;