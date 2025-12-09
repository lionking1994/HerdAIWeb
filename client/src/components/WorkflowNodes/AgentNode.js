import React from 'react';
import CompanyAnalysisGraph from '../CompanyAnalysisGraph';

const AgentNode = ({ nodeInstance, aiNodes }) => {
  const { result, node_name } = nodeInstance;

  if (!result) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">
          <p>No analysis results available</p>
        </div>
      </div>
    );
  }

  // Extract company analysis from agent response
  let companyAnalysis = null;
  if (result.agentResponse) {
    try {
      if (typeof result.agentResponse === 'string') {
        const jsonMatch = result.agentResponse.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          companyAnalysis = JSON.parse(jsonMatch[1]);
        } else {
          companyAnalysis = result.agentResponse;
        }
      } else {
        companyAnalysis = result.agentResponse;
      }
    } catch (error) {
      console.error('Error parsing agent response:', error);
      companyAnalysis = result.agentResponse;
    }
  }

  return (
    <div className="p-6">
      
      {companyAnalysis && (
        <div className="mb-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">
            {`${companyAnalysis?.companyAnalysis?.companyName || 'Unknown'}: Comprehensive Company Analysis`}
          </h4>
          <p className="text-sm text-gray-600 mb-4">
            {companyAnalysis?.companyAnalysis?.subtitle || 'Interactive visualization of company analysis'}
          </p>
          
          {/* Main Visualization Area */}
          <div className="lg:col-span-2">
            <CompanyAnalysisGraph companyData={aiNodes} />
          </div>
        </div>
      )}
      
      {/* Raw Results */}
      {/* <div className="mt-6">
        <h4 className="text-md font-semibold text-gray-900 mb-3">Raw Analysis Data</h4>
        <div className="bg-gray-50 p-4 rounded-lg">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-x-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      </div> */}
    </div>
  );
};

export default AgentNode;
