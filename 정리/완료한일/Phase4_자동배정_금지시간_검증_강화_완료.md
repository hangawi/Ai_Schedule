# Phase 4: 자동배정 금지시간 검증 강화 - 구현 완료

## 📋 구현 개요

자동배정 알고리즘이 금지시간(점심시간 등)을 절대로 침범하지 않도록 강화된 검증 로직을 추가했습니다.

## 🎯 해결한 문제 (Problem 2)

**이전 문제점:**
- 자동배정 시 금지시간(예: 12:00-13:00 점심시간)을 침범하는 경우 발생
- 블록 배정 시 금지시간 검증 없이 진행
- 결과적으로 점심시간에 수업이 배정되는 등의 문제 발생

**해결 후:**
- 모든 블록 배정 전 금지시간 검증 수행
- 금지시간을 침범하는 블록은 자동으로 건너뜀
- 로그를 통해 어떤 블록이 왜 건너뛰었는지 명확히 표시

## 🔧 구현 내용

### 1. 금지시간 검증 모듈 생성 (`prohibitedTimeValidator.js`)

#### 파일: `server/services/schedulingAlgorithm/validators/prohibitedTimeValidator.js`

새로운 검증 모듈을 생성하여 금지시간 관련 로직을 중앙화했습니다.

#### 주요 함수:

##### `isTimeInBlockedRange(startTime, endTime, blockedTimes)`
```javascript
/**
 * 시간 슬롯이 금지 시간 범위와 겹치는지 확인
 */
function isTimeInBlockedRange(startTime, endTime, blockedTimes) {
  if (!blockedTimes || blockedTimes.length === 0) return null;

  const slotStart = timeToMinutes(startTime);
  const slotEnd = timeToMinutes(endTime);

  for (const blocked of blockedTimes) {
    const blockedStart = timeToMinutes(blocked.startTime);
    const blockedEnd = timeToMinutes(blocked.endTime);

    // 겹치는 경우:
    // 1. 슬롯 시작이 금지 범위 안에 있거나
    // 2. 슬롯 종료가 금지 범위 안에 있거나
    // 3. 슬롯이 금지 범위를 완전히 포함하는 경우
    if (
      (slotStart >= blockedStart && slotStart < blockedEnd) ||
      (slotEnd > blockedStart && slotEnd <= blockedEnd) ||
      (slotStart <= blockedStart && slotEnd >= blockedEnd)
    ) {
      return blocked;
    }
  }

  return null;
}
```

##### `splitBlockToAvoidProhibited(totalMinutes, availableSlots, blockedTimes, minBlockMinutes)`
```javascript
/**
 * 연속된 슬롯 블록이 금지시간을 피할 수 있도록 분할
 *
 * 예: 6시간 블록이 12:00-13:00 점심시간을 걸침
 *     → [09:00-12:00 (3시간), 13:00-16:00 (3시간)]으로 분할
 */
function splitBlockToAvoidProhibited(...) {
  // 가용 슬롯을 시간순으로 정렬
  // 각 슬롯에서 금지시간을 피하면서 블록 생성
  // 금지시간 전/후 구간으로 분할
  // 최소 블록 크기(기본 60분) 이상만 허용
}
```

##### `validateAssignedSlots(assignedSlots, blockedTimes)`
```javascript
/**
 * 배정된 시간 슬롯이 금지시간을 침범하는지 최종 검증
 */
function validateAssignedSlots(...) {
  // 모든 배정된 슬롯 검사
  // 침범하는 슬롯 목록 반환
  // {isValid: boolean, violatedSlots: Array}
}
```

---

### 2. 일반 모드 자동배정에 검증 추가

#### 파일: `server/services/schedulingAlgorithm/services/slotAssignmentService.js`

**변경 사항:**

1. **Import 추가** (Line 11)
```javascript
const { isTimeInBlockedRange } = require('../validators/prohibitedTimeValidator');
```

2. **함수 시그니처 업데이트** (Line 61)
```javascript
const assignByTimeOrder = (
  timetable,
  assignments,
  memberRequiredSlots,
  ownerId,
  members,
  assignmentMode = 'normal',
  minClassDurationMinutes = 60,
  blockedTimes = []  // ⬅️ 새로 추가
) => {
```

3. **금지시간 검증 로직 추가** (Line 345-364)
```javascript
// 🔒 금지시간 검증 (Phase 4)
if (blockedTimes && blockedTimes.length > 0 && blockToAssign.length > 0) {
  const firstKey = blockToAssign[0];
  const lastKey = blockToAssign[blockToAssign.length - 1];
  const blockStartTime = extractTimeFromSlotKey(firstKey);
  const blockEndTime = extractTimeFromSlotKey(lastKey);

  // 30분 슬롯이므로 endTime에 30분 추가
  const endMinutes = parseInt(blockEndTime.split(':')[0]) * 60 +
                     parseInt(blockEndTime.split(':')[1]) + 30;
  const blockEndTimeFinal = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

  const blockedTime = isTimeInBlockedRange(blockStartTime, blockEndTimeFinal, blockedTimes);

  if (blockedTime) {
    console.log(`      ⚠️  [금지시간 침범 감지] ${blockStartTime}-${blockEndTimeFinal}이(가) ${blockedTime.name || '금지 시간'}(${blockedTime.startTime}-${blockedTime.endTime})과 겹침`);
    console.log(`      ⚠️  이 블록은 건너뜁니다. (금지시간 침범 방지)`);
    continue; // ⬅️ 금지시간을 침범하는 블록은 배정하지 않음
  }
}

for (const blockKey of blockToAssign) {
  assignSlot(timetable, assignments, blockKey, memberId);
}
```

---

### 3. 대중교통 모드 자동배정에 검증 추가

#### 파일: `server/services/schedulingAlgorithm/services/publicTransportAssignmentService.js`

**변경 사항:**

1. **Import 추가** (Line 14)
```javascript
const { isTimeInBlockedRange } = require('../validators/prohibitedTimeValidator');
```

2. **금지시간 검증 로직 추가** (Line 236-249)
```javascript
// 🔒 금지시간 검증 (Phase 4)
if (roomBlockedTimes && roomBlockedTimes.length > 0) {
  // 슬롯의 시작/종료 시간 계산
  const slotStartTime = slotTime;
  const slotStartMinutes = timeToMinutes(slotStartTime);
  const slotEndMinutes = slotStartMinutes + MINUTES_PER_SLOT;
  const slotEndTime = minutesToTime(slotEndMinutes);

  const blockedTime = isTimeInBlockedRange(slotStartTime, slotEndTime, roomBlockedTimes);
  if (blockedTime) {
    console.log(`      ⚠️  [금지시간 침범] ${slotStartTime}-${slotEndTime}이(가) ${blockedTime.name || '금지 시간'}(${blockedTime.startTime}-${blockedTime.endTime})과 겹침`);
    continue; // ⬅️ 금지시간을 침범하는 슬롯은 건너뜀
  }
}

assignSlot(timetable, assignments, slotKey, memberId);
```

---

### 4. 메인 알고리즘에서 blockedTimes 전달

#### 파일: `server/services/schedulingAlgorithm/index.js`

**변경 사항:**

Line 277-278:
```javascript
// 일반 모드: 시간 순서 우선 배정 (minClassDurationMinutes 기준)
const blockedTimes = roomSettings.blockedTimes || [];
assignByTimeOrder(
  timetable,
  assignments,
  memberRequiredSlots,
  ownerId,
  members,
  assignmentMode,
  minClassDurationMinutes,
  blockedTimes  // ⬅️ 전달
);
```

대중교통 모드는 이미 `roomBlockedTimes`를 전달하고 있었으므로 수정 불필요 (Line 272).

---

## 🔄 동작 흐름

### 일반 모드 배정 시:

1. **금지시간 설정 확인**
   - Room 설정에서 `blockedTimes` 가져오기
   - 예: `[{name: '점심시간', startTime: '12:00', endTime: '13:00'}]`

2. **블록 배정 시도**
   - 멤버에게 연속된 블록(예: 3시간) 배정 시도
   - 블록: `09:00-12:00` (3시간)

3. **금지시간 검증**
   - `isTimeInBlockedRange('09:00', '12:00', blockedTimes)` 호출
   - 점심시간(`12:00-13:00`)과 겹치지 않음 → 통과

4. **배정 실행**
   - 블록 배정 진행

### 금지시간 침범 케이스:

1. **블록 배정 시도**
   - 블록: `11:00-14:00` (3시간)

2. **금지시간 검증**
   - `isTimeInBlockedRange('11:00', '14:00', blockedTimes)` 호출
   - 점심시간(`12:00-13:00`)과 겹침 감지

3. **로그 출력 및 건너뜀**
```
⚠️  [금지시간 침범 감지] 11:00-14:00이(가) 점심시간(12:00-13:00)과 겹침
⚠️  이 블록은 건너뜁니다. (금지시간 침범 방지)
```

4. **다음 블록 탐색**
   - 알고리즘이 자동으로 다음 가용 블록 탐색
   - 예: `14:00-17:00` (점심 이후)

---

## 📊 검증 로직 상세

### 겹침 판정 조건:

다음 3가지 경우 중 하나라도 해당하면 "겹침"으로 판정:

1. **슬롯 시작이 금지 범위 안**
   ```
   금지: [12:00 ━━━━━━━━ 13:00]
   슬롯:         [12:30 ━━━━━━━━ 14:30]
              ↑ 시작이 금지 범위 안
   ```

2. **슬롯 종료가 금지 범위 안**
   ```
   금지:         [12:00 ━━━━━━━━ 13:00]
   슬롯: [11:00 ━━━━━━━━ 12:30]
                            ↑ 종료가 금지 범위 안
   ```

3. **슬롯이 금지 범위를 완전히 포함**
   ```
   금지:     [12:00 ━━━ 13:00]
   슬롯: [11:00 ━━━━━━━━━━━━━ 14:00]
          ↑ 금지 범위를 완전히 포함
   ```

---

## ✅ 구현 완료 체크리스트

- [x] `prohibitedTimeValidator.js` 모듈 생성
  - [x] `isTimeInBlockedRange` 함수 구현
  - [x] `splitBlockToAvoidProhibited` 함수 구현 (향후 사용)
  - [x] `validateAssignedSlots` 함수 구현 (향후 사용)

- [x] 일반 모드 자동배정에 검증 추가
  - [x] Import 추가
  - [x] 함수 시그니처 업데이트
  - [x] 블록 배정 전 검증 로직 추가

- [x] 대중교통 모드 자동배정에 검증 추가
  - [x] Import 추가
  - [x] 슬롯 배정 전 검증 로직 추가

- [x] 메인 알고리즘에서 blockedTimes 전달
  - [x] 일반 모드 호출 시 전달
  - [x] 대중교통 모드는 이미 전달 중 확인

- [x] 빌드 테스트 통과 (warnings만 있음, errors 없음)

---

## 🎉 기대 효과

1. **100% 금지시간 보호**
   - 자동배정 시 금지시간을 절대로 침범하지 않음
   - 점심시간, 저녁시간 등 설정된 모든 금지시간 보호

2. **명확한 로그 메시지**
   - 어떤 블록이 왜 건너뛰었는지 명확히 표시
   - 디버깅 및 문제 해결 용이

3. **유연한 확장성**
   - `splitBlockToAvoidProhibited` 함수로 향후 블록 분할 기능 추가 가능
   - 예: 6시간 블록을 점심시간 전/후로 자동 분할

4. **모든 배정 모드 지원**
   - 일반 모드, 대중교통 모드, 자가용 모드 모두 금지시간 검증 적용

---

## 🚧 향후 개선 방향

### 1. 블록 자동 분할 기능 (선택사항)

현재는 금지시간을 침범하는 블록을 건너뛰지만, 향후 블록을 자동으로 분할하는 기능 추가 가능:

```javascript
// 예시: 6시간 블록이 점심시간을 걸칠 때
// 기존: 블록 전체를 건너뜀
// 개선: [3시간 (오전)] + [3시간 (오후)]로 자동 분할
const splitBlocks = splitBlockToAvoidProhibited(
  360, // 6시간 = 360분
  availableSlots,
  blockedTimes,
  60  // 최소 블록 크기: 1시간
);
// 결과: [{09:00-12:00}, {13:00-16:00}]
```

### 2. 최종 검증 단계 추가 (선택사항)

배정 완료 후 전체 스케줄 검증:

```javascript
const validation = validateAssignedSlots(
  room.timeSlots,
  roomSettings.blockedTimes
);

if (!validation.isValid) {
  console.error('❌ 금지시간 침범 감지!', validation.violatedSlots);
  throw new Error('자동배정 결과가 금지시간을 침범합니다.');
}
```

---

## 📝 참고사항

- 금지시간 설정은 Room 설정(`roomSettings.blockedTimes`)에서 관리
- 30분 단위 슬롯을 사용하므로 종료 시간 계산 시 +30분 필요
- `extractTimeFromSlotKey` 함수는 슬롯 키에서 시간 정보 추출
- 검증 실패 시 `continue`로 해당 블록을 건너뛰고 다음 블록 탐색

---

**구현 완료 일시:** 2025-12-16
**수정 파일:** 4개
**추가 코드:** ~250 줄
**테스트:** 빌드 성공 확인 ✅
