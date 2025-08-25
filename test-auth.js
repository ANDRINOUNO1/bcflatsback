const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';

async function testAuthentication() {
  console.log('🔐 Testing BCFlats Backend Authentication...\n');

  try {
    // Test 1: Health check (should work without auth)
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Health check successful:', healthResponse.data);
  } catch (error) {
    console.log('❌ Health check failed:', error.response?.data || error.message);
  }

  try {
    // Test 2: Test auth endpoint without token (should fail)
    console.log('\n2. Testing auth endpoint without token...');
    const authResponse = await axios.get(`${API_BASE_URL}/test-auth`);
    console.log('❌ Auth endpoint should require token but didn\'t');
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Auth endpoint correctly requires authentication');
    } else {
      console.log('❌ Unexpected error:', error.response?.status, error.response?.data);
    }
  }

  try {
    // Test 3: Test rooms endpoint without token (should fail)
    console.log('\n3. Testing rooms endpoint without token...');
    const roomsResponse = await axios.get(`${API_BASE_URL}/rooms`);
    console.log('❌ Rooms endpoint should require token but didn\'t');
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Rooms endpoint correctly requires authentication');
    } else {
      console.log('❌ Unexpected error:', error.response?.status, error.response?.data);
    }
  }

  try {
    // Test 4: Test tenants endpoint without token (should fail)
    console.log('\n4. Testing tenants endpoint without token...');
    const tenantsResponse = await axios.get(`${API_BASE_URL}/tenants`);
    console.log('❌ Tenants endpoint should require token but didn\'t');
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Tenants endpoint correctly requires authentication');
    } else {
      console.log('❌ Unexpected error:', error.response?.status, error.response?.data);
    }
  }

  console.log('\n🔐 Authentication test completed!');
}

testAuthentication().catch(console.error);
