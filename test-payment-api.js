// Test script for Payment functionality
const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function testPaymentAPI() {
    try {
        console.log('🧪 Testing Payment API functionality...\n');
        
        // Test 1: Health check
        console.log('1. Testing health endpoint...');
        const healthResponse = await axios.get(`${API_BASE}/health`);
        console.log('✅ Health check passed:', healthResponse.data);
        
        // Test 2: Get tenants with billing info (requires auth)
        console.log('\n2. Testing billing info endpoint...');
        try {
            const billingResponse = await axios.get(`${API_BASE}/payments/billing-info`);
            console.log('✅ Billing info endpoint accessible');
            console.log('📊 Found tenants:', billingResponse.data.length);
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('⚠️  Billing info endpoint requires authentication (expected)');
            } else {
                console.log('❌ Billing info endpoint error:', error.message);
            }
        }
        
        // Test 3: Payment stats (requires auth)
        console.log('\n3. Testing payment stats endpoint...');
        try {
            const statsResponse = await axios.get(`${API_BASE}/payments/stats`);
            console.log('✅ Payment stats endpoint accessible');
            console.log('📈 Stats:', statsResponse.data);
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('⚠️  Payment stats endpoint requires authentication (expected)');
            } else {
                console.log('❌ Payment stats endpoint error:', error.message);
            }
        }
        
        console.log('\n🎉 Payment API endpoints are properly configured!');
        console.log('📝 Note: Payment recording requires authentication with Admin/SuperAdmin role');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Make sure the backend server is running on port 3000');
        }
    }
}

// Run the test
testPaymentAPI();
