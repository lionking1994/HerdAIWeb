// Row Level Security middleware
// This file will contain RLS implementation
const { crmDb } = require('../../config/crmDatabase');
const { getCompanyId } = require('../../utils/crm');

// Row Level Security (RLS) Middleware
class RLSMiddleware {
  // Set company context for database operations
  static async setCompanyContext(req, res, next) {
    try {
      // Get company ID from request
      const companyId = getCompanyId(req);
      
      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID is required for RLS'
        });
      }

      // Verify company exists and is active
      const company = await crmDb.getRow(
        'SELECT id, name, enabled FROM company WHERE id = $1',
        [companyId]
      );

      if (!company) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      if (!company.enabled) {
        return res.status(403).json({
          success: false,
          message: 'Company is inactive'
        });
      }

      // Set company context in database session
      await crmDb.query('SELECT set_company_context($1)', [companyId]);

      // Add company info to request
      req.company = {
        id: company.id,
        name: company.name
      };

      next();
    } catch (error) {
      console.error('RLS Middleware Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error setting RLS context'
      });
    }
  }

  // Verify company ownership of resource
  static async verifyCompanyOwnership(tableName, resourceId, companyId) {
    try {
      const query = `
        SELECT company_id 
        FROM ${tableName} 
        WHERE id = $1
      `;
      
      const result = await crmDb.getRow(query, [resourceId]);
      return result?.company_id === companyId;
    } catch (error) {
      console.error('Company ownership verification error:', error);
      return false;
    }
  }

  // Check if user has access to resource
  static async checkResourceAccess(req, res, next) {
    try {
      const { tableName, resourceId } = req.params;
      const companyId = req.company?.id || getCompanyId(req);
      
      if (!companyId || !tableName || !resourceId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameters for access check'
        });
      }

      // Verify resource belongs to company
      const hasAccess = await this.verifyCompanyOwnership(tableName, resourceId, companyId);
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Resource does not belong to your company'
        });
      }

      next();
    } catch (error) {
      console.error('Resource access check error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking resource access'
      });
    }
  }

  // Legacy function for backward compatibility
  static async setTenantContext(req, res, next) {
    console.warn('setTenantContext is deprecated. Use setCompanyContext instead.');
    return await this.setCompanyContext(req, res, next);
  }

  // Legacy function for backward compatibility
  static async verifyTenantOwnership(tableName, resourceId) {
    console.warn('verifyTenantOwnership is deprecated. Use verifyCompanyOwnership instead.');
    const companyId = getCompanyId({ query: { company: req.query.company }, user: req.user });
    return await this.verifyCompanyOwnership(tableName, resourceId, companyId);
  }

  // Enforce RLS policies for specific tables
  static enforceRLSPolicy(tableName) {
    return async (req, res, next) => {
      try {
        const companyId = req.company?.id;
        
        if (!companyId) {
          return res.status(400).json({
            success: false,
            message: 'Company context required'
          });
        }

        // Set table-specific RLS context
        await crmDb.query('SELECT set_config($1, $2, false)', [
          `app.current_table_${tableName}`,
          tableName
        ]);

        next();
      } catch (error) {
        console.error('RLS Policy enforcement error:', error);
        res.status(500).json({
          success: false,
          message: 'Error enforcing RLS policy'
        });
      }
    };
  }

  // Clean up RLS context
  static async cleanupRLSContext(req, res, next) {
    try {
      // Clear company context
      await crmDb.query('SELECT set_config($1, NULL, false)', ['app.current_company_id']);
      
      // Clear table context
      await crmDb.query('SELECT set_config($1, NULL, false)', ['app.current_table']);
      
      next();
    } catch (error) {
      console.error('RLS cleanup error:', error);
      next(); // Continue even if cleanup fails
    }
  }
}

// Middleware functions
const setTenantContext = RLSMiddleware.setTenantContext;
const checkResourceAccess = RLSMiddleware.checkResourceAccess.bind(RLSMiddleware);
const enforceRLSPolicy = RLSMiddleware.enforceRLSPolicy;
const cleanupRLSContext = RLSMiddleware.cleanupRLSContext;

module.exports = RLSMiddleware;