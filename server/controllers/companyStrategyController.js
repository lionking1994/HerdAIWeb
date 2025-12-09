const pool = require("../config/database");
const { handleError } = require("../utils/errorHandler");
const dotenv = require("dotenv");
const { processAI, test_prompt } = require("../utils/llmservice");
const Prompt = require("../models/Prompt");

const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const { sendEmail } = require("../utils/email");
dotenv.config();

// Add the sendEmail function

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION,
});
// Get all strategies for a company (exclude deleted)
exports.getStrategies = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { year } = req.query;

    const query = `
            SELECT 
                cs.id,
                cs.strategy,
                cs.created_at,
                cs.updated_at,
                c.name as company_name
            FROM company_strategies cs
            JOIN company c ON c.id = cs.company_id
            WHERE cs.company_id = $1 
            AND cs.is_deleted = false
            AND EXTRACT(YEAR FROM cs.created_at) = $2
            ORDER BY cs.created_at DESC
        `;
    const result = await pool.query(query, [companyId, year]);

    res.status(200).json({
      success: true,
      strategies: result.rows,
    });
  } catch (error) {
    return handleError(res, error, "Failed to get strategies");
  }
};

// Create a new strategy (exclude deleted)
exports.createStrategy = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { strategy } = req.body;

    // Validate input
    if (!strategy) {
      return res.status(400).json({
        success: false,
        error: "Strategy is required",
      });
    }

    const query = `
            INSERT INTO company_strategies (
                company_id,
                strategy,
                created_at,
                updated_at
            ) VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING 
                id,
                strategy,
                created_at,
                updated_at
        `;
    const result = await pool.query(query, [companyId, strategy]);

    res.status(201).json({
      success: true,
      strategy: result.rows[0],
    });
  } catch (error) {
    return handleError(res, error, "Failed to create strategy");
  }
};

// Update a strategy (exclude deleted)
exports.updateStrategy = async (req, res) => {
  const { id } = req.params;
  const { strategy } = req.body;

  try {
    // Check if trying to edit a past year

    const query = `
            UPDATE company_strategies
            SET strategy = $1
            WHERE id = $2
            RETURNING *
        `;

    const result = await pool.query(query, [strategy, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Strategy not found",
      });
    }

    res.status(200).json({
      success: true,
      strategy: result.rows[0],
    });
  } catch (error) {
    return handleError(res, error, "Failed to update strategy");
  }
};

// Delete a strategy (soft delete)
exports.deleteStrategy = async (req, res) => {
  const { id } = req.params;

  try {
    // First get the strategy to check its year
    const checkQuery = "SELECT created_at FROM company_strategies WHERE id = $1";
    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Strategy not found",
      });
    }

    const strategyYear = parseInt(checkResult.rows[0].created_at.getFullYear());
    const currentYear = new Date().getFullYear();

    if (strategyYear < currentYear) {
      return res.status(403).json({
        success: false,
        message: "Cannot delete strategies from past years",
      });
    }

    const deleteQuery = "DELETE FROM company_strategies WHERE id = $1";
    await pool.query(deleteQuery, [id]);

    res.status(200).json({
      success: true,
      message: "Strategy deleted successfully",
    });
  } catch (error) {
    return handleError(res, error, "Failed to delete strategy");
  }
};

const score_meeting1 = async (meeting_id) => {
  try {
    // Get company strategies based on meeting organizer's company and meeting details
    const query = `
            SELECT 
                cs.id,
                cs.strategy,
                cs.created_at,
                cs.updated_at,
                c.name as company_name
            FROM meetings m
            JOIN users u ON m.org_id = u.id
            JOIN company c ON SPLIT_PART(u.email, '@', 2) = c.domain
            JOIN company_strategies cs ON cs.company_id = c.id
            WHERE m.id = $1 
            AND cs.is_deleted = false
            ORDER BY cs.created_at DESC
        `;

    const companyStrategiesResult = await pool.query(query, [meeting_id]);


    const meetingTranscriptionResult = await pool.query(
      `SELECT transcription_link, summary, title as meeting_title FROM meetings WHERE id = $1`,
      [meeting_id]
    );



    // if (companyStrategiesResult.rows.length === 0) {
    //   return {
    //     success: false,
    //     message: "No strategies found for this meeting's company",
    //   };
    // }
    /*
        const bedrockParams = {
            modelId: "anthropic.claude-v2",
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify({
                prompt: `\n\nHuman: Analyze this meeting and return ONLY a JSON object with no additional text or explanation:

Meeting Details:
Company Strategies:
${companyStrategiesResult.rows.map((row, index) => `${index + 1}. ${row.strategy}`).join('\n')}

Meeting Title: ${meetingTranscriptionResult.rows[0].meeting_title}
Meeting Transcript: ${meetingTranscriptionResult.rows[0].transcription_link}

Required JSON format:
{
  "score": <number 0-100>,
  "explanation": "<overall explanation>",
  "strategy_analysis": [
    {
      "strategy": "<strategy text>",
      "alignment_points": ["<point1>", "<point2>"],
      "misalignment_points": ["<point1>", "<point2>"]
    }
  ]
}\n\nAssistant:`,
                max_tokens_to_sample: 1024,
                temperature: 0.7,
                anthropic_version: "bedrock-2023-05-31",
            }),
        };

        const command = new InvokeModelCommand(bedrockParams);
        const response = await bedrockClient.send(command);
        const completion = JSON.parse(new TextDecoder().decode(response.body));
        */


    /*

    I want a logo at the top of email 
    Logo link is https://herdai.s3.us-east-1.amazonaws.com/assets/images/herd_email_logo.webp

    */

    const sysprompt = `Analyze this meeting.`;
    const userprompt = `
    Provide a score between 1-100 for this meeting and its alignment to these objectives:
    Analyze this meeting and return ONLY a JSON object with no additional text or explanation:

        Meeting Details:
        Company Strategies:
        ${companyStrategiesResult.rows
        .map((row, index) => `${index + 1}. ${row.strategy}`)
        .join("\n")}
        
        Meeting Title: ${meetingTranscriptionResult.rows[0].meeting_title}
        Meeting Transcript: ${meetingTranscriptionResult.rows[0].transcription_link
      }
        
        Required JSON format:
        {
          "score": <number 0-100>,
          "explanation": "<overall explanation>",
          "strategy_analysis": [
            {
              "strategy": "<strategy text>",
              "alignment_points": ["<point1>", "<point2>"],
              "misalignment_points": ["<point1>", "<point2>"]
            }
          ]
        }`;
    const responsetext = await processAI(sysprompt, userprompt, 2028);

    // Extract and parse JSON
    let parsedData;
    try {
      // Remove any potential markdown or text before/after JSON
      const jsonStr = responsetext
        .replace(/^[^{]*/g, "")
        .replace(/[^}]*$/g, "");
      parsedData = JSON.parse(jsonStr);
    } catch (error) {
      console.error("Error parsing JSON response:", error);
      throw new Error("Failed to parse strategy analysis");
    }

    const queryUpdateMeeting = `update meetings set strategy_score = $1, strategy_explanation = $2, strategy_analysis = $3 where id = $4`;

    await pool.query(queryUpdateMeeting, [
      parsedData.score,
      parsedData.explanation,
      JSON.stringify(parsedData.strategy_analysis),
      meeting_id,
    ]);
    /*
    meetingParticipantsResult has all user information such as name and email
    */

    const meetingParticipantsQuery = 'SELECT * FROM meeting_participants JOIN users ON meeting_participants.user_id = users.id WHERE meeting_id = $1';
    const meetingParticipantsResult = await pool.query(meetingParticipantsQuery, [meeting_id]);

    meetingParticipantsResult.rows.forEach(async (participant) => {
      const userQuery = 'SELECT * FROM users WHERE id = $1';
      const userResult = await pool.query(userQuery, [participant.user_id]);
      const user = userResult.rows[0];

      // Get a small summary only if there's a summary available
      let summaryContent = '';
      if (meetingTranscriptionResult.rows[0].summary) {
        summaryContent = meetingTranscriptionResult.rows[0].summary;
        // const smallSummary = await processAI("Summarize this meeting summary in 300 words. IMPORTANT: Return ONLY the summary content itself with NO introduction, NO prefix, and NO phrases like 'Here is a summary' or 'summary of the meeting'. Start directly with the content.", meetingTranscriptionResult.rows[0].summary, 300);
        // summaryContent = smallSummary;
      }

      const emailSubject = `Herd Activity Overview - ${meetingTranscriptionResult.rows[0].meeting_title}`;
      const emailBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
            .header { text-align: center; padding: 20px; background: linear-gradient(to right, #f8f9fa, #e9ecef); }
            .logo { margin-bottom: 10px; }
            .score { font-size: 24px; font-weight: bold; margin-bottom: 20px; }
            .score-value {
              display: inline-block;
              color: ${parsedData.score >= 70 ? '#28a745' : parsedData.score >= 40 ? '#ffc107' : '#dc3545'}; 
            }
            .content { padding: 30px; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            h2 { color: #1B73E8; margin-top: 30px; font-size: 24px; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; }
            .summary { background: #f8f9fa; padding: 20px; border-left: 4px solid #1B73E8; margin: 20px 0; border-radius: 4px; white-space: pre-wrap;}
            .participants { list-style: none; padding: 0; }
            .participants li { padding: 10px; border-bottom: 1px solid #eee; }
            .cta-button { display: inline-block; padding: 12px 24px; background: #1B73E8; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .cta-button:hover { background: #1557b0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .meeting-title { font-size: 22px; font-weight: bold; margin: 15px 0 5px 0; }
            .meeting-date { font-size: 14px; color: #666; margin-bottom: 20px; }
            .section-divider { border-top: 1px solid #e0e0e0; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="https://herdai.s3.us-east-1.amazonaws.com/assets/images/herd_email_logo.webp" alt="Herd AI" width="120" class="logo" />
            <div class="score">Score: <span class="score-value">${summaryContent ? parsedData.score : 0} %</span></div>
          </div>
          <div class="content">
            <div class="meeting-title">${meetingTranscriptionResult.rows[0].meeting_title}</div>
            <div class="meeting-date">Date: ${new Date(meetingTranscriptionResult.rows[0].datetime || Date.now()).toLocaleString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
        timeZoneName: 'short'
      })}</div>
            <div class="section-divider"></div>
            
            ${summaryContent ? `
              <h2>Executive Summary</h2>
              <div class="summary">
                ${summaryContent}
              </div>
            ` : ''}
            
            <h2>Meeting Participants</h2>
            <ul class="participants">
              ${meetingParticipantsResult.rows.map(participant =>
        `<li>${participant.name} <br><small style="color: #666">${participant.email} • ${participant.phone}</small></li>`
      ).join('')}
            </ul>

            <center>
              <a href="${process.env.FRONTEND_URL}/meeting-detail?id=${meeting_id}" class="cta-button">View Full Meeting Details</a>
            </center>
          </div>
          <div class="footer">
            <p>This email was sent by Herd AI. Please do not reply to this email.</p>
          </div>
        </body>
        </html>
      `;
      await sendEmail({
        to: user.email,
        subject: emailSubject,
        html: emailBody,
      });
    });

    return {
      success: true,
      score: meetingTranscriptionResult.rows[0].summary && meetingTranscriptionResult.rows[0].transcription_link ? parsedData.score : 0,
      explanation: parsedData.explanation,
      strategy_analysis: parsedData.strategy_analysis,
    };
  } catch (error) {
    console.error("Error in score_meeting:", error);
    throw new Error("Failed to get company strategies for meeting");
  }
};

// Function to score a meeting based on company strategies (exclude deleted)
exports.score_meeting = score_meeting1;

exports.scoreMeeting = async (req, res) => {
  const { meetingId } = req.body;
  try {
    const result = await score_meeting1(meetingId);

    return res.status(200).json({
      success: true,
      message: result.message,
      score: result.score,
      explanation: result.explanation,
      strategy_analysis: result.strategy_analysis,
    });
  } catch (error) {
    console.error("Error in scoreMeeting:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate meeting score",
    });
  }
};

// Get available years for strategy
exports.getAvailableYears = async (req, res) => {
  try {
    const { companyId } = req.params;
    const query = `
            SELECT 
                EXTRACT(YEAR FROM created_at) as year
            FROM company_strategies 
            WHERE company_id = $1 
            AND is_deleted = false
            GROUP BY year
            ORDER BY year DESC
        `;
    const result = await pool.query(query, [companyId]);

    // Extract years from the result
    const years = result.rows.map((row) => row.year.toString());

    res.status(200).json({
      success: true,
      years: years.sort((a, b) => b - a),
    });
  } catch (error) {
    return handleError(res, error, "Failed to get available years");
  }
};


exports.score_agenda = async (meeting_id) => {

  try {
    const meetingQuery = `
      SELECT m.id, m.title, m.schedule_datetime, m.schedule_duration, m.description,
      STRING_AGG(u.name, ', ') AS participants
      FROM meetings m
      INNER JOIN meeting_participants mp ON m.id = mp.meeting_id
      INNER JOIN users u ON mp.user_id = u.id
      WHERE m.id = $1
      GROUP BY m.id, m.title, m.schedule_datetime, m.schedule_duration, m.description
      ORDER BY m.schedule_datetime DESC
    `;

    const meetingResult = await pool.query(meetingQuery, [meeting_id]);
    const meeting = meetingResult.rows[0];

    if (!meeting) {
      return
    }

    const sysprompt = `Evaluate meeting agenda without using the transcription.`;
    const userprompt = `
Evaluate the quality of the meeting agenda based on the following details. Do NOT use any transcription or summary.

Meeting Details:
Title: ${meeting.title}
Date/Time: ${meeting.schedule_datetime}
Attendees: [${meeting.participants}]
Duration: ${meeting.schedule_duration || "Not provided"} minutes
Description: ${meeting.description || ""}

Agenda Evaluation Criteria:
- Are the right people present in the meeting?
- Is the title descriptive and clear?
- Are the objectives, discussion points, or action items implied or clearly stated?
- Is the duration reasonable for the agenda?

Provide a JSON response in this exact format:
{
  "agenda_score": <number from 0 to 100>,
  "agenda_reason": "<brief explanation of the agenda score>"
}
    `;

    const responseText = await processAI(sysprompt, userprompt, 1024);

    let parsedData;
    try {
      const jsonStr = responseText.replace(/^[^{]*/g, '').replace(/[^}]*$/g, '');
      parsedData = JSON.parse(jsonStr);
    } catch (error) {
      console.error('Error parsing agenda score JSON:', error);
      return
    }

    const updateQuery = `
      UPDATE meetings
      SET agenda_score = $1, agenda_reason = $2
      WHERE id = $3
    `;

    await pool.query(updateQuery, [
      parsedData.agenda_score,
      parsedData.agenda_reason,
      meeting_id,
    ]);

    return {
      success: true,
      agenda_score: parsedData.agenda_score,
      agenda_reason: parsedData.agenda_reason,
    };

  } catch (err) {
    console.error('Error in score_agenda:', err);
  }
};


const intelligence_graph1 = async (meeting_id) => {
  try {
    const validateTemplate = `
    SELECT
    m.*,
      u.id AS organizer_UserId,
      u.company_role AS company_roleId,
      r.company_id
    FROM meetings m
    JOIN users u ON
      (m.org_id IS NOT NULL AND m.org_id = u.id)
      OR
      (m.org_id IS NULL AND u.id = (
        SELECT user_id
        FROM meeting_participants
        WHERE meeting_id = m.id
        ORDER BY 
          CASE WHEN role = 'organizer' THEN 0 ELSE 1 END
        LIMIT 1
      ))
    JOIN company_roles r ON u.company_role = r.id
    WHERE m.id = $1
  `;
    console.log("👺👺👺, 1");
    const organizerDetails = await pool.query(validateTemplate, [meeting_id]);
    const companyId = organizerDetails.rows[0]?.company_id;
    const meetingSummary = organizerDetails.rows[0]?.summary;
    console.log("👺👺👺, 2");
    if (!companyId) {
      const queryUpdateJson = `
      UPDATE meetings 
      SET interactive_node_graph_json = $1, interactive_message = $2 
      WHERE id = $3
      `;
      const result = await pool.query(queryUpdateJson, [null, "we can't process this meeting, it does not match a intelligence template", [meeting_id]]);
      return {
        success: true,
        graph_data: null,
        graph_message: "we can't process this meeting, it does not match a intelligence template"
      }
    }

    const getTemplateDetail = `SELECT * FROM Templates WHERE company_id = $1`;
    const templateResult = await pool.query(getTemplateDetail, [companyId]);
    const templates = templateResult.rows;
    console.log("👺👺👺, 3");
    if (!templates || templates.length === 0) {
      await pool.query(`
        UPDATE meetings 
        SET interactive_node_graph_json = $1, interactive_message = $2 
        WHERE id = $3
      `, [null, "we can't process this meeting, it does not match a intelligence template", meeting_id]);
      return {
        success: true,
        graph_data: null,
        graph_message: "we can't process this meeting, it does not match a intelligence template"
      }
    }
    console.log("👺👺👺, 4");
    const templateSelectionSysPrompt = `
    You are an AI assistant that selects the best template for a meeting.
    Each company has templates for types of meetings like sales, marketing, support, etc.
    Given a meeting summary and template list, return only the ID of the most relevant template.
    If no template fits well, return a reason as one sentence.
    `;
    const templateSelectionUserPrompt = `
      Meeting Summary:
      "${meetingSummary}"

      Available Templates:
      ${templates.filter(t => t.category != "executive_summary" && t.category != "task").map(t => `ID: ${t.id}, Name: ${t.name}, Category: ${t.category || 'N/A'}, Description: ${t.description || 'N/A'}`).join("\n")}

      Respond with ONLY the Template ID (number only) if matched, or the reason as one sentence if nothing fits.
      Do not include any explanation, text, or formatting if the Template ID
      `;
    console.log("👺👺👺, 5");
    // const selectedTemplateIdRaw = await processAI(templateSelectionSysPrompt, templateSelectionUserPrompt, 1024);
    // const selectedTemplateId = selectedTemplateIdRaw.trim().toLowerCase() === 'none' ? null : parseInt(selectedTemplateIdRaw.trim());
    const modelQueryselettemplate = await pool.query(
      `SELECT ac.provider, acm.model
   FROM api_configurations ac
   JOIN api_config_models acm ON ac.id = acm.config_id
   WHERE acm.id = $1`,
      [1]
    );
    const provider_t = modelQueryselettemplate.rows[0]?.provider;
    const model_t = modelQueryselettemplate.rows[0]?.model;
    const selectedTemplateIdRaw = await test_prompt(
      templateSelectionSysPrompt,
      templateSelectionUserPrompt,
      2048,
      provider_t,
      model_t
    );
    console.log("selected", templateSelectionUserPrompt, selectedTemplateIdRaw);
    const rawValue = String(selectedTemplateIdRaw?.preview || selectedTemplateIdRaw || "").trim().toLowerCase();
    const selectedTemplateId = (isNaN(parseInt(rawValue, 10)) ? null : parseInt(rawValue, 10));
    console.log("👺👺👺, 6");
    if (!selectedTemplateId || !templates.some(t => t.id === selectedTemplateId)) {
      await pool.query(`
      UPDATE meetings 
      SET interactive_node_graph_json = $1, interactive_message = $2 
      WHERE id = $3
    `, [null, `we can't process this meeting, it does not match a intelligence template. ${rawValue}`, meeting_id]);
      return {
        success: true,
        graph_data: null,
        graph_message: `we can't process this meeting, it does not match a intelligence template. ${rawValue}`
      }
    }
    console.log("👺👺👺, 7");
    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
    const meetingQuery = `
     SELECT 
  m.id, 
  m.title, 
  m.schedule_datetime, 
  m.schedule_duration, 
  m.description,
  m.transcription_link,
  json_agg(
    json_build_object(
      'name', u.name,
      'email', u.email,
      'phone', u.phone,
      'company_name', c.name,
      'role', r.name,
      'participant_id', u.id
    )
  ) AS participants
FROM meetings m
LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
LEFT JOIN users u ON mp.user_id = u.id
LEFT JOIN company_roles r ON u.company_role = r.id
LEFT Join company c ON r.company_id = c.id
WHERE m.id = $1
GROUP BY m.id
    `;
    const meetingResult = await pool.query(meetingQuery, [meeting_id]);
    const meeting = meetingResult.rows[0];

    const transcriptPayload = {
      meeting_transcript: {
        meeting_id: meeting.id,
        title: meeting.title,
        date: meeting.schedule_datetime,
        duration: meeting.schedule_duration,
        description: meeting.description,
        participants: meeting.participants,
        meetingtranscriptionText: meeting.transcription_link
      }
    };

    const sysprompt = `You are an expert meeting analysis assistant. Your job is to extract structured knowledge from meeting transcripts and convert them into a JSON-based interactive knowledge graph. The graph includes key people, companies, central themes, and how they relate to one another.`;

    const userprompt = `
Based on the following meeting transcript JSON, extract key people, companies, themes, and relationships. Then generate a knowledge graph in the specified JSON format below. 

Meeting details JSON:
${JSON.stringify(transcriptPayload)}

Meeting Participants Information:
${meeting.participants.map((participant, index) =>
      `${index + 1}. ${participant.name} (${participant.email}) - ${participant.role || 'No role'} at ${participant.company_name || 'Unknown company'}`
    ).join('\n')}

Your task:
${selectedTemplate?.prompt}

Important: When creating person nodes, use the participant information provided above to ensure accurate identification and include relevant contact details when appropriate.

Output format:
{
  "graph_data": {
    "visualization": {
      "style": {
        "nodeTextColor": "black",
        "nodeTextPosition": "inside",
        "cleanProfessional": true,
        "responsive": true
      },
      "nodes": [
        {
          "id": "unique_node_id",
          "email": "email",
          "phone": "phone",
          "company_name": "company_name",
          "role": "role",
          "participant_id": "participant_id",
          "label": "Display Name",
          "group": "central_theme",
          "color": "#fb923c" 
        },
        {
          "id": "unique_node_id",
          "email": "email",
          "phone": "phone",
          "company_name": "company_name",
          "role": "role",
          "participant_id": "participant_id",
          "label": "Display Name",
          "group": "person",
          "color": "#a855f7"
        },
        {
         "id": "unique_node_id",
          "email": "email",
          "phone": "phone",
          "company_name": "company_name",
          "role": "role",
          "participant_id": "participant_id",
          "label": "Display Name",
          "group": "company",
          "color": "#3b82f6"
        },
        {
         "id": "unique_node_id",
          "email": "email",
          "phone": "phone",
          "company_name": "company_name",
          "role": "role",
          "participant_id": "participant_id",
          "label": "Display Name",
          "group": "opportunity",
          "color": "#22c55e"
        }
      ],
      "edges": [
        {
          "from": "node_id_1",
          "to": "node_id_2",
          "label": "relationship description",
          "thickness": 1 | 2 | 3
        }
      ]
    }
  }
}

Only respond with the full JSON. Do not add extra commentary or explanation.
    `;
    console.log("👺👺👺, 8", userprompt);

    const modelId = selectedTemplate.platform || 1
    const modelQuery = await pool.query(
      `SELECT ac.provider, acm.model
   FROM api_configurations ac
   JOIN api_config_models acm ON ac.id = acm.config_id
   WHERE acm.id = $1`,
      [modelId]
    );
    const { provider, model } = modelQuery.rows[0];
    const responseText = await test_prompt(
      sysprompt,
      userprompt,
      4096,
      provider,
      model
    );
    //const responseText = await processAI(sysprompt, userprompt, 2048);
    console.log("👺👺👺, 9,", responseText);
    let graphData;
    try {
      const cleaned = responseText?.preview.replace(/^[^{]+/, '').replace(/[^}]+$/, '');
      graphData = JSON.parse(cleaned);
      const queryUpdateJson = `
      UPDATE meetings 
      SET interactive_node_graph_json = $1, interactive_message = $2 , template_id=$3
      WHERE id = $4
      `;
      const result = await pool.query(queryUpdateJson, [graphData, null, selectedTemplateId, meeting_id]);
    } catch (err) {
      console.error('Failed to parse graph data JSON:', err);
      return { success: false, error: 'Invalid AI JSON output' };
    }

    monitorNodeTrigger(graphData, meeting_id);

    return {
      success: true,
      graph_data: graphData.graph_data,
      graph_message: null
    };

  } catch (err) {
    console.error('Error in intelligence_graph:', err);
    return { success: false, error: 'Internal server error' };
  }
};
exports.intelligence_graph = intelligence_graph1;

exports.intelligencegraph = async (req, res) => {
  const { meetingId } = req.body;
  if (!meetingId) {
    return res.status(400).json({
      success: false,
      error: "meetingId is required in request body",
    });
  }
  try {
    const result = await intelligence_graph1(meetingId);
    if (!result || !result.success) {
      return res.status(200).json({
        success: false,
        error: result?.error || "Failed to process meeting",
        graph_data: result.graph_data,
        graph_message: result.graph_message,
      });
    }
    return res.status(200).json({
      success: true,
      graph_data: result.graph_data,
      graph_message: result.graph_message,
    });
  } catch (error) {
    console.error("Error in scoreMeeting:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate meeting score",
    });
  }
};

const participant_value_analysis1 = async (meeting_id) => {
  try {
    const meetingQuery = `
      SELECT
        m.id AS meeting_id,
        m.transcription_link,
        json_agg(
          json_build_object(
            'participant_user_id', u.id,
            'participant_name', u.name,
            'participant_email', u.email
          ) ORDER BY u.id
        ) AS participants
      FROM meetings m
      JOIN meeting_participants mp 
        ON m.id = mp.meeting_id
      JOIN users u 
        ON mp.user_id = u.id
      WHERE m.id = $1
      GROUP BY 
        m.id, 
        m.transcription_link;
    `;
    const { rows } = await pool.query(meetingQuery, [meeting_id]);
    const meeting = rows[0];
    if (!meeting) {
      throw new Error("Meeting not found");
    }
    const sysprompt = `You are an AI assistant that analyzes meeting transcripts to evaluate the impact and value of each participant. Your task is to assess how each participant contributed to the meeting's objectives and overall success.`;
    const userpromt = `
      Analyze the following meeting transcript and participants to determine the impact and value of each participant. Return the results in the specified JSON format below.
      Meeting Transcript text: 
      ${meeting.transcription_link}
      Participants:
      ${JSON.stringify(meeting.participants)}
      Required output JSON format:
      {
        "participants": [
          {
            "participant_user_id": "<user_id>",
            "participant_name": "<name>",
            "participant_email": "<email>",
            "value": <number 0-5>,
            "evidence": "<1-2 sentences from the transcript showing their impact>"
          }
        ]
      }
        Only respond with the full JSON. Do not add extra commentary or explanation.
      `
    const responseText = await processAI(sysprompt, userpromt, 2048);
    let graphData;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON object found in AI response");
      graphData = JSON.parse(jsonMatch[0]);
      for (const participant of graphData.participants) {
        await pool.query(
          `UPDATE meeting_participants
           SET impact_value_score = $1, impact_score_evidence = $2
           WHERE user_id = $3 AND meeting_id = $4`,
          [participant.value, participant.evidence, participant.participant_user_id, meeting_id]
        );
      }
    } catch (err) {
      console.error('Failed to parse graph data JSON:', err);
      return { success: false, error: 'Invalid AI JSON output' };
    }
    return { success: true, message: "Participant value analysis complete" };
  } catch (error) {
    console.error("Error in participant_value_analysis:", error.message);
    return { success: false, message: "Internal server error" };
  }
};


exports.participant_value_analysis = participant_value_analysis1;

exports.participantvalueanalysis = async (req, res) => {
  const { meetingId } = req.body;
  if (!meetingId) {
    return res.status(400).json({
      success: false,
      error: "meetingId is required in request body",
    });
  }
  try {
    const result = await participant_value_analysis1(meetingId);
    if (!result || !result.success) {
      return res.status(200).json({
        success: false,
        error: result?.error || "Failed to process meeting",
      });
    }
    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error("Error in scoreMeeting:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate meeting score",
    });
  }
};



const monitorNodeTrigger = async (data, meetingId) => {
  try {
    console.log("👺👺👺, monitorNodeTrigger", data);
    //Find workflow and get name on workflow_node and workflow_workflow joinging what have node trigger
    const workflowQuery = `
    SELECT w.name as workflow_name FROM workflow_nodes wn
    JOIN workflow_workflows w ON wn.workflow_id = w.id
    WHERE wn.type = 'triggerNode'
  `;
    const workflowResult = await pool.query(workflowQuery);
    //I need to avoid duplicated workflow id
    const workflowNames = workflowResult.rows.map(workflow => workflow.workflow_name);
    const uniqueWorkflowNames = [...new Set(workflowNames)];

    console.log(`${process.env.API_URL}/workflow/webhook`);

    uniqueWorkflowNames.forEach((workflowName) => {
      fetch(`${process.env.API_URL}/workflow/webhook`, {
        method: 'POST',
        body: JSON.stringify({
          workflowName: workflowName,
          basic_data: { ...data, meeting_id: meetingId }
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }).then(res => res.json()).then(data => {
        console.log("👺👺👺, data", data);
      }).catch(err => {
        console.error("Error in monitorNodeTrigger:", err.message);
      })
    })
    console.log("👺👺👺, uniqueWorkflowNames", uniqueWorkflowNames);
  } catch (error) {
    console.error("Error in monitorNodeTrigger:", error.message);
    return { success: false, message: "Internal server error" };
  }
}

const opportunities_stages_update1 = async (emails, companyId, emailBody, emailSubject, user_id) => {
  try {
    if (!emails || !companyId) {
      return { success: false, error: `${emails} || ${companyId}  not found` };
    }

    //check with emaile body i have create new opportunity
    createOpportunityFromEmail(emails, companyId, emailBody, emailSubject, user_id)

    // 1️⃣ Fetch provider/model configuration
    const modelQuerys = await pool.query(`
      SELECT ac.provider, acm.model
      FROM api_configurations ac
      JOIN api_config_models acm ON ac.id = acm.config_id
      WHERE acm.id = $1
    `, [1]);

    // 2️⃣ Fetch opportunity details
    const opportunityDetails = await pool.query(`
      SELECT
          o.id AS opportunity_id,
          o.name AS opportunity_name,
          o.description AS opportunity_description,
          o.stage AS opportunity_stage,
          o.stage_id AS opportunity_stage_id,
          os.name AS stage_name,
          os.description AS stage_description,
          os.created_at AS stage_created_at,
          os.updated_at AS stage_updated_at,
          o.tenant_id AS company_id,
          o.reason,
          JSON_AGG(c.id) AS contact_ids,
          JSON_AGG(CONCAT(c.first_name, ' ', c.last_name)) AS contact_names,
          JSON_AGG(c.email) AS contact_emails
      FROM contacts c
      JOIN opportunity_contacts oc ON c.id = oc.contact_id
      JOIN opportunities o ON oc.opportunity_id = o.id
      JOIN public.opportunity_stages os ON o.stage_id = os.id
      WHERE c.email = ANY($1)
      GROUP BY
          o.id, o.name, o.description, o.stage, o.stage_id,
          os.name, os.description, os.created_at, os.updated_at, o.tenant_id, o.reason;
    `, [emails]);

    const opportunity = opportunityDetails.rows;
    if (!opportunity) return { success: false, error: 'Opportunity not found' };

    // 3️⃣ Fetch all stages
    const allStages = await pool.query(`
      SELECT * FROM public.opportunity_stages 
      WHERE tenant_id = $1
    `, [companyId]);

    const provider_t = modelQuerys.rows[0]?.provider;
    const model_t = modelQuerys.rows[0]?.model;

    // 4️⃣ Prepare prompts
    const sysPrompt = `
You are an AI assistant that analyzes email content to decide if a sales opportunity should move forward, move backward, or remain in the same stage.
You consider tone, intent, and keywords from the email (e.g., negotiation, interest, delay, rejection, close).
You always explain your reasoning clearly and choose the most suitable stage transition.
`;

    const userPrompt = `
You are given the following information:

1. Email Subject:
${emailSubject}

2. Email content:
${emailBody}

3. Related opportunities (JSON):
${JSON.stringify(opportunityDetails.rows)}

4. All available sales stages (JSON):
${JSON.stringify(allStages.rows)}

Your task:
- Analyze the email content to understand its intent.
- Based on this, decide if each opportunity should:
   a) Move forward (upgrade),
   b) Move backward (downgrade), or
   c) Remain in the same stage.
- For each opportunity, return your decision in array JSON format as follows:

[
  {
    "opportunity_id": "<id>",
    "action": "upgrade" | "downgrade" | "no_change",
    "target_stage_id": "<stage_id>",
    "target_stage_name": "<stage_name>",
    "reason": "<20-50 words only>"
  }
]

Important: Respond ONLY with array JSON. Do NOT include any extra text or explanation.
`;

    const responseText = await test_prompt(sysPrompt, userPrompt, 2048, provider_t, model_t);
    // 6️⃣ Process AI JSON output
    let graphData;
    try {
      const cleaned = responseText?.preview?.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim() || "[]";

      let parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) {
        parsed = [parsed];
      }
      graphData = parsed;

      if (Array.isArray(graphData)) {
        for (const opp of graphData) {
          if (opp.action == 'no_change') {
            continue;
          }
          else {
            // Get the current stage of the opportunity
            const currentStage = await pool.query(
              'SELECT stage_id FROM opportunities WHERE id = $1',
              [opp.opportunity_id]
            );
            const fromStageId = currentStage.rows[0]?.stage_id || null;

            // ✅ Corrected placeholders and parameters
            await pool.query(
              `UPDATE opportunities
       SET stage_id = $1,
           stage = $2,
           updated_at = NOW(),
           updated_by = $3,
           reason = $4
       WHERE id = $5`,
              [opp.target_stage_id, opp.target_stage_name, user_id, opp.reason, opp.opportunity_id]
            );

            // ✅ Insert into history table
            await pool.query(
              `INSERT INTO opportunity_stage_history (
        opportunity_id, stage_id, from_stage_id, entered_at, tenant_id, created_by, reason
      ) VALUES ($1, $2, $3, NOW(), $4, $5, $6)
      RETURNING *`,
              [
                opp.opportunity_id,
                opp.target_stage_id,
                fromStageId,
                companyId,
                user_id,
                opp.reason
              ]
            );
          }

        }
      } else {
        console.error('Parsed data is not an array:', graphData);
        return { success: false, error: 'Expected JSON array of opportunities' };
      }

      return { success: true, graph_data: graphData };
    } catch (err) {
      console.error('Failed to parse graph data JSON:', err);
      return { success: false, error: 'Invalid AI JSON output' };
    }
  } catch (err) {
    console.error('Error in opportunities_stages_update1:', err);
    return { success: false, error: err.message };
  }
};

// ✅ Export
exports.opportunities_stages_update = opportunities_stages_update1;

// ✅ Controller
exports.opportunitiesstagesupdate = async (req, res) => {
  const { emails, companyId, emailBody, emailSubject } = req.body;
  if (!emails || !companyId || !emailBody || !emailSubject) {
    return res.status(400).json({
      success: false,
      error: `${emails} | ${companyId} not found`,
    });
  }
  try {
    const result = await opportunities_stages_update1(emails, companyId, emailBody, emailSubject);
    if (!result?.success) {
      return res.status(200).json({
        success: false,
        error: result?.error || "Failed to process opportunity",
      });
    }
    return res.status(200).json({
      success: true,
      node_json: result.graph_data,
    });
  } catch (error) {
    console.error("Error in opportunity node:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate opportunity node",
    });
  }
};

// Core logic for generating AI graph from email_messages
const email_intelligence_graph1 = async (emailId, user_id) => {
  try {
    // Fetch email and sender company info

    const companyIdResult = await pool.query(`
  SELECT r.company_id 
  FROM users u 
  JOIN company_roles r ON u.company_role = r.id
  WHERE u.id = $1
`, [user_id]);

    const companyId = companyIdResult.rows[0]?.company_id;

    if (!companyId) {
      return {
        success: false,
        graph_data: null,
        graph_message: "We can't process this email: sender's company not found"
      };
    }

    const emailQuery = `
    SELECT 
      e.*
    FROM email_messages e
    WHERE e.id = $1
    `;
    const emailResult = await pool.query(emailQuery, [emailId]);
    const email = emailResult.rows[0];

    if (!email) {
      return {
        success: false,
        graph_data: null,
        graph_message: "We can't process this email: sender's company not found"
      };
    }

    const templateResult = await pool.query(`SELECT * FROM Templates WHERE company_id = $1 AND category = 'email_processing'`, [companyId]);
    const templates = templateResult.rows;

    if (!templates || templates.length === 0) {
      await pool.query(`
        UPDATE email_messages 
        SET node_graph_json = $1, template_message = $2
        WHERE id = $3
      `, [null, "No templates available "], emailId);
      return {
        success: false,
        graph_data: null,
        graph_message: "No templates available"
      };
    }

    // 3️⃣ AI Template Selection
    const templateSelectionSysPrompt = `
      You are an AI assistant that selects the best template for an email processing.
      Each company has templates for types of email processing like sales, marketing, support, etc.
      Given an email subject, email body, and template list, return ONLY the ID of the most relevant template.
      If no template fits well, return a reason as one sentence.
    `;

    const emailBodyText = email.body
      ? email.body
        .replace(/<[^>]*>/g, ' ')  // saare HTML tags hatao
        .replace(/\s+/g, ' ')      // extra spaces hatao
        .trim()
      : 'No Body';
    const templateSelectionUserPrompt = `
Email Subject: "${email.subject || 'No Subject'}"
Email Body: ${emailBodyText || 'No Body'}

Available Templates:
${templates.map(t => `ID: ${t.id}, Name: ${t.name}, Category: ${t.category || 'N/A'}, Description: ${t.description || 'N/A'}`).join("\n")}

Select the most relevant template ID based on subject and body.
If no template exactly fits, select the closest one.
Respond ONLY with the Template ID (number only).
`;

    const modelQueryselettemplate = await pool.query(`
      SELECT ac.provider, acm.model
      FROM api_configurations ac
      JOIN api_config_models acm ON ac.id = acm.config_id
      WHERE acm.id = $1
    `, [1]);

    const provider_t = modelQueryselettemplate.rows[0]?.provider;
    const model_t = modelQueryselettemplate.rows[0]?.model;

    const selectedTemplateIdRaw = await test_prompt(
      templateSelectionSysPrompt,
      templateSelectionUserPrompt,
      2048,
      provider_t,
      model_t
    );

    const rawValue = String(selectedTemplateIdRaw?.preview || selectedTemplateIdRaw || "").trim().toLowerCase();
    const selectedTemplateId = (isNaN(parseInt(rawValue, 10)) ? null : parseInt(rawValue, 10));

    if (!selectedTemplateId || !templates.some(t => t.id === selectedTemplateId)) {
      await pool.query(`
        UPDATE email_messages 
        SET node_graph_json = $1, template_message = $2
        WHERE id = $3
      `, [null, `No matching template found. ${rawValue}`, emailId]);
      return {
        success: false,
        graph_data: null,
        graph_message: `No matching template found. ${rawValue}`
      };
    }

    try {

      let emails = [];
      emails.push(email.sender);
      if (Array.isArray(email.to_recipients)) emails.push(...email.to_recipients);
      if (Array.isArray(email.cc_recipients)) emails.push(...email.cc_recipients);

      opportunities_stages_update1(emails, companyId, emailBodyText, email.subject, user_id)
    } catch (err) {
      console.log('Error updating opportunity stages', err)
      return

    }

    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

    const modelId = selectedTemplate.platform || 1
    const modelQuery = await pool.query(
      `SELECT ac.provider, acm.model
   FROM api_configurations ac
   JOIN api_config_models acm ON ac.id = acm.config_id
   WHERE acm.id = $1`,
      [modelId]
    );
    const { provider, model } = modelQuery.rows[0];
    // 4️⃣ Prepare AI graph input
    const transcriptPayload = {
      email: {
        subject: email.subject,
        body: email.body || null,
        sender: email.sender,
        to_recipients: email.to_recipients,
        cc_recipients: email.cc_recipients,
        received_at: email.received_at,
      }
    };

    const sysprompt = `You are an expert email analysis assistant. Extract structured knowledge from this email and create a JSON interactive knowledge graph with nodes and relationships.`;

    const userprompt = `
Email Details:
${JSON.stringify(transcriptPayload)}

Your task:
${selectedTemplate?.prompt}

Output Format (JSON):
{
  "graph_data": {
    "visualization": {
      "style": {
        "nodeTextColor": "black",
        "nodeTextPosition": "inside",
        "cleanProfessional": true,
        "responsive": true
      },
      "nodes": [
        {
          "id": "unique_node_id",
          "email": "email",
          "phone": "phone",
          "company_name": "company_name",
          "role": "role",
          "label": "Display Name",
          "group": "person",
          "color": "#a855f7"
        },
        {
          "id": "unique_node_id",
          "company_name": "company_name",
          "label": "Company Name",
          "group": "company",
          "color": "#3b82f6"
        }
      ],
      "edges": [
        {
          "from": "node_id_1",
          "to": "node_id_2",
          "label": "relationship description",
          "thickness": 1
        }
      ]
    }
  }
}

Important: Respond ONLY with JSON. Do NOT include any extra text or explanation.
`;

    const responseText = await test_prompt(sysprompt, userprompt, 4096, provider, model);

    let graphData;
    try {
      const cleaned = responseText?.preview?.replace(/^[^{]+/, '').replace(/[^}]+$/, '') || "{}";
      graphData = JSON.parse(cleaned);

      await pool.query(`
        UPDATE email_messages
        SET node_graph_json = $1, template_message = $2, template_id = $3
        WHERE id = $4
      `, [graphData, email.template_message || null, selectedTemplateId, emailId]);

    } catch (err) {
      console.error('Failed to parse AI JSON output:', err);
      return { success: false, error: 'Invalid AI JSON output' };
    }
    return {
      success: true,
      graph_data: graphData.graph_data,
      graph_message: null,
      template_name: selectedTemplate.name,
      template_id: selectedTemplateId,
    };

  } catch (err) {
    console.error('Error in email_intelligence_graph1:', err);
    return { success: false, error: 'Internal server error' };
  }
};
exports.email_intelligence_graph = email_intelligence_graph1;

// Express.js endpoint wrapper
exports.email_intelligencegraph = async (req, res) => {
  const { emailId } = req.body;
  if (!emailId) {
    return res.status(400).json({
      success: false,
      error: "emailId is required in request body",
    });
  }
  try {
    const result = await email_intelligence_graph1(emailId, req.user.id);
    if (!result || !result.success) {
      return res.status(200).json({
        success: false,
        error: result?.error || "Failed to process email",
        graph_data: result?.graph_data,
        graph_message: result?.graph_message,
        template_name: null,
        template_id: null
      });
    }
    return res.status(200).json({
      success: true,
      graph_data: result.graph_data,
      graph_message: result.graph_message,
      template_name: result?.template_name,
      template_id: result?.template_id
    });
  } catch (error) {
    console.error("Error in email_intelligencegraph endpoint:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to process email",
    });
  }
};

const createOpportunityFromEmail = async (emails, companyId, emailBody, emailSubject, user_id) => {
  try {

    if (!emails || !companyId) {
      return { success: false, error: `${emails} || ${companyId}  not found` };
    }

    const getExistingAllOpp = await pool.query(`select name, description from opportunities where tenant_id=$1`, [companyId])
    const opportunitiesData= getExistingAllOpp.rows
    // check new opp crete or not
    const systemPromptCheckOpp = `You are a sales opportunity analyst. 
Determine if the following email describes a **new opportunity** compared to the list of existing opportunities. 
Respond **ONLY** with "YES" or "NO". Do **not** include any explanations, reasons, or extra text.
`;

    // 3. Prepare user prompt
    const userPromptCheckOpp = `
Email Subject:
${emailSubject}

Email Body:
${emailBody}

Existing Opportunities (JSON):
${JSON.stringify(opportunitiesData)}

`;

    // 4. Fetch provider and model
    const modelQueryCheckOpp = await pool.query(`
  SELECT ac.provider, acm.model
  FROM api_configurations ac
  JOIN api_config_models acm ON ac.id = acm.config_id
  WHERE acm.id = $1
`, [1]);

    const providerCheckOpp = modelQueryCheckOpp.rows[0]?.provider;
    const modelCheckOpp = modelQueryCheckOpp.rows[0]?.model;

    // 5. Make AI call
    const responseTextCheckOpp = await test_prompt(
      systemPromptCheckOpp,
      userPromptCheckOpp,
      1024,
      providerCheckOpp,
      modelCheckOpp
    );

    if (responseTextCheckOpp?.preview == 'YES') {

      const accountDetails = await pool.query(
        `SELECT id, name FROM accounts WHERE tenant_id = $1`,
        [companyId]);

      const stageDetails = await pool.query(
        `SELECT id, name FROM opportunity_stages WHERE tenant_id = $1`,
        [companyId]);

      const accounts = accountDetails.rows;
      const stages = stageDetails.rows;

      const accountList = accounts.map(a => `${a.id}: ${a.name}`).join("\n");
      const stageList = stages.map(s => `${s.id}: ${s.name}`).join("\n");

      const userPrompt = `
    You are an assistant that evaluates sales opportunities from email details.

    Email Details:
  - Subject: ${emailSubject}
  - Body: ${emailBody}
  

    Accounts Details:
    ${accountList}

    Opportunity Stage Details:
    ${stageList}

     Tasks:
  1. Choose the most relevant **account (id and name)**.
  2. Choose the most suitable **opportunity stage (id and name)**.
  3. Suggest a clear **opportunity name** and **description** based on the email.

     Output Format (JSON):
    {
      "account_id": id,
      "account_name": "Example Corp",
      "stage_id": id,
      "stage_name": "Qualification",
      "opportunity_name": "New Opportunity from Example Corp",
      "opportunity_description": "Opportunity related to Zoom connector proposal"
    }
      Important: Respond ONLY with JSON. Do NOT include any extra text or explanation.
     `;


      const modelQueryselettemplate = await pool.query(`
      SELECT ac.provider, acm.model
      FROM api_configurations ac
      JOIN api_config_models acm ON ac.id = acm.config_id
      WHERE acm.id = $1
    `, [1]);

      const provider = modelQueryselettemplate.rows[0]?.provider;
      const model = modelQueryselettemplate.rows[0]?.model;

      const aiResponseText = await test_prompt(null, userPrompt, 4096, provider, model);
      let result;
      // Remove any trailing notes after the JSON object
      const cleaned = aiResponseText?.preview?.replace(/^[^{]+/, '').replace(/[^}]+$/, '') || "{}";
      result = JSON.parse(cleaned);

      if (result) {
        const insertQuery = `
    INSERT INTO opportunities 
    (name, description, stage, stage_id, account_id, created_at, created_by, tenant_id, owner_id)
    VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8)
    RETURNING id;
  `;

        const values = [
          result.opportunity_name,
          result.opportunity_description,
          result.stage_name,
          result.stage_id,
          result.account_id,
          user_id,
          companyId,
          user_id
        ];

        const newOppRes = await pool.query(insertQuery, values);
        console.log("✅ New Opportunity Created:", newOppRes.rows[0]);
        const newOppData = newOppRes.rows[0];

        // Opportunity_history

        // Get creator user details
        const userDetailsRes = await pool.query(`SELECT * FROM users WHERE id = $1`, [user_id]);
        const userDetails = userDetailsRes.rows[0];

        // Filter out the creator's email
        const contactEmails = emails.filter(email => email !== userDetails.email);

        for (const email of contactEmails) {
          const contactRes = await pool.query(`SELECT * FROM contacts WHERE email = $1`, [email]);
          const contact = contactRes.rows[0];

          if (contact) { // only insert if contact exists
            await pool.query(
              `INSERT INTO opportunity_contacts (opportunity_id, contact_id, role, created_at, tenant_id) 
         VALUES ($1, $2, $3, NOW(), $4)`,
              [newOppData.id, contact.id, "Team Member", companyId]
            );
          } else {
            console.log(`⚠️ Contact not found for email: ${email}`);
          }
        }
      }
    }

  }
  catch (err) {
    console.error("Error creating opportunity:", err);
    throw err;
  }
};


exports.monitorNodeTrigger = monitorNodeTrigger;