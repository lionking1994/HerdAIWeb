// Tenant model
// This file will contain the Tenant schema and methods
const db = require('../../config/crmDatabase');
const { v4: uuidv4 } = require('uuid');

class Tenant {
  static async create(tenantData) {
    const { name, subdomain } = tenantData;
    const id = uuidv4();
    
    const query = `
      INSERT INTO tenants (id, name, subdomain)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const result = await db.getRow(query, [id, name, subdomain]);
    return result;
  }

  static async findById(id) {
    const query = 'SELECT * FROM tenants WHERE id = $1';
    return await db.getRow(query, [id]);
  }

  static async findBySubdomain(subdomain) {
    const query = 'SELECT * FROM tenants WHERE subdomain = $1';
    return await db.getRow(query, [subdomain]);
  }

  static async update(id, updateData) {
    const { name, subdomain, is_active } = updateData;
    
    const query = `
      UPDATE tenants 
      SET name = COALESCE($2, name), 
          subdomain = COALESCE($3, subdomain), 
          is_active = COALESCE($4, is_active),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    return await db.getRow(query, [id, name, subdomain, is_active]);
  }

  static async delete(id) {
    const query = 'DELETE FROM tenants WHERE id = $1 RETURNING *';
    return await db.getRow(query, [id]);
  }

  static async list() {
    const query = 'SELECT * FROM tenants ORDER BY created_at DESC';
    return await db.getRows(query);
  }
}

module.exports = Tenant;