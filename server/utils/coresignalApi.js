const axios = require('axios');

class CoreSignalAPI {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.CORESIGNAL_API_KEY;
    this.baseURL = 'https://api.coresignal.com';
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000 // 30 seconds timeout
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🌐 CoreSignal API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ CoreSignal API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ CoreSignal API Response: ${response.status} ${response.statusText}`);
        return response;
      },
      (error) => {
        console.error('❌ CoreSignal API Response Error:', error.response?.status, error.response?.statusText);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Search for companies using CoreSignal API
   */
  async searchCompanies(query, options = {}) {
    try {
      const {
        limit = 10,
        offset = 0,
        filters = {},
        sortBy = 'relevance',
        sortOrder = 'desc'
      } = options;

      const requestBody = {
        query: query,
        limit: limit,
        offset: offset,
        filters: filters,
        sort: {
          field: sortBy,
          order: sortOrder
        }
      };

      console.log('🔍 Searching companies with query:', query);
      console.log('📋 Search options:', JSON.stringify(options, null, 2));

      // Try different possible endpoints
      let response;
      try {
        response = await this.client.post('/api/companies/search', requestBody);
      } catch (error) {
        if (error.response?.status === 404) {
          response = await this.client.post('/companies/search', requestBody);
        } else {
          throw error;
        }
      }
      
      return {
        success: true,
        data: response.data,
        total: response.data.total || 0,
        companies: response.data.companies || response.data.results || []
      };
    } catch (error) {
      console.error('❌ Company search failed:', error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Get company details by ID
   */
  async getCompanyDetails(companyId) {
    try {
      console.log('🏢 Getting company details for ID:', companyId);
      
      const response = await this.client.get(`/v1/companies/${companyId}`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Get company details failed:', error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Get company employees
   */
  async getCompanyEmployees(companyId, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        filters = {}
      } = options;

      console.log('👥 Getting employees for company ID:', companyId);
      
      const response = await this.client.get(`/v1/companies/${companyId}/employees`, {
        params: {
          limit,
          offset,
          ...filters
        }
      });
      
      return {
        success: true,
        data: response.data,
        employees: response.data.employees || response.data.results || []
      };
    } catch (error) {
      console.error('❌ Get company employees failed:', error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Search for people
   */
  async searchPeople(query, options = {}) {
    try {
      const {
        limit = 10,
        offset = 0,
        filters = {},
        sortBy = 'relevance',
        sortOrder = 'desc'
      } = options;

      const requestBody = {
        query: query,
        limit: limit,
        offset: offset,
        filters: filters,
        sort: {
          field: sortBy,
          order: sortOrder
        }
      };

      console.log('👤 Searching people with query:', query);
      
      const response = await this.client.post('/v1/people/search', requestBody);
      
      return {
        success: true,
        data: response.data,
        total: response.data.total || 0,
        people: response.data.people || response.data.results || []
      };
    } catch (error) {
      console.error('❌ People search failed:', error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Get person details by ID
   */
  async getPersonDetails(personId) {
    try {
      console.log('👤 Getting person details for ID:', personId);
      
      const response = await this.client.get(`/v1/people/${personId}`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Get person details failed:', error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Get company insights and analytics
   */
  async getCompanyInsights(companyId) {
    try {
      console.log('📊 Getting insights for company ID:', companyId);
      
      const response = await this.client.get(`/v1/companies/${companyId}/insights`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('❌ Get company insights failed:', error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Get API usage statistics
   */
  async getUsageStats() {
    try {
      console.log('📈 Getting API usage statistics');
      
      // CoreSignal might not have a usage endpoint, so we'll return a placeholder
      return {
        success: true,
        data: {
          message: 'Usage statistics not available',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('❌ Get usage stats failed:', error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      console.log('🔗 Testing CoreSignal API connection');
      
      // Try a simple search to test the connection
      let response;
      try {
        response = await this.client.post('/api/companies/search', {
          query: 'test',
          limit: 1
        });
      } catch (error) {
        if (error.response?.status === 404) {
          response = await this.client.post('/companies/search', {
            query: 'test',
            limit: 1
          });
        } else {
          throw error;
        }
      }
      
      return {
        success: true,
        data: response.data,
        message: 'CoreSignal API connection successful'
      };
    } catch (error) {
      console.error('❌ CoreSignal API connection test failed:', error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }
}

// Create a singleton instance
const coresignalApi = new CoreSignalAPI();

module.exports = coresignalApi; 