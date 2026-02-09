/**
 * ===================================================================================================
 * MobileHeader.js - 모바일 공통 헤더 컴포넌트
 * ===================================================================================================
 *
 * 모든 모바일 페이지에서 사용하는 통일된 헤더 컴포넌트
 * - 햄버거 메뉴 + 로고 (왼쪽)
 * - 캘린더, 클립보드 감지, 통화 감지, 프로필, 음성 인식, 로그아웃 버튼 (오른쪽)
 * - 로고에 로그인 상태 인디케이터 (구글: 초록, 일반: 빨강)
 *
 * ===================================================================================================
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Calendar, Clipboard, ClipboardX, Phone, User, LogOut } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';
import { useToast } from '../../contexts/ToastContext';

const MobileHeader = ({
   user,
   onMenuClick,
   isClipboardMonitoring,
   setIsClipboardMonitoring,
   isVoiceEnabled,
   setIsVoiceEnabled
}) => {
   const navigate = useNavigate();
   const { showToast } = useToast();
   const loginMethod = localStorage.getItem('loginMethod') || '';
   
   // 통화 감지 상태 (로컬)
   const [isBackgroundMonitoring, setIsBackgroundMonitoring] = useState(false);
   const [micVolume, setMicVolume] = useState(0);
   const audioContextRef = useRef(null);
   const analyserRef = useRef(null);
   const micStreamRef = useRef(null);
   const animationFrameRef = useRef(null);

   // 통화 감지 시작/중지
   const toggleBackgroundMonitoring = useCallback(async () => {
      if (isBackgroundMonitoring) {
         // 중지
         if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
         }
         if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(track => track.stop());
            micStreamRef.current = null;
         }
         if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
         }
         setIsBackgroundMonitoring(false);
         setMicVolume(0);
      } else {
         // 시작
         try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStreamRef.current = stream;
            
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            analyserRef.current = audioContextRef.current.createAnalyser();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);
            
            analyserRef.current.fftSize = 256;
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            
            const updateVolume = () => {
               if (!analyserRef.current) return;
               analyserRef.current.getByteFrequencyData(dataArray);
               const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
               setMicVolume(Math.min(100, average * 1.5));
               animationFrameRef.current = requestAnimationFrame(updateVolume);
            };
            
            updateVolume();
            setIsBackgroundMonitoring(true);
         } catch (err) {
            console.error('마이크 접근 실패:', err);
            showToast('마이크 권한이 필요합니다.');
         }
      }
   }, [isBackgroundMonitoring]);

   // 컴포넌트 언마운트 시 정리
   useEffect(() => {
      return () => {
         if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
         }
         if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(track => track.stop());
         }
         if (audioContextRef.current) {
            audioContextRef.current.close();
         }
      };
   }, []);

   const handleLogout = async () => {
      try {
         await auth.signOut();
         localStorage.removeItem('loginMethod');
         navigate('/auth');
      } catch (error) {
         console.error('로그아웃 실패:', error);
      }
   };

   return (
      <header className="mobile-header">
         <div className="mobile-header-content">
            {/* 왼쪽: 햄버거 메뉴 + 로고 */}
            <div className="mobile-header-left">
               <button className="mobile-menu-btn" onClick={onMenuClick}>
                  <Menu size={24} />
               </button>
               <div className="mobile-logo-btn" onClick={() => navigate('/')}>
                  <div className="mobile-logo-wrapper">
                     <img src="/heyheylogo.png" alt="MeetAgent Logo" className="mobile-logo-img" />
                     <div className={`mobile-login-indicator ${user?.google?.refreshToken ? 'google' : 'local'}`}></div>
                  </div>
                  <h1 className="mobile-logo-text">MeetAgent</h1>
               </div>
            </div>

            {/* 오른쪽: 버튼들 */}
            <div className="mobile-header-right">
               {/* 캘린더 버튼 */}
               <button className="mobile-icon-btn" onClick={() => navigate('/mobile/calendar')} title="캘린더">
                  <Calendar size={20} />
               </button>

               {/* 클립보드 모니터링 */}
               <button
                  className={`mobile-icon-btn ${isClipboardMonitoring ? 'active' : ''}`}
                  onClick={() => setIsClipboardMonitoring(!isClipboardMonitoring)}
                  title={isClipboardMonitoring ? "클립보드 ON" : "클립보드 OFF"}>
                  {isClipboardMonitoring ? <Clipboard size={18} /> : <ClipboardX size={18} />}
               </button>

               {/* 백그라운드 모니터링 (통화 감지) */}
               <button
                  className={`mobile-icon-btn ${isBackgroundMonitoring ? 'active' : ''}`}
                  onClick={toggleBackgroundMonitoring}
                  title={isBackgroundMonitoring ? `통화감지 ON (${Math.round(micVolume)}%)` : "통화감지 OFF"}
                  style={isBackgroundMonitoring ? { 
                     boxShadow: `0 0 ${micVolume / 10}px rgba(34, 197, 94, ${micVolume / 100})` 
                  } : {}}>
                  <Phone size={18} />
               </button>

               {/* 프로필 버튼 */}
               <button className="mobile-profile-btn" onClick={() => navigate('/mobile/profile')} title="프로필">
                  {user && user.firstName ? user.firstName : <User size={18} />}
               </button>

               {/* 음성 인식 버튼 */}
               <button
                  className="mobile-voice-btn"
                  onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                  title={isVoiceEnabled ? "음성 인식 ON" : "음성 인식 OFF"}>
                  {isVoiceEnabled ? '🎙️' : '🔇'}
               </button>

               {/* 로그아웃 버튼 */}
               <button
                  className="mobile-logout-btn"
                  onClick={handleLogout}
                  title="로그아웃">
                  <LogOut size={16} />
               </button>
            </div>
         </div>
      </header>
   );
};

export default MobileHeader;
