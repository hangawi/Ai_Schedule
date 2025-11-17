const mongoose = require('mongoose');
const Room = require('../models/room');
const User = require('../models/user');
const Event = require('../models/event');
const { findOptimalSlots } = require('../services/schedulingAnalysisService');
const schedulingAlgorithm = require('../services/schedulingAlgorithm');
const { OWNER_COLOR, getAvailableColor } = require('../utils/colorUtils');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Import separated controllers
const roomController = require('./roomController');
const timeSlotController = require('./timeSlotController');

const dayMap = { 0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' };

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

// Re-export from separated controllers
exports.createRoom = roomController.createRoom;
exports.updateRoom = roomController.updateRoom;
exports.deleteRoom = roomController.deleteRoom;
exports.joinRoom = roomController.joinRoom;
exports.getRoomDetails = roomController.getRoomDetails;
exports.getMyRooms = roomController.getMyRooms;
exports.getRoomExchangeCounts = roomController.getRoomExchangeCounts;

// Re-export from timeSlotController
exports.submitTimeSlots = timeSlotController.submitTimeSlots;
exports.removeTimeSlot = timeSlotController.removeTimeSlot;
exports.assignTimeSlot = timeSlotController.assignTimeSlot;
exports.findCommonSlots = timeSlotController.findCommonSlots;
exports.resetCarryOverTimes = timeSlotController.resetCarryOverTimes;
exports.resetCompletedTimes = timeSlotController.resetCompletedTimes;

// 💡 Helper function: full_conflict 협의의 memberSpecificTimeSlots 실시간 재생성
async function regenerateMemberSpecificTimeSlots(negotiation, room) {
   negotiation.memberSpecificTimeSlots = {};

   const conflictDate = new Date(negotiation.slotInfo.date);

   // 💡 현재 주의 범위 계산 (weekStartDate 기준)
   let weekStartDate, weekEndDate;
   if (negotiation.weekStartDate) {
      weekStartDate = new Date(negotiation.weekStartDate);
      weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekStartDate.getDate() + 7);
   }

   for (const cm of negotiation.conflictingMembers) {
      const memberId = (cm.user._id || cm.user).toString();
      const roomMember = room.members.find(m => {
         const mUserId = m.user._id ? m.user._id.toString() : m.user.toString();
         return mUserId === memberId;
      });

      if (roomMember && roomMember.user && roomMember.user.defaultSchedule) {
         const dayMap = { 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 0 };
         const dayPreferences = roomMember.user.defaultSchedule.filter(sched => sched.priority >= 2);

         // 💡 현재 주의 슬롯만 체크 (weekStartDate가 있으면)
         const memberExistingSlots = room.timeSlots.filter(slot => {
            const slotUserId = slot.user._id ? slot.user._id.toString() : slot.user.toString();
            if (slotUserId !== memberId) return false;

            // 주간 범위 체크
            if (weekStartDate && weekEndDate) {
               const slotDate = new Date(slot.date);
               if (slotDate < weekStartDate || slotDate >= weekEndDate) return false;
            }

            return true;
         });

         // 💡 멤버가 필요한 시간 계산
         const memberInNego = negotiation.conflictingMembers.find(c =>
            (c.user._id || c.user).toString() === memberId
         );
         const requiredSlots = memberInNego?.requiredSlots || 2;
         const requiredMinutes = requiredSlots * 30;

         const memberOptions = [];
         const dayMap2 = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

         for (let dow = 0; dow <= 6; dow++) {
            const dayName = dayMap2[dow];
            const dayScheds = dayPreferences.filter(sched => sched.dayOfWeek === dow);
            if (dayScheds.length === 0) continue;

            const sortedPrefs = dayScheds.sort((a, b) => a.startTime.localeCompare(b.startTime));

            // 💡 연속된 시간 블록 병합 (10분 이내 간격은 허용)
            const mergedBlocks = [];
            for (const pref of sortedPrefs) {
               if (mergedBlocks.length === 0) {
                  mergedBlocks.push({ startTime: pref.startTime, endTime: pref.endTime });
               } else {
                  const lastBlock = mergedBlocks[mergedBlocks.length - 1];
                  // 💡 10분 이내 간격이면 병합 (선호시간 사이의 작은 간격 무시)
                  const [lastEndH, lastEndM] = lastBlock.endTime.split(':').map(Number);
                  const [prefStartH, prefStartM] = pref.startTime.split(':').map(Number);
                  const lastEndMinutes = lastEndH * 60 + lastEndM;
                  const prefStartMinutes = prefStartH * 60 + prefStartM;
                  const gap = prefStartMinutes - lastEndMinutes;

                  if (gap <= 10) {
                     // 10분 이내 간격이면 병합
                     lastBlock.endTime = pref.endTime;
                  } else {
                     mergedBlocks.push({ startTime: pref.startTime, endTime: pref.endTime });
                  }
               }
            }
            const targetDayIndex = dayMap2.indexOf(dayName);
            const currentDate = new Date(conflictDate);
            const currentDayIndex = currentDate.getDay();
            let daysToAdd = targetDayIndex - currentDayIndex;
            if (daysToAdd < 0) daysToAdd += 7;

            const targetDate = new Date(currentDate);
            targetDate.setDate(currentDate.getDate() + daysToAdd);
            const targetDateStr = targetDate.toISOString().split('T')[0];
            const conflictDateStr = conflictDate.toISOString().split('T')[0];
            const isConflictDate = targetDateStr === conflictDateStr;

            for (const block of mergedBlocks) {
               // 💡 모든 멤버의 슬롯을 체크하여 겹치는 부분 제외 (현재 주의 슬롯만)
               const overlappingSlots = room.timeSlots
                  .filter(slot => {
                     const slotDate = new Date(slot.date);
                     if (slotDate.toDateString() !== targetDate.toDateString()) return false;

                     // 주간 범위 체크
                     if (weekStartDate && weekEndDate) {
                        if (slotDate < weekStartDate || slotDate >= weekEndDate) return false;
                     }

                     return !(slot.endTime <= block.startTime || block.endTime <= slot.startTime);
                  })
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));

               // 가용 시간대 계산 (블록 분할)
               const availableRanges = [];
               if (overlappingSlots.length === 0) {
                  availableRanges.push({ startTime: block.startTime, endTime: block.endTime });
               } else {
                  let currentStart = block.startTime;
                  for (const assigned of overlappingSlots) {
                     if (currentStart < assigned.startTime) {
                        availableRanges.push({
                           startTime: currentStart,
                           endTime: assigned.startTime
                        });
                     }
                     currentStart = assigned.endTime > currentStart ? assigned.endTime : currentStart;
                  }
                  if (currentStart < block.endTime) {
                     availableRanges.push({
                        startTime: currentStart,
                        endTime: block.endTime
                     });
                  }
               }

               // 💡 각 가용 범위에서 필요한 시간 단위로 슬라이딩하여 옵션 생성
               for (const range of availableRanges) {
                  const [startH, startM] = range.startTime.split(':').map(Number);
                  const [endH, endM] = range.endTime.split(':').map(Number);
                  const rangeStartMinutes = startH * 60 + startM;
                  const rangeEndMinutes = endH * 60 + endM;
                  const rangeDuration = rangeEndMinutes - rangeStartMinutes;

                  // 필요한 시간보다 짧으면 스킵
                  if (rangeDuration < requiredMinutes) {
                     continue;
                  }

                  // 💡 원래 협의 발생한 시간 확인
                  const [origStartH, origStartM] = negotiation.slotInfo.startTime.split(':').map(Number);
                  const [origEndH, origEndM] = negotiation.slotInfo.endTime.split(':').map(Number);
                  const origStartMinutes = origStartH * 60 + origStartM;
                  const origEndMinutes = origEndH * 60 + origEndM;

                  // 필요한 시간 단위로 슬라이딩
                  for (let slideStart = rangeStartMinutes; slideStart + requiredMinutes <= rangeEndMinutes; slideStart += requiredMinutes) {
                     const optionStartTime = `${Math.floor(slideStart/60).toString().padStart(2,'0')}:${(slideStart%60).toString().padStart(2,'0')}`;
                     const optionEndTime = `${Math.floor((slideStart+requiredMinutes)/60).toString().padStart(2,'0')}:${((slideStart+requiredMinutes)%60).toString().padStart(2,'0')}`;
                     const optionStartMinutes = slideStart;
                     const optionEndMinutes = slideStart + requiredMinutes;

                     // 협의 발생 날짜에서만 충돌 시간대와 겹치는지 확인
                     if (isConflictDate) {
                        const overlapsConflict = !(optionEndMinutes <= origStartMinutes || optionStartMinutes >= origEndMinutes);
                        if (overlapsConflict) {
                           continue;
                        }
                     }

                     // 💡 주간 범위 체크: weekStartDate가 설정되어 있으면 해당 주의 옵션만 포함
                     if (weekStartDate && weekEndDate) {
                        if (targetDate < weekStartDate || targetDate >= weekEndDate) {
                           continue;
                        }
                     }

                     memberOptions.push({
                        startTime: optionStartTime,
                        endTime: optionEndTime,
                        date: targetDate,
                        day: dayName
                     });
                  }
               }
            }
         }

         negotiation.memberSpecificTimeSlots[memberId] = memberOptions;
      }
   }
}

// Negotiation management functions
exports.getNegotiations = async (req, res) => {
   try {
      const { roomId } = req.params;
      const userId = req.user.id;

      const room = await Room.findById(roomId)
         .populate('negotiations.conflictingMembers.user', '_id firstName lastName email')
         .populate('negotiations.participants', '_id firstName lastName email')
         .populate('negotiations.resolution.assignments.user', '_id firstName lastName email')
         .populate('owner', 'firstName lastName email')
         .populate('members.user', 'firstName lastName email defaultSchedule');

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      // 사용자가 참여 가능한 협의만 필터링 (participants에 포함되고 status가 'active'인 협의만)
      const accessibleNegotiations = room.negotiations.filter(negotiation => {
         const isParticipant = negotiation.participants.some(p => p._id.toString() === userId);
         const isActive = negotiation.status === 'active';
         return isParticipant && isActive;
      });

      // 💡 각 full_conflict 협의에 대해 memberSpecificTimeSlots를 실시간으로 재생성
      for (const negotiation of accessibleNegotiations) {
         if (negotiation.type === 'full_conflict') {
            await regenerateMemberSpecificTimeSlots(negotiation, room);
         }
      }

      res.json({ negotiations: accessibleNegotiations });
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

exports.addNegotiationMessage = async (req, res) => {
   try {
      const { roomId, negotiationId } = req.params;
      // Add your message logic here
      res.json({ success: true });
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

exports.resolveNegotiation = async (req, res) => {
   try {
      const { roomId, negotiationId } = req.params;
      // Add your resolve logic here
      res.json({ success: true });
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

exports.respondToNegotiation = async (req, res) => {
   try {
      const { roomId, negotiationId } = req.params;
      const { response, yieldOption, alternativeSlots, chosenSlot } = req.body;
      // response: 'yield', 'claim', 'split_first', 'split_second', 'choose_slot'
      // yieldOption: 'carry_over', 'alternative_time'
      // alternativeSlots: ['2025-09-30-14:00', ...]
      // chosenSlot: { startTime: '13:00', endTime: '14:00' }
      const userId = req.user.id;

      if (!['yield', 'claim', 'split_first', 'split_second', 'choose_slot'].includes(response)) {
         return res.status(400).json({ msg: '유효하지 않은 응답입니다.' });
      }

      const room = await Room.findById(roomId)
         .populate('negotiations.conflictingMembers.user', '_id firstName lastName email')
         .populate('owner', '_id firstName lastName email')
         .populate('members.user', 'firstName lastName email defaultSchedule');

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      const negotiation = room.negotiations.id(negotiationId);
      if (!negotiation) {
         return res.status(404).json({ msg: '협의를 찾을 수 없습니다.' });
      }

      if (negotiation.status !== 'active') {
         return res.status(400).json({ msg: '이미 해결된 협의입니다.' });
      }

      // 💡 full_conflict인 경우 memberSpecificTimeSlots를 실시간으로 재생성
      if (negotiation.type === 'full_conflict') {
         await regenerateMemberSpecificTimeSlots(negotiation, room);
      }

      // 접근 권한 확인: participants (당사자들 + 방장)
      const isParticipant = negotiation.participants.some(p => p.toString() === userId);
      if (!isParticipant) {
         return res.status(403).json({ msg: '이 협의에 참여할 권한이 없습니다.' });
      }

      // 사용자가 conflictingMember인지 확인
      const userMember = negotiation.conflictingMembers.find(cm =>
         (cm.user._id || cm.user).toString() === userId
      );

      if (!userMember) {
         return res.status(403).json({ msg: '협의 당사자만 응답할 수 있습니다.' });
      }

      // 이미 응답했는지 확인
      if (userMember.response && userMember.response !== 'pending') {
         return res.status(400).json({ msg: '이미 응답하셨습니다.' });
      }

      // 💡 다른 협의에 이미 응답했는지 확인 (중복 선택 방지)
      // 💡 같은 주의 협의만 체크 (weekStartDate가 같은 경우)
      const otherActiveNegotiations = room.negotiations.filter(nego => {
         if (nego.status !== 'active') return false;
         if (nego._id.toString() === negotiationId) return false;

         // 💡 weekStartDate가 있는 경우: 같은 주의 협의만 필터링
         if (negotiation.weekStartDate && nego.weekStartDate) {
            // weekStartDate가 다르면 다른 주차이므로 제외
            if (nego.weekStartDate !== negotiation.weekStartDate) {
               return false;
            }
         }

         return nego.conflictingMembers.some(cm => (cm.user._id || cm.user).toString() === userId);
      });

      const hasRespondedToOtherNego = otherActiveNegotiations.some(nego => {
         const memberInOtherNego = nego.conflictingMembers.find(cm =>
            (cm.user._id || cm.user).toString() === userId
         );
         return memberInOtherNego && memberInOtherNego.response && memberInOtherNego.response !== 'pending';
      });

      if (hasRespondedToOtherNego) {
         return res.status(400).json({
            msg: '이번 주 다른 협의에 이미 응답하셨습니다. 먼저 응답한 협의를 취소하거나 해결한 후 다시 시도해주세요.'
         });
      }

      // 응답 저장
      userMember.response = response;
      userMember.respondedAt = new Date();

      if (response === 'yield') {
         if (!yieldOption || !['carry_over', 'alternative_time'].includes(yieldOption)) {
            return res.status(400).json({ msg: '양보 시 이월 또는 대체시간을 선택해야 합니다.' });
         }
         userMember.yieldOption = yieldOption;

         if (yieldOption === 'alternative_time') {
            if (!alternativeSlots || alternativeSlots.length === 0) {
               return res.status(400).json({ msg: '대체 시간을 선택해주세요.' });
            }
            // 객체 배열을 문자열 배열로 변환: { startTime, endTime, date } -> '날짜-시작시간-종료시간'
            userMember.alternativeSlots = alternativeSlots.map(slot => {
               const slotDate = slot.date || negotiation.slotInfo.date;
               const dateStr = new Date(slotDate).toISOString().split('T')[0];
               return `${dateStr}-${slot.startTime}-${slot.endTime}`;
            });
         }
      } else if (response === 'claim') {
         // 주장할 때도 chosenSlot 저장 (time_slot_choice에서 선택한 시간)
         if (chosenSlot && chosenSlot.startTime && chosenSlot.endTime) {
            userMember.chosenSlot = chosenSlot;
         } else {
         }
      } else if (response === 'choose_slot') {
         if (!chosenSlot || !chosenSlot.startTime || !chosenSlot.endTime) {
            return res.status(400).json({ msg: '시간대를 선택해주세요.' });
         }
         userMember.chosenSlot = chosenSlot;

         // 💡 다른 멤버가 이미 겹치는 시간을 선택했는지 확인
         const chosenDate = chosenSlot.date || negotiation.slotInfo.date;
         const chosenDateObj = new Date(chosenDate);

         // chosenSlot의 시간 파싱 (안전하게 처리)
         let currentStartMinutes, currentEndMinutes;
         try {
            const [startH, startM] = chosenSlot.startTime.split(':').map(Number);
            const [endH, endM] = chosenSlot.endTime.split(':').map(Number);
            currentStartMinutes = startH * 60 + startM;
            currentEndMinutes = endH * 60 + endM;
         } catch (error) {
            return res.status(400).json({ msg: '시간 형식이 올바르지 않습니다.' });
         }

         let hasConflict = false;
         let conflictingMemberName = null;

         for (const otherMember of negotiation.conflictingMembers) {
            const otherUserId = (otherMember.user._id || otherMember.user).toString();
            if (otherUserId === userId) continue; // 자기 자신은 스킵
            if (!otherMember.chosenSlot) continue; // 아직 선택 안 한 멤버는 스킵

            // otherMember.chosenSlot의 시간 파싱 (안전하게 처리)
            let otherStartMinutes, otherEndMinutes;
            try {
               if (!otherMember.chosenSlot.startTime || !otherMember.chosenSlot.endTime) {
                  continue;
               }
               const [otherStartH, otherStartM] = otherMember.chosenSlot.startTime.split(':').map(Number);
               const [otherEndH, otherEndM] = otherMember.chosenSlot.endTime.split(':').map(Number);
               otherStartMinutes = otherStartH * 60 + otherStartM;
               otherEndMinutes = otherEndH * 60 + otherEndM;
            } catch (error) {
               continue;
            }

            // 시간 겹침 확인 (날짜는 같은 협의이므로 체크 불필요)
            if (!(currentEndMinutes <= otherStartMinutes || currentStartMinutes >= otherEndMinutes)) {
               hasConflict = true;
               conflictingMemberName = otherMember.user.firstName || otherMember.user.name || '다른 멤버';
               break;
            }
         }

         // 💡 충돌이 발견되면 full_conflict로 전환하고 슬롯 추가하지 않음
         if (hasConflict) {
            negotiation.type = 'full_conflict';

            // 💡 slotInfo를 실제 충돌한 시간대로 업데이트
            negotiation.slotInfo.startTime = chosenSlot.startTime;
            negotiation.slotInfo.endTime = chosenSlot.endTime;

            // 기존에 추가된 chosenSlot 슬롯들을 모두 제거 (현재 협의 날짜만)
            const conflictingMemberIds = negotiation.conflictingMembers.map(cm =>
               (cm.user._id || cm.user).toString()
            );
            const negotiationDateStr = new Date(negotiation.slotInfo.date).toISOString().split('T')[0];

            // 💡 충돌한 시간대의 슬롯만 삭제 (다른 시간대의 슬롯은 유지)
            const [conflictStartH, conflictStartM] = negotiation.slotInfo.startTime.split(':').map(Number);
            const [conflictEndH, conflictEndM] = negotiation.slotInfo.endTime.split(':').map(Number);
            const conflictStartMinutes = conflictStartH * 60 + conflictStartM;
            const conflictEndMinutes = conflictEndH * 60 + conflictEndM;

            room.timeSlots = room.timeSlots.filter(slot => {
               const isNegotiationChoice = slot.subject === '협의 응답 (시간선택)';
               if (!isNegotiationChoice) return true;

               const slotUserId = slot.user._id ? slot.user._id.toString() : slot.user.toString();
               const slotDateStr = new Date(slot.date).toISOString().split('T')[0];

               // 현재 협의의 날짜이고, 협의 멤버의 슬롯인 경우
               if (conflictingMemberIds.includes(slotUserId) && slotDateStr === negotiationDateStr) {
                  // 💡 충돌한 시간대와 겹치는지 확인
                  const [slotStartH, slotStartM] = slot.startTime.split(':').map(Number);
                  const [slotEndH, slotEndM] = slot.endTime.split(':').map(Number);
                  const slotStartMinutes = slotStartH * 60 + slotStartM;
                  const slotEndMinutes = slotEndH * 60 + slotEndM;

                  // 슬롯이 충돌 시간대와 겹치면 삭제
                  const overlaps = !(slotEndMinutes <= conflictStartMinutes || slotStartMinutes >= conflictEndMinutes);
                  if (overlaps) {
                     return false;
                  }
               }
               return true;
            });

            // 모든 멤버의 response를 pending으로 초기화
            negotiation.conflictingMembers.forEach(cm => {
               cm.response = 'pending';
               cm.chosenSlot = undefined;
            });

            negotiation.messages.push({
               message: `선택한 시간대가 겹칩니다. 양보하거나 주장하여 해결하세요. 둘 다 주장하면 랜덤으로 결정됩니다.`,
               timestamp: new Date(),
               isSystemMessage: true
            });

            negotiation.memberSpecificTimeSlots = {};

            const dayString = negotiation.slotInfo.day;
            const conflictDate = new Date(negotiation.slotInfo.date);
            const conflictDateStr = conflictDate.toISOString().split('T')[0];

            for (const cm of negotiation.conflictingMembers) {
               const memberId = (cm.user._id || cm.user).toString();
               const roomMember = room.members.find(m => {
                  const mUserId = m.user._id ? m.user._id.toString() : m.user.toString();
                  return mUserId === memberId;
               });

               if (roomMember && roomMember.user && roomMember.user.defaultSchedule) {
                  // 💡 모든 요일의 선호 시간 가져오기 (협의 발생한 요일 포함)
                  const dayMap = { 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 0 };
                  const conflictDayOfWeek = dayMap[dayString];

                  // 모든 선호 시간 가져오기 (priority >= 2)
                  const dayPreferences = roomMember.user.defaultSchedule.filter(sched =>
                     sched.priority >= 2
                  );


                  // 현재 멤버의 기존 배정 슬롯 확인
                  const memberExistingSlots = room.timeSlots.filter(slot => {
                     const slotUserId = slot.user._id ? slot.user._id.toString() : slot.user.toString();
                     return slotUserId === memberId;
                  });

                  // 💡 멤버가 필요한 시간 계산
                  const requiredSlots = cm.requiredSlots || 2;
                  const requiredMinutes = requiredSlots * 30;

                  // 요일별로 그룹화
                  const dayMap2 = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                  const prefsByDay = {};

                  dayPreferences.forEach(pref => {
                     const dayName = dayMap2[pref.dayOfWeek];
                     if (!prefsByDay[dayName]) prefsByDay[dayName] = [];
                     prefsByDay[dayName].push(pref);
                  });

                  const memberOptions = [];

                  // 각 요일마다 처리
                  for (const [dayName, prefs] of Object.entries(prefsByDay)) {
                     // 연속된 시간 블록 병합 (10분 이내 간격은 허용)
                     const sortedPrefs = prefs.sort((a, b) => a.startTime.localeCompare(b.startTime));
                     const mergedBlocks = [];

                     for (const pref of sortedPrefs) {
                        if (mergedBlocks.length === 0) {
                           mergedBlocks.push({ startTime: pref.startTime, endTime: pref.endTime });
                        } else {
                           const lastBlock = mergedBlocks[mergedBlocks.length - 1];
                           // 💡 10분 이내 간격이면 병합 (선호시간 사이의 작은 간격 무시)
                           const [lastEndH, lastEndM] = lastBlock.endTime.split(':').map(Number);
                           const [prefStartH, prefStartM] = pref.startTime.split(':').map(Number);
                           const lastEndMinutes = lastEndH * 60 + lastEndM;
                           const prefStartMinutes = prefStartH * 60 + prefStartM;
                           const gap = prefStartMinutes - lastEndMinutes;

                           if (gap <= 10) {
                              // 10분 이내 간격이면 병합
                              lastBlock.endTime = pref.endTime;
                           } else {
                              mergedBlocks.push({ startTime: pref.startTime, endTime: pref.endTime });
                           }
                        }
                     }


                     // 해당 요일의 실제 날짜 계산 (이번 주)
                     const targetDayIndex = dayMap2.indexOf(dayName);
                     const currentDate = new Date(conflictDate);
                     const currentDayIndex = currentDate.getDay();
                     let daysToAdd = targetDayIndex - currentDayIndex;
                     if (daysToAdd < 0) daysToAdd += 7;

                     const targetDate = new Date(currentDate);
                     targetDate.setDate(currentDate.getDate() + daysToAdd);
                     const targetDateStr = targetDate.toISOString().split('T')[0];

                     // 💡 협의 발생 날짜인지 확인
                     const isConflictDate = targetDateStr === conflictDateStr;

                     // 이미 배정받은 시간 제외하고 슬라이딩 윈도우로 옵션 생성
                     for (const block of mergedBlocks) {

                        // 💡 이 블록과 겹치는 모든 멤버의 기존 슬롯 찾기
                        const overlappingSlots = room.timeSlots
                           .filter(slot => {
                              const slotDate = new Date(slot.date);
                              if (slotDate.toDateString() !== targetDate.toDateString()) return false;
                              return !(slot.endTime <= block.startTime || block.endTime <= slot.startTime);
                           })
                           .sort((a, b) => a.startTime.localeCompare(b.startTime));

                        // 가용 시간대 계산 (블록 분할)
                        const availableRanges = [];
                        if (overlappingSlots.length === 0) {
                           availableRanges.push({ startTime: block.startTime, endTime: block.endTime });
                        } else {
                           let currentStart = block.startTime;
                           for (const assigned of overlappingSlots) {
                              if (currentStart < assigned.startTime) {
                                 availableRanges.push({
                                    startTime: currentStart,
                                    endTime: assigned.startTime
                                 });
                              }
                              currentStart = assigned.endTime > currentStart ? assigned.endTime : currentStart;
                           }
                           if (currentStart < block.endTime) {
                              availableRanges.push({
                                 startTime: currentStart,
                                 endTime: block.endTime
                              });
                           }
                        }

                        // 💡 각 가용 범위에서 필요한 시간 단위로 슬라이딩하여 옵션 생성
                        for (const range of availableRanges) {
                           const [startH, startM] = range.startTime.split(':').map(Number);
                           const [endH, endM] = range.endTime.split(':').map(Number);
                           const rangeStartMinutes = startH * 60 + startM;
                           const rangeEndMinutes = endH * 60 + endM;
                           const rangeDuration = rangeEndMinutes - rangeStartMinutes;

                           // 필요한 시간보다 짧으면 스킵
                           if (rangeDuration < requiredMinutes) {
                              continue;
                           }

                           // 💡 원래 협의 발생한 시간 확인
                           const [origStartH, origStartM] = negotiation.slotInfo.startTime.split(':').map(Number);
                           const [origEndH, origEndM] = negotiation.slotInfo.endTime.split(':').map(Number);
                           const origStartMinutes = origStartH * 60 + origStartM;
                           const origEndMinutes = origEndH * 60 + origEndM;

                           // 필요한 시간 단위로 슬라이딩
                           for (let slideStart = rangeStartMinutes; slideStart + requiredMinutes <= rangeEndMinutes; slideStart += requiredMinutes) {
                              const optionStartTime = `${Math.floor(slideStart/60).toString().padStart(2,'0')}:${(slideStart%60).toString().padStart(2,'0')}`;
                              const optionEndTime = `${Math.floor((slideStart+requiredMinutes)/60).toString().padStart(2,'0')}:${((slideStart+requiredMinutes)%60).toString().padStart(2,'0')}`;
                              const optionStartMinutes = slideStart;
                              const optionEndMinutes = slideStart + requiredMinutes;

                              // 협의 발생 날짜에서만 충돌 시간대와 겹치는지 확인
                              if (isConflictDate) {
                                 const overlapsConflict = !(optionEndMinutes <= origStartMinutes || optionStartMinutes >= origEndMinutes);
                                 if (overlapsConflict) {
                                    continue;
                                 }
                              }

                              memberOptions.push({
                                 startTime: optionStartTime,
                                 endTime: optionEndTime,
                                 date: targetDate,
                                 day: dayName
                              });
                           }
                        }
                     }
                  }

                  negotiation.memberSpecificTimeSlots[memberId] = memberOptions;
               } else {
                  negotiation.memberSpecificTimeSlots[memberId] = [];
               }
            }

            await room.save();
            const updatedRoom = await Room.findById(roomId)
               .populate('owner', 'firstName lastName email')
               .populate('members.user', 'firstName lastName email')
               .populate('negotiations.conflictingMembers.user', 'firstName lastName email');

            const updatedNegotiation = updatedRoom.negotiations.id(negotiation._id);

            return res.json({
               msg: '시간대가 겹쳐 양보/주장 단계로 전환되었습니다.',
               room: updatedRoom,
               negotiation: updatedNegotiation
            });
         }

         // 💡 충돌이 없으면 즉시 슬롯 추가
         const dayOfWeek = chosenDateObj.getDay();
         const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
         const chosenDay = dayMap[dayOfWeek];

         // 30분 단위로 분할
         for (let currentMinutes = currentStartMinutes; currentMinutes < currentEndMinutes; currentMinutes += 30) {
            const slotStartTime = `${Math.floor(currentMinutes/60).toString().padStart(2,'0')}:${(currentMinutes%60).toString().padStart(2,'0')}`;
            const slotEndTime = `${Math.floor((currentMinutes+30)/60).toString().padStart(2,'0')}:${((currentMinutes+30)%60).toString().padStart(2,'0')}`;

            const existingSlot = room.timeSlots.find(slot =>
               slot.user.toString() === userId &&
               slot.date.toISOString() === chosenDateObj.toISOString() &&
               slot.startTime === slotStartTime &&
               slot.endTime === slotEndTime
            );

            if (!existingSlot) {
               room.timeSlots.push({
                  user: userId,
                  date: chosenDateObj,
                  startTime: slotStartTime,
                  endTime: slotEndTime,
                  day: chosenDay,
                  subject: '협의 응답 (시간선택)',
                  status: 'confirmed',
                  assignedBy: userId
               });
            }
         }
      }

      // 시스템 메시지 추가
      const userName = userMember.user.firstName || userMember.user.name || '멤버';
      let responseText = '';
      if (response === 'yield') {
         responseText = yieldOption === 'carry_over' ? '양보하고 이월하기로 했습니다' : '양보하고 다른 시간을 선택했습니다';
      } else if (response === 'claim') {
         responseText = '이 시간을 원한다고 주장했습니다';
      } else if (response === 'split_first') {
         responseText = '앞 시간대를 선택했습니다';
      } else if (response === 'split_second') {
         responseText = '뒤 시간대를 선택했습니다';
      } else if (response === 'choose_slot') {
         responseText = `${chosenSlot.startTime}-${chosenSlot.endTime} 시간대를 선택했습니다`;
      }

      negotiation.messages.push({
         message: `${userName}님이 ${responseText}.`,
         timestamp: new Date(),
         isSystemMessage: true
      });

      // 협의 해결 조건 확인
      const allResponded = negotiation.conflictingMembers.every(cm =>
         cm.response && cm.response !== 'pending'
      );

      // 부분 양보 확인: n명 중 n-1명이 양보했는지
      const yieldedCount = negotiation.conflictingMembers.filter(cm => cm.response === 'yield').length;
      const claimedCount = negotiation.conflictingMembers.filter(cm => cm.response === 'claim').length;
      const pendingCount = negotiation.conflictingMembers.filter(cm => cm.response === 'pending').length;
      const totalMembers = negotiation.conflictingMembers.length;

      // n-1명이 양보하고 나머지 1명이 pending이거나 claim인 경우
      const canResolvePartially = (yieldedCount === totalMembers - 1 && (claimedCount === 1 || pendingCount === 1));

      // 분할 협의 확인: 2명이 각각 앞/뒤 시간 선택
      const splitFirstCount = negotiation.conflictingMembers.filter(cm => cm.response === 'split_first').length;
      const splitSecondCount = negotiation.conflictingMembers.filter(cm => cm.response === 'split_second').length;
      const canResolveSplit = (splitFirstCount === 1 && splitSecondCount === 1);

      // 1. 모든 멤버가 응답했거나
      // 2. n-1명이 양보했거나 (부분 양보)
      // 3. 분할 협의가 성립했으면 바로 해결
      if (allResponded || canResolvePartially || canResolveSplit) {

         // 부분 양보인 경우, pending인 사람을 자동으로 claim으로 설정
         if (canResolvePartially && pendingCount === 1) {
            const pendingMember = negotiation.conflictingMembers.find(cm => cm.response === 'pending');
            if (pendingMember) {
               pendingMember.response = 'claim';
            }
         }

         await handleNegotiationResolution(room, negotiation, userId);
      }

      await room.save();

      const memberSatisfactionMap = {}; // memberId -> isSatisfied

      // 💡 현재 주의 시작일과 종료일 계산 (weekStartDate 기준)
      const currentWeekStart = negotiation.weekStartDate ? new Date(negotiation.weekStartDate) : null;
      let currentWeekEnd = null;
      if (currentWeekStart) {
         currentWeekEnd = new Date(currentWeekStart);
         currentWeekEnd.setDate(currentWeekStart.getDate() + 7); // 7일 후
      }

      // 1. 방에 있는 모든 멤버에 대해 만족도 맵을 생성한다.
      for (const member of room.members) {
         const memberId = (member.user._id || member.user).toString();
         // room.settings에서 주당 최소 시간을 가져오고, 없으면 2슬롯(1시간)을 기본값으로 사용
         const requiredSlots = (room.settings.minTime / 30) || 2;

         // 💡 현재 주의 슬롯만 카운트
         const assignedSlots = room.timeSlots.filter(slot => {
            const slotUserId = slot.user._id ? slot.user._id.toString() : slot.user.toString();
            if (slotUserId !== memberId) return false;

            // 💡 weekStartDate가 있으면 현재 주의 슬롯만 계산
            if (currentWeekStart && currentWeekEnd) {
               const slotDate = new Date(slot.date);
               return slotDate >= currentWeekStart && slotDate < currentWeekEnd;
            }

            return true;
         }).length;

         const isSatisfied = assignedSlots >= requiredSlots;
         memberSatisfactionMap[memberId] = isSatisfied;

      }

      let autoResolvedCount = 0;

      // 2. 현재 협의를 포함한 모든 활성 협의를 순회한다.
      room.negotiations.forEach(nego => {
         if (nego.status !== 'active') return;

         // 💡 같은 주의 협의만 자동 해결 (weekStartDate가 다르면 스킵)
         if (negotiation.weekStartDate && nego.weekStartDate) {
            if (nego.weekStartDate !== negotiation.weekStartDate) {
               return; // 다른 주의 협의는 건드리지 않음
            }
         }

         const negoMemberIds = nego.conflictingMembers.map(m =>
            (m.user._id || m.user).toString()
         );

         // 3. 해당 협의의 모든 멤버가 '처리'되었는지 확인한다.
         const allMembersAccountedFor = negoMemberIds.every(id => {
            // 조건 1: 멤버의 시간이 완전히 할당되어 만족한 경우
            if (memberSatisfactionMap[id]) {
               return true;
            }

            // 조건 2: 현재 처리된 협의에서 해당 멤버가 '이월'을 선택한 경우
            const justResolvedNego = negotiation; // 응답이 들어온 바로 그 협의
            if (justResolvedNego.status === 'resolved') {
                const memberInThatNego = justResolvedNego.conflictingMembers.find(m => (m.user._id || m.user).toString() === id);
                if (memberInThatNego && memberInThatNego.yieldOption === 'carry_over') {
                    return true;
                }
            }
            return false;
         });

         // 💡 현재 응답이 들어온 협의인 경우:
         // 시간이 충족되지 않은 멤버는 모두 응답해야 함
         if (nego._id.toString() === negotiation._id.toString()) {
            const allRequiredMembersResponded = nego.conflictingMembers.every(m => {
               const memberId = (m.user._id || m.user).toString();

               // 이미 시간이 충족된 멤버는 응답 안 해도 됨
               if (memberSatisfactionMap[memberId]) {
                  return true;
               }

               // 시간이 충족되지 않은 멤버는 응답해야 함
               return m.response && m.response !== 'pending';
            });

            if (!allRequiredMembersResponded) {
               // 아직 응답하지 않은 멤버가 있으면 자동 해결 불가
               return;
            }
         }

         if (allMembersAccountedFor) {

            nego.status = 'resolved';
            nego.resolution = {
               type: 'auto_resolved',
               resolvedAt: new Date(),
               resolvedBy: userId,
               reason: 'all_members_accounted_for'
            };

            nego.messages.push({
               message: `모든 참여 멤버의 필요 시간이 충족되거나 이월되어 협의가 자동으로 해결되었습니다.`,
               timestamp: new Date(),
               isSystemMessage: true
            });

            autoResolvedCount++;
         }
      });

      if (autoResolvedCount > 0) {
         await room.save();
      } else {
      }

      // 업데이트된 협의 정보 반환
      const updatedRoom = await Room.findById(roomId)
         .populate('owner', 'firstName lastName email')
         .populate('members.user', 'firstName lastName email')
         .populate('timeSlots.user', '_id firstName lastName email')
         .populate('negotiations.conflictingMembers.user', '_id firstName lastName email')
         .populate('negotiations.resolution.assignments.user', '_id firstName lastName email');

      const updatedNegotiation = updatedRoom.negotiations.id(negotiationId);

      updatedRoom.members.forEach(m => {
         const userId = m.user._id || m.user;
      });

      res.json({
         success: true,
         negotiation: updatedNegotiation,
         room: updatedRoom
      });

   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// 💡 협의 응답 취소 기능
exports.cancelNegotiationResponse = async (req, res) => {
   try {
      const { roomId, negotiationId } = req.params;
      const userId = req.user.id;

      const room = await Room.findById(roomId)
         .populate('negotiations.conflictingMembers.user', '_id firstName lastName email')
         .populate('owner', '_id firstName lastName email')
         .populate('members.user', 'firstName lastName email defaultSchedule');

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      const negotiation = room.negotiations.id(negotiationId);
      if (!negotiation) {
         return res.status(404).json({ msg: '협의를 찾을 수 없습니다.' });
      }

      if (negotiation.status !== 'active') {
         return res.status(400).json({ msg: '이미 해결된 협의는 취소할 수 없습니다.' });
      }

      const userMember = negotiation.conflictingMembers.find(cm =>
         (cm.user._id || cm.user).toString() === userId
      );

      if (!userMember) {
         return res.status(403).json({ msg: '협의 당사자만 취소할 수 있습니다.' });
      }

      if (!userMember.response || userMember.response === 'pending') {
         return res.status(400).json({ msg: '취소할 응답이 없습니다.' });
      }

      // 💡 choose_slot으로 추가된 슬롯 삭제
      if (userMember.response === 'choose_slot' && userMember.chosenSlot) {
         const negotiationDateStr = new Date(negotiation.slotInfo.date).toISOString().split('T')[0];
         room.timeSlots = room.timeSlots.filter(slot => {
            const isNegotiationChoice = slot.subject === '협의 응답 (시간선택)';
            if (!isNegotiationChoice) return true;

            const slotUserId = slot.user._id ? slot.user._id.toString() : slot.user.toString();
            const slotDateStr = new Date(slot.date).toISOString().split('T')[0];

            if (slotUserId === userId && slotDateStr === negotiationDateStr) {
               return false;
            }
            return true;
         });
      }

      // 응답 초기화
      userMember.response = 'pending';
      userMember.chosenSlot = undefined;
      userMember.yieldOption = undefined;
      userMember.alternativeSlots = undefined;
      userMember.respondedAt = undefined;

      negotiation.messages.push({
         message: `${userMember.user.firstName || '멤버'}님이 응답을 취소했습니다.`,
         timestamp: new Date(),
         isSystemMessage: true
      });

      await room.save();

      const updatedRoom = await Room.findById(roomId)
         .populate('owner', 'firstName lastName email')
         .populate('members.user', 'firstName lastName email')
         .populate('negotiations.conflictingMembers.user', '_id firstName lastName email')
         .populate('negotiations.resolution.assignments.user', '_id firstName lastName email');

      const updatedNegotiation = updatedRoom.negotiations.id(negotiationId);

      res.json({
         success: true,
         negotiation: updatedNegotiation,
         room: updatedRoom
      });

   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

exports.autoResolveTimeoutNegotiations = async (req, res) => {
   try {
      const { roomId } = req.params;
      // Add your auto-resolve logic here
      res.json({ success: true });
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

exports.forceResolveNegotiation = async (req, res) => {
   try {
      const { roomId, negotiationId } = req.params;
      // Add your force resolve logic here
      res.json({ success: true });
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// Keep complex functions that weren't moved yet
// @desc    Handle a request
// @route   POST /api/coordination/requests/:requestId/handle
// @access  Private (Room Owner/Target User)
exports.createRequest = async (req, res) => {
   try {
      const { roomId, type, targetUserId, targetSlot, timeSlot, message } = req.body;

      if (!roomId || !type || !timeSlot) {
         return res.status(400).json({ msg: '필수 필드가 누락되었습니다.' });
      }

      const room = await Room.findById(roomId);

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      // 방장은 시간표 교환요청을 할 수 없음
      if (room.owner.toString() === req.user.id) {
         return res.status(403).json({ msg: '방장은 시간표 교환요청을 할 수 없습니다.' });
      }

      const hasDuplicateRequest = room.requests.some(
         request =>
            request.requester.toString() === req.user.id &&
            request.status === 'pending' &&
            request.timeSlot.day === timeSlot.day &&
            request.timeSlot.startTime === timeSlot.startTime &&
            request.timeSlot.endTime === timeSlot.endTime &&
            ((type === 'slot_swap' || type === 'time_request') ? request.targetUser?.toString() === targetUserId : true),
      );

      if (hasDuplicateRequest) {
         return res.status(400).json({ msg: '동일한 요청이 이미 존재합니다.', duplicateRequest: true });
      }

      const requestData = {
         requester: req.user.id,
         type,
         timeSlot,
         message: message || '',
         status: 'pending',
         createdAt: new Date(),
      };

      if ((type === 'slot_swap' || type === 'time_request') && targetUserId) {
         requestData.targetUser = targetUserId;
         if (targetSlot) {
            requestData.targetSlot = targetSlot;
         }
      }

      room.requests.push(requestData);
      await room.save();

      const populatedRoom = await Room.findById(roomId)
         .populate('requests.requester', 'firstName lastName email')
         .populate('requests.targetUser', 'firstName lastName email');

      res.json(populatedRoom);
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};


  // @desc    Handle a request (approve/reject)
  // @route   POST /api/coordination/requests/:requestId/:action
  // @access  Private
  exports.handleRequest = async (req, res) => {
     try {
        const { requestId, action } = req.params;
        const { message } = req.body;

        if (!['approved', 'rejected'].includes(action)) {
           return res.status(400).json({ msg: '유효하지 않은 액션입니다. approved 또는 rejected만 허용됩니다.' });
        }

        const room = await Room.findOne({ 'requests._id': requestId })
           .populate('requests.requester', 'firstName lastName email')
           .populate('requests.targetUser', 'firstName lastName email')
           .populate('timeSlots.user', '_id firstName lastName email')
           .populate('members.user', 'firstName lastName email');

        if (!room) {
           return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
        }

        const request = room.requests.id(requestId);
        if (!request) {
           return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
        }

        // --- FINAL BUG FIX (AGAIN) ---
        const isOwner = room.isOwner(req.user.id);
        let isTargetUser = false;
        if (request.targetUser) {
          // Handle both populated object and plain ObjectId string
          const targetId = request.targetUser._id ? request.targetUser._id.toString() : request.targetUser.toString();
          if (targetId === req.user.id) {
            isTargetUser = true;
          }
        }
        // --- FINAL BUG FIX END ---

        if (!isOwner && !isTargetUser) {
           return res.status(403).json({ msg: '이 요청을 처리할 권한이 없습니다.' });
        }

        if (request.status !== 'pending') {
           return res.status(400).json({ msg: '이미 처리된 요청입니다.' });
        }

        const now = new Date();
        request.status = action;
        request.respondedAt = now;
        request.respondedBy = req.user.id;
        request.response = message || '';

        if (action === 'approved') {
           const { type, timeSlot, targetUser, requester } = request;

           if (type === 'slot_release') {
              // Remove the slot from the requester
              room.timeSlots = room.timeSlots.filter(slot => {
                 const slotUserId = slot.user._id || slot.user;
                 return !(
                    slotUserId.toString() === requester._id.toString() &&
                    slot.day === timeSlot.day &&
                    slot.startTime === timeSlot.startTime
                 );
              });
              room.markModified('timeSlots');
           } else if (type === 'slot_swap' && targetUser) {
              const targetSlotIndex = room.timeSlots.findIndex(slot =>
                  slot.user &&
                  slot.user._id.toString() === targetUser._id.toString() &&
                  slot.day === timeSlot.day &&
                  slot.startTime === timeSlot.startTime
              );

              if (targetSlotIndex !== -1) {
                  room.timeSlots[targetSlotIndex].user = requester._id;
                  room.markModified('timeSlots');
              }
           } else if (type === 'time_request' || type === 'time_change') {
              // For time_request, transfer the timeslot from target user to requester
              if (targetUser) {
                 // 시간 범위 겹침 체크 헬퍼 함수
                 const timeRangesOverlap = (start1, end1, start2, end2) => {
                    const toMinutes = (timeStr) => {
                       const [h, m] = timeStr.split(':').map(Number);
                       return h * 60 + m;
                    };
                    const s1 = toMinutes(start1);
                    const e1 = toMinutes(end1);
                    const s2 = toMinutes(start2);
                    const e2 = toMinutes(end2);
                    return s1 < e2 && s2 < e1;
                 };

                 // 중복 방지: 요청자에게 이미 겹치는 슬롯이 있는지 확인
                 const requesterHasSlot = room.timeSlots.some(slot => {
                    const slotUserId = slot.user._id || slot.user;

                    // 유저가 다르면 false
                    if (slotUserId.toString() !== requester._id.toString()) return false;

                    // 요일이 다르면 false
                    if (slot.day !== timeSlot.day) return false;

                    // 날짜 비교 (요청에 date가 있는 경우)
                    if (timeSlot.date && slot.date) {
                       const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
                       const requestDateStr = new Date(timeSlot.date).toISOString().split('T')[0];
                       if (slotDateStr !== requestDateStr) return false;
                    }

                    // 시간 범위 겹침 체크
                    return timeRangesOverlap(
                       slot.startTime,
                       slot.endTime,
                       timeSlot.startTime,
                       timeSlot.endTime
                    );
                 });

                 if (requesterHasSlot) {
                    // 중복이므로 아무것도 하지 않음 (요청 상태는 approved로 변경됨)
                 } else {
                    // 시간 범위 겹침 체크 헬퍼 함수
                    const timeRangesOverlap = (start1, end1, start2, end2) => {
                       // "HH:MM" 형식을 분으로 변환
                       const toMinutes = (timeStr) => {
                          const [h, m] = timeStr.split(':').map(Number);
                          return h * 60 + m;
                       };
                       const s1 = toMinutes(start1);
                       const e1 = toMinutes(end1);
                       const s2 = toMinutes(start2);
                       const e2 = toMinutes(end2);

                       // 겹침: s1 < e2 && s2 < e1
                       // 포함 또는 부분 겹침도 모두 포함
                       return s1 < e2 && s2 < e1;
                    };

                    // 요청 시간에 겹치는 모든 타겟 슬롯 찾기 (복수 개 가능)
                    const overlappingSlots = room.timeSlots.filter(slot => {
                       const slotUserId = slot.user._id || slot.user;

                       // 유저 매칭
                       if (slotUserId.toString() !== targetUser._id.toString()) return false;

                       // 요일 매칭
                       if (slot.day !== timeSlot.day) return false;

                       // 날짜 비교 (요청에 date가 있는 경우)
                       if (timeSlot.date) {
                          if (!slot.date) return false;
                          const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
                          const requestDateStr = new Date(timeSlot.date).toISOString().split('T')[0];
                          if (slotDateStr !== requestDateStr) return false;
                       }

                       // 시간 범위 겹침 체크
                       return timeRangesOverlap(
                          slot.startTime,
                          slot.endTime,
                          timeSlot.startTime,
                          timeSlot.endTime
                       );
                    });

                    if (overlappingSlots.length > 0) {
                       // 겹치는 슬롯들을 정렬
                       overlappingSlots.sort((a, b) => {
                          const aTime = a.startTime.split(':').map(Number);
                          const bTime = b.startTime.split(':').map(Number);
                          return (aTime[0] * 60 + aTime[1]) - (bTime[0] * 60 + bTime[1]);
                       });

                       const firstSlot = overlappingSlots[0];
                       const lastSlot = overlappingSlots[overlappingSlots.length - 1];

                       // 시간을 분으로 변환하는 헬퍼 함수
                       const toMinutes = (timeStr) => {
                          const [h, m] = timeStr.split(':').map(Number);
                          return h * 60 + m;
                       };

                       // 분을 시간으로 변환하는 헬퍼 함수
                       const toTimeString = (minutes) => {
                          const h = Math.floor(minutes / 60);
                          const m = minutes % 60;
                          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                       };

                       const requestStart = toMinutes(timeSlot.startTime);
                       const requestEnd = toMinutes(timeSlot.endTime);

                       // 남은 시간 조각들을 저장할 배열
                       const remainingSlots = [];

                       overlappingSlots.forEach(slot => {
                          const slotStart = toMinutes(slot.startTime);
                          const slotEnd = toMinutes(slot.endTime);

                          // 요청 시간 전에 남은 부분
                          if (slotStart < requestStart) {
                             const beforeEnd = Math.min(slotEnd, requestStart);
                             remainingSlots.push({
                                user: targetUser._id,
                                date: slot.date,
                                startTime: slot.startTime,
                                endTime: toTimeString(beforeEnd),
                                day: slot.day,
                                subject: slot.subject,
                                status: slot.status,
                                assignedBy: slot.assignedBy
                             });
                          }

                          // 요청 시간 후에 남은 부분
                          if (slotEnd > requestEnd) {
                             const afterStart = Math.max(slotStart, requestEnd);
                             remainingSlots.push({
                                user: targetUser._id,
                                date: slot.date,
                                startTime: toTimeString(afterStart),
                                endTime: slot.endTime,
                                day: slot.day,
                                subject: slot.subject,
                                status: slot.status,
                                assignedBy: slot.assignedBy
                             });
                          }
                       });

                       // 모든 겹치는 슬롯 제거
                       overlappingSlots.forEach(slot => {
                          const index = room.timeSlots.findIndex(s => s._id.equals(slot._id));
                          if (index !== -1) {
                             room.timeSlots.splice(index, 1);
                          }
                       });
                       room.markModified('timeSlots');

                       // 요청자에게 요청한 시간 슬롯 추가
                       room.timeSlots.push({
                          user: requester._id,
                          date: firstSlot.date,
                          startTime: timeSlot.startTime,
                          endTime: timeSlot.endTime,
                          day: timeSlot.day,
                          subject: firstSlot.subject || '양보받은 시간',
                          status: 'confirmed',
                          assignedBy: req.user.id
                       });

                       // 남은 시간 조각들을 원래 소유자에게 다시 추가
                       remainingSlots.forEach(slot => {
                          room.timeSlots.push(slot);
                       });

                    } else {

                       // 타겟 슬롯이 없는 경우 (아직 배정되지 않은 시간) 새 슬롯 생성
                       const calculateDateFromDay = (dayName) => {
                          const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                          const dayIndex = daysOfWeek.indexOf(dayName.toLowerCase());
                          if (dayIndex === -1) return new Date();

                          const currentDate = new Date();
                          const currentDay = currentDate.getDay();
                          const diff = dayIndex - currentDay;
                          const targetDate = new Date(currentDate);
                          targetDate.setDate(currentDate.getDate() + diff);
                          return targetDate;
                       };

                       room.timeSlots.push({
                          user: requester._id,
                          date: timeSlot.date || calculateDateFromDay(timeSlot.day),
                          startTime: timeSlot.startTime,
                          endTime: timeSlot.endTime,
                          day: timeSlot.day,
                          subject: timeSlot.subject || '양보받은 시간',
                          status: 'confirmed',
                          assignedBy: req.user.id
                       });
                    }
                 }
              } else {
                 // If no target user (slot_release type), just add the slot to requester
                 const calculateDateFromDay = (dayName) => {
                    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                    const dayIndex = daysOfWeek.indexOf(dayName.toLowerCase());
                    if (dayIndex === -1) return new Date();

                    const currentDate = new Date();
                    const currentDay = currentDate.getDay();
                    const diff = dayIndex - currentDay;
                    const targetDate = new Date(currentDate);
                    targetDate.setDate(currentDate.getDate() + diff);
                    return targetDate;
                 };

                 room.timeSlots.push({
                    user: requester._id,
                    date: calculateDateFromDay(timeSlot.day),
                    startTime: timeSlot.startTime,
                    endTime: timeSlot.endTime,
                    day: timeSlot.day,
                    subject: timeSlot.subject || '승인된 요청',
                    status: 'confirmed'
                 });
              }
           }
        }

        await room.save();

        const updatedRoom = await Room.findById(room._id)
           .populate('requests.requester', 'firstName lastName email')
           .populate('requests.targetUser', 'firstName lastName email')
           .populate('timeSlots.user', '_id firstName lastName email')
           .populate('members.user', 'firstName lastName email');

        res.json(updatedRoom);
     } catch (error) {
        res.status(500).json({ msg: 'Server error' });
     }
  };

// @desc    Cancel a request
// @route   DELETE /api/coordination/requests/:requestId
// @access  Private (Requester only)
exports.cancelRequest = async (req, res) => {
   try {
      const { requestId } = req.params;

      const room = await Room.findOne({ 'requests._id': requestId });

      if (!room) {
         return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
      }

      const request = room.requests.id(requestId);

      if (!request) {
         return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
      }

      const canDelete = request.requester.toString() === req.user.id ||
                       (request.targetUser && request.targetUser.toString() === req.user.id);

      if (!canDelete) {
         return res.status(403).json({ msg: '요청을 삭제할 권한이 없습니다.' });
      }

      if (request.status === 'pending' && request.requester.toString() !== req.user.id) {
         return res.status(403).json({ msg: '대기 중인 요청은 요청자만 취소할 수 있습니다.' });
      }

      if (request.status === 'pending') {
         request.status = 'cancelled';
         request.respondedAt = new Date();
         request.respondedBy = req.user.id;
         request.response = '요청자에 의해 취소됨';
         await room.save();
         res.json({ msg: '요청이 취소되었습니다.' });
      } else {
         room.requests.pull(requestId);
         await room.save();
         res.json({ msg: '요청 내역이 삭제되었습니다.' });
      }
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    Get all requests sent by the user
// @route   GET /api/coordination/sent-requests
// @access  Private
exports.getSentRequests = async (req, res) => {
   try {
      const userId = req.user.id;

      const rooms = await Room.find({
         $or: [{ owner: userId }, { 'members.user': userId }],
      })
         .populate({
            path: 'requests.requester',
            select: 'firstName lastName email'
         })
         .populate({
            path: 'requests.targetUser',
            select: 'firstName lastName email',
            options: { strictPopulate: false }
         });

      const sentRequests = rooms.flatMap(room =>
         room.requests
           .filter(req => req.requester && req.requester._id.toString() === userId)
           .map(req => ({
             ...req.toObject(),
             roomId: room._id.toString(),
             roomName: room.name
           }))
      );

      res.json({ success: true, requests: sentRequests });
   } catch (error) {
      res.status(500).json({ success: false, msg: 'Server error' });
   }
};

// @desc    Get all requests received by the user
// @route   GET /api/coordination/received-requests
// @access  Private
exports.getReceivedRequests = async (req, res) => {
   try {
      const userId = req.user.id;

      const rooms = await Room.find({
         $or: [{ owner: userId }, { 'members.user': userId }],
      }).populate('requests.requester', 'firstName lastName email');

      const receivedRequests = rooms.flatMap(room => {
         return room.requests.filter(req => {
            const isTarget = req.targetUser && req.targetUser.toString() === userId;
            return isTarget;
         }).map(req => ({ ...req.toObject(), roomId: room._id, roomName: room.name }));
      });

      res.json({ success: true, requests: receivedRequests });
   } catch (error) {
      res.status(500).json({ success: false, msg: 'Server error' });
   }
};

// @desc    Remove a member from a room (owner only)
// @route   DELETE /api/coordination/rooms/:roomId/members/:memberId
// @access  Private (Room Owner only)
exports.removeMember = async (req, res) => {
  try {
    const { roomId, memberId } = req.params;

    // 1. Find the room
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // 2. Validate owner
    if (room.owner.toString() !== req.user.id) {
      return res.status(403).json({ msg: '방장만 조원을 제거할 수 있습니다.' });
    }

    // 3. Prevent owner from removing themselves
    if (room.owner.toString() === memberId) {
      return res.status(400).json({ msg: '방장은 자신을 제거할 수 없습니다.' });
    }

    // 4. Check if member exists in the room
    const initialMemberCount = room.members.length;
    room.members = room.members.filter(member => member.user.toString() !== memberId);

    if (room.members.length === initialMemberCount) {
      return res.status(404).json({ msg: '해당 조원을 찾을 수 없습니다.' });
    }

    // 5. Remove all timeSlots associated with the removed member
    room.timeSlots = room.timeSlots.filter(slot => slot.userId?.toString() !== memberId && slot.user?.toString() !== memberId);

    // 6. Remove all requests associated with the removed member (as requester or target)
    room.requests = room.requests.filter(request =>
      request.requester?.toString() !== memberId &&
      request.targetUser?.toString() !== memberId
    );

    // 7. Get member info for notification
    const removedUser = await User.findById(memberId);

    // 8. Save room
    await room.save();
    await room.populate('owner', 'firstName lastName email');
    await room.populate('members.user', 'firstName lastName email');

    res.json({
      msg: '조원이 성공적으로 제거되었습니다.',
      room,
      removedMember: {
        name: removedUser?.name || `${removedUser?.firstName || ''} ${removedUser?.lastName || ''}`.trim(),
        email: removedUser?.email,
        id: memberId
      }
    });

  } catch (error) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Leave a coordination room (member self-exit)
// @route   DELETE /api/coordination/rooms/:roomId/leave
// @access  Private
exports.leaveRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    // 1. Find the room
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // 2. Check if user is the owner
    if (room.owner.toString() === userId) {
      return res.status(400).json({
        msg: '방장은 방을 나갈 수 없습니다. 방을 삭제하거나 다른 조원에게 방장을 위임하세요.'
      });
    }

    // 3. Check if user is a member
    const initialMemberCount = room.members.length;
    room.members = room.members.filter(member => member.user.toString() !== userId);

    if (room.members.length === initialMemberCount) {
      return res.status(404).json({ msg: '이 방의 조원이 아닙니다.' });
    }

    // 4. Remove all timeSlots associated with the leaving user
    room.timeSlots = room.timeSlots.filter(slot =>
      slot.userId?.toString() !== userId && slot.user?.toString() !== userId
    );

    // 5. Remove all requests associated with the leaving user
    room.requests = room.requests.filter(request =>
      request.requester?.toString() !== userId &&
      request.targetUser?.toString() !== userId
    );

    // 6. Save room
    await room.save();
    await room.populate('owner', 'firstName lastName email');
    await room.populate('members.user', 'firstName lastName email');

    res.json({
      msg: '방에서 성공적으로 나갔습니다.',
      success: true,
      room
    });

  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get count of pending exchange requests for the user
// @route   GET /api/coordination/exchange-requests-count
// @access  Private
exports.getExchangeRequestsCount = async (req, res) => {
   try {
      const userId = req.user.id;

      const rooms = await Room.find({
         $or: [{ owner: userId }, { 'members.user': userId }],
      });

      let count = 0;
      rooms.forEach(room => {
         room.requests.forEach(request => {
            if (
               request.status === 'pending' &&
               request.type === 'slot_swap' &&
               request.targetUser &&
               request.targetUser.toString() === userId
            ) {
               count++;
            }
         });
      });

      res.json({ success: true, count });
   } catch (error) {
      res.status(500).json({ success: false, msg: 'Server error' });
   }
};

exports.runAutoSchedule = async (req, res) => {
   try {
      const { roomId } = req.params;
      const { minHoursPerWeek = 3, numWeeks = 4, currentWeek, ownerFocusTime = 'none' } = req.body;
      const startDate = currentWeek ? new Date(currentWeek) : new Date();
      
      const room = await Room.findById(roomId)
        .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority')
        .populate('members.user', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority');

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      // Clear previous auto-generated slots before running new schedule
      // 단, 협의로 배정된 슬롯(subject에 '협의'가 포함된 것)은 보존
      room.timeSlots = room.timeSlots.filter(slot => {
         // assignedBy가 없으면 수동 배정 → 유지
         if (!slot.assignedBy) return true;
         // 협의로 배정된 슬롯 → 유지
         if (slot.subject && (slot.subject.includes('협의') || slot.subject === '자동 배정')) {
            // '협의 결과', '협의 결과 (대체시간)', '협의 결과 (시간선택)' 등은 유지
            if (slot.subject.includes('협의')) return true;
            // '자동 배정'은 삭제
            if (slot.subject === '자동 배정') return false;
         }
         // 기타 assignedBy가 있는 슬롯 → 삭제
         return false;
      });

      if (minHoursPerWeek < 1 || minHoursPerWeek > 10) {
         return res.status(400).json({ msg: '주당 최소 할당 시간은 1-10시간 사이여야 합니다.' });
      }

      if (!room.settings.ownerPreferences) {
         room.settings.ownerPreferences = {};
      }
      room.settings.ownerPreferences.focusTimeType = ownerFocusTime;

      // Save minHoursPerWeek for future auto-schedules (when members join)
      room.settings.minHoursPerWeek = minHoursPerWeek;

      await room.save();

      const membersOnly = room.members.filter(m => {
         const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
         const ownerId = room.owner._id ? room.owner._id.toString() : room.owner.toString();
         return memberId !== ownerId;
      });



      const memberIds = membersOnly.map(m => {
        const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
        return memberId;
      });

      // 개인 시간표가 있는지 확인
      let membersWithDefaultSchedule = 0;
      for (const member of membersOnly) {
        if (member.user.defaultSchedule && member.user.defaultSchedule.length > 0) {
          membersWithDefaultSchedule++;
        }
      }

      if (!room.owner || !room.owner.defaultSchedule || room.owner.defaultSchedule.length === 0) {
        const ownerName = `${room.owner?.firstName || ''} ${room.owner?.lastName || ''}`.trim() || '방장';
        return res.status(400).json({
          msg: `방장(${ownerName})이 선호시간표를 설정하지 않았습니다. 내프로필에서 선호시간표를 설정해주세요.`
        });
      }
      const membersWithoutDefaultSchedule = [];
      for (const member of membersOnly) {

        if (!member.user || !member.user.defaultSchedule || member.user.defaultSchedule.length === 0) {
          const userName = member.user?.name || `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim() || '알 수 없음';
          membersWithoutDefaultSchedule.push(userName);
        }
      }
      if (membersWithoutDefaultSchedule.length > 0) {
        return res.status(400).json({
          msg: `다음 멤버들이 선호시간표를 설정하지 않았습니다: ${membersWithoutDefaultSchedule.join(', ')}. 각 멤버는 내프로필에서 선호시간표를 설정해야 합니다.`
        });
      }

      // 방장의 차단 시간은 개인 시간표에서 자동으로 처리되므로 별도 처리 불필요
      const ownerBlockedTimes = [];

      const existingCarryOvers = [];
      for (const member of room.members) {
        if (member.carryOver > 0) {
          existingCarryOvers.push({
            memberId: member.user._id.toString(),
            neededHours: member.carryOver,
            priority: member.priority || 3,
            week: startDate
          });
        }
      }

      // 💡 자동배정 실행 전: 기존의 모든 timeSlots와 negotiations 삭제
      const beforeSlotCount = room.timeSlots.length;
      const beforeNegotiationCount = room.negotiations ? room.negotiations.length : 0;

      // 💡 모든 슬롯과 협의 삭제
      room.timeSlots = [];
      room.negotiations = [];

      // 개인 시간표 기반 자동배정으로 변경
      const result = schedulingAlgorithm.runAutoSchedule(
         membersOnly,
         room.owner,
         room.timeSlots, // 💡 협의로 배정된 기존 슬롯 전달 (이미 충족된 멤버 제외용)
         {
            minHoursPerWeek,
            numWeeks,
            currentWeek,
            ownerPreferences: room.settings.ownerPreferences || {},
            roomSettings: {
               ...room.settings,
               ownerBlockedTimes: ownerBlockedTimes
            },
         },
         existingCarryOvers,
      );

      const twoWeeksAgo = new Date(startDate);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const oneWeekAgo = new Date(startDate);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const forcedNegotiationSuggestions = [];

      for (const member of room.members) {
        const memberUser = await User.findById(member.user);
        if (member.carryOver > 0) { // They have a carry-over from last week
            const history = member.carryOverHistory || [];
            
            const hasConsecutiveCarryOver = history.some(h => 
                new Date(h.week).getTime() >= twoWeeksAgo.getTime() &&
                new Date(h.week).getTime() < oneWeekAgo.getTime() &&
                h.amount > 0
            );

            if (hasConsecutiveCarryOver) {
                const memberName = memberUser.name || `${memberUser.firstName} ${memberUser.lastName}`;
                forcedNegotiationSuggestions.push({
                    title: '장기 이월 멤버 발생',
                    content: `멤버 '${memberName}'의 시간이 2주 이상 연속으로 이월되었습니다. 최소 할당 시간을 줄이거나, 멤버의 참여 가능 시간을 늘리거나, 직접 시간을 할당하여 문제를 해결해야 합니다.`
                });
            }
        }
      }

      // 중복 삭제 방지 - 이미 위에서 삭제했으므로 주석 처리
      // room.timeSlots = room.timeSlots.filter(slot => !slot.assignedBy);



      // 중복 방지를 위한 Set 생성
      const addedSlots = new Set();

      Object.values(result.assignments).forEach(assignment => {

         if (assignment.slots && assignment.slots.length > 0) {
            assignment.slots.forEach((slot, idx) => {
               // 필수 필드 검증
               if (!slot.day || !slot.startTime || !slot.endTime || !slot.date) {
                  return; // 이 슬롯은 건너뛰기
               }

               // 중복 체크를 위한 유니크 키 생성
               const slotKey = `${assignment.memberId}-${slot.day}-${slot.startTime}-${slot.endTime}-${new Date(slot.date).toISOString().split('T')[0]}`;

               if (!addedSlots.has(slotKey)) {
                  const dateStr = new Date(slot.date).toLocaleDateString('ko-KR');

                  const newSlot = {
                     user: assignment.memberId,
                     date: slot.date,
                     startTime: slot.startTime,
                     endTime: slot.endTime,
                     day: slot.day,
                     priority: 3,
                     subject: '자동 배정',
                     assignedBy: req.user.id || req.user._id || 'auto-scheduler',
                     assignedAt: new Date(),
                     status: 'confirmed',
                  };

                  room.timeSlots.push(newSlot);
                  addedSlots.add(slotKey);
               } else {
               }
            });
         }
      });

      const autoAssignedCount = room.timeSlots.filter(slot => slot.assignedBy).length;
      const totalSlotCount = room.timeSlots.length;

      // 다른 방법으로 자동 배정 슬롯 찾기
      const autoSlotsBySubject = room.timeSlots.filter(slot => slot.subject === '자동 배정');

      // 디버깅을 위해 실제 저장된 슬롯들 확인
      const recentlyAdded = room.timeSlots.filter(slot => slot.assignedBy || slot.subject === '자동 배정');

      if (result.negotiations && result.negotiations.length > 0) {
        room.negotiations = room.negotiations.filter(neg => neg.status !== 'active');
        room.negotiations.push(...result.negotiations);
      }

      for (const member of room.members) {
        const memberId = member.user._id.toString();
        const assignment = result.assignments[memberId];

        if (assignment && assignment.assignedHours >= minHoursPerWeek * 2) {
          if (member.carryOver > 0) {
            member.carryOverHistory.push({
              week: startDate,
              amount: -member.carryOver,
              reason: 'resolved_by_auto_schedule',
              timestamp: new Date()
            });
            member.carryOver = 0;
          }
        }
      }

      // 이월시간 처리 개선
      if (result.carryOverAssignments && result.carryOverAssignments.length > 0) {

         for (const carryOver of result.carryOverAssignments) {
            const memberIndex = room.members.findIndex(m =>
               m.user.toString() === carryOver.memberId
            );

            if (memberIndex !== -1) {
               const member = room.members[memberIndex];
               const previousCarryOver = member.carryOver || 0;
               member.carryOver = (member.carryOver || 0) + carryOver.neededHours;

               if (carryOver.neededHours > 0) {
                 // 이월 히스토리 업데이트
                 if (!member.carryOverHistory) {
                   member.carryOverHistory = [];
                 }

                 member.carryOverHistory.push({
                    week: carryOver.week || startDate,
                    amount: carryOver.neededHours,
                    reason: 'unassigned_from_auto_schedule',
                    timestamp: new Date(),
                    priority: carryOver.priority || 3
                 });

                 // 2주 이상 연속 이월 체크
                 const recentCarryOvers = member.carryOverHistory.filter(h => {
                   const historyDate = new Date(h.week);
                   const twoWeeksAgo = new Date(startDate);
                   twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
                   return historyDate >= twoWeeksAgo && h.amount > 0;
                 });

                 if (recentCarryOvers.length >= 2) {
                   // 강제 협의 또는 관리자 개입 플래그 설정
                   member.needsIntervention = true;
                   member.interventionReason = 'consecutive_carryover';
                 }
               }
            }
         }
      }

      // 우선도에 따른 다음 주 우선 배정 정보 업데이트
      Object.values(result.assignments).forEach(assignment => {
        if (assignment.carryOver && assignment.carryOver > 0) {
          const memberIndex = room.members.findIndex(m =>
            m.user.toString() === assignment.memberId
          );

          if (memberIndex !== -1) {
            const member = room.members[memberIndex];
            // 다음 주 우선 배정을 위한 우선도 임시 상승
            if (!member.tempPriorityBoost) {
              member.tempPriorityBoost = assignment.carryOver; // 이월 시간만큼 우선도 부스트
            }
          }
        }
      });

      await room.save();

      const freshRoom = await Room.findById(roomId)
         .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes address addressDetail addressLat addressLng')
         .populate('members.user', 'firstName lastName email defaultSchedule address addressDetail addressLat addressLng')
         .populate('timeSlots.user', '_id firstName lastName email')
         .populate('requests.requester', 'firstName lastName email')
         .populate('requests.targetUser', 'firstName lastName email')
         .populate('negotiations.conflictingMembers.user', '_id firstName lastName email')
         .lean();

      if (freshRoom.timeSlots.length > 0) {
         freshRoom.timeSlots.slice(0, 5).forEach((slot, idx) => {
            const userName = slot.user?.name || slot.user?.firstName || '이름없음';
            const userId = slot.user?._id || slot.user;
            const dateStr = new Date(slot.date).toLocaleDateString('ko-KR');
         });
      }
      res.json({
         room: freshRoom,
         unassignedMembersInfo: result.unassignedMembersInfo,
         conflictSuggestions: forcedNegotiationSuggestions, // Use the new suggestions
      });
   } catch (error) {

      if (error.message.includes('defaultSchedule')) {
         res.status(400).json({ msg: '선호시간표 데이터에 오류가 있습니다. 모든 멤버가 내프로필에서 선호시간표를 설정했는지 확인해주세요.' });
      } else if (error.message.includes('timeSlots')) {
         res.status(400).json({ msg: '시간표 데이터에 오류가 있습니다. 멤버들이 선호시간표를 설정했는지 확인해주세요.' });
      } else if (error.message.includes('member')) {
         res.status(400).json({ msg: '멤버 데이터에 오류가 있습니다. 방 설정을 확인해주세요.' });
      } else if (error.message.includes('settings')) {
         res.status(400).json({ msg: '방 설정에 오류가 있습니다. 시간 설정을 확인해주세요.' });
      } else if (error.message.includes('priority')) {
         res.status(400).json({ msg: '우선순위 설정에 오류가 있습니다. 멤버 우선순위를 확인해주세요.' });
      } else {
         res.status(500).json({ msg: `자동 배정 실행 중 오류가 발생했습니다: ${error.message}` });
      }
   }
};

exports.deleteAllTimeSlots = async (req, res) => {
   try {
      const { roomId } = req.params;
      const room = await Room.findById(roomId);

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      // Clear the timeSlots array
      room.timeSlots = [];
      
      // Also clear all active negotiations and non-pending requests as they are linked to slots
      room.negotiations = [];
      room.requests = room.requests.filter(r => r.status === 'pending');


      await room.save();

      const updatedRoom = await Room.findById(room._id)
         .populate('owner', 'firstName lastName email address addressLat addressLng')
         .populate('members.user', 'firstName lastName email address addressLat addressLng')
         .populate('timeSlots.user', '_id firstName lastName email');

      res.json(updatedRoom);

   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// Clear all negotiations
exports.clearAllNegotiations = async (req, res) => {
   try {
      const { roomId } = req.params;
      const room = await Room.findById(roomId);

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      const clearedCount = room.negotiations.length;

      // Clear all negotiations
      room.negotiations = [];
      await room.save();

      const updatedRoom = await Room.findById(room._id)
         .populate('owner', 'firstName lastName email')
         .populate('members.user', 'firstName lastName email')
         .populate('timeSlots.user', '_id firstName lastName email')
         .populate('negotiations.conflictingMembers.user', '_id firstName lastName email');

      res.json({
         msg: `${clearedCount}개의 협의가 삭제되었습니다.`,
         clearedCount,
         room: updatedRoom
      });

   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// ============================================
// 🤖 Smart Exchange Chatbot Endpoints
// ============================================

// Helper functions for time calculations
function addHours(timeStr, hours) {
   const [h, m] = timeStr.split(':').map(Number);
   const totalMinutes = h * 60 + m + (hours * 60);
   const newH = Math.floor(totalMinutes / 60) % 24;
   const newM = totalMinutes % 60;
   return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function getHoursDifference(startTime, endTime) {
   const [sh, sm] = startTime.split(':').map(Number);
   const [eh, em] = endTime.split(':').map(Number);
   return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
}

/**
 * Parse natural language exchange request using Gemini
 * POST /api/coordination/rooms/:roomId/parse-exchange-request
 */
exports.parseExchangeRequest = async (req, res) => {
   try {
      const { roomId } = req.params;
      const { message } = req.body;

      if (!message || !message.trim()) {
         return res.status(400).json({ error: '메시지를 입력해주세요.' });
      }

      // Verify room exists and user is a member
      const room = await Room.findById(roomId);
      if (!room) {
         return res.status(404).json({ error: '방을 찾을 수 없습니다.' });
      }

      const isMember = room.members.some(m =>
         (m.user._id || m.user).toString() === req.user.id.toString()
      );
      if (!isMember) {
         return res.status(403).json({ error: '방 멤버만 이 기능을 사용할 수 있습니다.' });
      }

      // Use Gemini to parse the natural language request
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      const prompt = `
다음 메시지에서 시간 변경 요청을 파싱해주세요.

메시지: "${message}"

다음 JSON 형식으로 응답해주세요:
{
  "targetDay": "요일 (월요일, 화요일, 수요일, 목요일, 금요일 중 하나)",
  "targetTime": "시간 (HH:00 형식, 예: 14:00). 시간이 명시되지 않았으면 null"
}

규칙:
1. 요일만 언급된 경우 targetTime은 null
2. 요일과 시간이 모두 언급된 경우 둘 다 추출
3. 요일이 명확하지 않으면 error를 반환
4. 시간은 24시간 형식으로 변환 (예: "오후 2시" -> "14:00", "2시" -> "14:00")

예시:
- "수요일로 바꿔줘" -> {"targetDay": "수요일", "targetTime": null}
- "수요일 2시로 바꿔줘" -> {"targetDay": "수요일", "targetTime": "14:00"}
- "목요일 오후 3시" -> {"targetDay": "목요일", "targetTime": "15:00"}
- "금요일 9시" -> {"targetDay": "금요일", "targetTime": "09:00"}

JSON만 반환하고 다른 텍스트는 포함하지 마세요.
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      // Parse JSON response
      let parsed;
      try {
         // Remove markdown code blocks if present
         const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
         parsed = JSON.parse(jsonText);
      } catch (parseError) {
         console.error('Failed to parse Gemini response:', text);
         return res.status(500).json({
            error: '요청을 이해하지 못했습니다. 다시 시도해주세요.',
            debug: text
         });
      }

      // Validate parsed data
      const validDays = ['월요일', '화요일', '수요일', '목요일', '금요일'];
      if (!parsed.targetDay || !validDays.includes(parsed.targetDay)) {
         return res.status(400).json({
            error: '요일을 명확히 말씀해주세요. (월요일~금요일)'
         });
      }

      // Validate time format if provided
      if (parsed.targetTime) {
         const timeRegex = /^([0-1][0-9]|2[0-3]):00$/;
         if (!timeRegex.test(parsed.targetTime)) {
            return res.status(400).json({
               error: '시간 형식이 올바르지 않습니다. (예: 14:00)'
            });
         }
      }

      res.json({ parsed });

   } catch (error) {
      console.error('Parse exchange request error:', error);
      res.status(500).json({
         error: '서버 오류가 발생했습니다.',
         details: error.message
      });
   }
};

/**
 * Execute smart exchange with validation
 * POST /api/coordination/rooms/:roomId/smart-exchange
 */
exports.smartExchange = async (req, res) => {
   try {
      const { roomId } = req.params;
      const { targetDay, targetTime } = req.body;

      console.log('🚀 ========== SMART EXCHANGE REQUEST ==========');
      console.log('📝 Request params:', { roomId, targetDay, targetTime });
      console.log('👤 Requester user ID:', req.user.id);

      // Verify room exists
      const room = await Room.findById(roomId)
         .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes')
         .populate('members.user', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes')
         .populate('timeSlots.user', '_id firstName lastName email');

      if (!room) {
         return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
      }

      // Verify user is a member
      const memberData = room.members.find(m =>
         (m.user._id || m.user).toString() === req.user.id.toString()
      );
      if (!memberData) {
         return res.status(403).json({ success: false, message: '방 멤버만 이 기능을 사용할 수 있습니다.' });
      }

      // Map day names to English
      const dayMap = {
         '월요일': 'monday',
         '화요일': 'tuesday',
         '수요일': 'wednesday',
         '목요일': 'thursday',
         '금요일': 'friday'
      };

      const targetDayEnglish = dayMap[targetDay];
      if (!targetDayEnglish) {
         return res.status(400).json({ success: false, message: '유효하지 않은 요일입니다.' });
      }

      // 🧠 Phase 4: Smart validation logic

      // Get current week's Monday
      const now = new Date();
      const day = now.getUTCDay();
      const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now);
      monday.setUTCDate(diff);
      monday.setUTCHours(0, 0, 0, 0);

      // Calculate target date
      const dayNumbers = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5 };
      const targetDayNumber = dayNumbers[targetDayEnglish];
      const targetDate = new Date(monday);
      targetDate.setUTCDate(monday.getUTCDate() + targetDayNumber - 1);

      // Find ALL requester's current assignments
      const requesterCurrentSlots = room.timeSlots.filter(slot =>
         (slot.user._id || slot.user).toString() === req.user.id.toString() &&
         slot.subject === '자동 배정'
      );

      if (requesterCurrentSlots.length === 0) {
         return res.status(400).json({
            success: false,
            message: '현재 배정된 시간이 없습니다. 먼저 자동 배정을 받으세요.'
         });
      }

      console.log(`📋 Found ${requesterCurrentSlots.length} slots for user:`, requesterCurrentSlots.map(s => ({
         day: s.day,
         date: s.date,
         time: `${s.startTime}-${s.endTime}`
      })));

      // Group slots by date to find continuous blocks
      const slotsByDate = {};
      requesterCurrentSlots.forEach(slot => {
         const dateKey = new Date(slot.date).toISOString().split('T')[0];
         if (!slotsByDate[dateKey]) {
            slotsByDate[dateKey] = [];
         }
         slotsByDate[dateKey].push(slot);
      });

      // Sort each date's slots by start time and find continuous blocks
      const continuousBlocks = [];
      Object.entries(slotsByDate).forEach(([dateKey, slots]) => {
         // Sort by start time
         slots.sort((a, b) => {
            const [aH, aM] = a.startTime.split(':').map(Number);
            const [bH, bM] = b.startTime.split(':').map(Number);
            return (aH * 60 + aM) - (bH * 60 + bM);
         });

         // Find continuous blocks
         let currentBlock = [slots[0]];
         for (let i = 1; i < slots.length; i++) {
            const prev = currentBlock[currentBlock.length - 1];
            const curr = slots[i];

            // Check if current slot continues from previous
            if (prev.endTime === curr.startTime) {
               currentBlock.push(curr);
            } else {
               // Save current block and start new one
               continuousBlocks.push([...currentBlock]);
               currentBlock = [curr];
            }
         }
         continuousBlocks.push(currentBlock);
      });

      console.log(`📦 Found ${continuousBlocks.length} continuous blocks:`, continuousBlocks.map(block => ({
         day: block[0].day,
         date: block[0].date,
         time: `${block[0].startTime}-${block[block.length - 1].endTime}`,
         slotCount: block.length
      })));

      // Select block to move
      // Strategy: Select block from THIS WEEK that is NOT on target day
      let selectedBlock;

      // Calculate this week's date range (Monday to Sunday)
      const thisWeekMonday = new Date(monday);
      const thisWeekSunday = new Date(monday);
      thisWeekSunday.setUTCDate(thisWeekMonday.getUTCDate() + 6);

      console.log(`📅 This week range: ${thisWeekMonday.toISOString().split('T')[0]} to ${thisWeekSunday.toISOString().split('T')[0]}`);

      // Filter blocks that are in THIS WEEK
      const thisWeekBlocks = continuousBlocks.filter(block => {
         const blockDate = new Date(block[0].date);
         return blockDate >= thisWeekMonday && blockDate <= thisWeekSunday;
      });

      console.log(`🔍 Block selection - Target day: ${targetDayEnglish}`);
      console.log(`   Total blocks: ${continuousBlocks.length}`);
      console.log(`   This week blocks: ${thisWeekBlocks.length}`);

      // From this week's blocks, prefer blocks NOT on target day
      const thisWeekBlocksNotOnTargetDay = thisWeekBlocks.filter(block => block[0].day !== targetDayEnglish);
      const thisWeekBlocksOnTargetDay = thisWeekBlocks.filter(block => block[0].day === targetDayEnglish);

      console.log(`   This week blocks NOT on ${targetDayEnglish}: ${thisWeekBlocksNotOnTargetDay.length}`);
      console.log(`   This week blocks ON ${targetDayEnglish}: ${thisWeekBlocksOnTargetDay.length}`);

      if (thisWeekBlocksNotOnTargetDay.length > 0) {
         // Move block from other day to target day (within this week)
         selectedBlock = thisWeekBlocksNotOnTargetDay[0];
         console.log(`✅ Selected THIS WEEK block from OTHER day: ${selectedBlock[0].day} ${selectedBlock[0].startTime}-${selectedBlock[selectedBlock.length - 1].endTime} (date: ${selectedBlock[0].date}) → ${targetDayEnglish}`);
      } else if (thisWeekBlocksOnTargetDay.length > 0) {
         // Only blocks on target day exist in this week - change time within same day
         selectedBlock = thisWeekBlocksOnTargetDay[0];
         console.log(`✅ Selected THIS WEEK block on SAME day: ${selectedBlock[0].day} ${selectedBlock[0].startTime}-${selectedBlock[selectedBlock.length - 1].endTime} (date: ${selectedBlock[0].date}) (changing time within ${targetDayEnglish})`);
      } else {
         // No blocks in this week - fallback to any block
         console.log(`⚠️ No blocks found in this week, selecting from all blocks`);
         const blocksNotOnTargetDay = continuousBlocks.filter(block => block[0].day !== targetDayEnglish);
         if (blocksNotOnTargetDay.length > 0) {
            selectedBlock = blocksNotOnTargetDay[0];
         } else {
            selectedBlock = continuousBlocks[0];
         }
         console.log(`⚠️ Fallback: selecting block from ${selectedBlock[0].date}`);
      }

      console.log(`   Total blocks available: ${continuousBlocks.length}`);

      const requesterCurrentSlot = selectedBlock[0]; // For compatibility with existing code
      const allSlotsInBlock = selectedBlock;

      // 🔒 Check if target time is within MEMBER's preferred schedule (from User.defaultSchedule)
      const calculateTotalHours = (startTime, endTime) => {
         return getHoursDifference(startTime, endTime);
      };

      const blockStartTime = allSlotsInBlock[0].startTime;
      const blockEndTime = allSlotsInBlock[allSlotsInBlock.length - 1].endTime;
      const totalHours = calculateTotalHours(blockStartTime, blockEndTime);

      // Calculate all time slots that will be needed
      const newStartTime = targetTime || blockStartTime;
      const newEndTime = addHours(newStartTime, totalHours);

      // 🔒 STEP 1: Check OWNER's preferred schedule first
      const ownerUser = room.owner;
      const ownerDefaultSchedule = ownerUser.defaultSchedule || [];

      // Map day to dayOfWeek number (1=Monday, 2=Tuesday, ..., 5=Friday)
      const dayOfWeekMap = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5 };
      const targetDayOfWeek = dayOfWeekMap[targetDayEnglish];

      console.log(`🎯 Target day: ${targetDayEnglish} (dayOfWeek: ${targetDayOfWeek})`);

      // Find owner's schedule for target day
      const ownerTargetDaySchedules = ownerDefaultSchedule.filter(s => s.dayOfWeek === targetDayOfWeek);

      console.log(`👑 Owner schedules for ${targetDay}:`, JSON.stringify(ownerTargetDaySchedules, null, 2));

      if (ownerTargetDaySchedules.length === 0) {
         return res.status(400).json({
            success: false,
            message: `${targetDay}는 방장의 선호 시간이 아닙니다. 방장이 설정한 선호 요일로만 변경할 수 있습니다.`
         });
      }

      // 🔒 STEP 2: Check MEMBER's preferred schedule
      const requesterUser = memberData.user;
      const requesterDefaultSchedule = requesterUser.defaultSchedule || [];

      console.log('👤 Requester info:', {
         id: requesterUser._id,
         email: requesterUser.email,
         name: `${requesterUser.firstName} ${requesterUser.lastName}`
      });
      console.log('🔍 Requester FULL defaultSchedule (all days):', JSON.stringify(requesterDefaultSchedule.map(s => ({
         dayOfWeek: s.dayOfWeek,
         day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][s.dayOfWeek],
         startTime: s.startTime,
         endTime: s.endTime
      })), null, 2));

      // Find requester's schedule for target day
      const memberTargetDaySchedules = requesterDefaultSchedule.filter(s => s.dayOfWeek === targetDayOfWeek);

      console.log(`📅 Member schedules for ${targetDay}:`, JSON.stringify(memberTargetDaySchedules, null, 2));

      if (memberTargetDaySchedules.length === 0) {
         return res.status(400).json({
            success: false,
            message: `${targetDay}는 당신의 선호 시간이 아닙니다. 본인이 설정한 선호 요일로만 변경할 수 있습니다.`
         });
      }

      // 🔒 STEP 3: Merge and find overlapping time ranges (OWNER ∩ MEMBER)

      // Helper function to merge continuous slots
      const mergeSlots = (schedules) => {
         const sorted = [...schedules].sort((a, b) => {
            const [aH, aM] = a.startTime.split(':').map(Number);
            const [bH, bM] = b.startTime.split(':').map(Number);
            return (aH * 60 + aM) - (bH * 60 + bM);
         });

         const merged = [];
         let current = null;

         for (const schedule of sorted) {
            const [startH, startM] = schedule.startTime.split(':').map(Number);
            const [endH, endM] = schedule.endTime.split(':').map(Number);
            const startMinutes = startH * 60 + startM;
            const endMinutes = endH * 60 + endM;

            if (!current) {
               current = { startMinutes, endMinutes, startTime: schedule.startTime, endTime: schedule.endTime };
            } else {
               if (startMinutes <= current.endMinutes) {
                  current.endMinutes = Math.max(current.endMinutes, endMinutes);
                  current.endTime = schedule.endTime;
               } else {
                  merged.push({ ...current });
                  current = { startMinutes, endMinutes, startTime: schedule.startTime, endTime: schedule.endTime };
               }
            }
         }
         if (current) merged.push(current);
         return merged;
      };

      const ownerMergedRanges = mergeSlots(ownerTargetDaySchedules);
      const memberMergedRanges = mergeSlots(memberTargetDaySchedules);

      console.log(`👑 Owner merged ranges for ${targetDay}:`, ownerMergedRanges.map(r => `${r.startTime}-${r.endTime}`));
      console.log(`📊 Member merged ranges for ${targetDay}:`, memberMergedRanges.map(r => `${r.startTime}-${r.endTime}`));

      // Find intersection (overlapping ranges)
      const overlappingRanges = [];
      for (const ownerRange of ownerMergedRanges) {
         for (const memberRange of memberMergedRanges) {
            const overlapStart = Math.max(ownerRange.startMinutes, memberRange.startMinutes);
            const overlapEnd = Math.min(ownerRange.endMinutes, memberRange.endMinutes);

            if (overlapStart < overlapEnd) {
               // Convert back to time strings
               const startH = Math.floor(overlapStart / 60);
               const startM = overlapStart % 60;
               const endH = Math.floor(overlapEnd / 60);
               const endM = overlapEnd % 60;
               overlappingRanges.push({
                  startMinutes: overlapStart,
                  endMinutes: overlapEnd,
                  startTime: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
                  endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
               });
            }
         }
      }

      console.log(`🤝 Overlapping ranges (Owner ∩ Member):`, overlappingRanges.map(r => `${r.startTime}-${r.endTime}`));

      if (overlappingRanges.length === 0) {
         return res.status(400).json({
            success: false,
            message: `${targetDay}에 방장과 당신의 선호 시간이 겹치지 않습니다. 겹치는 시간대로만 변경할 수 있습니다.`
         });
      }

      // 🔧 If targetTime is not specified and moving to different day, use first overlap range start time
      let finalNewStartTime = newStartTime;
      let finalNewEndTime = newEndTime;

      if (!targetTime && selectedBlock[0].day !== targetDayEnglish) {
         // Moving to different day without specific time → use first overlap range start
         const firstOverlapStart = overlappingRanges[0].startTime;
         finalNewStartTime = firstOverlapStart;
         finalNewEndTime = addHours(firstOverlapStart, totalHours);
         console.log(`⚙️ No target time specified, using first overlap start: ${finalNewStartTime}`);
      }

      // Check if the entire block fits within any overlapping range
      const [newStartH, newStartM] = finalNewStartTime.split(':').map(Number);
      const [newEndH, newEndM] = finalNewEndTime.split(':').map(Number);
      const newStartMinutes = newStartH * 60 + newStartM;
      const newEndMinutes = newEndH * 60 + newEndM;

      console.log(`🕐 New time range: ${finalNewStartTime}-${finalNewEndTime} (${newStartMinutes}-${newEndMinutes} minutes)`);

      let isWithinOverlap = false;
      for (const range of overlappingRanges) {
         console.log(`  📋 Checking overlap range: ${range.startTime}-${range.endTime} (${range.startMinutes}-${range.endMinutes} minutes)`);
         console.log(`     ${newStartMinutes} >= ${range.startMinutes} && ${newEndMinutes} <= ${range.endMinutes} = ${newStartMinutes >= range.startMinutes && newEndMinutes <= range.endMinutes}`);

         if (newStartMinutes >= range.startMinutes && newEndMinutes <= range.endMinutes) {
            isWithinOverlap = true;
            console.log(`  ✅ Match found in overlapping range!`);
            break;
         }
      }

      if (!isWithinOverlap) {
         // Create a more helpful error message
         const availableRanges = overlappingRanges.map(r => `${r.startTime}-${r.endTime}`).join(', ');
         return res.status(400).json({
            success: false,
            message: `${targetDay} ${newStartTime}-${newEndTime}는 사용할 수 없습니다. 방장과 겹치는 가능한 시간: ${availableRanges}`
         });
      }

      console.log('✅ Target time is within overlapping preferred schedule (Owner ∩ Member)');

      // Check if target slot exists and who occupies it
      const targetSlots = room.timeSlots.filter(slot => {
         const slotDate = new Date(slot.date);
         return slotDate.toISOString().split('T')[0] === targetDate.toISOString().split('T')[0] &&
                (!targetTime || slot.startTime === targetTime);
      });

      const occupiedSlot = targetSlots.find(slot =>
         (slot.user._id || slot.user).toString() !== req.user.id.toString()
      );

      // Case 1: Target slot is empty → Immediate swap
      if (!occupiedSlot) {
         console.log('🔧 Current block:', {
            startTime: blockStartTime,
            endTime: blockEndTime,
            totalSlots: allSlotsInBlock.length,
            totalHours: totalHours,
            date: allSlotsInBlock[0].date
         });

         console.log('📅 New times:', { startTime: newStartTime, endTime: newEndTime, totalHours });

         // Check if already at target position (same day and same time)
         const currentBlockDate = new Date(allSlotsInBlock[0].date);
         const isSameDay = currentBlockDate.toISOString().split('T')[0] === targetDate.toISOString().split('T')[0];
         const isSameTime = blockStartTime === newStartTime && blockEndTime === newEndTime;

         if (isSameDay && isSameTime) {
            console.log('⚠️ Already at target position. No changes needed.');
            return res.json({
               success: true,
               message: `이미 ${targetDay} ${newStartTime}-${newEndTime}에 배정되어 있습니다.`,
               immediateSwap: true,
               targetDay,
               targetTime: newStartTime
            });
         }

         // Remove ALL slots in the block
         const slotIdsToRemove = allSlotsInBlock.map(slot => slot._id.toString());
         console.log(`🗑️ Attempting to remove ${slotIdsToRemove.length} slots:`, slotIdsToRemove);
         console.log(`📊 Total timeSlots before removal: ${room.timeSlots.length}`);

         const beforeLength = room.timeSlots.length;

         // Use Mongoose array methods to ensure changes are tracked
         for (const slotId of slotIdsToRemove) {
            const index = room.timeSlots.findIndex(slot => slot._id.toString() === slotId);
            if (index !== -1) {
               room.timeSlots.splice(index, 1);
            }
         }

         const afterLength = room.timeSlots.length;

         console.log(`🗑️ Removed ${beforeLength - afterLength} slots (expected ${slotIdsToRemove.length})`);
         console.log(`📊 Total timeSlots after removal: ${afterLength}`);

         // Create new continuous slots at target time (same 30-min intervals)
         const newSlots = [];
         let currentTime = finalNewStartTime;

         for (let i = 0; i < allSlotsInBlock.length; i++) {
            const slotEndTime = addHours(currentTime, 0.5); // 30 minutes
            newSlots.push({
               user: req.user.id,
               date: targetDate,
               startTime: currentTime,
               endTime: slotEndTime,
               day: targetDayEnglish,
               priority: allSlotsInBlock[i].priority || 3,
               subject: '자동 배정',
               assignedBy: room.owner._id,
               assignedAt: new Date(),
               status: 'confirmed'
            });
            currentTime = slotEndTime;
         }

         room.timeSlots.push(...newSlots);
         console.log(`✅ Created ${newSlots.length} new slots at ${finalNewStartTime}-${finalNewEndTime}`);

         await room.save();
         await room.populate('timeSlots.user', '_id firstName lastName email');

         return res.json({
            success: true,
            message: `${targetDay} ${finalNewStartTime}-${finalNewEndTime}로 즉시 변경되었습니다!`,
            immediateSwap: true,
            targetDay,
            targetTime: finalNewStartTime
         });
      }

      // Case 2: Target slot is occupied → Need to check if swap is possible
      // For now, create a request (Phase 5 will handle notifications)
      res.json({
         success: true,
         message: `${targetDay}${targetTime ? ` ${targetTime}` : ''}는 다른 조원이 배정되어 있습니다. 요청을 전송합니다.`,
         immediateSwap: false,
         targetDay,
         targetTime,
         occupiedBy: occupiedSlot.user.firstName + ' ' + occupiedSlot.user.lastName
      });

   } catch (error) {
      console.error('Smart exchange error:', error);
      res.status(500).json({
         success: false,
         message: '서버 오류가 발생했습니다.',
         details: error.message
      });
   }
};

