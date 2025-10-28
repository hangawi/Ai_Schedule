# OCR 시간표 추출 기능 통합 가이드

## 개요
이 가이드는 ChatBox 컴포넌트에 OCR 시간표 추출 기능을 통합하는 방법을 설명합니다.

## 생성된 파일들

### 1. 클라이언트 파일
- `client/src/utils/ocrUtils.js` - OCR 관련 유틸리티 함수들
- `client/src/components/modals/ScheduleOptimizationModal.js` - 최적 시간표 예시 모달
- `client/src/components/chat/TimetableUploadBox.js` - 시간표 이미지 업로드 컴포넌트

### 2. 서버 파일
- `server/controllers/ocrController.js` - OCR 처리 컨트롤러
- `server/routes/ocr.js` - OCR API 라우트
- `server/index.js` - OCR 라우트 등록 완료

## ChatBox 통합 방법

### 1. TimetableUploadBox import 추가

ChatBox.js 파일 상단에 다음을 추가:

```javascript
import TimetableUploadBox from './TimetableUploadBox';
import ScheduleOptimizationModal from '../modals/ScheduleOptimizationModal';
```

### 2. 상태 추가

ChatBox 컴포넌트의 useState 섹션에 다음을 추가:

```javascript
const [showTimetableUpload, setShowTimetableUpload] = useState(false);
const [showScheduleModal, setShowScheduleModal] = useState(false);
const [extractedScheduleData, setExtractedScheduleData] = useState(null);
```

### 3. 시간표 처리 핸들러 추가

```javascript
const handleSchedulesExtracted = async (result) => {
  if (result.type === 'ask_show_examples') {
    // 사용자에게 예시를 보여줄지 물어봄
    const botMessage = {
      id: Date.now(),
      text: `총 ${result.data.schedules.length}개의 시간표를 찾았고, ${result.data.conflicts.length}개의 충돌이 있습니다.\n최적으로 짠 시간표 예시를 보시겠습니까?`,
      sender: 'bot',
      timestamp: new Date(),
      _nextStep: 'show_schedule_examples',
      _scheduleData: result.data
    };
    setMessages(prev => [...prev, botMessage]);
    setExtractedScheduleData(result.data);
    setShowTimetableUpload(false);

  } else if (result.type === 'schedules_extracted') {
    // 충돌이 없어서 바로 적용
    const schedules = result.data.schedules;
    // 여기서 schedules를 사용자의 일정에 추가하는 로직 구현
    const botMessage = {
      id: Date.now(),
      text: `${schedules.length}개의 시간표를 성공적으로 추출했습니다!`,
      sender: 'bot',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, botMessage]);
    setShowTimetableUpload(false);

    // 실제로 일정 추가하는 API 호출
    // await addSchedulesToCalendar(schedules);

  } else if (result.type === 'schedule_selected') {
    // 사용자가 최적 조합 중 하나를 선택함
    const schedules = result.schedules;
    const botMessage = {
      id: Date.now(),
      text: `선택하신 시간표(${schedules.length}개)를 일정에 추가했습니다!`,
      sender: 'bot',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, botMessage]);

    // 실제로 일정 추가하는 API 호출
    // await addSchedulesToCalendar(schedules);
  }
};

const handleUserMessage = async (text) => {
  // 기존 handleSendMessage 로직...

  // 예시를 보겠다고 답한 경우 처리
  const lastBotMessage = messages.filter(m => m.sender === 'bot').pop();

  if (lastBotMessage?._nextStep === 'show_schedule_examples') {
    const userResponse = text.trim().toLowerCase();

    if (userResponse.includes('예') || userResponse.includes('네') ||
        userResponse.includes('yes') || userResponse.includes('보여')) {
      // 모달 표시
      setShowScheduleModal(true);
      const botMessage = {
        id: Date.now(),
        text: '최적 시간표 예시를 보여드립니다.',
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
      return;
    } else {
      // 사용자가 거절한 경우
      const botMessage = {
        id: Date.now(),
        text: '알겠습니다. 원본 시간표를 그대로 적용하시겠습니까?',
        sender: 'bot',
        timestamp: new Date(),
        _nextStep: 'apply_original_schedule'
      };
      setMessages(prev => [...prev, botMessage]);
      return;
    }
  }

  // 나머지 기존 로직...
};
```

### 4. UI에 시간표 업로드 버튼 추가

ChatBox 렌더링 부분의 입력창 근처에 버튼 추가:

```jsx
{/* 입력 영역 */}
<div className="border-t border-gray-200 p-4 bg-white">
  <div className="flex items-center space-x-2 mb-2">
    <button
      onClick={() => setShowTimetableUpload(true)}
      className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium flex items-center"
    >
      <Calendar size={16} className="mr-2" />
      시간표 업로드
    </button>
  </div>

  {/* 기존 입력창 */}
  <div className="flex items-center space-x-2">
    {/* ... 기존 입력 UI ... */}
  </div>
</div>
```

### 5. 모달 렌더링

ChatBox return 문 마지막에 추가:

```jsx
return (
  <>
    {/* 기존 ChatBox UI */}
    <div className="...">
      {/* ... 기존 코드 ... */}
    </div>

    {/* 시간표 업로드 모달 */}
    {showTimetableUpload && (
      <TimetableUploadBox
        onSchedulesExtracted={handleSchedulesExtracted}
        onClose={() => setShowTimetableUpload(false)}
      />
    )}

    {/* 최적 시간표 모달 */}
    {showScheduleModal && extractedScheduleData && (
      <ScheduleOptimizationModal
        combinations={extractedScheduleData.optimalCombinations}
        onSelect={(schedules) => {
          handleSchedulesExtracted({
            type: 'schedule_selected',
            schedules: schedules,
            data: extractedScheduleData
          });
          setShowScheduleModal(false);
        }}
        onClose={() => setShowScheduleModal(false)}
        userAge={extractedScheduleData.age}
        gradeLevel={extractedScheduleData.gradeLevel}
      />
    )}
  </>
);
```

## API 엔드포인트

### 1. 단일 이미지 OCR
```
POST /api/ocr/extract
Content-Type: multipart/form-data
Header: x-auth-token

Body:
- image: File (이미지 파일)

Response:
{
  "success": true,
  "text": "추출된 텍스트",
  "fileName": "파일명"
}
```

### 2. 시간표 이미지 분석 (구조화된 데이터)
```
POST /api/ocr/analyze-schedule
Content-Type: multipart/form-data
Header: x-auth-token

Body:
- images[]: File[] (이미지 파일 배열, 최대 10개)
- birthdate: string (선택, YYYY-MM-DD 형식)

Response:
{
  "success": true,
  "allSchedules": [
    {
      "title": "수학",
      "gradeLevel": "중등부",
      "days": ["월", "수", "금"],
      "startTime": "14:00",
      "endTime": "15:00",
      "instructor": "김선생님",
      "classroom": "A반",
      "description": "추가정보"
    }
  ],
  "totalSchedules": 5
}
```

## 주요 기능

### 1. 다중 이미지 처리
- 최대 10개의 시간표 이미지를 동시에 업로드 가능
- 각 이미지에서 독립적으로 시간표 정보 추출

### 2. 요일 패턴 인식
- "주3회(월,수,금)" → ["월", "수", "금"]
- "주2회(화,목)" → ["화", "목"]
- "월,수,금" → ["월", "수", "금"]

### 3. 학년부 자동 필터링
- 사용자의 생년월일로부터 나이 계산
- 나이에 따라 초등부/중등부/고등부 판단
- 해당 학년부의 시간표만 추출

### 4. 수업 시간 자동 추론
- 시간표에 수업 종료 시간이 없는 경우
- 학년부에 따라 일반적인 수업 시간 자동 적용
  - 초등부: 40분
  - 중등부: 50분
  - 고등부: 60분

### 5. 시간표 충돌 감지 및 해결
- 여러 시간표에서 겹치는 시간 자동 감지
- 충돌 없는 최적 조합 자동 생성 (최대 5개)
- 시간표 예시를 모달로 보여주고 선택 가능

### 6. 주간 시간표 시각화
- 요일별로 그룹화된 시간표
- 시간순으로 정렬
- 과목, 시간, 강사, 교실 정보 표시

## 사용 시나리오

### 시나리오 1: 충돌이 없는 경우
1. 사용자가 "시간표 업로드" 버튼 클릭
2. 1개 이상의 시간표 이미지 선택
3. "시간표 추출하기" 버튼 클릭
4. OCR 처리 및 시간표 추출
5. 충돌이 없으면 바로 "추출 완료" 메시지
6. 일정에 자동 추가

### 시나리오 2: 충돌이 있는 경우
1. 사용자가 "시간표 업로드" 버튼 클릭
2. 여러 개의 시간표 이미지 선택
3. "시간표 추출하기" 버튼 클릭
4. OCR 처리 및 시간표 추출
5. 충돌 감지됨
6. 챗봇: "충돌이 있습니다. 최적 시간표 예시를 보시겠습니까?"
7. 사용자: "네"
8. 최적 시간표 모달 표시
9. 사용자가 원하는 조합 선택
10. 선택한 시간표가 일정에 추가

## 환경 변수

.env 파일에 다음 설정 필요:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

## 의존성

### 클라이언트
- lucide-react (아이콘)
- React 18+

### 서버
- @google/generative-ai (Gemini Vision API)
- multer (파일 업로드)
- express
- mongoose

## 테스트

1. 사용자 프로필에서 생년월일 입력 확인
2. 시간표 이미지 준비 (학원 시간표, 학습 계획표 등)
3. ChatBox에서 "시간표 업로드" 버튼 클릭
4. 이미지 선택 및 업로드
5. 추출 결과 확인
6. 충돌이 있으면 최적 조합 확인
7. 일정 추가 확인

## 향후 개선 사항

1. 시간표를 실제 캘린더 일정으로 자동 변환
2. 반복 일정 생성 (매주 월/수/금 등)
3. 시간표 수정 UI
4. 시간표 저장/불러오기
5. 여러 학원 시간표 통합 관리
6. OCR 정확도 개선을 위한 이미지 전처리
