/**
 * Test script for the prompt source API endpoint
 * This script tests that the prompt API returns source information
 */

const axios = require('axios');

async function testPromptSourceAPI() {
  console.log('🧪 Testing Prompt Source API...\n');

  try {
    // Test configuration
    const baseURL = process.env.API_URL || 'http://localhost:3000';
    const testToken = 'your-test-token-here'; // Replace with actual test token
    
    // Test cases
    const testCases = [
      { endpoint: 'task', description: 'Task Generation Prompt' },
      { endpoint: 'executive_summary', description: 'Executive Summary Prompt' },
      { endpoint: 'open_task_summary', description: 'Open Task Summary Prompt' }
    ];

    for (const testCase of testCases) {
      console.log(`📋 Testing ${testCase.description} (${testCase.endpoint})`);
      
      try {
        const response = await axios.get(`${baseURL}/prompt/${testCase.endpoint}`, {
          headers: {
            'Authorization': `Bearer ${testToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.data.success) {
          console.log(`✅ Successfully fetched ${testCase.endpoint} prompt`);
          
          // Check if promptSource is included
          if (response.data.promptSource) {
            const source = response.data.promptSource;
            console.log(`   📍 Source: ${source.source}`);
            console.log(`   🤖 Model: ${source.provider}/${source.model}`);
            
            if (source.source === 'company_template') {
              console.log(`   📝 Template ID: ${source.templateId}`);
              console.log(`   📝 Template Name: ${source.templateName}`);
            }
          } else {
            console.log(`❌ Missing promptSource in response`);
          }
          
          // Check required fields
          const requiredFields = ['prompt', 'modelId', 'maxtokens'];
          const missingFields = requiredFields.filter(field => !response.data[field]);
          
          if (missingFields.length === 0) {
            console.log(`   ✅ All required fields present`);
          } else {
            console.log(`   ❌ Missing fields: ${missingFields.join(', ')}`);
          }
          
        } else {
          console.log(`❌ API returned success: false`);
          console.log(`   Error: ${response.data.error || 'Unknown error'}`);
        }
        
      } catch (error) {
        if (error.response) {
          console.log(`❌ HTTP ${error.response.status}: ${error.response.data?.error || error.response.statusText}`);
        } else {
          console.log(`❌ Network error: ${error.message}`);
        }
      }
      
      console.log(''); // Empty line for readability
    }

    console.log('🎉 Prompt Source API test completed!');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  console.log('Note: Make sure to set a valid test token in the script before running.');
  console.log('Also ensure the API server is running and accessible.\n');
  
  testPromptSourceAPI()
    .then(() => {
      console.log('\n✅ Test script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test script failed:', error);
      process.exit(1);
    });
}

module.exports = { testPromptSourceAPI };

