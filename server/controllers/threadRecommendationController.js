const { processAI } = require("../utils/llmservice");
const pool = require("../config/database");
// const openai = require('openai');

exports.getThreadRecommendation = async (req, res) => {
  try {
    const { task_id, threadMessage } = req.body;

    if (!threadMessage) {
      return res.status(400).json({
        success: false,
        message: "Thread message is required",
      });
    }

    const thread_list = await pool.query(
      `SELECT * FROM task_threads WHERE task_id = $1`,
      [task_id]
    );

    const workflow_list = await pool.query(`SELECT
    ww.* 
  FROM
    workflow_workflows ww
    JOIN tasks t ON t.id = $1
    JOIN users u ON t.owner_id = u."id"
    JOIN company C ON SPLIT_PART( u.email, '@', 2 ) = C.DOMAIN 
  WHERE
    ww.is_active IS TRUE 
    AND C.ID = ww.company_id`, [task_id]);
    // Prepare the prompt for the LLM
    // const prompt = `Based on this comment: "${threadMessage}", what would you recommend as a next step / action (help me with a task, do research or schedule a meeting)`;

    let workflow_names = workflow_list.rows.map((workflow) => {
      return workflow.name;
    });
    console.log("workflow_names", workflow_names);
    const validRecommendations = [
      "Help with task",
      "Do research",
      "Schedule meeting",
      ...workflow_names,
    ];
    console.log("validRecommendations", validRecommendations);
    const prompt = `Analyze the following conversation and choose the next step/action.

    Conversation: "${thread_list.rows.map((thread) => {
      return thread.task_message;
    })}",
    The last comment is "${threadMessage}".
    The last comment is crucial in deciding the next step/action, and if it is ambiguous, you can leave it blank.
    
    Please select one of the following Action : 
    ${validRecommendations.map((validRecommendation) => {
      return ` - ${validRecommendation}`;
    })}`;

    console.log("prompt", prompt);

    let recommendation = await processAI(
      `You are a helpful assistant that provides concise recommendations based on message content. Respond with only one of these options: ${validRecommendations.map(
        (validRecommendation) => {
          return ` - ${validRecommendation}`;
        }
      )}`,
      prompt,
      50
    );
    console.log("recommendation", recommendation);

    // Ensure the recommendation is one of the three expected values
    if (
      !validRecommendations.some((valid) =>
        recommendation.toLowerCase().includes(valid.toLowerCase())
      )
    ) {
      recommendation = validRecommendations[0]; // Default to first option if unexpected response
    } else {
      validRecommendations.map((valid) => {
        if (recommendation.toLowerCase().includes(valid.toLowerCase()))
          recommendation = valid;
      });
    }

    return res.status(200).json({
      success: true,
      recommendation,
    });
  } catch (error) {
    console.error("Error generating thread recommendation:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate recommendation",
      error: error.message,
    });
  }
};
