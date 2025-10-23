const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';

async function testAuthenticationResponse() {
    try {
        console.log('🔍 Testing Authentication Response...\n');

        // Test Head Admin Login
        console.log('1️⃣ Testing Head Admin Login Response...');
        const response = await axios.post(`${API_BASE_URL}/accounts/authenticate`, {
            email: 'headadmin@example.com',
            password: 'headadmin123'
        });

        console.log('Response data:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testAuthenticationResponse();
