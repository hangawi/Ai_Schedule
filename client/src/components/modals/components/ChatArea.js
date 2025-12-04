/**
 * ===================================================================================================
 * ChatArea.js - 최적화 모달의 우측, 채팅 및 범례(Legend) 영역 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/components/ChatArea.js
 *
 * 🎯 주요 기능:
 *    - **인터랙티브 범례**: 이미지별로 추출된 시간표를 범례로 표시. 마우스를 올리면 왼쪽 그리드에 해당 시간표가 하이라이트되고, 클릭하면 원본 시간표 모달이 열림.
 *    - **채팅 메시지 표시**: 사용자와 AI 간의 대화 내용을 `ChatMessage` 컴포넌트를 통해 렌더링.
 *    - **초기 안내**: 채팅 내역이 없을 경우, 사용자에게 사용 가능한 명령어 예시(삭제, 수정, 추가)를 안내.
 *    - **채팅 입력**: 사용자가 자연어 명령을 입력하고 전송할 수 있는 폼 제공.
 *    - **AI 처리 중 상태 표시**: AI가 응답을 생성하는 동안 입력창을 비활성화하고 "AI가 생각 중..." 메시지를 표시.
 *
 * 🔗 연결된 파일:
 *    - ../ScheduleOptimizationModal.js - 이 컴포넌트를 사용하며 모든 상태와 핸들러를 props로 전달.
 *    - ./ChatMessage.js - 개별 채팅 메시지를 렌더링하는 하위 컴포넌트.
 *    - ../../../utils/scheduleAnalysis/assignScheduleColors.js - 범례의 색상을 결정하는 유틸리티.
 *
 * 💡 UI 위치:
 *    - '최적 시간표 제안' 모달의 오른편에 위치한 전체 채팅 패널.
 *
 * ✏️ 수정 가이드:
 *    - 채팅 메시지가 표시되는 UI를 변경하려면 `ChatMessage.js` 컴포넌트를 수정합니다.
 *    - 초기 명령어 안내 문구를 변경하려면 이 파일의 JSX 내 '채팅 메시지 영역' 부분을 수정합니다.
 *    - 채팅 입력창의 디자인을 변경하려면 JSX 내 '채팅 입력 영역'을 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 상태를 직접 관리하지 않으며, 모든 로직은 `ScheduleOptimizationModal`로부터 props를 통해 주입받는
 *      전형적인 프레젠테이셔널(Presentational) 컴포넌트입니다.
 *    - `isEmbedded` prop이 true일 경우 렌더링되지 않습니다.
 *
 * ===================================================================================================
 */

import React from 'react';
import { Send } from 'lucide-react';
import { getColorForImageIndex } from '../../../utils/scheduleAnalysis/assignScheduleColors';
import ChatMessage from './ChatMessage';

/**
 * ChatArea
 * @description ScheduleOptimizationModal의 우측 패널 전체를 담당하는 컴포넌트.
 *              시간표 출처 범례, 채팅 내역, 채팅 입력창을 포함합니다.
 * @param {object} props - 컴포넌트에 전달되는 모든 props
 * @returns {JSX.Element|null}
 */
const ChatArea = ({
  isEmbedded,
  schedulesByImage,
  customSchedulesForLegend,
  hoveredImageIndex,
  setHoveredImageIndex,
  setSelectedImageForOriginal,
  chatMessages,
  chatContainerRef,
  chatEndRef,
  conflictState,
  handleConflictResolution,
  handleOptionSelection,
  chatInput,
  setChatInput,
  aiOptimizationState,
  handleChatSubmit
}) => {
  if (isEmbedded) return null;

  return (
    <div className="flex flex-col border-l border-gray-200" style={{
      width: '40%',
      maxWidth: '420px',
      background: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* 채팅 헤더 */}
      <div className="px-4 py-3 bg-white border-b border-gray-200">
        <h3 className="text-sm font-bold text-gray-800 mb-2">📚 업로드된 시간표</h3>

        {/* 이미지별 범례 */}
        <div className="flex flex-wrap gap-2">
          {schedulesByImage?.map((imageData, idx) => {
            const color = getColorForImageIndex(idx);
            const isHovered = hoveredImageIndex === idx;

            return (
              <button
                key={`img-${idx}`}
                onClick={() => setSelectedImageForOriginal(imageData)}
                onMouseEnter={() => setHoveredImageIndex(idx)}
                onMouseLeave={() => setHoveredImageIndex(null)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isHovered ? 'shadow-md scale-105' : 'shadow-sm'
                }`}
                style={{
                  backgroundColor: isHovered ? color.bg : '#ffffff',
                  border: `2px solid ${color.border}`,
                  color: color.text
                }}
              >
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: color.border }}
                />
                <span>{imageData.academyName || `이미지 ${idx + 1}`}</span>
              </button>
            );
          })}

          {/* 커스텀 일정 범례 */}
          {customSchedulesForLegend.map((customData) => {
            const color = getColorForImageIndex(customData.sourceImageIndex);
            const isHovered = hoveredImageIndex === customData.sourceImageIndex;

            return (
              <button
                key={`custom-${customData.sourceImageIndex}`}
                onClick={() => setSelectedImageForOriginal(customData)}
                onMouseEnter={() => setHoveredImageIndex(customData.sourceImageIndex)}
                onMouseLeave={() => setHoveredImageIndex(null)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isHovered ? 'shadow-md scale-105' : 'shadow-sm'
                }`}
                style={{
                  backgroundColor: isHovered ? color.bg : '#ffffff',
                  border: `2px solid ${color.border}`,
                  color: color.text
                }}
              >
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: color.border }}
                />
                <span>{customData.title} 📌</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 채팅 메시지 영역 */}
      <div
        ref={chatContainerRef}
        className="p-4 space-y-3"
        style={{
          background: '#f8fafc',
          flex: '1 1 0',
          overflowY: 'auto',
          overflowX: 'hidden',
          minHeight: 0
        }}
      >
        {chatMessages.length === 0 && (
          <div className="text-center mt-8">
            <div className="inline-block bg-white rounded-2xl shadow-lg p-5 border border-purple-100">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <Send size={20} className="text-white" />
              </div>
              <p className="font-bold text-gray-700 mb-3 text-sm">💬 사용 가능한 명령</p>
              <div className="text-left space-y-2.5 text-xs">
                <div className="flex items-start space-x-2 p-2.5 bg-red-50 rounded-lg border-l-3 border-red-400">
                  <span className="font-bold text-red-600 text-lg leading-none">×</span>
                  <div>
                    <p className="font-semibold text-red-700">삭제</p>
                    <p className="text-gray-600 mt-0.5">"토요일 11:00 삭제"</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2 p-2.5 bg-blue-50 rounded-lg border-l-3 border-blue-400">
                  <span className="font-bold text-blue-600 text-lg leading-none">✎</span>
                  <div>
                    <p className="font-semibold text-blue-700">수정</p>
                    <p className="text-gray-600 mt-0.5">"월요일 14:40을 16:00으로 수정"</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2 p-2.5 bg-green-50 rounded-lg border-l-3 border-green-400">
                  <span className="font-bold text-green-600 text-lg leading-none">+</span>
                  <div>
                    <p className="font-semibold text-green-700">추가</p>
                    <p className="text-gray-600 mt-0.5">"토요일 오후 3시 초등부 추가"</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {chatMessages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            conflictState={conflictState}
            handleConflictResolution={handleConflictResolution}
            handleOptionSelection={handleOptionSelection}
          />
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* 채팅 입력 영역 */}
      <div className="p-3 bg-white border-t border-gray-200" style={{ flexShrink: 0 }}>
        <form onSubmit={handleChatSubmit} className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={aiOptimizationState.isProcessing ? "AI가 생각 중..." : "예: 월요일 영어 삭제"}
            className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all placeholder-gray-400"
            disabled={aiOptimizationState.isProcessing}
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || aiOptimizationState.isProcessing}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatArea;
