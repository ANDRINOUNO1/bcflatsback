const db = require('./_helpers/db');

async function testAssociations() {
    try {
        console.log('🔍 Testing Database Associations...\n');

        // Test 1: Check if AccountRole can find Account
        console.log('1️⃣ Testing AccountRole -> Account association...');
        const accountRoles = await db.AccountRole.findAll({
            include: [{ model: db.Account, as: 'account' }]
        });
        console.log(`✅ Found ${accountRoles.length} account roles with account data`);

        // Test 2: Check if AccountRole can find Role
        console.log('2️⃣ Testing AccountRole -> Role association...');
        const accountRolesWithRoles = await db.AccountRole.findAll({
            include: [{ model: db.Role, as: 'role' }]
        });
        console.log(`✅ Found ${accountRolesWithRoles.length} account roles with role data`);

        // Test 3: Check if Account can find AccountRoles
        console.log('3️⃣ Testing Account -> AccountRole association...');
        const accountsWithRoles = await db.Account.findAll({
            include: [{ model: db.AccountRole, as: 'AccountRoles' }]
        });
        console.log(`✅ Found ${accountsWithRoles.length} accounts with role data`);

        // Test 4: Check specific Head Admin
        console.log('4️⃣ Testing Head Admin specific associations...');
        const headAdmin = await db.Account.findOne({ 
            where: { role: 'HeadAdmin' },
            include: [{ 
                model: db.AccountRole, 
                as: 'AccountRoles',
                include: [{ model: db.Role, as: 'role' }]
            }]
        });

        if (headAdmin) {
            console.log(`✅ Head Admin found: ${headAdmin.email}`);
            console.log(`   - AccountRoles: ${headAdmin.AccountRoles?.length || 0}`);
            if (headAdmin.AccountRoles && headAdmin.AccountRoles.length > 0) {
                headAdmin.AccountRoles.forEach(ar => {
                    console.log(`   - Role: ${ar.role?.name || 'Unknown'}`);
                });
            }
        } else {
            console.log('❌ Head Admin not found');
        }

        // Test 5: Check AccountRole model directly
        console.log('5️⃣ Testing AccountRole model directly...');
        const allAccountRoles = await db.AccountRole.findAll();
        console.log(`✅ Found ${allAccountRoles.length} total account roles`);

        if (allAccountRoles.length > 0) {
            const firstRole = allAccountRoles[0];
            console.log(`   - First role: AccountId=${firstRole.accountId}, RoleId=${firstRole.roleId}`);
        }

        console.log('\n🎉 Association Test Complete!');

    } catch (error) {
        console.error('❌ Association test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testAssociations();
