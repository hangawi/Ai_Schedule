import React from 'react';
import TimeSlot from './TimeSlot';

const dayNamesKorean = ['월', '화', '수', '목', '금'];

// ScheduleGridSelector의 로직을 참고한 시간 변환 함수들
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

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
  showMerged = true, // New prop for merged view
  ownerOriginalSchedule // 방장의 원본 시간표 데이터
}) => {
  // 방장의 원본 시간표에서 해당 시간대의 일정을 확인하는 함수
  const getOwnerOriginalScheduleInfo = (date, time) => {
    if (!ownerOriginalSchedule) return null; // 방장뿐만 아니라 모든 조원이 볼 수 있도록 isRoomOwner 체크 제거

    const timeMinutes = timeToMinutes(time);
    const dayOfWeek = date.getDay(); // 0=일요일, 1=월요일, ...
    const dateStr = date.toISOString().split('T')[0];

    // 디버깅용 로그 (월요일 13:00만 출력)
    if (dayOfWeek === 1 && time === '13:00') {
      console.log('🔍 getOwnerOriginalScheduleInfo 호출:', {
        time,
        dayOfWeek,
        dateStr,
        ownerOriginalSchedule: {
          hasDefaultSchedule: !!ownerOriginalSchedule.defaultSchedule,
          defaultScheduleLength: ownerOriginalSchedule.defaultSchedule?.length,
          defaultSchedule: ownerOriginalSchedule.defaultSchedule
        }
      });
    }

    // scheduleExceptions 확인 (특정 날짜 일정)
    const exceptionSlot = ownerOriginalSchedule.scheduleExceptions?.find(e => {
      if (e.specificDate !== dateStr) return false;

      const startDate = new Date(e.startTime);
      const endDate = new Date(e.endTime);
      const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
      const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();

      const isMatch = timeMinutes >= startMinutes && timeMinutes < endMinutes;
      return isMatch;
    });

    if (exceptionSlot) {
      return {
        ...exceptionSlot,
        type: 'exception',
        name: `${exceptionSlot.title || '일정'} (방장)`
      };
    }

    // personalTimes 확인 (반복 개인시간 + 특정 날짜 개인시간)
    const personalSlot = ownerOriginalSchedule.personalTimes?.find(p => {
      // 반복되는 개인시간 처리
      const personalDays = p.days || [];
      if (p.isRecurring !== false && personalDays.length > 0) {
        const convertedDays = personalDays.map(day => day === 7 ? 0 : day);
        if (convertedDays.includes(dayOfWeek)) {
          const startMinutes = timeToMinutes(p.startTime);
          const endMinutes = timeToMinutes(p.endTime);

          console.log('🔍 personalTime 체크 (반복):', {
            personal: p,
            dayOfWeek,
            convertedDays,
            startMinutes,
            endMinutes,
            timeMinutes,
            isMatch: (endMinutes <= startMinutes) ?
              (timeMinutes >= startMinutes || timeMinutes < endMinutes) :
              (timeMinutes >= startMinutes && timeMinutes < endMinutes)
          });

          // 자정을 넘나드는 시간 처리
          if (endMinutes <= startMinutes) {
            return timeMinutes >= startMinutes || timeMinutes < endMinutes;
          } else {
            return timeMinutes >= startMinutes && timeMinutes < endMinutes;
          }
        }
      }

      // 특정 날짜 개인시간 처리 (챗봇에서 추가한 경우)
      if (p.isRecurring === false && p.specificDate) {
        const specificDate = new Date(p.specificDate);
        const currentDate = new Date(dateStr);

        // 날짜가 일치하는지 확인
        if (specificDate.toDateString() === currentDate.toDateString()) {
          const startMinutes = timeToMinutes(p.startTime);
          const endMinutes = timeToMinutes(p.endTime);

          console.log('🔍 personalTime 체크 (특정날짜):', {
            personal: p,
            specificDate: p.specificDate,
            dateStr,
            startMinutes,
            endMinutes,
            timeMinutes,
            isMatch: timeMinutes >= startMinutes && timeMinutes < endMinutes
          });

          return timeMinutes >= startMinutes && timeMinutes < endMinutes;
        }
      }

      return false;
    });

    if (personalSlot) {
      return {
        ...personalSlot,
        type: 'personal',
        name: `${personalSlot.title || '개인시간'} (방장)`
      };
    }

    // 개인시간과 예외일정이 없는 경우에만, 선호시간(priority >= 2) 체크
    // defaultSchedule에서 해당 요일의 선호시간 확인
    const hasPreferredTime = ownerOriginalSchedule.defaultSchedule?.some(sched => {
      if (sched.dayOfWeek !== dayOfWeek || sched.priority < 2) return false;

      const startMinutes = timeToMinutes(sched.startTime);
      const endMinutes = timeToMinutes(sched.endTime);

      const isInRange = timeMinutes >= startMinutes && timeMinutes < endMinutes;

      // 디버깅용 로그 (월요일 13:00만 출력)
      if (dayOfWeek === 1 && time === '13:00') {
        console.log('🔍 선호시간 체크:', {
          time,
          dayOfWeek,
          sched: { dayOfWeek: sched.dayOfWeek, priority: sched.priority, startTime: sched.startTime, endTime: sched.endTime },
          startMinutes,
          endMinutes,
          timeMinutes,
          isInRange,
          defaultScheduleLength: ownerOriginalSchedule.defaultSchedule?.length
        });
      }

      return isInRange;
    });

    // scheduleExceptions에서도 선호시간 확인 (priority >= 2)
    const hasPreferredExceptionTime = ownerOriginalSchedule.scheduleExceptions?.some(e => {
      if (e.specificDate !== dateStr || !e.priority || e.priority < 2) return false;

      const startDate = new Date(e.startTime);
      const endDate = new Date(e.endTime);
      const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
      const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();

      return timeMinutes >= startMinutes && timeMinutes < endMinutes;
    });

    // 디버깅용 로그 (월요일 13:00)
    if (dayOfWeek === 1 && time === '13:00') {
      console.log('🔍 최종 판단:', {
        time,
        hasPreferredTime,
        hasPreferredExceptionTime,
        willShowAsNonPreferred: !hasPreferredTime && !hasPreferredExceptionTime
      });
    }

    // 선호시간도 없고 예외일정도 없고 개인시간도 없는 경우 → 불가능한 시간으로 표시
    if (!hasPreferredTime && !hasPreferredExceptionTime) {
      return {
        type: 'non_preferred',
        name: '불가능 (방장)',
        title: '불가능한 시간'
      };
    }

    // 선호시간이 있으면 null 반환 (빈 시간으로 표시)
    return null;
  };

  // 연속된 시간대를 자동으로 병합하는 함수
  const getMergedTimeBlocks = (dateInfo, dayIndex) => {
    const date = dateInfo.fullDate;
    const blocks = [];
    let currentBlock = null;

    for (const time of filteredTimeSlotsInDay) {
      // 방장의 원본 시간표를 우선적으로 확인
      const ownerOriginalInfo = getOwnerOriginalScheduleInfo(date, time);

      const ownerInfo = getSlotOwner(date, time);
      const isSelected = isSlotSelected(date, time);
      const blockedInfo = getBlockedTimeInfo(time);
      const roomExceptionInfo = getRoomExceptionInfo(date, time);
      const isBlocked = !!(blockedInfo || roomExceptionInfo);

      // 현재 슬롯의 상태 결정 - 우선순위 개선
      let slotType = 'empty';
      let slotData = null;

      // 0순위: 방장의 원본 시간표 정보 중 exception, personal만 최우선 처리
      if (ownerOriginalInfo && (ownerOriginalInfo.type === 'exception' || ownerOriginalInfo.type === 'personal')) {
        slotType = 'blocked';
        slotData = {
          name: ownerOriginalInfo.name,
          info: ownerOriginalInfo,
          isOwnerOriginalSchedule: true,
          ownerScheduleType: ownerOriginalInfo.type
        };
      }
      // 1순위: blocked 또는 room exception
      else if (isBlocked) {
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
      // 4순위: 방장의 불가능한 시간 (non_preferred) - 빈 슬롯에만 적용
      else if (ownerOriginalInfo && ownerOriginalInfo.type === 'non_preferred') {
        slotType = 'blocked';
        slotData = {
          name: ownerOriginalInfo.name,
          info: ownerOriginalInfo,
          isOwnerOriginalSchedule: true,
          ownerScheduleType: ownerOriginalInfo.type
        };
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
          const currentIsOwnerOriginalSchedule = currentBlock.data?.isOwnerOriginalSchedule;
          const newIsOwnerOriginalSchedule = slotData?.isOwnerOriginalSchedule;

          if ((currentIsRoomOwnerPersonal && newIsRoomOwnerPersonal) ||
              (currentIsRoomOwnerSchedule && newIsRoomOwnerSchedule) ||
              (currentIsOwnerOriginalSchedule && newIsOwnerOriginalSchedule)) {
            // 둘 다 방장 관련 시간이면 병합 (이름이 같은지도 확인)
            isSameType = currentName === newName;
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

    // 그리드 기반으로 렌더링 (헤더와 일치)
    return (
      <div className="grid grid-cols-6">
        {/* 시간 컬럼 - 첫 번째 행만 렌더링 */}
        <div className="col-span-1 relative">
          {filteredTimeSlotsInDay.map(time => (
            <div
              key={time}
              className="h-8 px-1 text-center text-xs font-medium text-gray-600 border-b border-gray-200 flex items-center justify-center"
            >
              {time}
            </div>
          ))}
        </div>

        {/* 각 날짜별 컬럼 */}
        {weekDates.slice(0, 5).map((dateInfo, dayIndex) => {
          const blocks = dayBlocks[dayIndex];
          const totalHeight = filteredTimeSlotsInDay.length * 32; // 전체 컬럼 높이 (h-8 = 32px)

          return (
            <div key={dayIndex} className="col-span-1 border-l border-gray-200 relative" style={{ height: `${totalHeight}px` }}>
              {blocks.map((block, blockIndex) => {
                const date = dateInfo.fullDate;
                const blockHeight = block.duration * 3.2; // 10분 = 3.2px (32px/10)
                const startIndex = getTimeSlotIndex(block.startTime);
                const topPosition = startIndex * 32; // 각 시간 슬롯은 32px (h-8)

                return (
                  <div
                    key={`${date.toISOString().split('T')[0]}-${block.startTime}-${blockIndex}`}
                    className={`absolute left-0 right-0 border-b border-gray-200 flex items-center justify-center text-center px-0.5
                      ${block.type === 'blocked' ? 'cursor-not-allowed' : ''}
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
                      // 방장의 불가능한 시간 (non_preferred) - 연한 보라/라벤더
                      ...(block.type === 'blocked' && block.data?.ownerScheduleType === 'non_preferred' ? {
                        backgroundColor: '#E9D5FF',
                        borderColor: '#C084FC'
                      } : {}),
                      // 방장의 개인시간 (personal) - 연한 주황/피치
                      ...(block.type === 'blocked' && block.data?.ownerScheduleType === 'personal' ? {
                        backgroundColor: '#FED7AA',
                        borderColor: '#FB923C'
                      } : {}),
                      // 방장의 예외일정 (exception) - 연한 노란색
                      ...(block.type === 'blocked' && block.data?.ownerScheduleType === 'exception' ? {
                        backgroundColor: '#FEF3C7',
                        borderColor: '#FBBF24'
                      } : {}),
                      // 그 외 roomException - 연한 청록
                      ...(block.type === 'blocked' && block.data?.isRoomException && !block.data?.ownerScheduleType ? {
                        backgroundColor: '#99F6E4',
                        borderColor: '#2DD4BF'
                      } : {}),
                      // 기타 blocked - 연한 회색 (fallback)
                      ...(block.type === 'blocked' && !block.data?.ownerScheduleType && !block.data?.isRoomException ? {
                        backgroundColor: '#F3F4F6',
                        borderColor: '#D1D5DB'
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
            <div className="col-span-1 px-1 text-center text-xs font-medium text-gray-600 flex items-center justify-center h-8">
              {time}
            </div>

            {/* 평일 5개 컬럼만 */}
            {weekdays.map((dateInfo, dayIndex) => {
              const date = dateInfo.fullDate;

              // 방장의 원본 시간표를 우선적으로 확인
              const ownerOriginalInfo = getOwnerOriginalScheduleInfo(date, time);

              const ownerInfo = getSlotOwner(date, time);
              const isSelected = isSlotSelected(date, time);
              const blockedInfo = getBlockedTimeInfo(time);
              const roomExceptionInfo = getRoomExceptionInfo(date, time);

              // 방장의 원본 시간표 정보 처리: exception/personal만 우선, non_preferred는 나중에
              let finalBlockedInfo = blockedInfo;
              let finalRoomExceptionInfo = roomExceptionInfo;
              let finalOwnerInfo = ownerInfo;

              // exception이나 personal은 최우선
              if (ownerOriginalInfo && (ownerOriginalInfo.type === 'exception' || ownerOriginalInfo.type === 'personal')) {
                finalBlockedInfo = { ...ownerOriginalInfo, ownerScheduleType: ownerOriginalInfo.type };
                finalRoomExceptionInfo = null;
                finalOwnerInfo = null;
              }
              // non_preferred는 빈 슬롯에만 적용 (ownerInfo가 없고 blocked도 없을 때)
              else if (ownerOriginalInfo && ownerOriginalInfo.type === 'non_preferred' && !ownerInfo && !blockedInfo && !roomExceptionInfo) {
                finalBlockedInfo = { ...ownerOriginalInfo, ownerScheduleType: ownerOriginalInfo.type };
              }

              const isBlocked = !!(finalBlockedInfo || finalRoomExceptionInfo);

              return (
                <TimeSlot
                  key={`${date.toISOString().split('T')[0]}-${time}`}
                  date={date}
                  day={dayNamesKorean[dayIndex]}
                  time={time}
                  ownerInfo={finalOwnerInfo}
                  isSelected={isSelected}
                  blockedInfo={finalBlockedInfo}
                  roomExceptionInfo={finalRoomExceptionInfo}
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
