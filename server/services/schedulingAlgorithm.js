class SchedulingAlgorithm {
  constructor() {}

  async calculateOptimalTime(busyTimes, eventDetails, allParticipantIds) {
    const { duration, preferredTimeRanges } = eventDetails;
    const possibleSlots = this._generatePossibleSlots(preferredTimeRanges, duration);

    if (possibleSlots.length === 0) {
      return [];
    }

    const scoredSlots = this._scoreSlots(possibleSlots, busyTimes, allParticipantIds, eventDetails);

    // Sort by score descending
    scoredSlots.sort((a, b) => b.score - a.score);

    // Return top 5 suggestions
    return scoredSlots.slice(0, 5);
  }

  _generatePossibleSlots(preferredTimeRanges, duration) {
    const possibleSlots = [];
    const meetingDurationMillis = duration * 60 * 1000;

    for (const range of preferredTimeRanges) {
      let currentTime = new Date(range.start);
      const endTime = new Date(range.end);

      while (currentTime.getTime() + meetingDurationMillis <= endTime.getTime()) {
        const slotEnd = new Date(currentTime.getTime() + meetingDurationMillis);
        possibleSlots.push({ startTime: new Date(currentTime), endTime: slotEnd });

        // Move to the next 15-minute interval
        currentTime = new Date(currentTime.getTime() + 15 * 60 * 1000);
      }
    }
    return possibleSlots;
  }

  _scoreSlots(slots, busyTimes, allParticipantIds, eventDetails) {
    const totalParticipants = allParticipantIds.length;
    const { priority: proposalPriority } = eventDetails;

    return slots.map(slot => {
      let score = 0; // Base score
      let availableParticipants = 0;
      let conflictingEventsCount = 0;
      let conflicts = [];

      for (const participantId of allParticipantIds) {
        let isParticipantAvailable = true;
        const participantBusyTimes = busyTimes.filter(bt => bt.userId.toString() === participantId.toString());

        for (const busy of participantBusyTimes) {
          const busyStart = new Date(busy.startTime);
          const busyEnd = new Date(busy.endTime);

          // Check for overlap
          if (slot.startTime < busyEnd && slot.endTime > busyStart) {
            isParticipantAvailable = false;
            conflictingEventsCount++;
            conflicts.push({ userId: participantId, busyTime: busy });
            break;
          }
        }

        if (isParticipantAvailable) {
          availableParticipants++;
        }
      }

      // 1. 참가자 가용성 (가장 중요)
      if (totalParticipants > 0) {
        score += (availableParticipants / totalParticipants) * 60; // 60점 배점
      } else {
        score += 60; // 참가자가 없으면 60점 기본 부여 (모두 가능하다고 가정)
      }

      // 2. 시간 선호도 (오전/오후 선호)
      const slotHour = slot.startTime.getHours();
      if (slotHour >= 9 && slotHour < 12) score += 15; // 오전 선호 (9-11시)
      else if (slotHour >= 13 && slotHour < 17) score += 10; // 오후 선호 (13-16시)
      else score += 5; // 그 외 시간

      // 3. 충돌 최소화 (충돌이 적을수록 높은 점수)
      // 충돌이 0개일 때 15점, 1개일 때 10점, 2개일 때 5점, 3개 이상일 때 0점
      if (conflictingEventsCount === 0) score += 15;
      else if (conflictingEventsCount === 1) score += 10;
      else if (conflictingEventsCount === 2) score += 5;

      // 4. 제안 우선순위 (높을수록 높은 점수)
      // proposalPriority가 유효한 숫자인지 확인
      if (typeof proposalPriority === 'number' && !isNaN(proposalPriority)) {
        score += (proposalPriority - 1) * 2.5; // 10점 배점
      }

      // 점수를 0-100 범위로 정규화 및 정수화
      score = Math.min(100, Math.max(0, Math.round(score)));

      let description = '';
      if (availableParticipants === totalParticipants) {
        description = '모든 참가자 가능';
      } else if (availableParticipants === 0) {
        description = '참가자 없음';
      } else {
        description = `${totalParticipants - availableParticipants}명 일정 조율 필요`;
      }

      return {
        startTime: slot.startTime.toISOString(),
        endTime: slot.endTime.toISOString(),
        score: score,
        description: description,
        conflicts: conflicts,
      };
    });
  }
}

module.exports = SchedulingAlgorithm;
