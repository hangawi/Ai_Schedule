/**
 * 채팅 관련 핸들러
 */

export const handleChatSubmit = async (
  e,
  chatInput,
  setChatInput,
  setChatMessages,
  modifiedCombinations,
  currentIndex,
  originalSchedule,
  setModifiedCombinations,
  dayMap,
  gradeLevelMap,
  parseTime,
  chatMessages  // 추가: 대화 히스토리
) => {
  e.preventDefault();
  if (!chatInput.trim()) return;

  const userMessage = {
    id: Date.now(),
    text: chatInput,
    sender: 'user',
    timestamp: new Date()
  };

  setChatMessages(prev => [...prev, userMessage]);
  const input = chatInput.trim();
  setChatInput('');

  // AI 응답 대기 중 메시지
  const thinkingMessageId = Date.now() + 1;
  const thinkingMessage = {
    id: thinkingMessageId,
    text: '💭 답변을 생각하고 있어요...',
    sender: 'bot',
    timestamp: new Date()
  };
  setChatMessages(prev => [...prev, thinkingMessage]);

  // AI에게 자연어 요청 보내기
  try {
    const token = localStorage.getItem('token');
    console.log('🔑 토큰 확인:', token ? '있음' : '없음');
    console.log('📋 원본 스케줄:', originalSchedule ? `${originalSchedule.length}개` : '없음');
    console.log('📋 현재 스케줄:', modifiedCombinations[currentIndex].length, '개');

    // 직전 봇 응답 찾기 (대화 컨텍스트 유지)
    const lastBotMessage = chatMessages
      ? [...chatMessages].reverse().find(msg => msg.sender === 'bot' && msg.text !== '💭 답변을 생각하고 있어요...')
      : null;
    const lastAiResponse = lastBotMessage ? lastBotMessage.text : null;
    console.log('🤖 직전 AI 응답:', lastAiResponse ? '있음' : '없음');

    const response = await fetch('http://localhost:5000/api/schedule/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      },
      body: JSON.stringify({
        message: input,
        currentSchedule: modifiedCombinations[currentIndex],
        originalSchedule: originalSchedule || modifiedCombinations[currentIndex],
        lastAiResponse: lastAiResponse  // 직전 AI 응답 전달
      })
    });

    const data = await response.json();
    console.log('📥 AI 응답:', data);

    // 생각 중 메시지 제거
    setChatMessages(prev => prev.filter(msg => msg.id !== thinkingMessageId));

    if (data.success) {
      // 시간표 업데이트
      const updatedCombinations = [...modifiedCombinations];
      updatedCombinations[currentIndex] = data.schedule;
      setModifiedCombinations(updatedCombinations);

      // AI 응답 메시지
      const botMessage = {
        id: Date.now() + 2,
        text: data.explanation,
        sender: 'bot',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, botMessage]);
      return { handled: true };
    }
  } catch (error) {
    console.error('AI 채팅 에러:', error);
    // 생각 중 메시지 제거
    setChatMessages(prev => prev.filter(msg => msg.id !== thinkingMessageId));
  }

  return { handled: false, input, dayMap, gradeLevelMap, parseTime };
};
