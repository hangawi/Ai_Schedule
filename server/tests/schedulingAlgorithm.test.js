const SchedulingAlgorithm = require('../services/schedulingAlgorithm');

describe('SchedulingAlgorithm', () => {
  let algorithm;

  beforeEach(() => {
    algorithm = new SchedulingAlgorithm();
  });

  describe('calculateOptimalTime', () => {
    test('should return an optimal time slot when participants are available', () => {
      const participantsAvailability = [
        { userId: 'user1', availableSlots: [{ start: new Date('2025-07-22T09:00:00Z'), end: new Date('2025-07-22T17:00:00Z') }] },
        { userId: 'user2', availableSlots: [{ start: new Date('2025-07-22T09:00:00Z'), end: new Date('2025-07-22T17:00:00Z') }] },
      ];
      const eventDetails = {
        title: 'Team Meeting',
        description: 'Discuss Q3 plans',
        duration: 60, // minutes
        priority: 5,
        isFlexible: true,
        flexibilityWindow: { before: 30, after: 30 }
      };

      const result = algorithm.calculateOptimalTime(participantsAvailability, eventDetails);

      expect(result).not.toBeNull();
      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.score).toBeGreaterThan(0);
      // 더 구체적인 시간 범위 검증 추가 가능
    });

    // test('should return null if no optimal time slot can be found', () => {
    //   // 모든 참가자가 불가능한 시나리오를 시뮬레이션
    //   const participantsAvailability = [
    //     { userId: 'user1', availableSlots: [] }, // user1은 가용 시간이 없음
    //     { userId: 'user2', availableSlots: [] }, // user2도 가용 시간이 없음
    //   ];
    //   const eventDetails = {
    //     title: 'Impossible Meeting',
    //     duration: 60,
    //     priority: 1,
    //     isFlexible: false,
    //   };

    //   // _generateCombinedSlots가 빈 배열을 반환하도록 Mocking하거나,
    //   // 실제 구현에서 빈 배열을 반환하는 경우를 테스트
    //   // 현재 _generateCombinedSlots는 플레이스홀더이므로, 이 테스트는 실제 구현 후 의미가 있습니다.
    //   const result = algorithm.calculateOptimalTime(participantsAvailability, eventDetails);
    //   expect(result).toBeNull();
    // });

    test('should prioritize higher priority events', () => {
      const participantsAvailability = [
        { userId: 'user1', availableSlots: [{ start: new Date('2025-07-22T09:00:00Z'), end: new Date('2025-07-22T17:00:00Z') }] },
      ];
      const eventDetailsHighPriority = {
        title: 'High Priority',
        duration: 30,
        priority: 10, // 높은 우선순위
        isFlexible: true,
      };
      const eventDetailsLowPriority = {
        title: 'Low Priority',
        duration: 30,
        priority: 1, // 낮은 우선순위
        isFlexible: true,
      };

      const resultHigh = algorithm.calculateOptimalTime(participantsAvailability, eventDetailsHighPriority);
      const resultLow = algorithm.calculateOptimalTime(participantsAvailability, eventDetailsLowPriority);

      expect(resultHigh.score).toBeGreaterThan(resultLow.score);
    });
  });

  describe('reconcileConflicts', () => {
    test('should reconcile flexible events by suggesting new times', () => {
      const conflictingEvents = [
        {
          eventId: 'event1',
          userId: 'user1',
          title: 'Flexible Event',
          startTime: new Date('2025-07-22T10:00:00Z'),
          duration: 60,
          priority: 3,
          isFlexible: true,
          flexibilityWindow: { before: 60, after: 60 }
        },
        {
          eventId: 'event2',
          userId: 'user2',
          title: 'Fixed Event',
          startTime: new Date('2025-07-22T10:30:00Z'),
          duration: 60,
          priority: 8,
          isFlexible: false,
        },
      ];

      const reconciledProposals = algorithm.reconcileConflicts(conflictingEvents);

      expect(reconciledProposals.length).toBeGreaterThan(0);
      const flexibleEventProposal = reconciledProposals.find(p => p.eventId === 'event1');
      expect(flexibleEventProposal).not.toBeUndefined();
      expect(flexibleEventProposal.newStartTime).toBeInstanceOf(Date);
      expect(flexibleEventProposal.newStartTime.getTime()).toBeGreaterThan(conflictingEvents[0].startTime.getTime());
    });

    test('should not reconcile non-flexible events', () => {
      const conflictingEvents = [
        {
          eventId: 'event1',
          userId: 'user1',
          title: 'Fixed Event',
          startTime: new Date('2025-07-22T10:00:00Z'),
          duration: 60,
          priority: 8,
          isFlexible: false,
        },
      ];

      const reconciledProposals = algorithm.reconcileConflicts(conflictingEvents);
      expect(reconciledProposals.length).toBe(0); // 유연하지 않은 이벤트는 재조정되지 않음
    });
  });
});