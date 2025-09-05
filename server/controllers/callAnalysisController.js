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

      const prompt = `다음 통화 대화 내용에서 일정이나 약속과 관련된 내용을 찾아서 JSON 형태로 추출해주세요.
      
대화 내용:
"${transcript}"

다음과 같은 형태로 응답해주세요:
{
  "schedules": [
    {
      "title": "일정 제목",
      "date": "YYYY-MM-DD 형태의 날짜 (추론 가능한 경우)",
      "time": "HH:MM 형태의 시간 (추론 가능한 경우)",
      "participants": ["참석자1", "참석자2"],
      "location": "장소 (있는 경우)",
      "description": "추가 설명",
      "confidence": 0.8,
      "originalText": "원본 대화 내용 부분",
      "category": "meeting|appointment|reminder|event"
    }
  ]
}

분석 규칙:
1. 확실하지 않은 정보는 null로 설정
2. confidence는 0-1 사이의 값으로 확실성을 표현 (0.6 이상만 유의미)
3. 날짜/시간은 대화 맥락을 통해 추론 가능한 경우만 포함
4. 참석자는 대화에 언급된 사람들만 포함
5. 모호한 표현("나중에", "언젠가")은 낮은 confidence로 설정
6. 구체적인 날짜/시간이 있는 경우 높은 confidence 부여
7. 일정과 관련 없는 내용은 제외

만약 일정과 관련된 내용이 없으면:
{"schedules": []}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      let parsedResult;
      try {
         // JSON 마크다운 제거 및 파싱
         const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
         parsedResult = JSON.parse(cleanedText);
      } catch (parseError) {
         console.error('AI 응답 파싱 실패:', parseError);
         console.error('응답 내용:', text);
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
      console.error('통화 내용 분석 오류:', error);
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

      // 간단한 키워드 기반 감지
      const scheduleKeywords = [
         '일정', '약속', '미팅', '회의', '모임', '만남', '식사', '점심', '저녁',
         '만나자', '보자', '가자', '하자', '시간', '날짜', '언제', '며칠',
         '오늘', '내일', '모레', '다음주', '이번주', '월요일', '화요일', '수요일',
         '목요일', '금요일', '토요일', '일요일'
      ];

      const timePatterns = [
         /\d{1,2}:\d{2}/g, // 14:30
         /\d{1,2}시/g, // 2시
         /\d{1,2}분/g, // 30분
         /오전|오후|새벽|밤/g,
         /\d{1,2}월\s*\d{1,2}일/g, // 3월 15일
         /\d{4}[-/]\d{1,2}[-/]\d{1,2}/g // 2024-03-15
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
      console.error('키워드 감지 오류:', error);
      res.status(500).json({
         success: false,
         message: '키워드 감지 중 오류가 발생했습니다.',
         error: error.message
      });
   }
};