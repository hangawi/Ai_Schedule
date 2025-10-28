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
      "endTime": "HH:MM" 형식의 종료 시간,
      "instructor": "강사명 (있으면)",
      "classroom": "교실/반 이름 (있으면)",
      "description": "추가 정보"
    }
  ]
}

**그리드 시간표 인식 방법 (매우 중요!)**:

1. **시간표 구조 분석**:
   - 첫 번째 행: 요일 (월요일, 화요일, 수요일, 목요일, 금요일, 토요일, 일요일)
   - 첫 번째 열: 시간대 (예: 13:00-14:30, 15:00-16:00, 16:10-17:00)
   - **중요**: 왼쪽 시간 열을 반드시 읽고 정확한 시간 사용!

2. **셀 내용 읽기**:
   - 각 셀에 2줄로 표시될 수 있음: 첫 줄 = 수업명, 둘째 줄 = 강사명
   - 예시: 셀에 "주니어A\n사랑T" → title: "주니어A", instructor: "사랑T"
   - 예시: 셀에 "키즈KPOP\n사랑T" → title: "키즈KPOP", instructor: "사랑T"
   - 예시: 셀에 "KPOP\n린아T" → title: "KPOP", instructor: "린아T"

3. **시간대별 일정 추출** (매우 중요!):
   - **각 행의 시간대를 정확히 사용하세요!**
   - 셀이 여러 행에 걸쳐 있어도 **각 시간대별로 별도의 일정으로 추출**

   예시:
   - "13:00-14:30" 행, "토요일" 열, 셀 내용 "주말 KPOP\n시랑T"
     → {"title": "주말 KPOP", "days": ["토"], "startTime": "13:00", "endTime": "14:30", "instructor": "시랑T"}

   - "15:00-16:00" 행, "월요일" 열, 셀 내용 "주니어A\n사랑T"
     → {"title": "주니어A", "days": ["월"], "startTime": "15:00", "endTime": "16:00", "instructor": "사랑T"}

   - 만약 "키즈KPOP" 셀이 16:10-17:00, 17:00-18:00 두 행에 걸쳐 있으면:
     → {"title": "키즈KPOP", "days": ["월"], "startTime": "16:10", "endTime": "17:00", "instructor": "사랑T"}
     → {"title": "키즈KPOP", "days": ["월"], "startTime": "17:00", "endTime": "18:00", "instructor": "사랑T"}
     (두 개의 별도 일정으로 추출!)

4. **중복/선택 수업 처리**:
   - 같은 시간대, 같은 요일에 여러 셀이 있으면 각각 별도 일정으로 추출
   - **반드시 instructor(강사명)를 포함**해서 구분 가능하게!

5. **시간 처리** (매우 중요!):
   - 왼쪽 열의 시간을 **정확히** 사용 (예: "20:20-21:30" → startTime: "20:20", endTime: "21:30")
   - 모든 시간을 24시간 형식으로 (13:00, 19:10, 20:20, 21:40, 22:10 등)
   - **셀이 병합되어 여러 시간대를 차지하는 경우**: 각 시간대별로 별도 일정 생성!
     예: "키즈KPOP" 셀이 16:10부터 19:00까지 차지하면
     → 16:10-17:00 일정 1개
     → 17:00-18:00 일정 1개
     → 18:00-19:00 일정 1개
     (총 3개의 별도 일정으로 추출!)

**중요**:
- 빈 셀은 무시
- 점심시간, 휴식시간은 제외
- 모든 시간을 그리드 왼쪽 열에서 읽어서 사용
- 강사명(instructor)을 반드시 추출해서 같은 수업명도 구분 가능하게!

요일 매핑:
- "월요일" → ["월"]
- "화요일" → ["화"]
- "수요일" → ["수"]
- "목요일" → ["목"]
- "금요일" → ["금"]
- "토요일" → ["토"]
- "일요일" → ["일"]

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
