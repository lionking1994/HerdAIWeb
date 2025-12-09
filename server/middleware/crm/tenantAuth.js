// Tenant authentication middleware
// This file will contain tenant authentication logic
const jwt = require('jsonwebtoken');
const { crmDb } = require('../../config/crmDatabase');

// Tenant Authentication Middleware
class TenantAuth {
  // Verify JWT token and extract tenant information
  static async verifyToken(req, res, next) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Access token required'
        });
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if user exists and is active
      const user = await crmDb.getRow(
        'SELECT id, email, is_active, tenant_id FROM users WHERE id = $1',
        [decoded.id]
      );

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!user.is_active) {
        return res.status(401).json({
          success: false,
          message: 'User account is inactive'
        });
      }

      // Add user info to request
      req.user = {
        id: user.id,
        email: user.email,
        tenant_id: user.tenant_id,
        role: decoded.role || 'user'
      };

      next();
    } catch (error) {
      console.error('Token verification error:', error);
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Authentication error'
      });
    }
  }

  // Verify tenant membership
  static async verifyTenantMembership(req, res, next) {
    try {
      const userId = req.user?.id;
      const tenantId = req.headers['x-tenant-id'] || req.user?.tenant_id;
      
      if (!userId || !tenantId) {
        return res.status(400).json({
          success: false,
          message: 'User ID and tenant ID are required'
        });
      }

      // Check if user is member of the tenant
      const membership = await crmDb.getRow(
        'SELECT user_id, tenant_id, role, is_active FROM tenant_users WHERE user_id = $1 AND tenant_id = $2',
        [userId, tenantId]
      );

      if (!membership) {
        return res.status(403).json({
          success: false,
          message: 'User is not a member of this tenant'
        });
      }

      if (!membership.is_active) {
        return res.status(403).json({
          success: false,
          message: 'User membership is inactive'
        });
      }

      // Add tenant membership info to request
      req.tenantMembership = {
        role: membership.role,
        isActive: membership.is_active
      };

      next();
    } catch (error) {
      console.error('Tenant membership verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Error verifying tenant membership'
      });
    }
  }

  // Check user permissions for specific actions
  static checkPermission(requiredPermission) {
    return async (req, res, next) => {
      try {
        const userRole = req.user?.role;
        const tenantRole = req.tenantMembership?.role;
        
        if (!userRole || !tenantRole) {
          return res.status(403).json({
            success: false,
            message: 'Role information required'
          });
        }

        // Define permission hierarchy
        const permissions = {
          'admin': ['read', 'write', 'delete', 'manage_users', 'manage_settings'],
          'manager': ['read', 'write', 'delete'],
          'user': ['read', 'write'],
          'viewer': ['read']
        };

        const userPermissions = permissions[userRole] || [];
        const tenantPermissions = permissions[tenantRole] || [];
        
        // User gets the most restrictive permissions
        const effectivePermissions = userPermissions.filter(perm => 
          tenantPermissions.includes(perm)
        );

        if (!effectivePermissions.includes(requiredPermission)) {
          return res.status(403).json({
            success: false,
            message: `Insufficient permissions. Required: ${requiredPermission}`
          });
        }

        next();
      } catch (error) {
        console.error('Permission check error:', error);
        res.status(500).json({
          success: false,
          message: 'Error checking permissions'
        });
      }
    };
  }

  // Verify API key for service-to-service communication
  static async verifyAPIKey(req, res, next) {
    try {
      const apiKey = req.headers['x-api-key'];
      
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          message: 'API key required'
        });
      }

      // Verify API key
      const keyInfo = await crmDb.getRow(
        'SELECT tenant_id, permissions, is_active FROM api_keys WHERE key_hash = $1',
        [apiKey] // In production, hash the API key before comparison
      );

      if (!keyInfo) {
        return res.status(401).json({
          success: false,
          message: 'Invalid API key'
        });
      }

      if (!keyInfo.is_active) {
        return res.status(401).json({
          success: false,
          message: 'API key is inactive'
        });
      }

      // Add API key info to request
      req.apiKey = {
        tenantId: keyInfo.tenant_id,
        permissions: keyInfo.permissions
      };

      next();
    } catch (error) {
      console.error('API key verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Error verifying API key'
      });
    }
  }
}

// Middleware functions
const verifyToken = TenantAuth.verifyToken;
const verifyTenantMembership = TenantAuth.verifyTenantMembership.bind(TenantAuth);
const checkPermission = TenantAuth.checkPermission;
const verifyAPIKey = TenantAuth.verifyAPIKey.bind(TenantAuth);

module.exports = {
  verifyToken,
  verifyTenantMembership,
  checkPermission,
  verifyAPIKey,
  TenantAuth
};