import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, Image, X } from 'lucide-react';

const ChatBox = ({ onSendMessage, speak, currentTab }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const messagesEndRef = useRef(null);
  const imageInputRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => {
      // 강력한 모바일 감지: 데스크톱을 확실히 제외하는 방식
      const userAgent = navigator.userAgent;
      const isDesktop = /Windows NT|Macintosh|X11.*Linux/i.test(userAgent) && 
                        !/Mobile|Tablet/i.test(userAgent);
      
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
      
      const mobile = !isDesktop && (isMobileUA || window.innerWidth <= 768);
      setIsMobile(mobile);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleAddSchedules = async (schedules) => {
    try {
      // 로딩 메시지 추가
      const loadingMessage = {
        id: Date.now(),
        text: '일정을 추가하고 있습니다...',
        sender: 'bot',
        timestamp: new Date(),
        isLoading: true
      };
      setMessages(prev => [...prev, loadingMessage]);

      // 각 스케줄을 개별적으로 추가
      const results = [];
      for (const schedule of schedules) {
        try {
          const result = await onSendMessage(`"${schedule.title}" 일정을 ${schedule.date} ${schedule.time}에 추가해줘${schedule.location ? ` 장소: ${schedule.location}` : ''}`);
          results.push({
            schedule,
            success: result.success,
            message: result.message
          });
        } catch (error) {
          results.push({
            schedule,
            success: false,
            message: '일정 추가 중 오류가 발생했습니다.'
          });
        }
      }

      // 로딩 메시지 제거
      setMessages(prev => prev.filter(msg => !msg.isLoading));

      // 결과 메시지 생성
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;

      const resultMessage = {
        id: Date.now() + 1,
        text: `총 ${totalCount}개 일정 중 ${successCount}개를 성공적으로 추가했습니다.`,
        sender: 'bot',
        timestamp: new Date(),
        success: successCount === totalCount
      };

      setMessages(prev => [...prev, resultMessage]);

    } catch (error) {
      // 로딩 메시지 제거
      setMessages(prev => prev.filter(msg => !msg.isLoading));

      const errorMessage = {
        id: Date.now() + 1,
        text: '일정 추가 중 오류가 발생했습니다.',
        sender: 'bot',
        timestamp: new Date(),
        success: false
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() && !selectedImage) return;

    const userMessage = {
      id: Date.now(),
      text: selectedImage ? (inputText.trim() || '사진에서 일정을 추출해주세요') : inputText,
      sender: 'user',
      timestamp: new Date(),
      image: imagePreview
    };

    setMessages(prev => [...prev, userMessage]);
    const originalMessage = inputText;
    const originalImage = selectedImage;

    setInputText('');
    removeImage();

    // 로딩 메시지 표시
    const loadingMessage = {
      id: Date.now() + 1,
      text: originalImage ? '사진에서 일정을 분석하고 있습니다...' : '일정을 처리하고 있습니다...',
      sender: 'bot',
      timestamp: new Date(),
      isLoading: true
    };

    setMessages(prev => [...prev, loadingMessage]);

    try {
      let result;
      if (originalImage) {
        // 이미지가 있는 경우 이미지 분석 API 호출
        const formData = new FormData();
        formData.append('image', originalImage);
        if (originalMessage.trim()) {
          formData.append('message', originalMessage);
        }

        const token = localStorage.getItem('token');
        const response = await fetch('/api/calendar/analyze-image', {
          method: 'POST',
          headers: {
            'x-auth-token': token
          },
          body: formData
        });

        result = await response.json();
      } else {
        // 텍스트만 있는 경우 기존 API 호출
        result = await onSendMessage(originalMessage);
      }

      // 로딩 메시지 제거하고 실제 응답 추가
      setMessages(prev => prev.filter(msg => !msg.isLoading));

      const botMessage = {
        id: Date.now() + 2,
        text: result.message,
        sender: 'bot',
        timestamp: new Date(),
        success: result.success,
        extractedSchedules: result.extractedSchedules // 추출된 스케줄 정보
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      setMessages(prev => prev.filter(msg => !msg.isLoading));

      const errorMessage = {
        id: Date.now() + 2,
        text: '죄송합니다. 오류가 발생했습니다.',
        sender: 'bot',
        timestamp: new Date(),
        success: false
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* 채팅 버튼 - 모바일에서는 상태창과 겹치지 않게 배치 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 right-4 w-14 h-14 rounded-full shadow-lg transition-all duration-300 z-50 flex items-center justify-center ${
          isOpen ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
        } text-white`}
      >
{isOpen ? (
          <span className="font-bold text-lg">AI</span>
        ) : (
          <MessageCircle size={24} />
        )}
      </button>

      {/* 채팅창 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-30 z-40" 
          onClick={() => setIsOpen(false)}
        >
          <div 
            className={`fixed ${isMobile ? 'bottom-20 right-2 left-2' : 'bottom-20 right-4 w-96'} ${isMobile ? 'max-h-[60vh] h-[400px]' : 'h-[500px]'} bg-white rounded-lg shadow-xl border z-50 flex flex-col`}
            onClick={(e) => e.stopPropagation()}
            style={isMobile ? {
              maxHeight: Math.min(400, window.innerHeight * 0.6),
              minHeight: '300px'
            } : {}}
          >
            {/* 헤더 */}
            <div className="bg-blue-500 text-white p-3 rounded-t-lg">
              <h3 className="font-semibold">AI 일정 도우미</h3>
              <p className="text-xs opacity-90">
                {currentTab === 'profile' && '내 프로필 일정 관리'}
                {currentTab === 'events' && '나의 일정 관리'}
                {currentTab === 'googleCalendar' && 'Google 캘린더 관리'}
                {!['profile', 'events', 'googleCalendar'].includes(currentTab) && '일정 추가, 수정, 삭제를 도와드립니다'}
              </p>
            </div>

            {/* 메시지 영역 */}
            <div 
              className="overflow-y-auto p-3 space-y-3 flex-1"
              style={{ 
                minHeight: isMobile ? '200px' : '350px',
                maxHeight: isMobile ? 'calc(60vh - 140px)' : '350px'
              }}
            >
              {messages.length === 0 && (
                <div className="text-center text-gray-500 text-sm mt-4">
                  <p className="font-semibold">안녕하세요! 일정 관리를 도와드리겠습니다.</p>
                  <div className="mt-3 text-xs space-y-1">
                    <p><span className="font-medium text-blue-600">추가:</span> "내일 오후 3시 회의 추가해줘"</p>
                    <p><span className="font-medium text-red-600">삭제:</span> "내일 회의 일정 삭제해줘"</p>
                    <p><span className="font-medium text-green-600">수정:</span> "회의 시간을 4시로 수정해줘"</p>
                  </div>
                </div>
              )}
              
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-sm p-3 rounded-lg text-sm ${
                      message.sender === 'user'
                        ? 'bg-blue-500 text-white rounded-br-none'
                        : message.isLoading
                        ? 'bg-yellow-100 text-yellow-800 rounded-bl-none'
                        : message.success === false
                        ? 'bg-red-100 text-red-800 rounded-bl-none'
                        : message.success === true
                        ? 'bg-green-100 text-green-800 rounded-bl-none'
                        : 'bg-gray-100 text-gray-800 rounded-bl-none'
                    }`}
                  >
                    {/* 이미지 미리보기 (사용자 메시지만) */}
                    {message.image && (
                      <div className="mb-2">
                        <img
                          src={message.image}
                          alt="업로드된 이미지"
                          className="max-w-full h-auto rounded border"
                          style={{ maxHeight: '150px' }}
                        />
                      </div>
                    )}

                    <p className="flex items-center">
                      {message.isLoading && (
                        <span className="animate-spin mr-2">⏳</span>
                      )}
                      {message.success === true && (
                        <span className="mr-2">✅</span>
                      )}
                      {message.success === false && (
                        <span className="mr-2">❌</span>
                      )}
                      {message.text}
                    </p>

                    {/* 추출된 스케줄 정보 표시 */}
                    {message.extractedSchedules && message.extractedSchedules.length > 0 && (
                      <div className="mt-3 p-2 bg-white bg-opacity-20 rounded border">
                        <p className="text-xs font-semibold mb-2">추출된 일정:</p>
                        {message.extractedSchedules.map((schedule, index) => (
                          <div key={index} className="text-xs mb-1 p-1 bg-white bg-opacity-30 rounded">
                            <div><strong>제목:</strong> {schedule.title}</div>
                            <div><strong>날짜:</strong> {schedule.date}</div>
                            <div><strong>시간:</strong> {schedule.time}</div>
                            {schedule.location && <div><strong>장소:</strong> {schedule.location}</div>}
                          </div>
                        ))}
                        <button
                          className="mt-2 px-2 py-1 bg-white bg-opacity-40 hover:bg-opacity-60 rounded text-xs"
                          onClick={() => handleAddSchedules(message.extractedSchedules)}
                        >
                          이 일정들을 추가하시겠습니까?
                        </button>
                      </div>
                    )}

                    <p className={`text-xs mt-1 ${
                      message.sender === 'user'
                        ? 'text-blue-100'
                        : message.success === false
                        ? 'text-red-600'
                        : message.success === true
                        ? 'text-green-600'
                        : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* 입력 영역 */}
            <div className="p-3 border-t bg-white rounded-b-lg flex-shrink-0">
              {/* 이미지 미리보기 */}
              {imagePreview && (
                <div className="mb-3 relative">
                  <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded border">
                    <img
                      src={imagePreview}
                      alt="미리보기"
                      className="w-16 h-16 object-cover rounded border"
                    />
                    <div className="flex-1 text-sm text-gray-600">
                      사진이 선택되었습니다
                    </div>
                    <button
                      onClick={removeImage}
                      className="p-1 text-red-500 hover:text-red-700"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}

              <div className={`flex ${isMobile ? 'space-x-2' : 'space-x-2'}`}>
                {/* 이미지 업로드 버튼 */}
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className={`${isMobile ? 'p-2 w-12 h-12' : 'p-3'} bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center justify-center flex-shrink-0`}
                  title="이미지 업로드"
                >
                  <Image size={isMobile ? 20 : 18} />
                </button>

                {/* 숨겨진 파일 입력 */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={selectedImage ? "이미지에 대한 추가 설명 (선택사항)" : "일정을 말씀해주세요..."}
                  className={`flex-1 ${isMobile ? 'p-2 text-base' : 'p-3 text-sm'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim() && !selectedImage}
                  className={`${isMobile ? 'p-2 w-12 h-12' : 'p-3'} bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0`}
                >
                  <Send size={isMobile ? 20 : 18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatBox;