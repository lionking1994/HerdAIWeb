const pool = require("../config/database");
const Prompt = require("../models/Prompt");

/**
 * Get prompt configuration for a specific category and company
 * @param {string} category - The prompt category (e.g., 'task', 'executive_summary')
 * @param {number} companyId - The company ID to check for templates
 * @returns {Object} Prompt configuration object
 */
async function getPromptForCategory(category, companyId) {
  try {
    // First, try to get company-specific template for this category
    const templateQuery = `
      SELECT 
        t.id,
        t.name,
        t.description,
        t.prompt,
        t.category,
        t.maxtokens,
        mo.model,
        mo.id as modelid,
        ap.api_key,
        ap.provider
      FROM templates t
      INNER JOIN api_config_models mo ON mo."id" = t.platform 
      INNER JOIN api_configurations ap ON ap."id" = mo.config_id
      WHERE t.company_id = $1 
        AND t.category = $2
        AND t.platform IS NOT NULL
      ORDER BY t.created_at DESC
      LIMIT 1
    `;
    
    const templateResult = await pool.query(templateQuery, [companyId, category]);
    console.log("companyId, category", templateResult.rows.length);
    
    if (templateResult.rows.length > 0) {
      // Company has a specific template for this category
      const template = templateResult.rows[0];
      
      // Get the default model configuration for this category from platform prompts
      const platformPrompt = await Prompt.get(category);
      
      return {
        promptContent: template.prompt,
        model: template.model,
        modelId: template.modelid,
        maxtokens: template.maxtokens,
        apiKey: template.api_key,
        provider: platformPrompt.provider,
        source: 'company_template',
        templateId: template.id,
        templateName: template.name
      };
    }
    
    // No company template found, fall back to platform default
    const platformPrompt = await Prompt.get(category);
    
    return {
      promptContent: platformPrompt.promptContent,
      model: platformPrompt.model,
      modelId: platformPrompt.modelId,
      maxtokens: platformPrompt.maxtokens,
      apiKey: platformPrompt.apiKey,
      provider: platformPrompt0.provider,
      source: 'platform_default'
    };
    
  } catch (error) {
    console.error('Error getting prompt for category:', error);
    
    // Fallback to platform default if there's any error
    try {
      const platformPrompt = await Prompt.get(category);
      return {
        promptContent: platformPrompt.promptContent,
        model: platformPrompt.model,
        modelId: platformPrompt.modelId,
        maxtokens: platformPrompt.maxtokens,
        apiKey: platformPrompt.apiKey,
        provider: platformPrompt.provider,
        source: 'platform_default_fallback'
      };
    } catch (fallbackError) {
      console.error('Error getting platform default prompt:', fallbackError);
      throw new Error(`Failed to get prompt for category: ${category}`);
    }
  }
}

/**
 * Get all available prompt categories for a company
 * @param {number} companyId - The company ID
 * @returns {Object} Object with available categories and their sources
 */
async function getAvailablePromptCategories(companyId) {
  try {
    const templateQuery = `
      SELECT 
        category,
        COUNT(*) as template_count,
        MAX(created_at) as latest_created
      FROM templates
      WHERE company_id = $1 
        AND platform IS NULL
      GROUP BY category
    `;
    
    const templateResult = await pool.query(templateQuery, [companyId]);
    
    const categories = {};
    
    // Add company-specific categories
    templateResult.rows.forEach(row => {
      categories[row.category] = {
        source: 'company_template',
        templateCount: parseInt(row.template_count),
        latestCreated: row.latest_created
      };
    });
    
    // Add platform default categories (these are always available)
    const platformCategories = ['task', 'executive_summary', 'open_task_summary'];
    platformCategories.forEach(category => {
      if (!categories[category]) {
        categories[category] = {
          source: 'platform_default',
          templateCount: 0
        };
      }
    });
    
    return categories;
    
  } catch (error) {
    console.error('Error getting available prompt categories:', error);
    throw error;
  }
}

/**
 * Get prompt statistics for a company
 * @param {number} companyId - The company ID
 * @returns {Object} Statistics about prompt usage
 */
async function getPromptStatistics(companyId) {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_templates,
        COUNT(DISTINCT category) as unique_categories,
        COUNT(CASE WHEN platform IS NOT NULL THEN 1 END) as platform_templates,
        COUNT(CASE WHEN platform IS NULL THEN 1 END) as company_templates
      FROM templates
      WHERE company_id = $1
    `;
    
    const statsResult = await pool.query(statsQuery, [companyId]);
    
    return {
      totalTemplates: parseInt(statsResult.rows[0].total_templates),
      uniqueCategories: parseInt(statsResult.rows[0].unique_categories),
      platformTemplates: parseInt(statsResult.rows[0].platform_templates),
      companyTemplates: parseInt(statsResult.rows[0].company_templates)
    };
    
  } catch (error) {
    console.error('Error getting prompt statistics:', error);
    throw error;
  }
}

module.exports = {
  getPromptForCategory,
  getAvailablePromptCategories,
  getPromptStatistics
};

