const pool = require('../config/database')
const {
  fetchAvailableVoices,
  availableVoices,
  getAvailableVoicesVar,
} = require('../utils/available-voices')
const { handleError } = require('../utils/errorHandler')
const { processAI } = require('../utils/llmservice')
const AWS = require('aws-sdk')
const multer = require('multer')

// Configure S3
const s3 = new AWS.S3()

// Configure multer for memory storage (for S3 upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Not an image! Please upload an image.'), false)
    }
  },
})

exports.getChatHistory = async (req, res) => {
  const userId = req.user.id
  try {
    await formatChatHistory()
    const result = await pool.query(
      `SELECT * FROM agent_chats
             WHERE user_id = $1
             ORDER BY created_at ASC`,
      [userId]
    )
    res.json({
      success: true,
      messages: result.rows,
    })
  } catch (error) {
    return handleError(res, error, 'Failed to fetch chat history')
  }
}

exports.getAllAssignedTask = async (req, res) => {
  console.log(req, 'jifhdf23432', req.query.userId, req.query)
  const userId = req?.user?.id || req.query.userId

  try {
    // 🔹 Fetch tasks assigned to the user and not deleted
    const filteredTaskResult = await pool.query(
      `
        SELECT *
        FROM tasks t
        WHERE t.assigned_id = $1
          AND t.isdeleted = false
          AND t.status IN ('Pending', 'Assigned', 'In Progress', 'Ready For Review')
      `,
      [userId]
    )

    // 🔹 Fetch opportunities in closed-won and closed-lost stages created by the user
    const openOpportunityQuery = `
      SELECT
        os.id AS stage_id,
        os.name AS stage_name,
        os.description AS stage_description,
        os.order_index,
        os.is_closed_won,
        os.is_closed_lost,
        op.id AS opp_id,
        op.name AS opp_name,
        op.account_id,
        op.amount,
        op.expected_close_date,
        op.actual_close_date,
        op.probability,
        op.description AS opp_description,
        op.lead_source,
        op.custom_fields,
        op.stage AS opp_stage,
        op.owner_id,
        op.created_by,
        op.updated_by
      FROM opportunity_stages os
      INNER JOIN opportunities op ON os.id = op.stage_id
      WHERE os.is_closed_won = FALSE
        AND os.is_closed_lost = FALSE
         AND os.is_active = TRUE
        AND op.owner_id = $1
    `
    const openOpportunityResult = await pool.query(openOpportunityQuery, [
      userId,
    ])

    // 🔹 Fetch pending approvals for current user

    const approveListQuery = `
      SELECT
        wni.id as node_instance_id,
        wni.node_id,
        wni.workflow_instance_id,
        wni.status as node_status,
        wni.node_type,
        wn.name as node_name,
        wn.config as node_config,
        wi.name AS workflow_name,
        wi.status AS workflow_status,
        wi.created_at AS workflow_created_at,
        wi.workflow_id AS workflow_definition_id
      FROM workflow_node_instances wni
      LEFT JOIN workflow_nodes wn ON wni.workflow_node_id = wn.id
      JOIN workflow_instances wi ON wni.workflow_instance_id = wi.id
      WHERE wni.status = 'waiting_user_input'
        AND wni.node_type = 'approvalNode'
        AND (wni.data->>'userId')::int = $1
      ORDER BY wi.created_at DESC
      LIMIT 5
    `
    const approveListResult = await pool.query(approveListQuery, [userId])

    // ✅ Return the response
    res.json({
      success: true,
      data: {
        // openTask: filteredTaskResult.rows,
        // openOpportunity: openOpportunityResult.rows,
        // approveList: approveListResult.rows,

        openTask: filteredTaskResult.rows.slice(0, 5),
        openOpportunity: openOpportunityResult.rows.slice(0, 5),
        approveList: approveListResult.rows.slice(0, 5),
      },
    })
  } catch (error) {
    console.error('Failed to fetch data:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch assigned tasks, opportunities, or approvals.',
      error: error.message,
    })
  }
}

function generateRequestId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 5)
}

exports.refreshSession = async (req, res) => {
  const userId = req.user.id
  try {
    await pool.query(
      `DELETE FROM agent_chats
             WHERE user_id = $1`,
      [userId]
    )
    const newSessionId = generateRequestId()
    await pool.query(
      `UPDATE users
             SET agent_session_id = $2
             WHERE id = $1`,
      [userId, newSessionId]
    )
    res.json({
      success: true,
      sessionId: newSessionId,
    })
  } catch (error) {
    return handleError(res, error, 'Failed to remove session')
  }
}

exports.getSessionId = async (req, res) => {
  const userId = req.user.id

  const userResult = await pool.query(
    `SELECT * FROM users
         WHERE id = $1
         ORDER BY created_at ASC`,
    [userId]
  )

  console.log('getSessionId')

  if (!userResult.rows.length) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    })
  }

  let sessionId
  if (!userResult.rows[0].agent_session_id) {
    sessionId = generateRequestId()
    await pool.query(
      `UPDATE users
             SET agent_session_id = $1
             WHERE id = $2`,
      [sessionId, userId]
    )
    return res.json({
      success: true,
      sessionId: sessionId,
      isNewSession: true,
    })
  } else {
    sessionId = userResult.rows[0].agent_session_id
    return res.json({
      success: true,
      sessionId: sessionId,
      isNewSession: false,
    })
  }
}

const formatChatHistory = async () => {
  //remove duplicated system init message by remaining first.
  await pool.query(
    `DELETE FROM agent_chats
         WHERE payload->>'type' = 'system'
         AND id NOT IN (
             SELECT MIN(id)
             FROM agent_chats
             WHERE payload->>'type' = 'system'
             GROUP BY user_id
         )`
  )
}

exports.saveMessage = async (req, res) => {
  const { message, type, requestId } = req.body
  const userId = req.user.id

  // Set up SSE headers for normal flow
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Transfer-Encoding', 'chunked')

  const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [
    userId,
  ])

  if (!userResult.rows.length) {
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        error: 'User not found',
      })}\n\n`
    )
    return res.end()
  }

  const userEmail = userResult.rows[0].email

  try {
    // Check if message contains [PREPARE_MEETING]
    const meetingMatch = message.match(
      /\[PREPARE_MEETING\](.*?)\[\/PREPARE_MEETING\]/
    )
    const meetingId = meetingMatch ? meetingMatch[1] : null

    // Create payload
    const payload = {
      type,
      userId,
    }
    if (meetingId) {
      payload.meetingId = meetingId
    }

    // Don't save if type is 'init' or 'system' (except for the above condition)
    if (type !== 'init' && type !== 'system') {
      // If meetingId exists, check for duplicate
      if (meetingId) {
        const existingMessage = await pool.query(
          `SELECT * FROM agent_chats
                     WHERE user_id = $1
                     AND payload->>'meetingId' = $2`,
          [userId, meetingId]
        )

        // Skip saving if duplicate found
        if (existingMessage.rows.length === 0) {
          await pool.query(
            `INSERT INTO agent_chats (user_id, type, message, created_at, payload)
                         VALUES ($1, $2, $3, NOW(), $4)`,
            [userId, type, message, payload]
          )
        }
      } else {
        // Save message without duplicate check if no meetingId
        await pool.query(
          `INSERT INTO agent_chats (user_id, type, message, created_at, payload)
                     VALUES ($1, $2, $3, NOW(), $4)`,
          [userId, type, message, payload]
        )
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`)

    let fullResponse = ''
    let buffer = ''

    const apiUrl =
      type === 'system' && message === 'init'
        ? `${process.env.AGENT_API_URL}/api/graph/${requestId}/init`
        : `${process.env.AGENT_API_URL}/api/graph/${requestId}/invoke`

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.AGENT_API_KEY,
      },
      body: JSON.stringify(
        type === 'system' ? { email: userEmail } : { query: message }
      ),
    })

    if (!apiResponse.ok) {
      console.log('apiResponse:', apiResponse)
      throw new Error(`API request failed with status ${apiResponse.status}`)
    }

    const reader = apiResponse.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)

      res.write(chunk) // Stream directly to client

      // Accumulate chunk in buffer and process complete lines
      buffer += chunk
      let newlineIndex
      while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newlineIndex)
        buffer = buffer.slice(newlineIndex + 1)

        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'chunk') {
              fullResponse += data.content
            }
          } catch (e) {
            console.warn('JSON parse error, skipping chunk:', e)
          }
        }
      }
    }

    // Process any remaining buffer content
    if (buffer.startsWith('data: ')) {
      try {
        const data = JSON.parse(buffer.slice(6))
        if (data.type === 'chunk') {
          fullResponse += data.content
        }
      } catch (e) {
        console.warn('JSON parse error in remaining buffer:', e)
      }
    }

    // Create payload for AI response

    const aiPayload = {
      type: type == 'system' ? 'system' : 'agent',
      userId,
    }

    if (meetingMatch) {
      aiPayload.meetingId = meetingMatch[1]
    }

    // Check for existing AI response with same meetingId and userId
    let shouldSave = true
    if (aiPayload.meetingId) {
      const existingResponse = await pool.query(
        `SELECT * FROM agent_chats
                 WHERE user_id = $1
                 AND type = 'agent'
                 AND payload->>'meetingId' = $2`,
        [userId, aiPayload.meetingId]
      )
      shouldSave = existingResponse.rows.length === 0
    }

    // Save the complete AI response if no duplicate exists
    if (shouldSave) {
      await pool.query(
        `INSERT INTO agent_chats (user_id, type, message, created_at, payload)
                 VALUES ($1, 'agent', $2, NOW(), $3)`,
        [userId, fullResponse, aiPayload]
      )
    }

    res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`)
    res.end()
  } catch (error) {
    console.error('Error in saveMessage:', error)
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        error: error.message,
      })}\n\n`
    )
    res.end()
  }
}

async function getAIResponseStream(sessionId, query, onChunk) {
  try {
    console.log('sessionId: ', sessionId)
    const response = await fetch(
      `${process.env.AGENT_API_URL}/api/graph/${sessionId}/invoke`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.AGENT_API_KEY,
        },
        body: JSON.stringify({ query }),
      }
    )

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    let aiResponse = ''
    let buffer = ''
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      onChunk(chunk)

      buffer += chunk

      // Process complete lines from buffer
      let newlineIndex
      while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newlineIndex)
        buffer = buffer.slice(newlineIndex + 1)

        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))

            switch (data.type) {
              case 'start':
                aiResponse = ''
                break
              case 'chunk':
                aiResponse += data.content
                break
              case 'error':
                break
              case 'end':
                break
              default:
                break
            }
          } catch (e) {
            console.warn('JSON parse error, skipping chunk:', e)
          }
        }
      }
    }
    return aiResponse
  } catch (error) {
    console.error('Error getting AI response:', error)
    return "I apologize, but I'm having trouble processing your request at the moment."
  }
}

exports.upcomingMeetingAlertCheck = async (req, res) => {
  const { meetingId } = req.body
  const userId = req.user.id

  const meetingMessageContent = `%[PREPARE_MEETING]${meetingId}[/PREPARE_MEETING]%`
  try {
    const findQuery =
      'SELECT * FROM agent_chats WHERE user_id = $1 AND message LIKE $2'
    const result = await pool.query(findQuery, [userId, meetingMessageContent])
    if (result.rowCount) {
      return res.json({
        success: true,
        exists: true,
        message: 'Meeting already in chat history',
      })
    } else {
      return res.json({
        success: true,
        exists: false,
        message: 'Meeting not in chat history',
      })
    }
  } catch (e) {}
}

exports.parseMeetingData = async (req, res) => {
  const { message } = req.body

  try {
    const aiResponse = await processAI(
      'You are an AI assistant that helps users schedule meetings. You are given a message from a user that contains information about a meeting they want to schedule. Your job is to extract the relevant information from the message and return it in a structured JSON format. Only return valid JSON without any additional text or explanation. The JSON should include fields like: title, description, date (YYYY-MM-DD), time (HH:MM), duration (in minutes), platform (teams/zoom/google), and attendees (array of objects with name and email).',
      message,
      2048
    )

    // Parse the JSON from the response which might be wrapped in markdown code blocks
    let meetingData
    try {
      // First try to extract JSON from markdown code blocks
      const jsonMatch = aiResponse.match(/```(?:json)?\n([\s\S]*?)\n```/)

      if (jsonMatch) {
        meetingData = JSON.parse(jsonMatch[1].trim())
      } else {
        // If no code blocks, try to find JSON object directly
        const jsonStart = aiResponse.indexOf('{')
        const jsonEnd = aiResponse.lastIndexOf('}') + 1

        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          const jsonStr = aiResponse.slice(jsonStart, jsonEnd)
          meetingData = JSON.parse(jsonStr)
        } else {
          throw new Error('Could not extract valid JSON from the response')
        }
      }
    } catch (parseError) {
      console.error('Error parsing meeting data JSON:', parseError)
      return res.status(500).json({
        success: false,
        message: 'Failed to parse meeting data JSON',
        rawResponse: aiResponse,
      })
    }

    res.status(200).json({
      success: true,
      meetingData: meetingData,
    })
  } catch (error) {
    console.error('Error parsing meeting data:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to parse meeting data',
    })
  }
}

exports.getAvailableVoices = async (req, res) => {
  res.status(200).json({
    success: true,
    availableVoices: getAvailableVoicesVar(),
  })
}

// Upload file to S3
const uploadToS3 = async (file, userId) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `agent-profiles/${userId}_${Date.now()}_${Math.random() * 100000}`,
    Body: file.buffer,
    ContentType: file.mimetype,
  }

  try {
    const data = await s3.upload(params).promise()
    return data.Location
  } catch (error) {
    console.error('S3 upload error:', error)
    throw new Error('Failed to upload image to S3')
  }
}

// Update agent information
exports.updateAgent = async (req, res) => {
  const userId = req.user.id
  const { name, voice } = req.body
  const profilePicture = req.file

  try {
    let profilePictureUrl = null

    // Upload profile picture to S3 if provided
    if (profilePicture) {
      profilePictureUrl = await uploadToS3(profilePicture, userId)
    }

    // Build the update query dynamically based on provided fields
    const updateFields = []
    const values = []
    let paramCount = 1

    if (name) {
      updateFields.push(`myagent_name = $${paramCount}`)
      values.push(name)
      paramCount++
    }

    if (voice) {
      updateFields.push(`myagent_voice_id = $${paramCount}`)
      values.push(voice)
      paramCount++
    }

    if (profilePictureUrl) {
      updateFields.push(`myagent_profile_picture = $${paramCount}`)
      values.push(profilePictureUrl)
      paramCount++
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
      })
    }

    // Add user ID as the last parameter
    values.push(userId)

    const query = `
      UPDATE users
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING myagent_name, myagent_voice_id, myagent_profile_picture
    `

    const result = await pool.query(query, values)

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    res.status(200).json({
      success: true,
      message: 'Agent updated successfully',
      profilePictureUrl: profilePictureUrl,
      agent: result.rows[0],
    })
  } catch (error) {
    console.error('Error updating agent:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update agent',
    })
  }
}

// Get agent information
exports.getAgent = async (req, res) => {
  const userId = req.user.id

  try {
    const query = `
      SELECT myagent_name, myagent_voice_id, myagent_profile_picture
      FROM users
      WHERE id = $1
    `

    const result = await pool.query(query, [userId])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    res.status(200).json({
      success: true,
      agent: result.rows[0],
    })
  } catch (error) {
    console.error('Error fetching agent:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agent information',
    })
  }
}

// Export the multer upload middleware
exports.uploadAgentProfile = upload.single('profilePicture')

exports.getAgentMeeting = async (req, res) => {
  const { id } = req.params

  if (!id) {
    return res.status(400).json({
      success: false,
      error: 'Meeting ID is required',
    })
  }

  try {
    const query = `
      SELECT * FROM agent_meetings
      WHERE id = $1
    `
    const result = await pool.query(query, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Agent meeting not found',
      })
    }

    res.status(200).json({
      success: true,
      data: result.rows[0],
    })
  } catch (error) {
    console.error('Error fetching agent meeting:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agent meeting',
    })
  }
}

exports.testMyAgent = async (req, res) => {
  const {
    userName,
    userId,
    userEmail,
    botName,
    voiceId,
    agentAvatar,
    meetingId,
    meetingTopic,
    agentIntro,
    meetingLink,
  } = req.body
  const authToken = req.headers.authorization

  // Validate required fields
  if (!userName || !userId || !userEmail || !botName) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: userName, userId, userEmail, botName',
    })
  }

  if (!meetingId && !meetingLink) {
    return res.status(400).json({
      success: false,
      error: 'Either meetingId or meetingLink is required',
    })
  }

  let autoStartUrl = `${
    process.env.MYAGENT_TEST_URL
  }/auto-start?username=${encodeURIComponent(
    userName
  )}&userid=${userId}&user_email=${encodeURIComponent(
    userEmail
  )}&agent_name=${encodeURIComponent(botName)}&token=${encodeURIComponent(
    authToken
  )}&meeting_topics=${encodeURIComponent(meetingTopic || '')}&voiceid=${
    voiceId || ''
  }&avatar=${encodeURIComponent(agentAvatar || '')}&intro=${encodeURIComponent(
    agentIntro || ''
  )}&meeting_link=${encodeURIComponent(
    meetingLink || ''
  )}&meeting_id=${encodeURIComponent(meetingId || '')}`

  console.log('autoStartUrl: ', autoStartUrl)
  let meetingUrl

  if (meetingId) {
    try {
      const meetingUrlRes = await pool.query(
        `SELECT join_url FROM meetings WHERE id = $1`,
        [meetingId]
      )
      if (meetingUrlRes.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Meeting not found',
        })
      }
      meetingUrl = meetingUrlRes.rows[0].join_url
    } catch (error) {
      console.error('Error fetching meeting URL:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch meeting URL',
      })
    }
  } else {
    meetingUrl = meetingLink
  }

  if (!meetingUrl) {
    return res.status(400).json({
      success: false,
      error: 'No meeting URL available',
    })
  }

  console.log('Meeting URL:', meetingUrl)
  console.log('Bot Name:', botName)
  console.log('Auto Start URL:', autoStartUrl)

  const payload = {
    meeting_url: meetingUrl,
    bot_name: botName,
    output_media: {
      camera: {
        kind: 'webpage',
        config: {
          url: autoStartUrl,
        },
      },
    },
    variant: {
      zoom: 'web_4_core',
      google_meet: 'web_4_core',
      microsoft_teams: 'web_4_core',
    },
  }

  try {
    // Create record in agent_meetings table before calling recall.ai
    const insertQuery = `
      INSERT INTO agent_meetings (meeting_id, link, bot_name, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING id
    `
    const insertResult = await pool.query(insertQuery, [
      meetingId || null,
      meetingUrl,
      botName,
    ])
    const agentMeetingId = insertResult.rows[0].id

    // Add agent_meeting_id to autoStartUrl
    autoStartUrl += `&agent_meeting_id=${agentMeetingId}`

    // Update payload with new autoStartUrl
    payload.output_media.camera.config.url = autoStartUrl

    console.log(
      'Sending payload to Recall.ai:',
      JSON.stringify(payload, null, 2)
    )

    const response = await fetch('https://us-west-2.recall.ai/api/v1/bot/', {
      method: 'POST',
      headers: {
        Authorization: process.env.RECALL_API_KEY,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Recall.ai API error response:', errorText)
      console.error('Response status:', response.status)
      console.error('Response headers:', response.headers)
      throw new Error(
        `API request failed with status ${response.status}: ${errorText}`
      )
    }

    const data = await response.json()

    // Update agent_meetings table with recall.ai response
    const updateQuery = `
      UPDATE agent_meetings
      SET bot_id = $1, join_time = $2, recall_data = $3, updated_at = NOW()
      WHERE id = $4
    `
    await pool.query(updateQuery, [
      data.id,
      data.join_at,
      JSON.stringify(data),
      agentMeetingId,
    ])

    res.status(200).json({
      success: true,
      data: data,
      agentMeetingId: agentMeetingId,
    })
  } catch (error) {
    console.error('Error testing my agent:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test my agent',
    })
  }
}
