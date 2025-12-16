# Phase 6: 교환 승인 시 이동시간 재계산 - 구현 완료

## 📋 구현 개요

교환 요청(일반 교환, 연쇄 교환)이 승인되면 자동으로 이동시간을 재계산하여 순서 변경에 따른 이동시간 변화를 정확하게 반영합니다.

## 🎯 해결한 문제 (Problem 5)

**이전 문제점:**
- A(1번째, 집에서 1시간) ↔ B(2번째, A위치에서 10분) 교환 시
- 교환 후에도 A가 여전히 1시간, B가 10분으로 표시됨 (잘못된 이동시간)

**해결 후:**
- 교환 승인 시 즉시 재계산
- B가 1번째가 되므로 → B의 이동시간 = 집에서 1시간으로 변경
- A가 2번째가 되므로 → A의 이동시간 = B위치에서 10분으로 변경

## 🔧 구현 내용

### 1. 스케줄 재계산 서비스 강화 (`scheduleRecalculator.js`)

#### 기능:
- 특정 날짜의 모든 슬롯을 시간순으로 정렬
- 각 슬롯의 이동시간을 순서에 맞게 재계산
- 원본 시간을 보존하면서 조정된 시간을 업데이트
- 데이터베이스에 자동 저장

#### 주요 코드:
```javascript
// 📝 원본 시간 저장 (처음 조정될 때만)
if (!slot.originalStartTime) {
  slot.originalStartTime = slot.startTime;
  slot.originalEndTime = slot.endTime;
}

// ⏰ 이동시간을 고려한 시작 시간 재계산
const originalStartMinutes = timeToMinutes(slot.originalStartTime);
const travelStartMinutes = originalStartMinutes - travelTime;
const adjustedStartMinutes = Math.max(0, travelStartMinutes);

// 🔄 시간 업데이트
slot.startTime = adjustedStartTime;
slot.adjustedForTravelTime = true;

// 💾 데이터베이스에 저장
room.markModified('timeSlots');
await room.save();
```

### 2. 일반 교환 승인 시 재계산 (`coordinationExchangeRequestController.js`)

#### 위치: Line 1088-1112

```javascript
// 🔄 교환된 슬롯의 날짜에 대해 이동시간 재계산
const affectedDates = new Set();
affectedDates.add(new Date(request.targetSlot.date)); // 요청자가 이동한 날짜
affectedDates.add(new Date(alternativeSlot.date)); // 대상자가 이동한 날짜
requesterSlots.forEach(slot => affectedDates.add(new Date(slot.date))); // 요청자의 원래 슬롯 날짜들

console.log('🔄 재계산 시작: 영향받은 날짜', Array.from(affectedDates).map(d => d.toISOString().split('T')[0]));
await recalculateMultipleDates(roomId, Array.from(affectedDates));
console.log('✅ 이동시간 재계산 완료');

// 📡 Socket.io로 실시간 스케줄 업데이트 알림
const io = req.app.get('io');
if (io) {
  const updatedRoom = await Room.findById(roomId)
    .populate('timeSlots.user', '_id firstName lastName email');

  io.to(\`room-${roomId}\`).emit('scheduleUpdated', {
    roomId: roomId,
    message: '교환 승인으로 인해 이동시간이 재계산되었습니다.',
    timeSlots: updatedRoom.timeSlots,
    recalculatedDates: Array.from(affectedDates).map(d => d.toISOString().split('T')[0])
  });
}
```

### 3. 연쇄 교환 승인 시 재계산 (`coordinationExchangeRequestController.js`)

#### 위치: Line 1582-1607

연쇄 교환(A → B → C)은 3명의 위치가 모두 바뀌므로:
- A가 원하는 자리(B의 원래 위치)
- B가 이동한 자리(C의 원래 위치)
- C가 이동한 빈 자리

이 3개 날짜의 모든 슬롯에 대해 이동시간 재계산을 수행합니다.

```javascript
// 🔄 연쇄 교환된 슬롯의 날짜에 대해 이동시간 재계산
const affectedDates = new Set();
affectedDates.add(new Date(alternativeSlotForC.date)); // C가 이동한 날짜
affectedDates.add(new Date(request.chainData.chainSlot.date)); // B가 이동한 날짜
affectedDates.add(new Date(request.chainData.intermediateSlot.date)); // A가 이동한 날짜
request.requesterSlots.forEach(slot => affectedDates.add(new Date(slot.date))); // A의 원래 슬롯 날짜들

console.log('🔄 연쇄교환 재계산 시작: 영향받은 날짜', Array.from(affectedDates).map(d => d.toISOString().split('T')[0]));
await recalculateMultipleDates(roomId, Array.from(affectedDates));
console.log('✅ 연쇄교환 이동시간 재계산 완료');

// 📡 Socket.io 실시간 알림
// ... (일반 교환과 동일)
```

## 🔄 동작 흐름

### 일반 교환 예시:

1. **교환 전:**
   - 월요일 09:00: A (집→1시간) + B (A위치→10분)
   - A가 B와 자리 교환 요청

2. **교환 승인:**
   - 슬롯 스왑 실행 (A ↔ B 위치 교환)
   - `recalculateMultipleDates(['월요일'])` 호출

3. **재계산 과정:**
   - 월요일의 모든 슬롯을 시간순 정렬
   - 첫 번째 슬롯(현재 B): 집→1시간 계산
   - 두 번째 슬롯(현재 A): B위치→10분 계산
   - 각 슬롯의 `startTime` 업데이트 (originalStartTime은 보존)

4. **Socket.io 브로드캐스트:**
   - 방의 모든 멤버에게 'scheduleUpdated' 이벤트 전송
   - 프론트엔드에서 자동으로 최신 스케줄 반영

### 연쇄 교환 예시 (A → B → C):

1. **교환 전:**
   - 월요일 09:00: A (집→1시간)
   - 월요일 10:00: B (A위치→10분)
   - 월요일 11:00: C (B위치→5분)

2. **연쇄 교환 승인 (A가 B자리 원함):**
   - B → C의 자리로 이동
   - C → 빈 시간으로 이동
   - A → B의 원래 자리로 이동

3. **재계산 결과:**
   - 월요일 09:00: C (집→1시간) ← 새로운 첫 번째
   - 월요일 10:00: A (C위치→10분) ← B의 원래 자리로 이동
   - 월요일 11:00: B (A위치→5분) ← C의 원래 자리로 이동

## 📊 데이터 구조

### Room.timeSlots 스키마 변경 사항:

```javascript
{
  startTime: "08:00",           // 🔄 이동시간 포함한 조정된 시간
  endTime: "09:00",
  originalStartTime: "09:00",   // 📝 원본 시작 시간 (복원용)
  originalEndTime: "10:00",     // 📝 원본 종료 시간 (복원용)
  adjustedForTravelTime: true,  // ✅ 조정 여부 플래그
  location: { /* ... */ },      // 📍 위치 정보
  user: ObjectId,
  subject: "과목명",
  // ... 기타 필드
}
```

## ✅ 구현 완료 체크리스트

- [x] `scheduleRecalculator.js` 서비스 구현
  - [x] `recalculateScheduleForDate` - 단일 날짜 재계산
  - [x] `recalculateMultipleDates` - 여러 날짜 일괄 재계산
  - [x] 원본 시간 보존 로직
  - [x] 데이터베이스 자동 저장

- [x] 일반 교환 승인 시 재계산
  - [x] 영향받은 날짜 수집
  - [x] 재계산 서비스 호출
  - [x] Socket.io 실시간 알림

- [x] 연쇄 교환 승인 시 재계산
  - [x] 3명의 영향받은 날짜 모두 수집
  - [x] 재계산 서비스 호출
  - [x] Socket.io 실시간 알림

- [x] 빌드 테스트 통과 (warnings만 있음, errors 없음)

## 🎉 기대 효과

1. **정확한 이동시간 반영**: 순서 변경 시 즉시 재계산되어 항상 정확한 이동시간 표시
2. **실시간 동기화**: Socket.io를 통해 모든 방 멤버가 동시에 업데이트된 스케줄 확인
3. **데이터 일관성**: 원본 시간 보존으로 언제든지 일반 모드로 복원 가능
4. **자동화**: 수동 개입 없이 교환 승인 시 자동으로 모든 계산 처리

## 🚀 다음 단계

- **Phase 4 (보류)**: 자동배정 금지시간 검증 강화
- **사용자 테스트**: 실제 교환 시나리오 테스트 후 피드백 반영

## 📝 참고사항

- 이동시간 재계산은 `currentTravelMode` 또는 `confirmedTravelMode`가 설정된 경우에만 의미가 있습니다
- 일반 모드('normal')에서는 재계산이 수행되지 않습니다
- 재계산 중 오류가 발생해도 교환은 완료되며, 에러 로그만 기록됩니다
