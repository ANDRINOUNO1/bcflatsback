const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';

async function testHeadAdminAccess() {
    try {
        console.log('🔍 Testing Head Admin Access...\n');

        // 1. Login as Head Admin
        console.log('1️⃣ Logging in as Head Admin...');
        const loginResponse = await axios.post(`${API_BASE_URL}/accounts/authenticate`, {
            email: 'headadmin@example.com',
            password: 'headadmin123'
        });

        const token = loginResponse.data.jwtToken;
        console.log('✅ Login successful');
        console.log(`   Role: ${loginResponse.data.role}`);
        console.log(`   Permissions: ${loginResponse.data.permissions.length}`);

        // 2. Test admin management access
        console.log('\n2️⃣ Testing admin management access...');
        try {
            const adminResponse = await axios.get(`${API_BASE_URL}/accounts/head-admin/admins`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('✅ Admin management access successful');
            console.log(`   Found ${adminResponse.data.length} admins`);
        } catch (error) {
            console.log('❌ Admin management access failed');
            console.log(`   Error: ${error.response?.data?.message}`);
            console.log(`   Status: ${error.response?.status}`);
        }

        // 3. Test role management access
        console.log('\n3️⃣ Testing role management access...');
        try {
            const rolesResponse = await axios.get(`${API_BASE_URL}/accounts/head-admin/roles`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('✅ Role management access successful');
            console.log(`   Found ${rolesResponse.data.length} roles`);
        } catch (error) {
            console.log('❌ Role management access failed');
            console.log(`   Error: ${error.response?.data?.message}`);
        }

        // 4. Test permission checking
        console.log('\n4️⃣ Testing permission checking...');
        try {
            const permissionResponse = await axios.get(`${API_BASE_URL}/accounts/head-admin/check-permission?resource=dashboard&action=read`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('✅ Permission checking successful');
            console.log(`   Can read dashboard: ${permissionResponse.data.hasPermission}`);
        } catch (error) {
            console.log('❌ Permission checking failed');
            console.log(`   Error: ${error.response?.data?.message}`);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testHeadAdminAccess();
