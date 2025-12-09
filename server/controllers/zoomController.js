const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const AWS = require("aws-sdk");
const qs = require("qs");
const { Client } = require("ssh2");
const crypto = require("crypto");
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const User = require("../models/User");
const ZoomUser = require("../models/ZoomUser");
const Meeting = require("../models/Meeting");
const Prompt = require("../models/Prompt");
const MeetingParticipant = require("../models/MeetingParticipant");
const pool = require("../config/database");
const { score_meeting } = require("./companyStrategyController");
const { generateTasksInside } = require("./taskController");
const { sendNotification } = require("../utils/socket");
const { processAI, test_prompt } = require("../utils/llmservice");
const s3 = new AWS.S3();
const { score_agenda } = require("./companyStrategyController");
const { participant_value_analysis } = require("./companyStrategyController");
const { intelligence_graph } = require("./companyStrategyController");

const sesClient = new SESClient({
  region: "us-east-1", 
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const getPemFile = async () => {
  const params = {
    Bucket: "nzoomrecording",
    Key: "zoom-sdk-server.pem",
  };

  try {
    const data = await s3.getObject(params).promise();
    return data.Body.toString();
  } catch (error) {
    console.error("Error fetching PEM file:", error.message);
    throw new Error("Failed to fetch PEM file");
  }
};

const bedrock = new BedrockRuntimeClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function sendEmail({ to, subject, html }) {
  const params = {
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: html,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: subject,
      },
    },
    Source: "noreply@getherd.ai",
  };

  try {
    const command = new SendEmailCommand(params);
    const result = await sesClient.send(command);
    console.log("Email sent! Message ID:", result.MessageId);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

const processTranscription = async (webvttContent) => {
  try {
    const sections = webvttContent.split("\n");
    let transcription = [];

    for (const section of sections) {
      // Skip timestamp lines (those containing -->)
      if (section.includes(":") || section.includes("-->")) {
        console.log("line", section);
        transcription.push(`${section}\n`);
      }
    }
    const textLines = transcription.join("\n");
    // Skip processing if there's no meaningful text
    if (!textLines) {
      return "";
    }
    /*
        const prompt = `Below is a meeting transcript. Please create a clear and concise summary that:
                          1. Highlights the key points discussed
                          2. Notes any important decisions or action items
                          3. Preserves the context of who said what when relevant based on only transcript.
    
                          Transcript:
                          ${textLines}`;
    
        const params = {
          modelId: "anthropic.claude-v2",
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify({
            prompt: `\n\nHuman: ${prompt}\n\nAssistant:`,
            max_tokens_to_sample: 500,
            temperature: 0.7,
            top_k: 250,
            top_p: 1,
          }),
        };
    
        const command = new InvokeModelCommand(params);
        const response = await bedrock.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        console.log("textLines", textLines);
        // Return both the formatted transcript and the summary
        return JSON.stringify({
          transcript: textLines,
          summary: responseBody.completion.trim(),
        });*/
    // const sysprompt = `Provide an executive summary of the meeting.`;
    // const summary = await processAI(sysprompt, textLines, 1024);
    // return JSON.stringify({
    //   transcript: textLines,
    //   summary: summary,
    // });
    const {
      promptContent: sysprompt,
      model,
      maxtokens,
      apiKey,
      provider,
    } = await Prompt.get("executive_summary");
    let response_prompt = await test_prompt(
      sysprompt,
      textLines,
      maxtokens,
      provider,
      model
    );
    if (response_prompt.status === true) {
      return JSON.stringify({
        transcript: textLines,
        summary: response_prompt.preview,
      });
    } else
      return JSON.stringify({
        transcript: textLines,
        summary: "Summary not available",
      });
  } catch (error) {
    console.error("Error processing transcription:", error);
    return webvttContent; // Return original content if processing fails
  }
};

const checkContainerCommand =
  'sudo docker ps --filter "name=meetingsdk-headless-linux-sample-main-zoomsdk" --format "{{.Names}}"';
const downContainerCommand =
  "cd meetingsdk-headless-linux-sample-main && sudo docker compose down";
const upContainerCommand =
  "cd meetingsdk-headless-linux-sample-main && sudo docker compose up -d";
const remoteConfigPath = "meetingsdk-headless-linux-sample-main/config.toml";

function getUpdatedTomlContent(joinUrl, meetingId, password) {
  return `
# Zoom Meeting SDK Client ID
client-id="q_3KYeg4TUixcouwfDJEXw"

# Zoom Meeting SDK Client Secret
client-secret="sbRfiPATRxPI23r95wsxdB65HU8lxuyU"

# Use a join-url or a meeting-id and password
join-url="${joinUrl}"
meeting-id="${meetingId}"
password="${password}"
display-name="Agent Herd"
transcribe=true

[RawAudio]
file="meeting-audio.pcm"
  `;
}

const executeSSHCommand = (ssh, command) => {
  return new Promise((resolve, reject) => {
    console.log(`Executing command: ${command}`);
    ssh.exec(command, (err, stream) => {
      if (err) {
        return reject(
          new Error(
            `Failed to execute command: ${command}. Error: ${err.message}`
          )
        );
      }

      let output = "";
      stream
        .on("data", (data) => {
          output += data.toString();
          console.log(`STDOUT: ${data.toString()}`);
        })
        .on("close", (code) => {
          console.log(`Command '${command}' completed with code: ${code}`);
          if (code === 0) {
            resolve(output.trim()); // Resolve with the command output
          } else {
            reject(
              new Error(`Command '${command}' failed with exit code: ${code}`)
            );
          }
        })
        .stderr.on("data", (data) => {
          console.error(`STDERR: ${data.toString()}`);
        });
    });
  });
};

const refreshZoomToken = async (refresh_token) => {
  try {
    const tokenEndpoint = process.env.ZOOM_OAUTH_ENDPOINT;
    const credentials = Buffer.from(
      `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
    ).toString("base64");

    const response = await axios.post(tokenEndpoint, null, {
      params: {
        grant_type: "refresh_token",
        refresh_token: refresh_token,
      },
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    });

    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
    };
  } catch (error) {
    console.error("Error refreshing Zoom token:", error);
    throw error;
  }
};

const handleZoomApiCall = async (apiCall, zoomUser) => {
  try {
    return await apiCall(zoomUser.zoom_access_token);
  } catch (error) {
    if (error.response?.status === 401) {
      // Token expired, refresh it
      const tokens = await refreshZoomToken(zoomUser.zoom_refresh_token);

      // Update tokens in database
      await ZoomUser.update({
        ...zoomUser,
        zoom_access_token: tokens.access_token,
        zoom_refresh_token: tokens.refresh_token,
      });

      // Retry the request with new token
      return await apiCall(tokens.access_token);
    }
    throw error;
  }
};

const getZoomParticipants = async (meetingId, zoomUser) => {
  try {
    let allParticipants = [];
    let nextPageToken = "";

    do {
      const makeApiCall = async (accessToken) => {
        const response = await axios.get(
          `${process.env.ZOOM_API_BASE_URL}/past_meetings/${encodeURIComponent(
            meetingId
          )}/participants`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            params: {
              next_page_token: nextPageToken,
              page_size: 300,
            },
          }
        );

        if (response.data?.participants?.length > 0) {
          allParticipants = [...allParticipants, ...response.data.participants];
        }
        nextPageToken = response.data.next_page_token;
        return response;
      };

      await handleZoomApiCall(makeApiCall, zoomUser);
    } while (nextPageToken);

    return allParticipants;
  } catch (error) {
    console.error("Error fetching Zoom participants:", error);
    return [];
  }
};

const IsZoomRecordingAvailable = async (meetingId, zoomUser) => {
  try {
    const makeApiCall = async (accessToken) => {
      const transcriptResponse = await axios.get(
        `${process.env.ZOOM_API_BASE_URL}/meetings/${encodeURIComponent(
          meetingId
        )}/recordings`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      const zoomTranscription = transcriptResponse.data.recording_files.find(
        (file) => file.recording_type?.toLowerCase().includes("transcript")
      );
      if (zoomTranscription) {
        return true;
      }
      return false;
    };

    return await handleZoomApiCall(makeApiCall, zoomUser);
  } catch (error) {
    if (error.response?.data?.code === 3301) {
      return false;
    }
    console.error("Error fetching Zoom recording:", error);
    return false;
  }
};

const getZoomRecording = async (meetingId, zoomUser) => {
  try {
    const makeApiCall = async (accessToken) => {
      const transcriptResponse = await axios.get(
        `${process.env.ZOOM_API_BASE_URL}/meetings/${encodeURIComponent(
          meetingId
        )}/recordings`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      const zoomTranscription = transcriptResponse.data.recording_files.find(
        (file) => file.recording_type?.toLowerCase().includes("transcript")
      );
      if (zoomTranscription) {
        const zoomTranscriptionResult = await axios.get(
          `https://zoom.us/recording/download/${zoomTranscription.id}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        console.log("zoomTranscriptionResult", zoomTranscriptionResult.data);
        const processedTranscription = await processTranscription(
          zoomTranscriptionResult.data
        );
        const transcriptionData = processedTranscription
          ? JSON.parse(processedTranscription)
          : null;
        console.log("transcriptionData", transcriptionData);
        const transcript = transcriptionData?.transcript;
        const summary = transcriptionData?.summary;
        return {
          hasRecording: true,
          summary: summary,
          transcripts: transcript,
          report_id: transcriptResponse.data.recording_play_passcode,
        };
      }
      // if (response.data?.recording_files?.length > 0) {
      //   const transcriptPromises = response.data.recording_files
      //     .filter(file => file.file_extension === "JSON")
      //     .map(async (file) => {
      //       try {
      //         const transcriptResponse = await axios.get(
      //           `${process.env.ZOOM_API_BASE_URL_V1}/recording/download/${file.id}`,
      //           {
      //             headers: {
      //               Authorization: `Bearer ${accessToken}`,
      //             },
      //           }
      //         );
      //         return transcriptResponse.data;
      //       } catch (error) {
      //         console.log(`No transcript found for recording ${file.id}`);
      //         return null;
      //       }
      //     });

      //   const transcripts = await Promise.all(transcriptPromises);

      //   return {
      //     hasRecording: true,
      //     data: response.data,
      //     transcripts: transcripts.filter(t => t !== null),
      //   };
      // }

      return {
        hasRecording: false,
        data: null,
        report_id: transcriptResponse.data.recording_play_passcode,
      };
    };

    return await handleZoomApiCall(makeApiCall, zoomUser);
  } catch (error) {
    // Handle case where recording doesn't exist (code 3301)
    if (error.response?.data?.code === 3301) {
      return {
        hasRecording: false,
        data: null,
        report_id: null,
      };
    }
    console.error("Error fetching Zoom recording:", error);
    throw error;
  }
};

const getZoomSchedule = async (meetingId, zoomUser) => {
  try {
    const makeApiCall = async (accessToken) => {
      const scheduleResponse = await axios.get(
        `${process.env.ZOOM_API_BASE_URL}/meetings/${encodeURIComponent(
          meetingId
        )}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      const start_time = scheduleResponse.data.start_time;
      const duration = scheduleResponse.data.duration;
      console.log("getZoomSchedule", start_time, duration);
      if (start_time && duration)
        return {
          duration,
          start_time,
        };
      else return false;
    };

    return await handleZoomApiCall(makeApiCall, zoomUser);
  } catch (error) {
    // Handle case where recording doesn't exist (code 3301)
    if (error.response?.data?.code === 3301) {
      return false;
    }
    console.error("Error fetching Zoom recording:", error);
    throw error;
  }
};
const addMeetingAttendees = async (attendees, meeting_id) => {
  try {
    console.log("Adding meeting attendees:", attendees);
    console.log("Meeting ID:", meeting_id);
    if (attendees.length === 0 || !attendees) {
      return;
    } else {
      for (const attendee of attendees) {
        const user = await User.findOne(
          `email = '${attendee.emailAddress.address?.toLowerCase()}'`
        );
        const meeting = await Meeting.findById(meeting_id);
        if (user && meeting) {
          await MeetingParticipant.create({
            meetingId: meeting_id,
            userId: user.id,
          });
          await pool.query(
            "INSERT INTO notifications (user_id, checked, notification, deleted, link, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
            [
              user.id,
              false,
              `You have been added to meet-'${meeting.title}'`,
              false,
              `/meeting-detail?id=${meeting_id}`,
              new Date(),
            ]
          );
          sendNotification({
            id: user.id,
            message: "You have been added to ",
          });
        } else {
          // Generate invite token
          const inviteToken = uuidv4();

          // Create new user with invite token
          const newUser = await pool.query(
            "INSERT INTO users (email, name, provider, invite_token) VALUES ($1, $2, $3, $4) RETURNING *",
            [
              attendee.emailAddress.address?.toLowerCase(),
              attendee.emailAddress.name,
              "email",
              inviteToken,
            ]
          );

          // Add new user to meeting_participants
          await pool.query(
            "INSERT INTO meeting_participants (user_id, meeting_id) VALUES ($1, $2)",
            [newUser.rows[0].id, meeting_id]
          );
          // Send email to new user
          const emailSubject =
            "Welcome to Herd AI - where we help you get productive, faster.";
          const emailBody = `
          <h2>Welcome to Our Platform!</h2>
        <p>You have been a part of a meeting that was digested by Herd AI, so we are welcoming you to create an account!</p> 
        <p>Please click the link below to join our platform:</p>
          <a href="${process.env.FRONTEND_URL}/set-password?token=${inviteToken}&email=${attendee.emailAddress.address}">Join Herd AI Now</a>
          <p>Thank you!</p>
          <p>Herd AI Team</p>
      `;
          await sendEmail({
            to: attendee.emailAddress.address,
            subject: emailSubject,
            html: emailBody,
          });
          console.log("Email sent to:", attendee.emailAddress.address);
        }
      }
      return;
    }
  } catch (error) {
    console.error("Error adding meeting attendees:", error);
    throw error;
  }
};

exports.addAttendees = async (req, res) => {
  try {
    const { attendees, meeting_id } = req.body;
    await addMeetingAttendees(attendees, meeting_id);
    res.status(200).json({ success: true, message: "Added successfully" });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to initiate Zoom OAuth",
    });
  }
};

exports.getZoomAuth = async (req, res) => {
  try {
    const clientId = process.env.ZOOM_CLIENT_ID;
    const redirectUri = process.env.ZOOM_REDIRECT_URI;
    console.log("Zoom Auth called-----------", clientId, redirectUri);
    const authUrl = `https://zoom.us/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;
    res.redirect(authUrl);
  } catch (error) {
    console.error("Zoom OAuth error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to initiate Zoom OAuth",
    });
  }
};

exports.handleZoomCallback = async (req, res) => {
  console.log("Zoom Callback called-----------");
  try {
    const { code } = req.body;
    console.log("Code received:", code);
    const userId = req.user.id;
    console.log("User ID:", userId);

    // Exchange code for tokens
    const tokenEndpoint = process.env.ZOOM_OAUTH_ENDPOINT;
    const credentials = Buffer.from(
      `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
    ).toString("base64");
    console.log("credentials", credentials);
    const response = await axios.post(tokenEndpoint, null, {
      params: {
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.ZOOM_REDIRECT_URI,
      },
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    });

    const { access_token, refresh_token } = response.data;

    // Update user with Zoom credentials and set use_zoom to true
    const updatedUser = await User.updateZoomCredentials(userId, {
      access_token,
      refresh_token,
    });

    if (!updatedUser) {
      throw new Error("User not found");
    }

    console.log("Access Token:", access_token);
    console.log("Refresh Token:", refresh_token);

    const userResponse = await axios.get(
      `${process.env.ZOOM_API_BASE_URL}/users/me`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );
    console.log("User Response:", userResponse.data);

    const zoomUser = await ZoomUser.findByAccountId(userResponse.data.id);
    const tenant = await ZoomUser.findByTenantId(userResponse.data.account_id);
    if (tenant) {
      isTenant = true;
    }
    if (zoomUser) {
      await ZoomUser.update({
        account_id: userResponse.data.id,
        name: userResponse.data.first_name + " " + userResponse.data.last_name,
        zoom_access_token: access_token,
        zoom_refresh_token: refresh_token,
        tenant_id: userResponse.data.account_id,
        mail: userResponse.data.email,
        role_name: userResponse.data.role_name,
        type: userResponse.data.type,
        zoom_scheduling: true,
        user_id: userId,
      });
    } else {
      await ZoomUser.create({
        account_id: userResponse.data.id,
        name: userResponse.data.first_name + " " + userResponse.data.last_name,
        zoom_access_token: access_token,
        zoom_refresh_token: refresh_token,
        tenant_id: userResponse.data.account_id,
        mail: userResponse.data.email,
        role_name: userResponse.data.role_name,
        type: userResponse.data.type,
        zoom_scheduling: true,
        user_id: userId,
      });
    }

    res.json({
      success: true,
      message: "Zoom account connected successfully",
    });
  } catch (error) {
    console.error("Zoom OAuth error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to connect Zoom account",
    });
  }
};

exports.disconnectZoom = async (req, res) => {
  try {
    const userId = req.user.id;
    const updatedUser = await User.disconnectZoom(userId);

    if (!updatedUser) {
      throw new Error("User not found");
    }
    const zoomUser = await ZoomUser.findByUserId(userId);
    if (zoomUser) {
      await ZoomUser.disconnect(userId);
    }

    res.json({
      success: true,
      message: "Zoom account disconnected successfully",
      user: {
        ...updatedUser,
        password_hash: undefined,
        zoom_access_token: undefined,
        zoom_refresh_token: undefined,
      },
    });
  } catch (error) {
    console.error("Zoom disconnect error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to disconnect Zoom account",
    });
  }
};

exports.activateZoom = async (req, res) => {
  try {
    const userId = req.user.id;

    // Update user's use_zoom status
    const updatedUser = await User.updateZoomStatus(userId, true);

    if (!updatedUser) {
      throw new Error("User not found");
    }

    res.json({
      success: true,
      message: "Zoom activation successful",
      user: {
        ...updatedUser,
        password_hash: undefined,
        zoom_access_token: undefined,
        zoom_refresh_token: undefined,
      },
    });
  } catch (error) {
    console.error("Zoom activation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to activate Zoom",
    });
  }
};

exports.retrieveMeetingsInfo = async (req, res) => {
  try {
    console.log("Retrieve meetings info called-----------");
    const userId = req.user.id;
    const zoomUser = await ZoomUser.findByUserId(userId);

    // Use handleZoomApiCall to automatically handle token refresh
    const makeApiCall = async (accessToken) => {
      return await axios.get(
        `${process.env.ZOOM_API_BASE_URL}/users/${zoomUser.account_id}/meetings?type=past`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
    };

    const response = await handleZoomApiCall(makeApiCall, zoomUser);

    // Rest of the function remains the same
    const zoomMeetings = response.data.meetings;

    // Get existing meeting IDs from your database
    const { rows: existingMeetings } = await pool.query(
      `SELECT meeting_id, teams_id 
       FROM meetings 
       WHERE teams_id = ANY($1) 
       AND org_id = $2
       AND isdeleted != true`,
      [zoomMeetings.map((t) => t.id), userId]
    );// WHERE meeting_id = ANY($1)
    console.log("Existing meetings:", existingMeetings.length);
    // console.log("Existing meetings:", existingMeetings);

    const existingMeetingIds = new Set(
      existingMeetings.map((m) => m.teams_id)
    );

    console.log("Zoom meetings:", JSON.stringify(existingMeetings));
    // First create an array of promises
    const meetingPromises = zoomMeetings
      // .map((meeting) => console.log(meeting.id, typeof meeting.id))
      .filter((meeting) => !existingMeetingIds.has(`${meeting.id}`))
      .map((meeting) =>
        IsZoomRecordingAvailable(meeting.id, zoomUser).then(
          (isRecordingAvailable) => {
            const orgId =
              meeting?.host_id == zoomUser.account_id ? userId : null;
            if (isRecordingAvailable) {
              console.log("Meeting is recording available:", meeting.uuid);
              return {
                ...meeting,
                org_id: orgId,
                platform: "zoom",
                isValid: true,
              };
            } else {
              console.log("Meeting is not recording available:", meeting.uuid);
              return {
                ...meeting,
                org_id: orgId,
                platform: "zoom",
                isValid: false,
              };
            }
          }
        )
      );

    // Then resolve all promises and filter out nulls
    const newMeetings = (await Promise.all(meetingPromises))
      .filter((meeting) => meeting !== null)
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

    console.log("New meetings:", newMeetings);
    res.json({
      success: true,
      meetings: newMeetings,
      totalNew: newMeetings.length,
    });
  } catch (error) {
    console.error("Zoom retrieve meetings info error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve Zoom meetings info",
    });
  }
};

exports.setRetrievedMeetings = async (req, res) => {
  try {
    const { meetingList } = req.body;
    console.log("meetingList", meetingList);
    const userId = req.user.id;
    const zoomUser = await ZoomUser.findByUserId(userId);
    const meetingListPromises = meetingList.map(async (meeting) => {
      try {
        let recording = null;
        if (meeting.isValid) {
          recording = await getZoomRecording(meeting.uuid, zoomUser);
        }

        let transcript = recording?.transcripts || "";
        let summary = recording?.summary || "";

        const existingMeeting = await Meeting.findByMeetingId(meeting.uuid);
        let result;
        // if(meeting.type === 3)
        //   {

        // Use handleZoomApiCall instead of direct axios call
        const makeApiCall = async (accessToken) => {
          return await axios.get(
            `${process.env.ZOOM_API_BASE_URL}/meetings/${encodeURIComponent(
              meeting.id
            )}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );
        };

        const meetingInfoResponse = await handleZoomApiCall(
          makeApiCall,
          zoomUser
        );
        const meetingInfo = meetingInfoResponse.data;
        console.log("Meeting Info:", meetingInfo);
        if (meeting.uuid === meetingInfo.uuid) {
          meeting.start_time = meetingInfo.start_time;
          meeting.duration = meetingInfo.duration;
        }

        if (existingMeeting) {
          // Update existing meeting
          result = existingMeeting;
          const updatedMeeting = await Meeting.update({
            id: existingMeeting.id,
            meeting_id: meeting.uuid,
            title: meeting.topic || "NO TITLE",
            summary: summary,
            description: meeting?.agenda || null,
            datetime: meeting.start_time,
            duration: meeting.duration,
            joinUrl: meeting.join_url,
            teams_id: meeting.id,
            status: meeting.type,
            org_id:
              meeting?.host_id == zoomUser.account_id
                ? userId
                : existingMeeting.org_id,
            platform: "zoom",
            transcription_link: transcript,
            record_link: null,
          });
          console.log("Meeting updated:", updatedMeeting);
        } else {
          // Create new meeting
          result = await Meeting.create({
            meeting_id: meeting.uuid,
            title: meeting.topic || "NO TITLE",
            description: meeting?.agenda || null,
            summary: summary,
            datetime: meeting.start_time,
            duration: meeting.duration,
            joinUrl: meeting.join_url,
            teams_id: meeting.id,
            status: meeting.type,
            org_id: meeting?.host_id == zoomUser.account_id ? userId : null,
            platform: "zoom",
            transcription_link: transcript,
            record_link: null,
          });

          // Create organizer participant record
          if (meeting?.host_id == zoomUser.account_id)
            await MeetingParticipant.create({
              meetingId: result.id,
              userId: userId,
              role: "organizer",
            });
          score_agenda(result.id);
        }

        const participants = await getZoomParticipants(meeting.uuid, zoomUser);
        const attendees = participants
          .filter(
            (item) =>
              item.user_email &&
              item.user_email !== "" &&
              item.user_email !== zoomUser.mail
          )
          .map((participant) => ({
            emailAddress: {
              address: participant?.user_email,
              name: participant?.name,
            },
          }));

        await addMeetingAttendees(attendees, result?.id);
        if (summary || summary != '') {
          const {
            promptContent: sysprompt,
            model,
            maxtokens,
            apiKey,
            provider,
          } = await Prompt.get("executive_summary");

          await pool.query(
            "UPDATE meetings SET api_by_summary = $1 WHERE id = $2",
            [`${provider}/${model}`, result?.id]
          );
        }
        await score_meeting(result?.id);
        // return {
        //   success: true,
        //   meetingId: meeting.id,
        //   message: "Meeting retrieved successfully",
        // };
      } catch (error) {
        return Promise.reject({
          meetingId: meeting.id,
          error: error.message || "Failed to process meeting",
        });
      }
    });

    try {
      const results = await Promise.allSettled(meetingListPromises);

      const successful = results
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value);
      const failed = results
        .filter((r) => r.status === "rejected")
        .map((r) => r.reason);

      res.json({
        success: true,
        message: "Meetings processing completed",
        results: {
          successful,
          failed,
          totalSuccessful: successful.length,
          totalFailed: failed.length,
        },
      });
    } catch (error) {
      console.error("Error processing meetings:", error);
      res.status(500).json({
        success: false,
        error: "Failed to process meetings",
      });
    }
  } catch (error) {
    console.error("Zoom set retrieved meetings error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to set retrieved meetings",
    });
  }
};

exports.connectAgent = async (req, res) => {
  console.log("Connect agent called-----------");
  try {
    const userId = req.user.id;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    await User.updateZoomAgent({ id: user.id, use_zoom_agent: true });
    res.status(200).json({ message: "Zoom agent connected successfully" });
  } catch (error) {
    console.error("Error connecting Zoom agent:", error);
    res.status(500).json({ error: "Failed to connect Zoom agent" });
  }
};

exports.disconnectAgent = async (req, res) => {
  console.log("Disconnect agent called-----------");
  try {
    const userId = req.user.id;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    await User.updateZoomAgent({ id: user.id, use_zoom_agent: false });
    res.status(200).json({ message: "Zoom agent disconnected successfully" });
  } catch (error) {
    console.error("Error disconnecting Zoom agent:", error);
    res.status(500).json({ error: "Failed to disconnect Zoom agent" });
  }
};

exports.webhook = async (req, res) => {
  try {
    console.log("Received Event:", JSON.stringify(req.body, null, 2));

    // Handle URL validation challenge
    if (req.body.event === "endpoint.url_validation") {
      const plainToken = req.body.payload.plainToken;
      const encryptedToken = crypto
        .createHmac("sha256", process.env.ZOOM_WEBHOOK_SECRET_TOKEN)
        .update(plainToken)
        .digest("hex");

      console.log("Validation Response Sent:", { plainToken, encryptedToken });
      return res.status(200).json({ plainToken, encryptedToken });
    }

    // Verify webhook authenticity for non-validation requests
    const zoomAuthToken = req.headers["authorization"];
    console.log("Zoom auth token:", zoomAuthToken);
    if (
      !zoomAuthToken ||
      zoomAuthToken !== process.env.ZOOM_WEBHOOK_VERIFICATION_TOKEN
    ) {
      console.error("Invalid or missing Zoom webhook token");
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!req.body) {
      throw new Error("Request body is undefined");
    }

    const { event, payload } = req.body;
    console.log("Received Zoom webhook:", event, payload);

    switch (event) {
      case "meeting.started": {
        try {
          console.log("Meeting started:", payload.object);

          const privateKey = await getPemFile();
          const sshConfig = {
            host: "54.234.219.138",
            port: 22,
            username: "ubuntu",
            privateKey: privateKey,
          };

          const newMeetingId = payload.object.uuid;
          console.log("Account ID:", payload.account_id);
          const zoomUser = await ZoomUser.findByAccountId(
            payload.object.host_id
          );
          if (!zoomUser) {
            console.log("No zoom user found for host:", payload.object.host_id);
            return res.status(200).json({ message: "No action needed" });
          }

          const user = await User.findById(zoomUser.user_id);
          if (!user) {
            console.log("No user found for zoom user:", zoomUser.user_id);
            return res.status(200).json({ message: "No action needed" });
          }

          if (user.use_zoom_agent) {
            // Use handleZoomApiCall instead of direct axios call
            const makeApiCall = async (accessToken) => {
              return await axios.get(
                `${process.env.ZOOM_API_BASE_URL}/meetings/${encodeURIComponent(
                  payload.object.id // newMeetingId
                )}`,
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                  },
                }
              );
            };

            const meetingInfoResponse = await handleZoomApiCall(
              makeApiCall,
              zoomUser
            );
            const meetingInfo = meetingInfoResponse.data;
            console.log("Meeting Info:", meetingInfo);

            const newJoinUrl = meetingInfo.join_url;
            const newPassword = meetingInfo.password;

            const ssh = new Client();

            await new Promise((resolve, reject) => {
              ssh
                .on("ready", async () => {
                  console.log("SSH connection established.");

                  try {
                    // Step 1: Update the config.toml file
                    const updatedTomlContent = getUpdatedTomlContent(
                      newJoinUrl,
                      payload.object.id,
                      newPassword
                    );
                    console.log("Updating config.toml...");
                    await executeSSHCommand(
                      ssh,
                      `echo '${updatedTomlContent.replace(
                        /'/g,
                        "'\\''"
                      )}' > ${remoteConfigPath}`
                    );
                    console.log("config.toml file updated successfully.");

                    // Step 2: Check if the container is running
                    console.log("Checking container status...");
                    const containerStatus = await executeSSHCommand(
                      ssh,
                      checkContainerCommand
                    );

                    if (containerStatus) {
                      console.log(
                        `Container is running: ${containerStatus}. Stopping it...`
                      );

                      // Step 3: Stop the container
                      await executeSSHCommand(ssh, downContainerCommand);
                      console.log("Container stopped successfully.");
                    } else {
                      console.log("Container is not running.");
                    }

                    // Step 4: Start the container
                    console.log("Starting the container...");
                    await executeSSHCommand(ssh, upContainerCommand);
                    console.log("Container started successfully.");

                    ssh.end();
                    resolve("Container restarted successfully.");
                  } catch (error) {
                    ssh.end();
                    console.error("Error during SSH commands:", error.message);
                    reject(error);
                  }
                })
                .on("error", (err) => {
                  console.error("SSH connection error:", err.message);
                  reject(err);
                })
                .connect(sshConfig);
            });
          }
          return res.status(200).json({
            message: "Meeting started and container updated successfully",
            meetingId: newMeetingId,
          });
        } catch (error) {
          console.error("Error processing meeting.started event:", error);
          return res.status(500).json({
            error: "Failed to process meeting.started event",
            details: error.message,
          });
        }
        break;
      }

      case "meeting.ended":
        {
          /*
        try {
          const meetingId = payload.object.uuid;
          const hostId = payload.object.host_id;

          // Find the zoom user associated with the host
          const zoomUser = await ZoomUser.findByAccountId(hostId);
          if (!zoomUser) {
            console.log("No zoom user found for host:", hostId);
            return res.status(200).json({ message: "No action needed" });
          }

          // Get recording and participant information
          let recording = { summary: "", transcripts: "" };
          let participants = [];

          try {
            recording = await getZoomRecording(meetingId, zoomUser);
          } catch (error) {
            console.error("Error fetching recording:", error);
            // Continue execution even if recording fetch fails
          }

          try {
            participants = await getZoomParticipants(meetingId, zoomUser);
          } catch (error) {
            console.error("Error fetching participants:", error);
            // Continue execution even if participants fetch fails
          }

          // Create or update meeting record
          const meetingData = {
            meeting_id: meetingId,
            summary: recording?.summary || "",
            title: payload.object.topic || "Untitled Meeting",
            description: payload.object.agenda || null,
            datetime: new Date(payload.object.start_time),
            duration: payload.object.duration || 0,
            joinUrl: payload.object.join_url || "",
            teams_id: payload.object.id,
            status: payload.object.type,
            org_id: zoomUser.user_id,
            platform: "zoom",
            transcription_link: recording?.transcripts || "",
            record_link: null,
          };

          let meeting;
          try {
            meeting = await Meeting.findByMeetingId(meetingId);
            if (meeting) {
              await Meeting.update({ id: meeting.id, ...meetingData });
              await score_meeting(meeting.id);
            } else {
              meeting = await Meeting.create(meetingData);
              await score_meeting(meeting.id);
              // Create organizer participant record
              await MeetingParticipant.create({
                meetingId: meeting.id,
                userId: zoomUser.user_id,
                role: "organizer",
              });
            }
          } catch (error) {
            console.error("Error creating/updating meeting:", error);
            throw error; // Re-throw as this is a critical error
          }

          // Process participants
          if (participants.length > 0) {
            try {
              const attendees = participants
                .filter((item) => item.user_email)
                .filter((item) => item.user_email !== zoomUser.mail)
                .map((participant) => ({
                  emailAddress: {
                    address: participant.user_email,
                    name:
                      participant.name || participant.user_email.split("@")[0],
                  },
                }));

              await addMeetingAttendees(attendees, meeting.id);
            } catch (error) {
              console.error("Error processing attendees:", error);
              // Continue execution even if attendee processing fails
            }
          }

          return res.status(200).json({
            message: "Meeting ended and processed successfully",
            meetingId,
          });
        } catch (error) {
          console.error("Error processing meeting.ended event:", error);
          return res.status(500).json({
            error: "Failed to process meeting.ended event",
            details: error.message,
          });
        }
*/
        }
        break;
      case "recording.completed":
        try {
          console.log("Matt Recording completed:", payload.object);

          const meetingId = payload.object.uuid;
          const hostId = payload.object.host_id;

          // Find the zoom user associated with the host
          const zoomUser = await ZoomUser.findByAccountId(hostId);
          if (!zoomUser) {
            console.log("No zoom user found for host:", hostId);
            return res.status(200).json({ message: "No action needed" });
          }

          // Get recording and participant information
          let recording = { summary: "", transcripts: "", report_id: "" };
          let participants = [];
          let schedule = {
            start_time: new Date(payload.object.start_time),
            duration: payload.object.duration,
          };

          try {
            recording = await getZoomRecording(meetingId, zoomUser);
          } catch (error) {
            console.error("Error fetching recording:", error);
            // Continue execution even if recording fetch fails
          }

          try {
            participants = await getZoomParticipants(meetingId, zoomUser);
          } catch (error) {
            console.error("Error fetching participants:", error);
            // Continue execution even if participants fetch fails
          }

          try {
            schedule = await getZoomSchedule(payload.object.id, zoomUser);
          } catch (error) {
            console.error("Error fetching participants:", error);
            // Continue execution even if participants fetch fails
          }

          // Create or update meeting record
          const meetingData = {
            meeting_id: meetingId,
            summary: recording?.summary || "",
            title: payload.object.topic || "Untitled Meeting",
            datetime: new Date(payload.object.start_time),
            duration: payload.object.duration || 1,
            joinUrl: payload.object.join_url || "",
            teams_id: payload.object.id,
            status: payload.object.type,
            org_id: zoomUser.user_id,
            platform: "zoom",
            transcription_link: recording?.transcripts || "",
            record_link: null,
            report_id: recording?.report_id,
            schedule_datetime: schedule.start_time,
            schedule_duration: schedule.duration,
          };

          console.log("recording saved. meetingData : ", meetingData);
          let meeting;
          try {
            meeting = await Meeting.findByTeamsId(payload.object.id);
            console.log(
              "Find Meeting ID result : ",
              payload.object.id,
              meeting
            );
            if (meeting) {
              await Meeting.update({ id: meeting.id, ...meetingData });
              await score_meeting(meeting.id);
            } else {
              meeting_meeting_id = await Meeting.findByMeetingId(meetingId);
              if (meeting_meeting_id) {
                await Meeting.update({
                  id: meeting_meeting_id.id,
                  ...meetingData,
                });
                await score_meeting(meeting_meeting_id.id);
              } else {
                meeting = await Meeting.create(meetingData);
                await score_meeting(meeting.id);
                score_agenda(meeting.id);
                console.log(
                  "start create org Meeting ID result : ",
                  meetingId,
                  zoomUser.user_id
                );
                // Create organizer participant record
                await MeetingParticipant.create({
                  meetingId: meeting.id,
                  userId: zoomUser.user_id,
                  role: "organizer",
                });
                console.log(
                  "end create org Meeting ID result : ",
                  meetingId,
                  zoomUser.user_id
                );
              }
            }

            if (recording?.summary || recording?.summary != '') {
              const {
                promptContent: sysprompt,
                model,
                maxtokens,
                apiKey,
                provider,
              } = await Prompt.get("executive_summary");

              await pool.query(
                "UPDATE meetings SET api_by_summary = $1 WHERE id = $2",
                [`${provider}/${model}`, result?.id]
              );
            }
            if (recording?.transcripts) {
              intelligence_graph(result?.id);
              participant_value_analysis(meeting.id);
              await generateTasksInside(recording?.transcripts, meeting.id, zoomUser.user_id);
            }
          } catch (error) {
            console.error("Error creating/updating meeting:", error);
            throw error; // Re-throw as this is a critical error
          }

          // Process participants
          if (participants.length > 0) {
            try {
              const attendees = participants
                .filter((item) => item.user_email)
                .filter((item) => item.user_email !== zoomUser.mail)
                .map((participant) => ({
                  emailAddress: {
                    address: participant.user_email,
                    name:
                      participant.name || participant.user_email.split("@")[0],
                  },
                }));

              await addMeetingAttendees(attendees, meeting.id);
            } catch (error) {
              console.error("Error processing attendees:", error);
              // Continue execution even if attendee processing fails
            }
          }

          return res.status(200).json({
            message: "Meeting ended and processed successfully",
            meetingId,
          });
        } catch (error) {
          console.error("Error processing meeting.ended event:", error);
          return res.status(500).json({
            error: "Failed to process meeting.ended event",
            details: error.message,
          });
        }
        // await handleRecordingCompleted(body.payload.object);
        break;

      // Add other event cases as needed
      default:
        console.log("Unhandled Zoom webhook event:", event);
    }

    res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error) {
    console.error("Error processing Zoom webhook:", error);
    res.status(500).json({ error: "Failed to process webhook" });
  }
};
exports.enablescheduling = async (req, res) => {
  try {
    const userId = req.user.id;
    const zoomUser = await ZoomUser.findByUserId(userId);

    if (!zoomUser) {
      return res.status(404).json({
        success: false,
        message: "No Zoom connection found for this user",
      });
    }

    await ZoomUser.enablescheduling(userId);

    res.json({
      success: true,
      message: "Zoom scheduling enabled successfully",
    });
  } catch (err) {
    console.error("Error enabling Zoom scheduling:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.disablescheduling = async (req, res) => {
  try {
    const userId = req.user.id;
    const zoomUser = await ZoomUser.findByUserId(userId);

    if (!zoomUser) {
      return res.status(404).json({
        success: false,
        message: "No Zoom connection found for this user",
      });
    }

    await ZoomUser.disablescheduling(userId);

    res.json({
      success: true,
      message: "Zoom scheduling disabled successfully",
    });
  } catch (err) {
    console.error("Error disabling Zoom scheduling:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.getUserUpcomingMeetings = async (req, res) => {
  try {
    console.log("zoom-meetings-getUserUpcomingMeetings-start");

    const clientTime = req.body.time; // should be ISO string or timestamp from client
    const userId = req.user.id;
    const zoomUser = await ZoomUser.findByUserId(userId);
    console.log("zoom-meetings-getUserUpcomingMeetings-gmeetuser", zoomUser);

    if (!zoomUser) {
      return res.status(404).json({
        error: "Gmeet user not found",
      });
    }

    // const timeMin = new Date();
    // timeMin.setDate(timeMin.getDate()); // Go todays
    // const timeMax = new Date(); // Current date
    // timeMax.setDate(timeMax.getDate() + 14); // Go front 14 days

    const makeApiCall = async (accessToken) => {
      const today = new Date();

      const dayBeforeYesterday = new Date(today);
      dayBeforeYesterday.setDate(today.getDate());

      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 14);

      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const startDate = formatDate(dayBeforeYesterday);
      const endDate = formatDate(tomorrow);
      const url = `${process.env.ZOOM_API_BASE_URL}/users/${zoomUser?.account_id}/meetings`;

      try {
        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          params: { from: startDate, to: endDate },
        });
        return response.data;
      } catch (error) {
        console.error(
          "Error fetching meetings:",
          error.response ? error.response.data : error.message
        );
        throw error;
      }
    };

    const { meetings } = await handleZoomApiCall(makeApiCall, zoomUser);

    console.log("zoom-meetings-getUserUpcomingMeetings", meetings);
    const serverNow = new Date();
    const clientNow = clientTime ? new Date(clientTime) : serverNow;
    // Calculate the offset in milliseconds (client - server)
    const offsetMs = clientNow.getTime() - serverNow.getTime();

    const offsetMsWithUTC =
      offsetMs + (0 - serverNow.getTimezoneOffset()) * 60000;

    const googleMeetings = meetings
      // .filter(
      //   (meeting) =>
      //     meeting.isOnlineMeeting && meeting.onlineMeeting?.joinUrl
      // )
      .map((meeting) => {
        const utcDateStart = new Date(meeting.start_time);
        const utcDateEnd = new Date(utcDateStart.getTime() + meeting.duration * 60000);
        const localDateStart = new Date(
          utcDateStart.getTime() + offsetMsWithUTC
        );
        const localDateEnd = new Date(utcDateEnd.getTime() + offsetMsWithUTC);
        return {
          id: meeting.id,
          subject: meeting.topic,
          start: localDateStart, //meeting.start.dateTime,
          end: localDateEnd, //meeting.end.dateTime,
          joinUrl: meeting.join_url,
        };
      });

    res.json({
      success: true,
      message: "",
      upcomingMeeting: googleMeetings,
    });
  } catch (error) {
    throw error;
  }
};

exports.scheduleZoomMeeting = async (req, res) => {
  try {
    const { title, startTime, timeZone, organizerEmail } = req.body;
    if (!title || !startTime || !timeZone || !organizerEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Fetch userId and zoomUser, ensure they exist
    const user = await User.findByEmail(organizerEmail);
    if (!user) {
      return res.status(404).json({ error: 'Organizer not found' });
    }

    const zoomUser = await ZoomUser.findByUserId(user.id);
    if (!zoomUser || !zoomUser.zoom_access_token) {
      return res.status(400).json({ error: 'Zoom user or access token not found' });
    }

    // Function to call Zoom API
    const makeApiCall = async (accessToken) => {
      return await axios.post(
        `${process.env.ZOOM_API_BASE_URL}/users/${zoomUser.mail || 'me'}/meetings`,
        {
          topic: title,
          type: 2,
          start_time: startTime,
          duration: 40,
          timezone: timeZone,
          settings: {
            join_before_host: true,
            mute_upon_entry: true,
            approval_type: 0,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    };

    // Call your token handler
    const response = await handleZoomApiCall(makeApiCall, zoomUser);
    if (!response || !response.data) {
      throw new Error('Failed to create Zoom meeting');
    }

    console.log('✅ Meeting Created!');
    console.log('Join URL:', response.data.join_url);
    console.log('Start Time:', response.data.start_time);

    return res.json({
      success: true,
      message: 'Meeting Created!',
      data: response.data,
    });
  } catch (error) {
    console.error('Error scheduling Zoom meeting:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error',
      data: null,
    });
  }
};