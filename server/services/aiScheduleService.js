const { GoogleGenerativeAI } = require('@google/generative-ai');
const ChatMessage = require('../models/ChatMessage');
const Room = require('../models/room');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 분석 중복 방지를 위한 Map (roomId -> 마지막 분석 시간)
const analysisTimestamps = new Map();

/**
 * 대화 내용 분석 및 일정 추출 서비스
 */
exports.analyzeConversation = async (roomId) => {
  try {
    // 0. 중복 분석 방지 (30초 이내 재분석 방지)
    const now = Date.now();
    const lastAnalysis = analysisTimestamps.get(roomId);
    if (lastAnalysis && now - lastAnalysis < 30000) {
      console.log(`⏳ [AI Schedule] Skipping analysis for room ${roomId} - analyzed ${Math.floor((now - lastAnalysis) / 1000)}s ago`);
      return;
    }

    // 분석 시작 시간 기록
    analysisTimestamps.set(roomId, now);

    // 1. 최근 대화 내용 가져오기 (최근 20개)
    const messages = await ChatMessage.find({ room: roomId })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('sender', 'firstName lastName');

    if (messages.length < 3) {
      console.log(`ℹ️ [AI Schedule] Not enough messages in room ${roomId} (${messages.length} messages)`);
      return;
    }

    // 시간순 정렬 (과거 -> 현재)
    const sortedMessages = messages.reverse();

    // 마지막 메시지가 AI 제안이면 스킵 (중복 분석 방지)
    if (sortedMessages[sortedMessages.length - 1].type === 'suggestion') {
      console.log(`ℹ️ [AI Schedule] Skipping - last message is already a suggestion`);
      return;
    }

    // 2. 대화 텍스트 변환
    const conversationText = sortedMessages.map(m => 
      `${m.sender.firstName || 'User'}: ${m.content}`
    ).join('\n');

    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().toLocaleDateString('ko-KR', { weekday: 'long' });

    // 3. Gemini 프롬프트 구성 (개선된 버전)
    const prompt = `
      Current Date: ${today} (${dayOfWeek})
      Current Time: ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
      Year: 2026

      You are a meeting schedule extraction AI. Analyze the following Korean/English conversation and determine if group members have clearly agreed on a specific meeting schedule.

      Conversation:
      ${conversationText}

      EXTRACTION RULES:
      1. **Agreement Detection**: Only extract if there is CLEAR confirmation from at least 2 participants
         - Korean: "좋아요", "네", "오케이", "알겠습니다", "괜찮아요", "좋죠", "오키" etc.
         - English: "Okay", "Sure", "Sounds good", "Let's do it", "Agreed" etc.

      2. **Date Parsing**:
         - "내일" (tomorrow) → ${today} + 1 day
         - "모레" (day after tomorrow) → ${today} + 2 day
         - "다음주 월요일" → next Monday from ${today}
         - "1월 15일" → 2026-01-15
         - Always use YYYY-MM-DD format

      3. **Time Parsing**:
         - "2시" or "오후 2시" → 14:00
         - "오전 10시" → 10:00
         - "2시 반" → 14:30
         - "10시부터 12시까지" → startTime: 10:00, endTime: 12:00
         - If only start time given, add 1 hour for end time
         - Always use HH:MM format (24-hour)

      4. **Location**: Extract if mentioned (e.g., "강남역 스타벅스", "회의실 A")

      5. **Summary**: Brief description of meeting type (e.g., "미팅", "회의", "점심 식사")

      6. **Rejection Cases** (agreed: false):
         - Unclear time/date
         - Participants rejecting ("안 돼요", "힘들어요", "어려울 것 같아요")
         - Still discussing without final agreement
         - Only one person suggesting without confirmation

      Output Format (JSON ONLY, no markdown):
      {
        "agreed": true,
        "summary": "회의",
        "date": "2026-01-15",
        "startTime": "14:00",
        "endTime": "15:00",
        "location": "강남역 스타벅스"
      }

      If no clear agreement: { "agreed": false }

      Return ONLY the JSON object, no other text.
    `;

    // 4. Gemini 호출 (타임아웃 설정)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();

    // Markdown code block 제거
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    // JSON 파싱 시도
    let analysisResult;
    try {
      analysisResult = JSON.parse(text);
    } catch (parseError) {
      console.error('❌ [AI Schedule] JSON parse failed:', parseError);
      console.error('AI Response:', text);
      return; // JSON 파싱 실패 시 조용히 종료
    }

    // 5. 응답 검증
    if (!analysisResult || typeof analysisResult.agreed !== 'boolean') {
      console.error('❌ [AI Schedule] Invalid response structure:', analysisResult);
      return;
    }

    // 6. 일정 합의가 감지되면 추가 검증 후 클라이언트에 제안 전송
    if (analysisResult.agreed) {
      // 필수 필드 검증
      if (!analysisResult.date || !analysisResult.startTime || !analysisResult.summary) {
        console.error('❌ [AI Schedule] Missing required fields:', analysisResult);
        return;
      }

      // 날짜 형식 검증 (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(analysisResult.date)) {
        console.error('❌ [AI Schedule] Invalid date format:', analysisResult.date);
        return;
      }

      // 시간 형식 검증 (HH:MM)
      const timeRegex = /^\d{2}:\d{2}$/;
      if (!timeRegex.test(analysisResult.startTime) || !timeRegex.test(analysisResult.endTime)) {
        console.error('❌ [AI Schedule] Invalid time format:', analysisResult);
        return;
      }

      // 과거 날짜 검증
      const proposedDate = new Date(analysisResult.date);
      const todayDate = new Date(today);
      if (proposedDate < todayDate) {
        console.warn('⚠️ [AI Schedule] Proposed date is in the past:', analysisResult.date);
        // 과거 날짜는 경고만 하고 진행 (사용자가 과거 일정을 확정할 수도 있음)
      }

      console.log(`💡 [AI Schedule] Valid schedule detected for room ${roomId}:`, analysisResult);

      // Socket 이벤트 발송
      if (global.io) {
        global.io.to(`room-${roomId}`).emit('schedule-suggestion', analysisResult);
      }
    } else {
      console.log(`ℹ️ [AI Schedule] No clear agreement detected in room ${roomId}`);
    }

  } catch (error) {
    console.error('❌ [AI Schedule] Analysis failed:', error);

    // 에러 타입별 상세 로깅
    if (error.message?.includes('API key')) {
      console.error('  → Gemini API key issue. Check GEMINI_API_KEY env variable.');
    } else if (error.message?.includes('quota')) {
      console.error('  → API quota exceeded. Check Gemini API usage.');
    } else if (error.message?.includes('timeout')) {
      console.error('  → Request timeout. Gemini API may be slow.');
    } else {
      console.error('  → Unexpected error:', error.message);
    }
  }
};
