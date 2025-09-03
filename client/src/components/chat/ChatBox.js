import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, X } from 'lucide-react';

const ChatBox = ({ onSendMessage, speak }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: inputText,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const originalMessage = inputText;
    setInputText('');

    // 로딩 메시지 표시
    const loadingMessage = {
      id: Date.now() + 1,
      text: '일정을 처리하고 있습니다...',
      sender: 'bot',
      timestamp: new Date(),
      isLoading: true
    };
    
    setMessages(prev => [...prev, loadingMessage]);

    try {
      const result = await onSendMessage(originalMessage);
      
      // 로딩 메시지 제거하고 실제 응답 추가
      setMessages(prev => prev.filter(msg => !msg.isLoading));
      
      const botMessage = {
        id: Date.now() + 2,
        text: result.message,
        sender: 'bot',
        timestamp: new Date(),
        success: result.success
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
      {/* 채팅 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 right-4 w-14 h-14 rounded-full shadow-lg transition-all duration-300 z-50 flex items-center justify-center ${
          isOpen ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
        } text-white`}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* 채팅창 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-30 z-40" 
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="fixed bottom-20 right-2 w-11/12 max-w-lg sm:right-4 sm:w-96 h-[500px] bg-white rounded-lg shadow-xl border z-50 flex flex-col" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="bg-blue-500 text-white p-3 rounded-t-lg">
              <h3 className="font-semibold">AI 일정 도우미</h3>
              <p className="text-xs opacity-90">일정 추가, 수정, 삭제를 도와드립니다</p>
            </div>

            {/* 메시지 영역 */}
            <div className="overflow-y-auto p-3 space-y-3" style={{ height: '350px', flexShrink: 0 }}>
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
            <div className="p-3 border-t" style={{ flexShrink: 0 }}>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="일정을 말씀해주세요..."
                  className="flex-1 p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim()}
                  className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <Send size={18} />
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