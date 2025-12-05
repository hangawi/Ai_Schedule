/**
 * ===================================================================================================
 * AiSchedulingResults.js - AI 스케줄링 결과 표시 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/coordination
 *
 * 🎯 주요 기능:
 *    - AI 스케줄링 API의 응답 결과를 시각적으로 표시
 *    - 성공 시: 모든 참여자가 가능한 공통 시간대 목록을 보여주고 선택 기능 제공
 *    - 실패 시: 공통 시간대를 찾지 못했음을 알리고, AI가 제안하는 대안(빈 시간대 추천, 양보 요청 등)을 제시
 *    - 사용자가 시간대를 선택하거나 양보를 요청하는 등의 상호작용 처리
 *
 * 🔗 연결된 파일:
 *    - 이 컴포넌트를 사용하는 상위 페이지 또는 컴포넌트 (예: 일정 조율 탭)
 *    - lucide-react: 아이콘 라이브러리
 *
 * 💡 UI 위치:
 *    - 일정 조율 탭 > 'AI 자동 제안' 실행 후 결과가 표시되는 영역
 *
 * ✏️ 수정 가이드:
 *    - 성공/실패 시 UI 레이아웃 변경: 각 조건부 렌더링 블록 내부의 JSX 구조 수정
 *    - 날짜/시간 형식 변경: `formatDateTime`, `formatDuration` 함수 수정
 *    - 대안 제안 카드 디자인 변경: '실패한 경우' 블록 내부의 각 대안 카드 스타일 수정
 *    - 새로운 대안 타입 추가: `if (!results.success && results.alternatives)` 블록 내에 새로운 대안을 렌더링하는 로직 추가
 *
 * 📝 참고사항:
 *    - `results` prop의 구조에 따라 동적으로 다른 UI를 렌더링합니다. (`results.success` 값 기준)
 *    - `useCallback`을 사용하여 부모로부터 전달받은 콜백 함수들을 메모이제이션합니다.
 *    - 각 카드(성공, 빈 시간 추천, 양보 요청 등)는 시각적 구분을 위해 다른 색상 테마(green, blue, yellow)를 사용합니다.
 *
 * ===================================================================================================
 */

import React, { useCallback } from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  Users, 
  MessageSquare,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

/**
 * AiSchedulingResults
 *
 * @description AI 스케줄링 API의 결과를 받아 성공 또는 실패 시나리오에 맞는 UI를 렌더링하는 컴포넌트입니다.
 * @param {Object} props - 컴포넌트 프롭스
 * @param {Object | null} props.results - AI 스케줄링 API의 응답 결과 객체
 * @param {boolean} props.results.success - 성공 여부
 * @param {Array<Object>} [props.results.commonSlots] - 성공 시 공통 시간대 목록
 * @param {Object} [props.results.alternatives] - 실패 시 대안 목록
 * @param {Function} props.onSelectTimeSlot - 사용자가 시간대를 선택했을 때 호출될 콜백 함수
 * @param {Function} props.onRequestConcession - 사용자가 양보를 요청했을 때 호출될 콜백 함수
 * @param {Function} props.onRetry - '다시 검색' 버튼 클릭 시 호출될 콜백 함수
 * @returns {JSX.Element | null} AI 스케줄링 결과 UI 또는 null
 *
 * @example
 * // 성공 시
 * <AiSchedulingResults results={successData} onSelectTimeSlot={handleSelect} />
 *
 * // 실패 시
 * <AiSchedulingResults
 *   results={failureData}
 *   onSelectTimeSlot={handleSelect}
 *   onRequestConcession={handleConcession}
 *   onRetry={handleRetry}
 * />
 */
const AiSchedulingResults = ({ results, onSelectTimeSlot, onRequestConcession, onRetry }) => {

  const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    return {
      date: date.toLocaleDateString('ko-KR', {
        month: 'long',
        day: 'numeric',
        weekday: 'short'
      }),
      time: date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    };
  };

  const formatDuration = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours === 0) {
      return `${diffMins}분`;
    } else if (diffMins === 0) {
      return `${diffHours}시간`;
    } else {
      return `${diffHours}시간 ${diffMins}분`;
    }
  };

  const handleSelectSlot = useCallback((slot) => {
    if (onSelectTimeSlot) {
      onSelectTimeSlot(slot);
    }
  }, [onSelectTimeSlot]);

  const handleConcessionRequest = useCallback((alternative) => {
    if (onRequestConcession) {
      onRequestConcession(alternative);
    }
  }, [onRequestConcession]);

  if (!results) {
    return null;
  }

  // 성공한 경우 (공통 시간대가 있는 경우)
  if (results.success && results.commonSlots && results.commonSlots.length > 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-green-200">
        <div className="flex items-center mb-4">
          <CheckCircle className="text-green-500 mr-2" size={24} />
          <h3 className="text-lg font-semibold text-green-700">
            🎉 모든 참여자가 가능한 시간대를 찾았습니다!
          </h3>
        </div>
        
        <div className="space-y-3">
          {results.commonSlots.map((slot, index) => {
            const { date, time } = formatDateTime(slot.startTime);
            const duration = formatDuration(slot.startTime, slot.endTime);
            
            return (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition-colors"
              >
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-8 h-8 bg-green-500 text-white rounded-full text-sm font-semibold mr-3">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      📅 {date}
                    </div>
                    <div className="text-sm text-gray-600">
                      ⏰ {time} ({duration})
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleSelectSlot(slot)}
                  className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  이 시간 선택
                  <ArrowRight size={16} className="ml-1" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 실패한 경우 (공통 시간대가 없는 경우)
  if (!results.success && results.alternatives) {
    const { alternatives } = results;
    
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-orange-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <AlertTriangle className="text-orange-500 mr-2" size={24} />
            <h3 className="text-lg font-semibold text-orange-700">
              😅 모든 참여자가 가능한 시간대를 찾을 수 없습니다
            </h3>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw size={14} className="mr-1" />
              다시 검색
            </button>
          )}
        </div>
        
        <p className="text-gray-600 mb-6">
          하지만 걱정하지 마세요! AI가 3가지 대안을 제안해드릴게요.
        </p>
        
        <div className="space-y-4">
          {/* 빈 시간대 추천 */}
          {alternatives.recommendation && (
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
              <div className="flex items-start">
                <div className="flex items-center justify-center w-10 h-10 bg-blue-500 text-white rounded-full text-sm font-semibold mr-3 flex-shrink-0">
                  1
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-700 mb-2">
                    💡 {alternatives.recommendation.title}
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    {alternatives.recommendation.description}
                  </p>
                  
                  {alternatives.recommendation.details && (
                    <div className="bg-white rounded-lg p-3 border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">
                            📅 {formatDateTime(alternatives.recommendation.details.startTime).date}
                          </div>
                          <div className="text-sm text-gray-600">
                            ⏰ {formatDateTime(alternatives.recommendation.details.startTime).time} 
                            ({formatDuration(
                              alternatives.recommendation.details.startTime, 
                              alternatives.recommendation.details.endTime
                            )})
                          </div>
                          {alternatives.recommendation.details.absentMembers && (
                            <div className="text-xs text-orange-600 mt-1">
                              불참: {alternatives.recommendation.details.absentMembers.map(m => m.name).join(', ')}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleSelectSlot(alternatives.recommendation.details)}
                          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          선택
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 양보 요청 */}
          {alternatives.concession && (
            <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
              <div className="flex items-start">
                <div className="flex items-center justify-center w-10 h-10 bg-yellow-500 text-white rounded-full text-sm font-semibold mr-3 flex-shrink-0">
                  2
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-yellow-700 mb-2">
                    🤝 {alternatives.concession.title}
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    {alternatives.concession.description}
                  </p>
                  
                  {alternatives.concession.details && (
                    <div className="bg-white rounded-lg p-3 border border-yellow-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">
                            📅 {formatDateTime(alternatives.concession.details.startTime).date}
                          </div>
                          <div className="text-sm text-gray-600">
                            ⏰ {formatDateTime(alternatives.concession.details.startTime).time}
                            ({formatDuration(
                              alternatives.concession.details.startTime, 
                              alternatives.concession.details.endTime
                            )})
                          </div>
                          {alternatives.concession.details.conflictingMember && (
                            <div className="text-xs text-yellow-600 mt-1 flex items-center">
                              <Users size={12} className="mr-1" />
                              양보 요청 대상: {alternatives.concession.details.conflictingMember.name}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleConcessionRequest(alternatives.concession)}
                          className="flex items-center px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
                        >
                          <MessageSquare size={14} className="mr-1" />
                          양보 요청
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 보충 제안 */}
          {alternatives.supplement && (
            <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
              <div className="flex items-start">
                <div className="flex items-center justify-center w-10 h-10 bg-purple-500 text-white rounded-full text-sm font-semibold mr-3 flex-shrink-0">
                  3
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-purple-700 mb-2">
                    📅 {alternatives.supplement.title}
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    {alternatives.supplement.description}
                  </p>
                  
                  {alternatives.supplement.details && (
                    <div className="bg-white rounded-lg p-3 border border-purple-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">
                            📅 {formatDateTime(alternatives.supplement.details.startTime).date}
                          </div>
                          <div className="text-sm text-gray-600">
                            ⏰ {formatDateTime(alternatives.supplement.details.startTime).time}
                            ({formatDuration(
                              alternatives.supplement.details.startTime, 
                              alternatives.supplement.details.endTime
                            )})
                          </div>
                          <div className="text-xs text-purple-600 mt-1">
                            다음 주 추가 일정으로 제안
                          </div>
                        </div>
                        <button
                          onClick={() => handleSelectSlot(alternatives.supplement.details)}
                          className="px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
                        >
                          선택
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 text-center">
            💡 팁: 각 대안의 장단점을 고려해서 팀에게 가장 적합한 옵션을 선택해보세요.
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default AiSchedulingResults;