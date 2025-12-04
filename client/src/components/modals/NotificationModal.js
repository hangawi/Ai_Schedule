/**
 * ===================================================================================================
 * NotificationModal.js - 간단한 알림을 표시하기 위한 모달 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/NotificationModal.js
 *
 * 🎯 주요 기능:
 *    - 사용자에게 간단한 정보, 성공, 또는 오류 메시지를 팝업 형태로 제공.
 *    - `type` prop('success', 'error', 'info')에 따라 아이콘과 전체적인 색상 테마가 변경됨.
 *    - '확인' 버튼만 존재하는 단방향 알림 UI.
 *
 * 🔗 연결된 파일:
 *    - 이 컴포넌트는 앱 전역에서 간단한 알림이 필요할 때 사용됩니다. (예: ./SchedulingSystem.js 등)
 *
 * 💡 UI 위치:
 *    - 특정 액션 완료 후 결과(성공/실패)를 알리기 위해 화면 중앙에 표시되는 팝업 모달.
 *
 * ✏️ 수정 가이드:
 *    - 알림 종류(`type`)에 따른 아이콘이나 색상을 변경하려면 `getIcon`, `getBgColor`, `getButtonColor` 함수를 수정합니다.
 *    - 모달의 레이아웃을 변경하려면 JSX 구조를 수정합니다.
 *
 * 📝 참고사항:
 *    - `CustomAlertModal`과 유사한 목적을 가지지만, 더 단순한 UI(확인 버튼만 존재)를 가집니다.
 *    - 주로 사용자로부터 추가적인 선택(예/아니오)을 받을 필요가 없는 단순 공지에 사용됩니다.
 *
 * ===================================================================================================
 */
import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

/**
 * NotificationModal
 * @description 성공, 실패 등의 간단한 알림을 사용자에게 보여주는 모달 컴포넌트.
 * @param {object} props - 컴포넌트 props
 * @param {boolean} props.isOpen - 모달의 열림 상태.
 * @param {function} props.onClose - 모달을 닫는 함수 ('확인' 버튼 클릭 시 호출됨).
 * @param {string} props.type - 알림의 유형 ('success', 'error'). 아이콘과 색상에 영향을 줌.
 * @param {string} props.title - 알림의 제목.
 * @param {string} props.message - 알림의 상세 메시지.
 * @returns {JSX.Element|null} isOpen이 false이면 null을 반환.
 */
const NotificationModal = ({ isOpen, onClose, type, title, message }) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />;
      case 'error':
        return <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />;
      default:
        return <CheckCircle className="w-12 h-12 text-blue-500 mx-auto mb-4" />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getButtonColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500 hover:bg-green-600';
      case 'error':
        return 'bg-red-500 hover:bg-red-600';
      default:
        return 'bg-blue-500 hover:bg-blue-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-lg shadow-xl max-w-md w-full mx-auto border-2 ${getBgColor()}`}>
        <div className="p-6">
          {getIcon()}
          
          <h3 className="text-lg font-semibold text-center text-gray-800 mb-2">
            {title}
          </h3>
          
          <p className="text-center text-gray-600 mb-6">
            {message}
          </p>
          
          <div className="flex justify-center">
            <button
              onClick={onClose}
              className={`px-6 py-2 text-white rounded-lg font-medium transition-colors ${getButtonColor()}`}
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;