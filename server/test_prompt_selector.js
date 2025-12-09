/**
 * Test script for the prompt selector utility
 * This script tests both company template and platform default scenarios
 */

const { getPromptForCategory, getAvailablePromptCategories, getPromptStatistics } = require('./utils/promptSelector');

async function testPromptSelector() {
  console.log('🧪 Testing Prompt Selector Utility...\n');

  try {
    // Test 1: Get prompt for a company with templates
    console.log('📋 Test 1: Company with custom templates');
    const companyWithTemplates = 1; // Assuming company ID 1 has templates
    
    try {
      const taskPrompt = await getPromptForCategory('task', companyWithTemplates);
      console.log(`✅ Task prompt source: ${taskPrompt.source}`);
      console.log(`   Model: ${taskPrompt.model}`);
      console.log(`   Provider: ${taskPrompt.provider}`);
      if (taskPrompt.source === 'company_template') {
        console.log(`   Template ID: ${taskPrompt.templateId}`);
        console.log(`   Template Name: ${taskPrompt.templateName}`);
      }
    } catch (error) {
      console.log(`❌ Error getting task prompt: ${error.message}`);
    }

    try {
      const summaryPrompt = await getPromptForCategory('executive_summary', companyWithTemplates);
      console.log(`✅ Executive summary prompt source: ${summaryPrompt.source}`);
      console.log(`   Model: ${summaryPrompt.model}`);
      console.log(`   Provider: ${summaryPrompt.provider}`);
    } catch (error) {
      console.log(`❌ Error getting executive summary prompt: ${error.message}`);
    }

    // Test 2: Get prompt for a company without templates (should fallback to platform defaults)
    console.log('\n📋 Test 2: Company without custom templates (fallback to platform defaults)');
    const companyWithoutTemplates = 999; // Assuming company ID 999 has no templates
    
    try {
      const taskPrompt = await getPromptForCategory('task', companyWithoutTemplates);
      console.log(`✅ Task prompt source: ${taskPrompt.source}`);
      console.log(`   Model: ${taskPrompt.model}`);
      console.log(`   Provider: ${taskPrompt.provider}`);
    } catch (error) {
      console.log(`❌ Error getting task prompt: ${error.message}`);
    }

    try {
      const summaryPrompt = await getPromptForCategory('executive_summary', companyWithoutTemplates);
      console.log(`✅ Executive summary prompt source: ${summaryPrompt.source}`);
      console.log(`   Model: ${summaryPrompt.model}`);
      console.log(`   Provider: ${summaryPrompt.provider}`);
    } catch (error) {
      console.log(`❌ Error getting executive summary prompt: ${error.message}`);
    }

    // Test 3: Get available prompt categories
    console.log('\n📋 Test 3: Available prompt categories');
    
    try {
      const categories = await getAvailablePromptCategories(companyWithTemplates);
      console.log('✅ Available categories:');
      Object.entries(categories).forEach(([category, info]) => {
        console.log(`   ${category}: ${info.source} (${info.templateCount} templates)`);
      });
    } catch (error) {
      console.log(`❌ Error getting available categories: ${error.message}`);
    }

    // Test 4: Get prompt statistics
    console.log('\n📋 Test 4: Prompt statistics');
    
    try {
      const stats = await getPromptStatistics(companyWithTemplates);
      console.log('✅ Prompt statistics:');
      console.log(`   Total templates: ${stats.totalTemplates}`);
      console.log(`   Unique categories: ${stats.uniqueCategories}`);
      console.log(`   Company templates: ${stats.companyTemplates}`);
      console.log(`   Platform templates: ${stats.platformTemplates}`);
    } catch (error) {
      console.log(`❌ Error getting prompt statistics: ${error.message}`);
    }

    // Test 5: Test error handling with invalid category
    console.log('\n📋 Test 5: Error handling with invalid category');
    
    try {
      const invalidPrompt = await getPromptForCategory('invalid_category', companyWithTemplates);
      console.log(`❌ Unexpected success: ${invalidPrompt.source}`);
    } catch (error) {
      console.log(`✅ Expected error caught: ${error.message}`);
    }

    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testPromptSelector()
    .then(() => {
      console.log('\n✅ Test script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test script failed:', error);
      process.exit(1);
    });
}

module.exports = { testPromptSelector };

