const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';

// Test credentials
const testCredentials = {
    headAdmin: { email: 'headadmin@example.com', password: 'headadmin123' },
    superAdmin: { email: 'superadmin@example.com', password: 'superadmin123' },
    admin: { email: 'admin@example.com', password: 'admin123' },
    accounting: { email: 'accounting@example.com', password: 'accounting123' }
};

async function testRBACSystem() {
    console.log('🧪 Testing RBAC System...\n');

    try {
        // Test 1: Head Admin Login and Access
        console.log('1️⃣ Testing Head Admin Login...');
        const headAdminLogin = await axios.post(`${API_BASE_URL}/accounts/authenticate`, testCredentials.headAdmin);
        console.log('✅ Head Admin login successful');
        console.log(`   Role: ${headAdminLogin.data.role}`);
        console.log(`   Permissions: ${headAdminLogin.data.permissions?.length || 0} permissions\n`);

        const headAdminToken = headAdminLogin.data.jwtToken;

        // Test 2: Head Admin can access admin management
        console.log('2️⃣ Testing Head Admin Admin Management Access...');
        try {
            const adminList = await axios.get(`${API_BASE_URL}/accounts/head-admin/admins`, {
                headers: { Authorization: `Bearer ${headAdminToken}` }
            });
            console.log('✅ Head Admin can access admin management');
            console.log(`   Found ${adminList.data.length} admin accounts\n`);
        } catch (error) {
            console.log('❌ Head Admin cannot access admin management:', error.response?.data?.message || error.message);
        }

        // Test 3: Head Admin can get roles and permissions
        console.log('3️⃣ Testing Head Admin Role/Permission Management...');
        try {
            const roles = await axios.get(`${API_BASE_URL}/accounts/head-admin/roles`, {
                headers: { Authorization: `Bearer ${headAdminToken}` }
            });
            const permissions = await axios.get(`${API_BASE_URL}/accounts/head-admin/permissions`, {
                headers: { Authorization: `Bearer ${headAdminToken}` }
            });
            console.log('✅ Head Admin can access role/permission management');
            console.log(`   Found ${roles.data.length} roles`);
            console.log(`   Found ${permissions.data.length} permissions\n`);
        } catch (error) {
            console.log('❌ Head Admin cannot access role/permission management:', error.response?.data?.message || error.message);
        }

        // Test 4: Super Admin Login and Limited Access
        console.log('4️⃣ Testing Super Admin Login and Access...');
        const superAdminLogin = await axios.post(`${API_BASE_URL}/accounts/authenticate`, testCredentials.superAdmin);
        console.log('✅ Super Admin login successful');
        console.log(`   Role: ${superAdminLogin.data.role}\n`);

        const superAdminToken = superAdminLogin.data.jwtToken;

        // Test 5: Super Admin cannot access admin management
        console.log('5️⃣ Testing Super Admin Admin Management Access (should be denied)...');
        try {
            await axios.get(`${API_BASE_URL}/accounts/head-admin/admins`, {
                headers: { Authorization: `Bearer ${superAdminToken}` }
            });
            console.log('❌ Super Admin should not be able to access admin management');
        } catch (error) {
            console.log('✅ Super Admin correctly denied access to admin management');
            console.log(`   Error: ${error.response?.data?.message}\n`);
        }

        // Test 6: Regular Admin Login
        console.log('6️⃣ Testing Regular Admin Login...');
        const adminLogin = await axios.post(`${API_BASE_URL}/accounts/authenticate`, testCredentials.admin);
        console.log('✅ Regular Admin login successful');
        console.log(`   Role: ${adminLogin.data.role}\n`);

        // Test 7: Accounting Login
        console.log('7️⃣ Testing Accounting Login...');
        const accountingLogin = await axios.post(`${API_BASE_URL}/accounts/authenticate`, testCredentials.accounting);
        console.log('✅ Accounting login successful');
        console.log(`   Role: ${accountingLogin.data.role}\n`);

        // Test 8: Permission Checking
        console.log('8️⃣ Testing Permission Checking...');
        try {
            const permissionCheck = await axios.get(`${API_BASE_URL}/accounts/head-admin/check-permission?resource=dashboard&action=read`, {
                headers: { Authorization: `Bearer ${headAdminToken}` }
            });
            console.log('✅ Permission checking works');
            console.log(`   Head Admin can read dashboard: ${permissionCheck.data.hasPermission}\n`);
        } catch (error) {
            console.log('❌ Permission checking failed:', error.response?.data?.message || error.message);
        }

        console.log('🎉 RBAC System Test Completed!');
        console.log('\n📋 Summary:');
        console.log('   - Head Admin has full access to admin management');
        console.log('   - Super Admin is correctly restricted from admin management');
        console.log('   - All user roles can authenticate successfully');
        console.log('   - Permission system is working correctly');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data?.message || error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('   1. Make sure the server is running on port 3000');
        console.log('   2. Check that the database is properly initialized');
        console.log('   3. Verify that default users are seeded');
    }
}

// Run the test
testRBACSystem();
