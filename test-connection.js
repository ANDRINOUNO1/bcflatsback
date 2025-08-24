const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';

async function testConnection() {
  console.log('🧪 Testing BCFlats Backend Connection...\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data);

    // Test accounts endpoint
    console.log('\n2. Testing accounts endpoint...');
    const accountsResponse = await axios.get(`${API_BASE_URL}/accounts`);
    console.log('✅ Accounts endpoint working:', accountsResponse.data.length, 'accounts found');

    // Test rooms endpoint
    console.log('\n3. Testing rooms endpoint...');
    const roomsResponse = await axios.get(`${API_BASE_URL}/rooms`);
    console.log('✅ Rooms endpoint working:', roomsResponse.data.length, 'rooms found');

    // Test tenants endpoint
    console.log('\n4. Testing tenants endpoint...');
    const tenantsResponse = await axios.get(`${API_BASE_URL}/tenants`);
    console.log('✅ Tenants endpoint working:', tenantsResponse.data.length, 'tenants found');

    console.log('\n🎉 All tests passed! Backend is working correctly.');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testConnection();
