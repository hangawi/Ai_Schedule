/**
 * ===================================================================================================
 * MemberStatsModal.js - 특정 멤버의 통계 및 이월시간 내역을 보여주는 모달
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/MemberStatsModal.js
 *
 * 🎯 주요 기능:
 *    - 조율방 내 특정 멤버의 통계 정보를 시각적으로 표시.
 *    - 주요 통계: 현재 이월 시간, 총 완료 시간.
 *    - 이월 시간의 변경 내역(히스토리)을 시간순으로 정렬하여 보여줌.
 *    - 방장(`isOwner`)인 경우, 특정 멤버의 이월시간 내역을 모두 삭제하고 0으로 초기화하는 기능 제공.
 *
 * 🔗 연결된 파일:
 *    - ./CoordinationTab.js (추정) - 멤버 목록에서 통계 아이콘 클릭 시 이 모달을 호출.
 *    - ../../services/coordinationService.js - 이월시간 내역을 삭제하는 API를 호출.
 *
 * 💡 UI 위치:
 *    - '일정 맞추기' 탭의 멤버 목록에서 특정 멤버의 통계 아이콘을 클릭했을 때 나타나는 팝업 모달.
 *
 * ✏️ 수정 가이드:
 *    - 표시되는 통계 항목을 추가하려면 JSX 내 '현재 상태' 또는 '요약 통계' 섹션을 수정합니다.
 *    - 이월시간 내역을 표시하는 방식을 변경하려면 '이월시간 히스토리' 섹션의 `map` 부분을 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 모달은 `currentRoom` prop을 받아, `member` prop으로 받은 데이터보다 최신 정보가 있으면 `currentRoom`의 데이터를 우선적으로 사용합니다.
 *      이는 부모 컴포넌트의 상태가 업데이트되었을 때 모달에 즉시 반영하기 위함입니다.
 *    - '내역 삭제'는 민감한 작업이므로 `window.confirm`을 통해 사용자에게 재확인 절차를 거칩니다.
 *
 * ===================================================================================================
 */
import React, { useState } from 'react';
import { X, Clock, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { coordinationService } from '../../services/coordinationService';
import { useToast } from '../../contexts/ToastContext';
import CustomAlertModal from './CustomAlertModal';

/**
 * MemberStatsModal
 * @description 특정 멤버의 통계, 특히 이월 시간과 관련된 상세 내역을 보여주는 모달 컴포넌트.
 * @param {object} props - 컴포넌트 props
 * @param {boolean} props.isOpen - 모달의 열림 상태.
 * @param {function} props.onClose - 모달을 닫는 함수.
 * @param {object} props.member - 통계를 표시할 멤버의 데이터 객체.
 * @param {boolean} props.isOwner - 현재 사용자가 방장인지 여부 (내역 삭제 버튼 표시용).
 * @param {object} props.currentRoom - 최신 데이터를 동기화하기 위한 현재 방의 전체 데이터 객체.
 * @param {function} props.onRefresh - 데이터 변경 후 부모 컴포넌트의 데이터 새로고침을 유도하는 콜백.
 * @returns {JSX.Element|null} isOpen이 false이거나 member 객체가 없으면 null을 반환.
 */
const MemberStatsModal = ({ isOpen, onClose, member, isOwner, currentRoom, onRefresh }) => {
  const { showToast } = useToast();
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  if (!isOpen || !member) return null;

  const handleClearCarryOverHistory = async () => {
    setConfirmModal({
      isOpen: true,
      title: '이월시간 초기화',
      message: '정말로 이 멤버의 이월시간 내역을 모두 삭제하고, 이월시간을 0으로 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
      onConfirm: async () => {
        try {
          const memberId = latestMember.user?._id || latestMember.user;
          await coordinationService.clearCarryOverHistory(currentRoom._id, memberId);
          showToast('이월시간 내역이 성공적으로 삭제되었습니다.');
          if (onRefresh) {
            onRefresh();
          }
          onClose(); // Close modal on success
        } catch (error) {
          showToast(`오류가 발생했습니다: ${error.message}`);
        }
      }
    });
  };

  // 💡 currentRoom이 있으면 최신 멤버 데이터를 가져옴 (이월시간 업데이트 반영)
  let latestMember = member;
  if (currentRoom && currentRoom.members) {
    const memberUserId = (member.user?._id || member.user?.id || member.user);

    const foundMember = currentRoom.members.find(m => {
      const mUserId = (m.user?._id || m.user?.id || m.user);
      return mUserId?.toString() === memberUserId?.toString();
    });

    if (foundMember) {
      latestMember = foundMember;
    } else {
    }
  } else {
  }

  const memberData = latestMember.user || latestMember;
  const memberName = `${memberData?.firstName || ''} ${memberData?.lastName || ''}`.trim() || '멤버';

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-auto max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <div
                className="w-6 h-6 rounded-full mr-3"
                style={{ backgroundColor: latestMember.color || '#6B7280' }}
              ></div>
              {memberName} 통계
            </h3>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* 현재 상태 */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <Clock size={16} className="mr-2" />
                현재 상태
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${
                    latestMember.carryOver > 0 ? 'text-yellow-600' : 'text-gray-400'
                  }`}>
                    {latestMember.carryOver || 0}
                  </div>
                  <div className="text-xs text-gray-500">이월 시간</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {latestMember.totalProgressTime || 0}
                  </div>
                  <div className="text-xs text-gray-500">완료 시간</div>
                </div>
              </div>
            </div>

            {/* 이월시간 히스토리 */}
            {latestMember.carryOverHistory && latestMember.carryOverHistory.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-medium text-gray-700 flex items-center">
                    <Calendar size={16} className="mr-2" />
                    이월시간 히스토리
                  </h4>
                  {isOwner && (
                    <button 
                      onClick={handleClearCarryOverHistory}
                      className="text-xs bg-red-100 text-red-700 hover:bg-red-200 px-2 py-1 rounded"
                    >
                      내역 삭제
                    </button>
                  )}
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {latestMember.carryOverHistory
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .map((history, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-white rounded border">
                      <div className="flex items-center">
                        {history.amount > 0 ? (
                          <TrendingUp size={14} className="mr-2 text-yellow-500" />
                        ) : (
                          <TrendingDown size={14} className="mr-2 text-green-500" />
                        )}
                        <div>
                          <div className={`text-sm font-medium ${history.amount > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {history.amount > 0 ? `+${history.amount}` : history.amount}시간
                          </div>
                          <div className="text-xs text-gray-500">
                            {history.reason || '이월 조정'}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(history.timestamp).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 요약 통계 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">요약</h4>
              <div className="text-sm text-blue-700">
                <div>• 총 참여 기간: {new Date().toLocaleDateString('ko-KR')} ~ 현재</div>
                <div>• 총 완료 시간: {latestMember.totalProgressTime || 0}시간</div>
                <div>• 현재 이월 시간: {latestMember.carryOver || 0}시간</div>
                {latestMember.carryOverHistory && (
                  <div>• 이월 발생 횟수: {latestMember.carryOverHistory.length}회</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300"
          >
            닫기
          </button>
        </div>
      </div>

      <CustomAlertModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type="warning"
        showCancel={true}
        confirmText="확인"
        cancelText="취소"
      />
    </div>
  );
};

export default MemberStatsModal;