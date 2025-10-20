import React, { useState, useEffect } from 'react';
import { userService } from '../../services/userService';
import AddressAutocomplete from '../common/AddressAutocomplete';
import { User, Mail, Phone, MapPin, Briefcase, Calendar } from 'lucide-react';

const PersonalInfoEdit = () => {
  const [userInfo, setUserInfo] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    addressLat: null,
    addressLng: null,
    addressPlaceId: null,
    occupation: '',
    birthdate: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      setIsLoading(true);
      const data = await userService.getUserProfile();
      setUserInfo({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        addressLat: data.addressLat || null,
        addressLng: data.addressLng || null,
        addressPlaceId: data.addressPlaceId || null,
        occupation: data.occupation || '',
        birthdate: data.birthdate || ''
      });
    } catch (error) {
      console.error('개인정보 조회 실패:', error);
      setMessage({ type: 'error', text: '개인정보를 불러오는데 실패했습니다.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsSaving(true);
      setMessage({ type: '', text: '' });

      await userService.updateUserProfile(userInfo);

      setMessage({ type: 'success', text: '개인정보가 성공적으로 저장되었습니다!' });

      // 3초 후 메시지 자동 제거
      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 3000);
    } catch (error) {
      console.error('개인정보 저장 실패:', error);
      setMessage({ type: 'error', text: '개인정보 저장에 실패했습니다.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">개인정보를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">개인정보 수정</h2>

        {message.text && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 이름 */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <User size={16} className="mr-2" />
              이름
            </label>
            <input
              type="text"
              name="name"
              value={userInfo.name}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="이름을 입력하세요"
            />
          </div>

          {/* 이메일 */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Mail size={16} className="mr-2" />
              이메일
            </label>
            <input
              type="email"
              name="email"
              value={userInfo.email}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              placeholder="이메일 주소"
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">이메일은 변경할 수 없습니다.</p>
          </div>

          {/* 전화번호 */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Phone size={16} className="mr-2" />
              전화번호
            </label>
            <input
              type="tel"
              name="phone"
              value={userInfo.phone}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="010-1234-5678"
            />
          </div>

          {/* 주소 */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <MapPin size={16} className="mr-2" />
              주소
            </label>
            <AddressAutocomplete
              value={userInfo.address}
              onChange={(addressData) => {
                setUserInfo(prev => ({
                  ...prev,
                  address: addressData.address,
                  addressLat: addressData.lat,
                  addressLng: addressData.lng,
                  addressPlaceId: addressData.placeId
                }));
              }}
              placeholder="주소를 입력하세요 (자동완성 지원)"
            />
            {userInfo.addressLat && userInfo.addressLng && (
              <p className="text-xs text-green-600 mt-1">
                ✓ 위치 좌표: {userInfo.addressLat.toFixed(6)}, {userInfo.addressLng.toFixed(6)}
              </p>
            )}
          </div>

          {/* 직업 */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Briefcase size={16} className="mr-2" />
              직업
            </label>
            <input
              type="text"
              name="occupation"
              value={userInfo.occupation}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="직업을 입력하세요"
            />
          </div>

          {/* 생년월일 */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Calendar size={16} className="mr-2" />
              생년월일
            </label>
            <input
              type="date"
              name="birthdate"
              value={userInfo.birthdate}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 저장 버튼 */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
                isSaving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSaving ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PersonalInfoEdit;
