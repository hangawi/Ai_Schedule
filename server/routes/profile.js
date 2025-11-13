const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/user');

// @route   GET api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    }

    const profile = {
      email: user.email,
      name: user.name || '',
      phone: user.phone || '',
      address: user.address || '',
      addressLat: user.addressLat || null,
      addressLng: user.addressLng || null,
      addressPlaceId: user.addressPlaceId || null,
      occupation: user.occupation || '',
      birthdate: user.birthdate || ''
    };

    res.json(profile);
  } catch (err) {
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

// @route   PUT api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/', auth, async (req, res) => {
  try {
    const { name, phone, address, addressLat, addressLng, addressPlaceId, occupation, birthdate } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ msg: '사용자를 찾을 수 없습니다.' });
    }

    // 업데이트할 필드만 적용
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (addressLat !== undefined) user.addressLat = addressLat;
    if (addressLng !== undefined) user.addressLng = addressLng;
    if (addressPlaceId !== undefined) user.addressPlaceId = addressPlaceId;
    if (occupation !== undefined) user.occupation = occupation;
    if (birthdate !== undefined) user.birthdate = birthdate;

    await user.save();

    const profile = {
      email: user.email,
      name: user.name,
      phone: user.phone,
      address: user.address,
      addressLat: user.addressLat,
      addressLng: user.addressLng,
      addressPlaceId: user.addressPlaceId,
      occupation: user.occupation,
      birthdate: user.birthdate
    };

    res.json(profile);
  } catch (err) {
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
