/**
 * ===================================================================================================
 * PersonalInfoEdit.js - 사용자 개인정보 수정 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/profile
 *
 * 🎯 주요 기능:
 *    - 사용자의 개인정보(이름, 전화번호, 주소, 직업, 생년월일 등)를 수정하는 폼 제공
 *    - 주소 입력을 위한 `AddressAutocomplete` 컴포넌트 사용 및 선택된 주소의 위치를 지도에 표시
 *    - 수정된 정보를 서버에 저장하는 기능
 *    - 회원탈퇴 기능 및 확인 모달 제공
 *
 * 🔗 연결된 파일:
 *    - ../../services/userService - 사용자 프로필 정보를 가져오고 업데이트하는 API 서비스
 *    - ../common/AddressAutocomplete - 주소 자동완성 컴포넌트
 *    - ProfileTab/index.js - 이 컴포넌트를 사용하는 상위 탭 컴포넌트
 *
 * 💡 UI 위치:
 *    - '내 프로필' 탭의 메인 컨텐츠 영역
 *
 * ✏️ 수정 가이드:
 *    - 새로운 개인정보 필드 추가: `userInfo` 상태에 속성을 추가하고, 폼 JSX에 해당 입력 필드 추가
 *    - 회원탈퇴 API 엔드포인트 변경: `handleDeleteAccount` 함수 내의 `fetch` URL 수정
 *    - 지도 UI/옵션 변경: `GoogleMap` 컴포넌트의 props 수정
 *
 * 📝 참고사항:
 *    - 컴포넌트 마운트 시 `useEffect`를 통해 사용자의 현재 프로필 정보를 비동기적으로 불러옵니다.
 *    - 정보 저장 성공 시 `userProfileUpdated` 커스텀 이벤트를 발생시켜 헤더 등 다른 컴포넌트의 사용자 정보를 갱신하도록 유도합니다.
 *    - 이메일은 고유 식별자로 사용되므로 폼에서 수정할 수 없도록 `readOnly` 처리되어 있습니다.
 *
 * ===================================================================================================
 */

import React, { useState, useEffect } from 'react';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { userService } from '../../services/userService';
import AddressAutocomplete from '../common/AddressAutocomplete';
import { User, Mail, Phone, MapPin, Briefcase, Calendar, UserX } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';

/**
 * PersonalInfoEdit
 *
 * @description 사용자의 개인정보를 조회하고 수정하는 전체 UI를 제공하는 컴포넌트입니다.
 * @returns {JSX.Element} 개인정보 수정 페이지 UI
 */
const PersonalInfoEdit = () => {
  const [userInfo, setUserInfo] = useState({
    firstName: '', lastName: '', email: '', phone: '', address: '',
    addressDetail: '', addressLat: null, addressLng: null, addressPlaceId: null,
    occupation: '', birthdate: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        setIsLoading(true);
        const data = await userService.getUserProfile();
        setUserInfo({
          firstName: data.firstName || '', lastName: data.lastName || '', email: data.email || '',
          phone: data.phone || '', address: data.address || '', addressDetail: data.addressDetail || '',
          addressLat: data.addressLat || null, addressLng: data.addressLng || null,
          addressPlaceId: data.addressPlaceId || null, occupation: data.occupation || '',
          birthdate: data.birthdate ? data.birthdate.split('T')[0] : ''
        });
      } catch (error) {
        setMessage({ type: 'error', text: '개인정보를 불러오는데 실패했습니다.' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserInfo();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setMessage({ type: '', text: '' });
      await userService.updateUserProfile(userInfo);
      setMessage({ type: 'success', text: '개인정보가 성공적으로 저장되었습니다!' });
      window.dispatchEvent(new CustomEvent('userProfileUpdated'));
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: '개인정보 저장에 실패했습니다.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setMessage({ type: 'error', text: '로그인이 필요합니다.' });
        return;
      }
      const token = await currentUser.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/auth/delete-account`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.msg || '회원탈퇴에 실패했습니다.');
      }
      await auth.signOut();
      window.location.reload();
    } catch (err) {
      setMessage({ type: 'error', text: `회원탈퇴 실패: ${err.message}` });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">개인정보를 불러오는 중...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">개인정보 수정</h2>

      {message.text && (
        <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2"><User size={16} className="mr-2" />이름</label>
                <input type="text" name="firstName" value={userInfo.firstName} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="이름" />
              </div>
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2"><User size={16} className="mr-2" />성</label>
                <input type="text" name="lastName" value={userInfo.lastName} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="성" />
              </div>
            </div>
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2"><Mail size={16} className="mr-2" />이메일</label>
              <input type="email" name="email" value={userInfo.email} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50" readOnly />
              <p className="text-xs text-gray-500 mt-1">이메일은 변경할 수 없습니다.</p>
            </div>
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2"><Phone size={16} className="mr-2" />전화번호</label>
              <input type="tel" name="phone" value={userInfo.phone} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="010-1234-5678" />
            </div>
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2"><MapPin size={16} className="mr-2" />주소</label>
              <AddressAutocomplete 
                value={userInfo.address} 
                onChange={(data) => {
                  console.log('📍 [좌표받음]', {
                    address: data.address,
                    lat: data.lat,
                    lng: data.lng,
                    isValid: !!(data.lat && data.lng)
                  });
                  
                  setUserInfo(p => ({
                    ...p, 
                    address: data.address,
                    addressLat: data.lat,
                    addressLng: data.lng,
                    addressPlaceId: data.placeId
                  }));
                }} 
              />
              {userInfo.addressLat && <p className="text-xs text-green-600 mt-1">✓ 위치 좌표: {userInfo.addressLat.toFixed(6)}, {userInfo.addressLng.toFixed(6)}</p>}
            </div>
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2"><MapPin size={16} className="mr-2" />세부 주소</label>
              <input type="text" name="addressDetail" value={userInfo.addressDetail} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="상세 주소 (예: 101동 1004호)" />
            </div>
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2"><Briefcase size={16} className="mr-2" />직업</label>
              <input type="text" name="occupation" value={userInfo.occupation} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="직업" />
            </div>
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2"><Calendar size={16} className="mr-2" />생년월일</label>
              <input type="date" name="birthdate" value={userInfo.birthdate} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="pt-4">
              <button type="submit" disabled={isSaving} className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isSaving ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </form>
          <div className="pt-4 mt-4 border-t border-gray-200">
            <button onClick={() => setShowDeleteConfirm(true)} className="w-full py-3 px-4 rounded-lg font-medium text-white bg-red-500 hover:bg-red-600 flex items-center justify-center">
              <UserX size={16} className="mr-2" />회원탈퇴
            </button>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">위치 지도</h3>
          {userInfo.addressLat && userInfo.addressLng ? (
            <div style={{ height: '600px', width: '100%' }} className="rounded-lg overflow-hidden shadow-lg">
              <GoogleMap mapContainerStyle={{ width: '100%', height: '600px' }} center={{ lat: parseFloat(userInfo.addressLat), lng: parseFloat(userInfo.addressLng) }} zoom={15}>
                <Marker position={{ lat: parseFloat(userInfo.addressLat), lng: parseFloat(userInfo.addressLng) }} />
              </GoogleMap>
            </div>
          ) : (
            <div className="h-[600px] w-full rounded-lg bg-gray-100 flex items-center justify-center">
              <div className="text-center text-gray-500"><MapPin size={48} className="mx-auto mb-3 text-gray-400" /><p>주소를 입력하면 지도가 표시됩니다</p><p className="text-xs mt-2">현재 주소: {userInfo.address || '없음'}</p></div>
            </div>
          )}
        </div>
      </div>
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-red-600 mb-4">회원탈퇴</h3>
            <p className="text-gray-700 mb-4">정말로 탈퇴하시겠습니까?<br /><span className="text-red-500 font-semibold">모든 데이터가 삭제되며 복구할 수 없습니다.</span></p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">취소</button>
              <button onClick={() => { setShowDeleteConfirm(false); handleDeleteAccount(); }} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">탈퇴하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalInfoEdit;