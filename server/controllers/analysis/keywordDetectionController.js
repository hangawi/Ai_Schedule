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