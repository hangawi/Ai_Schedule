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

    return blocks;
  };

  // 병합 모드 렌더링 함수 - 각 날짜별 독립적 컬럼 렌더링
  const renderMergedView = () => {
    // 각 날짜별로 병합된 블록 계산
    const dayBlocks = weekDates.map((dateInfo, dayIndex) =>
      getMergedTimeBlocks(dateInfo, dayIndex)
    );

    // 시간 슬롯별 위치 계산을 위한 헬퍼 함수
    const getTimeSlotIndex = (time) => {
      return filteredTimeSlotsInDay.findIndex(slot => slot === time);
    };

    // 각 날짜별로 독립적인 렌더링 (행 기반이 아닌 컬럼 기반)
    return (
      <div className="flex">
        {/* 시간 컬럼은 전체 시간대 표시 */}
        <div className="w-12 flex-shrink-0">
          {filteredTimeSlotsInDay.map(time => (
            <div
              key={time}
              className="h-4 px-1 text-center text-xs font-medium text-gray-600 border-b border-gray-200 flex items-center justify-center"
            >
              {time}
            </div>
          ))}
        </div>

        {/* 각 날짜별 독립적 컬럼 */}
        {weekDates.slice(0, 5).map((dateInfo, dayIndex) => {
          const blocks = dayBlocks[dayIndex];
          const totalHeight = filteredTimeSlotsInDay.length * 16; // 전체 컬럼 높이 (h-4 = 16px)

          return (
            <div key={dayIndex} className="flex-1 border-l border-gray-200 relative" style={{ height: `${totalHeight}px` }}>
              {blocks.map((block, blockIndex) => {
                const date = dateInfo.fullDate;
                const blockHeight = block.duration * 1.6; // 10분 = 1.6px (16px/10)
                const startIndex = getTimeSlotIndex(block.startTime);
                const topPosition = startIndex * 16; // 각 시간 슬롯은 16px (h-4)

                return (
                  <div
                    key={`${date.toISOString().split('T')[0]}-${block.startTime}-${blockIndex}`}
                    className={`absolute left-0 right-0 border-b border-gray-200 flex items-center justify-center text-center px-0.5
                      ${block.type === 'blocked' ? 'bg-gray-300 cursor-not-allowed' : ''}
                      ${block.type === 'selected' ? 'bg-blue-200 border-2 border-blue-400' : ''}
                      ${block.type === 'empty' && currentUser ? 'hover:bg-blue-50 cursor-pointer' : ''}
                      ${block.type === 'owner' && currentUser ? 'cursor-pointer hover:opacity-80' : ''}
                      ${block.type === 'empty' && isRoomOwner ? 'cursor-pointer hover:bg-green-50' : ''}
                    `}
                    style={{
                      height: `${blockHeight}px`,
                      top: `${topPosition}px`,
                      ...(block.type === 'owner' && block.data ? {
                        backgroundColor: `${block.data.color}20`,
                        borderColor: block.data.color
                      } : {}),
                      ...(block.type === 'blocked' && block.data?.isRoomException ? {
                        backgroundColor: '#FEEBC8',
                        borderColor: '#F6AD55'
                      } : {})
                    }}
                    onClick={() => handleSlotClick(date, block.startTime)}
                  >
                    {block.type === 'blocked' ? (
                      <div className="text-xs text-gray-600 font-medium" title={`${block.data?.name} (${block.startTime}~${block.actualEndTime})`}>
                        <div className="text-xs leading-tight">{block.data?.name.length > 6 ? block.data?.name.substring(0, 4) + '...' : block.data?.name}</div>
                        {blockHeight > 20 && <div className="text-xs leading-tight">{block.startTime}~{block.actualEndTime}</div>}
                      </div>
                    ) : block.type === 'owner' ? (
                      <div
                        className="text-xs font-medium px-0.5 py-0.5 rounded"
                        style={{
                          color: block.data?.color,
                          backgroundColor: `${block.data?.color}10`
                        }}
                        title={`${block.data?.subject || block.data?.name} (${block.startTime}~${block.actualEndTime})`}
                      >
                        <div className="text-xs leading-tight">{block.data?.name.length > 4 ? block.data?.name.substring(0, 3) + '...' : block.data?.name}</div>
                        {blockHeight > 20 && <div className="text-xs leading-tight">{block.startTime}~{block.actualEndTime}</div>}
                      </div>
                    ) : block.type === 'selected' ? (
                      <div className="text-xs font-medium text-blue-700 px-0.5 py-0.5 rounded bg-blue-100">
                        <div className="text-xs leading-tight">선택됨</div>
                        {blockHeight > 20 && <div className="text-xs leading-tight">{block.startTime}~{block.actualEndTime}</div>}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">
                        <div className="text-xs leading-tight">빈 시간</div>
                        {blockHeight > 20 && <div className="text-xs leading-tight">{block.startTime}~{block.actualEndTime}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // 일반 모드 렌더링 함수
  const renderNormalView = () => {
    // 평일 5개만 확실히 사용
    const weekdays = weekDates.slice(0, 5);

    return (
      <>
        {filteredTimeSlotsInDay.map(time => (
          <div key={time} className="grid grid-cols-6 border-b border-gray-200 last:border-b-0">
            {/* 시간 컬럼 */}
            <div className="col-span-1 p-2 text-center text-sm font-medium text-gray-600 flex items-center justify-center">
              {time}
            </div>

            {/* 평일 5개 컬럼만 */}
            {weekdays.map((dateInfo, dayIndex) => {
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
