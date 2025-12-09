const pool = require("../config/database");

class Company {
  static async findByEmail(email) {
    const domain = email.split('@')[1];
    const query = 'SELECT * FROM company WHERE domain = $1';
    const { rows } = await pool.query(query, [domain]);
    return rows[0];
  }
}

module.exports = Company;