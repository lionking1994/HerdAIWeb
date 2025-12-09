// Search functionality
// This file will contain search utility functions
const { crmDb } = require('../../config/crmDatabase');

// Search Utility Functions
class SearchUtils {
  // Build search query with filters
  static buildSearchQuery(baseQuery, filters = {}, searchTerm = null) {
    let query = baseQuery;
    const params = [];
    let paramIndex = 1;

    // Add search term if provided
    if (searchTerm) {
      query += ` WHERE (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${searchTerm}%`);
      paramIndex++;
    }

    // Add filters
    if (Object.keys(filters).length > 0) {
      const filterConditions = [];
      
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            // Handle array filters (e.g., multiple statuses)
            const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
            filterConditions.push(`${key} IN (${placeholders})`);
            params.push(...value);
          } else if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
            // Handle range filters (e.g., amount between min and max)
            filterConditions.push(`${key} BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
            params.push(value.min, value.max);
            paramIndex += 2;
          } else if (typeof value === 'object' && value.operator) {
            // Handle custom operator filters
            switch (value.operator) {
              case 'like':
                filterConditions.push(`${key} ILIKE $${paramIndex}`);
                params.push(`%${value.value}%`);
                break;
              case 'not_like':
                filterConditions.push(`${key} NOT ILIKE $${paramIndex}`);
                params.push(`%${value.value}%`);
                break;
              case 'in':
                const placeholders = value.value.map(() => `$${paramIndex++}`).join(', ');
                filterConditions.push(`${key} IN (${placeholders})`);
                params.push(...value.value);
                break;
              case 'not_in':
                const notInPlaceholders = value.value.map(() => `$${paramIndex++}`).join(', ');
                filterConditions.push(`${key} NOT IN (${notInPlaceholders})`);
                params.push(...value.value);
                break;
              case 'is_null':
                filterConditions.push(`${key} IS NULL`);
                break;
              case 'is_not_null':
                filterConditions.push(`${key} IS NOT NULL`);
                break;
              default:
                filterConditions.push(`${key} = $${paramIndex}`);
                params.push(value.value);
                paramIndex++;
            }
          } else {
            // Handle simple equality filters
            filterConditions.push(`${key} = $${paramIndex}`);
            params.push(value);
            paramIndex++;
          }
        }
      }

      if (filterConditions.length > 0) {
        const filterClause = filterConditions.join(' AND ');
        if (searchTerm) {
          query += ` AND ${filterClause}`;
        } else {
          query += ` WHERE ${filterClause}`;
        }
      }
    }

    return { query, params };
  }

  // Build sorting clause
  static buildSortClause(sort = {}) {
    if (!sort.field || !sort.direction) {
      return ' ORDER BY created_at DESC';
    }

    const allowedFields = [
      'name', 'created_at', 'updated_at', 'amount', 'close_date', 
      'first_name', 'last_name', 'email', 'phone'
    ];

    const allowedDirections = ['asc', 'desc'];
    
    const field = allowedFields.includes(sort.field) ? sort.field : 'created_at';
    const direction = allowedDirections.includes(sort.direction.toLowerCase()) ? sort.direction.toUpperCase() : 'DESC';

    return ` ORDER BY ${field} ${direction}`;
  }

  // Build pagination clause
  static buildPaginationClause(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    return ` LIMIT ${limit} OFFSET ${offset}`;
  }

  // Perform full-text search
  static async fullTextSearch(tableName, searchTerm, tenantId, options = {}) {
    try {
      const { limit = 20, offset = 0, filters = {} } = options;
      
      let query = `
        SELECT *, 
               ts_rank(to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '')), plainto_tsquery('english', $1)) as rank
        FROM ${tableName}
        WHERE tenant_id = $2
          AND to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', $1)
      `;
      
      const params = [searchTerm, tenantId];
      let paramIndex = 3;

      // Add filters
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '') {
          query += ` AND ${key} = $${paramIndex}`;
          params.push(value);
          paramIndex++;
        }
      }

      // Add sorting and pagination
      query += ` ORDER BY rank DESC, created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await crmDb.query(query, params);
      return result.rows || [];
    } catch (error) {
      console.error('Full-text search error:', error);
      return [];
    }
  }

  // Search in custom fields
  static async searchCustomFields(tableName, searchTerm, tenantId, customFieldNames = []) {
    try {
      if (customFieldNames.length === 0) {
        return [];
      }

      const customFieldConditions = customFieldNames.map((fieldName, index) => {
        return `custom_fields->>'${fieldName}' ILIKE $${index + 3}`;
      }).join(' OR ');

      const query = `
        SELECT * FROM ${tableName}
        WHERE tenant_id = $1
          AND (${customFieldConditions})
        ORDER BY created_at DESC
      `;

      const params = [tenantId, searchTerm, ...customFieldNames.map(() => `%${searchTerm}%`)];
      const result = await crmDb.query(query, params);
      
      return result.rows || [];
    } catch (error) {
      console.error('Custom field search error:', error);
      return [];
    }
  }

  // Generate search suggestions
  static async generateSuggestions(tableName, searchTerm, tenantId, limit = 10) {
    try {
      const query = `
        SELECT DISTINCT name, '${tableName}' as entity_type
        FROM ${tableName}
        WHERE tenant_id = $1
          AND name ILIKE $2
        ORDER BY name
        LIMIT $3
      `;

      const result = await crmDb.query(query, [tenantId, `%${searchTerm}%`, limit]);
      return result.rows || [];
    } catch (error) {
      console.error('Search suggestions error:', error);
      return [];
    }
  }

  // Build advanced search query
  static buildAdvancedSearchQuery(entity, criteria, options = {}) {
    const { filters = {}, sort = {}, limit = 50, offset = 0 } = options;
    
    let baseQuery = `SELECT * FROM ${entity}`;
    let countQuery = `SELECT COUNT(*) as total FROM ${entity}`;
    
    // Build WHERE clause
    const { query: whereClause, params } = this.buildSearchQuery('', filters);
    
    // Add WHERE clause to both queries
    if (whereClause) {
      baseQuery += whereClause;
      countQuery += whereClause;
    }
    
    // Add sorting and pagination to main query
    baseQuery += this.buildSortClause(sort);
    baseQuery += this.buildPaginationClause(offset + 1, limit);
    
    return {
      dataQuery: baseQuery,
      countQuery: countQuery,
      params: params
    };
  }
}

module.exports = SearchUtils;