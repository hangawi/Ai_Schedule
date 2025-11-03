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

      // explanation에서 JSON 형식 완전 제거
      let cleanExplanation = data.explanation;

      if (cleanExplanation) {
        // 1. JSON 코드 블록 제거 (```json ... ``` 또는 ``` ... ```)
        cleanExplanation = cleanExplanation.replace(/```json\s*[\s\S]*?\s*```/g, '');
        cleanExplanation = cleanExplanation.replace(/```\s*[\s\S]*?\s*```/g, '');

        // 2. 중괄호로 시작하는 JSON 객체 전체 제거 (여러 줄 포함)
        cleanExplanation = cleanExplanation.replace(/\{[\s\S]*?"understood"[\s\S]*?\}/g, '');
        cleanExplanation = cleanExplanation.replace(/\{[\s\S]*?"action"[\s\S]*?\}/g, '');

        // 3. JSON 필드 라인 제거
        cleanExplanation = cleanExplanation.replace(/"(understood|action|schedule|explanation)":\s*[^\n]*/g, '');

        // 4. 남은 중괄호, 대괄호, 쉼표 제거
        cleanExplanation = cleanExplanation.replace(/[{}\[\],]/g, '');

        // 5. 여러 줄 공백 정리
        cleanExplanation = cleanExplanation.replace(/\n{3,}/g, '\n\n').trim();

        // 6. 삭제된 수업 목록 줄바꿈 포맷팅
        // "• 월요일: 도덕 (09:00), 영어 (10:00)" → "월요일:\n  • 도덕 (09:00)\n  • 영어 (10:00)"
        cleanExplanation = cleanExplanation.replace(/• ([월화수목금토일]요일):\s*([^•\n]+)/g, (match, day, items) => {
          const itemList = items.split(/[,，]/).map(item => item.trim()).filter(item => item);
          if (itemList.length > 3) {
            // 3개 이상이면 줄바꿈
            return `${day}:\n${itemList.map(item => `  • ${item}`).join('\n')}`;
          }
          return match; // 3개 이하면 그대로
        });

        // 7. 빈 문자열이면 기본 메시지
        if (!cleanExplanation || cleanExplanation.length < 3) {
          cleanExplanation = data.understood || '처리했어요!';
        }
      }

      // AI 응답 메시지
      const botMessage = {
        id: Date.now() + 2,
        text: cleanExplanation,
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
