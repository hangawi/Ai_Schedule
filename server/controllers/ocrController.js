const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');

// Gemini AI 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Multer 설정 (메모리 저장)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 제한
  },
  fileFilter: (req, file, cb) => {
    // 이미지 파일만 허용
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  }
}).array('images', 10); // 최대 10개 이미지

/**
 * 이미지에서 OCR 텍스트 추출
 */
exports.extractTextFromImage = async (req, res) => {
  try {
    // 파일이 없는 경우
    if (!req.file) {
      return res.status(400).json({ error: '이미지 파일이 필요합니다.' });
    }

    const imageBuffer = req.file.buffer;
    const mimeType = req.file.mimetype;

    // Gemini Vision API로 OCR 수행
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const imageParts = [
      {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: mimeType,
        },
      },
    ];

    const prompt = `
이 이미지에서 모든 텍스트를 추출해주세요.
특히 다음 정보에 주의해서 추출해주세요:
- 학원/학습 시간표
- 과목명
- 요일 정보 (예: 월, 화, 수, 목, 금, 토, 일 또는 "주3회(월,수,금)" 형식)
- 시간 정보 (시작 시간 - 종료 시간)
- 학년부 정보 (초등부, 중등부, 고등부)
- 강사명 또는 반 이름

추출한 텍스트를 그대로 반환해주세요.
`;

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    res.json({
      success: true,
      text: text,
      fileName: req.file.originalname,
    });

  } catch (error) {
    console.error('OCR 처리 에러:', error);
    res.status(500).json({
      error: 'OCR 처리 중 오류가 발생했습니다.',
      details: error.message,
    });
  }
};

/**
 * 여러 이미지에서 OCR 텍스트 추출
 */
exports.extractTextFromImages = async (req, res) => {
  try {
    // 파일이 없는 경우
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '최소 1개 이상의 이미지 파일이 필요합니다.' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const results = [];

    // 각 이미지에서 OCR 수행
    for (const file of req.files) {
      try {
        const imageBuffer = file.buffer;
        const mimeType = file.mimetype;

        const imageParts = [
          {
            inlineData: {
              data: imageBuffer.toString('base64'),
              mimeType: mimeType,
            },
          },
        ];

        const prompt = `
이 이미지에서 모든 텍스트를 추출해주세요.
특히 다음 정보에 주의해서 추출해주세요:
- 학원/학습 시간표
- 과목명
- 요일 정보 (예: 월, 화, 수, 목, 금, 토, 일 또는 "주3회(월,수,금)" 형식)
- 시간 정보 (시작 시간 - 종료 시간)
- 학년부 정보 (초등부, 중등부, 고등부)
- 강사명 또는 반 이름

추출한 텍스트를 그대로 반환해주세요.
`;

        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        const text = response.text();

        results.push({
          success: true,
          text: text,
          fileName: file.originalname,
        });

      } catch (error) {
        console.error(`이미지 처리 실패 (${file.originalname}):`, error);
        results.push({
          success: false,
          error: error.message,
          fileName: file.originalname,
        });
      }
    }

    res.json({
      success: true,
      results: results,
      totalProcessed: req.files.length,
      successCount: results.filter(r => r.success).length,
    });

  } catch (error) {
    console.error('OCR 처리 에러:', error);
    res.status(500).json({
      error: 'OCR 처리 중 오류가 발생했습니다.',
      details: error.message,
    });
  }
};

/**
 * 시간표 이미지 분석 및 구조화된 데이터 반환
 */
exports.analyzeScheduleImages = async (req, res) => {
  try {
    // 파일이 없는 경우
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '최소 1개 이상의 이미지 파일이 필요합니다.' });
    }

    const { birthdate } = req.body;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const scheduleResults = [];

    console.log(`📸 총 ${req.files.length}개의 이미지 처리 시작...`);

    // 각 이미지에서 시간표 정보 추출
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      try {
        console.log(`🔄 [${i + 1}/${req.files.length}] ${file.originalname} 처리 중...`);

        const imageBuffer = file.buffer;
        const mimeType = file.mimetype;

        const imageParts = [
          {
            inlineData: {
              data: imageBuffer.toString('base64'),
              mimeType: mimeType,
            },
          },
        ];

        const prompt = `
이 이미지는 학원 또는 학습 시간표입니다.
다음 정보를 JSON 형식으로 추출해주세요:

{
  "schedules": [
    {
      "title": "과목명 또는 수업명",
      "gradeLevel": "초등부|중등부|고등부 (없으면 null)",
      "days": ["월", "수", "금"] 형식의 요일 배열,
      "startTime": "HH:MM" 형식의 시작 시간,
      "endTime": "HH:MM" 형식의 종료 시간 (없으면 null),
      "instructor": "강사명 (있으면)",
      "classroom": "교실/반 이름 (있으면)",
      "description": "추가 정보"
    }
  ]
}

**중요**: 다음 항목들은 수업이 아니므로 반드시 제외해주세요:
- 점심시간, 점심, lunch, 식사시간
- 쉬는시간, 휴식시간, break
- 조회, 종례, 청소시간
- 기타 수업이 아닌 시간

요일은 다음과 같이 처리해주세요:
- "주3회(월,수,금)" → ["월", "수", "금"]
- "주2회(화,목)" → ["화", "목"]
- "월,수" → ["월", "수"]

시간은 24시간 형식으로 변환해주세요:
- "오후 2시" → "14:00"
- "오전 10시 30분" → "10:30"

**각 수업의 시작시간과 종료시간을 정확히 분리해주세요**:
- 만약 "10:50~11:30 3교시, 11:30~12:20 점심시간"이라면
  → 3교시는 "startTime": "10:50", "endTime": "11:30"으로만 추출하고
  → 점심시간은 제외

반드시 유효한 JSON만 반환하고, 다른 설명은 포함하지 마세요.
`;

        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        let text = response.text();

        console.log(`✅ [${i + 1}/${req.files.length}] ${file.originalname} OCR 완료`);
        console.log(`📝 Gemini 응답 원본:\n${text.substring(0, 500)}...`);

        // JSON 파싱
        // Gemini가 마크다운 코드 블록으로 감쌀 수 있으므로 제거
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        let parsedSchedules;
        try {
          parsedSchedules = JSON.parse(text);
          console.log(`📊 [${i + 1}/${req.files.length}] ${parsedSchedules.schedules?.length || 0}개의 시간표 발견`);
          if (parsedSchedules.schedules?.length > 0) {
            console.log(`📋 첫 번째 시간표:`, JSON.stringify(parsedSchedules.schedules[0], null, 2));
          }
        } catch (parseError) {
          console.error(`❌ [${i + 1}/${req.files.length}] JSON 파싱 실패:`, parseError.message);
          console.error(`원본 텍스트:`, text);
          parsedSchedules = { schedules: [] };
        }

        scheduleResults.push({
          success: true,
          fileName: file.originalname,
          schedules: parsedSchedules.schedules || [],
        });

      } catch (error) {
        console.error(`이미지 분석 실패 (${file.originalname}):`, error);
        scheduleResults.push({
          success: false,
          error: error.message,
          fileName: file.originalname,
          schedules: [],
        });
      }
    }

    // 모든 시간표를 하나로 합치기
    const allSchedules = scheduleResults.flatMap(r => r.schedules || []);

    console.log(`🎉 모든 이미지 처리 완료! 총 ${allSchedules.length}개의 시간표 추출`);

    const responseData = {
      success: true,
      allSchedules: allSchedules,
      totalSchedules: allSchedules.length,
    };

    console.log('📤 응답 전송 중... (데이터 크기:', JSON.stringify(responseData).length, 'bytes)');

    res.json(responseData);

    console.log('✅ 응답 전송 완료!');

  } catch (error) {
    console.error('시간표 분석 에러:', error);
    res.status(500).json({
      error: '시간표 분석 중 오류가 발생했습니다.',
      details: error.message,
    });
  }
};

// Multer 미들웨어 export
exports.uploadMiddleware = upload;
