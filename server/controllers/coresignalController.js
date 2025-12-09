const mcpClientManager = require('../utils/mcpClient');
const { generateAIInsights } = require('../utils/aiProcessor');

// Test CoreSignal API connection via MCP
const testConnection = async (req, res) => {
  try {
    console.log('🔗 Testing CoreSignal API connection via MCP');
    
    // Initialize MCP client with CoreSignal configuration
    const mcpConfig = {
      name: 'coresignal-agent',
      version: '1.0.0',
      server: 'https://mcp.coresignal.com/sse',
      type: 'sse',
      credentials: {
        headers: {
          apikey: process.env.CORESIGNAL_API_KEY
        }
      }
    };

    await mcpClientManager.initialize(mcpConfig);
    
    // Test by calling a simple company search
    const testQuery = {
      query: {
        bool: {
          must: [
            {
              match: {
                company_name: "test"
              }
            }
          ]
        }
      },
      keys: ["company_name", "website"],
      limit: 1
    };

    const result = await mcpClientManager.callTool('coresignal_company_multisource_api', testQuery);
    
    res.json({
      success: true,
      message: 'CoreSignal MCP connection successful',
      data: result
    });
  } catch (error) {
    console.error('❌ CoreSignal MCP connection test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Search companies via MCP
const searchCompanies = async (req, res) => {
  try {
    const { query, limit = 10, filters = {}, keys = [] } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }

    console.log('🔍 Searching companies via MCP with query:', query);
    
    // Initialize MCP client if not already connected
    if (!mcpClientManager.isReady()) {
      const mcpConfig = {
        name: 'coresignal-agent',
        version: '1.0.0',
        server: 'https://mcp.coresignal.com/sse',
        type: 'sse',
        credentials: {
          headers: {
            apikey: process.env.CORESIGNAL_API_KEY
          }
        }
      };
      await mcpClientManager.initialize(mcpConfig);
    }

    // Build Elasticsearch query
    const esQuery = {
      query: {
        bool: {
          must: []
        }
      },
      keys: keys.length > 0 ? keys : [
        "company_name",
        "website", 
        "industry",
        "employees_count",
        "hq_full_address",
        "description",
        "founded_year"
      ],
      limit: parseInt(limit)
    };

    // Add search terms to query
    if (typeof query === 'string') {
      // Simple text search
      esQuery.query.bool.must.push({
        multi_match: {
          query: query,
          fields: ["company_name", "description", "industry"]
        }
      });
    } else if (typeof query === 'object') {
      // Complex query object
      esQuery.query = query;
    }

    // Add filters if provided
    if (filters.location) {
      esQuery.query.bool.must.push({
        match: {
          hq_city: filters.location
        }
      });
    }

    if (filters.industry) {
      esQuery.query.bool.must.push({
        match: {
          industry: filters.industry
        }
      });
    }

    console.log('📋 MCP query:', JSON.stringify(esQuery, null, 2));
    
    const result = await mcpClientManager.callTool('coresignal_company_multisource_api', esQuery);
    
    res.json({
      success: true,
      data: result,
      companies: result.content || [],
      total: result.content?.length || 0
    });
  } catch (error) {
    console.error('❌ Company search via MCP failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get company details via MCP
const getCompanyDetails = async (req, res) => {
  try {
    const { companyId } = req.params;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    console.log('🏢 Getting company details via MCP for ID:', companyId);
    
    // Initialize MCP client if not already connected
    if (!mcpClientManager.isReady()) {
      const mcpConfig = {
        name: 'coresignal-agent',
        version: '1.0.0',
        server: 'https://mcp.coresignal.com/sse',
        type: 'sse',
        credentials: {
          headers: {
            apikey: process.env.CORESIGNAL_API_KEY
          }
        }
      };
      await mcpClientManager.initialize(mcpConfig);
    }

    const esQuery = {
      query: {
        term: {
          id: parseInt(companyId)
        }
      },
      keys: [
        "company_name",
        "website",
        "industry", 
        "employees_count",
        "hq_full_address",
        "description",
        "founded_year",
        "revenue_annual",
        "funding_rounds",
        "technologies_used",
        "competitors"
      ],
      limit: 1
    };
    
    const result = await mcpClientManager.callTool('coresignal_company_multisource_api', esQuery);
    
    res.json({
      success: true,
      data: result.content?.[0] || null
    });
  } catch (error) {
    console.error('❌ Get company details via MCP failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get company employees via MCP
const getCompanyEmployees = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { limit = 50, filters = {} } = req.query;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    console.log('👥 Getting employees via MCP for company ID:', companyId);
    
    // Initialize MCP client if not already connected
    if (!mcpClientManager.isReady()) {
      const mcpConfig = {
        name: 'coresignal-agent',
        version: '1.0.0',
        server: 'https://mcp.coresignal.com/sse',
        type: 'sse',
        credentials: {
          headers: {
            apikey: process.env.CORESIGNAL_API_KEY
          }
        }
      };
      await mcpClientManager.initialize(mcpConfig);
    }

    const esQuery = {
      query: {
        bool: {
          must: [
            {
              term: {
                "experience.company_id": parseInt(companyId)
              }
            },
            {
              term: {
                "experience.active_experience": 1
              }
            }
          ]
        }
      },
      keys: [
        "full_name",
        "headline",
        "active_experience_title",
        "active_experience_department",
        "active_experience_management_level",
        "location_full",
        "connections_count",
        "experience"
      ],
      limit: parseInt(limit)
    };
    
    const result = await mcpClientManager.callTool('coresignal_employee_multisource_api', esQuery);
    
    res.json({
      success: true,
      data: result,
      employees: result.content || []
    });
  } catch (error) {
    console.error('❌ Get company employees via MCP failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Search people via MCP
const searchPeople = async (req, res) => {
  try {
    const { query, limit = 10, filters = {}, keys = [] } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }

    console.log('👤 Searching people via MCP with query:', query);
    
    // Initialize MCP client if not already connected
    if (!mcpClientManager.isReady()) {
      const mcpConfig = {
        name: 'coresignal-agent',
        version: '1.0.0',
        server: 'https://mcp.coresignal.com/sse',
        type: 'sse',
        credentials: {
          headers: {
            apikey: process.env.CORESIGNAL_API_KEY
          }
        }
      };
      await mcpClientManager.initialize(mcpConfig);
    }

    // Build Elasticsearch query
    const esQuery = {
      query: {
        bool: {
          must: []
        }
      },
      keys: keys.length > 0 ? keys : [
        "full_name",
        "headline",
        "active_experience_title",
        "active_experience_company_name",
        "location_full",
        "connections_count",
        "experience"
      ],
      limit: parseInt(limit)
    };

    // Add search terms to query
    if (typeof query === 'string') {
      // Simple text search
      esQuery.query.bool.must.push({
        multi_match: {
          query: query,
          fields: ["full_name", "headline", "active_experience_title", "active_experience_company_name"]
        }
      });
    } else if (typeof query === 'object') {
      // Complex query object
      esQuery.query = query;
    }

    // Add filters if provided
    if (filters.location) {
      esQuery.query.bool.must.push({
        match: {
          location_full: filters.location
        }
      });
    }

    if (filters.company) {
      esQuery.query.bool.must.push({
        match: {
          "active_experience_company_name": filters.company
        }
      });
    }

    if (filters.title) {
      esQuery.query.bool.must.push({
        match: {
          "active_experience_title": filters.title
        }
      });
    }

    console.log('📋 MCP people query:', JSON.stringify(esQuery, null, 2));
    
    const result = await mcpClientManager.callTool('coresignal_employee_multisource_api', esQuery);
    
    res.json({
      success: true,
      data: result,
      people: result.content || [],
      total: result.content?.length || 0
    });
  } catch (error) {
    console.error('❌ People search via MCP failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get person details via MCP
const getPersonDetails = async (req, res) => {
  try {
    const { personId } = req.params;
    
    if (!personId) {
      return res.status(400).json({
        success: false,
        error: 'Person ID is required'
      });
    }

    console.log('👤 Getting person details via MCP for ID:', personId);
    
    // Initialize MCP client if not already connected
    if (!mcpClientManager.isReady()) {
      const mcpConfig = {
        name: 'coresignal-agent',
        version: '1.0.0',
        server: 'https://mcp.coresignal.com/sse',
        type: 'sse',
        credentials: {
          headers: {
            apikey: process.env.CORESIGNAL_API_KEY
          }
        }
      };
      await mcpClientManager.initialize(mcpConfig);
    }

    const esQuery = {
      query: {
        term: {
          id: parseInt(personId)
        }
      },
      keys: [
        "full_name",
        "headline",
        "summary",
        "location_full",
        "connections_count",
        "active_experience_title",
        "active_experience_company_name",
        "active_experience_description",
        "experience",
        "education",
        "skills",
        "certifications"
      ],
      limit: 1
    };
    
    const result = await mcpClientManager.callTool('coresignal_employee_multisource_api', esQuery);
    
    res.json({
      success: true,
      data: result.content?.[0] || null
    });
  } catch (error) {
    console.error('❌ Get person details via MCP failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get company insights via MCP
const getCompanyInsights = async (req, res) => {
  try {
    const { companyId } = req.params;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    console.log('📊 Getting insights via MCP for company ID:', companyId);
    
    // Initialize MCP client if not already connected
    if (!mcpClientManager.isReady()) {
      const mcpConfig = {
        name: 'coresignal-agent',
        version: '1.0.0',
        server: 'https://mcp.coresignal.com/sse',
        type: 'sse',
        credentials: {
          headers: {
            apikey: process.env.CORESIGNAL_API_KEY
          }
        }
      };
      await mcpClientManager.initialize(mcpConfig);
    }

    // Get comprehensive company data for insights
    const esQuery = {
      query: {
        term: {
          id: parseInt(companyId)
        }
      },
      keys: [
        "company_name",
        "employees_count",
        "employees_count_change",
        "revenue_annual",
        "funding_rounds",
        "technologies_used",
        "competitors",
        "total_website_visits_monthly",
        "visits_change_monthly",
        "active_job_postings_count",
        "product_reviews_aggregate_score",
        "employee_reviews_aggregate_score"
      ],
      limit: 1
    };
    
    const result = await mcpClientManager.callTool('coresignal_company_multisource_api', esQuery);
    
    res.json({
      success: true,
      data: result.content?.[0] || null
    });
  } catch (error) {
    console.error('❌ Get company insights via MCP failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get usage statistics
const getUsageStats = async (req, res) => {
  try {
    console.log('📈 Getting MCP usage statistics');
    
    // For MCP, we can return connection status and available tools
    const status = mcpClientManager.getStatus();
    
    let availableTools = [];
    if (mcpClientManager.isReady()) {
      try {
        availableTools = await mcpClientManager.getAvailableTools();
      } catch (error) {
        console.warn('Could not fetch available tools:', error.message);
      }
    }
    
    res.json({
      success: true,
      data: {
        mcpStatus: status,
        availableTools: availableTools.map(t => t.name),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Get usage stats failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Execute CoreSignal agent via MCP with AI processing
const executeAgent = async (req, res) => {
  try {
    const { agentType = 'research', query, limit = 10, filters = {}, companyId, aiAnalysis = true } = req.body;
    
    console.log('🚀 Executing CoreSignal agent via MCP:', agentType);
    
    // Initialize MCP client if not already connected
    if (!mcpClientManager.isReady()) {
      const mcpConfig = {
        name: 'coresignal-agent',
        version: '1.0.0',
        server: 'https://mcp.coresignal.com/sse',
        type: 'sse',
        credentials: {
          headers: {
            apikey: process.env.CORESIGNAL_API_KEY
          }
        }
      };
      await mcpClientManager.initialize(mcpConfig);
    }
    
    let mcpData = {};
    
    switch (agentType) {
      case 'research':
        if (!query) {
          return res.status(400).json({
            success: false,
            error: 'Query is required for research agent'
          });
        }
        
        // Search for companies and people using MCP
        const companyQuery = {
          query: {
            bool: {
              must: [
                {
                  multi_match: {
                    query: query,
                    fields: ["company_name", "description", "industry"]
                  }
                }
              ]
            }
          },
          keys: [
            "company_name",
            "website",
            "industry",
            "employees_count",
            "hq_full_address",
            "description",
            "founded_year",
            "revenue_annual",
            "funding_rounds"
          ],
          limit: parseInt(limit)
        };

        const peopleQuery = {
          query: {
            bool: {
              must: [
                {
                  multi_match: {
                    query: query,
                    fields: ["full_name", "headline", "active_experience_title"]
                  }
                }
              ]
            }
          },
          keys: [
            "full_name",
            "headline",
            "active_experience_title",
            "active_experience_company_name",
            "location_full",
            "connections_count"
          ],
          limit: parseInt(limit)
        };
        
        const companyResults = await mcpClientManager.callTool('coresignal_company_multisource_api', companyQuery);
        const peopleResults = await mcpClientManager.callTool('coresignal_employee_multisource_api', peopleQuery);
        
        mcpData = {
          companies: companyResults.content || [],
          people: peopleResults.content || [],
          companyTotal: companyResults.content?.length || 0,
          peopleTotal: peopleResults.content?.length || 0
        };
        break;
        
      case 'analysis':
        if (!companyId) {
          return res.status(400).json({
            success: false,
            error: 'Company ID is required for analysis agent'
          });
        }
        
        // Get comprehensive company analysis using MCP
        const companyDetailsQuery = {
          query: {
            term: {
              id: parseInt(companyId)
            }
          },
          keys: [
            "company_name",
            "website",
            "industry",
            "employees_count",
            "hq_full_address",
            "description",
            "founded_year",
            "revenue_annual",
            "funding_rounds",
            "technologies_used",
            "competitors"
          ],
          limit: 1
        };

        const employeesQuery = {
          query: {
            bool: {
              must: [
                {
                  term: {
                    "experience.company_id": parseInt(companyId)
                  }
                },
                {
                  term: {
                    "experience.active_experience": 1
                  }
                }
              ]
            }
          },
          keys: [
            "full_name",
            "headline",
            "active_experience_title",
            "active_experience_department",
            "active_experience_management_level"
          ],
          limit: 50
        };
        
        const companyDetails = await mcpClientManager.callTool('coresignal_company_multisource_api', companyDetailsQuery);
        const employees = await mcpClientManager.callTool('coresignal_employee_multisource_api', employeesQuery);
        
        mcpData = {
          companyDetails: companyDetails.content?.[0] || null,
          employees: employees.content || [],
          employeeTotal: employees.content?.length || 0
        };
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid agent type. Supported types: research, analysis'
        });
    }
    
    // Process with AI if requested
    let aiInsights = null;
    if (aiAnalysis) {
      try {
        console.log('🤖 Processing data with AI...');
        aiInsights = await generateAIInsights({
          agentType,
          query,
          companyId,
          data: mcpData
        });
      } catch (aiError) {
        console.warn('⚠️ AI processing failed:', aiError.message);
        // Continue without AI insights
      }
    }
    
    const result = {
      success: true,
      agentType: agentType,
      query: query,
      companyId: companyId,
      timestamp: new Date().toISOString(),
      mcpData: mcpData,
      aiInsights: aiInsights
    };
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Agent execution via MCP failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  testConnection,
  searchCompanies,
  getCompanyDetails,
  getCompanyEmployees,
  searchPeople,
  getPersonDetails,
  getCompanyInsights,
  getUsageStats,
  executeAgent
}; 