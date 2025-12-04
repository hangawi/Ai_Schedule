/**
 * ===================================================================================================
 * [ChatInput.js] - AI 채팅창의 하단 입력 영역 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > client/src/components/chat/components/ChatInput.js
 *
 * 🎯 주요 기능:
 *    - 사용자 텍스트 입력을 위한 input 필드 제공
 *    - 메시지 전송 버튼
 *    - 시간표 이미지 업로드 모달을 여는 버튼
 *
 * 🔗 연결된 파일:
 *    - ../ChatBox.js: 이 입력 컴포넌트를 사용하여 채팅창의 하단부를 구성하고, 모든 이벤트 핸들러(props)를 전달
 *
 * 💡 UI 위치:
 *    - AI 채팅창의 최하단 입력 영역
 *
 * ✏️ 수정 가이드:
 *    - 입력 필드의 placeholder 텍스트를 변경하려면: `placeholder` 속성의 삼항 연산자를 수정합니다.
 *    - 버튼 아이콘이나 스타일을 변경하려면: 각 `<button>` 요소의 className과 내부 아이콘 컴포넌트를 수정합니다.
 *
 * 📝 참고사항:
 *    - 입력된 텍스트나 선택된 이미지가 없을 경우 전송 버튼은 비활성화됩니다.
 *    - 모바일/데스크탑 환경에 따라 버튼과 아이콘 크기가 동적으로 조절됩니다.
 *
 * ===================================================================================================
 */
import React from 'react';
import { Send, Image } from 'lucide-react';

/**
 * ChatInput
 *
 * @description AI 채팅창의 하단 입력 UI(텍스트 필드, 시간표 업로드 버튼, 전송 버튼)를 렌더링합니다.
 * @param {object} props - 컴포넌트 props
 * @param {string} props.inputText - 현재 입력 필드의 텍스트 값
 * @param {function} props.setInputText - 입력 필드 텍스트를 변경하는 상태 설정 함수
 * @param {File|null} props.selectedImage - 현재 선택된 이미지 파일
 * @param {boolean} props.isMobile - 모바일 환경 여부
 * @param {function} props.onSend - '전송' 버튼 클릭 시 호출되는 함수
 * @param {function} props.onKeyPress - 입력 필드에서 키보드 입력 시 호출되는 함수
 * @param {function} props.onTimetableUploadClick - '시간표 업로드' 버튼 클릭 시 호출되는 함수
 * @returns {JSX.Element}
 */
const ChatInput = ({
  inputText,
  setInputText,
  selectedImage,
  isMobile,
  onSend,
  onKeyPress,
  onTimetableUploadClick
}) => {
  return (
    <div className="p-3 border-t bg-white rounded-b-lg flex-shrink-0">
      <div className={`flex ${isMobile ? 'space-x-2' : 'space-x-2'}`}>
        {/* 시간표 업로드 버튼 */}
        <button
          onClick={onTimetableUploadClick}
          className={`${isMobile ? 'p-2 w-12 h-12' : 'p-3'} bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center justify-center flex-shrink-0`}
          title="시간표 업로드"
        >
          <Image size={isMobile ? 20 : 18} />
        </button>

        {/* 입력 필드 */}
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder={selectedImage ? "이미지에 대한 추가 설명 (선택사항)" : "일정을 말씀해주세요..."}
          className={`flex-1 ${isMobile ? 'p-2 text-base' : 'p-3 text-sm'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
        />

        {/* 전송 버튼 */}
        <button
          onClick={onSend}
          disabled={!inputText.trim() && !selectedImage}
          className={`${isMobile ? 'p-2 w-12 h-12' : 'p-3'} bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0`}
        >
          <Send size={isMobile ? 20 : 18} />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;