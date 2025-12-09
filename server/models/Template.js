const pool = require("../config/database");

class Template {
  static async getAll(companyId) {
    const query = `
      SELECT * FROM templates 
      WHERE company_id = $1
      ORDER BY name ASC
    `;
    const result = await pool.query(query, [companyId]);
    return result.rows;
  }

  static async getById(id) {
    const query = `
      SELECT * FROM templates 
      WHERE id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async create(template) {
    const { name, description, prompt, company_id, category, platform } = template;
    const query = `
      INSERT INTO templates (name, description, prompt, company_id, category, platform)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await pool.query(query, [name, description, prompt, company_id, category, platform]);
    return result.rows[0];
  }

  static async update(id, template) {
    const { name, description, prompt, category,platform } = template;
    const query = `
      UPDATE templates
      SET name = $1, description = $2, prompt = $3, category = $4, platform = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;
    const result = await pool.query(query, [name, description, prompt, category, platform, id]);
    return result.rows[0];
  }

  static async delete(id) {
    const query = `
      DELETE FROM templates
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = Template;

