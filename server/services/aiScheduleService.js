const { GoogleGenerativeAI } = require('@google/generative-ai');
const ChatMessage = require('../models/ChatMessage');
const Room = require('../models/room');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * 대화 내용 분석 및 일정 추출 서비스
 */
exports.analyzeConversation = async (roomId) => {
  try {
    // 1. 최근 대화 내용 가져오기 (최근 20개)
    const messages = await ChatMessage.find({ room: roomId })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('sender', 'firstName lastName');

    if (messages.length < 3) return; // 대화가 너무 적으면 분석 스킵

    // 시간순 정렬 (과거 -> 현재)
    const sortedMessages = messages.reverse();
    
    // 마지막 메시지가 AI 제안이면 스킵 (중복 분석 방지)
    if (sortedMessages[sortedMessages.length - 1].type === 'suggestion') return;

    // 2. 대화 텍스트 변환
    const conversationText = sortedMessages.map(m => 
      `${m.sender.firstName || 'User'}: ${m.content}`
    ).join('\n');

    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().toLocaleDateString('ko-KR', { weekday: 'long' });

    // 3. Gemini 프롬프트 구성
    const prompt = `
      Current Date: ${today} (${dayOfWeek})
      
      Analyze the following chat conversation between group members and determine if they have agreed on a specific schedule (date and time).
      
      Conversation:
      ${conversationText}
      
      Goal: Extract the agreed meeting schedule.
      
      Conditions:
      1. Only extract if there is a clear agreement or confirmation from multiple parties (e.g., "Okay", "Sounds good", "Let's do that").
      2. If date/time is ambiguous or not agreed upon, return null.
      3. The year is 2026 unless specified otherwise.
      
      Output Format (JSON):
      {
        "agreed": boolean,
        "summary": "Meeting description",
        "date": "YYYY-MM-DD",
        "startTime": "HH:MM",
        "endTime": "HH:MM", 
        "location": "Location name (optional)"
      }
      
      If agreed is false, return { "agreed": false }.
      Do not include markdown formatting (like \`\`\`json). Just the raw JSON string.
    `;

    // 4. Gemini 호출
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();
    
    // Markdown code block 제거
    if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '');
    else if (text.startsWith('```')) text = text.replace(/^```/, '').replace(/```$/, '');

    const analysisResult = JSON.parse(text);

    // 5. 일정 합의가 감지되면 클라이언트에 제안 전송
    if (analysisResult.agreed) {
      console.log(`💡 [AI Schedule] Schedule detected for room ${roomId}:`, analysisResult);

      // 제안 메시지를 DB에 저장 (선택 사항: 기록용)
      // 여기서는 저장하지 않고 소켓으로만 쏘거나, 시스템 메시지로 저장할 수 있음.
      // 일단 Socket 이벤트만 발송하여 UI에 띄우는 방식 채택.
      
      if (global.io) {
        global.io.to(`room-${roomId}`).emit('schedule-suggestion', analysisResult);
      }
    }

  } catch (error) {
    console.error('❌ [AI Schedule] Analysis failed:', error);
  }
};
