import React from 'react';
import { X, Clock, Calendar, TrendingUp, TrendingDown } from 'lucide-react';

const MemberStatsModal = ({ isOpen, onClose, member, isOwner }) => {
  if (!isOpen || !member) return null;

  const memberData = member.user || member;
  const memberName = memberData?.name || `${memberData?.firstName || ''} ${memberData?.lastName || ''}`.trim() || '멤버';

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
                style={{ backgroundColor: member.color || '#6B7280' }}
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
                    member.carryOver > 0 ? 'text-yellow-600' : 'text-gray-400'
                  }`}>
                    {member.carryOver || 0}
                  </div>
                  <div className="text-xs text-gray-500">이월 시간</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {member.totalProgressTime || 0}
                  </div>
                  <div className="text-xs text-gray-500">완료 시간</div>
                </div>
              </div>
            </div>

            {/* 이월시간 히스토리 */}
            {member.carryOverHistory && member.carryOverHistory.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                  <Calendar size={16} className="mr-2" />
                  이월시간 히스토리
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {member.carryOverHistory
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .map((history, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-white rounded border">
                      <div className="flex items-center">
                        {history.reason === 'unassigned' ? (
                          <TrendingUp size={14} className="mr-2 text-yellow-500" />
                        ) : (
                          <TrendingDown size={14} className="mr-2 text-red-500" />
                        )}
                        <div>
                          <div className="text-sm font-medium">
                            +{history.amount}시간
                          </div>
                          <div className="text-xs text-gray-500">
                            {history.reason === 'unassigned' ? '시간 부족' : '협의 거절'}
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
                <div>• 총 완료 시간: {member.totalProgressTime || 0}시간</div>
                <div>• 현재 이월 시간: {member.carryOver || 0}시간</div>
                {member.carryOverHistory && (
                  <div>• 이월 발생 횟수: {member.carryOverHistory.length}회</div>
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
    </div>
  );
};

export default MemberStatsModal;