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
      if (!API_KEY) {
         return res.status(500).json({
            success: false,
            message: 'Gemini API 키가 설정되지 않았습니다.'
         });
      }

      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      const currentDay = currentDate.getDate();
      
      const prompt = `당신은 전화 통화 내용을 분석하여 일정을 자동으로 추출하고 캘린더에 등록하는 AI 어시스턴트입니다.
아래 통화 내용에서 일정이나 약속 관련 정보를 찾아 정확하게 분석해주세요.

현재 날짜: ${currentYear}년 ${currentMonth}월 ${currentDay}일

통화 내용:
"${transcript}"

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
   
2. 시간 해석 - 문맥상 추론:
   - "오후 2시" → 14:00
   - "점심때" → 12:00
   - "퇴근 후" → 18:30
   - "오전 중" → 10:00 (기본값)

3. 일정 제목 - 의미있고 구체적으로:
   - 단순히 "약속"이 아닌 "김철수님과 점심 미팅"
   - 목적과 참석자를 포함

4. 확실성 기준:
   - 0.9+ : 날짜, 시간, 장소 모두 명확
   - 0.8+ : 날짜, 시간 명확하지만 장소 불분명  
   - 0.7+ : 날짜만 명확
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
      res.status(500).json({
         success: false,
         message: '통화 내용 분석 중 오류가 발생했습니다.',
         error: error.message
      });
   }
};

// 일정 키워드 감지 (실시간 분석용)
exports.detectScheduleKeywords = async (req, res) => {
   try {
      const { text, threshold = 0.7 } = req.body;
      
      if (!text || typeof text !== 'string') {
         return res.status(400).json({
            success: false,
            message: '분석할 텍스트가 필요합니다.'
         });
      }

      // 향상된 키워드 기반 감지
      const scheduleKeywords = [
         // 일정 관련 핵심 단어
         '일정', '약속', '미팅', '회의', '모임', '만남', '식사', '점심', '저녁', '아침',
         '회식', '술자리', '파티', '생일', '기념일', '데이트', '면접', '상담',
         
         // 행동 동사
         '만나자', '보자', '가자', '하자', '갈까', '볼까', '할까', '만날까',
         '잡자', '정하자', '예약', '신청', '등록', '참석', '참여',
         
         // 시간 관련
         '시간', '날짜', '언제', '며칠', '몇시', '몇일', '기간', '동안',
         
         // 날짜 표현
         '오늘', '내일', '모레', '글피', '이번주', '다음주', '이번달', '다음달',
         '월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일',
         '주말', '평일', '휴일', '연휴',
         
         // 장소 관련
         '에서', '로', '까지', '근처', '앞', '역', '카페', '식당', '사무실', 
         '집', '학교', '회사', '본사', '지점', '매장', '센터'
      ];

      const timePatterns = [
         /\d{1,2}:\d{2}/g, // 14:30
         /\d{1,2}시\s*\d{0,2}분?/g, // 2시, 2시30분
         /\d{1,2}분/g, // 30분
         /오전|오후|새벽|밤|저녁|아침/g,
         /\d{1,2}월\s*\d{1,2}일/g, // 3월 15일
         /\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/g, // 2024-03-15
         /\d{1,2}\/\d{1,2}/g, // 3/15
         /이번\s*(주|달|년)/g, // 이번 주
         /다음\s*(주|달|년)/g, // 다음 주  
         /\d{1,2}주\s*후/g, // 2주 후
         /\d{1,2}일\s*후/g // 3일 후
      ];

      let keywordCount = 0;
      let timeMatchCount = 0;

      // 키워드 카운트
      scheduleKeywords.forEach(keyword => {
         if (text.includes(keyword)) {
            keywordCount++;
         }
      });

      // 시간 패턴 매칭
      timePatterns.forEach(pattern => {
         const matches = text.match(pattern);
         if (matches) {
            timeMatchCount += matches.length;
         }
      });

      // 점수 계산 (키워드 + 시간 패턴)
      const score = Math.min((keywordCount * 0.3 + timeMatchCount * 0.5) / 3, 1);
      const isScheduleRelated = score >= threshold;

      res.json({
         success: true,
         data: {
            isScheduleRelated,
            score,
            keywordCount,
            timeMatchCount,
            threshold
         }
      });

   } catch (error) {
      res.status(500).json({
         success: false,
         message: '키워드 감지 중 오류가 발생했습니다.',
         error: error.message
      });
   }
};