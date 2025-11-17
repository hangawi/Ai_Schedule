// Helper function to handle negotiation resolution
async function handleNegotiationResolution(room, negotiation, userId) {
   const members = negotiation.conflictingMembers;

   // 응답 분류
   const yieldedMembers = members.filter(m => m.response === 'yield');
   const claimedMembers = members.filter(m => m.response === 'claim');
   const splitFirstMembers = members.filter(m => m.response === 'split_first');
   const splitSecondMembers = members.filter(m => m.response === 'split_second');
   const chooseSlotMembers = members.filter(m => m.response === 'choose_slot');

   // Case 1: full_conflict + n-1명이 양보 (부분 양보)
   if (negotiation.type === 'full_conflict' && yieldedMembers.length >= 1 && claimedMembers.length >= 1) {
      // n명 중 n-1명이 양보했는지 확인
      if (yieldedMembers.length === members.length - 1) {
         const claimedMember = claimedMembers[0];

         // 주장한 사람에게 선택한 시간대로 배정 (전체 시간이 아닌 필요한 시간만)
         let assignStartTime, assignEndTime;

         // 주장한 사람이 time_slot_choice에서 선택한 시간이 있다면 그 시간 사용
         if (claimedMember.chosenSlot && claimedMember.chosenSlot.startTime && claimedMember.chosenSlot.endTime) {
            assignStartTime = claimedMember.chosenSlot.startTime;
            assignEndTime = claimedMember.chosenSlot.endTime;
         } else {
            // chosenSlot이 없으면 필요한 시간만큼만 할당
            const requiredSlots = claimedMember.requiredSlots || 2; // 기본값 1시간(2슬롯)
            const requiredMinutes = requiredSlots * 30; // 슬롯 당 30분

            const [startH, startM] = negotiation.slotInfo.startTime.split(':').map(Number);
            const startMinutes = startH * 60 + startM;
            const endMinutes = startMinutes + requiredMinutes;

            assignStartTime = negotiation.slotInfo.startTime;
            assignEndTime = `${Math.floor(endMinutes/60).toString().padStart(2,'0')}:${(endMinutes%60).toString().padStart(2,'0')}`;
         }

         // startTime과 endTime이 유효한지 확인
         if (!assignStartTime || !assignEndTime) {
            throw new Error('시간 정보가 올바르지 않습니다.');
         }

         // 💡 30분 단위로 슬롯 분할하여 추가
         const [startH, startM] = assignStartTime.split(':').map(Number);
         const [endH, endM] = assignEndTime.split(':').map(Number);
         const startMinutes = startH * 60 + startM;
         const endMinutes = endH * 60 + endM;

         for (let currentMinutes = startMinutes; currentMinutes < endMinutes; currentMinutes += 30) {
            const slotStartTime = `${Math.floor(currentMinutes/60).toString().padStart(2,'0')}:${(currentMinutes%60).toString().padStart(2,'0')}`;
            const slotEndTime = `${Math.floor((currentMinutes+30)/60).toString().padStart(2,'0')}:${((currentMinutes+30)%60).toString().padStart(2,'0')}`;

            const existingSlot = room.timeSlots.find(slot =>
               slot.user.toString() === (claimedMember.user._id || claimedMember.user).toString() &&
               slot.date.toISOString() === new Date(negotiation.slotInfo.date).toISOString() &&
               slot.startTime === slotStartTime &&
               slot.endTime === slotEndTime
            );

            if (!existingSlot) {
               const newSlot = {
                  user: claimedMember.user._id || claimedMember.user,
                  date: negotiation.slotInfo.date,
                  startTime: slotStartTime,
                  endTime: slotEndTime,
                  day: negotiation.slotInfo.day,
                  subject: '협의 결과',
                  status: 'confirmed',
                  assignedBy: userId
               };
               room.timeSlots.push(newSlot);
            } else {
            }
         }

         yieldedMembers.forEach(yieldedMember => {
            const yieldedUserId = (yieldedMember.user._id || yieldedMember.user).toString();
            const roomMember = room.members.find(m => {
               const mUserId = m.user._id ? m.user._id.toString() : m.user.toString();
               return mUserId === yieldedUserId;
            });

            if (yieldedMember.yieldOption === 'carry_over') {
               // 이월 처리 (중복 방지를 위해 이미 이월된 내역이 있는지 확인)
               // 💡 멤버의 requiredSlots 기준으로 이월 (실제 필요한 시간만 이월)
               const requiredSlots = yieldedMember.requiredSlots || 2; // 기본값 1시간(2슬롯)
               const carryOverHours = (requiredSlots * 30) / 60; // 슬롯당 30분

               if (roomMember) {
                  // 해당 협의에 대한 이월 내역이 이미 있는지 확인
                  const alreadyCarriedOver = roomMember.carryOverHistory.some(history =>
                     history.negotiationId && history.negotiationId.toString() === negotiation._id.toString()
                  );

                  if (!alreadyCarriedOver) {
                     const beforeCarryOver = roomMember.carryOver;
                     roomMember.carryOver += carryOverHours;
                     roomMember.carryOverHistory.push({
                        week: new Date(),
                        amount: carryOverHours,
                        reason: 'negotiation_yield',
                        timestamp: new Date(),
                        negotiationId: negotiation._id
                     });
                  } else {
                  }
               } else {
               }
            } else if (yieldedMember.yieldOption === 'alternative_time' && yieldedMember.alternativeSlots) {
               yieldedMember.alternativeSlots.forEach(slotKey => {
                  // 형식: '2025-10-13-13:00-14:00'
                  const parts = slotKey.split('-');
                  const date = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
                  const startTime = parts[3];
                  const endTime = parts[4];

                  // 요일 계산
                  const dayOfWeek = date.getDay();
                  const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                  const dayName = dayMap[dayOfWeek];

                  // 💡 30분 단위로 슬롯 분할
                  const [startH, startM] = startTime.split(':').map(Number);
                  const [endH, endM] = endTime.split(':').map(Number);
                  const startMinutes = startH * 60 + startM;
                  const endMinutes = endH * 60 + endM;

                  for (let currentMinutes = startMinutes; currentMinutes < endMinutes; currentMinutes += 30) {
                     const slotStartTime = `${Math.floor(currentMinutes/60).toString().padStart(2,'0')}:${(currentMinutes%60).toString().padStart(2,'0')}`;
                     const slotEndTime = `${Math.floor((currentMinutes+30)/60).toString().padStart(2,'0')}:${((currentMinutes+30)%60).toString().padStart(2,'0')}`;

                     const existingSlot = room.timeSlots.find(slot =>
                        (slot.user._id ? slot.user._id.toString() : slot.user.toString()) === (yieldedMember.user._id || yieldedMember.user).toString() &&
                        new Date(slot.date).toISOString().split('T')[0] === date.toISOString().split('T')[0] &&
                        slot.startTime === slotStartTime &&
                        slot.endTime === slotEndTime
                     );

                     if (!existingSlot) {
                        room.timeSlots.push({
                           user: yieldedMember.user._id || yieldedMember.user,
                           date: date,
                           startTime: slotStartTime,
                           endTime: slotEndTime,
                           day: dayName,
                           subject: '협의 결과 (대체시간)',
                           status: 'confirmed',
                           assignedBy: userId
                        });
                     } else {
                     }
                  }
               });
            }
         });

         negotiation.status = 'resolved';
         negotiation.resolution = {
            type: 'yielded',
            assignments: [{
               user: claimedMember.user._id || claimedMember.user,
               slots: [`${negotiation.slotInfo.date}-${assignStartTime}`],
               isCarryOver: false
            }],
            resolvedAt: new Date(),
            resolvedBy: userId
         };

         const claimedMemberName = claimedMember.user.firstName || claimedMember.user.name || '멤버';
         negotiation.messages.push({
            message: `협의가 완료되었습니다. ${claimedMemberName}님이 ${assignStartTime}-${assignEndTime} 시간을 배정받았습니다.`,
            timestamp: new Date(),
            isSystemMessage: true
         });
      }
   }
   // Case 1-2: time_slot_choice + 각자 다른 시간대 선택
   else if (negotiation.type === 'time_slot_choice' && chooseSlotMembers.length === members.length) {
      // 선택한 시간대가 겹치지 않는지 확인 (같은 날짜 + 같은 시간일 때만 충돌)
      const chosenSlots = chooseSlotMembers.map(m => ({
         ...m.chosenSlot,
         userId: (m.user._id || m.user).toString(),
         // date가 없으면 기본 협의 날짜 사용
         date: m.chosenSlot.date || negotiation.slotInfo.date
      }));

      const slotsOverlap = chosenSlots.some((slot1, i) => {
         return chosenSlots.some((slot2, j) => {
            if (i >= j) return false;

            // 다른 날짜면 충돌 없음
            const date1 = new Date(slot1.date).toISOString().split('T')[0];
            const date2 = new Date(slot2.date).toISOString().split('T')[0];
            if (date1 !== date2) {
               return false;
            }

            // 같은 날짜에서 시간 충돌 확인
            const overlap = !(slot1.endTime <= slot2.startTime || slot2.endTime <= slot1.startTime);
            if (overlap) {
            }
            return overlap;
         });
      });

      if (!slotsOverlap) {
         // 겹치지 않음 - 각자 선택한 시간대 배정 (30분 단위로 분할)
         chooseSlotMembers.forEach(member => {
            // 멤버가 선택한 날짜 (없으면 기본 협의 날짜)
            const chosenDate = member.chosenSlot.date || negotiation.slotInfo.date;
            const chosenDateObj = new Date(chosenDate);

            // 선택한 날짜의 요일 계산 (0=일, 1=월, ..., 6=토)
            const dayOfWeek = chosenDateObj.getDay();
            const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const chosenDay = dayMap[dayOfWeek];


            // chosenSlot을 30분 단위로 분할
            const [startH, startM] = member.chosenSlot.startTime.split(':').map(Number);
            const [endH, endM] = member.chosenSlot.endTime.split(':').map(Number);
            const startMinutes = startH * 60 + startM;
            const endMinutes = endH * 60 + endM;

            // 30분 단위로 슬롯 생성
            for (let currentMinutes = startMinutes; currentMinutes < endMinutes; currentMinutes += 30) {
               const slotStartTime = `${Math.floor(currentMinutes/60).toString().padStart(2,'0')}:${(currentMinutes%60).toString().padStart(2,'0')}`;
               const slotEndTime = `${Math.floor((currentMinutes+30)/60).toString().padStart(2,'0')}:${((currentMinutes+30)%60).toString().padStart(2,'0')}`;

               const existingSlot = room.timeSlots.find(slot =>
                  slot.user.toString() === (member.user._id || member.user).toString() &&
                  slot.date.toISOString() === chosenDateObj.toISOString() &&
                  slot.startTime === slotStartTime &&
                  slot.endTime === slotEndTime
               );

               if (!existingSlot) {
                  room.timeSlots.push({
                     user: member.user._id || member.user,
                     date: chosenDateObj,
                     startTime: slotStartTime,
                     endTime: slotEndTime,
                     day: chosenDay,
                     subject: '협의 결과 (시간선택)',
                     status: 'confirmed',
                     assignedBy: userId
                  });
               }
            }
         });

         negotiation.status = 'resolved';
         negotiation.resolution = {
            type: 'time_slot_choice',
            assignments: chooseSlotMembers.map(m => ({
               user: m.user._id || m.user,
               slots: [`${negotiation.slotInfo.date}-${m.chosenSlot.startTime}-${m.chosenSlot.endTime}`],
               isCarryOver: false
            })),
            resolvedAt: new Date(),
            resolvedBy: userId
         };

         negotiation.messages.push({
            message: `협의가 완료되었습니다. 각자 선택한 시간대로 배정되었습니다.`,
            timestamp: new Date(),
            isSystemMessage: true
         });

      } else {
         // 겹침 - full_conflict로 전환 (양보/주장 또는 랜덤)
         negotiation.type = 'full_conflict';
         negotiation.messages.push({
            message: `선택한 시간대가 겹칩니다. 양보하거나 주장하여 해결하세요. 둘 다 주장하면 랜덤으로 결정됩니다.`,
            timestamp: new Date(),
            isSystemMessage: true
         });
         // 응답만 초기화 (chosenSlot은 유지!)
         members.forEach(m => {
            m.response = 'pending';
            // m.chosenSlot = null; // 제거: 선택한 시간 정보 유지
         });

         // 상태를 'active'로 유지하여 계속 협의 가능하도록
         negotiation.status = 'active';

         negotiation.memberSpecificTimeSlots = {};

         const dayString = negotiation.slotInfo.day;
         const conflictDate = new Date(negotiation.slotInfo.date);

         for (const cm of negotiation.conflictingMembers) {
            const memberId = (cm.user._id || cm.user).toString();
            const roomMember = room.members.find(m => {
               const mUserId = m.user._id ? m.user._id.toString() : m.user.toString();
               return mUserId === memberId;
            });

            if (roomMember && roomMember.user && roomMember.user.defaultSchedule) {
               const dayMap = { 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 0 };
               const targetDayOfWeek = dayMap[dayString];

               const dayPreferences = roomMember.user.defaultSchedule.filter(sched =>
                  sched.dayOfWeek === targetDayOfWeek && sched.priority >= 2
               );

               // 연속된 시간 블록을 병합
               const sortedPrefs = dayPreferences.sort((a, b) => a.startTime.localeCompare(b.startTime));
               const mergedBlocks = [];

               for (const pref of sortedPrefs) {
                  if (mergedBlocks.length === 0) {
                     mergedBlocks.push({ startTime: pref.startTime, endTime: pref.endTime });
                  } else {
                     const lastBlock = mergedBlocks[mergedBlocks.length - 1];
                     if (lastBlock.endTime === pref.startTime) {
                        lastBlock.endTime = pref.endTime;
                     } else {
                        mergedBlocks.push({ startTime: pref.startTime, endTime: pref.endTime });
                     }
                  }
               }

               const memberOptions = [];
               for (const block of mergedBlocks) {
                  const isAlreadyAssigned = room.timeSlots.some(slot => {
                     const slotDate = new Date(slot.date);
                     if (slotDate.toDateString() !== conflictDate.toDateString()) return false;
                     return !(slot.endTime <= block.startTime || block.endTime <= slot.startTime);
                  });

                  if (!isAlreadyAssigned) {
                     memberOptions.push({ startTime: block.startTime, endTime: block.endTime });
                  }
               }

               negotiation.memberSpecificTimeSlots[memberId] = memberOptions;
            } else {
               negotiation.memberSpecificTimeSlots[memberId] = [];
            }
         }
      }
   }
   // Case 2: partial_conflict + 모두 같은 시간 선택 -> full_conflict로 전환
   else if (negotiation.type === 'partial_conflict' &&
            (splitFirstMembers.length === members.length || splitSecondMembers.length === members.length)) {
      // 모두 앞 시간 또는 모두 뒷 시간 선택

      // split_first/split_second 정보를 chosenSlot으로 변환
      const [startH, startM] = negotiation.slotInfo.startTime.split(':').map(Number);
      const [endH, endM] = negotiation.slotInfo.endTime.split(':').map(Number);

      members.forEach(m => {
         if (m.response === 'split_first') {
            // 앞시간 선택한 사람: 필요한 슬롯 수만큼
            const requiredSlots = m.requiredSlots || 1;
            const requiredMinutes = requiredSlots * 30;
            const midMinutes = startH * 60 + startM + requiredMinutes;
            const midTime = `${Math.floor(midMinutes/60).toString().padStart(2,'0')}:${(midMinutes%60).toString().padStart(2,'0')}`;

            m.chosenSlot = {
               startTime: negotiation.slotInfo.startTime,
               endTime: midTime
            };
         } else if (m.response === 'split_second') {
            // 뒷시간 선택한 사람: 필요한 슬롯 수만큼
            const requiredSlots = m.requiredSlots || 1;
            const requiredMinutes = requiredSlots * 30;
            const startMinutes = endH * 60 + endM - requiredMinutes;
            const startTime = `${Math.floor(startMinutes/60).toString().padStart(2,'0')}:${(startMinutes%60).toString().padStart(2,'0')}`;

            m.chosenSlot = {
               startTime: startTime,
               endTime: negotiation.slotInfo.endTime
            };
         }

         // 응답 초기화
         m.response = 'pending';
      });

      negotiation.type = 'full_conflict';
      negotiation.messages.push({
         message: `선택한 시간대가 겹칩니다. 양보하거나 주장하여 해결하세요. 둘 다 주장하면 랜덤으로 결정됩니다.`,
         timestamp: new Date(),
         isSystemMessage: true
      });

      // 상태를 'active'로 유지하여 계속 협의 가능하도록
      negotiation.status = 'active';

      // 💡 full_conflict로 전환 시 memberSpecificTimeSlots 생성
      negotiation.memberSpecificTimeSlots = {};

      const dayString = negotiation.slotInfo.day;
      const conflictDate = new Date(negotiation.slotInfo.date);

      for (const cm of negotiation.conflictingMembers) {
         const memberId = (cm.user._id || cm.user).toString();
         const roomMember = room.members.find(m => {
            const mUserId = m.user._id ? m.user._id.toString() : m.user.toString();
            return mUserId === memberId;
         });

         if (roomMember && roomMember.user && roomMember.user.defaultSchedule) {
            const dayMap = { 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 0 };
            const targetDayOfWeek = dayMap[dayString];

            const dayPreferences = roomMember.user.defaultSchedule.filter(sched =>
               sched.dayOfWeek === targetDayOfWeek && sched.priority >= 2
            );

            // 연속된 시간 블록을 병합
            const sortedPrefs = dayPreferences.sort((a, b) => a.startTime.localeCompare(b.startTime));
            const mergedBlocks = [];

            for (const pref of sortedPrefs) {
               if (mergedBlocks.length === 0) {
                  mergedBlocks.push({ startTime: pref.startTime, endTime: pref.endTime });
               } else {
                  const lastBlock = mergedBlocks[mergedBlocks.length - 1];
                  if (lastBlock.endTime === pref.startTime) {
                     lastBlock.endTime = pref.endTime;
                  } else {
                     mergedBlocks.push({ startTime: pref.startTime, endTime: pref.endTime });
                  }
               }
            }

            const memberOptions = [];
            for (const block of mergedBlocks) {
               const isAlreadyAssigned = room.timeSlots.some(slot => {
                  const slotDate = new Date(slot.date);
                  if (slotDate.toDateString() !== conflictDate.toDateString()) return false;
                  return !(slot.endTime <= block.startTime || block.endTime <= slot.startTime);
               });

               if (!isAlreadyAssigned) {
                  memberOptions.push({ startTime: block.startTime, endTime: block.endTime });
               }
            }

            negotiation.memberSpecificTimeSlots[memberId] = memberOptions;
         } else {
            negotiation.memberSpecificTimeSlots[memberId] = [];
         }
      }
   }
   // Case 3: partial_conflict + 시간 분할 (각자 다른 시간 선택)
   else if (negotiation.type === 'partial_conflict' && splitFirstMembers.length === 1 && splitSecondMembers.length === 1) {
      const firstMember = splitFirstMembers[0];
      const secondMember = splitSecondMembers[0];

      // 각 멤버의 필요 슬롯 수 확인
      const firstRequiredSlots = firstMember.requiredSlots || 1;
      const firstRequiredMinutes = firstRequiredSlots * 30; // 1슬롯 = 30분

      const [startH, startM] = negotiation.slotInfo.startTime.split(':').map(Number);
      const [endH, endM] = negotiation.slotInfo.endTime.split(':').map(Number);

      // 첫 번째 멤버의 필요 시간만큼만 할당
      const midMinutes = startH * 60 + startM + firstRequiredMinutes;
      const midTime = `${Math.floor(midMinutes/60).toString().padStart(2,'0')}:${(midMinutes%60).toString().padStart(2,'0')}`;

      // 앞 시간대 (첫 번째 멤버에게 필요한 만큼만)
      const existingFirstSlot = room.timeSlots.find(slot =>
         slot.user.toString() === (firstMember.user._id || firstMember.user).toString() &&
         slot.date.toISOString() === new Date(negotiation.slotInfo.date).toISOString() &&
         slot.startTime === negotiation.slotInfo.startTime &&
         slot.endTime === midTime
      );

      if (!existingFirstSlot) {
         room.timeSlots.push({
            user: firstMember.user._id || firstMember.user,
            date: negotiation.slotInfo.date,
            startTime: negotiation.slotInfo.startTime,
            endTime: midTime,
            day: negotiation.slotInfo.day,
            subject: '협의 결과 (분할)',
            status: 'confirmed',
            assignedBy: userId
         });
      }

      // 뒷 시간대 (나머지 시간 전부)
      const existingSecondSlot = room.timeSlots.find(slot =>
         slot.user.toString() === (secondMember.user._id || secondMember.user).toString() &&
         slot.date.toISOString() === new Date(negotiation.slotInfo.date).toISOString() &&
         slot.startTime === midTime &&
         slot.endTime === negotiation.slotInfo.endTime
      );

      if (!existingSecondSlot) {
         room.timeSlots.push({
            user: secondMember.user._id || secondMember.user,
            date: negotiation.slotInfo.date,
            startTime: midTime,
            endTime: negotiation.slotInfo.endTime,
            day: negotiation.slotInfo.day,
            subject: '협의 결과 (분할)',
            status: 'confirmed',
            assignedBy: userId
         });
      }

      negotiation.status = 'resolved';
      negotiation.resolution = {
         type: 'split',
         assignments: [
            {
               user: firstMember.user._id || firstMember.user,
               slots: [`${negotiation.slotInfo.date}-${negotiation.slotInfo.startTime}-${midTime}`],
               isCarryOver: false
            },
            {
               user: secondMember.user._id || secondMember.user,
               slots: [`${negotiation.slotInfo.date}-${midTime}-${negotiation.slotInfo.endTime}`],
               isCarryOver: false
            }
         ],
         resolvedAt: new Date(),
         resolvedBy: userId
      };

      negotiation.messages.push({
         message: `협의가 완료되었습니다. 시간대가 분할되었습니다.`,
         timestamp: new Date(),
         isSystemMessage: true
      });

   }
   // Case 4: 모두 양보 -> 모두 이월
   else if (yieldedMembers.length === members.length) {
      // 모든 멤버가 양보한 경우 - 모두 이월 처리
      yieldedMembers.forEach(member => {
         const yieldedUserId = (member.user._id || member.user).toString();
         const roomMember = room.members.find(m => {
            const mUserId = m.user._id ? m.user._id.toString() : m.user.toString();
            return mUserId === yieldedUserId;
         });

         if (member.yieldOption === 'carry_over') {
            const [startH, startM] = negotiation.slotInfo.startTime.split(':').map(Number);
            const [endH, endM] = negotiation.slotInfo.endTime.split(':').map(Number);
            const carryOverHours = ((endH * 60 + endM) - (startH * 60 + startM)) / 60;

            if (roomMember) {
               const alreadyCarriedOver = roomMember.carryOverHistory.some(history =>
                  history.negotiationId && history.negotiationId.toString() === negotiation._id.toString()
               );

               if (!alreadyCarriedOver) {
                  roomMember.carryOver += carryOverHours;
                  roomMember.carryOverHistory.push({
                     week: new Date(),
                     amount: carryOverHours,
                     reason: 'negotiation_yield',
                     timestamp: new Date(),
                     negotiationId: negotiation._id
                  });
               }
            }
         }
      });

      negotiation.status = 'resolved';
      negotiation.messages.push({
         message: `모든 멤버가 양보했습니다. 시간이 이월됩니다.`,
         timestamp: new Date(),
         isSystemMessage: true
      });
   }
   // Case 5: 모두 주장 -> 랜덤 또는 다른 시간 선택
   else if (claimedMembers.length === members.length) {
      negotiation.messages.push({
         message: `모두 주장했습니다. 랜덤으로 결정하거나 다른 시간을 선택하세요.`,
         timestamp: new Date(),
         isSystemMessage: true
      });

      // 랜덤 선택
      const randomIndex = Math.floor(Math.random() * claimedMembers.length);
      const winner = claimedMembers[randomIndex];
      const losers = claimedMembers.filter((_, i) => i !== randomIndex);

      // 승자에게 시간 배정 (필요한 시간만큼만)
      let assignStartTime, assignEndTime;

      // chosenSlot이 있으면 그 시간 사용, 없으면 필요한 시간만큼만 할당
      if (winner.chosenSlot && winner.chosenSlot.startTime && winner.chosenSlot.endTime) {
         assignStartTime = winner.chosenSlot.startTime;
         assignEndTime = winner.chosenSlot.endTime;
      } else {
         // chosenSlot이 없으면 필요한 시간만큼만 할당
         const requiredSlots = winner.requiredSlots || 2; // 기본값 1시간(2슬롯)
         const requiredMinutes = requiredSlots * 30;

         const [startH, startM] = negotiation.slotInfo.startTime.split(':').map(Number);
         const startMinutes = startH * 60 + startM;
         const endMinutes = startMinutes + requiredMinutes;

         assignStartTime = negotiation.slotInfo.startTime;
         assignEndTime = `${Math.floor(endMinutes/60).toString().padStart(2,'0')}:${(endMinutes%60).toString().padStart(2,'0')}`;

      }

      const existingSlot = room.timeSlots.find(slot =>
         slot.user.toString() === (winner.user._id || winner.user).toString() &&
         slot.date.toISOString() === new Date(negotiation.slotInfo.date).toISOString() &&
         slot.startTime === assignStartTime &&
         slot.endTime === assignEndTime
      );

      if (!existingSlot) {
         room.timeSlots.push({
            user: winner.user._id || winner.user,
            date: negotiation.slotInfo.date,
            startTime: assignStartTime,
            endTime: assignEndTime,
            day: negotiation.slotInfo.day,
            subject: '협의 결과 (랜덤)',
            status: 'confirmed',
            assignedBy: userId
         });
      }

      // 패자들은 이월 처리
      losers.forEach(loser => {
         const loserUserId = (loser.user._id || loser.user).toString();
         const roomMember = room.members.find(m => {
            const mUserId = m.user._id ? m.user._id.toString() : m.user.toString();
            return mUserId === loserUserId;
         });

         if (roomMember) {
            const [startH, startM] = negotiation.slotInfo.startTime.split(':').map(Number);
            const [endH, endM] = negotiation.slotInfo.endTime.split(':').map(Number);
            const carryOverHours = ((endH * 60 + endM) - (startH * 60 + startM)) / 60;

            const alreadyCarriedOver = roomMember.carryOverHistory.some(history =>
               history.negotiationId && history.negotiationId.toString() === negotiation._id.toString()
            );

            if (!alreadyCarriedOver) {
               roomMember.carryOver += carryOverHours;
               roomMember.carryOverHistory.push({
                  week: new Date(),
                  amount: carryOverHours,
                  reason: 'negotiation_random_loss',
                  timestamp: new Date(),
                  negotiationId: negotiation._id
               });
            }
         }
      });

      negotiation.status = 'resolved';
      negotiation.resolution = {
         type: 'random',
         assignments: [{
            user: winner.user._id || winner.user,
            slots: [`${negotiation.slotInfo.date}-${negotiation.slotInfo.startTime}`],
            isCarryOver: false
         }],
         resolvedAt: new Date(),
         resolvedBy: userId
      };

      const winnerName = winner.user.firstName || winner.user.name || '멤버';
      negotiation.messages.push({
         message: `랜덤으로 ${winnerName}님이 선택되었습니다. 나머지 멤버는 이월됩니다.`,
         timestamp: new Date(),
         isSystemMessage: true
      });
   }

   // Mongoose에게 timeSlots 배열 변경 알림
   room.markModified('timeSlots');
}

module.exports = {
   handleNegotiationResolution
};
