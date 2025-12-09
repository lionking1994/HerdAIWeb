// Company context management (formerly tenant context)
// This file will contain company context utilities

// Get tenant ID from request (company ID from query params)
const getTenantId = (req) => {
  // Debug: Log what we're receiving
  console.log('🔍 getTenantId called with:');
  console.log('  - req.query:', req.query);
  console.log('  - req.body:', req.body);
  console.log('  - req.query.company:', req.query.company);
  console.log('  - req.body.company:', req.body.company);
  
  // Extract company ID from query parameters
  const companyId = req.query.company || req.body.company;
  
  console.log('  - Extracted companyId:', companyId);
  console.log('  - Type of companyId:', typeof companyId);
  
  if (!companyId) {
    console.log('❌ No company ID found in request');
    throw new Error('Company ID is required. Please provide company parameter or ensure user has company_id.');
  }
  
  const parsedId = parseInt(companyId);
  console.log('  - Parsed company ID:', parsedId);
  
  return parsedId;
};

// Company Context Management Utilities
class CompanyContext {
  // Set company context in database session
  static async setCompanyContext(companyId) {
    try {
      if (!companyId) {
        throw new Error('Company ID is required');
      }

      // For now, just return success since we're not using database context
      return { id: companyId, name: 'Company', domain: '', enabled: true };
    } catch (error) {
      console.error('Error setting company context:', error);
      throw error;
    }
  }

  // Get current company context
  static async getCurrentCompanyContext() {
    try {
      // For now, return null since we're not using database context
      return null;
    } catch (error) {
      console.error('Error getting current company context:', error);
      return null;
    }
  }

  // Clear company context
  static async clearCompanyContext() {
    try {
      // For now, just return success
      return true;
    } catch (error) {
      console.error('Error clearing company context:', error);
      return false;
    }
  }

  // Get company information
  static async getCompanyInfo(companyId) {
    try {
      // For now, return basic info since we're not using database context
      return { id: companyId, name: 'Company', domain: '', enabled: true };
    } catch (error) {
      console.error('Error getting company info:', error);
      return null;
    }
  }

  // Get company settings
  static async getCompanySettings(companyId) {
    try {
      // For now, return empty settings
      return {};
    } catch (error) {
      console.error('Error getting company settings:', error);
      return {};
    }
  }

  // Set company setting
  static async setCompanySetting(companyId, key, value) {
    try {
      // For now, just return success
      return true;
    } catch (error) {
      console.error('Error setting company setting:', error);
      return false;
    }
  }

  // Verify user belongs to company
  static async verifyUserCompanyMembership(userId, companyId) {
    try {
      // For now, just return true since we're not using database context
      return true;
    } catch (error) {
      console.error('Error verifying user company membership:', error);
      return false;
    }
  }

  // Get user's companies
  static async getUserCompanies(userId) {
    try {
      // For now, return empty array since we're not using database context
      return [];
    } catch (error) {
      console.error('Error getting user companies:', error);
      return [];
    }
  }
}

// Legacy class name for backward compatibility
class TenantContext extends CompanyContext {
  static async setTenantContext(tenantId) {
    console.warn('setTenantContext is deprecated. Use setCompanyContext instead.');
    return await this.setCompanyContext(tenantId);
  }

  static async getCurrentTenantContext() {
    console.warn('getCurrentTenantContext is deprecated. Use getCurrentCompanyContext instead.');
    return await this.getCurrentCompanyContext();
  }

  static async clearTenantContext() {
    console.warn('clearTenantContext is deprecated. Use clearCompanyContext instead.');
    return await this.clearCompanyContext();
  }

  static async getTenantInfo(tenantId) {
    console.warn('getTenantInfo is deprecated. Use getCompanyInfo instead.');
    return await this.getCompanyInfo(tenantId);
  }

  static async getTenantSettings(tenantId) {
    console.warn('getTenantSettings is deprecated. Use getCompanySettings instead.');
    return await this.getCompanySettings(tenantId);
  }
}

module.exports = {
  CompanyContext,
  TenantContext, // For backward compatibility
  // Export individual methods for convenience
  setCompanyContext: CompanyContext.setCompanyContext,
  getCurrentCompanyContext: CompanyContext.getCurrentCompanyContext,
  clearCompanyContext: CompanyContext.clearCompanyContext,
  getCompanyInfo: CompanyContext.getCompanyInfo,
  getCompanySettings: CompanyContext.getCompanySettings,
  setCompanySetting: CompanyContext.setCompanySetting,
  verifyUserCompanyMembership: CompanyContext.verifyUserCompanyMembership,
  getUserCompanies: CompanyContext.getUserCompanies,
  // Export getTenantId function
  getTenantId
};