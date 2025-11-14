import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const CoordinationChatBot = ({ roomId, currentUser, onExchangeRequest }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: '안녕하세요! 시간 변경을 원하시면 말씀해주세요.\n예: "수요일로 바꿔줘" 또는 "수요일 2시로 바꿔줘"',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call backend API to parse the message using Gemini
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/coordination/rooms/${roomId}/parse-exchange-request`,
        { message: input },
        {
          headers: {
            'x-auth-token': localStorage.getItem('token')
          }
        }
      );

      const { parsed, error } = response.data;

      if (error) {
        // Show error message
        setMessages(prev => [...prev, {
          id: Date.now(),
          type: 'bot',
          content: error,
          timestamp: new Date()
        }]);
      } else {
        // Show confirmation message
        const confirmMessage = `${parsed.targetDay}${parsed.targetTime ? ` ${parsed.targetTime}` : ''}로 변경 요청을 보낼까요?`;

        setMessages(prev => [...prev, {
          id: Date.now(),
          type: 'bot',
          content: confirmMessage,
          timestamp: new Date(),
          actions: [
            {
              label: '네, 요청하기',
              onClick: () => handleConfirmExchange(parsed)
            },
            {
              label: '취소',
              onClick: () => {
                setMessages(prev => [...prev, {
                  id: Date.now(),
                  type: 'bot',
                  content: '요청이 취소되었습니다.',
                  timestamp: new Date()
                }]);
              }
            }
          ]
        }]);
      }
    } catch (error) {
      console.error('Parse error:', error);
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'bot',
        content: '죄송합니다. 요청을 처리하는 중 오류가 발생했습니다.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmExchange = async (parsed) => {
    setIsLoading(true);

    try {
      // Call backend to create exchange request
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/coordination/rooms/${roomId}/smart-exchange`,
        parsed,
        {
          headers: {
            'x-auth-token': localStorage.getItem('token')
          }
        }
      );

      const { success, message, immediateSwap } = response.data;

      if (success) {
        if (immediateSwap) {
          setMessages(prev => [...prev, {
            id: Date.now(),
            type: 'bot',
            content: `✅ ${message}\n시간이 즉시 변경되었습니다!`,
            timestamp: new Date()
          }]);
        } else {
          setMessages(prev => [...prev, {
            id: Date.now(),
            type: 'bot',
            content: `✅ ${message}\n상대방의 응답을 기다리고 있습니다.`,
            timestamp: new Date()
          }]);
        }

        // Notify parent to refresh
        if (onExchangeRequest) {
          onExchangeRequest();
        }
      } else {
        setMessages(prev => [...prev, {
          id: Date.now(),
          type: 'bot',
          content: `❌ ${message}`,
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Exchange request error:', error);
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'bot',
        content: '교환 요청 중 오류가 발생했습니다.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="px-4 py-3 bg-blue-600 text-white rounded-t-lg">
        <h3 className="font-semibold">시간 변경 챗봇</h3>
        <p className="text-xs text-blue-100">자연어로 시간 변경을 요청하세요</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2 rounded-lg ${
                msg.type === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.actions && (
                <div className="mt-3 space-x-2">
                  {msg.actions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={action.onClick}
                      className={`px-3 py-1 text-sm rounded ${
                        idx === 0
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs mt-1 opacity-70">
                {msg.timestamp.toLocaleTimeString('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="메시지를 입력하세요... (예: 수요일 2시로 바꿔줘)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoordinationChatBot;
