const { GoogleGenerativeAI } = require('@google/generative-ai');
const { generateOcrChatPrompt } = require('../prompts/ocrChatFilter');

// Gemini AI 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * 필터링 조건 적용 함수
 */
function applyCondition(schedules, condition, allSchedules) {
  const { type } = condition;

  switch (type) {
    case 'imageIndex':
      // 특정 이미지의 스케줄 선택
      if (condition.mode === 'all') {
        const imageSchedules = allSchedules.filter(s => s.sourceImageIndex === condition.value);
        console.log(`  → imageIndex ${condition.value} 전체: ${imageSchedules.length}개`);
        return [...new Set([...schedules, ...imageSchedules])]; // 중복 제거하며 합침
      }
      return schedules;

    case 'titleMatch':
      // 제목 키워드 매칭
      const { keywords, matchAll, imageIndex } = condition;
      let filtered = allSchedules.filter(s => {
        // imageIndex 지정된 경우 해당 이미지만
        if (imageIndex !== undefined && s.sourceImageIndex !== imageIndex) {
          return false;
        }

        // 키워드 매칭
        const titleLower = (s.title || '').toLowerCase();
        const instructorLower = (s.instructor || '').toLowerCase();

        if (matchAll) {
          // 모든 키워드 포함
          return keywords.every(kw =>
            titleLower.includes(kw.toLowerCase()) ||
            instructorLower.includes(kw.toLowerCase())
          );
        } else {
          // 하나라도 포함
          return keywords.some(kw =>
            titleLower.includes(kw.toLowerCase()) ||
            instructorLower.includes(kw.toLowerCase())
          );
        }
      });
      console.log(`  → titleMatch [${keywords.join(', ')}]: ${filtered.length}개`);
      return [...new Set([...schedules, ...filtered])]; // 중복 제거하며 합침

    case 'timeRange':
      // 시간대 필터링
      let timeFiltered = allSchedules.filter(s => {
        // imageIndex 지정된 경우 해당 이미지만
        if (condition.imageIndex !== undefined && s.sourceImageIndex !== condition.imageIndex) {
          return false;
        }

        if (condition.startAfter && s.startTime < condition.startAfter) return false;
        if (condition.endBefore && s.startTime >= condition.endBefore) return false;
        return true;
      });
      console.log(`  → timeRange (${condition.startAfter || 'start'} ~ ${condition.endBefore || 'end'}): ${timeFiltered.length}개`);
      return [...new Set([...schedules, ...timeFiltered])]; // 중복 제거하며 합침

    case 'dayMatch':
      // 요일 필터링
      return schedules.filter(s => {
        if (!s.days || !Array.isArray(s.days)) return false;
        return s.days.some(day => condition.days.includes(day));
      });

    default:
      console.warn('⚠️ 알 수 없는 조건 타입:', type);
      return schedules;
  }
}

/**
 * OCR 결과를 채팅 메시지로 필터링
 * POST /api/ocr-chat/filter
 */
exports.filterSchedulesByChat = async (req, res) => {
  try {
    const { chatMessage, extractedSchedules, schedulesByImage, imageDescription } = req.body;

    console.log('📩 OCR 채팅 필터링 요청:', chatMessage);
    console.log('📊 추출된 스케줄 개수:', extractedSchedules?.length || 0);
    console.log('📸 이미지별 스케줄:', schedulesByImage?.length || 0, '개 이미지');

    // 입력 검증
    if (!chatMessage || !chatMessage.trim()) {
      return res.status(400).json({
        success: false,
        error: '채팅 메시지가 필요합니다.'
      });
    }

    if (!extractedSchedules || !Array.isArray(extractedSchedules) || extractedSchedules.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'OCR 추출 결과가 필요합니다.'
      });
    }

    // 프롬프트 생성
    const prompt = generateOcrChatPrompt(chatMessage, extractedSchedules, schedulesByImage, imageDescription);

    // Gemini AI 호출 (여러 모델 시도)
    const modelNames = [
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash',
      'gemini-1.5-flash-002',
      'gemini-1.5-flash'
    ];

    let aiResponse = null;
    let lastError = null;

    for (const modelName of modelNames) {
      try {
        console.log(`🤖 ${modelName} 모델로 시도 중...`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.1
          }
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        aiResponse = response.text();
        console.log(`✅ ${modelName} 모델 성공!`);
        break;
      } catch (error) {
        console.log(`❌ ${modelName} 실패: ${error.message}`);
        lastError = error;
        continue;
      }
    }

    if (!aiResponse) {
      throw lastError || new Error('모든 모델 시도 실패');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 RAW AI RESPONSE:');
    console.log(aiResponse);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // JSON 파싱
    let parsed = null;

    try {
      // 1. ```json ... ``` 형식
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        // 2. ``` ... ``` 형식
        const codeMatch = aiResponse.match(/```\s*([\s\S]*?)\s*```/);
        if (codeMatch) {
          parsed = JSON.parse(codeMatch[1]);
        } else {
          // 3. 직접 JSON
          parsed = JSON.parse(aiResponse);
        }
      }
    } catch (parseError) {
      console.error('❌ JSON 파싱 실패:', parseError);
      console.log('원본 응답:', aiResponse);

      return res.status(500).json({
        success: false,
        error: 'AI 응답 파싱 실패',
        details: parseError.message
      });
    }

    // explanation에서 JSON 제거 (안전장치)
    if (parsed.explanation && typeof parsed.explanation === 'string') {
      let cleanExplanation = parsed.explanation;
      cleanExplanation = cleanExplanation.replace(/```json\s*[\s\S]*?\s*```/g, '');
      cleanExplanation = cleanExplanation.replace(/```\s*[\s\S]*?\s*```/g, '');
      cleanExplanation = cleanExplanation.replace(/\{[\s\S]*?"understood"[\s\S]*?\}/g, '');
      cleanExplanation = cleanExplanation.replace(/\{[\s\S]*?"action"[\s\S]*?\}/g, '');
      cleanExplanation = cleanExplanation.replace(/\n{3,}/g, '\n\n').trim();

      if (!cleanExplanation || cleanExplanation.length < 5) {
        cleanExplanation = parsed.understood || '처리했습니다.';
      }

      parsed.explanation = cleanExplanation;
    }

    // 조건 기반 필터링 실행
    if (parsed.action === 'filter') {
      if (!parsed.conditions || !Array.isArray(parsed.conditions)) {
        console.error('❌ AI가 조건을 반환하지 않음:', parsed);
        parsed.action = 'question';
        parsed.filteredSchedules = [];
        parsed.explanation = '필터링 조건을 이해하지 못했습니다. 다시 시도해주세요.';
      } else {
        console.log('🔍 AI가 반환한 조건:', JSON.stringify(parsed.conditions, null, 2));

        // 조건에 따라 실제 필터링 수행
        let filteredSchedules = [];

        for (const condition of parsed.conditions) {
          filteredSchedules = applyCondition(filteredSchedules, condition, extractedSchedules);
        }

        console.log(`✅ 필터링 완료: ${extractedSchedules.length} → ${filteredSchedules.length}개`);
        parsed.filteredSchedules = filteredSchedules;
      }
    }

    res.json({
      success: true,
      understood: parsed.understood,
      action: parsed.action,
      filteredSchedules: parsed.filteredSchedules || [],
      explanation: parsed.explanation
    });

  } catch (error) {
    console.error('❌ OCR 채팅 필터링 에러:', error);
    res.status(500).json({
      success: false,
      error: 'OCR 채팅 필터링 실패',
      details: error.message
    });
  }
};
