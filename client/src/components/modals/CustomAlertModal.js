/**
 * ===================================================================================================
 * CustomAlertModal.js - 앱 전역에서 사용되는 커스텀 알림/확인 모달
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/CustomAlertModal.js
 *
 * 🎯 주요 기능:
 *    - 브라우저의 기본 `alert`, `confirm` 대화상자를 대체하는 스타일링된 모달 제공.
 *    - `type` prop('info', 'success', 'warning', 'error')에 따라 아이콘과 색상이 동적으로 변경.
 *    - `showCancel` prop을 통해 확인 버튼만 있는 알림(alert) 모드와, 확인/취소 버튼이 모두 있는 확인(confirm) 모드를 선택 가능.
 *    - 모달의 제목, 메시지, 버튼 텍스트 등을 props로 커스터마이징 가능.
 *
 * 🔗 연결된 파일:
 *    - 앱 내에서 사용자에게 알림이나 확인이 필요한 거의 모든 컴포넌트에서 사용됨.
 *    - (예: ./SchedulingSystem.js, ./AddEventModal.js 등)
 *
 * 💡 UI 위치:
 *    - 특정 액션(예: 저장, 삭제, 오류 발생)이 일어났을 때 화면 중앙 최상단에 팝업으로 표시됨.
 *
 * ✏️ 수정 가이드:
 *    - 새로운 알림 타입을 추가하려면 `getIcon`, `getColors` 함수에 새로운 `case`를 추가해야 합니다.
 *    - 모달의 기본 레이아웃이나 애니메이션을 변경하려면 이 파일의 JSX와 CSS 클래스를 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 매우 높은 `z-index`(`z-[9999]`)를 사용하여 다른 모든 UI 요소들 위에 표시되도록 설계되었습니다.
 *    - `onConfirm` 함수 실행 후 `onClose`가 자동으로 호출되어 모달이 닫히는 구조입니다.
 *
 * ===================================================================================================
 */
import React from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

/**
 * CustomAlertModal
 * @description 정보, 성공, 경고, 오류 등 다양한 유형의 메시지를 표시하고 사용자 확인을 받을 수 있는 재사용 가능한 모달.
 * @param {object} props - 컴포넌트 props
 * @param {boolean} props.isOpen - 모달이 열려있는지 여부.
 * @param {function} props.onClose - 모달을 닫는 함수.
 * @param {function} [props.onConfirm] - '확인' 버튼 클릭 시 실행될 콜백 함수 (선택 사항).
 * @param {string} props.title - 모달의 제목.
 * @param {string} props.message - 모달에 표시될 주 메시지.
 * @param {string} [props.type='info'] - 모달의 유형 ('info', 'success', 'warning', 'error'). 아이콘과 색상에 영향을 줌.
 * @param {boolean} [props.showCancel=false] - 취소 버튼을 표시할지 여부.
 * @param {string} [props.confirmText='확인'] - 확인 버튼의 텍스트.
 * @param {string} [props.cancelText='취소'] - 취소 버튼의 텍스트.
 * @returns {JSX.Element|null} isOpen이 true일 때만 모달을 렌더링.
 */
const CustomAlertModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'info', // 'info', 'success', 'warning', 'error'
  showCancel = false,
  confirmText = '확인',
  cancelText = '취소'
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-500" />;
      default:
        return <Info className="w-6 h-6 text-blue-500" />;
    }
  };

  const getColors = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          button: 'bg-green-600 hover:bg-green-700 text-white'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          button: 'bg-yellow-600 hover:bg-yellow-700 text-white'
        };
      case 'error':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          button: 'bg-red-600 hover:bg-red-700 text-white'
        };
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          button: 'bg-blue-600 hover:bg-blue-700 text-white'
        };
    }
  };

  const colors = getColors();

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    // onConfirm 실행 여부와 관계없이 항상 모달 닫기
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
      onClick={handleOverlayClick}
    >
      <div className={`bg-white rounded-lg shadow-xl max-w-md w-full mx-4 ${colors.border} border-2 ${colors.bg}`}>
        <div className="p-6">
          <div className="flex items-start space-x-3">
            {getIcon()}
            <div className="flex-1">
              {title && <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>}
              <p className="text-gray-700">{message}</p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 px-6 pb-6">
          {showCancel && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 rounded-lg transition-colors ${colors.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomAlertModal;