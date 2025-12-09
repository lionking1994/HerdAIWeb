const axios = require('axios');

// AI Node Generator Utility
class AINodeGenerator {
  constructor(config = {}) {
    this.config = {
      apiKey: process.env.OPENAI_API_KEY || process.env.AI_API_KEY,
      endpoint: process.env.AI_ENDPOINT || 'https://api.openai.com/v1/chat/completions',
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      maxTokens: 2000,
      temperature: 0.3,
      ...config
    };
  }

  // Generate node JSON from input data
  async generateNodeJson(inputData) {
    try {
      const prompt = this.buildPrompt(inputData);
      const aiResponse = await this.callAIService(prompt);
      return this.parseAIResponse(aiResponse);
    } catch (error) {
      console.error('AI Node Generation Error:', error);
      throw error;
    }
  }

  // Build the prompt for AI
  buildPrompt(inputData) {
    return `
You are an expert data analyst. When given input data, classify the entities and create meaningful connections between them.

Input Data:
${JSON.stringify(inputData, null, 2)}

Task: Analyze this data and create a JSON structure with nodes and edges that represent the relationships between entities.

Requirements:
1. Create nodes for all important entities found in the data
2. Each node must have: id, type, name, and relevant properties
3. Node types should be meaningful (e.g., Company, Person, Technology, Location, Product, Service, etc.)
4. Create edges that connect related nodes with descriptive relationship labels
5. Ensure logical connections between related entities
6. Include all important data points as node properties

Example output format:
{
  "nodes": [
    {
      "id": "company_1",
      "type": "Company",
      "name": "Company Name",
      "industry": "Technology",
      "location": "San Francisco",
      "size": "Large"
    },
    {
      "id": "person_1", 
      "type": "Person",
      "name": "John Doe",
      "position": "CEO",
      "company": "Company Name"
    }
  ],
  "edges": [
    {
      "from": "company_1",
      "to": "person_1", 
      "relationship": "employs"
    }
  ]
}

Return only valid JSON without any markdown formatting, explanations, or additional text.
`;
  }

  // Call the AI service
  async callAIService(prompt) {
    try {
      const requestBody = {
        model: this.config.model,
        messages: [
          {
            role: "system",
            content: "You are a data analysis expert. Always respond with valid JSON only."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature
      };

      const response = await axios.post(this.config.endpoint, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (response.status !== 200) {
        throw new Error(`AI service error: ${response.status}`);
      }

      return response.data.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('AI Service Call Error:', error);
      throw new Error(`Failed to call AI service: ${error.message}`);
    }
  }

  // Parse AI response to extract JSON
  parseAIResponse(aiResponse) {
    try {
      let jsonString = aiResponse.trim();
      
      // Try to extract JSON from markdown code blocks
      const jsonMatch = jsonString.match(/```json\n([\s\S]*?)\n```/) || 
                       jsonString.match(/```\n([\s\S]*?)\n```/) ||
                       jsonString.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        jsonString = jsonMatch[1] || jsonMatch[0];
      }

      const nodeJson = JSON.parse(jsonString);
      
      // Validate structure
      this.validateNodeJson(nodeJson);
      
      return nodeJson;
    } catch (error) {
      console.error('AI Response Parsing Error:', error);
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }

  // Validate the generated node JSON
  validateNodeJson(nodeJson) {
    if (!nodeJson || typeof nodeJson !== 'object') {
      throw new Error('Invalid node JSON structure');
    }

    if (!nodeJson.nodes || !Array.isArray(nodeJson.nodes)) {
      throw new Error('Missing or invalid nodes array');
    }

    if (!nodeJson.edges || !Array.isArray(nodeJson.edges)) {
      nodeJson.edges = []; // Default to empty edges
    }

    // Validate each node
    nodeJson.nodes.forEach((node, index) => {
      if (!node.id || !node.type || !node.name) {
        throw new Error(`Node at index ${index} missing required fields (id, type, name)`);
      }
    });

    // Validate each edge
    nodeJson.edges.forEach((edge, index) => {
      if (!edge.from || !edge.to) {
        throw new Error(`Edge at index ${index} missing required fields (from, to)`);
      }
    });
  }

  // Generate nodes for specific data types
  async generateCompanyAnalysisNodes(companyData) {
    const enhancedData = {
      company: companyData,
      analysis: {
        type: 'company_analysis',
        data: companyData
      }
    };
    
    return this.generateNodeJson(enhancedData);
  }

  // Generate nodes for workflow data
  async generateWorkflowNodes(workflowData) {
    const enhancedData = {
      workflow: workflowData,
      analysis: {
        type: 'workflow_analysis',
        data: workflowData
      }
    };
    
    return this.generateNodeJson(enhancedData);
  }
}

// Export singleton instance
const aiNodeGenerator = new AINodeGenerator();

module.exports = {
  AINodeGenerator,
  aiNodeGenerator
}; 