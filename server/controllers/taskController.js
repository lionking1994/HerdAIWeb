const pool = require("../config/database");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");
const { sendNotification } = require("../utils/socket"); // Adjust the path as necessary
const { sendEmail } = require("../utils/email");
const { processAI, test_prompt } = require("../utils/llmservice");
const fs = require("fs");
const removeMd = require("remove-markdown");
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const Prompt = require("../models/Prompt");
const axios = require("axios");
dotenv.config();

// Add the sendEmail function

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION,
});

// Centralized error handling function
const handleError = (res, error, message) => {
  console.error(message, error);
  return res.status(500).json({
    success: false,
    error: message,
  });
};

const sendKestrahook = (data) => {
  // Configure headers
  const headers = {
    Authorization: "Bearer zxczxc12311",
    "Content-Type": "application/json",
  };

  // Make POST request
  axios
    .post(
      "http://52.71.47.162:8080/api/v1/executions/webhook/getherd_team/getherd_task/getherd_task_2025",
      data,
      { headers }
    )
    .then((response) => {
      console.log("Response:", response.data);
    })
    .catch((error) => {
      console.error("Error:", error.message);
    });
};

exports.generateTasks = async (req, res) => {
  const { transcription, meetingId } = req.body;

  const tasks = await exports.generateTasksInside(transcription, meetingId);
  res.status(tasks.status).json({
    success: tasks.success,
    tasks: tasks.tasks,
    meetingId: meetingId,
  });
};

exports.searchSimilarTasks = async (req, res) => {
  try {
    const { title, description, limit = 3 } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    const company = await pool.query(
      `SELECT *
      FROM company
      WHERE domain = SPLIT_PART($1, '@', 2)
      `,
      [userEmail]
    );
    const companyId = company.rows[0].id;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title or description is required",
      });
    }

    const thresholdQuery = await pool.query(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'threshold'`
    );
    const threshold =
      thresholdQuery.rows.length > 0
        ? parseInt(thresholdQuery.rows[0].setting_value) / 100
        : 0; // Convert percentage to decimal

    const similarTasksQuery = await pool.query(
      `
      WITH user_company AS (
        SELECT SPLIT_PART(email, '@', 2) as domain
        FROM users
        WHERE id = $1
      ),
      similarity_scores AS (
        SELECT
          t.id,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.rate,
          t.review,
          u.name as assignee_name,
          u.id as assignee_id,
          u.email as assignee_email,
          u.bio as assignee_bio,
          u.avatar as assignee_avatar,
          u.phone as assignee_phone,
          u.location as assignee_location,
          c.name as company_name,
          c.domain as company_domain,
          m.title as meeting_title,
          (
            similarity(COALESCE(t.title, ''), $2::text) +
            similarity(COALESCE(t.description, ''), $3::text)
          ) / 2 as match_score
        FROM tasks t
        LEFT JOIN users u ON t.assigned_id = u.id
        LEFT JOIN meetings m ON t.meeting_id = m.id
        LEFT JOIN company c ON SPLIT_PART(u.email, '@', 2) = c.domain
        JOIN user_company uc ON SPLIT_PART(u.email, '@', 2) = uc.domain
        WHERE t.status IN ('Completed', 'Rated')
          AND t.isdeleted = false
          ${companyId ? "AND c.id = $5" : ""}
      )
      SELECT *
      FROM similarity_scores
      WHERE match_score >= $4
      ORDER BY match_score DESC
      LIMIT $6
    `,
      companyId
        ? [userId, title || "", description || "", threshold, companyId, limit]
        : [userId, title || "", description || "", threshold, limit]
    );

    const formattedTasks = similarTasksQuery.rows.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      rate: task.rate,
      review: task.review,
      assigneeId: task.assignee_id,
      assigneeName: task.assignee_name,
      assigneeEmail: task.assignee_email,
      assigneeBio: task.assignee_bio,
      assigneeAvatar: task.assignee_avatar,
      assigneePhone: task.assignee_phone,
      assigneeLocation: task.assignee_location,
      companyName: task.company_name,
      companyDomain: task.company_domain,
      meetingTitle: task.meeting_title,
      similarity: (Number(task.match_score) * 100).toFixed(1), // Convert to percentage
      matchScore: task.match_score,
    }));

    res.json({
      success: true,
      tasks: formattedTasks,
    });
  } catch (error) {
    console.error("Error searching similar tasks:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search similar tasks",
    });
  }
};

exports.generateTasksInside = async (transcription, meetingId, user_id) => {
  try {
    // Get user's company ID using helper function
    const { getCompanyIdFromUserId } = require("../utils/companyHelper");
    const companyId = await getCompanyIdFromUserId(user_id);

    const category_result = await pool.query("SELECT * FROM categories");
    
    // Import the prompt selector utility
    const { getPromptForCategory } = require("../utils/promptSelector");
    
    // Get prompt configuration (company template or platform default)
    const promptConfig = await getPromptForCategory("task", companyId);
    
    const userprompt = `
      Based on the following meeting transcription, generate a list of actionable tasks.
      Current timestamp: ${new Date().toISOString()}
      Please estimate the average number of days for this task based on a busy executive schedule.
      Also estimate the actual hours of focused work required to complete the task (can be fractional, e.g., 2.5).

      Please format the response as a JSON object with a "tasks" array containing task objects.
      Each task object should have these properties:
      {
        "title": "Brief, actionable task title",
        "description": "Detailed description of what needs to be done",
        "dueDate":  "dueDate YYYY-MM-DD format, calculate holidays, rest days, and weekends. if not, null",
        "assigned_id": "Name of the person assigned to this task",
        "category": "Category of the task, Select categories among these ${category_result.rows
        .map((category) => category.category_name)
        .join(", ")}",
        "average_time": "Average time to complete the task in days and not calculate holidays, rest days, and weekends. if not, 0",
        "estimated_hours": "Estimated actual hours of focused work required to complete the task (can be fractional, e.g., 2.5)"
      }

      Meeting Transcription:
      ${transcription}
    `;

    // Use the prompt configuration from template or platform default
    const {
      promptContent: sysprompt,
      maxtokens,
      apiKey,
      modelId,
      provider,
      source
    } = promptConfig;

    // Log which prompt source is being used
    console.log(`Using prompt source: ${source} for company ${companyId} in task generation`);

    const system_prompt = `${sysprompt}
    Current timestamp: ${new Date().toISOString()}
    Categories :sales,
    marketing,
    business development,
    product development,
    e&d,
    personal objective,
    company objective,
    consulting,
    other`;
    
    const response = await test_prompt(
      system_prompt,
      transcription,
      maxtokens,
      provider,
      promptConfig.model
    );
    if (response.status === false) {
      return {
        status: 500,
        success: false,
        error: "test_prompt failed",
      };
    }
    let completion = response.preview;
    // preview = await jsonContentProvider(response.preview, meeting);

    const jsonMatch = completion.match(/```json\n([\s\S]*?)\n```/);

    let jsonContent;

    if (jsonMatch) {
      jsonContent = JSON.parse(jsonMatch[1]);
    } else {
      // Otherwise try to find JSON object directly in the completion
      const jsonStart = completion.indexOf("{");
      const jsonEnd = completion.lastIndexOf("}") + 1;
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const jsonStr = completion.slice(jsonStart, jsonEnd);
        jsonContent = JSON.parse(jsonStr);
      } else {
        // If no feedback data, return empty array
        jsonContent = [];
      }
    }

    // const completion = await processAI(sysprompt, userprompt, 2048);
    // // Extract just the JSON content from the response
    // const jsonMatch = completion.match(/```json\n([\s\S]*?)\n```/);
    // console.log("jsonMatch", jsonMatch);
    // let jsonContent;
    // console.log('completion', completion);
    // if (jsonMatch) {
    //   jsonContent = JSON.parse(jsonMatch[1]);
    // } else {
    //   // Otherwise try to find JSON object directly in the completion
    //   const jsonStart = completion.indexOf("{");
    //   const jsonEnd = completion.lastIndexOf("}") + 1;
    //   if (jsonStart >= 0 && jsonEnd > jsonStart) {
    //     const jsonStr = completion.slice(jsonStart, jsonEnd);
    //     jsonContent = JSON.parse(jsonStr);
    //   } else {
    //     // If no feedback data, return empty array
    //     jsonContent = [];
    //   }
    // }

    // console.log("Parsed JSON:", jsonContent);

    let tasks;
    let meeting_participants;
    try {
      tasks = jsonContent.tasks; // Extract the tasks array from the response object

      // Get meeting participants
      const participantsResult = await pool.query(
        "SELECT users.id, users.name FROM meeting_participants JOIN users ON meeting_participants.user_id = users.id WHERE meeting_participants.meeting_id = $1",
        [meetingId]
      );
      meeting_participants = participantsResult.rows;

      const { rows: meetingResult } = await pool.query(
        "SELECT m.*, u.name as org_name FROM meetings m JOIN users u ON u.id = m.org_id WHERE m.id = $1", [meetingId]
      );
      // Validate and clean tasks before database insertion
      tasks = tasks.map((task) => ({
        ...task,
        title: String(task.title).slice(0, 255),
        description: String(task.description).slice(0, 1000),
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
        average_time: task.average_time ? parseInt(task.average_time) : 1,
        estimated_hours: task.estimated_hours
          ? parseFloat(task.estimated_hours)
          : null,
        assigned_id: task.assigned_id
          ? meeting_participants.find((participant) =>
            String(participant.name?.toLowerCase()).includes(
              task.assigned_id?.toLowerCase()
            )
          )?.id
          : null,
        category: task.category,
        owner_id: meetingResult[0].org_id,
        owner_name: meetingResult[0].org_name
      }));
    } catch (parseError) {
      console.error("Error parsing Bedrock response:", parseError);
      return {
        status: 500,
        success: false,
        error: "Failed to parse generated tasks",
        rawResponse: completion.completion,
      };
    }

    // Save tasks to database
    try {
      const savedTasks = await Promise.all(
        tasks.map(async (task) => {
          // Validate timestamp before insertion
          const dueDate =
            task.dueDate instanceof Date && !isNaN(task.dueDate)
              ? task.dueDate
              : null;
          const savedTask = await pool.query(
            "INSERT INTO tasks (meeting_id, title, description, duedate, assigned_id, average_time, estimated_hours, category, status, owner_id, owner_name ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *",
            [
              meetingId,
              task.title,
              task.description,
              dueDate,
              task.assigned_id,
              task.average_time || 0,
              task.estimated_hours || 0,
              task.category,
              task.assigned_id ? "Assigned" : "Pending",
              task.owner_id,
              task.owner_name
            ]
          );
          await pool.query(
            "UPDATE meetings SET api_by_tasks = $1 WHERE id = $2",
            [`${provider}/${promptConfig.model}`, meetingId]
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
            // await pool.query(
            //   'INSERT INTO notifications (user_id, checked, notification, deleted, link, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            //   [assigned_user.id, false, message, false, `/task-details?id=${savedTask.rows[0].id}`, new Date()]
            // );
            // await sendEmail({
            //   to: assigned_user.email,
            //   subject: 'You have been assigned a Task',
            //   html: `
            //     <h2>Welcome to Herd AI!</h2>
            //     <p>You have been assigned a Task</p>
            //     <p>View Task Details</p>
            //     <a href="${process.env.FRONTEND_URL}/task-details?id=${savedTask.rows[0].id}">View Task Details</a>
            //     <p>Thank You, Herd AI Team!</p>
            //   `
            // });
            // sendNotification({ id: assigned_user.id, message: 'You have been assigned a Task' })
            savedTask.rows[0].assigned_name = assigned_user.name;
          }
          const score_result = await score_tasks1(savedTask.rows[0].id);
          if (score_result.success) {
            await pool.query(
              "UPDATE tasks SET alignment_score = $1, alignment_reason = $2 WHERE id = $3",
              [score_result.score, score_result.reason, savedTask.rows[0].id]
            );
          }
          return savedTask.rows[0];
        })
      );

      return {
        status: 200,
        success: true,
        tasks: savedTasks,
        meetingId: meetingId,
      };
    } catch (dbError) {
      console.error("Error saving tasks to database:", dbError);
      return {
        status: 500,
        success: false,
        error: "Failed to save tasks to database",
      };
    }
  } catch (error) {
    return {
      status: 500,
      success: false,
      error: "Failed to generate tasks",
    };
  }
};

const jsonContentProvider = async (completion, meeting) => {
  const jsonMatch = completion.match(/```json\n([\s\S]*?)\n```/);

  let jsonContent;

  if (jsonMatch) {
    jsonContent = JSON.parse(jsonMatch[1]);
  } else {
    // Otherwise try to find JSON object directly in the completion
    const jsonStart = completion.indexOf("{");
    const jsonEnd = completion.lastIndexOf("}") + 1;
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      const jsonStr = completion.slice(jsonStart, jsonEnd);
      jsonContent = JSON.parse(jsonStr);
    } else {
      // If no feedback data, return empty array
      jsonContent = [];
    }
  }

  let tasks;
  let meeting_participants;
  let meetingId = meeting.id;
  try {
    tasks = jsonContent.tasks; // Extract the tasks array from the response object

    // Get meeting participants
    const participantsResult = await pool.query(
      "SELECT users.id, users.name FROM meeting_participants JOIN users ON meeting_participants.user_id = users.id WHERE meeting_participants.meeting_id = $1",
      [meetingId]
    );
    meeting_participants = participantsResult.rows;

    // Validate and clean tasks before database insertion
    tasks = tasks.map((task) => ({
      ...task,
      title: String(task.title).slice(0, 255),
      description: String(task.description).slice(0, 1000),
      dueDate: task.dueDate ? new Date(task.dueDate) : null,
      average_time: task.average_time ? parseInt(task.average_time) : 1,
      assigned_name: task.assigned_id,
      assigned_id: task.assigned_id
        ? meeting_participants.find((participant) =>
          String(participant.name?.toLowerCase()).includes(
            task.assigned_id?.toLowerCase()
          )
        )?.id
          ? meeting_participants.find((participant) =>
            String(participant.name?.toLowerCase()).includes(
              task.assigned_id?.toLowerCase()
            )
          )?.id
          : null
        : null,
      category: task.category,
    }));
    return tasks;
  } catch (parseError) {
    console.error("Error parsing Bedrock response:", parseError);
    return res.status(500).json({
      success: false,
      error: "Failed to parse generated tasks",
      rawResponse: completion.completion,
    });
  }
};

exports.createTask = async (req, res) => {
  const {
    meetingId,
    title,
    description,
    dueDate,
    priority,
    assigned_id,
    assigned_email,
    average_time,
    estimated_hours,
  } = req.body;
  const userId = req.user.id;
  const userName = req.user.name;

  // console.log(meetingId, title, description, dueDate, assignee, priority, status)
  try {
    // Validate inputs
    if (!title || !description || !priority) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    let assigned_user = (
      await pool.query("SELECT * FROM users WHERE id = $1", [assigned_id])
    ).rows[0];
    const category_result = await pool.query("SELECT * FROM categories");
    const userprompt = `
    Based on the following meeting title and description, generate a list of categories for the task.
    Current timestamp: ${new Date().toISOString()}

    Please format the must response as a JSON object  containing properties .
    The JSONobject should have these properties:
    {
      "category": "Category of the task, Select categories among these ${category_result.rows
        .map((category) => category.category_name)
        .join(", ")}, output format is 'a,b,c,d'",
      "average_time": "Average time to complete the task in days and not calculate holidays, rest days, and weekends. if not, 0",
      "estimated_hours": "Estimated actual hours of focused work required to complete the task (can be fractional, e.g., 2.5)"
    }

    Meeting title:
    ${title}
    Meeting description:
    ${description}
  `;
    const sysprompt = `Generate a JSON Object including category, average_time, estimated_hours based on the meeting title and description.`;
    /*
    const bedrockParams = {
      modelId: "anthropic.claude-v2",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        prompt: `\n\nHuman: ${prompt}\n\nAssistant: Let me generate that task list in JSON format.`,
        max_tokens_to_sample: 1024,
        temperature: 0.7,
        anthropic_version: "bedrock-2023-05-31",
      }),
    };
    console.log("bedrockParams", bedrockParams);
    const command = new InvokeModelCommand(bedrockParams);
    console.log("command", command);
    const response = await bedrockClient.send(command);
    console.log("response", response);
    const completion = JSON.parse(new TextDecoder().decode(response.body));
    console.log("completion", completion);
*/

    const completion = await processAI(sysprompt, userprompt, 2048);
    // Extract just the JSON content from the response
    const jsonMatch = completion.match(/```json\n([\s\S]*?)\n```/);

    let jsonContent;

    if (jsonMatch) {
      jsonContent = JSON.parse(jsonMatch[1]);
    } else {
      // Otherwise try to find JSON object directly in the completion
      const jsonStart = completion.indexOf("{");
      const jsonEnd = completion.lastIndexOf("}") + 1;
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const jsonStr = completion.slice(jsonStart, jsonEnd);
        jsonContent = JSON.parse(jsonStr);
      } else {
        // If no feedback data, return empty array
        jsonContent = [];
      }
    }

    console.log("create-task-jsonContent", jsonContent);
    // Save task to database
    const result = await pool.query(
      "INSERT INTO tasks (meeting_id, title, description, duedate, assigned_id, assigned_name, priority, status, category, average_time, estimated_hours, owner_id, owner_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *",
      [
        meetingId,
        title,
        description,
        !!dueDate ? dueDate : null,
        null,
        null,
        priority,
        assigned_id ? "Assigned" : "Pending",
        jsonContent?.category,
        jsonContent?.average_time || 0,
        jsonContent?.estimated_hours || 0,
        userId,
        userName,
      ]
    );
    if (assigned_id == -1) {
      assigned_user = await this.inviteNewUser(
        meetingId,
        result.rows[0].id,
        assigned_email
      );
    }

    const updated_result = await pool.query(
      "UPDATE tasks SET assigned_id = $1, assigned_name = $2 WHERE id = $3 RETURNING *",
      [
        assigned_id ? assigned_user.id : null,
        assigned_id ? assigned_user.name : "",
        result.rows[0].id,
      ]
    );

    if (assigned_id) {
      const task = (
        await pool.query("SELECT * FROM tasks WHERE id = $1", [
          result.rows[0].id,
        ])
      ).rows[0];
      const meeting = (
        await pool.query("SELECT * FROM meetings WHERE id = $1", [
          task.meeting_id,
        ])
      ).rows[0];
      const meeting_owner = task.meeting_id
        ? (
          await pool.query("SELECT * FROM users WHERE id = $1", [
            meeting?.org_id,
          ])
        ).rows[0]
        : req.user;
      const message = task.meeting_id
        ? `${meeting_owner.name} invite you on task '${task.title}' of meeting '${meeting?.title}'`
        : `${userName} invite you on task '${task.title}'.`;
      await pool.query(
        "INSERT INTO notifications (user_id, checked, notification, deleted, link, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [
          assigned_user.id,
          false,
          message,
          false,
          `/task-details?id=${task.id}`,
          new Date(),
        ]
      );
      const score_result = await score_tasks1(task.id);
      if (score_result.success) {
        await pool.query(
          "UPDATE tasks SET alignment_score = $1, alignment_reason = $2 WHERE id = $3",
          [score_result.score, score_result.reason, task.id]
        );
      }

      await sendEmail({
        to: assigned_user.email,
        subject: "You have been assigned a Task",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563EB; margin-bottom: 20px;">You have been assigned a task!</h2>

            ${meeting
            ? `<p style="font-size: 16px; margin-bottom: 15px;"><strong>Meeting:</strong> ${meeting.title}</p>`
            : ""
          }

            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="font-size: 16px; margin-bottom: 10px;"><strong>Task:</strong> ${task.title
          }</p>
              <p style="font-size: 14px; color: #4B5563;"><strong>Description:</strong> ${task.description
          }</p>
            </div>

            <a href="${process.env.FRONTEND_URL}/task-details?id=${task.id}"
               style="display: inline-block; background-color: #2563EB; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; font-weight: bold;">
              Click here to view this task
            </a>

            <p style="margin-top: 20px; color: #6B7280; font-size: 14px;">
              Thank you,<br>
              Herd AI Team
            </p>
          </div>
        `,
      });
      sendNotification({
        id: assigned_user.id,
        message: "You have been assigned a Task",
      });
      sendKestrahook({
        title: task?.title || "-",
        description: task?.description || "-",
        assigned: assigned_user.email || "-",
        duedate: task?.duedate || "-",
        category: task?.category || "-",
        link: `${process.env.FRONTEND_URL}/task-details?id=${task.id}`,
      });
    }
    res.status(201).json({
      success: true,
      task: updated_result.rows[0],
    });
  } catch (error) {
    return handleError(res, error, "Failed to create task");
  }
};

exports.deleteTask = async (req, res) => {
  const { taskId } = req.params;
  try {
    console.log("Deleting task:", taskId);
    // Validate input
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: "Task ID is required",
      });
    }

    const result = await pool.query(
      "UPDATE tasks SET isdeleted = true WHERE id = $1 RETURNING *",
      [taskId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Task not found",
      });
    }

    res.status(200).json({
      success: true,
      task: result.rows[0],
    });
  } catch (error) {
    return handleError(res, error, "Failed to delete task");
  }
};
exports.updateTaskStatus = async (req, res) => {
  const { id, status } = req.body;

  try {
    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Task ID is required",
      });
    }
    if (status == "Completed") {
      await pool.query("UPDATE tasks SET completed_at = $1 WHERE id = $2", [
        new Date(),
        id,
      ]);
    }
    //if status is Rated, update rated_at field
    if (status == "Rated")
      await pool.query("UPDATE tasks SET rated_at = $1 WHERE id = $2", [
        new Date(),
        id,
      ]);
    result = await pool.query(
      "UPDATE tasks SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );

    if (!result.rows.length) {
      return handleError(res, error, "Failed to update task");
    }

    res.status(200).json({
      success: true,
      task: result.rows[0],
    });
  } catch (error) {
    return handleError(res, error, "Failed to update task");
  }
};

exports.updateTask = async (req, res) => {
  const {
    owner_id,
    owner_name,
    id,
    title,
    description,
    duedate,
    assigned_id,
    rate,
    review,
    status,
    priority,
    isNewUser,
    assigned_email,
  } = req.body;

  console.log("assigned_email", assigned_email);
  try {
    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Task ID is required",
      });
    }
    let assigned_name = "";
    let assigned_user = {};
    let result = await pool.query(
      "SELECT assigned_id FROM tasks WHERE id = $1",
      [id]
    );
    if (!!assigned_id)
      if (result.rows[0].assigned_id != assigned_id) {
        const task = (
          await pool.query("SELECT * FROM tasks WHERE id = $1", [id])
        ).rows[0];
        if (assigned_id == -1) {
          assigned_user = await inviteNewUser(
            task.meeting_id,
            id,
            assigned_email
          );
        }
        // const task = (await pool.query('SELECT * FROM tasks WHERE id = $1', [id])).rows[0];
        else
          assigned_user = (
            await pool.query("SELECT * FROM users WHERE id = $1", [assigned_id])
          ).rows[0];
        const meeting = (
          await pool.query("SELECT * FROM meetings WHERE id = $1", [
            task.meeting_id,
          ])
        ).rows[0];
        const meeting_owner = (
          await pool.query("SELECT * FROM users WHERE id = $1", [
            meeting?.org_id,
          ])
        ).rows[0];
        const message = meeting ? `${meeting_owner?.name || owner_name} invite you on task '${task.title}' of meeting '${meeting.title}'` : `${owner_name} invite you on task '${task.title}'`;
        assigned_name = assigned_user.name;
        await pool.query(
          "INSERT INTO notifications (user_id, checked, notification, deleted, link, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
          [
            assigned_user.id,
            false,
            message,
            false,
            `/task-details?id=${id}`,
            new Date(),
          ]
        );

        await sendEmail({
          to: assigned_user.email,
          subject: "You have been assigned a Task",
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563EB; margin-bottom: 20px;">You have been assigned a task!</h2>

            ${meeting
              ? `<p style="font-size: 16px; margin-bottom: 15px;"><strong>Meeting:</strong> ${meeting.title}</p>`
              : ""
            }

            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="font-size: 16px; margin-bottom: 10px;"><strong>Task:</strong> ${task.title
            }</p>
              <p style="font-size: 14px; color: #4B5563;"><strong>Description:</strong> ${task.description
            }</p>
            </div>

            <a href="${process.env.FRONTEND_URL}/task-details?id=${task.id}"
               style="display: inline-block; background-color: #2563EB; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; font-weight: bold;">
              Click here to view this task
            </a>

            <p style="margin-top: 20px; color: #6B7280; font-size: 14px;">
              Thank you,<br>
              Herd AI Team
            </p>
          </div>
        `,
        });
        sendNotification({
          id: assigned_user.id,
          message: "You have been assigned a Task",
        });

        sendKestrahook({
          title: task?.title || "-",
          description: task?.description || "-",
          assigned: assigned_user.email || "-",
          duedate: task?.duedate || "-",
          category: task?.category || "-",
          link: `${process.env.FRONTEND_URL}/task-details?id=${id}`,
        });
      } else {
        if (status == "Ready For Review") {
          const task = (
            await pool.query("SELECT * FROM tasks WHERE id = $1", [id])
          ).rows[0];
          const meeting = (
            await pool.query("SELECT * FROM meetings WHERE id = $1", [
              task.meeting_id,
            ])
          ).rows[0];
          const assigned_user = (
            await pool.query("SELECT * FROM users WHERE id = $1", [
              task.assigned_id,
            ])
          ).rows[0];
          const meeting_owner = (
            await pool.query("SELECT * FROM users WHERE id = $1", [
              meeting?.org_id,
            ])
          ).rows[0];
          const task_owner = (
            await pool.query("SELECT * FROM users WHERE id = $1", [
              owner_id,
            ])
          ).rows[0];
          const message = meeting ? `${assigned_user.name} has finished task '${task.title}' of meeting '${meeting.title}', please review this task.` : `${assigned_user.name} has finished task '${task.title}', please review this task.`;
          await pool.query(
            "INSERT INTO notifications (user_id, checked, notification, deleted, link, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
            [
              meeting_owner?.id || task_owner?.id,
              false,
              message,
              false,
              `/task-details?id=${id}`,
              new Date(),
            ]
          );

          await sendEmail({
            to: meeting_owner?.email || task_owner?.email,
            subject: "Task is Ready for Review",
            html: `
            <h2>Task is Ready for Review!</h2>
            <p>Hello ${meeting_owner?.name || task_owner?.name},</p>
            <p>The task '${task.title}' from the meeting '${meeting.title}' is now ready for your review.</p>
            <p>Please click the link below to review the task:</p>
            <a href="${process.env.FRONTEND_URL}/task-details?id=${task.id}">Review Task</a>
            <p>Thank you!</p>
          `,
          });
          sendNotification({
            id: meeting_owner?.id || task_owner?.id,
            message: "Task is Ready for Review!",
          });
        } else if (status == "Completed") {
          const task = (
            await pool.query("SELECT * FROM tasks WHERE id = $1", [
              title,
              description,
              duedate ? new Date(duedate) : null,
              assigned_id ? assigned_id : null,
              newStatus,
              rate ? rate : 0,
              review ? review : "",
              priority ? priority : "Medium",
              assigned_name,
              owner_id || null,
              owner_name || null,
              id,
              id,
            ])
          ).rows[
            (title,
              description,
              duedate ? new Date(duedate) : null,
              assigned_id ? assigned_id : null,
              newStatus,
              rate ? rate : 0,
              review ? review : "",
              priority ? priority : "Medium",
              assigned_name,
              owner_id || null,
              owner_name || null,
              id,
              0)
          ];
          const meeting = (
            await pool.query("SELECT * FROM meetings WHERE id = $1", [
              task.meeting_id,
            ])
          ).rows[0];
          const assigned_user = (
            await pool.query("SELECT * FROM users WHERE id = $1", [
              task.assigned_id,
            ])
          ).rows[0];
          const meeting_owner = (
            await pool.query("SELECT * FROM users WHERE id = $1", [
              meeting.org_id,
            ])
          ).rows[0];
          const task_owner = (
            await pool.query("SELECT * FROM users WHERE id = $1", [
              owner_id,
            ])
          ).rows[0];
          const message = meeting ? `${meeting_owner?.name} has reviewed your task '${task.title}' of meeting '${meeting?.title}'` : `${task_owner?.name} has reviewed your task '${task.title}'.`;
          await pool.query(
            "INSERT INTO notifications (user_id, checked, notification, deleted, link, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
            [
              assigned_user.id,
              false,
              message,
              false,
              `/task-details?id=${id}`,
              new Date(),
            ]
          );
          await sendEmail({
            to: assigned_user.email,
            subject: "Task has been Reviewed",
            html: `
            <h2>Your Task has been Reviewed!</h2>
            <p>Hello ${assigned_user.name},</p>
            <p>The task '${task.title}' ${meeting ? `from the meeting '${meeting.title}'` : ""}has been reviewed.</p>
            <p>Please click the link below to view the task details:</p>
            <a href="${process.env.FRONTEND_URL}/task-details?id=${task.id}">View Task Details</a>
            <p>Thank you!</p>
          `,
          });
          sendNotification({
            id: assigned_user.id,
            message: "Your Task has been Reviewed!",
          });
        }
      }
    let newStatus = (status != "Pending" || status != "Assigned") ? status : assigned_id ? "Assigned" : "Pending";
    // Get the updated task data to return in response
    result = await pool.query(
      "UPDATE tasks SET title = $1, description = $2, duedate = $3, assigned_id = $4, status = $5, rate = $6, review = $7, priority = $8, assigned_name = $9, owner_id = $11, owner_name = $12 WHERE id = $10 RETURNING *",
      [
        title,
        description,
        duedate ? new Date(duedate) : null,
        assigned_id ? assigned_id : null,
        newStatus,
        rate ? rate : 0,
        review ? review : "",
        priority ? priority : "Medium",
        assigned_name,
        id,
        owner_id,
        owner_name,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Task not found",
      });
    }

    res.status(200).json({
      success: true,
      task: result.rows[0],
    });
  } catch (error) {
    return handleError(res, error, "Failed to update task");
  }
};

exports.updateTaskDueDate = async (req, res) => {
  const { id, duedate } = req.body;
  try {
    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Task ID is required",
      });
    }

    const result = await pool.query(
      "UPDATE tasks SET duedate = $1 WHERE id = $2 RETURNING *",
      [duedate ? new Date(duedate) : null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Task not found",
      });
    }

    res.status(200).json({
      success: true,
      task: result.rows[0],
    });
  } catch { }
};

exports.inviteNewUser = async (meetingId, taskId, email) => {
  // Generate invite token
  const inviteToken = uuidv4();
  // Create new user with invite token
  const newUser = await pool.query(
    "INSERT INTO users (email, name, provider, invite_token) VALUES ($1, $1, $2, $3) RETURNING *",
    [email, "email", inviteToken]
  );

  // // Add new user to meeting_participants
  // await pool.query(
  //   'INSERT INTO meeting_participants (user_id, meeting_id) VALUES ($1, $2)',
  //   [newUser.rows[0].id, meetingId]
  // );

  // Update task's assigned_id
  // const updatedTask = await pool.query(
  //   'UPDATE tasks SET assigned_id = $1, assigned_name WHERE id = $2 RETURNING *',
  //   [newUser.rows[0].id, taskId]
  // );

  // Using your email service (e.g., nodemailer, SendGrid, etc.)
  await sendEmail({
    to: email,
    subject: "You have been invited to join a meeting",
    html: `
      <h2>Welcome to Our Platform!</h2>
      <p>You have been invited to participate in a meeting and assigned a task.</p>
      <p>Please click the link below to join the meeting:</p>
      <a href="${process.env.FRONTEND_URL}/meeting-detail?id=${meetingId}">Join Meeting</a>
      <p>Thank you!</p>
    `,
  });
  return newUser.rows[0];
};

exports.inviteUser = async (req, res) => {
  const { meetingId, taskId, email } = req.body;
  try {
    // Check if user already exists
    const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (userCheck.rows.length > 0) {
      // User exists, add to meeting_participants and update task
      const userId = userCheck.rows[0].id;
      // Add user to meeting_participants if not already added
      if (taskId)
        await pool.query(
          "INSERT INTO meeting_participants (user_id, meeting_id, role) VALUES ($1, $2, 'new_invite') ON CONFLICT (user_id, meeting_id) DO NOTHING",
          [userId, meetingId]
        );

      // Update task's assigned_id
      const updatedTask = await pool.query(
        "UPDATE tasks SET assigned_id = $1 WHERE id = $2 RETURNING *",
        [userId, taskId]
      );

      // const task = (await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId])).rows[0];
      const meeting = (
        await pool.query("SELECT * FROM meetings WHERE id = $1", [meetingId])
      ).rows[0];
      const owner = (
        await pool.query("SELECT * FROM users WHERE id = $1", [meeting.org_id])
      ).rows[0];
      const message = `${owner.name} invite you on meeting '${meeting.title}'`;

      await pool.query(
        "INSERT INTO notifications (user_id, checked, notification, deleted, link, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [
          userId,
          false,
          message,
          false,
          "/meeting-detail?id=" + meetingId + "&tab=tasks",
          new Date(),
        ]
      );
      // Using your email service (e.g., nodemailer, SendGrid, etc.)
      const inviteToken = uuidv4();

      await sendEmail({
        to: email,
        subject: "You have been invited to join a meeting",
        html: `
          <h2>Welcome to Our Platform!</h2>
          <p>You have been invited to participate in a meeting and assigned a task.</p>
          <p>Please click the link below to join the meeting:</p>
          <a href="${process.env.FRONTEND_URL}/meeting-detail?id=${meetingId}">Join Meeting</a>
          <p>Thank you!</p>
        `,
      });

      sendNotification({
        id: userId,
        message: "You have been invited to join a meeting",
      });

      res.status(200).json({
        success: true,
        user: userCheck.rows[0],
        task: updatedTask.rows[0],
      });
    } else {
      // Generate invite token
      const inviteToken = uuidv4();

      // Create new user with invite token
      const newUser = await pool.query(
        "INSERT INTO users (email, name, provider, invite_token) VALUES ($1, $1, $2, $3) RETURNING *",
        [email, "email", inviteToken]
      );

      // Add new user to meeting_participants
      await pool.query(
        "INSERT INTO meeting_participants (user_id, meeting_id, role) VALUES ($1, $2, 'new_invite')",
        [newUser.rows[0].id, meetingId]
      );

      // Update task's assigned_id
      const updatedTask = await pool.query(
        "UPDATE tasks SET assigned_id = $1 WHERE id = $2 RETURNING *",
        [newUser.rows[0].id, taskId]
      );

      // Using your email service (e.g., nodemailer, SendGrid, etc.)
      await sendEmail({
        to: email,
        subject: "You have been invited to join a meeting",
        html: `
          <h2>Welcome to Our Platform!</h2>
          <p>You have been invited to participate in a meeting and assigned a task.</p>
          <p>Please click the link below to join the meeting:</p>
          <a href="${process.env.FRONTEND_URL}/meeting-detail?id=${meetingId}">Join Meeting</a>
          <p>Thank you!</p>
        `,
      });

      res.status(200).json({
        success: true,
        user: newUser.rows[0],
        task: updatedTask.rows[0],
      });
    }
  } catch (error) {
    return handleError(res, error, "Failed to invite user");
  }
};

exports.getTasks = async (req, res) => {
  const { meetingId } = req.params;
  console.log("getTasks:", meetingId);
  try {
    const result = await pool.query(
      "SELECT tasks.*, meetings.title AS meeting_title, meeting_owner.name AS meeting_owner_name, assignee.name AS assignee_name FROM tasks LEFT JOIN meetings ON tasks.meeting_id = meetings.id LEFT JOIN users AS meeting_owner ON meetings.org_id = meeting_owner.id LEFT JOIN users AS assignee ON tasks.assigned_id = assignee.id WHERE tasks.meeting_id = $1 AND tasks.isdeleted = false",
      [meetingId]
    );
    res.status(200).json({
      success: true,
      tasks: result.rows,
    });
  } catch (error) {
    return handleError(res, error, "Failed to get tasks");
  }
};

exports.getTaskById = async (req, res) => {
  const { taskId } = req.body;
  const userId = req.user?.id;
  try {
    const result = await pool.query(
      `
      SELECT tasks.*,
             meetings.title AS meeting_title,
             meeting_owner.name AS meeting_owner_name,
             assigned_user.name AS assigned_name,
             cr.est_cph,
             c.show_cost_estimates
      FROM tasks
      LEFT JOIN meetings ON tasks.meeting_id = meetings.id
      LEFT JOIN users AS meeting_owner ON meetings.org_id = meeting_owner.id
      LEFT JOIN users AS assigned_user ON tasks.assigned_id = assigned_user.id
      LEFT JOIN company_roles cr ON cr.id = assigned_user.company_role
      LEFT JOIN company c ON c.id = cr.company_id
      WHERE tasks.id = $1 AND tasks.isdeleted = false AND (meetings.isdeleted = false OR tasks.meeting_id IS NULL)
      `,
      [taskId]
    );
    const threads = await pool.query(
      `SELECT task_threads.id AS task_threads_id,
      task_threads.*,
      task_threads.created_at AS task_created_at ,
      users.* ,
       CASE WHEN f.thread_id IS NOT NULL THEN true ELSE false END AS is_favourite_doc
      FROM task_threads
      LEFT JOIN users ON task_threads.user_id = users.id
      LEFT JOIN task_thread_favorite_doc f ON f.thread_id = task_threads.id AND f.user_id = $2
      WHERE task_threads.task_id = $1 AND task_threads.isdeleted = false`,
      [taskId, userId]
    );

    if (result.rows.length == 0) {
      return res.status(404).json({
        success: false,
        error: "Task not found",
      });
    } else {
      res.status(200).json({
        success: true,
        task: { ...result.rows[0], threads: threads.rows },
      });
    }
  } catch (error) {
    return handleError(res, error, "Failed to get task by ID");
  }
};

exports.setThreadFavourite = async (req, res) => {
  const { threadId, isFavourite, favouriteFileName } = req.body;
  const userId = req.user?.id;
  try {
    if (isFavourite) {
      await pool.query(
        `INSERT INTO task_thread_favorite_doc (thread_id, user_id, custom_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (thread_id, user_id)
        DO UPDATE SET custom_name = EXCLUDED.custom_name`,
        [threadId, userId, favouriteFileName || null]
      );
    } else {
      await pool.query("DELETE FROM task_thread_favorite_doc WHERE thread_id= $1 AND user_id = $2",
        [threadId, userId]);
    }


    res.status(200).json({ success: true });
  } catch (error) {
    return handleError(res, error, "Failed to update favorite");
  }
};

exports.getFavouriteThreads = async (req, res) => {
  const userId = req.user?.id;

  try {
    const { rows } = await pool.query(
      `SELECT f.thread_id, f.custom_name, t.task_id, t.task_file_origin_name, f.created_at, u.name, t.task_file
      FROM task_thread_favorite_doc f
      left join task_threads t on f.thread_id = t.id
      left join users u on t.user_id=u.id
      where f.user_id = $1 and t.isdeleted=false
      ORDER BY f.created_at DESC
      `,
      [userId]
    );

    res.status(200).json({
      success: true,
      favouriteThreads: rows,
    });
  } catch (error) {
    return handleError(res, error, "Failed to fetch favorite threads");
  }
};



exports.insertMessageToTask = async (req, res) => {
  const { taskId, message, reply_from } = req.body;
  const userId = req.user.id;
  try {
    await pool.query(
      "INSERT INTO task_threads (task_id, task_message, user_id, created_at, reply_from) VALUES ($1, $2, $3, $4, $5)",
      [taskId, message, userId, new Date(), reply_from]
    );

    res.status(200).json({
      success: true,
      message: "Message inserted successfully",
    });
  } catch (error) {
    return handleError(res, error, "Failed to insert message to task");
  }
};

exports.uploadFileToTask = async (req, res) => {
  const { taskId, reply_from, mentionedUsers, message, customFileName } = req.body;

  console.log("insert-message-req.body", req.body);

  const userId = req.user.id;
  try {
    // Get task and meeting details
    const task = (
      await pool.query("SELECT * FROM tasks WHERE id = $1", [taskId])
    ).rows[0];
    const meeting = (
      await pool.query("SELECT * FROM meetings WHERE id = $1", [
        task?.meeting_id,
      ])
    ).rows[0];

    // Determine recipient based on user role
    let recipientId;
    if (userId === meeting?.org_id || userId === task.owner_id) {
      // If sender is meeting owner, send to task assignee
      recipientId = task.assigned_id;
    } else if (userId === task.assigned_id) {
      // If sender is task assignee, send to meeting owner
      recipientId = meeting?.org_id || task.owner_id;
    }
    const from_user = (
      await pool.query("SELECT * FROM users WHERE id = $1", [req.user.id])
    ).rows[0];
    const to_user = (
      await pool.query("SELECT * FROM users WHERE id = $1", [recipientId])
    ).rows[0];
    const message1 = meeting
      ? `${from_user.name} sent you message on task '${task.title}' of meeting '${meeting.title}'`
      : `${from_user.name} invite you on task '${task.title}'.`;

    // Parse mentioned users from the request
    const parsedMentionedUsers = mentionedUsers
      ? JSON.parse(mentionedUsers)
      : [];

    if (parsedMentionedUsers.length < "") {
      await pool.query(
        "INSERT INTO notifications (user_id, checked, notification, deleted, link, created_at, mentioned_users) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [
          recipientId,
          false,
          message1,
          false,
          `/task-details?id=${task.id}`,
          new Date()
        ]
      );

      await sendEmail({
        to: to_user.email,
        subject: "New Message in Task Thread",
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://herdai.s3.us-east-1.amazonaws.com/assets/images/herd_email_logo.webp" alt="Herd AI" width="120" style="margin-bottom: 10px;" />
          </div>

          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #1B73E8; margin-top: 0;">New Message in Task Thread</h2>
            <p style="color: #333; font-size: 16px;">${from_user.name} has sent you a message regarding task:</p>
            <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <h3 style="color: #1B73E8; margin-top: 0;">${task.title}</h3>
            </div>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/task-details?id=${task.id}"
               style="display: inline-block; background-color: #1B73E8; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; font-weight: bold;">
              View Task Details
            </a>
          </div>

          <div style="text-align: center; margin-top: 30px; color: #666; font-size: 14px;">
            <p>Thank you for using Herd AI!</p>
          </div>
        </div>
      `,
      });

      if (recipientId) {
        sendNotification({
          id: recipientId,
          message: "You have a new message in task thread",
        });
      }
    } else {
      parsedMentionedUsers.map(async (user) => {
        const notificaiton_message = `${req.user.name} mentioned you on task '${task.title}'`;
        await pool.query(
          "INSERT INTO notifications (user_id, checked, notification, deleted, link, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
          [
            // recipientId,
            user.id,
            false,
            notificaiton_message,
            false,
            `/task-details?id=${task.id}`,
            new Date(),
          ]
        );
        sendNotification({
          id: user.id,
          message: "You mentioned in thread.",
        });
        //// send email to the user
        await sendEmail({
          to: user.email,
          subject: "You mentioned in thread.",
          html: `
          <div>
            <img src="https://herdai.s3.us-east-1.amazonaws.com/assets/images/herd_email_logo.webp" alt="Herd AI" width="120" style="margin-bottom: 10px;" />
          </div>
          <div>
            <p>${req.user.name} mentioned you on task '${task.title}'</p>
            <p>Click the link below to view the task:</p>
            <a href="${process.env.FRONTEND_URL}/task-details?id=${task.id}">View Task</a>
          </div>
          `,
        }); // end of send email

      });
    }
    await pool.query(
      "INSERT INTO task_threads (task_id, task_message, user_id, created_at, reply_from, is_file, task_file, task_file_origin_name, mentioned_users) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
      [
        taskId,
        message,
        userId,
        new Date(),
        reply_from == "null" ? -1 : reply_from,
        req.file ? true : false,
        req.file ? req.file.filename : "",
        req.file ? customFileName ? customFileName : req.file.originalname : "",
        parsedMentionedUsers.length > 0
          ? JSON.stringify(parsedMentionedUsers)
          : null,
      ]
    );

    // Send only one response with all the needed data
    res.status(200).json({
      success: true,
      message: "Message inserted successfully",
    });
  } catch (error) {
    return handleError(res, error, "Error uploading avatar");
  }
};

exports.getMyPerformanceCloud = async (req, res) => {
  const userId = req.user.id;
  const { year, quarter } = req.query;
  let quat_start = null;
  let quat_end = null;

  if (year && quarter) {
    quat_start = new Date(year, quarter * 3 - 3, 1);
    quat_end = new Date(year, quarter * 3, 0);
  } else if (year) {
    // If only year is specified, select the entire year
    quat_start = new Date(year, 0, 1); // January 1st
    quat_end = new Date(year, 11, 31); // December 31st
  }
  try {
    // Get all rated tasks
    const result = await pool.query(
      `
      SELECT
        tasks.id,
        tasks.title,
        tasks.description,
        tasks.rate,
        tasks.review
      FROM tasks
      WHERE assigned_id = $1
        AND status = 'Rated'
        AND isdeleted = false
        AND tasks.created_at BETWEEN $2 AND $3
      ORDER BY tasks.created_at DESC
    `,
      [userId, quat_start, quat_end]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        performanceCloud: [],
      });
    }

    // Prepare tasks data for OpenAI
    const tasksText = result.rows
      .map(
        (task) =>
          `TaskId: ${task.id}\nTitle: ${task.title}\nDescription: ${task.description}\nRating: ${task.rate}\nReview: ${task.review}`
      )
      .join("\n\n");
    /*
    // Replace OpenAI call with Bedrock
    const bedrockParams = {
      modelId: "anthropic.claude-v2",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        prompt: `\n\nHuman: Analyze these rated tasks and generate a thematic word cloud summary. Group similar reviews into common themes and create a summary of the top 20 most significant themes. Format the response as a JSON array of objects. Each object should have "text", "value", and "id" properties, where "id" is an array of task IDs that contribute to this theme.

        Reviews to analyze:
        ${tasksText} \n\n

        Rules:
        - Generate maximum 20 themes, focusing on the most significant and frequently occurring concepts
        - Each theme should represent multiple similar reviews where possible
        - Extract common keywords or phrases that represent the theme
        - Value (1-100) should be calculated based on:
          * Number of reviews in the theme
          * Average rating of reviews in the theme
          * Overall significance of the theme
        - Return ONLY the JSON array without any additional text
        - Format each item as {"text": "theme", "value": number, "id": task id array}
        - Don't Output Example Output !!!!
        - Convert one review to one theme

        Example Input format1: (Don't Output Example Output !!!! )
        [
          {Review:"This is high Performance Work", Rating:"4", ID:"1"},
          {Review:"Excellent performance in delivery", Rating:"5", ID:"2"},
          {Review:"Shows great performance", Rating:"4", ID:"3"},
          {Review:"Good communication skills", Rating:"3", ID:"4"}
        ]

        Example Output format1: (Don't Output Example Output !!!! )
        [
          {"text": "performance", "value": 85, "id": ["1", "2", "3"]},
          {"text": "communication", "value": 60, "id": ["4"]}
        ]

        Example Input format2:
        []

        Example Output format2: (Don't Output Example Output !!!! )
        []

        \n\nAssistant: `,
        max_tokens_to_sample: 1024,
        temperature: 0.7,
        anthropic_version: "bedrock-2023-05-31",
      }),
    };

    const command = new InvokeModelCommand(bedrockParams);
    const response = await bedrockClient.send(command);
    const completion = JSON.parse(new TextDecoder().decode(response.body));
    */
    // Extract JSON content more robustly
    const userprompt = `Analyze these rated tasks and generate a thematic word cloud summary. Group similar reviews into common themes and create a summary of the top 20 most significant themes. Format the response as a JSON array of objects. Each object should have "text", "value", and "id" properties, where "id" is an array of task IDs that contribute to this theme.

    Reviews to analyze:
    ${tasksText} \n\n

    Rules:
    - Generate maximum 20 themes with 1~2 words, focusing on the most significant and frequently occurring concepts
    - Each theme should represent multiple similar reviews where possible
    - Extract common keywords or phrases that represent the theme
    - Value (1-100) should be calculated based on:
      * Number of reviews in the theme
      * Average rating of reviews in the theme
      * Overall significance of the theme
    - Return ONLY the JSON array without any additional text
    - Format each item as {"text": "theme", "value": number, "id": task id array}
    - Don't Output Example Output !!!!
    - Convert one review to one theme

    Example Input format1: (Don't Output Example Output !!!! )
    [
      {Review:"This is high Performance Work", Rating:"4", ID:"1"},
      {Review:"Excellent performance in delivery", Rating:"5", ID:"2"},
      {Review:"Shows great performance", Rating:"4", ID:"3"},
      {Review:"Good communication skills", Rating:"3", ID:"4"}
    ]

    Example Output format1: (Don't Output Example Output !!!! )
    [
      {"text": "performance", "value": 85, "id": ["1", "2", "3"]},
      {"text": "communication", "value": 60, "id": ["4"]}
    ]

    Example Input format2:
    []

    Example Output format2: (Don't Output Example Output !!!! )
    []
`;
    const sysprompt = "Generate Word Cloud";
    const completion = await processAI(sysprompt, userprompt, 2048);
    let performanceCloud;
    try {
      // Remove the prefix text and parse the JSON array
      const jsonString = completion.split("[\n")[1].split("\n]")[0];
      const cleanedJsonString = "[" + jsonString + "]";
      performanceCloud = JSON.parse(cleanedJsonString);
    } catch (error) {
      console.error("Error parsing completion:", error);
      performanceCloud = [];
    }

    res.status(200).json({
      success: true,
      performanceCloud,
    });
  } catch (error) {
    return handleError(res, error, "Failed to get performance cloud data");
  }
};

exports.getMyTasks = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      `
      SELECT tasks.*, meetings.title AS meeting_title, tasks.title AS task_title, cr.est_cph
      FROM tasks
      LEFT JOIN meetings ON tasks.meeting_id = meetings.id
      LEFT JOIN users u ON tasks.assigned_id = u.id
      LEFT JOIN company_roles cr ON cr.id = u.company_role
      WHERE tasks.assigned_id = $1 AND tasks.isdeleted = false`,
      [userId]
    );
    res.status(200).json({
      success: true,
      tasks: result.rows,
    });
  } catch (error) {
    return handleError(res, error, "Failed to get tasks");
  }
};

exports.countMyTasks = async (req, res) => {
  const userId = req.user.id;
  try {
    const openTasks = await pool.query(
      `
      SELECT * FROM tasks WHERE tasks.assigned_id = $1 AND tasks.status != 'Completed' AND tasks.status != 'Rated' AND tasks.isdeleted = false`,
      [userId]
    );
    const assignedOpenTasks = await pool.query(
      `
      SELECT tasks.*, meetings.title AS meeting_title
      FROM tasks
      JOIN meetings ON tasks.meeting_id = meetings.id
      WHERE meetings.org_id = $1
      AND tasks.status != 'Completed'
      AND tasks.status != 'Rated'
      AND tasks.isdeleted = false`,
      [userId]
    );
    const reviewTasks = await pool.query(
      `
        SELECT tasks.*, meetings.title AS meeting_title
        FROM tasks
        JOIN meetings ON tasks.meeting_id = meetings.id
        WHERE meetings.org_id = $1
        AND tasks.status = 'Ready For Review'
        AND tasks.isdeleted = false`,
      [userId]
    );

    res.status(200).json({
      success: true,
      openTasks: openTasks.rows.length,
      assignedTasks: assignedOpenTasks.rows.length,
      reviewTasks: reviewTasks.rows.length,
    });
  } catch (error) {
    return handleError(res, error, "Failed to get tasks");
  }
};

exports.countAssignedTasks = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      `
      SELECT tasks.*, meetings.title AS meeting_title
      FROM tasks
      JOIN meetings ON tasks.meeting_id = meetings.id
      WHERE meetings.org_id = $1
      AND tasks.status != 'Completed'
      AND tasks.status != 'Rated'
      AND tasks.isdeleted = false`,
      [userId]
    );
    res.status(200).json({
      success: true,
      tasksCount: result.rows.length,
      meetings: result.rows.map((row) => ({
        meeting_title: row.meeting_title,
      })),
    });
  } catch (error) {
    return handleError(res, error, "Failed to get tasks");
  }
};

exports.countDueDate = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      `
      SELECT * FROM tasks WHERE tasks.assigned_id = $1 AND tasks.status != 'Completed' AND tasks.status != 'Rated' AND tasks.isdeleted = false AND tasks.duedate < NOW() ORDER BY tasks.duedate ASC`,
      [userId]
    );
    res.status(200).json({
      success: true,
      tasksCount: result.rows.length,
    });
  } catch (error) {
    return handleError(res, error, "Failed to get tasks");
  }
};

exports.getFilteredTask = async (req, res) => {
  const { statusFilter, textFilter, sortby, isCount } = req.body;
  const userId = req.user.id;

  // Get sorting parameters from query string
  const { sort_by, sort_order } = req.query;

  //Status : Unassigned, Pending, Assigned, In Progress, Ready For Review, Completed, Rated

  try {
    let filteredTaskResult, addNoMeetingTasks;

    // Build ORDER BY clause with proper validation
    const buildOrderByClause = () => {
      if (sort_by && sort_order) {
        // Map frontend column names to database column names
        const columnMapping = {
          title: "tasks.title",
          description: "tasks.description",
          duedate: "tasks.duedate",
          priority: "tasks.priority",
          meeting_owner_name: "meeting_owner.name",
          assignee_name: "users.name",
          status: "tasks.status",
          created_at: "tasks.created_at",
          updated_at: "tasks.updated_at",
        };

        const dbColumn = columnMapping[sort_by];
        if (dbColumn && (sort_order === "asc" || sort_order === "desc")) {
          return `ORDER BY ${dbColumn} ${sort_order.toUpperCase()}`;
        }
      }

      // Use legacy sortby parameter if provided
      if (sortby) {
        return `ORDER BY tasks.${sortby}`;
      }

      // Default sorting by due date descending (most recent first)
      return "ORDER BY tasks.duedate DESC";
    };

    const orderByClause = buildOrderByClause();

    console.log("statusFilter:", statusFilter);

    console.log(
      "query",
      `
    SELECT ${isCount
        ? "COUNT(*)"
        : "tasks.*, users.name AS assignee_name, meeting_owner.name AS meeting_owner_name"
      }
    FROM tasks
    JOIN meetings ON tasks.meeting_id = meetings.id
    LEFT JOIN users ON tasks.assigned_id = users.id
    LEFT JOIN users AS meeting_owner ON meetings.org_id = meeting_owner.id
    WHERE (tasks.assigned_id = $1 OR meetings.org_id = $1)
    AND (tasks.title ILIKE $2 OR tasks.description ILIKE $2)
    AND tasks.isdeleted = false
    AND meetings.isdeleted = false
    ${!isCount ? orderByClause : ""}
  `
    );
    filteredTaskResult = await pool.query(
      `
      SELECT ${isCount
        ? "COUNT(*)"
        : "tasks.*, users.name AS assignee_name, meeting_owner.name AS meeting_owner_name"
      }
      FROM tasks
      JOIN meetings ON tasks.meeting_id = meetings.id
      LEFT JOIN users ON tasks.assigned_id = users.id
      LEFT JOIN users AS meeting_owner ON meetings.org_id = meeting_owner.id
      WHERE (tasks.assigned_id = $1 OR meetings.org_id = $1)
      AND (tasks.title ILIKE $2 OR tasks.description ILIKE $2)
      AND tasks.isdeleted = false
      AND meetings.isdeleted = false
      ${!isCount ? orderByClause : ""}
    `,
      [userId, `%${textFilter || ""}%`]
    );

    addNoMeetingTasks = await pool.query(
      `
    SELECT ${isCount
        ? "COUNT(*)"
        : "tasks.*, assign_user.name AS assignee_name, owner_user.name AS meeting_owner_name"
      }
    FROM tasks
    LEFT JOIN users assign_user ON tasks.assigned_id = assign_user.id
    LEFT JOIN users owner_user ON tasks.owner_id = owner_user.id
    WHERE (tasks.assigned_id = $1 OR tasks.owner_id = $1)
    AND (tasks.title ILIKE $2 OR tasks.description ILIKE $2)
    AND tasks.isdeleted = false
    AND tasks.meeting_id IS NULL
    ${!isCount ? orderByClause : ""}
  `,
      [userId, `%${textFilter || ""}%`]
    );
    res.status(200).json({
      success: true,
      tasks: [...filteredTaskResult.rows, ...addNoMeetingTasks.rows],
    });
  } catch (error) {
    return handleError(res, error, "Failed to get filtered tasks");
  }
};

exports.getFilteredopenTask = async (req, res) => {
  // const { statusFilter, textFilter, sortby, isCount } = req.body;
  let userId = req.user.id;
  const { userId: userIdParam } = req.body;
  if (userIdParam) {
    userId = userIdParam;
  }
  // Get sorting parameters from query string
  // const { sort_by, sort_order } = req.query;

  //Status : Unassigned, Pending, Assigned, In Progress, Ready For Review, Completed, Rated

  try {
    let filteredTaskResult;

    filteredTaskResult = await pool.query(
      `
      SELECT t.*
          FROM tasks t
          LEFT JOIN meetings m ON t.meeting_id = m.id
          WHERE t.assigned_id = $1 AND t.isdeleted = false AND (t.status = 'Pending' OR t.status = 'Assigned' OR t.status = 'In Progress' OR t.status = 'Ready For Review')
          AND (t.meeting_id IS NULL OR ( t.meeting_id IS NOT NULL AND m.isdeleted = FALSE))

    `,
      [userId]
    );

    res.status(200).json({
      success: true,
      tasks: filteredTaskResult.rows,
    });
  } catch (error) {
    return handleError(res, error, "Failed to get filtered tasks");
  }
};

exports.getFilteredReviewTask = async (req, res) => {
  // const { statusFilter, textFilter, sortby, isCount } = req.body;
  let userId = req.user.id;
  // const { userId: userIdParam } = req.body;
  // if (userIdParam) {
  //   userId = userIdParam;
  // }

  //Status : Unassigned, Pending, Assigned, In Progress, Ready For Review, Completed, Rated

  try {
    let filteredTaskResult;

    filteredTaskResult = await pool.query(
      `SELECT *
          FROM tasks t
          WHERE t.owner_id = $1 AND t.isdeleted = false AND t.status = 'Ready For Review'`,
      [userId]
    );
    console.log(filteredTaskResult, userId, "PPPPPPPPPPPPPPPPPPPPp")
    res.status(200).json({
      success: true,
      tasks: filteredTaskResult.rows,
    });
  } catch (error) {
    return handleError(res, error, "Failed to get filtered tasks");
  }
};

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

exports.statisticTask = async (req, res) => {
  const { year, quat, company, isYTD } = req.body;
  let quat_start = null;
  let quat_end = null;

  if (year) {
    if (isYTD) {
      // For YTD, set start to January 1st and end to December 31st
      quat_start = new Date(year, 0, 1);
      quat_end = new Date(year, 11, 31);
    } else if (quat) {
      // For quarterly view
      quat_start = new Date(year, quat * 3 - 3, 1);
      quat_end = new Date(year, quat * 3, 0);
    }
  }
  try {
    let Tasks;
    if (company) {
      Tasks = await pool.query(
        `
      WITH company_info AS (
        SELECT domain
        FROM company
        WHERE id = $3
      ),
      company_tasks AS (
        SELECT t.*
        FROM tasks t
        JOIN meetings m ON t.meeting_id = m.id
        JOIN users u ON m.org_id = u.id
        CROSS JOIN company_info ci
        WHERE SPLIT_PART(u.email, '@', 2) = ci.domain
      )
      SELECT
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as task_count
      FROM company_tasks
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month ASC
    `,
        [quat_start, quat_end, company]
      );
    } else {
      Tasks = await pool.query(
        `
      SELECT
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as task_count
      FROM tasks
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month ASC
    `,
        [quat_start, quat_end]
      );
    }

    let labels = [];
    let monthCounts = [];

    if (isYTD) {
      // For YTD, we need all 12 months
      labels = months;
      monthCounts = Array(12).fill(0); // Initialize array for 12 months

      Tasks.rows.forEach((row) => {
        const monthIndex = new Date(row.month).getMonth(); // Get month index (0-11)
        monthCounts[monthIndex] = parseInt(row.task_count);
      });
    } else {
      // For quarterly view
      labels = [
        months[quat * 3 - 3], // First month of quarter (e.g., 'Jan')
        months[quat * 3 - 2], // Second month of quarter (e.g., 'Feb')
        months[quat * 3 - 1], // Third month of quarter (e.g., 'Mar')
      ];
      monthCounts = Array(3).fill(0); // Initialize array for 3 months

      Tasks.rows.forEach((row) => {
        const monthIndex = new Date(row.month).getMonth() % 3; // Get index (0-2) within quarter
        monthCounts[monthIndex] = parseInt(row.task_count);
      });
    }

    const tasksData = {
      labels: labels,
      datasets: [
        {
          label: "Number of Tasks",
          data: monthCounts, // Array of task counts for each month
          borderColor: "#10B981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
        },
      ],
    };

    res.status(200).json({
      status: true,
      tasks: tasksData,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      status: false,
      error: e,
    });
  }
};

exports.statisticTaskRating = async (req, res) => {
  const { year, quat, company, isYTD } = req.body;
  let quat_start = null;
  let quat_end = null;

  if (year) {
    if (isYTD) {
      // For YTD, set start to January 1st and end to December 31st
      quat_start = new Date(year, 0, 1);
      quat_end = new Date(year, 11, 31);
    } else if (quat) {
      // For quarterly view
      quat_start = new Date(year, quat * 3 - 3, 1);
      quat_end = new Date(year, quat * 3, 0);
    }
  }
  try {
    let TaskRates;
    if (company) {
      TaskRates = await pool.query(
        `
      WITH company_info AS (
        SELECT domain
        FROM company
        WHERE id = $3
      ),
      company_tasks AS (
        SELECT t.*
        FROM tasks t
        JOIN meetings m ON t.meeting_id = m.id
        JOIN users u ON m.org_id = u.id
        CROSS JOIN company_info ci
        WHERE SPLIT_PART(u.email, '@', 2) = ci.domain
      )
      SELECT
        rate,
        COUNT(*) as rate_count
      FROM company_tasks t
      WHERE created_at BETWEEN $1 AND $2
      AND status = 'Rated'
      GROUP BY rate
    `,
        [quat_start, quat_end, company]
      );
    } else {
      TaskRates = await pool.query(
        `
      SELECT
        rate,
        COUNT(*) as rate_count
      FROM tasks t
      WHERE created_at BETWEEN $1 AND $2
      AND status = 'Rated'
      GROUP BY rate
    `,
        [quat_start, quat_end]
      );
    }

    const rateCounts = Array(5).fill(0); // Initialize array for 5 ratings (0-4)
    TaskRates.rows.forEach((row) => {
      const rates = row.rate; // Get index (1-5) within quarter
      rateCounts[rates - 1] = parseInt(row.rate_count);
    });

    const taskRatesData = {
      labels: ["Very Poor", "Poor", "Average", "Good", "Excellent"],
      datasets: [
        {
          label: "Task Ratings",
          data: rateCounts,
          backgroundColor: [
            "rgba(239, 68, 68, 0.7)",
            "rgba(249, 115, 22, 0.7)",
            "rgba(234, 179, 8, 0.7)",
            "rgba(34, 197, 94, 0.7)",
            "rgba(59, 130, 246, 0.7)",
          ],
          borderWidth: 1,
        },
      ],
    };

    res.status(200).json({
      status: true,
      taskRates: taskRatesData,
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({
      status: false,
      error: e,
    });
  }
};

exports.removeParticipants = async (req, res) => {
  const { meetingId, userId } = req.body;
  try {
    await pool.query(
      "DELETE FROM meeting_participants WHERE meeting_id = $1 AND user_id = $2",
      [meetingId, userId]
    );

    res.status(200).json({
      success: true,
      message: "Participant removed successfully",
    });
  } catch (error) {
    return handleError(res, error, "Failed to remove participant");
  }
};

exports.taskReviewStatistic = async (req, res) => {
  const { year, quat, company, isYTD } = req.body;
  let quat_start = null;
  let quat_end = null;

  if (year) {
    if (isYTD) {
      // For YTD, set start to January 1st and end to December 31st
      quat_start = new Date(year, 0, 1);
      quat_end = new Date(year, 11, 31);
    } else if (quat) {
      // For quarterly view
      quat_start = new Date(year, quat * 3 - 3, 1);
      quat_end = new Date(year, quat * 3, 0);
    }
  }

  console.log(
    "taskReviewStatistic------------------------------------------",
    year,
    quat,
    company,
    isYTD
  );

  try {
    // Rest of the function remains the same...
    const taskReviews = await pool.query(
      `WITH company_info AS (
        SELECT domain
        FROM company
        WHERE id = $1
      ),
      company_tasks AS (
        SELECT t.*
        FROM tasks t
        JOIN meetings m ON t.meeting_id = m.id
        JOIN users u ON m.org_id = u.id
        CROSS JOIN company_info ci
        WHERE SPLIT_PART(u.email, '@', 2) = ci.domain
      )
      SELECT t.*
      FROM company_tasks t
      WHERE t.created_at BETWEEN $2 AND $3 AND t.status = 'Rated'`,
      [company, quat_start, quat_end]
    );
    console.log("taskReviews", taskReviews?.rows);
    const reviewsText = taskReviews.rows
      .map((t) => `Review: ${t.review}\nRating: ${t.rate}\n\nID: ${t.id}`)
      .join("\n\n");
    console.log("reviewsText", reviewsText);
    /*
    const bedrockParams = {
      modelId: "anthropic.claude-v2",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        prompt: `\n\nHuman: Analyze these task reviews and generate a thematic word cloud summary. Group similar reviews into common themes and create a summary of the top 20 most significant themes. Format the response as a JSON array of objects. Each object should have "text", "value", and "id" properties, where "id" is an array of task IDs that contribute to this theme.

        Reviews to analyze:
        ${reviewsText} \n\n

        Rules:
        - Generate maximum 20 themes, focusing on the most significant and frequently occurring concepts
        - Each theme should represent multiple similar reviews where possible
        - Extract common keywords or phrases that represent the theme
        - Value (1-100) should be calculated based on:
          * Number of reviews in the theme
          * Average rating of reviews in the theme
          * Overall significance of the theme
        - Return ONLY the JSON array without any additional text
        - Format each item as {"text": "theme", "value": number, "id": [task_ids]}
        - Don't Output Example Output !!!!

        Example Input format1: (Don't Output Example Output !!!! )
        [
          {Review:"This is high Performance Work", Rating:"4", ID:"1"},
          {Review:"Excellent performance in delivery", Rating:"5", ID:"2"},
          {Review:"Shows great performance", Rating:"4", ID:"3"},
          {Review:"Good communication skills", Rating:"3", ID:"4"}
        ]

        Example Output format1: (Don't Output Example Output !!!! )
        [
          {"text": "performance", "value": 85, "id": ["1", "2", "3"]},
          {"text": "communication", "value": 60, "id": ["4"]}
        ]

        Example Input format2:
        []

        Example Output format2: (Don't Output Example Output !!!! )
        []

        \n\nAssistant: `,
        max_tokens_to_sample: 1024,
        temperature: 0.7,
        anthropic_version: "bedrock-2023-05-31",
      }),
    };

    const command = new InvokeModelCommand(bedrockParams);
    const response = await bedrockClient.send(command);
    const completion = JSON.parse(new TextDecoder().decode(response.body));
    console.log("completion.completion:", completion.completion);
    */
    const userprompt = `Analyze these task reviews and generate a thematic word cloud summary. Group similar reviews with 1~2 words into common themes and create a summary of the top 20 most significant themes. Format the response as a JSON array of objects. Each object should have "text", "value", and "id" properties, where "id" is an array of task IDs that contribute to this theme.

    Reviews to analyze:
    ${reviewsText} \n\n

    Rules:
    - Generate maximum 20 themes, focusing on the most significant and frequently occurring concepts
    - Each theme should represent multiple similar reviews where possible
    - Extract common keywords or phrases that represent the theme
    - Value (1-100) should be calculated based on:
      * Number of reviews in the theme
      * Average rating of reviews in the theme
      * Overall significance of the theme
    - Return ONLY the JSON array without any additional text
    - Format each item as {"text": "theme", "value": number, "id": [task_ids]}
    - Don't Output Example Output !!!!

    Example Input format1: (Don't Output Example Output !!!! )
    [
      {Review:"This is high Performance Work", Rating:"4", ID:"1"},
      {Review:"Excellent performance in delivery", Rating:"5", ID:"2"},
      {Review:"Shows great performance", Rating:"4", ID:"3"},
      {Review:"Good communication skills", Rating:"3", ID:"4"}
    ]

    Example Output format1: (Don't Output Example Output !!!! )
    [
      {"text": "performance", "value": 85, "id": ["1", "2", "3"]},
      {"text": "communication", "value": 60, "id": ["4"]}
    ]

    Example Input format2:
    []

    Example Output format2: (Don't Output Example Output !!!! )
    []
`;
    const sysprompt = "Only generate the JSON";
    const completion = await processAI(sysprompt, userprompt, 2048);

    // Parse the completion string directly into JSON
    let wordCloudData;
    try {
      // Remove the prefix text and parse the JSON array
      const jsonString = completion.split("[\n")[1].split("\n]")[0];
      const cleanedJsonString = "[" + jsonString + "]";
      wordCloudData = JSON.parse(cleanedJsonString);
    } catch (error) {
      console.error("Error parsing completion:", error);
      wordCloudData = [];
    }

    return res.status(200).json({
      success: true,
      reviews: wordCloudData,
    });
  } catch (error) {
    console.error("Error getting task review statistics:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get task review statistics",
    });
  }
};

exports.getSimilarTaskUsers = async (req, res) => {
  const { taskId } = req.params;
  try {
    // First, get the threshold value from system settings
    const thresholdQuery = await pool.query(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'threshold'`
    );
    const threshold =
      thresholdQuery.rows.length > 0
        ? parseInt(thresholdQuery.rows[0].setting_value) / 100
        : 0; // Convert percentage to decimal

    // Get the current task's details
    const taskQuery = await pool.query(
      `SELECT
        t.category,
        t.title,
        t.description,
        t.priority,
        t.assigned_id
      FROM tasks t
      WHERE t.id = $1`,
      [taskId]
    );

    if (taskQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const task = taskQuery.rows[0];
    await pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

    const similarTasksQuery = await pool.query(
      `
      WITH user_company AS (
        SELECT SPLIT_PART(email, '@', 2) as domain
        FROM users
        WHERE id = (SELECT assigned_id FROM tasks WHERE id = $1)
      ),
      similarity_scores AS (
        SELECT
          t.id,
          t.title,
          t.description,
          t.status,
          t.rate,
          t.review,
          u.name as assignee_name,
          u.id as assignee_id,
          u.email as assignee_email,
          u.bio as assignee_bio,
          u.avatar as assignee_avatar,
          u.phone as assignee_phone,
          u.location as assignee_location,
          (
            similarity(COALESCE(t.title, ''), $2::text) +
            similarity(COALESCE(t.description, ''), $3::text)
          ) / 2 as match_score
        FROM tasks t
        LEFT JOIN users u ON t.assigned_id = u.id
        JOIN user_company uc ON SPLIT_PART(u.email, '@', 2) = uc.domain
        WHERE t.id <> $1
          AND t.status IN ('Completed', 'Rated')
          AND t.isdeleted = false
      )
      SELECT *
      FROM similarity_scores
      WHERE match_score >= $4
      ORDER BY match_score DESC
    `,
      [taskId, task.title || "", task.description || "", threshold]
    );

    const formattedTasks = similarTasksQuery.rows.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      rate: task.rate,
      review: task.review,
      assigneeId: task.assignee_id,
      assigneeName: task.assignee_name,
      assigneeEmail: task.assignee_email,
      assigneeBio: task.assignee_bio,
      assigneeAvatar: task.assignee_avatar,
      assigneePhone: task.assignee_phone,
      assigneeLocation: task.assignee_location,
      matchScore: (Number(task.match_score) * 100).toFixed(2), // Convert to percentage
      link: `/task-details?id=${task.id}`,
    }));

    res.status(200).json({
      success: true,
      similarTasks: formattedTasks,
    });
  } catch (error) {
    console.error("Error in getSimilarTaskUsers:", error);
    return handleError(res, error, "Failed to fetch similar task users");
  }
};

exports.requestHelp = async (req, res) => {
  const { taskId, helperId, taskTitle } = req.body;
  try {
    // Create notification for helper
    await pool.query(
      "INSERT INTO notifications (user_id, checked, notification, deleted, link, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [
        helperId,
        false,
        `${req.user.name} has requested your help with task: ${taskTitle}`,
        false,
        `/task-details?id=${taskId}`,
        new Date(),
      ]
    );

    // Get helper's email
    const helperQuery = await pool.query(
      "SELECT email, name FROM users WHERE id = $1",
      [helperId]
    );

    if (helperQuery.rows.length > 0) {
      const helper = helperQuery.rows[0];
      await sendEmail({
        to: helper.email,
        subject: "Help Request for Task",
        html: `
          <h2>Hello ${helper.name},</h2>
          <p>${req.user.name} has requested your help with a task.</p>
          <p>Task: ${taskTitle}</p>
          <p>Click below to view the task:</p>
          <a href="${process.env.FRONTEND_URL}/task-details?id=${taskId}">View Task</a>
        `,
      });
    }

    res.status(200).json({
      success: true,
      message: "Help request sent successfully",
    });
  } catch (error) {
    return handleError(res, error, "Failed to send help request");
  }
};

exports.getAIHelp = async (req, res) => {
  const { taskId, title, description } = req.body;

  try {
    // Get the meeting information related to this task
    const meetingQuery = `
      SELECT m.transcription_link, m.summary, m.title as meeting_title ,t.ai_recommendation as ai_recommendation , t.ai_recommendation_expired_date as ai_recommendation_expired_date
      FROM meetings m
      JOIN tasks t ON t.meeting_id = m.id
      WHERE t.id = $1
    `;
    const meetingResult = await pool.query(meetingQuery, [taskId]);
    const meetingData = meetingResult.rows[0];
    if (
      meetingData.ai_recommendation &&
      meetingData.ai_recommendation_expired_date > new Date()
    ) {
      return res.json({
        success: true,
        data: {
          response: meetingData.ai_recommendation,
          taskId: taskId,
        },
      });
    }

    const userprompt = `
As an AI assistant, help with this task using the context from the related meeting:

TASK INFORMATION:
Title: ${title}
Description: ${description}

MEETING CONTEXT:
Meeting Title: ${meetingData?.meeting_title || "N/A"}
Meeting Summary: ${meetingData?.summary || "N/A"}
Meeting Transcription: ${meetingData?.transcription_link || "N/A"}

Please provide a comprehensive assistance package including:

1. Task Analysis:
   - Break down the main components of the task
   - Identify key dependencies and prerequisites

2. Step-by-Step Implementation Plan:
   - Detailed steps to complete the task
   - Estimated time for each step
   - Critical checkpoints and milestones

3. Potential Challenges and Solutions:
   - Identify possible obstacles
   - Provide specific solutions for each challenge
   - Risk mitigation strategies

4. Best Practices and Recommendations:
   - Industry standards to follow
   - Quality assurance measures
   - Performance optimization tips

5. Success Criteria:
   - Define clear completion criteria
   - Quality metrics to measure success
   - Validation checkpoints

Please format the response in a clear, structured way that's easy to follow.`;

    /*
    const bedrockParams = {
      modelId: "anthropic.claude-v2",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        prompt: `\n\nHuman: ${prompt}\n\nAssistant:`,
        max_tokens_to_sample: 2048,
        temperature: 0.7,
        anthropic_version: "bedrock-2023-05-31",
      }),
    };

    const command = new InvokeModelCommand(bedrockParams);
    const response = await bedrockClient.send(command);
    const completion = JSON.parse(new TextDecoder().decode(response.body));
*/
    const sysprompt =
      "As an AI assistant, help with this task using the context from the related meeting";
    const completion = await processAI(sysprompt, userprompt, 2048);
    const saveAIRecommendationQuery = `
      UPDATE tasks
      SET ai_recommendation = $1,
          ai_recommendation_expired_date = CURRENT_DATE + INTERVAL '30 days'
      WHERE id = $2
      RETURNING *
    `;
    await pool.query(saveAIRecommendationQuery, [completion, taskId]);

    res.json({
      success: true,
      data: {
        response: completion,
        taskId: taskId,
      },
    });
  } catch (error) {
    console.error("Error getting AI help:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get AI assistance",
      error: error.message,
    });
  }
};

exports.getTodoTaskRest = async (req, res) => {
  const { email } = req.body;

  try {
    const result = await pool.query(
      `
      SELECT tasks.id, tasks.title, tasks.description
      FROM tasks
      JOIN users ON tasks.assigned_id = users.id
      JOIN meetings ON tasks.meeting_id = meetings.id
      WHERE users.email = $1
        AND tasks.isdeleted = false
        AND meetings.isdeleted = false
        AND tasks.status = 'In Progress'
    `,
      [email]
    );

    res.json({
      success: true,
      data: {
        count: result.rows.length,
        tasks: result.rows,
      },
    });
  } catch (error) {
    console.error("Error getting todo tasks:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get todo tasks",
      error: error.message,
    });
  }
};

exports.getReturnHelpRest = async (req, res) => {
  const { taskId } = req.body;
  try {
    // First, get the threshold value from system settings
    const thresholdQuery = await pool.query(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'threshold'`
    );
    const threshold =
      thresholdQuery.rows.length > 0
        ? parseInt(thresholdQuery.rows[0].setting_value) / 100
        : 0; // Convert percentage to decimal

    // Get the current task's details with latest file from task_threads
    const taskQuery = await pool.query(
      `WITH LatestFile AS (
        SELECT
          task_id,
          task_file,
          task_file_origin_name,
          ROW_NUMBER() OVER (PARTITION BY task_id ORDER BY created_at DESC) as rn
        FROM task_threads
        WHERE task_file IS NOT NULL AND task_file != ''
      )
      SELECT
        t.category,
        t.title,
        t.description,
        t.priority,
        t.assigned_id,
        lf.task_file,
        lf.task_file_origin_name
      FROM tasks t
      LEFT JOIN LatestFile lf ON t.id = lf.task_id AND lf.rn = 1
      WHERE t.id = $1`,
      [taskId]
    );

    if (taskQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const task = taskQuery.rows[0];
    await pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

    const similarTasksQuery = await pool.query(
      `
      WITH similarity_scores AS (
        SELECT
          t.id,
          t.title,
          t.description,
          t.status,
          t.rate,
          t.review,
          u.name as assignee_name,
          u.id as assignee_id,
          u.email as assignee_email,
          u.bio as assignee_bio,
          u.avatar as assignee_avatar,
          u.phone as assignee_phone,
          u.location as assignee_location,
          lf.task_file,
          lf.task_file_origin_name,
          (
            similarity(COALESCE(t.title, ''), $2::text) +
            similarity(COALESCE(t.description, ''), $3::text)
          ) / 2 as match_score
        FROM tasks t
        LEFT JOIN users u ON t.assigned_id = u.id
        LEFT JOIN LATERAL (
          SELECT task_file, task_file_origin_name
          FROM task_threads
          WHERE task_id = t.id
            AND task_file IS NOT NULL
            AND task_file != ''
          ORDER BY created_at DESC
          LIMIT 1
        ) lf ON true
        WHERE t.id <> $1
          AND t.status IN ('Completed', 'Rated')
          AND t.isdeleted = false
      )
      SELECT *
      FROM similarity_scores
      WHERE match_score >= $4
      ORDER BY match_score DESC
      LIMIT 2
    `,
      [taskId, task.title || "", task.description || "", threshold]
    );

    const formattedTasks = similarTasksQuery.rows.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      rate: task.rate,
      review: task.review,
      assigneeId: task.assignee_id,
      assigneeName: task.assignee_name,
      assigneeEmail: task.assignee_email,
      assigneeBio: task.assignee_bio,
      assigneeAvatar: task.assignee_avatar,
      assigneePhone: task.assignee_phone,
      assigneeLocation: task.assignee_location,
      taskFile: task.task_file,
      taskFileOriginName: task.task_file_origin_name,
      matchScore: (Number(task.match_score) * 100).toFixed(2), // Convert to percentage
      link: `/task-details?id=${task.id}`,
    }));

    const meetingResult = await pool.query(
      `
      SELECT m.title as meeting_title, m.transcription_link as meeting_transcription, m.summary as meeting_summary,
        t.title as task_title, t.description as task_description,
        t.ai_recommendation as task_ai_recommendation,
        t.ai_recommendation_expired_date as task_ai_recommendation_expired_date,
        lf.task_file,
        lf.task_file_origin_name
      FROM meetings m
      JOIN tasks t ON m.id = t.meeting_id
      LEFT JOIN LATERAL (
        SELECT task_file, task_file_origin_name
        FROM task_threads
        WHERE task_id = t.id
          AND task_file IS NOT NULL
          AND task_file != ''
        ORDER BY created_at DESC
        LIMIT 1
      ) lf ON true
      WHERE t.id = $1
    `,
      [taskId]
    );

    const meetingData = meetingResult.rows[0];
    if (
      meetingData.task_ai_recommendation &&
      meetingData.task_ai_recommendation_expired_date > new Date()
    ) {
      return res.json({
        success: true,
        data: {
          similarTasks: formattedTasks,
          aiHelp: meetingData.task_ai_recommendation,
          taskId: taskId,
        },
      });
    }
    const userprompt = `
    Using the attached data if it is helpful, create a 300 word or less explanation on how best to complete the task and use names, ratings and examples if you have them or just suggest how to do it without examples from the attached data.

    Current Task:
    Title: ${title}
    Description: ${description}

    Similar Tasks and Resources:
    ${formattedTasks
        .map(
          (task) => `
    - Similar Task: ${task.title}
    - Context: ${task.description}
    - Success Rating: ${task.rate}/5
    ${task.taskFile
              ? `- Reference Material: ${task.taskFileOriginName} (${task.taskFile})`
              : ""
            }
    `
        )
        .join("\n")}

    Please provide:
    1. Step-by-step approach to complete the task
    2. Best practices and recommendations
    3. References to any helpful attachments from similar tasks
    4. Success criteria and quality checkpoints

    Format the response in a clear, structured way with sections and bullet points.`;
    /*
    const bedrockParams = {
      modelId: "anthropic.claude-v2",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        prompt: `\n\nHuman: ${prompt}\n\nAssistant:`,
        max_tokens_to_sample: 2048,
        temperature: 0.7,
        anthropic_version: "bedrock-2023-05-31",
      }),
    };

    const command = new InvokeModelCommand(bedrockParams);
    const response = await bedrockClient.send(command);
    const completion = JSON.parse(new TextDecoder().decode(response.body));
*/
    const sysprompt = "Using the attached data if it is helpful";
    const completion = await processAI(sysprompt, userprompt, 2048);
    const saveAIRecommendationQuery = `
      UPDATE tasks
      SET ai_recommendation = $1,
          ai_recommendation_expired_date = CURRENT_DATE + INTERVAL '30 days'
      WHERE id = $2
      RETURNING *
    `;
    await pool.query(saveAIRecommendationQuery, [completion, taskId]);

    return res.json({
      success: true,
      data: {
        aiHelp: completion,
        similarTasks: formattedTasks,
        taskId: taskId,
      },
    });
  } catch (error) {
    console.error("Error in getSimilarTaskUsers:", error);
    return handleError(res, error, "Failed to fetch similar task users");
  }
};

exports.getReturnHelpOnlyTaskTitleRest = async (req, res) => {
  const { title, description, email } = req.body;
  try {
    const thresholdQuery = await pool.query(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'threshold'`
    );
    const threshold =
      thresholdQuery.rows.length > 0
        ? parseInt(thresholdQuery.rows[0].setting_value) / 100
        : 0;

    const similarTasksQuery = await pool.query(
      `
      WITH similarity_scores AS (
        SELECT
          t.id,
          t.title,
          t.description,
          t.status,
          t.rate,
          t.review,
          u.name as assignee_name,
          u.id as assignee_id,
          u.email as assignee_email,
          u.bio as assignee_bio,
          u.avatar as assignee_avatar,
          u.phone as assignee_phone,
          u.location as assignee_location,
          lf.task_file,
          lf.task_file_origin_name,
          (
            similarity(COALESCE(t.title, ''), $1::text) +
            similarity(COALESCE(t.description, ''), $2::text)
          ) / 2 as match_score,
          creator.email as creator_email
        FROM tasks t
        JOIN meetings m ON t.meeting_id = m.id
        LEFT JOIN users u ON t.assigned_id = u.id
        LEFT JOIN users creator ON m.org_id = creator.id
        LEFT JOIN LATERAL (
          SELECT task_file, task_file_origin_name
          FROM task_threads
          WHERE task_id = t.id
            AND task_file IS NOT NULL
            AND task_file != ''
          ORDER BY created_at DESC
          LIMIT 1
        ) lf ON true
        WHERE t.status IN ('Completed', 'Rated')
          AND t.isdeleted = false
      )
      SELECT *
      FROM similarity_scores ss
      WHERE match_score >= $3
      ORDER BY match_score DESC
      LIMIT 2
    `,
      [title || "", description || "", threshold]
    );

    const formattedTasks = similarTasksQuery.rows.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      rate: task.rate,
      review: task.review,
      assigneeId: task.assignee_id,
      assigneeName: task.assignee_name,
      assigneeEmail: task.assignee_email,
      assigneeBio: task.assignee_bio,
      assigneeAvatar: task.assignee_avatar,
      assigneePhone: task.assignee_phone,
      assigneeLocation: task.assignee_location,
      taskFile: task.task_file,
      taskFileOriginName: task.task_file_origin_name,
      matchScore: (Number(task.match_score) * 100).toFixed(2), // Convert to percentage
      link: `/task-details?id=${task.id}`,
    }));

    const userprompt = `
    Using the attached data if it is helpful, create detailed explanation on how best to complete the task and use names, ratings and examples if you have them or just suggest how to do it without examples from the attached data.

    Current Task:
    Title: ${title}
    Description: ${description}

    Similar Tasks and Resources:
    ${formattedTasks
        .map(
          (task) => `
    - Similar Task: ${task.title}
    - Context: ${task.description}
    - Success Rating: ${task.rate}/5
    ${task.taskFile
              ? `- Reference Material: ${task.taskFileOriginName} (${task.taskFile})`
              : ""
            }
    `
        )
        .join("\n")}

    Please provide:
    1. Step-by-step approach to complete the task
    2. Best practices and recommendations
    3. References to any helpful attachments from similar tasks
    4. Success criteria and quality checkpoints

    Format the response in a clear, structured way with sections and bullet points.`;
    /*

    const bedrockParams = {
      modelId: "anthropic.claude-v2",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        prompt: `\n\nHuman: ${prompt}\n\nAssistant:`,
        max_tokens_to_sample: 2048,
        temperature: 0.7,
        anthropic_version: "bedrock-2023-05-31",
      }),
    };

    const command = new InvokeModelCommand(bedrockParams);
    const response = await bedrockClient.send(command);
    const completion = JSON.parse(new TextDecoder().decode(response.body));*/
    const sysprompt = "Using the attached data if it is helpful";
    const completion = await processAI(sysprompt, userprompt, 2048);
    res.status(200).json({
      success: true,
      data: {
        similarTasks: formattedTasks,
        aiHelp: completion,
      },
    });
  } catch (error) {
    console.error("Error in getSimilarTaskUsers:", error);
    return handleError(res, error, "Failed to fetch similar task users");
  }
};

exports.createTaskRest = async (req, res) => {
  const { meetingId, title, desc, dueDate, priority, email } = req.body;
  const userId = req.user.id;

  try {
    if (!meetingId || !title || !desc || !priority) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }
    let assigned_user = (
      await pool.query("SELECT * FROM users WHERE email = $1", [email])
    ).rows[0];

    const category_result = await pool.query("SELECT * FROM categories");

    const userprompt = `
    Based on the following meeting title and description, generate a list of categories for the task.
    Current timestamp: ${new Date().toISOString()}

    Please format the must response as a JSON object with a "task" object containing task properties .
    The task object should have these properties:
    {
      "category": "Category of the task, Select categories among these ${category_result.rows
        .map((category) => category.category_name)
        .join(", ")}, output format is 'a,b,c,d'",
      "average_time": "Average time to complete the task in days and not calculate holidays, rest days, and weekends. if not, 0"
    }

    Meeting title:
    ${title}
    Meeting description:
    ${desc}
  `;
    /*    const bedrockParams = {
      modelId: "anthropic.claude-v2",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        prompt: `\n\nHuman: ${prompt}\n\nAssistant: Let me generate that task list in JSON format.`,
        max_tokens_to_sample: 1024,
        temperature: 0.7,
        anthropic_version: "bedrock-2023-05-31",
      }),
    };

    const command = new InvokeModelCommand(bedrockParams);
    const response = await bedrockClient.send(command);
    const completion = JSON.parse(new TextDecoder().decode(response.body));
*/

    const sysprompt = "Using the attached data if it is helpful";
    const completion = await processAI(sysprompt, userprompt, 2048);
    // Extract just the JSON content from the response
    const jsonMatch = completion.match(/```json\n([\s\S]*?)\n```/);

    let jsonContent;

    if (jsonMatch) {
      jsonContent = JSON.parse(jsonMatch[1]);
    } else {
      // Otherwise try to find JSON object directly in the completion
      const jsonStart = completion.indexOf("{");
      const jsonEnd = completion.lastIndexOf("}") + 1;
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const jsonStr = completion.slice(jsonStart, jsonEnd);
        jsonContent = JSON.parse(jsonStr);
      } else {
        // If no feedback data, return empty array
        jsonContent = [];
      }
    }

    console.log("Parsed JSON:", jsonContent);

    const result = await pool.query(
      "INSERT INTO tasks (meeting_id, title, description, duedate, assigned_id, assigned_name, priority, status, category,average_time, estimated_hours, owner_id ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *",
      [
        meetingId,
        title,
        desc,
        !!dueDate ? dueDate : null,
        null,
        null,
        priority,
        assigned_user ? "Assigned" : "Pending",
        jsonContent.category,
        jsonContent.average_time || 0,
        jsonContent.estimated_hours || 0,
        userId,
      ]
    );

    const updated_result = await pool.query(
      "UPDATE tasks SET assigned_id = $1, assigned_name = $2 WHERE id = $3 RETURNING *",
      [
        assigned_user ? assigned_user.id : null,
        assigned_user ? assigned_user.name : "",
        result.rows[0].id,
      ]
    );

    if (assigned_user) {
      const task = (
        await pool.query("SELECT * FROM tasks WHERE id = $1", [
          result.rows[0].id,
        ])
      ).rows[0];
      const meeting = (
        await pool.query("SELECT * FROM meetings WHERE id = $1", [
          task.meeting_id,
        ])
      ).rows[0];
      const meeting_owner = (
        await pool.query("SELECT * FROM users WHERE id = $1", [meeting.org_id])
      ).rows[0];
      const message = `${meeting_owner.name} invite you on task '${task.title}' of meeting '${meeting.title}'`;
      await pool.query(
        "INSERT INTO notifications (user_id, checked, notification, deleted, link, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [
          assigned_user.id,
          false,
          message,
          false,
          `/task-details?id=${task.id}`,
          new Date(),
        ]
      );

      const score_result = await score_tasks1(task.id);
      if (score_result.success) {
        await pool.query(
          "UPDATE tasks SET alignment_score = $1, alignment_reason = $2 WHERE id = $3",
          [score_result.score, score_result.reason, task.id]
        );
      }

      await sendEmail({
        to: assigned_user.email,
        subject: "You have been assigned a Task",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563EB; margin-bottom: 20px;">You have been assigned a task!</h2>

            ${meeting
            ? `<p style="font-size: 16px; margin-bottom: 15px;"><strong>Meeting:</strong> ${meeting.title}</p>`
            : ""
          }

            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="font-size: 16px; margin-bottom: 10px;"><strong>Task:</strong> ${task.title
          }</p>
              <p style="font-size: 14px; color: #4B5563;"><strong>Description:</strong> ${task.description
          }</p>
            </div>

            <a href="${process.env.FRONTEND_URL}/task-details?id=${task.id}"
               style="display: inline-block; background-color: #2563EB; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; font-weight: bold;">
              Click here to view this task
            </a>

            <p style="margin-top: 20px; color: #6B7280; font-size: 14px;">
              Thank you,<br>
              Herd AI Team
            </p>
          </div>
        `,
      });
      sendNotification({
        id: assigned_user.id,
        message: "You have been assigned a Task",
      });

      sendKestrahook({
        title: task?.title || "-",
        description: task?.description || "-",
        assigned: assigned_user.email || "-",
        duedate: task?.duedate || "-",
        category: task?.category || "-",
        link: `${process.env.FRONTEND_URL}/task-details?id=${task.id}`,
      });
    }
    res.status(201).json({
      success: true,
      data: {
        taskId: updated_result.rows[0].id,
      },
    });
  } catch (error) {
    return handleError(res, error, "Failed to create task");
  }
};

exports.startResearchRest = async (req, res) => {
  const { topic, email } = req.body;
  try {
    console.log("email:", email);
    const response = await axios.post(
      `${process.env.RESEARCH_BY_AI_API_URL}/api/research/start`,
      {
        query: topic,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.RESEARCH_BY_AI_API_KEY,
        },
      }
    );

    if (response.data.requestId) {
      const result1 = await pool.query(
        "UPDATE research_requests SET is_closed = true WHERE user_email = $1",
        [email]
      );
      const result = await pool.query(
        "INSERT INTO research_requests (topic, request_id, status, created_at, user_email) VALUES ($1, $2, $3, NOW(), $4) RETURNING *",
        [topic, response.data.requestId, "pending", email]
      );

      res.json({
        success: true,
        data: {
          requestId: response.data.requestId,
          topic,
        },
      });
    }
  } catch (error) {
    console.error("Error starting research:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.getStatusResearch = async (req, res) => {
  const { requestId, email } = req.body;
  try {
    const result = await pool.query(
      "SELECT * FROM research_requests WHERE request_id = $1",
      [requestId]
    );
    if (result.rows.length && result.rows[0].is_closed) {
      return res.json({
        success: false,
        error: "Research request is closed",
      });
    }

    const response = await axios.get(
      `${process.env.RESEARCH_BY_AI_API_URL}/api/research/status/${requestId}`,
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.RESEARCH_BY_AI_API_KEY,
        },
      }
    );
    console.log('224444', response)
    if (response.data.status) {
      if (response.data.status[0] == "COMPLETED") {
        const resDownload = await axios.get(
          `${process.env.RESEARCH_BY_AI_API_URL}/api/research/download/${requestId}`,
          {
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.RESEARCH_BY_AI_API_KEY,
            },
            responseType: "arraybuffer",
          }
        );
        await fs.writeFileSync(
          `public/files/research-${requestId}.docx`,
          resDownload.data
        );
        await pool.query(
          'UPDATE research_requests SET status = $1, research_file = $2 WHERE request_id = $3',
          ['COMPLETED', `/api/files/research-${requestId}.docx`, requestId]
        );
      }
      res.json({
        success: true,
        data: {
          ...response.data,
          downloadlink: `/files/research-${requestId}.docx`,
        },
      });
    }
  } catch (error) {
    console.error("Error checking research status:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.closeResearch = async (req, res) => {
  const { requestId } = req.body;

  try {
    const response = await pool.query(
      "UPDATE research_requests SET is_closed = true WHERE request_id = $1",
      [requestId]
    );
    res.json({
      success: true,
      data: response.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

exports.getResearchClosed = async (req, res) => {
  const { requestId } = req.body;

  try {
    const response = await pool.query(
      "SELECT * FROM research_requests WHERE request_id = $1",
      [requestId]
    );

    if (response.rows[0]) {
      return res.json({
        success: true,
        status: response.rows[0].is_closed,
      });
    }
    return res.status(500).json({
      success: false,
      status: "Research Not Found",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

exports.getTaskReviewDetails = async (req, res) => {
  const { id } = req.body; // id is now an array of task IDs

  try {
    const result = await pool.query(
      `
      SELECT
        tasks.id as task_id,
        tasks.title as task_title,
        meetings.title AS meeting_title,
        assignee.name AS user_name,
        assignee.avatar AS user_avatar,
        tasks.created_at AS created_at,
        tasks.rate AS rate,
        tasks.review AS review,
        meeting_owner.name AS meeting_owner_name,
        meeting_owner.avatar AS meeting_owner_avatar
      FROM tasks
      LEFT JOIN meetings ON tasks.meeting_id = meetings.id
      LEFT JOIN users AS meeting_owner ON meetings.org_id = meeting_owner.id
      LEFT JOIN users AS assignee ON tasks.assigned_id = assignee.id
      WHERE tasks.id = ANY($1) AND tasks.isdeleted = false
      ORDER BY tasks.created_at DESC
    `,
      [id]
    ); // Using ANY to match against array of IDs

    res.status(200).json({
      success: true,
      reviews: result.rows, // Now returns multiple reviews
    });
  } catch (error) {
    return handleError(res, error, "Failed to get task reviews");
  }
};

exports.getPastOpenTasks = async (req, res) => {
  try {
    const { meetingId, userId } = req.body; // id is now an array of task IDs

    const query = `
          SELECT
              t.*,
              u.name as assignee_name,
              u.email as assignee_email,
              m.title as meeting_title,
              m.datetime as meeting_date
          FROM tasks t
          JOIN meetings m ON t.meeting_id = m.id
          LEFT JOIN users u ON t.assigned_id = u.id
          WHERE m.org_id = (SELECT org_id FROM meetings WHERE id = $1)
              AND m.id != $1
              AND m.datetime < NOW()
              AND t.status IN ('Pending', 'Assigned', 'In Progress', 'Ready For Review')
              AND t.assigned_id = $2
              AND t.isdeleted = false
          ORDER BY m.datetime DESC`;

    const result = await pool.query(query, [meetingId, userId]);

    res.json({
      success: true,
      tasks: result.rows,
    });
  } catch (error) {
    console.error("Error fetching past tasks:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch past tasks",
      error: error.message,
    });
  }
};

exports.topAssignees = async (req, res) => {
  try {
    const userId = req.user.id;
    // Get Top People with Tasks are people I assigned Tasks too….
    const query = `
      SELECT
        u.id,
        u.name,
        u.avatar,
        COUNT(t.id) as task_count
      FROM tasks t
      JOIN users u ON t.assigned_id = u.id
      WHERE t.assigned_id IN (
        SELECT assigned_id
        FROM tasks
        WHERE meeting_id IN (
          SELECT id
          FROM meetings
          WHERE org_id = $1
        )
      )
      AND t.isdeleted = false
      AND t.status != 'Completed'
      AND t.status != 'Rated'
      AND t.meeting_id IN (
        SELECT id
        FROM meetings
        WHERE org_id = $1
      )
      GROUP BY u.id, u.name, u.avatar
      ORDER BY task_count DESC
      LIMIT 5`;

    const result = await pool.query(query, [userId]);

    res.json({
      success: true,
      assignees: result.rows,
    });
  } catch (error) {
    console.log("Top Assignees", error);
    res.status(500).json({
      success: false,
      message: error,
    });
  }
};

exports.getPreviousResearch = async (req, res) => {
  const userId = req.user.id;
  try {
    const userEmailResult = (
      await pool.query("SELECT email FROM users WHERE id = $1", [userId])
    ).rows[0].email;

    // Old researches (research_requests)
    const pastResearches = (
      await pool.query(
        `SELECT 
          id, topic, isdeleted, created_at, status, research_file, request_id
         FROM research_requests 
         WHERE user_email = $1 
           AND research_file IS NOT NULL 
           AND isdeleted = false 
         ORDER BY created_at DESC`,
        [userEmailResult]
      )
    ).rows.map((r) => ({
      ...r,
      source: "research", // 👈 Flag for UI
    }));

    // New researches (crm_research + opportunities)
    const opportunitiesResearch = (
      await pool.query(
        `
        SELECT 
          r.id,
          o.name AS topic,
          r.isdeleted,
          r.created_at,
          r.status,
          r.company_research_file AS research_file,
          r.contact_research_file AS contact_research_file,
          r.id as request_id
        FROM opportunities o
        LEFT JOIN crm_research r ON r.opportunity_id = o.id
        WHERE o.owner_id = $1 and r.status='completed' and isdeleted = false 
        ORDER BY o.id ASC, r.created_at DESC
        `,
        [userId]
      )
    ).rows.map((r) => ({
      ...r,
      source: "opportunities", // 👈 Flag for UI
    }));

    // Merge both results
    const allResearches = [...pastResearches, ...opportunitiesResearch];

    // Optional: sort merged list by created_at DESC
    allResearches.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    return res.json({
      success: true,
      researches: allResearches,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error,
    });
  }
};

exports.deleteResearch = async (req, res) => {
  const { requestId, source } = req.body;
  const userId = req.user.id;

  try {
    if (source === 'research') {
      // Get user email to verify ownership
      const userEmailResult = (
        await pool.query("SELECT email FROM users WHERE id = $1", [userId])
      ).rows[0].email;

      // Soft delete the research request
      const result = await pool.query(
        "UPDATE research_requests SET isdeleted = true WHERE id = $1 RETURNING *",
        [requestId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Research request not found or you don't have permission to delete it",
        });
      }
    }
    else {
      const result = await pool.query(
        "UPDATE crm_research SET isdeleted = true WHERE id = $1 RETURNING *",
        [requestId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Research request not found or you don't have permission to delete it",
        });
      }
    }



    res.status(200).json({
      success: true,
      message: "Research request deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting research:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete research request",
    });
  }
};

exports.assigneeTasks = async (req, res) => {
  try {
    //Get tasks by assigneeid is same with assigneeId , and it is open tasks, and it's org id is the same as the user's org id
    const assignedUserId = req.params.assigneeId;
    const userId = req.user.id;

    // const query = `
    //   SELECT
    //     t.*,
    //     m.title as meeting_title
    //   FROM tasks t
    //   JOIN meetings m ON t.meeting_id = m.id
    //   WHERE t.assigned_id = $1
    //   AND t.isdeleted = false
    //   AND t.status != 'Completed'
    //   AND t.status != 'Rated'
    //   AND m.org_id = $2`;
    const query = `
      SELECT
          t.*,
          m.title AS meeting_title
      FROM tasks t
      LEFT JOIN meetings m ON t.meeting_id = m.id AND m.org_id = $2
      WHERE t.assigned_id = $1
        AND t.isdeleted = false
        AND t.status != 'Completed'
        AND t.status != 'Rated'`;

    const result = await pool.query(query, [assignedUserId, userId]);

    res.json({
      success: true,
      tasks: result.rows,
    });
  } catch (error) { }
};

const score_tasks1 = async (taskId) => {
  try {
    const taskQuery = await pool.query(
      `SELECT *
       FROM tasks t
       WHERE t.id = $1`,
      [taskId]
    );

    if (taskQuery.rows.length === 0) {
      return {
        success: false,
        error: "Task not found",
      };
    }

    const task = taskQuery.rows[0];

    // Get company objectives based on task owner's company
    const objectivesQuery = await pool.query(
      `SELECT
        cs.id,
        cs.strategy,
        cs.created_at,
        cs.updated_at,
        c.name as company_name
      FROM tasks t
      JOIN users u ON t.owner_id = u.id
      JOIN company c ON SPLIT_PART(u.email, '@', 2) = c.domain
      JOIN company_strategies cs ON cs.company_id = c.id
      WHERE t.id = $1
      AND cs.is_deleted = false
      ORDER BY cs.created_at DESC`,
      [taskId]
    );

    if (objectivesQuery.rows.length === 0) {
      return {
        success: false,
        errorCode: 2,
        error: "No company objectives found",
      };
    }
    const companyObjectives = objectivesQuery.rows.map((row) => row.strategy);
    const sysprompt =
      "Analyze the task alignment with company objectives and provide a score and reasoning.";
    const userprompt = `
      Calculate a single alignment score for this task against these company objectives:

      Task Title: ${task.title}
      Task Description: ${task.description}

      Company Objectives:
      ${companyObjectives
        .map((obj, index) => `${index + 1}. ${obj}`)
        .join("\n")}

      Please analyze how well this task aligns with the company objectives and provide:
      1. A score from 0-100 indicating the alignment level
      2. A detailed explanation of why this score was given

      Format the response as a JSON object:
      {
        "score": <number 0-100>,
        "reason": "<detailed explanation>"
      }
    `;

    const completion = await processAI(sysprompt, userprompt, 2048);

    let parsedData;
    try {
      const jsonStr = completion.replace(/^[^{]*/g, "").replace(/[^}]*$/g, "");
      parsedData = JSON.parse(jsonStr);
    } catch (error) {
      console.error("Error parsing AI response:", error);
      return {
        success: false,
        errorCode: 3,
        error: "Failed to parse alignment analysis",
      };
    }
    try {
      const updateTaskQuery = `
        UPDATE tasks
        SET alignment_score = $1,
            alignment_reason = $2
        WHERE id = $3
      `;
      await pool.query(updateTaskQuery, [
        parsedData.score,
        parsedData.reason,
        taskId,
      ]);
    } catch (error) {
      console.error("Error updating task:", error);
    }

    return {
      success: true,
      score: parsedData.score,
      reason: parsedData.reason,
    };
  } catch (error) {
    console.error("Error in score_tasks:", error);
    throw new Error("Failed to get company strategies for task");
  }
};

exports.score_tasks = score_tasks1;

exports.scoreTasks = async (req, res) => {
  const { taskId } = req.body;
  try {
    const result = await score_tasks1(taskId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in scoreTasks:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to score tasks",
    });
  }
};

exports.getUserPerformanceCloud = async (req, res) => {
  const { userId, year, quarter } = req.query;
  let quat_start = null;
  let quat_end = null;

  if (year && quarter) {
    quat_start = new Date(year, quarter * 3 - 3, 1);
    quat_end = new Date(year, quarter * 3, 0);
  } else if (year) {
    // If only year is specified, select the entire year
    quat_start = new Date(year, 0, 1); // January 1st
    quat_end = new Date(year, 11, 31); // December 31st
  }
  try {
    // Get all rated tasks
    const result = await pool.query(
      `
      SELECT
        tasks.id,
        tasks.title,
        tasks.description,
        tasks.rate,
        tasks.review
      FROM tasks
      WHERE assigned_id = $1
        AND status = 'Rated'
        AND isdeleted = false
        AND tasks.created_at BETWEEN $2 AND $3
      ORDER BY tasks.created_at DESC
    `,
      [userId, quat_start, quat_end]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        performanceCloud: [],
      });
    }

    // Prepare tasks data for OpenAI
    const tasksText = result.rows
      .map(
        (task) =>
          `TaskId: ${task.id}\nTitle: ${task.title}\nDescription: ${task.description}\nRating: ${task.rate}\nReview: ${task.review}`
      )
      .join("\n\n");
    /*
    // Replace OpenAI call with Bedrock
    const bedrockParams = {
      modelId: "anthropic.claude-v2",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        prompt: `\n\nHuman: Analyze these rated tasks and generate a thematic word cloud summary. Group similar reviews into common themes and create a summary of the top 20 most significant themes. Format the response as a JSON array of objects. Each object should have "text", "value", and "id" properties, where "id" is an array of task IDs that contribute to this theme.

        Reviews to analyze:
        ${tasksText} \n\n

        Rules:
        - Generate maximum 20 themes, focusing on the most significant and frequently occurring concepts
        - Each theme should represent multiple similar reviews where possible
        - Extract common keywords or phrases that represent the theme
        - Value (1-100) should be calculated based on:
          * Number of reviews in the theme
          * Average rating of reviews in the theme
          * Overall significance of the theme
        - Return ONLY the JSON array without any additional text
        - Format each item as {"text": "theme", "value": number, "id": task id array}
        - Don't Output Example Output !!!!
        - Convert one review to one theme

        Example Input format1: (Don't Output Example Output !!!! )
        [
          {Review:"This is high Performance Work", Rating:"4", ID:"1"},
          {Review:"Excellent performance in delivery", Rating:"5", ID:"2"},
          {Review:"Shows great performance", Rating:"4", ID:"3"},
          {Review:"Good communication skills", Rating:"3", ID:"4"}
        ]

        Example Output format1: (Don't Output Example Output !!!! )
        [
          {"text": "performance", "value": 85, "id": ["1", "2", "3"]},
          {"text": "communication", "value": 60, "id": ["4"]}
        ]

        Example Input format2:
        []

        Example Output format2: (Don't Output Example Output !!!! )
        []

        \n\nAssistant: `,
        max_tokens_to_sample: 1024,
        temperature: 0.7,
        anthropic_version: "bedrock-2023-05-31",
      }),
    };

    const command = new InvokeModelCommand(bedrockParams);
    const response = await bedrockClient.send(command);
    const completion = JSON.parse(new TextDecoder().decode(response.body));

*/
    // Extract JSON content more robustly
    const userprompt = `Analyze these rated tasks and generate a thematic word cloud summary. Group similar reviews into common themes and create a summary of the top 20 most significant themes. Format the response as a JSON array of objects. Each object should have "text", "value", and "id" properties, where "id" is an array of task IDs that contribute to this theme.

    Reviews to analyze:
    ${tasksText} \n\n

    Rules:
    - Generate maximum 20 themes with 1~2 words, focusing on the most significant and frequently occurring concepts
    - Each theme should represent multiple similar reviews where possible
    - Extract common keywords or phrases that represent the theme
    - Value (1-100) should be calculated based on:
      * Number of reviews in the theme
      * Average rating of reviews in the theme
      * Overall significance of the theme
    - Return ONLY the JSON array without any additional text
    - Format each item as {"text": "theme", "value": number, "id": task id array}
    - Don't Output Example Output !!!!
    - Convert one review to one theme

    Example Input format1: (Don't Output Example Output !!!! )
    [
      {Review:"This is high Performance Work", Rating:"4", ID:"1"},
      {Review:"Excellent performance in delivery", Rating:"5", ID:"2"},
      {Review:"Shows great performance", Rating:"4", ID:"3"},
      {Review:"Good communication skills", Rating:"3", ID:"4"}
    ]

    Example Output format1: (Don't Output Example Output !!!! )
    [
      {"text": "performance", "value": 85, "id": ["1", "2", "3"]},
      {"text": "communication", "value": 60, "id": ["4"]}
    ]

    Example Input format2:
    []

    Example Output format2: (Don't Output Example Output !!!! )
    []
`;
    const sysprompt = "Generate Word Cloud";
    const completion = await processAI(sysprompt, userprompt, 2048);
    let performanceCloud;
    try {
      // Remove the prefix text and parse the JSON array
      const jsonString = completion.split("[\n")[1].split("\n]")[0];
      const cleanedJsonString = "[" + jsonString + "]";
      performanceCloud = JSON.parse(cleanedJsonString);
    } catch (error) {
      console.error("Error parsing completion:", error);
      performanceCloud = [];
    }

    res.status(200).json({
      success: true,
      performanceCloud,
    });
  } catch (error) {
    return handleError(res, error, "Failed to get performance cloud data");
  }
};

exports.getSummaryOpenTasks = async (req, res) => {
  try {
    const userId = req.body.userId; // Destructuring userId from request body
    console.log("open_task_userId", userId, req.body.userId);

    // Get user's company ID using helper function
    const { getCompanyIdFromUserId } = require("../utils/companyHelper");
    const companyId = await getCompanyIdFromUserId(userId);

    // Import the prompt selector utility
    const { getPromptForCategory } = require("../utils/promptSelector");
    
    // Get prompt configuration (company template or platform default)
    const promptConfig = await getPromptForCategory("open_task_summary", companyId);
    
    // Log which prompt source is being used
    console.log(`Using prompt source: ${promptConfig.source} for company ${companyId} in open task summary generation`);

    // Use the prompt configuration from template or platform default
    const {
      promptContent: sysPrompt,
      model,
      maxtokens,
      apiKey,
      provider,
      source
    } = promptConfig;

    console.log("open_task_summary", model);
    // Query to fetch open tasks assigned to the user
    const tasksResult = await pool.query(
      `
      SELECT tasks.*
      FROM tasks
      WHERE tasks.assigned_id = $1
        AND tasks.isdeleted = FALSE
        AND (tasks.status = 'In Progress' OR tasks.status = 'Assigned')
      `,
      [userId]
    );
    console.log("open_task_summary", tasksResult);

    // Generate a string representation of tasks
    const taskListString = tasksResult.rows.length
      ? tasksResult.rows?.map((task) => JSON.stringify(task)).join(", ")
      : "";
    console.log("taskListString", taskListString, taskListString);
    // Generate prompt for AI processing
    const responsePrompt = await test_prompt(
      sysPrompt,
      taskListString,
      maxtokens,
      provider,
      model
    );

    let summary = "";

    if (
      responsePrompt &&
      responsePrompt.status === true &&
      responsePrompt.preview != "Error fetching from Perplexity API"
    ) {
      // summary = removeMd(responsePrompt.preview);
      summary = responsePrompt.preview;
    }

    return res.status(200).json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("Error in getSummaryOpenTasks:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching task summary.",
    });
  }
};

exports.getMonthlyReviewRatingYTD = async (req, res) => {
  let userId = req.user.id;
  const { userId: userIdParams } = req.body;

  if (userIdParams) {
    userId = userIdParams;
  }

  //Get review rating from tasks table Monthly
  const quat_start = new Date(new Date().getFullYear(), 0, 1);
  const quat_end = new Date(new Date().getFullYear(), 11, 31);

  try {
    //Get review rating MoM data
    //So need to group by month
    const result = await pool.query(
      `
    SELECT
      EXTRACT(MONTH FROM created_at) AS month,
      AVG(rate) AS average_rating,
      COUNT(*) AS review_count
    FROM tasks
    WHERE assigned_id = $1
      AND status = 'Rated'
      AND isdeleted = false
      AND created_at BETWEEN $2 AND $3
    GROUP BY EXTRACT(MONTH FROM created_at)
    ORDER BY month ASC
    `,
      [userId, quat_start, quat_end]
    );

    // Create a map of existing data by month
    const existingDataMap = {};
    result.rows.forEach((row) => {
      existingDataMap[parseInt(row.month)] = {
        month: parseInt(row.month),
        rating: parseFloat(row.average_rating),
        average_rating: parseFloat(row.average_rating),
        review_count: parseInt(row.review_count),
      };
    });

    // Transform data to include ALL 12 months
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    // Create complete dataset with all 12 months
    const completeData = [];
    for (let month = 1; month <= 12; month++) {
      const monthData = existingDataMap[month] || {
        month: month,
        rating: 0,
        average_rating: 0,
        review_count: 0,
      };

      completeData.push({
        ...monthData,
        month_name: monthNames[month - 1],
      });
    }

    console.log("Complete monthly review rating data:", completeData);

    return res.status(200).json({
      success: true,
      data: completeData,
    });
  } catch (error) {
    console.error("Error in getMonthlyReviewRatingYTD:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching monthly review rating YTD.",
    });
  }
};

exports.getTimeOnTasksWithAIEstimates = async (req, res) => {
  let userId = req.user.id;
  const { userId: userIdParams } = req.body;

  if (userIdParams) {
    userId = userIdParams;
  }

  try {
    // Get current date range (today only)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1); // Start of tomorrow

    console.log("Date range for today's tasks:", {
      today: today.toISOString(),
      tomorrow: tomorrow.toISOString(),
      userId: userId,
    });

    // Get completed tasks for TODAY ONLY with their AI time estimates
    const completedTasksQuery = `
      SELECT
        t.id,
        t.title,
        t.average_time,
        t.completed_at,
        t.status
      FROM tasks t
      WHERE t.assigned_id = $1
        AND t.isdeleted = false
        AND (t.status = 'Completed' OR t.status = 'Rated')
        AND t.completed_at IS NOT NULL
    `;

    const completedResult = await pool.query(completedTasksQuery, [userId]);

    console.log("Completed tasks for today:", completedResult.rows);

    // Calculate total time based on AI estimates (convert days to hours: 1 day = 8 hours)
    const completedTasks = completedResult.rows;
    const totalEstimatedDays = completedTasks.reduce((sum, task) => {
      const estimatedDays = parseFloat(task.average_time) || 0;
      return sum + estimatedDays;
    }, 0);

    const totalEstimatedHours = totalEstimatedDays * 8; // Convert days to 8-hour work days
    const hours = Math.floor(totalEstimatedHours);
    const minutes = Math.round((totalEstimatedHours - hours) * 60);

    console.log("Calculation results:", {
      totalEstimatedDays,
      totalEstimatedHours,
      hours,
      minutes,
      tasksCount: completedTasks.length,
    });

    res.status(200).json({
      success: true,
      data: {
        hours,
        minutes,
        totalEstimatedDays: Math.round(totalEstimatedDays * 10) / 10, // Round to 1 decimal
        tasksCompleted: completedTasks.length,
        period: "today",
        dateRange: {
          from: today.toISOString().split("T")[0],
          to: today.toISOString().split("T")[0],
        },
        tasks: completedTasks.map((task) => ({
          id: task.id,
          title: task.title,
          estimatedDays: parseFloat(task.average_time) || 0,
          completedAt: task.completed_at,
          status: task.status,
        })),
      },
    });
  } catch (error) {
    console.error("Error calculating time on tasks with AI estimates:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate time on tasks with AI estimates",
      error: error.message,
    });
  }
}; // Update a message in a task thread
exports.updateMessage = async (req, res) => {
  const { threadId, message } = req.body;
  const userId = req.user.id;

  try {
    // Check if the thread exists and belongs to the user
    const threadResult = await pool.query(
      "SELECT * FROM task_threads WHERE id = $1",
      [threadId]
    );

    if (threadResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Thread not found",
      });
    }

    const thread = threadResult.rows[0];

    // Check if the user is the author of the message
    if (thread.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this message",
      });
    }

    // Update the message
    await pool.query(
      "UPDATE task_threads SET task_message = $1 WHERE id = $2",
      [message, threadId]
    );

    res.status(200).json({
      success: true,
      message: "Message updated successfully",
    });
  } catch (error) {
    return handleError(res, error, "Failed to update message");
  }
};

// Delete a message from a task thread
exports.deleteMessage = async (req, res) => {
  const { threadId } = req.body;
  const userId = req.user.id;

  try {
    // Check if the thread exists and belongs to the user
    const threadResult = await pool.query(
      "SELECT * FROM task_threads WHERE id = $1",
      [threadId]
    );

    if (threadResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Thread not found",
      });
    }

    const thread = threadResult.rows[0];

    // Check if the user is the author of the message
    if (thread.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this message",
      });
    }

    // Soft delete the message by setting isdeleted to true
    await pool.query("UPDATE task_threads SET isdeleted = true WHERE id = $1", [
      threadId,
    ]);

    res.status(200).json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    return handleError(res, error, "Failed to delete message");
  }
};

exports.getCostData = async (req, res) => {
  const { year, quat, company, isYTD } = req.body;
  let quat_start = null;
  let quat_end = null;

  if (year) {
    if (isYTD) {
      // For YTD, set start to January 1st and end to December 31st
      quat_start = new Date(year, 0, 1);
      quat_end = new Date(year, 11, 31);
    } else if (quat) {
      // For quarterly view
      quat_start = new Date(year, quat * 3 - 3, 1);
      quat_end = new Date(year, quat * 3, 0);
    }
  }

  try {
    let costData;

    if (company) {
      // Get cost data for specific company
      costData = await pool.query(
        `
        WITH company_info AS (
          SELECT domain
          FROM company
          WHERE id = $3
        ),
        meeting_costs AS (
          SELECT
            DATE_TRUNC('month', m.datetime) as month,
            SUM(COALESCE((m.duration / 60.0) * total_participant_cph, 0)) as meeting_cost
          FROM meetings m
          CROSS JOIN company_info ci
          JOIN (
            SELECT
              meeting_id,
              SUM(COALESCE(cr.est_cph, 0)) as total_participant_cph
            FROM meeting_participants mp
            JOIN users u ON mp.user_id = u.id
            LEFT JOIN company_roles cr ON u.company_role = cr.id
            GROUP BY meeting_id
          ) participant_costs ON m.id = participant_costs.meeting_id
          JOIN users organizer ON m.org_id = organizer.id
          WHERE SPLIT_PART(organizer.email, '@', 2) = ci.domain
            AND m.isdeleted = false
            AND m.datetime BETWEEN $1 AND $2
          GROUP BY DATE_TRUNC('month', m.datetime)
        ),
        task_costs AS (
          SELECT
            DATE_TRUNC('month', t.created_at) as month,
            SUM(COALESCE(t.estimated_hours * cr.est_cph, 0)) as task_cost
          FROM tasks t
          JOIN meetings m ON t.meeting_id = m.id
          JOIN users u ON t.assigned_id = u.id
          JOIN company_roles cr ON u.company_role = cr.id
          JOIN users organizer ON m.org_id = organizer.id
          CROSS JOIN company_info ci
          WHERE SPLIT_PART(organizer.email, '@', 2) = ci.domain
            AND t.isdeleted = false
            AND t.created_at BETWEEN $1 AND $2
            AND t.estimated_hours IS NOT NULL
            AND cr.est_cph IS NOT NULL
          GROUP BY DATE_TRUNC('month', t.created_at)
        )
        SELECT
          COALESCE(mc.month, tc.month) as month,
          COALESCE(mc.meeting_cost, 0) as meeting_cost,
          COALESCE(tc.task_cost, 0) as task_cost,
          COALESCE(mc.meeting_cost, 0) + COALESCE(tc.task_cost, 0) as total_cost
        FROM meeting_costs mc
        FULL OUTER JOIN task_costs tc ON mc.month = tc.month
        ORDER BY month
        `,
        [quat_start, quat_end, company]
      );
    } else {
      // Get cost data for all companies
      costData = await pool.query(
        `
        WITH meeting_costs AS (
          SELECT
            DATE_TRUNC('month', m.datetime) as month,
            SUM(COALESCE((m.duration / 60.0) * total_participant_cph, 0)) as meeting_cost
          FROM meetings m
          JOIN (
            SELECT
              meeting_id,
              SUM(COALESCE(cr.est_cph, 0)) as total_participant_cph
            FROM meeting_participants mp
            JOIN users u ON mp.user_id = u.id
            LEFT JOIN company_roles cr ON u.company_role = cr.id
            GROUP BY meeting_id
          ) participant_costs ON m.id = participant_costs.meeting_id
          WHERE m.isdeleted = false
            AND m.datetime BETWEEN $1 AND $2
          GROUP BY DATE_TRUNC('month', m.datetime)
        ),
        task_costs AS (
          SELECT
            DATE_TRUNC('month', t.created_at) as month,
            SUM(COALESCE(t.estimated_hours * cr.est_cph, 0)) as task_cost
          FROM tasks t
          JOIN users u ON t.assigned_id = u.id
          JOIN company_roles cr ON u.company_role = cr.id
          WHERE t.isdeleted = false
            AND t.created_at BETWEEN $1 AND $2
            AND t.estimated_hours IS NOT NULL
            AND cr.est_cph IS NOT NULL
          GROUP BY DATE_TRUNC('month', t.created_at)
        )
        SELECT
          COALESCE(mc.month, tc.month) as month,
          COALESCE(mc.meeting_cost, 0) as meeting_cost,
          COALESCE(tc.task_cost, 0) as task_cost,
          COALESCE(mc.meeting_cost, 0) + COALESCE(tc.task_cost, 0) as total_cost
        FROM meeting_costs mc
        FULL OUTER JOIN task_costs tc ON mc.month = tc.month
        ORDER BY month
        `,
        [quat_start, quat_end]
      );
    }

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    let labels = [];
    let monthCosts = [];

    if (isYTD) {
      // For YTD, we need all 12 months
      labels = months;
      monthCosts = Array(12).fill(0); // Initialize array for 12 months

      costData.rows.forEach((row) => {
        const monthIndex = new Date(row.month).getMonth(); // Get month index (0-11)
        monthCosts[monthIndex] = parseFloat(row.total_cost) || 0;
      });
    } else {
      // For quarterly view
      labels = [
        months[quat * 3 - 3], // First month of quarter (e.g., 'Jan')
        months[quat * 3 - 2], // Second month of quarter (e.g., 'Feb')
        months[quat * 3 - 1], // Third month of quarter (e.g., 'Mar')
      ];
      monthCosts = Array(3).fill(0); // Initialize array for 3 months

      costData.rows.forEach((row) => {
        const monthIndex = new Date(row.month).getMonth() % 3; // Get index (0-2) within quarter
        monthCosts[monthIndex] = parseFloat(row.total_cost) || 0;
      });
    }

    const costChartData = {
      labels: labels,
      datasets: [
        {
          label: "Cost",
          data: monthCosts,
          borderColor: "#3B82F6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
        },
      ],
    };

    res.status(200).json({
      status: true,
      cost: costChartData,
    });
  } catch (error) {
    console.error("Error getting cost data:", error);
    return res.status(500).json({
      status: false,
      error: "Failed to get cost data",
    });
  }
};

exports.getTopNonAlignedMeetings = async (req, res) => {
  const { year, quat, company, isYTD } = req.body;
  let quat_start = null;
  let quat_end = null;

  if (year) {
    if (isYTD) {
      quat_start = new Date(year, 0, 1);
      quat_end = new Date(year, 11, 31);
    } else if (quat) {
      quat_start = new Date(year, quat * 3 - 3, 1);
      quat_end = new Date(year, quat * 3, 0);
    }
  }

  try {
    let nonAlignedMeetings;
    if (company) {
      // Company-specific query
      nonAlignedMeetings = await pool.query(
        `
        WITH company_info AS (
          SELECT domain FROM company WHERE id = $3
        ),
        company_tasks AS (
          SELECT t.*, m.title as meeting_title, m.duration, m.datetime
          FROM tasks t
          JOIN meetings m ON t.meeting_id = m.id
          JOIN users u ON m.org_id = u.id
          CROSS JOIN company_info ci
          WHERE SPLIT_PART(u.email, '@', 2) = ci.domain
            AND t.isdeleted = false
            AND m.isdeleted = false
            AND t.meeting_id IS NOT NULL
            AND t.alignment_score IS NOT NULL
            AND t.created_at BETWEEN $1 AND $2
        ),
        meeting_scores AS (
          SELECT
            meeting_id,
            meeting_title,
            AVG(alignment_score) as avg_alignment_score,
            MAX(duration) as duration,
            MAX(datetime) as datetime
          FROM company_tasks
          GROUP BY meeting_id, meeting_title
        ),
        meeting_costs AS (
          SELECT
            ms.meeting_id as id,
            ms.meeting_title as title,
            ms.avg_alignment_score,
            ms.duration,
            ms.datetime,
            COALESCE((ms.duration / 60.0) * total_participant_cph, 0) as estimated_cost
          FROM meeting_scores ms
          JOIN (
            SELECT
              meeting_id,
              SUM(COALESCE(cr.est_cph, 0)) as total_participant_cph
            FROM meeting_participants mp
            JOIN users u ON mp.user_id = u.id
            LEFT JOIN company_roles cr ON u.company_role = cr.id
            GROUP BY meeting_id
          ) participant_costs ON ms.meeting_id = participant_costs.meeting_id
        )
        SELECT id, title, avg_alignment_score, estimated_cost, duration, datetime
        FROM meeting_costs
        WHERE avg_alignment_score IS NOT NULL
        ORDER BY avg_alignment_score ASC, estimated_cost DESC
        LIMIT 5
        `,
        [quat_start, quat_end, company]
      );
    } else {
      // Global query
      nonAlignedMeetings = await pool.query(
        `
        WITH task_scores AS (
          SELECT t.*, m.title as meeting_title, m.duration, m.datetime
          FROM tasks t
          JOIN meetings m ON t.meeting_id = m.id
          WHERE t.isdeleted = false
            AND m.isdeleted = false
            AND t.meeting_id IS NOT NULL
            AND t.alignment_score IS NOT NULL
            AND t.created_at BETWEEN $1 AND $2
        ),
        meeting_scores AS (
          SELECT
            meeting_id,
            meeting_title,
            AVG(alignment_score) as avg_alignment_score,
            MAX(duration) as duration,
            MAX(datetime) as datetime
          FROM task_scores
          GROUP BY meeting_id, meeting_title
        ),
        meeting_costs AS (
          SELECT
            ms.meeting_id as id,
            ms.meeting_title as title,
            ms.avg_alignment_score,
            ms.duration,
            ms.datetime,
            COALESCE((ms.duration / 60.0) * total_participant_cph, 0) as estimated_cost
          FROM meeting_scores ms
          JOIN (
            SELECT
              meeting_id,
              SUM(COALESCE(cr.est_cph, 0)) as total_participant_cph
            FROM meeting_participants mp
            JOIN users u ON mp.user_id = u.id
            LEFT JOIN company_roles cr ON u.company_role = cr.id
            GROUP BY meeting_id
          ) participant_costs ON ms.meeting_id = participant_costs.meeting_id
        )
        SELECT id, title, avg_alignment_score, estimated_cost, duration, datetime
        FROM meeting_costs
        WHERE avg_alignment_score IS NOT NULL
        ORDER BY avg_alignment_score ASC, estimated_cost DESC
        LIMIT 5
        `,
        [quat_start, quat_end]
      );
    }

    const formatted = nonAlignedMeetings.rows.map((row, idx) => ({
      id: row.id,
      title: row.title,
      averageAlignmentScore: Math.round(row.avg_alignment_score * 100) / 100,
      cost: Math.round(row.estimated_cost * 100) / 100,
      duration: row.duration,
      datetime: row.datetime,
      rank: idx + 1,
    }));

    res.status(200).json({
      status: true,
      nonAlignedMeetings: formatted,
    });
  } catch (error) {
    console.error("Error getting non aligned meetings:", error);
    return res.status(500).json({
      status: false,
      error: "Failed to get non aligned meetings data",
    });
  }
};

exports.getTopRatedUsers = async (req, res) => {
  const { year, quat, company, isYTD } = req.body;
  let quat_start = null;
  let quat_end = null;

  if (year) {
    if (isYTD) {
      quat_start = new Date(year, 0, 1);
      quat_end = new Date(year, 11, 31);
    } else if (quat) {
      quat_start = new Date(year, quat * 3 - 3, 1);
      quat_end = new Date(year, quat * 3, 0);
    }
  }

  try {
    let topRatedUsers;
    if (company) {
      // Company-specific query
      topRatedUsers = await pool.query(
        `
        WITH company_info AS (
          SELECT domain FROM company WHERE id = $3
        )
        SELECT
          u.id,
          u.name,
          u.avatar,
          AVG(t.rate) AS avg_rating,
          COUNT(t.id) AS rated_tasks
        FROM users u
        JOIN tasks t ON t.assigned_id = u.id
        JOIN meetings m ON t.meeting_id = m.id
        JOIN users orgu ON m.org_id = orgu.id
        CROSS JOIN company_info ci
        WHERE SPLIT_PART(orgu.email, '@', 2) = ci.domain
          AND t.status = 'Rated'
          AND t.rate IS NOT NULL
          AND t.created_at BETWEEN $1 AND $2
        GROUP BY u.id, u.name, u.avatar
        HAVING COUNT(t.id) > 0
        ORDER BY avg_rating DESC, rated_tasks DESC
        LIMIT 5
        `,
        [quat_start, quat_end, company]
      );
    } else {
      // Global query
      topRatedUsers = await pool.query(
        `
        SELECT
          u.id,
          u.name,
          u.avatar,
          AVG(t.rate) AS avg_rating,
          COUNT(t.id) AS rated_tasks
        FROM users u
        JOIN tasks t ON t.assigned_id = u.id
        WHERE t.status = 'Rated'
          AND t.rate IS NOT NULL
          AND t.created_at BETWEEN $1 AND $2
        GROUP BY u.id, u.name, u.avatar
        HAVING COUNT(t.id) > 0
        ORDER BY avg_rating DESC, rated_tasks DESC
        LIMIT 5
        `,
        [quat_start, quat_end]
      );
    }

    const formatted = topRatedUsers.rows.map((row, idx) => ({
      id: row.id,
      name: row.name,
      avatar: row.avatar,
      averageRating: Math.round(row.avg_rating * 100) / 100,
      ratedTasks: row.rated_tasks,
      rank: idx + 1,
    }));

    res.status(200).json({
      status: true,
      topRatedUsers: formatted,
    });
  } catch (error) {
    console.error("Error getting top rated users:", error);
    return res.status(500).json({
      status: false,
      error: "Failed to get top rated users data",
    });
  }
};

// Get Priority Work tasks (New This Week, High Priority, High Score)
exports.getPriorityWork = async (req, res) => {
  const userId = req.user.id;
  try {
    // Calculate date 7 days ago
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const priorityWorkQuery = await pool.query(
      `
      SELECT 
        t.id,
        t.title,
        t.description,
        t.duedate,
        t.status,
        t.priority,
        t.alignment_score as score,
        t.estimated_hours,
        t.created_at,
        u.name as assignee_name,
        u.id as assignee_id,
        u.email as assignee_email
      FROM tasks t
      LEFT JOIN users u ON t.assigned_id = u.id
      LEFT JOIN meetings m ON t.meeting_id = m.id
      WHERE t.assigned_id = $1 
        AND t.isdeleted = false 
        AND t.status IN ('Pending', 'Assigned', 'In Progress', 'Ready For Review')
        AND (t.meeting_id IS NULL OR (t.meeting_id IS NOT NULL AND m.isdeleted = FALSE))
        AND t.created_at >= $2
        AND (t.priority = 'High' OR t.alignment_score >= 80)
      ORDER BY 
        CASE WHEN t.priority = 'High' THEN 1 ELSE 2 END,
        t.alignment_score DESC NULLS LAST,
        t.duedate ASC NULLS LAST
      LIMIT 10
    `,
      [userId, oneWeekAgo]
    );

    res.status(200).json({
      success: true,
      tasks: priorityWorkQuery.rows,
    });
  } catch (error) {
    return handleError(res, error, "Failed to get priority work tasks");
  }
};

// Get person who can help most on a task
exports.getTaskHelper = async (req, res) => {
  const { taskId } = req.body;
  const userId = req.user.id;

  try {
    // Get threshold for similarity matching
    const thresholdQuery = await pool.query(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'threshold'`
    );
    const threshold =
      thresholdQuery.rows.length > 0
        ? parseInt(thresholdQuery.rows[0].setting_value) / 100
        : 0.3; // Default 30%

    // Get the current task's details
    const taskQuery = await pool.query(
      `SELECT title, description FROM tasks WHERE id = $1 AND assigned_id = $2`,
      [taskId, userId]
    );

    if (taskQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const task = taskQuery.rows[0];
    await pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

    // Find similar completed tasks and get the assignee who completed them
    const helperQuery = await pool.query(
      `
      WITH user_company AS (
        SELECT SPLIT_PART(email, '@', 2) as domain
        FROM users
        WHERE id = $1
      ),
      similarity_scores AS (
        SELECT
          t.id,
          t.assigned_id,
          u.name as assignee_name,
          u.id as assignee_id,
          u.email as assignee_email,
          u.avatar as assignee_avatar,
          COUNT(*) as task_count,
          AVG(t.rate) as avg_rating,
          (
            similarity(COALESCE(t.title, ''), $3::text) +
            similarity(COALESCE(t.description, ''), $4::text)
          ) / 2 as match_score
        FROM tasks t
        LEFT JOIN users u ON t.assigned_id = u.id
        JOIN user_company uc ON SPLIT_PART(u.email, '@', 2) = uc.domain
        WHERE t.id <> $2
          AND t.status IN ('Completed', 'Rated')
          AND t.isdeleted = false
          AND t.assigned_id IS NOT NULL
        GROUP BY t.assigned_id, u.name, u.id, u.email, u.avatar, t.title, t.description
        HAVING (
          similarity(COALESCE(t.title, ''), $3::text) +
          similarity(COALESCE(t.description, ''), $4::text)
        ) / 2 >= $5
      )
      SELECT 
        assignee_id,
        assignee_name,
        assignee_email,
        assignee_avatar,
        MAX(match_score) as best_match_score,
        SUM(task_count) as total_similar_tasks,
        AVG(avg_rating) as avg_rating
      FROM similarity_scores
      GROUP BY assignee_id, assignee_name, assignee_email, assignee_avatar
      ORDER BY best_match_score DESC, total_similar_tasks DESC, avg_rating DESC
      LIMIT 1
    `,
      [userId, taskId, task.title || "", task.description || "", threshold]
    );

    if (helperQuery.rows.length === 0) {
      return res.status(200).json({
        success: true,
        helper: null,
        message: "No similar task history found to suggest a helper",
      });
    }

    res.status(200).json({
      success: true,
      helper: helperQuery.rows[0],
    });
  } catch (error) {
    return handleError(res, error, "Failed to get task helper");
  }
};

// Auto-schedule task on calendar
exports.autoScheduleTask = async (req, res) => {
  const { taskId } = req.body;
  const userId = req.user.id;
  const userEmail = req.user.email;

  try {
    // Get task details
    const taskQuery = await pool.query(
      `SELECT title, description, estimated_hours, duedate FROM tasks WHERE id = $1 AND assigned_id = $2`,
      [taskId, userId]
    );

    if (taskQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const task = taskQuery.rows[0];
    const estimatedHours = task.estimated_hours || 1; // Default to 1 hour if not set
    const durationMinutes = Math.ceil(estimatedHours * 60); // Convert hours to minutes

    // Call the meeting API endpoint internally
    try {
      const scheduleResponse = await axios.post(
        `${process.env.API_BASE_URL || process.env.REACT_APP_API_URL}/api/meeting/schedule-meeting`,
        {
          title: `Work on: ${task.title}`,
          description: task.description || `Task: ${task.title}\n\nLink to task: ${process.env.FRONTEND_URL || process.env.REACT_APP_API_URL?.replace('/api', '') || ''}/task-details?id=${taskId}`,
          userEmail: userEmail,
          attendees: [], // No attendees for task work time
          datetime: task.duedate ? new Date(task.duedate).toISOString() : null,
          duration: durationMinutes,
        },
        {
          headers: {
            Authorization: req.headers.authorization || `Bearer ${req.headers['x-api-key'] || ''}`,
            'Content-Type': 'application/json',
            'x-api-key': process.env.REST_API_KEY,
          },
          timeout: 30000,
        }
      );

      if (scheduleResponse.data && scheduleResponse.data.success) {
        return res.status(200).json({
          success: true,
          message: "Task scheduled on calendar successfully",
          meeting: scheduleResponse.data.meeting || scheduleResponse.data,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: scheduleResponse.data?.message || "Failed to schedule task",
        });
      }
    } catch (apiError) {
      console.error('Error calling schedule meeting API:', apiError.response?.data || apiError.message);
      return res.status(500).json({
        success: false,
        error: "Failed to auto-schedule task",
        message: apiError.response?.data?.message || apiError.message,
      });
    }
  } catch (error) {
    console.error("Error auto-scheduling task:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to auto-schedule task",
      message: error.message,
    });
  }
};

// Match workflow to task based on title and description
exports.matchWorkflowToTask = async (req, res) => {
  const { taskId } = req.body;
  const userId = req.user.id;

  try {
    // Get task details
    const taskQuery = await pool.query(
      `SELECT title, description FROM tasks WHERE id = $1 AND assigned_id = $2`,
      [taskId, userId]
    );

    if (taskQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const task = taskQuery.rows[0];

    // Search for workflows that match the task title/description
    // This is a simplified version - you may want to use AI/ML for better matching
    const workflowQuery = await pool.query(
      `
      SELECT 
        w.id,
        w.name,
        w.description,
        (
          similarity(COALESCE(w.name, ''), $1::text) +
          similarity(COALESCE(w.description, ''), $2::text)
        ) / 2 as match_score
      FROM workflows w
      WHERE w.user_id = $3
        AND w.isdeleted = false
      ORDER BY match_score DESC
      LIMIT 5
    `,
      [task.title || "", task.description || "", userId]
    );

    await pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

    if (workflowQuery.rows.length === 0) {
      return res.status(200).json({
        success: true,
        workflows: [],
        message: "No matching workflows found",
      });
    }

    // Filter workflows with match score >= 0.3 (30% similarity)
    const matchingWorkflows = workflowQuery.rows.filter(
      (w) => w.match_score >= 0.3
    );

    res.status(200).json({
      success: true,
      workflows: matchingWorkflows,
    });
  } catch (error) {
    return handleError(res, error, "Failed to match workflow to task");
  }
};

// ==================== CRM OPPORTUNITY TASKS ====================

/**
 * Get tasks for a specific CRM opportunity
 * Supports pagination, sorting by due date and priority
 */
exports.getOpportunityTasks = async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      sortBy = 'duedate', 
      sortOrder = 'asc' 
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Validate sort parameters
    const validSortFields = ['duedate', 'priority', 'created_at', 'title', 'status'];
    const validSortOrders = ['asc', 'desc'];
    
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'duedate';
    const safeSortOrder = validSortOrders.includes(sortOrder.toLowerCase()) ? sortOrder.toLowerCase() : 'asc';

    // Priority sorting needs special handling (High > Medium > Low)
    let orderClause;
    if (safeSortBy === 'priority') {
      orderClause = `
        CASE priority 
          WHEN 'High' THEN 1 
          WHEN 'Medium' THEN 2 
          WHEN 'Low' THEN 3 
          ELSE 4 
        END ${safeSortOrder === 'desc' ? 'DESC' : 'ASC'},
        duedate ASC NULLS LAST
      `;
    } else {
      orderClause = `${safeSortBy} ${safeSortOrder} NULLS LAST`;
    }

    // Get tasks with pagination
    const tasksQuery = await pool.query(
      `SELECT 
        t.id,
        t.title,
        t.description,
        t.duedate,
        t.priority,
        t.status,
        t.assigned_id,
        t.assigned_name,
        t.owner_id,
        t.owner_name,
        t.created_at,
        t.category,
        t.estimated_hours,
        u.name as assignee_name,
        u.email as assignee_email,
        u.avatar as assignee_avatar
      FROM tasks t
      LEFT JOIN users u ON t.assigned_id = u.id
      WHERE t.crm_opportunity_id = $1 
        AND t.isdeleted = false
      ORDER BY ${orderClause}
      LIMIT $2 OFFSET $3`,
      [opportunityId, parseInt(limit), offset]
    );

    // Get total count for pagination
    const countQuery = await pool.query(
      `SELECT COUNT(*) as total 
       FROM tasks 
       WHERE crm_opportunity_id = $1 AND isdeleted = false`,
      [opportunityId]
    );

    const total = parseInt(countQuery.rows[0].total);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.status(200).json({
      success: true,
      tasks: tasksQuery.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasMore: parseInt(page) < totalPages
      }
    });
  } catch (error) {
    return handleError(res, error, "Failed to fetch opportunity tasks");
  }
};

/**
 * Create a task linked to a CRM opportunity
 */
exports.createOpportunityTask = async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const {
      title,
      description,
      dueDate,
      priority,
      assigned_id,
      estimated_hours
    } = req.body;
    const userId = req.user.id;
    const userName = req.user.name;

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        error: "Title is required"
      });
    }

    // Get assignee info if provided
    let assigneeName = null;
    if (assigned_id) {
      const assigneeResult = await pool.query(
        "SELECT name FROM users WHERE id = $1",
        [assigned_id]
      );
      if (assigneeResult.rows.length > 0) {
        assigneeName = assigneeResult.rows[0].name;
      }
    }

    // Insert the task
    const result = await pool.query(
      `INSERT INTO tasks (
        crm_opportunity_id,
        title,
        description,
        duedate,
        priority,
        assigned_id,
        assigned_name,
        status,
        owner_id,
        owner_name,
        estimated_hours,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING *`,
      [
        opportunityId,
        title,
        description || null,
        dueDate || null,
        priority || 'Medium',
        assigned_id || null,
        assigneeName,
        assigned_id ? 'Assigned' : 'Pending',
        userId,
        userName,
        estimated_hours || null
      ]
    );

    // Send notification if task is assigned
    if (assigned_id && assigned_id !== userId) {
      try {
        const notificationMessage = `${userName} assigned you a task: "${title}"`;
        const notificationLink = `/task-details?taskId=${result.rows[0].id}`;
        
        await pool.query(
          `INSERT INTO notifications (user_id, notification, link, checked, created_at)
           VALUES ($1, $2, $3, false, NOW())`,
          [assigned_id, notificationMessage, notificationLink]
        );

        // Send real-time notification
        sendNotification(assigned_id, {
          type: 'notification',
          notification: {
            user_id: assigned_id,
            notification: notificationMessage,
            link: notificationLink
          }
        });
      } catch (notifError) {
        // Log notification error but don't fail the task creation
        console.error('Error sending notification:', notifError);
      }
    }

    res.status(201).json({
      success: true,
      task: result.rows[0],
      message: "Task created successfully"
    });
  } catch (error) {
    return handleError(res, error, "Failed to create opportunity task");
  }
};

/**
 * Link an existing task to a CRM opportunity
 */
exports.linkTaskToOpportunity = async (req, res) => {
  try {
    const { taskId, opportunityId } = req.body;

    if (!taskId || !opportunityId) {
      return res.status(400).json({
        success: false,
        error: "Task ID and Opportunity ID are required"
      });
    }

    const result = await pool.query(
      `UPDATE tasks 
       SET crm_opportunity_id = $1 
       WHERE id = $2 AND isdeleted = false
       RETURNING *`,
      [opportunityId, taskId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Task not found"
      });
    }

    res.status(200).json({
      success: true,
      task: result.rows[0],
      message: "Task linked to opportunity successfully"
    });
  } catch (error) {
    return handleError(res, error, "Failed to link task to opportunity");
  }
};

/**
 * Unlink a task from a CRM opportunity
 */
exports.unlinkTaskFromOpportunity = async (req, res) => {
  try {
    const { taskId } = req.params;

    const result = await pool.query(
      `UPDATE tasks 
       SET crm_opportunity_id = NULL 
       WHERE id = $1 AND isdeleted = false
       RETURNING *`,
      [taskId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Task not found"
      });
    }

    res.status(200).json({
      success: true,
      task: result.rows[0],
      message: "Task unlinked from opportunity successfully"
    });
  } catch (error) {
    return handleError(res, error, "Failed to unlink task from opportunity");
  }
};