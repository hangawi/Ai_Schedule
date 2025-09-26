import React from 'react';
import TimeSlot from './TimeSlot';

const dayNamesKorean = ['월', '화', '수', '목', '금'];

const WeekView = ({
  filteredTimeSlotsInDay,
  weekDates,
  days,
  getSlotOwner,
  isSlotSelected,
  getBlockedTimeInfo,
  getRoomExceptionInfo, // New prop
  isRoomOwner,
  currentUser,
  handleSlotClick,
  showMerged = true // New prop for merged view
}) => {

  // Debug log for WeekView props
  console.log('🔥 WeekView - Props received:', {
    showMerged,
    totalTimeSlots: filteredTimeSlotsInDay?.length,
    timeRange: `${filteredTimeSlotsInDay?.[0]} ~ ${filteredTimeSlotsInDay?.[filteredTimeSlotsInDay.length - 1]}`,
    timestamp: new Date().toISOString()
  });
  // 연속된 시간대를 자동으로 병합하는 함수
  const getMergedTimeBlocks = (dateInfo, dayIndex) => {
    const date = dateInfo.fullDate;
    const blocks = [];
    let currentBlock = null;

    for (const time of filteredTimeSlotsInDay) {
      const ownerInfo = getSlotOwner(date, time);
      const isSelected = isSlotSelected(date, time);
      const blockedInfo = getBlockedTimeInfo(time);
      const roomExceptionInfo = getRoomExceptionInfo(date, time);
      const isBlocked = !!(blockedInfo || roomExceptionInfo);

      // 현재 슬롯의 상태 결정 - 우선순위 개선
      let slotType = 'empty';
      let slotData = null;

      // 1순위: blocked 또는 room exception
      if (isBlocked) {
        slotType = 'blocked';
        let displayName = roomExceptionInfo ? roomExceptionInfo.name : blockedInfo?.name;

        // 방장 시간표의 경우 통일된 이름으로 표시
        if (displayName && displayName.includes('방장 시간표')) {
          displayName = '방장 시간표';
        }

        slotData = {
          name: displayName,
          info: roomExceptionInfo || blockedInfo,
          isRoomException: !!roomExceptionInfo,
          isRoomOwnerSchedule: displayName === '방장 시간표'
        };
      }
      // 2순위: owner가 있고 blocked가 아닌 경우 - 단, 방장 개인시간은 blocked로 처리
      else if (ownerInfo) {
        // 방장의 개인시간인지 확인 (방장이고 본인 슬롯인 경우 blocked로 처리)
        const isRoomOwnerPersonalTime = isRoomOwner &&
                                       (ownerInfo.actualUserId === currentUser?.actualUserId ||
                                        ownerInfo.userId === currentUser?.userId ||
                                        ownerInfo.name === currentUser?.name);

        if (isRoomOwnerPersonalTime) {
          slotType = 'blocked';
          slotData = {
            name: `${ownerInfo.name} (개인시간)`,
            info: ownerInfo,
            isRoomOwnerPersonal: true
          };
        } else {
          slotType = 'owner';
          slotData = ownerInfo;
        }
      }
      // 3순위: 선택된 슬롯 (blocked나 owner가 아닌 경우에만)
      else if (isSelected) {
        slotType = 'selected';
        slotData = null;
      }

      // 슬롯 분석 완료

      // 현재 블록과 같은 타입인지 확인 - 더 정확한 비교
      let isSameType = false;

      if (currentBlock && currentBlock.type === slotType) {
        if (slotType === 'empty') {
          isSameType = true;
        } else if (slotType === 'blocked') {
          // blocked 타입: 이름이 같으면 병합
          const currentName = currentBlock.data?.name || '';
          const newName = slotData?.name || '';

          // 방장 관련 시간 체크
          const currentIsRoomOwnerPersonal = currentBlock.data?.isRoomOwnerPersonal;
          const newIsRoomOwnerPersonal = slotData?.isRoomOwnerPersonal;
          const currentIsRoomOwnerSchedule = currentBlock.data?.isRoomOwnerSchedule;
          const newIsRoomOwnerSchedule = slotData?.isRoomOwnerSchedule;

          if ((currentIsRoomOwnerPersonal && newIsRoomOwnerPersonal) ||
              (currentIsRoomOwnerSchedule && newIsRoomOwnerSchedule)) {
            // 둘 다 방장 관련 시간이면 병합
            isSameType = true;
          } else {
            // 일반 blocked 시간은 이름이 정확히 같아야 병합
            isSameType = currentName === newName;
          }

          // 방장 시간표 병합 로직 완료
        } else if (slotType === 'owner') {
          // owner 타입: 같은 사용자면 병합
          const currentUserId = currentBlock.data?.actualUserId || currentBlock.data?.userId;
          const newUserId = slotData?.actualUserId || slotData?.userId;
          const currentUserName = currentBlock.data?.name;
          const newUserName = slotData?.name;

          isSameType = (currentUserId && newUserId && currentUserId === newUserId) ||
                       (currentUserName && newUserName && currentUserName === newUserName);

        } else if (slotType === 'selected') {
          isSameType = true;
        }
      }

      if (isSameType) {
        // 기존 블록 확장
        currentBlock.endTime = time;
        currentBlock.duration += 10;
        currentBlock.times.push(time);
      } else {
        // 새로운 블록 시작
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = {
          type: slotType,
          data: slotData,
          startTime: time,
          endTime: time,
          duration: 10,
          times: [time]
        };
      }
    }

    if (currentBlock) {
      blocks.push(currentBlock);
    }

    // 각 블록의 실제 끝시간 계산 (마지막 시간 + 10분)
    blocks.forEach(block => {
      const [hour, minute] = block.endTime.split(':').map(Number);
      const totalMinutes = hour * 60 + minute + 10;
      const endHour = Math.floor(totalMinutes / 60);
      const endMinute = totalMinutes % 60;
      block.actualEndTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
    });

    // 병합 블록 완성

    return blocks;
  };

  // 병합 모드 렌더링 함수 - 연속된 시간을 자동 병합
  const renderMergedView = () => {
    const rows = [];
    const processedTimes = new Set();

    // 각 날짜별로 병합된 블록 계산
    const dayBlocks = weekDates.map((dateInfo, dayIndex) =>
      getMergedTimeBlocks(dateInfo, dayIndex)
    );

    // 병합 모드에서는 각 블록의 시작 시간들만 행으로 생성
    const blockStartTimes = new Set();
    dayBlocks.forEach(blocks => {
      blocks.forEach(block => {
        blockStartTimes.add(block.startTime);
      });
    });

    for (const time of Array.from(blockStartTimes).sort()) {
      if (processedTimes.has(time)) {
        continue;
      }

      const rowCells = [];

      // 시간 컬럼
      rowCells.push(
        <div key="time" className="col-span-1 p-2 text-center text-sm font-medium text-gray-600 flex items-center justify-center">
          {time}
        </div>
      );

      // 각 날짜별로 셀 생성
      weekDates.forEach((dateInfo, dayIndex) => {
        const blocks = dayBlocks[dayIndex];
        const currentBlock = blocks.find(block => block.startTime === time);

        if (!currentBlock) {
          // 해당 시간에 시작하는 블록이 없음 - 빈 셀 추가 (높이는 행에서 통일됨)
          rowCells.push(
            <div key={`${dateInfo.fullDate.toISOString().split('T')[0]}-${time}-empty`} className="col-span-1 border-l border-gray-200 h-full"></div>
          );
          return;
        }

        // 블록 셀 생성 (이미 startTime === time인 블록만 찾았으므로)
        const date = dateInfo.fullDate;
        // 높이 계산: 10분 = 40px, 최소 40px
        // 24시간 모드에서는 높이 제한을 늘려서 긴 블록도 표시 가능하게 함
        const calculatedHeight = currentBlock.duration * 4;
        const maxHeight = filteredTimeSlotsInDay.length > 100 ? 2000 : 800; // 24시간 모드 대응
        const cellHeight = Math.min(Math.max(calculatedHeight, 40), maxHeight);

        rowCells.push(
            <div
              key={`${date.toISOString().split('T')[0]}-${time}`}
              className={`col-span-1 border-l border-gray-200 flex items-center justify-center
                ${currentBlock.type === 'blocked' ? 'bg-gray-300 cursor-not-allowed' : ''}
                ${currentBlock.type === 'selected' ? 'bg-blue-200 border-2 border-blue-400' : ''}
                ${currentBlock.type === 'empty' && currentUser ? 'hover:bg-blue-50 cursor-pointer' : ''}
                ${currentBlock.type === 'owner' && currentUser ? 'cursor-pointer hover:opacity-80' : ''}
                ${currentBlock.type === 'empty' && isRoomOwner ? 'cursor-pointer hover:bg-green-50' : ''}
              `}
              style={{
                height: '100%', // 행의 높이에 맞춤
                ...(currentBlock.type === 'owner' && currentBlock.data ? {
                  backgroundColor: `${currentBlock.data.color}20`,
                  borderColor: currentBlock.data.color
                } : {}),
                ...(currentBlock.type === 'blocked' && currentBlock.data?.isRoomException ? {
                  backgroundColor: '#FEEBC8',
                  borderColor: '#F6AD55'
                } : {})
              }}
              onClick={() => handleSlotClick(date, time)}
            >
              {currentBlock.type === 'blocked' ? (
                <span className="text-xs text-gray-600 font-medium" title={`${currentBlock.data?.name} (${currentBlock.startTime}~${currentBlock.actualEndTime})`}>
                  {currentBlock.data?.name.length > 8 ? currentBlock.data?.name.substring(0, 6) + '...' : currentBlock.data?.name}
                  <br />
                  {currentBlock.startTime}~{currentBlock.actualEndTime}
                </span>
              ) : currentBlock.type === 'owner' ? (
                <span
                  className="text-xs font-medium px-1 py-0.5 rounded"
                  style={{
                    color: currentBlock.data?.color,
                    backgroundColor: `${currentBlock.data?.color}10`
                  }}
                  title={`${currentBlock.data?.subject || currentBlock.data?.name} (${currentBlock.startTime}~${currentBlock.actualEndTime})`}
                >
                  {currentBlock.data?.name.length > 6 ? currentBlock.data?.name.substring(0, 4) + '...' : currentBlock.data?.name}
                  <br />
                  {currentBlock.startTime}~{currentBlock.actualEndTime}
                </span>
              ) : currentBlock.type === 'selected' ? (
                <span className="text-xs font-medium text-blue-700 px-1 py-0.5 rounded bg-blue-100">
                  선택됨
                  <br />
                  {currentBlock.startTime}~{currentBlock.actualEndTime}
                </span>
              ) : (
                <span className="text-xs text-gray-400">
                  {currentBlock.startTime}~{currentBlock.actualEndTime}
                </span>
              )}
            </div>
        );

        // 블록의 시작 시간을 처리됨으로 표시
        processedTimes.add(time);
      });

      // 행에 시간 컬럼 + 5개 날짜 셀이 모두 있어야 함
      if (rowCells.length === 6) { // 시간 컬럼(1) + 날짜 셀들(5)
        // 해당 행에서 가장 큰 블록의 높이 계산
        let maxRowHeight = 40; // 최소 높이
        weekDates.forEach((dateInfo, dayIndex) => {
          const blocks = dayBlocks[dayIndex];
          const currentBlock = blocks.find(block => block.startTime === time);
          if (currentBlock) {
            const calculatedHeight = currentBlock.duration * 4;
            const maxHeight = filteredTimeSlotsInDay.length > 100 ? 2000 : 800;
            const cellHeight = Math.min(Math.max(calculatedHeight, 40), maxHeight);
            maxRowHeight = Math.max(maxRowHeight, cellHeight);
          }
        });

        rows.push(
          <div key={time} className="grid grid-cols-6 border-b border-gray-200 last:border-b-0" style={{ minHeight: `${maxRowHeight}px` }}>
            {rowCells}
          </div>
        );
      }
    }
    return <>{rows}</>;
  };

  // 일반 모드 렌더링 함수
  const renderNormalView = () => {
    return (
      <>
        {filteredTimeSlotsInDay.map(time => (
          <div key={time} className="grid grid-cols-6 border-b border-gray-200 last:border-b-0">
            <div className="col-span-1 p-2 text-center text-sm font-medium text-gray-600 flex items-center justify-center">
              {time}
            </div>
            {weekDates.map((dateInfo, dayIndex) => {
              const date = dateInfo.fullDate;
              const ownerInfo = getSlotOwner(date, time);
              const isSelected = isSlotSelected(date, time);
              const blockedInfo = getBlockedTimeInfo(time);
              const roomExceptionInfo = getRoomExceptionInfo(date, time);
              const isBlocked = !!blockedInfo;
              return (
                <TimeSlot
                  key={`${date.toISOString().split('T')[0]}-${time}`}
                  date={date}
                  day={dayNamesKorean[dayIndex]}
                  time={time}
                  ownerInfo={ownerInfo}
                  isSelected={isSelected}
                  blockedInfo={blockedInfo}
                  roomExceptionInfo={roomExceptionInfo}
                  isBlocked={isBlocked}
                  isRoomOwner={isRoomOwner}
                  currentUser={currentUser}
                  onSlotClick={handleSlotClick}
                  showMerged={showMerged}
                />
              );
            })}
          </div>
        ))}
      </>
    );
  };

  return showMerged ? renderMergedView() : renderNormalView();
};

export default WeekView;
