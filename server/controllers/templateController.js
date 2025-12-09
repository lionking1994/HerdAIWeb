const Template = require("../models/Template");

exports.getAllTemplates = async (req, res) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "Company ID is required"
      });
    }

    const templates = await Template.getAll(companyId);

    return res.status(200).json({
      success: true,
      templates
    });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch templates"
    });
  }
};

exports.getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await Template.getById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: "Template not found"
      });
    }

    return res.status(200).json({
      success: true,
      template
    });
  } catch (error) {
    console.error("Error fetching template:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch template"
    });
  }
};

exports.createTemplate = async (req, res) => {
  try {
    const { name, description, prompt, company_id, category, platform  } = req.body;

    // Validate required fields
    if (!name || !company_id) {
      return res.status(400).json({
        success: false,
        error: "Name and company_id are required fields"
      });
    }

    const defaultPrompt = `Create a JSON representation of this meeting transcript including:

1. **Meeting Summary**:
   - Title
   - Description
   - Date & Time

2. **Entities and Relationships**:
   - Companies (label: blue): name, website (if available), and any relevant notes
   - People (label: purple): name, email, phone (if mentioned)
   - Opportunities (label: green): description, status, value (if mentioned)

3. **Graph Structure**:
   - Central node: the **main theme** of the meeting (label: orange)
   - Connect related entities with labeled relationships (e.g. "works at", "discussed", "potential client", etc.)
   - Use the **thickest relationship line** for the strongest/primary topic (e.g. opportunities or decisions)

Output should be structured in a JSON format suitable for a knowledge graph visualization engine.

Only include what is mentioned or implied in the transcript.`;

    const formattedCategory = category
      ? category
        .split(',')
        .map(c => c.trim())
        .join(',') // Ensure consistent formatting
      : "";

    const template = await Template.create({
      name,
      description: description || "",
      prompt: prompt || defaultPrompt,
      company_id,
      category: formattedCategory,
      platform: platform || "Sonar" 
    });

    return res.status(201).json({
      success: true,
      template
    });
  } catch (error) {
    console.error("Error creating template:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create template"
    });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, prompt, category, platform } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        error: "Name is a required fields"
      });
    }


    // Check if template exists
    const existingTemplate = await Template.getById(id);
    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        error: "Template not found"
      });
    }

    const defaultPrompt = `Create a JSON representation of this meeting transcript including:

1. **Meeting Summary**:
   - Title
   - Description
   - Date & Time

2. **Entities and Relationships**:
   - Companies (label: blue): name, website (if available), and any relevant notes
   - People (label: purple): name, email, phone (if mentioned)
   - Opportunities (label: green): description, status, value (if mentioned)

3. **Graph Structure**:
   - Central node: the **main theme** of the meeting (label: orange)
   - Connect related entities with labeled relationships (e.g. "works at", "discussed", "potential client", etc.)
   - Use the **thickest relationship line** for the strongest/primary topic (e.g. opportunities or decisions)

Output should be structured in a JSON format suitable for a knowledge graph visualization engine.

Only include what is mentioned or implied in the transcript.`;


    const formattedCategory = category
      ? category
        .split(',')
        .map(c => c.trim())
        .join(',') // Ensure consistent formatting
      : "";
    const updatedTemplate = await Template.update(id, {
      name,
      description: description || "",
      prompt: prompt || defaultPrompt,
      category: formattedCategory,
      platform: platform || "Sonar" 
    });

    return res.status(200).json({
      success: true,
      template: updatedTemplate
    });
  } catch (error) {
    console.error("Error updating template:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update template"
    });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if template exists
    const existingTemplate = await Template.getById(id);
    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        error: "Template not found"
      });
    }

    await Template.delete(id);

    return res.status(200).json({
      success: true,
      message: "Template deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting template:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to delete template"
    });
  }
};

module.exports = {
  getAllTemplates: exports.getAllTemplates,
  getTemplateById: exports.getTemplateById,
  createTemplate: exports.createTemplate,
  updateTemplate: exports.updateTemplate,
  deleteTemplate: exports.deleteTemplate
};

