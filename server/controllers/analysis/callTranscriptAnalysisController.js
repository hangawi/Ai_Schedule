const { GoogleGenerativeAI } = require('@google/generative-ai');

// 통화 내용에서 일정 정보 분석
exports.analyzeCallTranscript = async (req, res) => {
   try {
      const { transcript } = req.body;
      
      if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
         return res.status(400).json({
            success: false,
            message: '분석할 통화 내용이 필요합니다.'
         });
      }

      // Gemini API 키 확인
      const API_KEY = process.env.GEMINI_API_KEY;
      if (!API_KEY || API_KEY.trim().length === 0) {
         return res.status(500).json({
            success: false,
            message: 'Gemini API 키가 설정되지 않았습니다.'
         });
      }

      // API 키 형식 기본 검증 (Google API 키는 보통 39자)
      if (API_KEY.length < 30) {
         console.error('GEMINI_API_KEY가 너무 짧음 - 유효하지 않은 키일 가능성');
         return res.status(500).json({
            success: false,
            message: 'Gemini API 키 형식이 올바르지 않습니다.'
         });
      }

      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      const currentDay = currentDate.getDate();
      
      const prompt = `당신은 대화 내용을 분석하여 일정을 자동으로 추출하는 AI 어시스턴트입니다.
다음은 백그라운드에서 녹음된 대화 내용입니다. 이 대화에서 일정이나 약속 관련 정보를 찾아 정확하게 분석해주세요.

현재 날짜: ${currentYear}년 ${currentMonth}월 ${currentDay}일

대화 내용:
"${transcript}"

**중요: 이 대화 분석의 특별한 요구사항**
- 이는 백그라운드에서 자동 녹음된 일상 대화입니다
- 대화 참여자들이 실제로 약속을 정하는 내용인지 신중하게 판단해주세요
- 단순히 "내일 어떻게 될까?" 같은 추측성 발언은 제외하세요
- "~하자", "~할까?" 같은 제안은 isConfirmed: false로 처리하세요
- "~하기로 했다", "약속잡았다", "정했다" 같은 확정적 표현만 isConfirmed: true로 처리하세요

**tuesday를 화요일로 자동 변환하여 처리하세요**

다음과 같은 형태로 응답해주세요:
{
  "schedules": [
    {
      "title": "구체적인 일정 제목 (예: '김영수님과의 업무 미팅', '강남역 점심 약속')",
      "date": "YYYY-MM-DD 형태 (상대적 날짜 해석 필수)",
      "time": "HH:MM 형태 24시간 기준",
      "participants": ["대화에서 언급된 참석자들"],
      "location": "구체적인 장소명 (예: '강남역 2번 출구', 'xx회의실')",
      "description": "일정에 대한 자세한 설명과 통화 내용 요약",
      "confidence": 0.85,
      "originalText": "일정과 관련된 원본 대화 부분",
      "category": "meeting|appointment|reminder|event|meal|social",
      "priority": "high|medium|low",
      "isConfirmed": true/false
    }
  ]
}

**중요한 분석 규칙:**
1. 날짜 해석 - 현재 날짜 기준으로 정확히 계산:
   - "내일" → ${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(currentDay + 1).padStart(2,'0')}
   - "다음 주 화요일" → 정확한 날짜 계산
   - "이번 달 말" → 해당 월의 마지막 날짜
   
   **⚠️ 과거 날짜 표현 처리 (매우 중요):**
   - "저번주", "지난주", "작주" → 현재 주보다 1주 전
   - "지난달", "저번달" → 현재 달보다 1달 전  
   - "어제", "그제", "엊그제" → 과거 날짜로 정확히 계산
   - "저번주 화요일", "지난주 월요일" 등 → 반드시 과거 날짜로 설정
   
   **과거 날짜인 경우 반드시 confidence를 0.3 이하로 설정하고 reasoning에 "과거 일정은 추가하지 않음" 명시**
   
2. 시간 해석 - 문맥상 추론:
   - "오후 2시" → 14:00
   - "점심때" → 12:00
   - "퇴근 후" → 18:30
   - "오전 중" → 10:00 (기본값)

3. 일정 제목 - 의미있고 구체적으로:
   - 단순히 "약속"이 아닌 "김철수님과 점심 미팅"
   - 목적과 참석자를 포함

4. 확실성 기준:
   - **0.3 이하 : 과거 날짜 (저번주, 지난주, 어제 등) - 자동 제외**
   - 0.9+ : 미래 날짜, 시간, 장소 모두 명확
   - 0.8+ : 미래 날짜, 시간 명확하지만 장소 불분명  
   - 0.7+ : 미래 날짜만 명확
   - 0.6+ : 일정 의도는 있지만 세부사항 부족
   - 0.6 미만은 제외

5. 참석자 추출:
   - 대화 상대방의 이름이나 언급된 사람들
   - "우리", "같이" 등의 표현도 고려

6. 장소 정보:
   - 구체적인 주소나 랜드마크
   - "거기", "그곳" 같은 모호한 표현은 null

7. 일정 확정 여부:
   - "~하자", "~할까?" → isConfirmed: false  
   - "~하기로 했다", "약속잡았다" → isConfirmed: true

일정과 관련 없는 내용이면: {"schedules": []}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      let parsedResult;
      try {
         // JSON 마크다운 제거 및 파싱
         const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
         parsedResult = JSON.parse(cleanedText);
      } catch (parseError) {
         return res.status(500).json({
            success: false,
            message: 'AI 응답을 해석할 수 없습니다.',
            error: parseError.message
         });
      }

      // 결과 검증 및 필터링
      if (!parsedResult.schedules || !Array.isArray(parsedResult.schedules)) {
         return res.status(500).json({
            success: false,
            message: '올바르지 않은 응답 형식입니다.'
         });
      }

      // 신뢰도가 낮거나 필수 정보가 없는 일정 필터링
      const validSchedules = parsedResult.schedules.filter(schedule => {
         return schedule.confidence >= 0.6 && 
                schedule.title && 
                schedule.title.trim().length > 0;
      });

      res.json({
         success: true,
         data: {
            schedules: validSchedules,
            totalFound: parsedResult.schedules.length,
            validCount: validSchedules.length,
            transcriptLength: transcript.length
         }
      });

   } catch (error) {
      console.error('통화 내용 분석 에러:', error.message);
      
      // API 키 관련 오류 체크
      if (error.message.includes('API key not valid') || 
          error.message.includes('API_KEY_INVALID') ||
          error.message.includes('invalid API key')) {
         console.log('Gemini API 키가 유효하지 않음');
         return res.status(500).json({
            success: false,
            message: 'AI 분석 서비스에 문제가 있습니다. Gemini API 키를 확인해주세요.',
            error: 'Invalid API key',
            fallback: true
         });
      }
      
      res.status(500).json({
         success: false,
         message: '통화 내용 분석 중 오류가 발생했습니다.',
         error: error.message
      });
   }
};