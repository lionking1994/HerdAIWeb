// const axios = require('axios');

// // Test the opportunity detail API endpoint
// async function testOpportunityDetailAPI() {
//   try {
//     console.log('🧪 Testing Opportunity Detail API...');
    
//     // Replace with actual values from your database
//     const opportunityId = 'your-opportunity-id-here';
//     const companyId = 'your-company-id-here';
//     const token = 'your-auth-token-here';
    
//     const response = await axios.get(
//       `http://localhost:5173/crm/opportunities/${opportunityId}/detail`,
//       {
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'X-Company-ID': companyId
//         }
//       }
//     );
    
//     console.log('✅ API Response:');
//     console.log('Status:', response.status);
//     console.log('Success:', response.data.success);
//     console.log('Message:', response.data.message);
    
//     if (response.data.success) {
//       const data = response.data.data;
//       console.log('\n📊 Opportunity Data:');
//       console.log('- Name:', data.opportunity.name);
//       console.log('- Amount:', data.opportunity.amount);
//       console.log('- Stage:', data.opportunity.stage);
      
//       console.log('\n🏢 Account Data:');
//       console.log('- Name:', data.account.name);
//       console.log('- Industry:', data.account.industry);
//       console.log('- Website:', data.account.website);
      
//       console.log('\n👤 Contact Data:');
//       console.log('- Name:', data.contact.name);
//       console.log('- Title:', data.contact.title);
//       console.log('- Email:', data.contact.email);
      
//       console.log('\n👨‍💼 Owner Data:');
//       console.log('- Name:', data.owner.name);
//       console.log('- Email:', data.owner.email);
//     }
    
//   } catch (error) {
//     console.error('❌ API Test Failed:');
//     if (error.response) {
//       console.error('Status:', error.response.status);
//       console.error('Data:', error.response.data);
//     } else {
//       console.error('Error:', error.message);
//     }
//   }
// }

// // Run the test
// testOpportunityDetailAPI();
