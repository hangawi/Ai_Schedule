import React from 'react';
import { CheckCircle, AlertCircle, X, Calendar, Users, Clock } from 'lucide-react';

/**
 * 배정 시간 확정 모달
 * @param {boolean} show - 모달 표시 여부
 * @param {function} onClose - 모달 닫기 함수
 * @param {function} onConfirm - 확정 실행 함수
 * @param {number} slotsCount - 확정할 슬롯 개수
 */
const ConfirmScheduleModal = ({ show, onClose, onConfirm, slotsCount }) => {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
          >
            <X size={24} />
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-white bg-opacity-20 p-3 rounded-full">
              <CheckCircle size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">배정 시간 확정</h2>
              <p className="text-green-100 text-sm mt-1">개인 일정으로 확정됩니다</p>
            </div>
          </div>
        </div>

        {/* 본문 */}
        <div className="p-6">
          {/* 확정 정보 */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Calendar className="text-green-600" size={24} />
              <span className="text-lg font-bold text-green-700">
                {slotsCount}개의 시간
              </span>
            </div>
            <div className="text-center text-sm text-gray-700">
              자동배정된 시간을 개인 일정으로 확정합니다
            </div>
          </div>

          {/* 안내 메시지 */}
          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3 text-sm text-gray-700">
              <Users className="text-blue-500 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <div className="font-medium mb-1">조원 및 방장의 개인시간에 추가</div>
                <div className="text-gray-600">프로필 탭 &gt; 개인시간 관리에서 확인 가능</div>
              </div>
            </div>

            <div className="flex items-start gap-3 text-sm text-gray-700">
              <Clock className="text-orange-500 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <div className="font-medium mb-1">해당 선호시간 자동 삭제</div>
                <div className="text-gray-600">확정된 시간대의 선호시간이 제거됩니다</div>
              </div>
            </div>

            <div className="flex items-start gap-3 text-sm text-gray-700">
              <AlertCircle className="text-purple-500 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <div className="font-medium mb-1">향후 자동배정에서 제외</div>
                <div className="text-gray-600">확정된 시간은 다음 배정에서 제외됩니다</div>
              </div>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-green-700 transition-all shadow-lg hover:shadow-xl"
            >
              확정하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmScheduleModal;
