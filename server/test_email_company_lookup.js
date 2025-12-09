/**
 * Test script for the email-based company lookup utility
 * This script tests the company helper functions
 */

const { 
  getCompanyIdFromUserId,
  extractCompanyFromEmail,
  getCompanyIdFromEmail,
  getCompanyFromEmail
} = require('./utils/companyHelper');

async function testEmailCompanyLookup() {
  console.log('🧪 Testing Email-Based Company Lookup...\n');

  try {
    // Test 1: Extract company name from email
    console.log('📋 Test 1: Extract company name from email');
    
    const testEmails = [
      'user@example.com',
      'john.doe@acme-corp.com',
      'admin@test-company.org',
      'invalid-email',
      'user@subdomain.company.com',
      null,
      undefined,
      ''
    ];

    testEmails.forEach(email => {
      const companyName = extractCompanyFromEmail(email);
      console.log(`   ${email || 'null'} → "${companyName || 'null'}"`);
    });

    // Test 2: Get company ID from email (requires database)
    console.log('\n📋 Test 2: Get company ID from email');
    
    const testEmailForLookup = 'user@example.com';
    try {
      const companyId = await getCompanyIdFromEmail(testEmailForLookup);
      console.log(`   ${testEmailForLookup} → Company ID: ${companyId || 'null'}`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    // Test 3: Get company information from email
    console.log('\n📋 Test 3: Get company information from email');
    
    try {
      const company = await getCompanyFromEmail(testEmailForLookup);
      if (company) {
        console.log(`   ${testEmailForLookup} → Company found:`);
        console.log(`     ID: ${company.id}`);
        console.log(`     Name: ${company.name}`);
        console.log(`     Domain: ${company.domain || 'N/A'}`);
      } else {
        console.log(`   ${testEmailForLookup} → No company found`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    // Test 4: Get company ID from user ID (requires database)
    console.log('\n📋 Test 4: Get company ID from user ID');
    
    const testUserId = 1; // Replace with actual user ID for testing
    try {
      const companyId = await getCompanyIdFromUserId(testUserId);
      console.log(`   User ID ${testUserId} → Company ID: ${companyId || 'null'}`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    console.log('\n🎉 Email-based company lookup test completed!');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  console.log('Note: Make sure you have a valid database connection and test data.');
  console.log('Also ensure you have users and companies in your database for testing.\n');
  
  testEmailCompanyLookup()
    .then(() => {
      console.log('\n✅ Test script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test script failed:', error);
      process.exit(1);
    });
}

module.exports = { testEmailCompanyLookup };

