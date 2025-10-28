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
   - 첫 번째 행: 요일 (월, 화, 수, 목, 금, 토, 일 또는 월요일, 화요일...)
   - 첫 번째 열: 교시 번호(1, 2, 3...) 또는 시간대 (예: 09:00-09:50, 13:00-14:30)
   - **중요**:
     * 왼쪽에 시간이 있으면 그 시간을 사용
     * 왼쪽에 교시 번호만 있으면 아래 교시-시간 매핑표 사용!

2. **교시 번호 → 시간 변환** (초중고 공통):
   **매우 중요! 학교는 4교시 후 점심시간 1시간이 있습니다!**

   - 1교시: 09:00-09:50
   - 2교시: 10:00-10:50
   - 3교시: 11:00-11:50
   - 4교시: 12:00-12:50
   - **점심시간: 12:50-13:50 (1시간) - 무조건 추출!**
   - 5교시: 13:50-14:40
   - 6교시: 14:50-15:40
   - 7교시: 15:50-16:40

   **학교 시간표 처리 규칙**:
   - 1~4교시를 발견하면, 무조건 4교시 종료 시간부터 1시간 점심시간 추가
   - 5교시 이후는 점심시간 1시간을 고려해서 시간 조정
   - 예: 원본이 "5교시 13:00-13:50"이라고 되어 있어도, 점심시간 1시간 후인 "13:50-14:40"으로 변환

   **예시**:
   - 왼쪽 열에 "1"만 있고 월요일 셀에 "도덕" → {"title": "도덕", "days": ["월"], "startTime": "09:00", "endTime": "09:50"}
   - 왼쪽 열에 "4"만 있고 화요일 셀에 "수학" → {"title": "수학", "days": ["화"], "startTime": "12:00", "endTime": "12:50"}
   - **4교시 다음은 무조건 점심시간** → {"title": "점심시간", "days": ["월", "화", "수", "목", "금"], "startTime": "12:50", "endTime": "13:50"}
   - 왼쪽 열에 "5"만 있고 수요일 셀에 "영어" → {"title": "영어", "days": ["수"], "startTime": "13:50", "endTime": "14:40"}

3. **셀 내용 읽기**:
   - 각 셀에 과목명만 있음: title에 과목명 사용
   - 각 셀에 2줄로 표시될 수 있음: 첫 줄 = 수업명, 둘째 줄 = 강사명
   - 예시: 셀에 "도덕" → title: "도덕"
   - 예시: 셀에 "주니어A\n사랑T" → title: "주니어A", instructor: "사랑T"

4. **시간대별 일정 추출** (매우 중요!):
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

5. **중복/선택 수업 처리**:
   - 같은 시간대, 같은 요일에 여러 셀이 있으면 각각 별도 일정으로 추출
   - **반드시 instructor(강사명)를 포함**해서 구분 가능하게!

6. **시간 처리** (매우 중요!):
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
- **점심시간은 학교 시간표에서 절대 생략하면 안됨!**
  * 학교 시간표 (1교시~7교시)가 보이면, 4교시 종료 시간부터 5교시 시작 시간까지를 점심시간으로 추출
  * 4교시 끝나는 시간 확인 → 5교시 시작 시간 확인 → 그 사이가 점심시간
  * 예시 1: 4교시가 12:10 끝, 5교시가 13:00 시작 → {"title": "점심시간", "days": ["월", "화", "수", "목", "금"], "startTime": "12:10", "endTime": "13:00"}
  * 예시 2: 4교시가 12:50 끝, 5교시가 13:00 시작 → {"title": "점심시간", "days": ["월", "화", "수", "목", "금"], "startTime": "12:50", "endTime": "13:00"}
  * **무조건 추출!** 학교 시간표에 4교시와 5교시가 있으면 반드시 점심시간도 있음
- 짧은 쉬는시간(10분 이하)은 제외
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

**시간 변환 규칙 (매우 중요!)**:
- "1시 PM" 또는 "오후 1시" → "13:00"
- "2시 PM" 또는 "오후 2시" → "14:00"
- "3시 PM" 또는 "오후 3시" → "15:00"
- "12시 PM" 또는 "오후 12시" → "12:00" (정오)
- "1시 AM" 또는 "오전 1시" → "01:00"
- "12시 AM" 또는 "오전 12시" → "00:00" (자정)
- **PM이 있으면 반드시 12를 더해야 함** (단, 12시 PM은 12:00 그대로)
- **AM이 있으면 그대로 사용** (단, 12시 AM은 00:00)

예시:
- "1시~2시 PM" → startTime: "13:00", endTime: "14:00"
- "5시~6시30분 PM" → startTime: "17:00", endTime: "18:30"
- "오후 3시~4시30분" → startTime: "15:00", endTime: "16:30"

**절대 오전(00:00~11:59)에 학원/축구 수업이 있을 수 없음**.
PM이나 오후가 보이면 반드시 13:00 이후로 변환!

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

    // 점심시간 자동 감지 및 추가
    const addLunchTimeIfMissing = (schedules) => {
      // 4교시와 5교시 찾기
      const period4 = schedules.find(s => s.title && (s.title.includes('4교시') || s.endTime === '12:50' || s.endTime === '12:10'));
      const period5 = schedules.find(s => s.title && (s.title.includes('5교시') || s.startTime === '13:00' || s.startTime === '13:40'));

      // 점심시간이 이미 있는지 확인
      const hasLunch = schedules.some(s => s.title && s.title.includes('점심'));

      // 4교시와 5교시가 있고, 점심시간이 없으며, 둘 사이에 시간 간격이 있으면 점심시간 추가
      if (period4 && period5 && !hasLunch) {
        const period4End = period4.endTime;
        const period5Start = period5.startTime;

        // 시간 차이 계산 (30분 이상이면 점심시간으로 간주)
        const timeDiff = timeToMinutes(period5Start) - timeToMinutes(period4End);

        if (timeDiff >= 30) {
          const lunchTime = {
            title: '점심시간',
            days: period4.days || ['월', '화', '수', '목', '금'],
            startTime: period4End,
            endTime: period5Start
          };
          schedules.push(lunchTime);
          console.log('🍱 점심시간 자동 추가:', lunchTime);
        }
      }
    };

    const timeToMinutes = (time) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    addLunchTimeIfMissing(allSchedules);

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
