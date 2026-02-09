import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider } from '../../config/firebaseConfig';
import { linkWithPopup, unlink, onAuthStateChanged } from 'firebase/auth';
import { Menu, ChevronLeft, Link2, Unlink, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import CustomAlertModal from '../modals/CustomAlertModal';
import './MobileCalendarView.css';

const MobileSettings = ({ user }) => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGoogleLinked, setIsGoogleLinked] = useState(false);
  const [isCalendarLinked, setIsCalendarLinked] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', type: 'warning', onConfirm: null });

  // Firebase Auth 상태 리스너 - providerData 정확하게 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const hasGoogleProvider = firebaseUser.providerData?.some(p => p.providerId === 'google.com');
        setIsGoogleLinked(prev => prev || !!hasGoogleProvider);
      }
    });
    return () => unsubscribe();
  }, []);

  // MongoDB user 데이터로도 상태 체크 (백업)
  useEffect(() => {
    if (user) {
      const hasGoogleProvider = auth.currentUser?.providerData?.some(p => p.providerId === 'google.com');
      const hasGoogleInDB = !!user.google?.id;
      setIsGoogleLinked(!!hasGoogleProvider || hasGoogleInDB);
      setIsCalendarLinked(!!user.google?.refreshToken);
    }
  }, [user]);

  const showAlert = (title, message, type = 'info') => {
    setAlertModal({ isOpen: true, title, message, type });
  };

  const handleLinkGoogle = async () => {
    setIsLinking(true);
    try {
      const result = await linkWithPopup(auth.currentUser, googleProvider);
      const googleId = result.user.providerData.find(p => p.providerId === 'google.com')?.uid;

      const token = await auth.currentUser.getIdToken();
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      await fetch(`${API_BASE_URL}/api/auth/link-google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ googleId })
      });

      setIsGoogleLinked(true);
      localStorage.setItem('loginMethod', 'google');
      // user prop 갱신을 위해 이벤트 발송
      window.dispatchEvent(new Event('userProfileUpdated'));
      showAlert('연동 완료', '구글 계정이 연동되었습니다. 이제 구글로도 로그인할 수 있습니다.', 'success');
    } catch (error) {
      if (error.code === 'auth/credential-already-in-use') {
        showAlert('연동 실패', '이 구글 계정은 이미 다른 계정에 연결되어 있습니다.', 'error');
      } else if (error.code === 'auth/provider-already-linked') {
        // 이미 구글이 연동된 상태 - 성공으로 처리
        setIsGoogleLinked(true);
        showAlert('연동 완료', '구글 계정이 이미 연동되어 있습니다.', 'success');
      } else if (error.code === 'auth/popup-closed-by-user') {
        // 사용자가 팝업을 닫은 경우 - 무시
      } else {
        showAlert('연동 실패', `오류: ${error.message}`, 'error');
      }
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlinkGoogle = () => {
    setConfirmModal({
      isOpen: true,
      title: '구글 연동 해제',
      message: '구글 계정 연동을 해제하시겠습니까? 구글 로그인과 구글 캘린더 연동이 모두 해제됩니다.',
      type: 'warning',
      onConfirm: async () => {
        try {
          await unlink(auth.currentUser, 'google.com');

          const token = await auth.currentUser.getIdToken();
          const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
          await fetch(`${API_BASE_URL}/api/auth/unlink-google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
          });

          setIsGoogleLinked(false);
          setIsCalendarLinked(false);
          localStorage.setItem('loginMethod', 'local');
          window.dispatchEvent(new Event('userProfileUpdated'));
          showAlert('해제 완료', '구글 계정 연동이 해제되었습니다.', 'success');
        } catch (error) {
          showAlert('해제 실패', `오류: ${error.message}`, 'error');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleLinkCalendar = async () => {
    try {
      const token = await auth.currentUser.getIdToken();
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const response = await fetch(`${API_BASE_URL}/api/auth/google/calendar-consent?returnUrl=/mobile/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      showAlert('오류', '구글 캘린더 연동 URL 생성에 실패했습니다.', 'error');
    }
  };

  const handleSyncToGoogle = async () => {
    setIsSyncing(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const res = await fetch(`${API_BASE_URL}/api/calendar/sync-to-google`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        if (data.synced > 0) {
          showAlert('동기화 완료', `${data.synced}개 일정이 구글 캘린더에 동기화되었습니다.${data.skipped > 0 ? ` (${data.skipped}개 중복 스킵)` : ''}`, 'success');
        } else {
          showAlert('동기화 완료', '새로 동기화할 일정이 없습니다. (이미 동기화됨)', 'info');
        }
      } else {
        showAlert('동기화 실패', data.msg || '동기화에 실패했습니다.', 'error');
      }
    } catch (error) {
      showAlert('동기화 실패', `오류: ${error.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // 구글 캘린더 연동 콜백 처리 (OAuth 리다이렉트 후 복귀)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calendarConnected = params.get('calendarConnected');
    const calendarError = params.get('calendarError');

    if (calendarConnected === 'true') {
      setIsCalendarLinked(true);
      // URL 파라미터 정리
      window.history.replaceState({}, document.title, window.location.pathname);
      // user 데이터 갱신
      window.dispatchEvent(new Event('userProfileUpdated'));

      // 기존 일정을 구글 캘린더로 동기화
      const syncExistingEvents = async () => {
        try {
          const currentUser = auth.currentUser;
          if (!currentUser) return;
          const token = await currentUser.getIdToken();
          const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
          const syncRes = await fetch(`${API_BASE_URL}/api/calendar/sync-to-google`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const syncData = await syncRes.json();
          if (syncRes.ok && syncData.synced > 0) {
            showAlert('연동 완료', `구글 캘린더가 연동되었습니다. 기존 일정 ${syncData.synced}개가 구글 캘린더에 동기화되었습니다.`, 'success');
          } else {
            showAlert('연동 완료', '구글 캘린더가 연동되었습니다. 구글 캘린더 일정이 초록색으로 표시됩니다.', 'success');
          }
        } catch (syncError) {
          console.warn('기존 일정 구글 캘린더 동기화 실패:', syncError);
          showAlert('연동 완료', '구글 캘린더가 연동되었습니다. (기존 일정 동기화는 실패했습니다)', 'success');
        }
      };
      syncExistingEvents();
    } else if (calendarError) {
      window.history.replaceState({}, document.title, window.location.pathname);
      showAlert('연동 실패', `구글 캘린더 연동에 실패했습니다: ${calendarError}`, 'error');
    }
  }, []);

  return (
    <div className="mobile-calendar-view">
      {/* 사이드바 오버레이 */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* 사이드바 */}
      <nav className={`mobile-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2 className="sidebar-title">메뉴</h2>
          <button className="sidebar-close-btn" onClick={() => setIsSidebarOpen(false)}>✕</button>
        </div>
        <div className="sidebar-menu">
          <button className="sidebar-item" onClick={() => navigate('/')}>
            🏠 홈으로
          </button>
          <button className="sidebar-item" onClick={() => navigate('/mobile/schedule')}>
            📅 내 일정
          </button>
          <button className="sidebar-item" onClick={() => navigate('/mobile/groups')}>
            👥 그룹
          </button>
          <button className="sidebar-item" onClick={() => navigate('/mobile/calendar')}>
            📆 달력
          </button>
          <button className="sidebar-item" onClick={() => { setIsSidebarOpen(false); }}>
            ⚙️ 설정
          </button>
        </div>
      </nav>

      {/* 헤더 */}
      <header className="mobile-header">
        <div className="mobile-header-content">
          <div className="mobile-header-left">
            <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center text-gray-600 hover:text-gray-800"
            >
              <ChevronLeft size={24} />
            </button>
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: 0 }}>설정</h1>
          </div>
        </div>
      </header>

      {/* 설정 내용 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {/* 계정 정보 */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #f3f4f6' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: 0 }}>계정 정보</h3>
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#6b7280', fontSize: '14px' }}>이름</span>
              <span style={{ color: '#1f2937', fontSize: '14px', fontWeight: 500 }}>{user?.firstName} {user?.lastName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#6b7280', fontSize: '14px' }}>이메일</span>
              <span style={{ color: '#1f2937', fontSize: '14px', fontWeight: 500 }}>{user?.email}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280', fontSize: '14px' }}>로그인 방식</span>
              <span style={{
                fontSize: '13px', fontWeight: 600, padding: '2px 8px', borderRadius: '9999px',
                background: isGoogleLinked ? '#dcfce7' : '#dbeafe',
                color: isGoogleLinked ? '#166534' : '#1e40af'
              }}>
                {isGoogleLinked ? '구글 + 이메일' : '이메일'}
              </span>
            </div>
          </div>
        </div>

        {/* 구글 계정 연동 */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #f3f4f6' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: 0 }}>구글 계정 연동</h3>
          </div>
          <div style={{ padding: '16px' }}>
            {/* 구글 로그인 연동 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isGoogleLinked ? <CheckCircle size={20} color="#22c55e" /> : <Link2 size={20} color="#6b7280" />}
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>구글 로그인</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {isGoogleLinked ? '연동됨 - 구글로 로그인 가능' : '미연동 - 이메일로만 로그인 가능'}
                  </div>
                </div>
              </div>
              {isGoogleLinked ? (
                <button
                  onClick={handleUnlinkGoogle}
                  style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 600, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Unlink size={14} /> 해제
                </button>
              ) : (
                <button
                  onClick={handleLinkGoogle}
                  disabled={isLinking}
                  style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 600, color: 'white', background: isLinking ? '#9ca3af' : '#4285f4', border: 'none', borderRadius: '6px', cursor: isLinking ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Link2 size={14} /> {isLinking ? '연동 중...' : '연동하기'}
                </button>
              )}
            </div>

            {/* 구글 캘린더 연동 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isCalendarLinked ? <CheckCircle size={20} color="#22c55e" /> : <Calendar size={20} color="#6b7280" />}
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>구글 캘린더</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {isCalendarLinked ? '연동됨 - 구글 캘린더 일정 표시 중' : '미연동 - 구글 캘린더 일정 미표시'}
                  </div>
                </div>
              </div>
              {isGoogleLinked && !isCalendarLinked && (
                <button
                  onClick={handleLinkCalendar}
                  style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 600, color: 'white', background: '#22c55e', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Calendar size={14} /> 연동하기
                </button>
              )}
              {isCalendarLinked && (
                <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>활성</span>
              )}
              {!isGoogleLinked && (
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>구글 로그인 연동 필요</span>
              )}
            {/* 수동 동기화 */}
            {isCalendarLinked && (
              <div style={{ marginTop: '12px', padding: '12px', background: '#f0fdf4', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>기존 일정 동기화</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>앱의 기존 일정을 구글 캘린더로 내보내기</div>
                </div>
                <button
                  onClick={handleSyncToGoogle}
                  disabled={isSyncing}
                  style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 600, color: 'white', background: isSyncing ? '#9ca3af' : '#3b82f6', border: 'none', borderRadius: '6px', cursor: isSyncing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Calendar size={14} /> {isSyncing ? '동기화 중...' : '동기화'}
                </button>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* 안내 */}
        <div style={{ background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <AlertCircle size={18} color="#3b82f6" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '13px', color: '#1e40af', lineHeight: '1.5' }}>
              <strong>구글 계정 연동 안내</strong><br />
              - 연동 후 구글 또는 이메일 둘 다로 로그인 가능<br />
              - 기존 일정, 선호시간, 조율방 데이터 모두 유지<br />
              - 구글 캘린더 연동 시 기존 구글 일정이 초록색으로 표시
            </div>
          </div>
        </div>
      </div>

      {/* 모달 */}
      <CustomAlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
      <CustomAlertModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        showCancel={true}
        confirmText="해제"
      />
    </div>
  );
};

export default MobileSettings;
