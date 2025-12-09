const Prompt = require("../models/Prompt");
const Meeting = require("../models/Meeting");
const pool = require("../config/database");
const { processAIWithModel, outputType1 } = require("../utils/llmservice");

exports.updatePrompt = async (req, res) => {
  const {
    prompt_title,
    prompt_content,
    modelId,
    maxTokens,
    previewContent,
    meeting,
  } = req.body;

  const userId = req.user.id;
  try {
    // Validate required fields
    if (
      !prompt_title ||
      !prompt_content ||
      !modelId ||
      !maxTokens ||
      !previewContent ||
      !meeting
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }

    // Parse and validate modelId
    const modelIdInt = parseInt(modelId, 10);
    if (isNaN(modelIdInt)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid modelId: must be a number" });
    }

    // Validate maxTokens
    const maxTokensInt = parseInt(maxTokens, 10);
    if (isNaN(maxTokensInt)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid maxTokens: must be a number" });
    }

    // Update Prompt
    const updatedPrompt = await Prompt.update(
      prompt_title,
      prompt_content,
      modelIdInt,
      maxTokensInt
    );
    let updatedMeeting;
    let updatedTask;

    const modelQuery = await pool.query(
      `SELECT ac.provider, acm.model
   FROM api_configurations ac
   JOIN api_config_models acm ON ac.id = acm.config_id
   WHERE acm.id = $1`,
      [modelIdInt]
    );

    if (modelQuery.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Model not found",
      });
    }
    const { provider, model } = modelQuery.rows[0];

    if (prompt_title === "executive_summary") {
      // Update Meeting with new summary
      updatedMeeting = await Meeting.update({
        ...meeting,
        summary: previewContent,
      });

      await pool.query(
        "UPDATE meetings SET api_by_summary = $1 WHERE id = $2",
        [`${provider}/${model}`, meeting.id]
      );
    } else if (prompt_title === "task") {
      updatedTask = await updateTasks(
        previewContent,
        meeting.id,
        provider,
        model,
        userId
      );
    }

    return res.status(200).json({
      success: true,
      prompt: updatedPrompt,
      meeting: updatedMeeting || null,
      tasks: updatedTask?.success ? updatedTask.tasks : null,
    });
  } catch (error) {
    console.error("Error updating prompt:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to update prompt",
    });
  }
};

exports.getPrompt = async (req, res) => {
  const { prompt_title } = req.params;
  const userId = req.user.id;

  try {
    // Get user's company ID using helper function
    const { getCompanyIdFromUserId } = require("../utils/companyHelper");
    const companyId = await getCompanyIdFromUserId(userId);

    // Import the prompt selector utility
    const { getPromptForCategory } = require("../utils/promptSelector");

    // Get prompt configuration (company template or platform default)
    const promptConfig = await getPromptForCategory(prompt_title, companyId);

    // Log which prompt source is being used
    console.log(
      `Using prompt source: ${promptConfig.source} for company ${companyId} in prompt retrieval`
    );

    res.status(200).json({
      success: true,
      prompt: promptConfig.promptContent,
      modelId: promptConfig.modelId,
      maxtokens: promptConfig.maxtokens,
      // Include source information for the frontend
      promptSource: {
        source: promptConfig.source,
        templateId: promptConfig.templateId || null,
        templateName: promptConfig.templateName || null,
        model: promptConfig.model,
        provider: promptConfig.provider,
      },
    });
  } catch (error) {
    console.error("Error getting prompt:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get prompt",
    });
  }
};

// Test a prompt against a selected provider/model
exports.testPrompt = async (req, res) => {
  try {
    const { systemPrompt, userPrompt, provider, model, max_tokens } = req.body;

    if (!userPrompt || !provider || !model) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: userPrompt, provider, model",
      });
    }

    const output_type = await outputType1(userPrompt);
    const sysprompt =
      systemPrompt ||
      `
      You are a helpful assistant that processes prompts and generates appropriate responses.
      Follow these guidelines:
      1. Provide clear, concise, and relevant responses
      2. If the prompt asks for specific formatting, follow it exactly
      3. If the prompt contains data to be processed, analyze and respond appropriately
      4. Be helpful and accurate in your responses
      5. If you're unsure about something, say so rather than guessing
      6. Do not add any content other than what is requested.
`;
    const maxTokens = Number.isFinite(Number(max_tokens))
      ? Number(max_tokens)
      : 4000;

      console.log("outputType-----", output_type?.result);
    const aiResponse = await processAIWithModel(
      sysprompt,
      userPrompt,
      maxTokens,
      provider,
      model,
      output_type?.result
    );

    console.log("not sure of last result",typeof aiResponse, aiResponse )
    // aiResponse can be either an object {result, resultType} or an error string
    if (typeof aiResponse === "string") {
      return res.status(200).json({ success: false, error: aiResponse, output_type: output_type?.result });
    }

    return res.status(200).json({ success: true, ...aiResponse, output_type : output_type?.result });
  } catch (error) {
    console.error("Error testing prompt:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to test prompt" });
  }
};

const updateTasks = async (tasks, meetingId, provider, model, userId) => {
  // Save tasks to database
  try {
    // Delete all previous tasks for this meeting only once
    await pool.query("DELETE FROM tasks WHERE meeting_id = $1", [meetingId]);

    const savedTasks = await Promise.all(
      tasks.map(async (task) => {
        // Validate timestamp before insertion
        const dueDate =
          task.dueDate instanceof Date && !isNaN(task.dueDate)
            ? task.dueDate
            : null;

        const savedTask = await pool.query(
          "INSERT INTO tasks (meeting_id, title, description, duedate, assigned_id, average_time, category, status, owner_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
          [
            meetingId,
            task.title,
            task.description,
            dueDate,
            task.assigned_id,
            task.average_time,
            task.category,
            task.assigned_id ? "Assigned" : "Pending",
            userId,
          ]
        );
        await pool.query(
          "UPDATE meetings SET api_by_tasks = $1 WHERE id = $2",
          [`${provider}/${model}`, meetingId]
        );

        if (task.assigned_id) {
          const assigned_user = (
            await pool.query("SELECT * FROM users WHERE id = $1", [
              task.assigned_id,
            ])
          ).rows[0];

          const meeting = (
            await pool.query("SELECT * FROM meetings WHERE id = $1", [
              meetingId,
            ])
          ).rows[0];

          const meeting_owner = (
            await pool.query("SELECT * FROM users WHERE id = $1", [
              meeting.org_id,
            ])
          ).rows[0];

          const message = `${meeting_owner.name} invite you on task '${task.title}' of meeting '${meeting.title}'`;

          savedTask.rows[0].assigned_name = assigned_user.name;
        }

        return savedTask.rows[0];
      })
    );

    return {
      success: true,
      tasks: savedTasks,
      meetingId: meetingId,
    };
  } catch (dbError) {
    console.error("Error saving tasks to database:", dbError);
    return {
      success: false,
      error: "Failed to save tasks to database",
    };
  }
};

// const outputType1 = async (prompt) => {
//   // const { prompt } = req.body;
//   try {
//     const system_prompt = 
//     `we have to analysis the output type such as : pdf, csv, ppt, txt, img.  
//      Provide answer only one of these word. 
//      Sample : pdf`;
//      const maxTokens = 4000;
//     console.log("prompt", prompt)
//     const aiResponse = await processAIWithModel(
//       system_prompt,
//       prompt,
//       maxTokens,
//       'openai',
//       'gpt-4',
//       'txt'
//     );
//     console.log("----------", aiResponse);
//     // aiResponse can be either an object {result, resultType} or an error string
//     if (typeof aiResponse === "string") {
//       return { success: false, error: aiResponse };
//     }

//     switch(aiResponse.result)
//     {
//       case 'pdf':
//       case 'ppt':
//       case 'txt':
//       case 'img':
//       case 'csv':
//       return { success: true, ...aiResponse };

//     }

//     } catch (error) {
//       console.error("Error Output type:", error);
//       return { success: false, error: "Failed to Output type" };
//     }
// };

exports.outputType = async (req, res) => {
  const {prompt} = req.body;
  const result = await outputType1(prompt);
  res
  .status(200).json(result);
}
