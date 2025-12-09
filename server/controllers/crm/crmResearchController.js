const pool = require("../../config/database");
const axios = require("axios");
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const { processAI, test_prompt } = require("../../utils/llmservice");
/**
 * CRM Research Controller with Real ResearchBy.ai Integration
 * Complete file management and storage system with document parsing
 */

// Validate required environment variables
if (!process.env.RESEARCH_BY_AI_API_URL || !process.env.RESEARCH_BY_AI_API_KEY) {
  console.error('❌ CRITICAL: ResearchBy.ai API credentials not configured!');
  console.error('❌ Please set RESEARCH_BY_AI_API_URL and RESEARCH_BY_AI_API_KEY in .env file');
  console.error('❌ CRM Research functionality will not work without these credentials');
}

// ResearchBy.ai API configuration
const RESEARCH_BY_AI_CONFIG = {
  baseURL: process.env.RESEARCH_BY_AI_API_URL,
  apiKey: process.env.RESEARCH_BY_AI_API_KEY,
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.RESEARCH_BY_AI_API_KEY,
  }
};

// File storage configuration
const FILE_STORAGE_CONFIG = {
  basePath: 'public/files/crm-research',
  companyPath: 'company',
  contactPath: 'contact',
  opportunityPath: 'opportunity',
  fileExtension: '.docx'
};

/**
 * Helper function to detect if a contact ID is a UUID
 */
const isUuid = (id) => {
  if (!id) return false;
  return /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(String(id));
};

/**
 * Helper function to detect if a contact ID is numeric (integer)
 */
const isNumericContactId = (id) => {
  if (!id) return false;
  return /^\d+$/.test(String(id));
};

/**
 * Parse .docx file content and extract structured data
 * This is a simplified parser - you can enhance it with more sophisticated parsing
 */
const parseDocxContent = async (filePath, researchType) => {
  try {

    const fileStats = fs.statSync(filePath);
    if (fileStats.size === 0) {
      throw new Error('Document file is empty');
    }

    // Parse .docx file using mammoth
    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value;


    // Parse the extracted text to find relevant information
    let parsedData = {};

    if (researchType === 'company') {
      parsedData = {
        overview: {
          industry: extractFromText(text, 'industry', ''),
          founded: extractFromText(text, 'founded', ''),
          employees: extractFromText(text, 'employees', ''),
          headquarters: extractFromText(text, 'headquarters', ''),
          description: extractDescription(text, 'company')
        },
        financials: {
          revenue: extractFromText(text, 'revenue', ''),
          funding: extractFromText(text, 'funding', ''),
          growth: extractFromText(text, 'growth', ''),
          market_cap: extractFromText(text, 'market cap', '')
        },
        market: {
          size: extractFromText(text, 'market size', ''),
          trends: extractListFromText(text, 'trends', []),
          competitors: extractListFromText(text, 'competitors', []),
          market_position: extractFromText(text, 'market position', '')
        },
        strategic_focus: extractListFromText(text, 'strategic focus', [])
      };
    } else if (researchType === 'contact') {
      parsedData = {
        background: {
          title: extractFromText(text, 'title', ''),
          experience: extractFromText(text, 'experience', ''),
          education: extractFromText(text, 'education', ''),
          skills: extractListFromText(text, 'skills', []),
          linkedin: {
            connections: extractFromText(text, 'connections', ''),
            endorsements: extractFromText(text, 'endorsements', ''),
            recommendations: extractFromText(text, 'recommendations', '')
          }
        },
        insights: extractListFromText(text, 'insights', []),
        communication_preferences: extractListFromText(text, 'communication preferences', []),
        key_expertise: extractListFromText(text, 'key expertise', []),
        recent_activities: extractListFromText(text, 'recent activities', [])
      };
    } else if (researchType === 'opportunity') {
      parsedData = {
        deal_stage: extractFromText(text, 'deal stage', 'Unknown'),
        deal_size: extractFromText(text, 'deal size', 'Unknown'),
        probability: extractFromText(text, 'probability', 'Unknown'),
        timeline: extractFromText(text, 'timeline', 'Unknown'),
        next_steps: extractListFromText(text, 'immediate actions', []),
        strategic_actions: extractListFromText(text, 'strategic actions', []),
        success_factors: extractListFromText(text, 'critical factors', []),
        risk_factors: extractListFromText(text, 'risk factors', []),
        competitive_position: extractFromText(text, 'competitive position', 'Unknown'),
        differentiation: extractFromText(text, 'differentiation', 'Unknown'),
        market_fit: extractFromText(text, 'market fit', 'Unknown'),
        insights: extractListFromText(text, 'insights', [])
      };
    }

    return parsedData;

  } catch (error) {
    console.error(`❌ Error parsing ${researchType} document:`, error.message);
    return {};
  }
};

/**
 * Helper function to extract specific information from text
 */
const extractFromText = (text, keyword, defaultValue) => {
  try {
    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();

    // Enhanced patterns for better extraction
    const patterns = [
      // Pattern: "Industry: Technology" or "Industry - Technology"
      new RegExp(`${lowerKeyword}\\s*[:\\-]\\s*([^\\n\\r]{1,100})`, 'i'),
      // Pattern: "Industry = Technology"
      new RegExp(`${lowerKeyword}\\s*=\\s*([^\\n\\r]{1,100})`, 'i'),
      // Pattern: "Industry Technology" (space separated)
      new RegExp(`${lowerKeyword}\\s+([^\\n\\r]{1,100})`, 'i'),
      // Pattern: Bullet points "- Industry: Technology"
      new RegExp(`[-•]\\s*${lowerKeyword}\\s*[:\\-]\\s*([^\\n\\r]{1,100})`, 'i'),
      // Pattern: Numbered lists "1. Industry: Technology"
      new RegExp(`\\d+\\.\\s*${lowerKeyword}\\s*[:\\-]\\s*([^\\n\\r]{1,100})`, 'i')
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const extracted = match[1].trim();
        // Enhanced validation - filter out noise and irrelevant content
        if (extracted &&
          extracted.length > 0 &&
          extracted.length < 200 &&
          !extracted.includes('Extracted from research document') &&
          !extracted.includes('average growth rates') &&
          !extracted.includes('could accurately recall') &&
          !extracted.includes('Analysis Frameworks') &&
          !extracted.includes('Location Impact') &&
          !extracted.includes('Stream Identification') &&
          !extracted.includes('History Analysis') &&
          !extracted.includes('Metrics Evaluation') &&
          !extracted.includes('in Business Research') &&
          !extracted.includes('6.2 Benchmarking Methodologies') &&
          !extracted.includes('Assessment') &&
          !extracted.includes('of the publication is not provided') &&
          !extracted.includes('Educational Background') &&
          !extracted.includes('to the 56 Group when available') &&
          !extracted.includes('7.1 Communication Strategies')) {
          return extracted;
        }
      }
    }

    return defaultValue;
  } catch (error) {
    return defaultValue;
  }
};

/**
 * Helper function to extract lists from text
 */
const extractListFromText = (text, keyword, defaultValue) => {
  try {
    const extracted = extractFromText(text, keyword, '');
    if (extracted && extracted !== defaultValue) {
      // Try to parse as a list
      const items = extracted.split(/[,;•]/).map(item => item.trim()).filter(item => item.length > 0);
      if (items.length > 0) {
        return items;
      }
    }
    return defaultValue;
  } catch (error) {
    return defaultValue;
  }
};

/**
 * Helper function to extract description
 */
const extractDescription = (text, type) => {
  try {
    // Look for description patterns
    const patterns = [
      /description\s*[:\\-]\s*([^\\n\\r]+)/i,
      /overview\s*[:\\-]\s*([^\\n\\r]+)/i,
      /about\s*[:\\-]\s*([^\\n\\r]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const extracted = match[1].trim();
        if (extracted && extracted.length > 10) {
          return extracted;
        }
      }
    }

    return '';
  } catch (error) {
    return '';
  }
};

/**
 * Fetch additional contact data from users and related_tasks tables
 */
const fetchContactAdditionalData = async (contactId, tenantId) => {
  try {

    // Determine if contactId is a UUID or integer
    const isUuidId = isUuid(contactId);
    const isNumericId = isNumericContactId(contactId);

    let userData = {};
    let recentTasks = [];
    let relatedTasks = [];

    if (isUuidId) {
      // For UUID contacts, skip user table lookup since they exist in contacts table only
      userData = {};
      recentTasks = [];
      relatedTasks = [];

    } else if (isNumericId) {
      // Fetch user profile data for integer
      userData = await pool.query(
        `SELECT 
        name, email, phone, location, bio, role, company_role, 
        skills, education, certifications, projects, publications, 
        linkedin_url, linkedin_last_updated, time_zone, avatar
       FROM users 
       WHERE id = $1 AND tenant_id = $2`,
        [contactId, tenantId]
      );
      userData = userData.rows[0] || {};

      // Fetch recent tasks for integer
      recentTasks = await pool.query(
        `SELECT 
        title, description, status, priority, category, 
        created_at, updated_at, completed_at, average_time,
        ai_recommendation, alignment_score
       FROM tasks 
       WHERE assigned_id = $1 AND isdeleted = false 
       ORDER BY created_at DESC 
       LIMIT 10`,
        [contactId]
      );
      recentTasks = recentTasks.rows || [];

      // Fetch related tasks (if there's a separate related_tasks table)
      try {
        const relatedTasksResult = await pool.query(
          `SELECT 
          task_title, task_description, task_status, task_category,
          assigned_date, completed_date, priority_level
         FROM related_tasks 
         WHERE contact_id = $1 AND tenant_id = $2
         ORDER BY assigned_date DESC 
         LIMIT 10`,
          [contactId, tenantId]
        );
        relatedTasks = relatedTasksResult.rows;
      } catch (error) {
        console.log(`ℹ️ No related_tasks table found, using tasks table only`);
      }

    } else {
      console.log(`ℹ️ Contact ID ${contactId} is not a valid UUID or integer. Skipping user and task data.`);
    }

    return {
      userProfile: userData,
      recentTasks: recentTasks,
      relatedTasks: relatedTasks
    };

  } catch (error) {
    console.error(`❌ Error fetching additional contact data:`, error);
    return {
      userProfile: {},
      recentTasks: [],
      relatedTasks: []
    };
  }
};

/**
 * Generate comprehensive AI-enhanced insights and next steps based on all available data
 * This function considers opportunity fields, company research, and contact research
 */
const generateEnhancedInsights = (companyData, contactData, opportunityData, opportunityFields = {}) => {
  try {

    const insights = [];
    const nextSteps = [];
    const strategicActions = [];
    const immediateActions = [];

    // ===== COMPANY INSIGHTS =====
    if (companyData.overview?.industry) {
      insights.push(`🏢 Industry: ${companyData.overview.industry} sector`);
    }
    if (companyData.financials?.revenue) {
      insights.push(`💰 Revenue: ${companyData.financials.revenue}`);
    }
    if (companyData.market?.size) {
      insights.push(`📊 Market Size: ${companyData.market.size}`);
    }
    if (companyData.overview?.employees) {
      insights.push(`👥 Company Size: ${companyData.overview.employees} employees`);
    }
    if (companyData.market?.competitors && companyData.market.competitors.length > 0) {
      insights.push(`🏆 Key Competitors: ${companyData.market.competitors.slice(0, 3).join(', ')}`);
    }

    // ===== CONTACT INSIGHTS =====
    if (contactData.background?.title) {
      insights.push(`👤 Decision Maker: ${contactData.background.title}`);
    }
    if (contactData.background?.experience) {
      insights.push(`🎯 Experience: ${contactData.background.experience}`);
    }
    if (contactData.enhanced_expertise?.skills && contactData.enhanced_expertise.skills.length > 0) {
      insights.push(`🔧 Key Skills: ${contactData.enhanced_expertise.skills.slice(0, 3).join(', ')}`);
    }
    if (contactData.enhanced_expertise?.certifications && contactData.enhanced_expertise.certifications.length > 0) {
      insights.push(`🏅 Certifications: ${contactData.enhanced_expertise.certifications.slice(0, 2).join(', ')}`);
    }

    // ===== OPPORTUNITY INSIGHTS =====
    if (opportunityFields.amount) {
      insights.push(`💵 Deal Value: $${parseFloat(opportunityFields.amount).toLocaleString()}`);
    }
    if (opportunityFields.stage) {
      insights.push(`📈 Current Stage: ${opportunityFields.stage}`);
    }
    if (opportunityFields.probability) {
      insights.push(`🎯 Win Probability: ${opportunityFields.probability}%`);
    }
    if (opportunityFields.lead_source) {
      insights.push(`🔍 Lead Source: ${opportunityFields.lead_source}`);
    }

    // ===== DYNAMIC NEXT STEPS BASED ON OPPORTUNITY DESCRIPTION =====
    const description = opportunityFields.description || '';
    const lowerDescription = description.toLowerCase();

    // AI/Technology related opportunities
    if (lowerDescription.includes('ai') || lowerDescription.includes('artificial intelligence') ||
      lowerDescription.includes('machine learning') || lowerDescription.includes('automation')) {
      immediateActions.push('🤖 Prepare AI capabilities demonstration and ROI analysis');
      strategicActions.push('📊 Develop AI implementation roadmap and timeline');
      strategicActions.push('🔬 Create proof-of-concept for AI integration');
    }

    // Partnership/Reseller opportunities
    if (lowerDescription.includes('partnership') || lowerDescription.includes('resell') ||
      lowerDescription.includes('reseller') || lowerDescription.includes('channel')) {
      immediateActions.push('🤝 Schedule partnership strategy discussion');
      strategicActions.push('📋 Develop partnership agreement framework');
      strategicActions.push('📈 Create joint go-to-market strategy');
    }

    // Platform/Software opportunities
    if (lowerDescription.includes('platform') || lowerDescription.includes('software') ||
      lowerDescription.includes('solution') || lowerDescription.includes('system')) {
      immediateActions.push('💻 Prepare platform demonstration and technical deep-dive');
      strategicActions.push('🔧 Develop integration and deployment plan');
      strategicActions.push('📚 Create comprehensive training and support plan');
    }

    // Cloud/Hyperscaler opportunities
    if (lowerDescription.includes('cloud') || lowerDescription.includes('aws') ||
      lowerDescription.includes('azure') || lowerDescription.includes('gcp') ||
      lowerDescription.includes('hyperscaler')) {
      immediateActions.push('☁️ Prepare cloud architecture and scalability presentation');
      strategicActions.push('🏗️ Develop cloud migration and optimization strategy');
      strategicActions.push('🔒 Create security and compliance framework');
    }

    // ===== STAGE-BASED RECOMMENDATIONS =====
    const currentStage = opportunityFields.stage || '';
    const stageLower = currentStage.toLowerCase();

    if (stageLower.includes('prospecting') || stageLower.includes('qualification')) {
      immediateActions.push('📞 Schedule discovery call to understand business needs');
      immediateActions.push('📋 Prepare qualification questions and needs assessment');
      strategicActions.push('🎯 Develop targeted value proposition');
    } else if (stageLower.includes('proposal') || stageLower.includes('quotation')) {
      immediateActions.push('📄 Prepare detailed proposal with pricing and timeline');
      immediateActions.push('💼 Schedule proposal presentation meeting');
      strategicActions.push('⚖️ Develop negotiation strategy and fallback options');
    } else if (stageLower.includes('negotiation') || stageLower.includes('review')) {
      immediateActions.push('🤝 Schedule negotiation meeting with key stakeholders');
      immediateActions.push('📊 Prepare competitive analysis and differentiation points');
      strategicActions.push('⏰ Set clear timeline and decision criteria');
    } else if (stageLower.includes('closed') || stageLower.includes('won')) {
      immediateActions.push('🎉 Schedule project kickoff and onboarding meeting');
      immediateActions.push('📋 Prepare implementation timeline and milestones');
      strategicActions.push('🔄 Plan for expansion and upselling opportunities');
    }

    // ===== PROBABILITY-BASED RECOMMENDATIONS =====
    const probability = parseFloat(opportunityFields.probability) || 0;

    if (probability < 30) {
      immediateActions.push('🔍 Conduct deeper discovery to identify key pain points');
      immediateActions.push('📞 Schedule meeting with additional stakeholders');
      strategicActions.push('🎯 Refine value proposition based on current needs');
    } else if (probability >= 30 && probability < 70) {
      immediateActions.push('📊 Prepare detailed ROI analysis and business case');
      immediateActions.push('👥 Identify and engage with decision makers');
      strategicActions.push('🏆 Develop competitive differentiation strategy');
    } else if (probability >= 70) {
      immediateActions.push('📋 Prepare contract and legal documentation');
      immediateActions.push('⏰ Set clear timeline for contract execution');
      strategicActions.push('🚀 Plan for successful implementation and onboarding');
    }

    // ===== COMPANY SIZE-BASED RECOMMENDATIONS =====
    const employeeCount = companyData.overview?.employees || '';
    if (employeeCount.includes('1000+') || employeeCount.includes('5000+') || employeeCount.includes('10000+')) {
      immediateActions.push('🏢 Prepare enterprise-level presentation and case studies');
      strategicActions.push('👥 Identify multiple stakeholders and decision makers');
      strategicActions.push('📋 Develop comprehensive implementation and change management plan');
    } else if (employeeCount.includes('100-') || employeeCount.includes('500-')) {
      immediateActions.push('💼 Prepare mid-market focused solution presentation');
      strategicActions.push('⚡ Emphasize quick implementation and immediate ROI');
    } else if (employeeCount.includes('1-') || employeeCount.includes('10-') || employeeCount.includes('50-')) {
      immediateActions.push('🚀 Prepare startup/SMB focused solution presentation');
      strategicActions.push('💰 Emphasize cost-effectiveness and scalability');
    }

    // ===== CONTACT ROLE-BASED RECOMMENDATIONS =====
    const contactTitle = contactData.background?.title || '';
    const titleLower = contactTitle.toLowerCase();

    if (titleLower.includes('ceo') || titleLower.includes('president') || titleLower.includes('founder')) {
      immediateActions.push('👑 Prepare executive-level strategic presentation');
      strategicActions.push('📈 Focus on business growth and competitive advantage');
    } else if (titleLower.includes('cto') || titleLower.includes('vp engineering') || titleLower.includes('head of technology')) {
      immediateActions.push('🔧 Prepare technical deep-dive and architecture discussion');
      strategicActions.push('⚙️ Focus on technical integration and scalability');
    } else if (titleLower.includes('cfo') || titleLower.includes('vp finance') || titleLower.includes('finance director')) {
      immediateActions.push('💰 Prepare detailed ROI analysis and financial benefits');
      strategicActions.push('📊 Focus on cost savings and revenue impact');
    } else if (titleLower.includes('cmo') || titleLower.includes('vp marketing') || titleLower.includes('marketing director')) {
      immediateActions.push('📢 Prepare marketing and customer acquisition benefits');
      strategicActions.push('🎯 Focus on market expansion and customer engagement');
    }

    // ===== INDUSTRY-SPECIFIC RECOMMENDATIONS =====
    const industry = companyData.overview?.industry || '';
    const industryLower = industry.toLowerCase();

    if (industryLower.includes('technology') || industryLower.includes('software') || industryLower.includes('saas')) {
      immediateActions.push('💻 Prepare technology integration and API documentation');
      strategicActions.push('🔄 Focus on scalability and automation benefits');
    } else if (industryLower.includes('healthcare') || industryLower.includes('medical')) {
      immediateActions.push('🏥 Prepare HIPAA compliance and security documentation');
      strategicActions.push('⚕️ Focus on patient care and operational efficiency');
    } else if (industryLower.includes('finance') || industryLower.includes('banking') || industryLower.includes('fintech')) {
      immediateActions.push('🏦 Prepare regulatory compliance and security framework');
      strategicActions.push('💳 Focus on risk management and customer experience');
    } else if (industryLower.includes('retail') || industryLower.includes('ecommerce')) {
      immediateActions.push('🛒 Prepare customer experience and sales optimization benefits');
      strategicActions.push('📱 Focus on omnichannel and digital transformation');
    }

    // ===== COMPETITIVE LANDSCAPE RECOMMENDATIONS =====
    if (companyData.market?.competitors && companyData.market.competitors.length > 0) {
      immediateActions.push('🏆 Prepare competitive differentiation analysis');
      strategicActions.push('📊 Develop win/loss analysis against key competitors');
      strategicActions.push('🎯 Create unique value proposition messaging');
    }

    // ===== COMMUNICATION PREFERENCES =====
    if (contactData.communication_preferences && contactData.communication_preferences.length > 0) {
      const preferences = contactData.communication_preferences.join(', ');
      insights.push(`📞 Communication Style: ${preferences}`);

      if (preferences.toLowerCase().includes('email')) {
        immediateActions.push('📧 Prepare detailed email follow-up with key information');
      }
      if (preferences.toLowerCase().includes('phone') || preferences.toLowerCase().includes('call')) {
        immediateActions.push('📞 Schedule follow-up phone call within 24-48 hours');
      }
      if (preferences.toLowerCase().includes('meeting') || preferences.toLowerCase().includes('video')) {
        immediateActions.push('📹 Schedule video conference for detailed discussion');
      }
    }

    // ===== FALLBACK RECOMMENDATIONS =====
    if (immediateActions.length === 0) {
      immediateActions.push('📞 Schedule discovery call to understand business needs');
      immediateActions.push('📋 Prepare qualification questions and needs assessment');
    }

    if (strategicActions.length === 0) {
      strategicActions.push('🎯 Develop targeted value proposition');
      strategicActions.push('📊 Create comprehensive business case');
    }

    // ===== PRIORITIZE AND SELECT TOP 4 MOST IMPORTANT STEPS =====
    const allSteps = [...immediateActions, ...strategicActions];

    // Create a scoring system for step prioritization
    const stepScores = allSteps.map(step => {
      let score = 0;

      // Higher priority for immediate actions
      if (immediateActions.includes(step)) {
        score += 10;
      }

      // Stage-based scoring
      if (stageLower.includes('prospecting') || stageLower.includes('qualification')) {
        if (step.includes('discovery') || step.includes('qualification')) score += 8;
        if (step.includes('needs assessment')) score += 7;
      } else if (stageLower.includes('proposal') || stageLower.includes('quotation')) {
        if (step.includes('proposal') || step.includes('presentation')) score += 8;
        if (step.includes('negotiation')) score += 7;
      } else if (stageLower.includes('negotiation') || stageLower.includes('review')) {
        if (step.includes('negotiation') || step.includes('stakeholders')) score += 8;
        if (step.includes('competitive analysis')) score += 7;
      }

      // Probability-based scoring
      if (probability >= 70) {
        if (step.includes('contract') || step.includes('execution')) score += 6;
        if (step.includes('implementation')) score += 5;
      } else if (probability >= 30 && probability < 70) {
        if (step.includes('ROI') || step.includes('business case')) score += 6;
        if (step.includes('decision makers')) score += 5;
      } else {
        if (step.includes('discovery') || step.includes('pain points')) score += 6;
        if (step.includes('stakeholders')) score += 5;
      }

      // Description-based scoring (AI, partnership, platform keywords)
      if (lowerDescription.includes('ai') && step.includes('AI')) score += 5;
      if (lowerDescription.includes('partnership') && step.includes('partnership')) score += 5;
      if (lowerDescription.includes('platform') && step.includes('platform')) score += 5;

      // Contact role-based scoring
      if (titleLower.includes('ceo') && step.includes('executive')) score += 4;
      if (titleLower.includes('cto') && step.includes('technical')) score += 4;
      if (titleLower.includes('cfo') && step.includes('ROI')) score += 4;

      return { step, score };
    });

    // Sort by score and select top 4
    const sortedSteps = stepScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(item => item.step);

    // Remove duplicates while preserving order
    const uniqueNextSteps = [...new Set(sortedSteps)];


    return {
      insights,
      next_steps: uniqueNextSteps,
      immediate_actions: immediateActions.slice(0, 4),
      strategic_actions: strategicActions.slice(0, 4)
    };
  } catch (error) {
    console.error('❌ Error generating enhanced insights:', error);
    return {
      insights: ['Error generating insights'],
      next_steps: ['Schedule initial discovery meeting', 'Prepare executive presentation', 'Develop competitive differentiation strategy', 'Prepare qualification questions and needs assessment'],
      immediate_actions: ['Schedule initial discovery meeting'],
      strategic_actions: ['Develop competitive differentiation strategy']
    };
  }
};

/**
 * Start company research using ResearchBy.ai
 */
exports.startCompanyResearch = async (req, res) => {
  try {
    const { companyName, opportunityId, accountId, tenantId } = req.body;
    // Create research record in crm_research table
    const researchRecord = await pool.query(
      `INSERT INTO crm_research 
       (opportunity_id, account_id, tenant_id, research_type, status, progress, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [opportunityId, accountId, tenantId, 'company', 'in-progress', 0]
    );

    const researchId = researchRecord.rows[0].id;

    // Start ResearchBy.ai company research
    const researchQuery = `Company research: ${companyName} - industry analysis, financial information, market position, competitors, company overview, business model, growth metrics, funding history, employee count, headquarters location, key executives, strategic initiatives`;

    const response = await axios.post(
      `${RESEARCH_BY_AI_CONFIG.baseURL}/api/research/start`,
      { query: researchQuery },
      { headers: RESEARCH_BY_AI_CONFIG.headers }
    );

    if (response.data.requestId) {
      // Update research record with ResearchBy.ai request ID
      await pool.query(
        'UPDATE crm_research SET research_data = $1 WHERE id = $2',
        [{
          research_by_ai_request_id: response.data.requestId,
          company_name: companyName,
          research_query: researchQuery,
          started_at: new Date().toISOString()
        }, researchId]
      );

      // Start background monitoring
      monitorCompanyResearch(researchId, response.data.requestId, companyName, accountId, tenantId);

      res.json({
        success: true,
        message: `Company research started for ${companyName}`,
        data: {
          researchId,
          requestId: response.data.requestId,
          companyName,
          opportunityId,
          accountId,
          tenantId
        }
      });
    } else {
      throw new Error('ResearchBy.ai did not return request ID');
    }

  } catch (error) {
    console.error("❌ Error starting company research:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start company research",
      error: error.message
    });
  }
};

/**
 * Start contact research using ResearchBy.ai
 */
exports.startContactResearch = async (req, res) => {
  try {
    const { contactName, contactEmail, companyName, opportunityId, contactId, tenantId } = req.body;

    // Create research record in crm_research table
    // Handle contact_id properly - only insert if it's a numeric ID (from users table)
    const isNumericId = isNumericContactId(contactId);
    const dbContactId = isNumericId ? contactId : null;

    const researchRecord = await pool.query(
      `INSERT INTO crm_research 
       (opportunity_id, contact_id, tenant_id, research_type, status, progress, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [opportunityId, dbContactId, tenantId, 'contact', 'in-progress', 0]
    );

    const researchId = researchRecord.rows[0].id;

    // Start ResearchBy.ai contact research
    const researchQuery = `Contact research: ${contactName} at ${companyName} - professional background, current role, work experience, education, skills, LinkedIn profile, decision-making authority, communication preferences, career history, industry expertise, professional achievements, contact information`;

    const response = await axios.post(
      `${RESEARCH_BY_AI_CONFIG.baseURL}/api/research/start`,
      { query: researchQuery },
      { headers: RESEARCH_BY_AI_CONFIG.headers }
    );

    if (response.data.requestId) {
      // Update research record with ResearchBy.ai request ID
      await pool.query(
        'UPDATE crm_research SET research_data = $1 WHERE id = $2',
        [{
          research_by_ai_request_id: response.data.requestId,
          contact_name: contactName,
          contact_email: contactEmail,
          company_name: companyName,
          original_contact_id: contactId, // Store original contact ID (UUID or numeric)
          contact_id_type: isNumericId ? 'numeric' : 'uuid',
          research_query: researchQuery,
          started_at: new Date().toISOString()
        }, researchId]
      );

      // Start background monitoring
      monitorContactResearch(researchId, response.data.requestId, contactName, contactId, tenantId);

      res.json({
        success: true,
        message: `Contact research started for ${contactName}`,
        data: {
          researchId,
          requestId: response.data.requestId,
          contactName,
          contactEmail,
          companyName,
          opportunityId,
          contactId,
          tenantId
        }
      });
    } else {
      throw new Error('ResearchBy.ai did not return request ID');
    }

  } catch (error) {
    console.error("❌ Error starting contact research:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start contact research",
      error: error.message
    });
  }
};

/**
 * Start both company and contact research for an opportunity
 */
exports.startOpportunityResearch = async (req, res) => {
  try {
    const { companyName, contactName, opportunityId, accountId, contactId, tenantId } = req.body;
    // Log contact ID type for debugging

    // Validate ResearchBy.ai configuration
    if (!RESEARCH_BY_AI_CONFIG.baseURL || !RESEARCH_BY_AI_CONFIG.apiKey) {
      console.error('❌ ResearchBy.ai configuration missing!');
      return res.status(500).json({
        success: false,
        message: 'ResearchBy.ai is not properly configured',
        error: 'Missing API URL or API Key in environment variables',
        details: {
          apiUrl: RESEARCH_BY_AI_CONFIG.baseURL ? '✅ Set' : '❌ Missing',
          apiKey: RESEARCH_BY_AI_CONFIG.apiKey ? '✅ Set' : '❌ Missing'
        }
      });
    }

    // Check if research already exists - if yes, we'll update it instead of creating new
    const existingResearch = await pool.query(
      'SELECT * FROM crm_research WHERE opportunity_id = $1 AND research_type = $2',
      [opportunityId, 'both']
    );

    let researchId;
    let isUpdatingExisting = false;

    if (existingResearch.rows.length > 0) {
      const existing = existingResearch.rows[0];
      researchId = existing.id;
      isUpdatingExisting = true;


      // Update existing research record to reset status, progress, and clear old research data
      await pool.query(
        `UPDATE crm_research 
         SET status = $1, progress = $2, started_at = NOW(), updated_at = NOW(),
             research_data = NULL, company_research_file = NULL, contact_research_file = NULL, opportunity_research_file = NULL
         WHERE id = $3`,
        ['in-progress', 0, researchId]
      );

    }

    // Handle contact_id properly - only insert if it's a numeric ID (from users table)
    const isNumericId = isNumericContactId(contactId);
    const dbContactId = isNumericId ? contactId : null;

    // Create research record only if it doesn't exist
    if (!isUpdatingExisting) {

      const researchRecord = await pool.query(
        `INSERT INTO crm_research 
         (opportunity_id, account_id, contact_id, tenant_id, research_type, status, progress, started_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING *`,
        [opportunityId, accountId, dbContactId, tenantId, 'both', 'in-progress', 0]
      );

      researchId = researchRecord.rows[0].id;
    } else {
      console.log(`✅ Using existing research record ID: ${researchId}`);
    }

    const opportunitiesDetails = await pool.query(
      `SELECT o.*, u.name as owner_name FROM opportunities o
        left join users u on o.owner_id=u.id
        WHERE o.id = $1
        `,
      [opportunityId]
    );
    const contactsDetails = await pool.query(
      'SELECT * FROM contacts WHERE id = $1',
      [contactId]
    );
    const accountsDetails = await pool.query(
      'SELECT * FROM accounts WHERE id = $1',
      [accountId]
    );

    const opportunitiesContacts = await pool.query(
      'SELECT * FROM opportunity_contacts WHERE opportunity_id = $1 AND contact_id = $2',
      [opportunityId, contactId]
    );

    const researchPromptforNextStep = `You are an AI business research assistant.  
Given an opportunity and its related company (account), research and generate structured **next steps and actions** in the following format:  

Next Steps & Actions:

Priority 1: [Name of Priority]  
- Action: [Clear next step to move the opportunity forward]  
- Due By: [Timeline / expected date]  
- Key Message: [Tailored value message that connects to customer’s goals]  
- Focus: [Business focus area – e.g., innovation, cost savings, digital transformation]  
- Opportunity Support: [How this action directly supports the opportunity / relationship]  

Priority 2: [Name of Priority]  
- Action: [Clear next step to move the opportunity forward]  
- Due By: [Timeline / expected date]  
- Key Message: [Tailored value message that connects to customer’s goals]  
- Focus: [Business focus area – e.g., market expansion, revenue growth, customer experience]  
- Opportunity Support: [How this action directly supports the opportunity / relationship]  

Priority 3: [Name of Priority]  
- Action: [Clear next step to move the opportunity forward]  
- Due By: [Timeline / expected date]  
- Key Message: [Tailored value message that connects to customer’s goals]  
- Focus: [Business focus area – e.g., sustainability, partnerships, operational efficiency]  
- Opportunity Support: [How this action directly supports the opportunity / relationship]  

Priority 4: [Name of Priority]  
- Action: [Clear next step to move the opportunity forward]  
- Due By: [Timeline / expected date]  
- Key Message: [Tailored value message that connects to customer’s goals]  
- Focus: [Business focus area – e.g., global expansion, talent development, AI adoption]  
- Opportunity Support: [How this action directly supports the opportunity / relationship]  

Success Metrics:  
- [Metric 1: measurable KPI e.g., Increase probability from 30% → 60%]  
- [Metric 2: measurable KPI e.g., Projected deal value impact]  
- [Metric 3: measurable KPI e.g., Stakeholder engagement progress]  
- [Metric 4: measurable KPI e.g., Target timeline alignment with customer roadmap]  

Quick Wins:  
- [List 1–2 immediate, low-effort actions that can create early traction and build trust]  

---

### Input (Opportunity + Account):  
Opportunity Name: ${opportunitiesDetails.rows[0].name}  
Account: ${accountsDetails.rows[0].name} (${accountsDetails.rows[0].industry})  
Description: ${opportunitiesDetails.rows[0].description}  
Amount: ${opportunitiesDetails.rows[0].amount}  
Stage: ${opportunitiesDetails.rows[0].stage}  
Lead Source: ${opportunitiesDetails.rows[0].lead_source}  
Opportunity Owner: ${opportunitiesDetails.rows[0].owner_name}`
    const researchPromptforCompany = `You are an AI business research assistant. 
      Given an opportunity and its related company (account), research the company and generate structured insights in the following format:
      
      Company Information:
      - Company: [Full company name]
      - Annual Revenue: [Most recent revenue figure]
      - Market Share: [% share and positioning, e.g., Global Leader, Top 5, etc.]
      - Employees: [Approximate worldwide employee count]
      - Founded: [Year founded and years since founding]
      - Stock: [Ticker symbol and exchange if public]
      - Digital Sales: [% of revenue from digital sales if available]
      - Website: [Official company website]

      Current Challenges:
      - [List 3–4 current challenges the company is facing: sales, market trends, competition, operational issues, etc.]

      Strategic Initiatives:
      - Direct-to-Consumer: [Describe initiatives focused on reducing reliance on intermediaries, enhancing direct customer reach]
      - Innovation: [Describe product or technology innovation initiatives]
      - Sustainability: [Describe sustainability or environmental goals]
      - Digital: [Describe digital transformation, apps, or platform-based initiatives]

      Key Partnerships:
      - [List 3–4 key partnerships with organizations, leagues, influencers, or industries relevant to the company]

      ---

      ### Input (Opportunity + Account):
      Opportunity Name: ${opportunitiesDetails.rows[0].name}  
      Account: ${accountsDetails.rows[0].name} (${accountsDetails.rows[0].industry})  
      Description: ${opportunitiesDetails.rows[0].description}  
      Amount: ${opportunitiesDetails.rows[0].amount}  
      Stage: ${opportunitiesDetails.rows[0].stage}  
      Lead Source: ${opportunitiesDetails.rows[0].lead_source} 
      Opportunity Owner: ${opportunitiesDetails.rows[0].owner_name}`;
    const researchPromptforContact = `
      You are an AI business research assistant.  
      Given an opportunity and its related contact details, research the company and the assigned contact person.  

      Generate structured insights in the following format:
      
      Leadership Focus:
      - [Provide 4-5 key focus areas of the company’s leadership, e.g., strategy, innovation, operational goals]
      
      Key Quote:
      - "[Provide a concise, leadership-aligned quote from company executives or public sources about their strategy, vision, or future outlook]"
      
      Recent Actions:
      - [Summarize 2–3 of the most recent actions, initiatives, or changes made by the company or leadership team, focusing on business growth, restructuring, partnerships, or product launches]
      
      ---
      
      ### Input (Opportunity + Contact):
      Opportunity Name: ${opportunitiesDetails.rows[0].name}  
      Account: ${accountsDetails.rows[0].name} (${accountsDetails.rows[0].industry})  
      Description: ${opportunitiesDetails.rows[0].description}  
      Amount: ${opportunitiesDetails.rows[0].amount}  
      Stage: ${opportunitiesDetails.rows[0].stage}  
      Lead Source: ${opportunitiesDetails.rows[0].lead_source}  
      Opportunity Owner: ${opportunitiesDetails.rows[0].owner_name}  
      Contact: ${contactsDetails.rows[0].name} (${opportunitiesContacts.rows[0].role} Contact for this opportunity)
      `
    // Start all three researches in parallel
    let companyResponse, contactResponse, opportunityResponse;

    try {


      [companyResponse, contactResponse, opportunityResponse] = await Promise.all([
        // Company research with specific data requirements
        axios.post(
          `${RESEARCH_BY_AI_CONFIG.baseURL}/api/research/start`,
          {
            query: researchPromptforCompany
          },
          { headers: RESEARCH_BY_AI_CONFIG.headers }
        ),

        // Contact research with specific data requirements
        axios.post(
          `${RESEARCH_BY_AI_CONFIG.baseURL}/api/research/start`,
          {
            query: researchPromptforContact
          },
          { headers: RESEARCH_BY_AI_CONFIG.headers }
        ),

        // Opportunity research for next steps and actions
        axios.post(
          `${RESEARCH_BY_AI_CONFIG.baseURL}/api/research/start`,
          {
            query: researchPromptforNextStep
          },
          { headers: RESEARCH_BY_AI_CONFIG.headers }
        )
      ]);
      const sysprompt = `You are an AI business research assistant.`;

    const researchPrompt = `
You are an AI business research assistant.  
Given an opportunity, its related company (account), and its related contact details, research and generate structured insights.  

⚠️ CRITICAL INSTRUCTIONS:  
- Output must be in **valid JSON only**, following the exact schema below.  
- Do NOT include markdown formatting, code fences, comments, or tags.  
- Every section must be **directly contextualized** to the given opportunity details, company background, and contact role.  
- Do NOT provide generic actions. Each insight must connect to the **specific opportunity stage, amount, description, company challenges/initiatives, and contact role**.  
- **The Opportunity Description MUST be directly referenced and reflected in every priority, action, message, and quick win.**  
- **The "opportunity_next_steps" section MUST be created by combining insights from the "company_information", "contact_research", AND the Opportunity Description.**  
  - Each priority, action, key_message, and quick win must explicitly reference:  
    1. The company’s challenges/initiatives from company_information  
    2. The leadership focus/recent actions from contact_research  
    3. The specific opportunity description, stage, and amount  
- If information is unavailable, return "N/A".  
- The response must begin with { and end with }.  

Output format:
{
  "company_information": {
    "company": "[Full company name]",
    "annual_revenue": "[Most recent revenue figure]",
    "market_share": "[% share and positioning]",
    "employees": "[Approximate worldwide employee count]",
    "founded": "[Year founded and years since founding]",
    "stock": "[Ticker symbol and exchange if public]",
    "digital_sales": "[% of revenue from digital sales if available]",
    "website": "[Official company website]",
    "current_challenges": [
      "[Challenge 1]",
      "[Challenge 2]",
      "[Challenge 3]"
    ],
    "strategic_initiatives": {
      "direct_to_consumer": "[Describe initiatives]",
      "innovation": "[Describe initiatives]",
      "sustainability": "[Describe initiatives]",
      "digital": "[Describe initiatives]"
    },
    "key_partnerships": [
      "[Partnership 1]",
      "[Partnership 2]",
      "[Partnership 3]"
    ]
  },
  "contact_research": {
    "leadership_focus": [
      "[Focus 1]",
      "[Focus 2]",
      "[Focus 3]",
      "[Focus 4]"
    ],
    "key_quote": "[Relevant leadership-aligned quote]",
    "recent_actions": [
      "[Action 1]",
      "[Action 2]",
      "[Action 3]"
    ]
  },
  "opportunity_next_steps": {
    "priority_1": {
      "name": "[Priority name derived from opportunity description and stage]",
      "action": "[Clear next step directly tied to the opportunity description, company challenges, and contact focus]",
      "due_by": "[Timeline / expected date relevant to opportunity cycle]",
      "key_message": "[Tailored message that ties company challenges, contact focus, and opportunity description]",
      "focus": "[Business focus area linked to opportunity description + company challenges]",
      "opportunity_support": "[How it supports THIS opportunity by combining description + company info + contact research]"
    },
    "priority_2": {
      "name": "[Priority name derived from opportunity description and financials/risk]",
      "action": "[Step that mitigates risk or highlights ROI tied to description, company challenges, and contact role]",
      "due_by": "[Timeline aligned with decision milestones]",
      "key_message": "[Message that reassures financial/operational impact linked to description and company context]",
      "focus": "[Efficiency / ROI / Risk management]",
      "opportunity_support": "[How this strengthens the business case in context of description + company info + contact research]"
    },
    "priority_3": {
      "name": "[Priority name tied to executive alignment or stakeholder buy-in]",
      "action": "[Engagement step that references description and involves decision makers + contact role]",
      "due_by": "[Timeline before final approval stage]",
      "key_message": "[Message showing leadership alignment while referencing description and contact insights]",
      "focus": "[Strategic alignment / leadership trust]",
      "opportunity_support": "[How it ensures smoother deal closure by combining description + company info + contact research]"
    },
    "priority_4": {
      "name": "[Priority name tied to industry proof or validation relevant to description]",
      "action": "[Step involving case studies, references, or proof points similar to description and company initiatives]",
      "due_by": "[Timeline before closing the deal]",
      "key_message": "[Message that demonstrates credibility using description, company challenges, and contact role]",
      "focus": "[Industry relevance / de-risking]",
      "opportunity_support": "[How it reassures contact that success is achievable with description + company info + contact research]"
    },
    "success_metrics": [
      "[Metric 1]",
      "[Metric 2]",
      "[Metric 3]",
      "[Metric 4]"
    ],
    "quick_wins": [
      "[Quick win achievable from description + company context + contact insights]",
      "[Quick win tied to contact engagement as per description and leadership focus]"
    ]
  }
}

---

### Input (Opportunity + Account + Contact):
Opportunity Name: ${opportunitiesDetails.rows[0].name}  
Account: ${accountsDetails.rows[0].name} (${accountsDetails.rows[0].industry})  
Opportunity Description: ${opportunitiesDetails.rows[0].description}  
Amount: ${opportunitiesDetails.rows[0].amount}  
Stage: ${opportunitiesDetails.rows[0].stage}  
Lead Source: ${opportunitiesDetails.rows[0].lead_source}  
Opportunity Owner: ${opportunitiesDetails.rows[0].owner_name}  
Contact: ${contactsDetails.rows[0].name} (${opportunitiesContacts.rows[0].role} Contact for this opportunity)  

Return only the JSON object as per schema. Do not add explanations.
`;

      //const responseText = await processAI(sysprompt, researchPromptMaster, 2048);
      gerateJsonForResearch(sysprompt,researchPrompt,opportunityId)

    } catch (apiError) {
      console.error("❌ ResearchBy.ai API call failed:", apiError.message);

      // Clean up the research record since API failed
      await pool.query('DELETE FROM crm_research WHERE id = $1', [researchId]);

      return res.status(500).json({
        success: false,
        message: "Failed to start research with ResearchBy.ai",
        error: `API Error: ${apiError.message}`,
        details: {
          companyName,
          contactName,
          opportunityId
        }
      });
    }

    // Validate API responses
    if (!companyResponse?.data?.requestId || !contactResponse?.data?.requestId || !opportunityResponse?.data?.requestId) {
      // Clean up the research record since API failed
      await pool.query('DELETE FROM crm_research WHERE id = $1', [researchId]);

      return res.status(500).json({
        success: false,
        message: "ResearchBy.ai API returned invalid response",
        error: "Missing request IDs from ResearchBy.ai",
        details: {
          companyResponse: companyResponse?.data,
          contactResponse: contactResponse?.data,
          opportunityResponse: opportunityResponse?.data
        }
      });
    }

    if (companyResponse.data.requestId && contactResponse.data.requestId && opportunityResponse.data.requestId) {
      // Create file storage directories
      await createResearchDirectories(researchId);

      // Update research record with all three request IDs
      await pool.query(
        'UPDATE crm_research SET research_data = $1 WHERE id = $2',
        [{
          company_research_id: companyResponse.data.requestId,
          contact_research_id: contactResponse.data.requestId,
          opportunity_research_id: opportunityResponse.data.requestId,
          company_name: companyName,
          contact_name: contactName,
          original_contact_id: contactId, // Store original contact ID (UUID or numeric)
          contact_id_type: isNumericId ? 'numeric' : 'uuid',
          started_at: new Date().toISOString(),
          file_paths: {
            company: null, // Will be updated when file is ready
            contact: null, // Will be updated when file is ready
            opportunity: null // Will be updated when file is ready
          }
        }, researchId]
      );

      // Start background monitoring for all three
      startOpportunityResearchMonitoring(researchId, companyResponse.data.requestId, contactResponse.data.requestId, opportunityResponse.data.requestId, companyName, contactName, accountId, contactId, tenantId);

      res.json({
        success: true,
        message: isUpdatingExisting
          ? `Research updated and restarted for ${companyName} and ${contactName}`
          : `Research started for ${companyName} and ${contactName}`,
        data: {
          researchId,
          companyRequestId: companyResponse.data.requestId,
          contactRequestId: contactResponse.data.requestId,
          opportunityRequestId: opportunityResponse.data.requestId,
          companyName,
          contactName,
          opportunityId,
          accountId,
          contactId,
          tenantId,
          isUpdatingExisting
        }
      });
    } else {
      throw new Error('One or both ResearchBy.ai requests failed');
    }

  } catch (error) {
    console.error("❌ Error starting opportunity research:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start opportunity research",
      error: error.message
    });
  }
};

const gerateJsonForResearch = async (sysprompt,researchPrompt,opportunityId) => {

  const responseText = await test_prompt(
    sysprompt,
    researchPrompt,
    4096,
    'perplexity',
    'sonar-deep-research'
  );
  let parsedData;
  try {
    // Remove any potential markdown or text before/after JSON
    const cleaned = responseText?.preview.replace(/^[^{]+/, '').replace(/[^}]+$/, '');
    parsedData = JSON.parse(cleaned);
    pool.query(`update opportunities set research_data=$1 where id =$2`, [JSON.stringify(parsedData), opportunityId])
  } catch (error) {
    console.error("Error parsing JSON response:", error);
    //throw new Error("Failed to parse strategy analysis");
  }
}

/**
 * Check if research exists and is completed for an opportunity
 */
exports.checkResearchExists = async (req, res) => {
  try {
    const { opportunityId, tenantId } = req.params;

    // Get research record from crm_research table
    const researchRecord = await pool.query(
      'SELECT * FROM crm_research WHERE opportunity_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1',
      [opportunityId, tenantId]
    );

    if (researchRecord.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          exists: false,
          status: 'not_started',
          message: 'No research found'
        }
      });
    }

    const research = researchRecord.rows[0];

    // Check if research files exist
    const hasCompanyFile = research.company_research_file && research.company_research_file !== '';
    const hasContactFile = research.contact_research_file && research.contact_research_file !== '';
    const hasOpportunityFile = research.opportunity_research_file && research.opportunity_research_file !== '';

    // Check if research is completed (company and opportunity are required, contact is optional)
    const isCompleted = hasCompanyFile && hasOpportunityFile;


    res.json({
      success: true,
      data: {
        exists: true,
        status: isCompleted ? 'completed' : 'in_progress',
        research_id: research.id,
        has_company_file: hasCompanyFile,
        has_contact_file: hasContactFile,
        has_opportunity_file: hasOpportunityFile,
        is_completed: isCompleted,
        message: isCompleted ? 'Research completed successfully' : 'Research in progress'
      }
    });

  } catch (error) {
    console.error("❌ Error checking research existence:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check research existence",
      error: error.message
    });
  }
};

/**
 * Get research status for an opportunity
 */
exports.getResearchStatus = async (req, res) => {
  try {
    const { opportunityId, tenantId } = req.params;
    // Get research status from crm_research table
    const researchStatus = await pool.query(
      'SELECT * FROM crm_research WHERE opportunity_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1',
      [opportunityId, tenantId]
    );

    if (researchStatus.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          company: { status: 'not_started', progress: 0 },
          contact: { status: 'not_started', progress: 0 },
          opportunity: { status: 'not_started', progress: 0 }
        }
      });
    }

    const research = researchStatus.rows[0];
    const researchData = research.research_data || {};

    // Get real-time status from ResearchBy.ai
    let companyStatus = { status: 'pending', progress: 0 };
    let contactStatus = { status: 'pending', progress: 0 };
    let opportunityStatus = { status: 'pending', progress: 0 };

    // Check company research status (always required)
    if (researchData.company_research_id) {
      try {
        const companyResponse = await axios.get(
          `${RESEARCH_BY_AI_CONFIG.baseURL}/api/research/status/${researchData.company_research_id}`,
          { headers: RESEARCH_BY_AI_CONFIG.headers }
        );

        if (companyResponse.data.status) {
          companyStatus = {
            status: companyResponse.data.status[0].toLowerCase(),
            progress: companyResponse.data.status[0] === 'COMPLETED' ? 100 : 50
          };
        }
      } catch (error) {
        console.error('Error checking company research status:', error);
        companyStatus = { status: 'error', progress: 0 };
      }
    }

    // Check contact research status (optional)
    if (researchData.contact_research_id) {
      try {
        const contactResponse = await axios.get(
          `${RESEARCH_BY_AI_CONFIG.baseURL}/api/research/status/${researchData.contact_research_id}`,
          { headers: RESEARCH_BY_AI_CONFIG.headers }
        );

        if (contactResponse.data.status) {
          contactStatus = {
            status: contactResponse.data.status[0].toLowerCase(),
            progress: contactResponse.data.status[0] === 'COMPLETED' ? 100 : 50
          };
        }
      } catch (error) {
        console.error('Error checking contact research status:', error);
        contactStatus = { status: 'error', progress: 0 };
      }
    } else {
      contactStatus = { status: 'not_available', progress: 0 };
    }

    // Check opportunity research status (always required)
    if (researchData.opportunity_research_id) {
      try {
        const opportunityResponse = await axios.get(
          `${RESEARCH_BY_AI_CONFIG.baseURL}/api/research/status/${researchData.opportunity_research_id}`,
          { headers: RESEARCH_BY_AI_CONFIG.headers }
        );

        if (opportunityResponse.data.status) {
          opportunityStatus = {
            status: opportunityResponse.data.status[0].toLowerCase(),
            progress: opportunityResponse.data.status[0] === 'COMPLETED' ? 100 : 50
          };
        }
      } catch (error) {
        console.error('Error checking opportunity research status:', error);
        opportunityStatus = { status: 'error', progress: 0 };
      }
    }

    // Calculate overall progress (company and opportunity are required, contact is optional)
    const requiredProgress = companyStatus.progress + opportunityStatus.progress;
    const overallProgress = Math.round(requiredProgress / 2);

    // Update progress in database
    await pool.query(
      'UPDATE crm_research SET progress = $1, updated_at = NOW() WHERE id = $2',
      [overallProgress, research.id]
    );

    res.json({
      success: true,
      data: {
        company: companyStatus,
        contact: contactStatus,
        opportunity: opportunityStatus,
        overall: { progress: overallProgress }
      }
    });

  } catch (error) {
    console.error("❌ Error getting research status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get research status",
      error: error.message
    });
  }
};

/**
 * Filter out empty, placeholder, or useless values from research data
 */
const filterEmptyValues = (obj, parentKey = '') => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.filter(item => {
      if (typeof item === 'string') {
        return isValidContent(item);
      }
      return item != null;
    }).map(item => filterEmptyValues(item));
  }

  const filtered = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      continue; // Skip null/undefined values
    }

    if (typeof value === 'string') {
      if (!isValidContent(value)) {
        continue; // Skip invalid content
      }
    }

    if (Array.isArray(value)) {
      const filteredArray = filterEmptyValues(value, key);
      if (filteredArray.length > 0) {
        filtered[key] = filteredArray;
      }
    } else if (typeof value === 'object') {
      const filteredObj = filterEmptyValues(value, key);
      if (Object.keys(filteredObj).length > 0) {
        filtered[key] = filteredObj;
      }
    } else {
      filtered[key] = value;
    }
  }

  return filtered;
};

// Helper function to validate content quality
const isValidContent = (text) => {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return false;
  }

  const lowerText = trimmed.toLowerCase();

  // Filter out placeholder and generic content
  const invalidPatterns = [
    'not available',
    'not applicable',
    'n/a',
    'unknown',
    'not provided',
    'not specified',
    'lorem ipsum',
    'dolor sit amet',
    'consectetur adipiscing',
    'rapidly adopting new technologies',
    'allowing them to deliver innovative solutions',
    'trends and technological advancements',
    'and technological advancements',
    'allowing them to deliver innovative solutions to clients and',
    'rapidly adopting new technologies and methodologies'
  ];

  // Check for invalid patterns
  for (const pattern of invalidPatterns) {
    if (lowerText.includes(pattern)) {
      return false;
    }
  }

  // Filter out numbered placeholders like "4.1 Illumina"
  if (/^\d+\.\d+\s*\w*$/.test(trimmed)) {
    return false;
  }

  // Filter out incomplete sentences (sentences that end with "and", "or", "to", etc.)
  const incompleteEndings = [' and', ' or', ' to', ' with', ' for', ' in', ' on', ' at', ' by', ' from'];
  for (const ending of incompleteEndings) {
    if (trimmed.endsWith(ending)) {
      return false;
    }
  }

  // Filter out very short generic phrases
  if (trimmed.length < 10) {
    return false;
  }

  // Filter out sentences that are too generic
  const genericPhrases = [
    'innovative solutions',
    'cutting-edge technology',
    'digital transformation',
    'business growth',
    'competitive advantage',
    'market leader',
    'industry expertise'
  ];

  // If the text is just a generic phrase without context, filter it out
  if (genericPhrases.some(phrase => lowerText === phrase || lowerText === phrase + '.')) {
    return false;
  }

  return true;
};

/**
 * Get research results for an opportunity
 */
exports.getResearchResults = async (req, res) => {
  try {
    const { opportunityId, tenantId } = req.params;
    const { contactId } = req.query; // Get contactId from query parameters (optional)

    // Get research record from crm_research table
    const researchResults = await pool.query(
      'SELECT * FROM crm_research WHERE opportunity_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1',
      [opportunityId, tenantId]
    );

    if (researchResults.rows.length === 0) {
      return res.json({
        success: false,
        message: 'No research results found'
      });
    }

    const research = researchResults.rows[0];
    const researchData = research.research_data || {};

    // Validate that research has the required data (company and opportunity are always required)
    if (!researchData.company_research_id || !researchData.opportunity_research_id) {
      console.error(`❌ Research record missing required IDs:`, researchData);
      return res.status(400).json({
        success: false,
        message: 'Research record is incomplete or corrupted',
        error: 'Missing ResearchBy.ai request IDs for company or opportunity research',
        details: {
          research_id: research.id,
          company_research_id: researchData.company_research_id,
          opportunity_research_id: researchData.opportunity_research_id,
          research_data: researchData
        }
      });
    }

    // Check if contact research exists (optional)
    const hasContactResearch = researchData.contact_research_id;

    // Check if opportunity research exists
    const hasOpportunityResearch = researchData.opportunity_research_id;

    // Download and process research results from ResearchBy.ai
    let companyResults = {};
    let contactResults = {};
    let opportunityResults = {};

    // Process company research (always required)
    if (researchData.company_research_id) {
      try {

        const companyResponse = await axios.get(
          `${RESEARCH_BY_AI_CONFIG.baseURL}/api/research/download/${researchData.company_research_id}`,
          {
            headers: RESEARCH_BY_AI_CONFIG.headers,
            responseType: 'arraybuffer'
          }
        );

        // Save company research file
        const companyFilePath = `crm-research/company/company-${researchData.company_research_id}.docx`;
        const fullCompanyPath = path.join(process.cwd(), 'public/files', companyFilePath);

        // Ensure directory exists
        const companyDir = path.dirname(fullCompanyPath);
        if (!fs.existsSync(companyDir)) {
          fs.mkdirSync(companyDir, { recursive: true });
        }

        fs.writeFileSync(fullCompanyPath, companyResponse.data);

        // Parse company research content
        const companyParsedData = await parseDocxContent(fullCompanyPath, 'company');

        companyResults = {
          status: 'completed',
          file_path: companyFilePath,
          file_name: `company-${researchData.company_research_id}.docx`,
          download_url: `/api/files/${companyFilePath}`,
          request_id: researchData.company_research_id,
          company_name: researchData.company_name,
          file_size: companyResponse.data.length,
          parsed_content: companyParsedData
        };

      } catch (error) {
        console.error('❌ Error downloading company research:', error.message);
        companyResults = {
          status: 'error',
          error: error.message,
          details: `Failed to download company research file: ${error.message}`
        };
      }
    } else {
      companyResults = {
        status: 'error',
        error: 'No company research ID found',
        details: 'Company research was not properly initiated'
      };
    }

    // Process contact research if available (optional)
    if (hasContactResearch) {
      try {

        const contactResponse = await axios.get(
          `${RESEARCH_BY_AI_CONFIG.baseURL}/api/research/download/${researchData.contact_research_id}`,
          {
            headers: RESEARCH_BY_AI_CONFIG.headers,
            responseType: 'arraybuffer'
          }
        );

        // Save contact research file
        const contactFilePath = `crm-research/contact/contact-${researchData.contact_research_id}.docx`;
        const fullContactPath = path.join(process.cwd(), 'public/files', contactFilePath);

        // Ensure directory exists
        const contactDir = path.dirname(fullContactPath);
        if (!fs.existsSync(contactDir)) {
          fs.mkdirSync(contactDir, { recursive: true });
        }

        fs.writeFileSync(fullContactPath, contactResponse.data);

        // Parse contact research content
        const contactParsedData = await parseDocxContent(fullContactPath, 'contact');

        contactResults = {
          status: 'completed',
          file_path: contactFilePath,
          file_name: `contact-${researchData.contact_research_id}.docx`,
          download_url: `/api/files/${contactFilePath}`,
          request_id: researchData.contact_research_id,
          contact_name: researchData.contact_name,
          file_size: contactResponse.data.length,
          parsed_content: contactParsedData
        };

      } catch (error) {
        console.error('❌ Error downloading contact research:', error.message);
        contactResults = {
          status: 'error',
          error: error.message,
          details: `Failed to download contact research file: ${error.message}`
        };
      }
    } else {
      contactResults = {
        status: 'not_available',
        message: 'Contact research was not requested or available'
      };
    }

    // Process opportunity research if available
    if (hasOpportunityResearch) {
      try {

        const opportunityResponse = await axios.get(
          `${RESEARCH_BY_AI_CONFIG.baseURL}/api/research/download/${researchData.opportunity_research_id}`,
          {
            headers: RESEARCH_BY_AI_CONFIG.headers,
            responseType: 'arraybuffer',
            timeout: 30000 // 30 second timeout
          }
        );

        // Save opportunity research file
        const opportunityFilePath = `crm-research/opportunity/opportunity-${researchData.opportunity_research_id}.docx`;
        const fullOpportunityPath = path.join(process.cwd(), 'public/files', opportunityFilePath);

        // Ensure directory exists
        const opportunityDir = path.dirname(fullOpportunityPath);
        if (!fs.existsSync(opportunityDir)) {
          fs.mkdirSync(opportunityDir, { recursive: true });
        }

        fs.writeFileSync(fullOpportunityPath, opportunityResponse.data);

        // Parse opportunity research content
        const opportunityParsedData = await parseDocxContent(fullOpportunityPath, 'opportunity');

        opportunityResults = {
          status: 'completed',
          file_path: opportunityFilePath,
          file_name: `opportunity-${researchData.opportunity_research_id}.docx`,
          download_url: `/api/files/${opportunityFilePath}`,
          request_id: researchData.opportunity_research_id,
          company_name: researchData.company_name,
          contact_name: researchData.contact_name,
          file_size: opportunityResponse.data.length,
          parsed_content: opportunityParsedData
        };

      } catch (error) {
        console.error('❌ Error downloading opportunity research:', error.message);
        console.error('❌ Error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
          method: error.config?.method
        });

        opportunityResults = {
          status: 'error',
          error: error.message,
          details: `Failed to download opportunity research file: ${error.message}`,
          api_status: error.response?.status,
          api_status_text: error.response?.statusText
        };
      }
    } else {
      opportunityResults = {
        status: 'not_started',
        error: 'No opportunity research ID found',
        details: 'Opportunity research was not initiated'
      };
    }

    // Update research status and file paths
    await pool.query(
      `UPDATE crm_research 
       SET status = $1, 
           completed_at = NOW(), 
           updated_at = NOW(),
           company_research_file = $2,
           contact_research_file = $3,
           opportunity_research_file = $4
       WHERE id = $5`,
      ['completed', companyResults.file_path, contactResults.file_path, opportunityResults.file_path, research.id]
    );


    // Validate that we have actual research results
    // if (!companyResults.status || companyResults.status === 'error' || !contactResults.status || contactResults.status === 'error') {
    if (!companyResults.status || companyResults.status === 'error') {
      return res.status(400).json({
        success: false,
        message: 'Research results are incomplete or failed',
        data: {
          company: companyResults,
          contact: contactResults,
          opportunity: opportunityResults,
          research_id: research.id
        }
      });
    }

    // Fetch additional contact data from database using the contactId from query params
    // Only fetch additional data for numeric contact IDs (users table)
    const isNumericId = isNumericContactId(contactId);


    const additionalContactData = isNumericId
      ? await fetchContactAdditionalData(contactId, tenantId)
      : { userProfile: {}, recentTasks: [], relatedTasks: [] };

    // Fetch opportunity fields from database for comprehensive analysis
    let opportunityFields = {};
    try {
      const opportunityQuery = await pool.query(
        'SELECT name, amount, stage, probability, lead_source, expected_close_date, description FROM opportunities WHERE id = $1',
        [opportunityId]
      );
      if (opportunityQuery.rows.length > 0) {
        opportunityFields = opportunityQuery.rows[0];
      }
    } catch (error) {
      console.error('⚠️ Could not fetch opportunity fields:', error.message);
    }

    // Generate enhanced insights and next steps with all available data
    let enhancedData;
    if (opportunityResults.status === 'error') {
      // Generate insights without opportunity research data but with opportunity fields
      enhancedData = generateEnhancedInsights(
        companyResults.parsed_content || {},
        contactResults.parsed_content || {},
        {},
        opportunityFields
      );

      // Add fallback next steps if none generated
      if (enhancedData.next_steps.length === 0) {
        enhancedData.next_steps = [
          'Schedule initial discovery meeting',
          'Prepare executive presentation for key stakeholders',
          'Develop competitive differentiation strategy',
          'Prepare qualification questions and needs assessment'
        ];
      }
    } else {
      enhancedData = generateEnhancedInsights(
        companyResults.parsed_content || {},
        contactResults.parsed_content || {},
        opportunityResults.parsed_content || {},
        opportunityFields
      );
    }

    // Populate research_data with parsed content from documents
    const opportunityData = {
      summary: `Research completed for ${researchData.company_name || 'Company'} opportunity`,
      insights: enhancedData.insights,
      next_steps: enhancedData.next_steps,
      immediate_actions: enhancedData.immediate_actions || [],
      strategic_actions: enhancedData.strategic_actions || [],
      deal_stage: opportunityResults.parsed_content?.deal_stage || opportunityFields.stage || 'Unknown',
      deal_size: opportunityResults.parsed_content?.deal_size || opportunityFields.amount || 'Unknown',
      probability: opportunityResults.parsed_content?.probability || opportunityFields.probability || 'Unknown',
      timeline: opportunityResults.parsed_content?.timeline || opportunityFields.expected_close_date || 'Unknown',
      success_factors: opportunityResults.parsed_content?.success_factors || [],
      risk_factors: opportunityResults.parsed_content?.risk_factors || [],
      competitive_position: opportunityResults.parsed_content?.competitive_position || 'Unknown',
      differentiation: opportunityResults.parsed_content?.differentiation || 'Unknown',
      market_fit: opportunityResults.parsed_content?.market_fit || 'Unknown',
      // Include opportunity fields for reference
      opportunity_fields: opportunityFields
    };

    const accountData = {
      name: researchData.company_name || 'Company Name',
      ...companyResults.parsed_content // Use parsed company data
    };

    const contactData = {
      name: researchData.contact_name || 'Contact Name',
      ...contactResults.parsed_content, // Use parsed contact data
      // Add additional database data (only for numeric contact IDs)
      user_profile: isNumericId ? additionalContactData.userProfile : {},
      recent_tasks: isNumericId ? additionalContactData.recentTasks : [],
      related_tasks: isNumericId ? additionalContactData.relatedTasks : [],
      // Enhanced key expertise from multiple sources
      enhanced_expertise: {
        skills: contactResults.parsed_content?.skills || [],
        certifications: isNumericId ? (additionalContactData.userProfile?.certifications || []) : [],
        projects: isNumericId ? (additionalContactData.userProfile?.projects || []) : [],
        publications: isNumericId ? (additionalContactData.userProfile?.publications || []) : [],
        role: isNumericId ? (additionalContactData.userProfile?.role || '') : '',
        company_role: isNumericId ? (additionalContactData.userProfile?.company_role || '') : ''
      },
      // Enhanced recent activities from multiple sources
      enhanced_activities: {
        recent_tasks: isNumericId ? additionalContactData.recentTasks.map(task => ({
          title: task.title,
          description: task.description,
          status: task.status,
          category: task.category,
          priority: task.priority,
          created_at: task.created_at,
          completed_at: task.completed_at
        })) : [],
        related_tasks: isNumericId ? additionalContactData.relatedTasks.map(task => ({
          title: task.task_title || task.title,
          description: task.task_description || task.description,
          status: task.task_status || task.status,
          category: task.task_category || task.category,
          assigned_date: task.assigned_date || task.created_at,
          completed_date: task.completed_date || task.completed_at
        })) : []
      }
    };

    // Filter out empty/placeholder values from all research data
    const filteredOpportunityData = filterEmptyValues(opportunityData);
    const filteredAccountData = filterEmptyValues(accountData);
    const filteredContactData = filterEmptyValues(contactData);
    const filteredCompanyResults = filterEmptyValues(companyResults);
    const filteredContactResults = filterEmptyValues(contactResults);
    const filteredOpportunityResults = filterEmptyValues(opportunityResults);

    // Return populated and filtered research data
    res.json({
      success: true,
      data: {
        opportunity: {
          id: opportunityId,
          research_data: filteredOpportunityData
        },
        account: {
          research_data: filteredAccountData,
          research_results: filteredCompanyResults
        },
        contact: {
          research_data: filteredContactData,
          research_results: filteredContactResults
        },
        opportunity_research: {
          status: opportunityResults.status,
          research_results: filteredOpportunityResults
        },
        research_id: research.id,
        completed_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("❌ Error getting research results:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get research results",
      error: error.message
    });
  }
};

// Background monitoring functions
const monitorCompanyResearch = async (researchId, requestId, companyName, accountId, tenantId) => {
  try {

    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;

    const checkStatus = async () => {
      try {
        const response = await axios.get(
          `${RESEARCH_BY_AI_CONFIG.baseURL}/api/research/status/${requestId}`,
          { headers: RESEARCH_BY_AI_CONFIG.headers }
        );

        if (response.data.status && response.data.status[0] === 'COMPLETED') {

          // Download and store file
          await downloadAndStoreCompanyResearch(researchId, requestId, companyName, accountId, tenantId);

          // Update progress
          await updateResearchProgress(researchId, 50, 'in-progress');

        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(checkStatus, 5000); // Check every 5 seconds
        } else {
          await updateResearchProgress(researchId, 0, 'error');
        }

      } catch (error) {
        console.error(`❌ Error checking company research status:`, error);
        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(checkStatus, 5000);
        }
      }
    };

    checkStatus();

  } catch (error) {
    console.error(`❌ Error monitoring company research:`, error);
  }
};

const monitorContactResearch = async (researchId, requestId, contactName, contactId, tenantId) => {
  try {

    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;

    const checkStatus = async () => {
      try {
        const response = await axios.get(
          `${RESEARCH_BY_AI_CONFIG.baseURL}/api/research/status/${requestId}`,
          { headers: RESEARCH_BY_AI_CONFIG.headers }
        );

        if (response.data.status && response.data.status[0] === 'COMPLETED') {

          // Download and store file
          await downloadAndStoreContactResearch(researchId, requestId, contactName, contactId, tenantId);

          // Update progress
          await updateResearchProgress(researchId, 75, 'in-progress');

        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(checkStatus, 5000); // Check every 5 seconds
        } else {
          await updateResearchProgress(researchId, 50, 'error');
        }

      } catch (error) {
        console.error(`❌ Error checking contact research status:`, error);
        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(checkStatus, 5000);
        }
      }
    };

    checkStatus();

  } catch (error) {
    console.error(`❌ Error monitoring contact research:`, error);
  }
};

/**
 * Monitor opportunity research progress
 */
const monitorOpportunityResearch = async (researchId, requestId, companyName, contactName, accountId, contactId, tenantId) => {
  try {

    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;

    const checkStatus = async () => {
      try {
        const response = await axios.get(
          `${RESEARCH_BY_AI_CONFIG.baseURL}/api/research/status/${requestId}`,
          { headers: RESEARCH_BY_AI_CONFIG.headers }
        );

        if (response.data.status && response.data.status[0] === 'COMPLETED') {

          // Download and store file
          await downloadAndStoreOpportunityResearch(researchId, requestId, companyName, contactName, accountId, contactId, tenantId);

          // Update progress
          await updateResearchProgress(researchId, 100, 'completed');

        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(checkStatus, 5000); // Check every 5 seconds
        } else {
          await updateResearchProgress(researchId, 75, 'error');
        }

      } catch (error) {
        console.error(`❌ Error checking opportunity research status:`, error);
        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(checkStatus, 5000);
        }
      }
    };

    checkStatus();

  } catch (error) {
    console.error(`❌ Error monitoring opportunity research:`, error);
  }
};

const startOpportunityResearchMonitoring = async (researchId, companyRequestId, contactRequestId, opportunityRequestId, companyName, contactName, accountId, contactId, tenantId) => {
  try {

    // Monitor company research (always required)
    monitorCompanyResearch(researchId, companyRequestId, companyName, accountId, tenantId);

    // Monitor contact research (only if contact research was requested)
    if (contactRequestId && contactName && contactId) {
      monitorContactResearch(researchId, contactRequestId, contactName, contactId, tenantId);
    }

    // Monitor opportunity research (always required)
    monitorOpportunityResearch(researchId, opportunityRequestId, companyName, contactName, accountId, contactId, tenantId);

  } catch (error) {
    console.error(`❌ Error in research monitoring:`, error);
  }
};

/**
 * Download and store company research file
 */
const downloadAndStoreCompanyResearch = async (researchId, requestId, companyName, accountId, tenantId) => {
  try {

    // Download file from ResearchBy.ai
    const response = await axios.get(
      `${RESEARCH_BY_AI_CONFIG.baseURL}/api/research/download/${requestId}`,
      {
        headers: RESEARCH_BY_AI_CONFIG.headers,
        responseType: 'arraybuffer'
      }
    );

    // Generate file name and path
    const fileName = `company-${researchId}-${requestId}.docx`;
    const filePath = `crm-research/company/${fileName}`;
    const fullPath = path.join(process.cwd(), 'public/files', filePath);

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Save file
    fs.writeFileSync(fullPath, response.data);

    // Update database with file information
    const fileInfo = {
      file_path: filePath,
      file_name: fileName,
      download_url: `/api/files/${filePath}`,
      file_size: response.data.length,
      completed_at: new Date().toISOString()
    };

    await pool.query(
      `UPDATE crm_research 
       SET research_data = jsonb_set(
         research_data, 
         '{company, file_info}', 
         $1::jsonb
       )
       WHERE id = $2`,
      [JSON.stringify(fileInfo), researchId]
    );


    // Also update the main file path column
    await pool.query(
      'UPDATE crm_research SET company_research_file = $1 WHERE id = $2',
      [filePath, researchId]
    );

  } catch (error) {
    console.error(`❌ Error downloading company research file:`, error);
    throw error;
  }
};

/**
 * Download and store contact research file
 */
const downloadAndStoreContactResearch = async (researchId, requestId, contactName, contactId, tenantId) => {
  try {

    // Download file from ResearchBy.ai
    const response = await axios.get(
      `${RESEARCH_BY_AI_CONFIG.baseURL}/api/research/download/${requestId}`,
      {
        headers: RESEARCH_BY_AI_CONFIG.headers,
        responseType: 'arraybuffer'
      }
    );

    // Generate file name and path
    const fileName = `contact-${researchId}-${requestId}.docx`;
    const filePath = `crm-research/contact/${fileName}`;
    const fullPath = path.join(process.cwd(), 'public/files', filePath);

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Save file
    fs.writeFileSync(fullPath, response.data);

    // Update database with file information
    const fileInfo = {
      file_path: filePath,
      file_name: fileName,
      download_url: `/api/files/${filePath}`,
      file_size: response.data.length,
      completed_at: new Date().toISOString()
    };

    await pool.query(
      `UPDATE crm_research 
       SET research_data = jsonb_set(
         research_data, 
         '{contact, file_info}', 
         $1::jsonb
       )
       WHERE id = $2`,
      [JSON.stringify(fileInfo), researchId]
    );


    // Also update the main file path column
    await pool.query(
      'UPDATE crm_research SET contact_research_file = $1 WHERE id = $2',
      [filePath, researchId]
    );

  } catch (error) {
    console.error(`❌ Error downloading contact research file:`, error);
    throw error;
  }
};

/**
 * Download and store opportunity research file
 */
const downloadAndStoreOpportunityResearch = async (researchId, requestId, companyName, contactName, accountId, contactId, tenantId) => {
  try {

    // Download file from ResearchBy.ai
    const response = await axios.get(
      `${RESEARCH_BY_AI_CONFIG.baseURL}/api/research/download/${requestId}`,
      {
        headers: RESEARCH_BY_AI_CONFIG.headers,
        responseType: 'arraybuffer'
      }
    );

    // Generate file name and path
    const fileName = `opportunity-${researchId}-${requestId}.docx`;
    const filePath = `crm-research/opportunity/${fileName}`;
    const fullPath = path.join(process.cwd(), 'public/files', filePath);

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Save file
    fs.writeFileSync(fullPath, response.data);

    // Update database with file information
    const fileInfo = {
      file_path: filePath,
      file_name: fileName,
      download_url: `/api/files/${filePath}`,
      file_size: response.data.length,
      completed_at: new Date().toISOString()
    };

    await pool.query(
      `UPDATE crm_research 
       SET research_data = jsonb_set(
         research_data, 
         '{opportunity, file_info}', 
         $1::jsonb
       )
       WHERE id = $2`,
      [JSON.stringify(fileInfo), researchId]
    );


    // Also update the main file path column
    await pool.query(
      'UPDATE crm_research SET opportunity_research_file = $1 WHERE id = $2',
      [filePath, researchId]
    );

  } catch (error) {
    console.error(`❌ Error downloading opportunity research file:`, error);
    throw error;
  }
};

/**
 * Create research directories
 */
const createResearchDirectories = async (researchId) => {
  try {
    const baseDir = path.join(process.cwd(), 'public/files', FILE_STORAGE_CONFIG.basePath);
    const companyDir = path.join(baseDir, FILE_STORAGE_CONFIG.companyPath);
    const contactDir = path.join(baseDir, FILE_STORAGE_CONFIG.contactPath);
    const opportunityDir = path.join(baseDir, FILE_STORAGE_CONFIG.opportunityPath);

    // Create directories if they don't exist
    [baseDir, companyDir, contactDir, opportunityDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

  } catch (error) {
    console.error(`❌ Error creating research directories:`, error);
    throw error;
  }
};

/**
 * Update research progress
 */
const updateResearchProgress = async (researchId, progress, status) => {
  try {
    await pool.query(
      'UPDATE crm_research SET progress = $1, status = $2, updated_at = NOW() WHERE id = $3',
      [progress, status, researchId]
    );
  } catch (error) {
    console.error(`❌ Error updating research progress:`, error);
  }
};

/**
 * Clear incomplete research records (utility function)
 */
exports.clearIncompleteResearch = async (req, res) => {
  try {
    const { opportunityId, tenantId } = req.params;

    // Find and delete incomplete research records
    const result = await pool.query(
      `DELETE FROM crm_research 
       WHERE opportunity_id = $1 
       AND tenant_id = $2 
       AND (research_data->>'company_research_id' IS NULL 
            OR research_data->>'contact_research_id' IS NULL
            OR status = 'error')`,
      [opportunityId, tenantId]
    );


    res.json({
      success: true,
      message: `Cleared ${result.rowCount} incomplete research records`,
      data: { cleared_count: result.rowCount }
    });

  } catch (error) {
    console.error("❌ Error clearing incomplete research:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear incomplete research",
      error: error.message
    });
  }
};

module.exports = exports;
