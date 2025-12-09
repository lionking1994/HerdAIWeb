const coresignalApi = require('../coresignalApi');

class CoreSignalAgentExecutor {
  constructor(io) {
    this.io = io;
  }

  /**
   * Execute CoreSignal agent with direct API calls
   */
  async execute(nodeInstance, node, workflowInstance, data = {}) {
    try {
      console.log('🚀 Executing CoreSignal Agent with direct API');
      console.log('Node config:', JSON.stringify(node.config, null, 2));
      console.log('Workflow data:', JSON.stringify(data, null, 2));

      const agentConfig = node.config.agentConfig || {};
      const agentType = agentConfig.agentType || 'research';

      switch (agentType) {
        case 'research':
          return await this.executeResearchAgent(agentConfig, data);
        case 'analysis':
          return await this.executeAnalysisAgent(agentConfig, data);
        case 'summary':
          return await this.executeSummaryAgent(agentConfig, data);
        case 'custom':
          return await this.executeCustomAgent(agentConfig, data);
        default:
          return await this.executeResearchAgent(agentConfig, data);
      }
    } catch (error) {
      console.error('❌ CoreSignal Agent execution error:', error);
      return {
        response: `CoreSignal Agent error: ${error.message}`,
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Execute research agent - search for companies and people
   */
  async executeResearchAgent(agentConfig, data) {
    try {
      console.log('🔍 Executing CoreSignal Research Agent');
      
      const query = this.createSearchQuery(data);
      const limit = data.limit || agentConfig.limit || 10;
      
      console.log('Search query:', query);
      console.log('Search limit:', limit);

      // Search for companies
      const companyResults = await coresignalApi.searchCompanies(query, {
        limit: limit,
        filters: data.filters || {}
      });

      // Search for people
      const peopleResults = await coresignalApi.searchPeople(query, {
        limit: limit,
        filters: data.filters || {}
      });

      const response = {
        query: query,
        companies: companyResults.success ? companyResults.companies : [],
        people: peopleResults.success ? peopleResults.people : [],
        companyTotal: companyResults.total || 0,
        peopleTotal: peopleResults.total || 0,
        timestamp: new Date().toISOString()
      };

      // Format the response for better readability
      const formattedResponse = this.formatResearchResponse(response);

      return {
        response: formattedResponse,
        success: true,
        timestamp: new Date().toISOString(),
        data: response,
        agentType: 'research'
      };

    } catch (error) {
      console.error('❌ Research agent error:', error);
      return {
        response: `Research agent error: ${error.message}`,
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Execute analysis agent - get detailed company insights
   */
  async executeAnalysisAgent(agentConfig, data) {
    try {
      console.log('📊 Executing CoreSignal Analysis Agent');
      
      const companyId = data.companyId || data.company_id;
      if (!companyId) {
        throw new Error('Company ID is required for analysis');
      }

      // Get company details
      const companyDetails = await coresignalApi.getCompanyDetails(companyId);
      
      // Get company insights
      const companyInsights = await coresignalApi.getCompanyInsights(companyId);
      
      // Get company employees
      const employees = await coresignalApi.getCompanyEmployees(companyId, {
        limit: data.employeeLimit || 50
      });

      const response = {
        companyId: companyId,
        companyDetails: companyDetails.success ? companyDetails.data : null,
        insights: companyInsights.success ? companyInsights.data : null,
        employees: employees.success ? employees.employees : [],
        employeeTotal: employees.success ? employees.data?.total : 0,
        timestamp: new Date().toISOString()
      };

      // Format the response for better readability
      const formattedResponse = this.formatAnalysisResponse(response);

      return {
        response: formattedResponse,
        success: true,
        timestamp: new Date().toISOString(),
        data: response,
        agentType: 'analysis'
      };

    } catch (error) {
      console.error('❌ Analysis agent error:', error);
      return {
        response: `Analysis agent error: ${error.message}`,
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Execute summary agent - create summaries of findings
   */
  async executeSummaryAgent(agentConfig, data) {
    try {
      console.log('📝 Executing CoreSignal Summary Agent');
      
      // This would typically use an LLM to summarize the data
      // For now, we'll create a structured summary
      const summary = this.createSummary(data);

      return {
        response: summary,
        success: true,
        timestamp: new Date().toISOString(),
        agentType: 'summary'
      };

    } catch (error) {
      console.error('❌ Summary agent error:', error);
      return {
        response: `Summary agent error: ${error.message}`,
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Execute custom agent - handle custom queries
   */
  async executeCustomAgent(agentConfig, data) {
    try {
      console.log('⚙️ Executing CoreSignal Custom Agent');
      
      const customQuery = agentConfig.prompt || data.query;
      if (!customQuery) {
        throw new Error('Custom query is required');
      }

      // Parse the custom query to determine what to search for
      const searchType = this.parseCustomQuery(customQuery);
      
      let results = {};
      
      if (searchType.includes('company') || searchType.includes('companies')) {
        results.companies = await coresignalApi.searchCompanies(customQuery, {
          limit: data.limit || 10
        });
      }
      
      if (searchType.includes('person') || searchType.includes('people')) {
        results.people = await coresignalApi.searchPeople(customQuery, {
          limit: data.limit || 10
        });
      }

      const response = this.formatCustomResponse(results, customQuery);

      return {
        response: response,
        success: true,
        timestamp: new Date().toISOString(),
        data: results,
        agentType: 'custom'
      };

    } catch (error) {
      console.error('❌ Custom agent error:', error);
      return {
        response: `Custom agent error: ${error.message}`,
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Create search query from workflow data
   */
  createSearchQuery(data) {
    if (data.query) {
      return data.query;
    }

    // Create query from available data
    const queryParts = [];
    
    if (data.companyName) queryParts.push(`company:${data.companyName}`);
    if (data.industry) queryParts.push(`industry:${data.industry}`);
    if (data.location) queryParts.push(`location:${data.location}`);
    if (data.keywords) queryParts.push(data.keywords);
    
    return queryParts.length > 0 ? queryParts.join(' ') : 'technology companies';
  }

  /**
   * Format research response for better readability
   */
  formatResearchResponse(response) {
    let formatted = `🔍 **Research Results for: ${response.query}**\n\n`;
    
    if (response.companies.length > 0) {
      formatted += `🏢 **Companies Found (${response.companyTotal}):**\n`;
      response.companies.forEach((company, index) => {
        formatted += `${index + 1}. **${company.name || company.company_name}**\n`;
        if (company.industry) formatted += `   Industry: ${company.industry}\n`;
        if (company.location) formatted += `   Location: ${company.location}\n`;
        if (company.description) formatted += `   Description: ${company.description.substring(0, 100)}...\n`;
        formatted += '\n';
      });
    }
    
    if (response.people.length > 0) {
      formatted += `👥 **People Found (${response.peopleTotal}):**\n`;
      response.people.forEach((person, index) => {
        formatted += `${index + 1}. **${person.name || person.full_name}**\n`;
        if (person.title) formatted += `   Title: ${person.title}\n`;
        if (person.company) formatted += `   Company: ${person.company}\n`;
        if (person.location) formatted += `   Location: ${person.location}\n`;
        formatted += '\n';
      });
    }
    
    if (response.companies.length === 0 && response.people.length === 0) {
      formatted += '❌ No results found for the given query.\n';
    }
    
    return formatted;
  }

  /**
   * Format analysis response for better readability
   */
  formatAnalysisResponse(response) {
    let formatted = `📊 **Company Analysis: ${response.companyDetails?.name || 'Unknown Company'}**\n\n`;
    
    if (response.companyDetails) {
      formatted += `🏢 **Company Details:**\n`;
      formatted += `   Name: ${response.companyDetails.name || response.companyDetails.company_name}\n`;
      if (response.companyDetails.industry) formatted += `   Industry: ${response.companyDetails.industry}\n`;
      if (response.companyDetails.location) formatted += `   Location: ${response.companyDetails.location}\n`;
      if (response.companyDetails.website) formatted += `   Website: ${response.companyDetails.website}\n`;
      if (response.companyDetails.description) formatted += `   Description: ${response.companyDetails.description}\n`;
      formatted += '\n';
    }
    
    if (response.insights) {
      formatted += `📈 **Insights:**\n`;
      if (response.insights.revenue) formatted += `   Revenue: ${response.insights.revenue}\n`;
      if (response.insights.employees) formatted += `   Employees: ${response.insights.employees}\n`;
      if (response.insights.founded) formatted += `   Founded: ${response.insights.founded}\n`;
      formatted += '\n';
    }
    
    if (response.employees.length > 0) {
      formatted += `👥 **Key Employees (${response.employeeTotal}):**\n`;
      response.employees.slice(0, 10).forEach((employee, index) => {
        formatted += `${index + 1}. **${employee.name || employee.full_name}**\n`;
        if (employee.title) formatted += `   Title: ${employee.title}\n`;
        if (employee.department) formatted += `   Department: ${employee.department}\n`;
        formatted += '\n';
      });
    }
    
    return formatted;
  }

  /**
   * Create summary from data
   */
  createSummary(data) {
    let summary = `📝 **Summary Report**\n\n`;
    
    if (data.companies && data.companies.length > 0) {
      summary += `Found ${data.companies.length} companies matching the criteria.\n`;
      summary += `Top companies: ${data.companies.slice(0, 3).map(c => c.name || c.company_name).join(', ')}\n\n`;
    }
    
    if (data.people && data.people.length > 0) {
      summary += `Found ${data.people.length} people matching the criteria.\n`;
      summary += `Key people: ${data.people.slice(0, 3).map(p => p.name || p.full_name).join(', ')}\n\n`;
    }
    
    summary += `Generated on: ${new Date().toLocaleString()}`;
    
    return summary;
  }

  /**
   * Parse custom query to determine search type
   */
  parseCustomQuery(query) {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('company') || lowerQuery.includes('companies') || 
        lowerQuery.includes('business') || lowerQuery.includes('organization')) {
      return 'company';
    }
    
    if (lowerQuery.includes('person') || lowerQuery.includes('people') || 
        lowerQuery.includes('employee') || lowerQuery.includes('executive')) {
      return 'person';
    }
    
    return 'both';
  }

  /**
   * Format custom response
   */
  formatCustomResponse(results, query) {
    let formatted = `🔍 **Custom Search Results for: ${query}**\n\n`;
    
    if (results.companies && results.companies.success && results.companies.companies.length > 0) {
      formatted += `🏢 **Companies:**\n`;
      results.companies.companies.forEach((company, index) => {
        formatted += `${index + 1}. ${company.name || company.company_name}\n`;
      });
      formatted += '\n';
    }
    
    if (results.people && results.people.success && results.people.people.length > 0) {
      formatted += `👥 **People:**\n`;
      results.people.people.forEach((person, index) => {
        formatted += `${index + 1}. ${person.name || person.full_name} - ${person.title || 'Unknown Title'}\n`;
      });
      formatted += '\n';
    }
    
    if ((!results.companies || !results.companies.success) && 
        (!results.people || !results.people.success)) {
      formatted += '❌ No results found for the custom query.\n';
    }
    
    return formatted;
  }
}

module.exports = CoreSignalAgentExecutor; 