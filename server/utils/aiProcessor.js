const { OpenAI } = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate AI insights from CoreSignal data
 * @param {Object} params - Parameters for AI processing
 * @param {string} params.agentType - Type of agent (research, analysis)
 * @param {string} params.query - Original search query
 * @param {string} params.companyId - Company ID (for analysis)
 * @param {Object} params.data - MCP data from CoreSignal
 * @returns {Object} AI insights
 */
const generateAIInsights = async ({ agentType, query, companyId, data }) => {
  try {
    console.log('🤖 Generating AI insights for:', agentType);
    
    let prompt = '';
    let systemPrompt = '';
    
    switch (agentType) {
      case 'research':
        systemPrompt = `You are an expert business analyst specializing in market research and competitive intelligence. 
        Analyze the provided company and people data to generate actionable insights.`;
        
        prompt = `Based on the search query "${query}", I found the following data:

Companies Found: ${data.companyTotal}
People Found: ${data.peopleTotal}

Company Data:
${JSON.stringify(data.companies?.slice(0, 5), null, 2)}

People Data:
${JSON.stringify(data.people?.slice(0, 5), null, 2)}

Please provide:
1. Market Analysis: Key trends and patterns in the data
2. Competitive Landscape: Notable companies and their characteristics
3. Talent Insights: Key people and their roles
4. Recommendations: Strategic insights and next steps
5. Risk Assessment: Potential challenges or opportunities

Format your response as structured insights with clear sections.`;
        break;
        
      case 'analysis':
        systemPrompt = `You are an expert business analyst specializing in company analysis and strategic insights. 
        Analyze the provided company and employee data to generate comprehensive business intelligence.`;
        
        prompt = `Analyzing company ID: ${companyId}

Company Details:
${JSON.stringify(data.companyDetails, null, 2)}

Employee Data (${data.employeeTotal} employees):
${JSON.stringify(data.employees?.slice(0, 10), null, 2)}

Please provide:
1. Company Overview: Key business characteristics and positioning
2. Financial Health: Revenue, funding, and growth indicators
3. Technology Stack: Technologies used and their implications
4. Competitive Position: Market position and competitive advantages
5. Talent Analysis: Employee composition and expertise
6. Strategic Recommendations: Growth opportunities and risks
7. Market Context: Industry trends and positioning

Format your response as structured insights with clear sections.`;
        break;
        
      default:
        throw new Error(`Unsupported agent type: ${agentType}`);
    }
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });
    
    const aiResponse = completion.choices[0]?.message?.content;
    
    // Parse the AI response into structured insights
    const insights = parseAIResponse(aiResponse, agentType);
    
    return {
      summary: aiResponse,
      insights: insights,
      generatedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ AI processing failed:', error);
    throw error;
  }
};

/**
 * Parse AI response into structured insights
 * @param {string} aiResponse - Raw AI response
 * @param {string} agentType - Type of agent
 * @returns {Object} Structured insights
 */
const parseAIResponse = (aiResponse, agentType) => {
  try {
    const insights = {
      keyFindings: [],
      recommendations: [],
      risks: [],
      opportunities: []
    };
    
    // Extract key findings
    const findingsMatch = aiResponse.match(/Key Findings?:(.*?)(?=\n\n|\n[A-Z]|$)/s);
    if (findingsMatch) {
      insights.keyFindings = findingsMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
        .map(line => line.replace(/^[-•]\s*/, '').trim())
        .filter(line => line.length > 0);
    }
    
    // Extract recommendations
    const recommendationsMatch = aiResponse.match(/Recommendations?:(.*?)(?=\n\n|\n[A-Z]|$)/s);
    if (recommendationsMatch) {
      insights.recommendations = recommendationsMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
        .map(line => line.replace(/^[-•]\s*/, '').trim())
        .filter(line => line.length > 0);
    }
    
    // Extract risks
    const risksMatch = aiResponse.match(/Risks?:(.*?)(?=\n\n|\n[A-Z]|$)/s);
    if (risksMatch) {
      insights.risks = risksMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
        .map(line => line.replace(/^[-•]\s*/, '').trim())
        .filter(line => line.length > 0);
    }
    
    // Extract opportunities
    const opportunitiesMatch = aiResponse.match(/Opportunities?:(.*?)(?=\n\n|\n[A-Z]|$)/s);
    if (opportunitiesMatch) {
      insights.opportunities = opportunitiesMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
        .map(line => line.replace(/^[-•]\s*/, '').trim())
        .filter(line => line.length > 0);
    }
    
    return insights;
    
  } catch (error) {
    console.warn('⚠️ Failed to parse AI response:', error);
    return {
      keyFindings: [],
      recommendations: [],
      risks: [],
      opportunities: []
    };
  }
};

/**
 * Generate executive summary from data
 * @param {Object} data - CoreSignal data
 * @param {string} query - Original query
 * @returns {string} Executive summary
 */
const generateExecutiveSummary = async (data, query) => {
  try {
    const prompt = `Generate a concise executive summary (2-3 sentences) for the following data:

Query: ${query}
Data: ${JSON.stringify(data, null, 2)}

Focus on the most important insights and actionable takeaways.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.5,
      max_tokens: 150
    });
    
    return completion.choices[0]?.message?.content || '';
    
  } catch (error) {
    console.error('❌ Executive summary generation failed:', error);
    return '';
  }
};

/**
 * Generate market intelligence report
 * @param {Object} data - CoreSignal data
 * @param {string} query - Original query
 * @returns {Object} Market intelligence report
 */
const generateMarketIntelligence = async (data, query) => {
  try {
    const prompt = `Generate a market intelligence report for the following data:

Query: ${query}
Data: ${JSON.stringify(data, null, 2)}

Please provide:
1. Market Overview
2. Competitive Analysis
3. Key Trends
4. Strategic Implications
5. Action Items

Format as a structured report.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    return {
      report: completion.choices[0]?.message?.content || '',
      generatedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Market intelligence generation failed:', error);
    throw error;
  }
};

module.exports = {
  generateAIInsights,
  generateExecutiveSummary,
  generateMarketIntelligence
}; 