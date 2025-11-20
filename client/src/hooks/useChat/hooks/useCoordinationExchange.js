/**
 * Coordination room 시간 변경 훅
 */

import { useCallback } from 'react';
import { auth } from '../../../config/firebaseConfig';
import { API_BASE_URL } from '../constants/apiConstants';
import { getViewMode, getCurrentWeekStartDate } from '../../../utils/coordinationModeUtils';

export const useCoordinationExchange = () => {
  const handleCoordinationExchange = useCallback(async (message, context) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, message: '인증 토큰이 없습니다.' };
    }

    try {
      // Parse the message using backend Gemini API
      const parseResponse = await fetch(`${API_BASE_URL}/api/coordination/rooms/${context.roomId}/parse-exchange-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await currentUser.getIdToken()}`
        },
        body: JSON.stringify({
          message,
          recentMessages: context.recentMessages || []
        })
      });

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json();
        return { success: false, message: errorData.error || '요청을 이해하지 못했습니다.' };
      }

      const { parsed } = await parseResponse.json();

      console.log('🔍 [useChat] Parsed response:', parsed);
      console.log('🔍 [useChat] Context pendingRequest:', context.pendingRequest);

      // Handle different message types
      if (parsed.type === 'time_change' || parsed.type === 'date_change') {
        // Execute immediately without confirmation
        console.log(`✅ [useChat] ${parsed.type} detected, executing immediately`);
        console.log('🚀 [useChat] Executing request:', parsed);

        // Call smart-exchange API directly with viewMode info
        const viewMode = getViewMode();
        const currentWeekStartDate = getCurrentWeekStartDate();

        const exchangeResponse = await fetch(`${API_BASE_URL}/api/coordination/rooms/${context.roomId}/smart-exchange`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await currentUser.getIdToken()}`
          },
          body: JSON.stringify({
            ...parsed,
            viewMode,
            currentWeekStartDate: currentWeekStartDate.toISOString()
          })
        });

        if (!exchangeResponse.ok) {
          const errorData = await exchangeResponse.json();
          return { success: false, message: errorData.message || '시간 변경에 실패했습니다.' };
        }

        const result = await exchangeResponse.json();

        // Trigger calendar update if swap was successful
        if (result.success && result.immediateSwap) {
          window.dispatchEvent(new CustomEvent('coordinationUpdate', {
            detail: { type: 'timeSwap', roomId: context.roomId }
          }));
        }

        return {
          success: true,
          message: result.message,
          immediateSwap: result.immediateSwap
        };
      } else if (parsed.type === 'confirm') {
        // Legacy confirm handler (no longer used)
        return { success: true, message: '네, 알겠습니다! 👍' };
      } else if (parsed.type === 'reject') {
        // Legacy reject handler (no longer used)
        return { success: true, message: '알겠습니다.' };
      }

      // Fallback for unknown types
      return { success: true, message: '요청을 처리했습니다.' };

    } catch (error) {
      return { success: false, message: `오류가 발생했습니다: ${error.message}` };
    }
  }, []);

  return { handleCoordinationExchange };
};
