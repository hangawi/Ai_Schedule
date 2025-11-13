const { GoogleGenerativeAI } = require('@google/generative-ai');

// 클립보드 텍스트 분석 (LLM 기반)
exports.analyzeClipboardText = async (req, res) => {
   try {
      const { text } = req.body;
      
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
         return res.status(400).json({
            success: false,
            message: '분석할 텍스트가 필요합니다.'
         });
      }
      // Gemini API 키 확인
      const API_KEY = process.env.GEMINI_API_KEY;
      if (!API_KEY || API_KEY.trim().length === 0) {
         // 폴백: 키워드 기반 분석 - text 변수가 스코프에 있어야 함
         return analyzeWithKeywords(text, res);
      }

      // API 키 형식 기본 검증 (Google API 키는 보통 39자)
      if (API_KEY.length < 30) {
         return analyzeWithKeywords(text, res);
      }

      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      const currentDay = currentDate.getDate();
      const currentDayName = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][currentDate.getDay()];
      
      const prompt = `당신은 클립보드에 복사된 텍스트를 분석하여 일정 정보를 추출하는 AI 어시스턴트입니다.
다음 텍스트가 일정/약속과 관련된 내용인지 분석하고, 관련된 경우 정보를 추출해주세요.

**중요: 텍스트 품질 검증을 먼저 수행하세요**

현재 날짜: ${currentYear}년 ${currentMonth}월 ${currentDay}일 (${currentDayName})

분석할 텍스트:
"${text}"

**1단계: 텍스트 품질 검증 (반드시 먼저 확인)**
다음 중 하나라도 해당되면 isScheduleRelated: false로 처리하세요:
- 의미 없는 연속 문자 (예: asdasd, qwerty, 123456789, aaaaaaa 등)
- 10글자 이상의 연속 영문자나 숫자
- 정상적이지 않은 특수문자 조합
- 오타가 심하거나 읽을 수 없는 텍스트
- 한국어/영어가 아닌 언어나 깨진 문자
- 복사 오류로 보이는 이상한 텍스트 조각

**2단계: 일정 관련성 검증**
텍스트가 정상적이라면, 다음 요소들이 명확하게 포함되어야 합니다:
✅ 날짜 표현 (내일, 다음주 월요일, 3월 15일 등)
✅ 시간 표현 (오후 2시, 14:00, 점심때 등)  
✅ 활동 표현 (영화, 밥, 미팅, 만나자 등)

**제목 추출 규칙 (간단하게 만들기):**
- "이번주 일요일 영화보자" → title: "영화"
- "다음주 토요일 장어집" → title: "장어집"  
- "내일 점심 먹자" → title: "점심"
- "3시에 미팅" → title: "미팅"
- 핵심 활동/장소만 간단히 추출하세요

**3단계: 신뢰도 계산**
- 0.9+: 날짜, 시간, 활동이 모두 명확하고 텍스트가 완전히 정상
- 0.8+: 날짜, 시간, 활동 중 2개가 명확하고 텍스트가 정상
- 0.7+: 핵심 정보 1개만 명확하지만 일정 의도가 확실
- 0.6 이하: 일정과 무관하거나 텍스트 품질 문제

다음과 같은 형태로 응답해주세요:
{
  "isScheduleRelated": true/false,
  "confidence": 0.85,
  "extractedInfo": {
    "title": "일정 제목",
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "description": "추출된 설명",
    "location": "장소",
    "participants": ["참석자1", "참석자2"]
  },
  "reasoning": "분석 근거"
}

**분석 기준:**
1. 일정 관련 키워드 (더 포괄적):
   - 시간: 오늘, 내일, 모레, 월요일~일요일, 오전/오후, 시간, 분, 새벽, 밤, 점심, 저녁, 아침
   - 약속: 만나자, 가자, 하자, 약속, 미팅, 회의, 모임, 식사, 영화, 공연, 콘서트, 쇼핑, 놀기
   - 장소: 카페, 식당, 학교, 회사, 역, 센터, 영화관, 극장, 백화점, 마트, 공원, 집, 사무실
   - 활동: 보기, 먹기, 만나기, 가기, 하기, 보러, 먹으러, 만나러, 가러, 하러

2. 신뢰도 계산 (더 관대하게):
   - 0.9+: 명확한 날짜, 시간, 장소/활동이 모두 포함
   - 0.8+: 날짜와 시간이 명확하고 활동/장소 중 하나 있음
   - 0.7+: 날짜 또는 시간 중 하나가 명확하고 활동 명시
   - 0.6+: 일정 의도는 있으나 일부 정보 부족
   - 0.5+: 시간/날짜 표현과 활동이 함께 있음
   - 0.5 미만: 일정과 무관

3. 날짜 해석 (더 정확하게):
   - "내일" → ${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(currentDay + 1).padStart(2,'0')}
   - "다음주 토요일" → 다음주 토요일 정확한 날짜 계산
   - "이번주 금요일" → 이번주 금요일 정확한 날짜 계산
   - 상대적 표현을 절대 날짜로 변환

4. 특별히 주의할 패턴:
   - "다음주 토요일 오후 4시에 영화" → 높은 신뢰도
   - "내일 점심 먹기" → 높은 신뢰도  
   - "화요일에 만나자" → 높은 신뢰도
   - "오후에 카페 가기" → 중간 신뢰도

5. 제외 대상:
   - 단순 정보성 텍스트
   - 뉴스, 기사 내용  
   - 코드, 기술 문서
   - 의미 없는 텍스트 조각
   - 이미 지난 일정

6. tuesday를 화요일로 변환하여 처리

**예시:**
✅ "다음주 토요일 오후 4시에 영화 보자" → isScheduleRelated: true (정상적인 일정)
❌ "다음주 토요일 오후asdasd 4시에 영화 보자" → isScheduleRelated: false (이상한 문자 포함)
❌ "asdkjfhalskdjfhalsdk" → isScheduleRelated: false (의미 없는 문자열)
❌ "123456789012345" → isScheduleRelated: false (의미 없는 숫자)

일정과 무관한 텍스트면: {"isScheduleRelated": false, "confidence": 0, "reasoning": "일정과 무관한 내용"}
텍스트 품질에 문제가 있으면: {"isScheduleRelated": false, "confidence": 0, "reasoning": "텍스트에 이상한 문자나 패턴이 포함되어 있어 정상적인 일정으로 인식할 수 없습니다"}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text_response = response.text();
      
      let parsedResult;
      try {
         const cleanedText = text_response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
         parsedResult = JSON.parse(cleanedText);
      } catch (parseError) {
         // 폴백: 키워드 기반 분석
         return analyzeWithKeywords(text, res);
      }

      // 추가 서버 사이드 검증: Gemini가 놓친 이상한 텍스트 다시 확인
      if (parsedResult.isScheduleRelated) {
         const suspiciousPatterns = [
            /[ㄱ-ㅎㅏ-ㅣ]+/, // 단독 한글 자모음 (ㄴ, ㅁ, ㅋ 등)
            /[a-zA-Z]{8,}/, // 8글자 이상 연속 영문자
            /\d{8,}/, // 8자리 이상 연속 숫자
            /(.)\1{4,}/, // 같은 문자 5번 이상 반복
            /[^\w\s가-힣.,!?:;()[\]{}'"~-]{2,}/, // 특수문자 2개 이상 연속
         ];
         
         let suspiciousFound = false;
         suspiciousPatterns.forEach(pattern => {
            if (pattern.test(text)) {
               suspiciousFound = true;
            }
         });
         
         if (suspiciousFound) {
            parsedResult = {
               isScheduleRelated: false,
               confidence: 0,
               reasoning: '텍스트에 이상한 문자나 패턴이 포함되어 있어 정상적인 일정으로 인식할 수 없습니다.',
               extractedInfo: {}
            };
         }
      }

      res.json({
         success: true,
         data: parsedResult
      });

   } catch (error) {
      
      // API 키 관련 오류 체크
      if (error.message.includes('API key not valid') || 
          error.message.includes('API_KEY_INVALID') ||
          error.message.includes('invalid API key')) {
      }
      
      // Gemini API 호출 실패시 폴백
      const { text } = req.body;
      return analyzeWithKeywords(text, res);
   }
};

// 키워드 기반 폴백 분석 함수 (더 정확한 검증 추가)
function analyzeWithKeywords(text, res) {
   
   const currentDate = new Date();
   const currentYear = currentDate.getFullYear();
   const currentMonth = currentDate.getMonth() + 1;
   const currentDay = currentDate.getDate();
   
   // tuesday를 화요일로 변환
   const translatedText = text.replace(/tuesday/gi, '화요일');
   
   // 1단계: 텍스트 정상성 검증 (이상한 문자열 필터링)
   const suspiciousPatterns = [
      /[a-zA-Z]{10,}/, // 10글자 이상 연속 영문자
      /\d{10,}/, // 10자리 이상 연속 숫자
      /[^\w\s가-힣.,!?:;()[\]{}'"~-]{3,}/, // 특수문자 3개 이상 연속
      /(.)\1{5,}/ // 같은 문자 6번 이상 반복
   ];
   
   let suspiciousScore = 0;
   suspiciousPatterns.forEach(pattern => {
      if (pattern.test(translatedText)) {
         suspiciousScore += 0.3;
      }
   });
   
   // 이상한 텍스트면 바로 거부
   if (suspiciousScore > 0.5) {
      return res.json({
         success: true,
         data: {
            isScheduleRelated: false,
            confidence: 0,
            reasoning: '정상적이지 않은 텍스트 패턴이 감지되어 일정으로 인식하지 않습니다.'
         },
         fallback: true
      });
   }
   
   // 2단계: 더 엄격한 일정 패턴 매칭
   const strictSchedulePatterns = [
      // 날짜 + 시간 + 활동이 모두 있어야 함
      /(다음주|이번주)\s*(월요일|화요일|수요일|목요일|금요일|토요일|일요일)\s+(오전|오후)\s*\d{1,2}시\s*(영화|밥|점심|저녁|만나|가자|보자)/i,
      /(내일|모레)\s+(오전|오후)\s*\d{1,2}시\s*(영화|밥|점심|저녁|만나|가자|보자)/i,
      /\d{1,2}월\s*\d{1,2}일\s+(오전|오후)\s*\d{1,2}시\s*(영화|밥|점심|저녁|만나|가자|보자)/i
   ];
   
   // 날짜만 있는 패턴 (시간은 선택사항)
   const dateOnlyPatterns = [
      /(다음주|이번주)\s*(월요일|화요일|수요일|목요일|금요일|토요일|일요일)\s*(영화|밥|점심|저녁|만나|가자|보자)/i,
      /(내일|모레)\s*(영화|밥|점심|저녁|만나|가자|보자)/i
   ];
   
   // 시간만 있는 패턴 (날짜는 선택사항)
   const timeOnlyPatterns = [
      /(오전|오후)\s*\d{1,2}시\s*(영화|밥|점심|저녁|만나|가자|보자)/i,
      /\d{1,2}시\s*(영화|밥|점심|저녁|만나|가자|보자)/i
   ];
   
   let confidence = 0;
   let isScheduleRelated = false;
   let hasDate = false;
   let hasTime = false;
   let hasActivity = false;
   
   // 엄격한 패턴 검사 (높은 점수)
   strictSchedulePatterns.forEach(pattern => {
      if (pattern.test(translatedText)) {
         confidence += 0.8;
         isScheduleRelated = true;
         hasDate = true;
         hasTime = true;
         hasActivity = true;
      }
   });
   
   // 날짜만 있는 패턴 (중간 점수)
   dateOnlyPatterns.forEach(pattern => {
      if (pattern.test(translatedText)) {
         confidence += 0.5;
         isScheduleRelated = true;
         hasDate = true;
         hasActivity = true;
      }
   });
   
   // 시간만 있는 패턴 (낮은 점수)
   timeOnlyPatterns.forEach(pattern => {
      if (pattern.test(translatedText)) {
         confidence += 0.3;
         hasTime = true;
         hasActivity = true;
      }
   });
   
   // 최소 신뢰도 기준: 0.7 이상이어야 일정으로 인식
   if (confidence < 0.7) {
      isScheduleRelated = false;
   }
   
   let extractedInfo = {};
   
   if (isScheduleRelated) {
      // 기본 정보 추출
      const timeMatch = translatedText.match(/오후\s*(\d{1,2})시/i);
      if (timeMatch) {
         const hour = parseInt(timeMatch[1]) + 12;
         extractedInfo.time = `${hour.toString().padStart(2, '0')}:00`;
      }
      
      const dayMatch = translatedText.match(/다음주?\s*(토요일)/i);
      if (dayMatch) {
         // 다음 토요일 계산
         const today = new Date();
         const daysUntilSaturday = (6 - today.getDay() + 7) % 7;
         const nextSaturday = new Date(today);
         nextSaturday.setDate(today.getDate() + daysUntilSaturday + 7);
         
         extractedInfo.date = `${nextSaturday.getFullYear()}-${String(nextSaturday.getMonth() + 1).padStart(2, '0')}-${String(nextSaturday.getDate()).padStart(2, '0')}`;
      }
      
      if (/영화/i.test(translatedText)) {
         extractedInfo.title = '영화 보기';
         extractedInfo.description = '영화 관람 약속';
      }
   }
   
   const result = {
      isScheduleRelated,
      confidence: Math.min(confidence, 1),
      extractedInfo,
      reasoning: isScheduleRelated ? 
         '키워드 패턴 매칭으로 일정 관련 내용 감지' : 
         '일정과 관련된 패턴을 찾을 수 없음',
      translatedText: translatedText !== text ? translatedText : undefined
   };
   
   return res.json({
      success: true,
      data: result,
      fallback: true
   });
}