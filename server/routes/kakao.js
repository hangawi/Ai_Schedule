const express = require('express');
const router = express.Router();
const axios = require('axios');

// @desc    Get driving directions from Kakao
// @route   POST /api/kakao/directions/car
// @access  Private (requires auth)
router.post('/directions/car', async (req, res) => {
  try {
    const { origin, destination } = req.body;
    console.log('Car route request:', origin, destination);

    const response = await axios.get('https://apis-navi.kakaomobility.com/v1/directions', {
      params: {
        origin: `${origin.lng},${origin.lat}`,
        destination: `${destination.lng},${destination.lat}`,
        priority: 'RECOMMEND'
      },
      headers: {
        'Authorization': `KakaoAK ${process.env.KAKAO_REST_API_KEY}`
      }
    });

    console.log('Kakao car response:', JSON.stringify(response.data, null, 2));
    res.json(response.data);
  } catch (error) {
    console.error('Kakao car directions error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get car directions', details: error.response?.data || error.message });
  }
});

// @desc    Get walking directions from Kakao
// @route   POST /api/kakao/directions/walk
// @access  Private (requires auth)
router.post('/directions/walk', async (req, res) => {
  try {
    const { origin, destination } = req.body;
    console.log('Walk route request:', origin, destination);

    const response = await axios.post('https://apis.openapi.sk.com/tmap/routes/pedestrian', {
      startX: origin.lng.toString(),
      startY: origin.lat.toString(),
      endX: destination.lng.toString(),
      endY: destination.lat.toString(),
      reqCoordType: 'WGS84GEO',
      resCoordType: 'WGS84GEO',
      startName: '출발지',
      endName: '도착지'
    }, {
      headers: {
        'appKey': process.env.TMAP_API_KEY || 'l7xx8d59662f94c74c25a02c19c0badb0857'
      }
    });

    console.log('TMap walk response:', JSON.stringify(response.data, null, 2));
    res.json(response.data);
  } catch (error) {
    console.error('TMap walk directions error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get walk directions', details: error.response?.data || error.message });
  }
});

module.exports = router;
