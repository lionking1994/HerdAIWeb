const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const AWS = require("aws-sdk");
const qs = require("qs");
const { Client } = require("ssh2");
const crypto = require("crypto");
const mammoth = require("mammoth");
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const { score_meeting } = require("./companyStrategyController");
const User = require("../models/User");
const Meeting = require("../models/Meeting");
const MeetingParticipant = require("../models/MeetingParticipant");
const GmeetUser = require("../models/GmeetUser");
const Subscription = require("../models/HookSubscription");
const Prompt = require("../models/Prompt");
const pool = require("../config/database");
const { sendNotification } = require("../utils/socket");
const { processAI, test_prompt } = require("../utils/llmservice");
const { generateTasksInside } = require("./taskController");
const s3 = new AWS.S3();
const { score_agenda} = require("./companyStrategyController");
const { intelligence_graph} = require("./companyStrategyController");
/*
.../auth/userinfo.email	See your primary Google Account email address
.../auth/userinfo.profile	See your personal info, including any personal info you've made publicly available
.../auth/calendar	See, edit, share, and permanently delete all the calendars you can access using Google Calendar
.../auth/drive.readonly	See and download all your Google Drive files
.../auth/meetings.space.settings	Edit, and see settings for all of your Google Meet calls.
.../auth/drive.file	See, edit, create, and delete only the specific Google Drive files you use with this app
.../auth/drive.meet.readonly	See and download your Google Drive files that were created or edited by Google Meet.
.../auth/docs	See, edit, create, and delete all of your Google Drive files
.../auth/calendar.events	View and edit events on all your calendars
.../auth/calendar.events.readonly	View events on all your calendars
.../auth/meetings.space.readonly	Read information about any of your Google Meet conferences
*/

//https://meet.googleapis.com/v2/conferenceRecords?filter=space.meeting_code="tfu-ntoj-juy"

const sesClient = new SESClient({
  region: "us-east-1", // Change to your AWS SES region
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

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

const addMeetingAttendees = async (attendees, meeting_id) => {
  try {
    console.log("Adding meeting attendees:", attendees);
    console.log("Meeting ID:", meeting_id);
    if (attendees.length === 0 || !attendees) {
      return;
    } else {
      for (const attendee of attendees) {
        const user = await GmeetUser.findOne(
          `mail = '${attendee.address?.toLowerCase()}'`
        );
        const global_user = await User.findOne(
          `email = '${attendee.address?.toLowerCase()}'`
        );

        const exisitng_attendee =
          await MeetingParticipant.findByMeetingIdandUserId(
            meeting_id,
            user?.user_id ? user?.user_id : global_user?.id
          );
        console.log("exisitng_attendee", exisitng_attendee, meeting_id);
        if (!exisitng_attendee && attendee.responseStatus != "declined") {
          const meeting = await Meeting.findById(meeting_id);
          if ((user || global_user) && meeting) {
            await MeetingParticipant.create({
              meetingId: meeting_id,
              userId: user?.user_id || global_user?.id,
              role: "new_invite"
            });
            await pool.query(
              "INSERT INTO notifications (user_id, checked, notification, deleted, link, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
              [
                user?.user_id || global_user?.id,
                false,
                `You have been added to meet-'${meeting.title}'`,
                false,
                `/meeting-detail?id=${meeting_id}`,
                new Date(),
              ]
            );
            sendNotification({
              id: user?.user_id || global_user?.id,
              message: "You have been added to a meeting",
            });
          } else {
            // Generate invite token
            const inviteToken = uuidv4();

            // Create new user with invite token
            const newUser = await pool.query(
              "INSERT INTO users (email, name, provider, invite_token) VALUES ($1, $2, $3, $4) RETURNING *",
              [
                attendee.address?.toLowerCase(),
                attendee.name,
                "email",
                inviteToken,
              ]
            );

            // Add new user to meeting_participants
            await pool.query(
              "INSERT INTO meeting_participants (user_id, meeting_id, role) VALUES ($1, $2)",
              [newUser.rows[0].id, meeting_id, "new_invite"]
            );
            // Send email to new user
            const emailSubject =
              "Welcome to Herd AI - where we help you get productive, faster.";
            const emailBody = `
          <h2>Welcome to Our Platform!</h2>
        <p>You have been a part of a meeting that was digested by Herd AI, so we are welcoming you to create an account!</p> 
        <p>Please click the link below to join our platform:</p>
          <a href="${process.env.FRONTEND_URL}/set-password?token=${inviteToken}&email=${attendee.address}">Join Herd AI Now</a>
          <p>Thank you!</p>
          <p>Herd AI Team</p>
      `;
            await sendEmail({
              to: attendee.address,
              subject: emailSubject,
              html: emailBody,
            });
            console.log("Email sent to:", attendee.address);
          }
        } else {
          console.log(
            "attendee.responseStatus",
            attendee,
            exisitng_attendee.meeting_id
          );
          if (attendee.responseStatus == "declined") {
            // const result = await pool.query(
            //   "DELETE FROM meeting_participants WHERE meeting_id = $1 AND user_id = $2",
            //   [exisitng_attendee.meeting_id, exisitng_attendee.user_id]
            // );
          }
        }
      }
      return;
    }
  } catch (error) {
    console.error("Error adding meeting attendees:", error);
    throw error;
  }
};

const refreshGmeetToken = async (refresh_token) => {
  try {
    const response = await axios.post(process.env.GMEET_OAUTH_ENDPOINT, {
      client_id: process.env.GMEET_CLIENT_ID,
      client_secret: process.env.GMEET_CLIENT_SECRET,
      refresh_token: refresh_token,
      grant_type: "refresh_token",
    });

    const { access_token, expires_in, scope, token_type } = response.data;

    console.log("New Access Token:", access_token);
    console.log("Expires in (seconds):", expires_in);
    console.log("Scopes:", scope);
    console.log("Token Type:", token_type);

    return access_token;
  } catch (error) {
    console.error(
      "Error refreshing access token:",
      error.response?.data || error.message
    );
    throw error;
  }
};

const handleGmeetApiCall = async (apiCall, gmeetUser) => {
  try {
    return await apiCall(gmeetUser?.gmeet_access_token);
  } catch (error) {
    if (error.response?.status === 401) {
      // Token expired, refresh it
      const token = await refreshGmeetToken(gmeetUser.gmeet_refresh_token);

      // Update tokens in database
      await GmeetUser.update({
        ...gmeetUser,
        gmeet_access_token: token,
      });

      // Retry the request with new token
      return await apiCall(token);
    }
    throw error;
  }
};

const IsGmeetRecordingAvailable = async (
  meetingId,
  meetingTopic,
  record,
  fileIds,
  gmeetUser
) => {
  try {
    const makeApiCall = async (accessToken) => {
      console.log("meetingId", meetingId);
      console.log("meetingTopic", meetingTopic);
      console.log("record", JSON.stringify(record));
      // Parse the UTC startTime
      const dateUTC = new Date(record.startTime);

      // Convert to GMT-4 by subtracting 4 hours
      const dateGMTMinus4 = new Date(dateUTC.getTime() - 4 * 60 * 60 * 1000);

      // Extract components
      const year = dateGMTMinus4.getUTCFullYear();
      const month = String(dateGMTMinus4.getUTCMonth() + 1).padStart(2, "0"); // Months are 0-based
      const day = String(dateGMTMinus4.getUTCDate()).padStart(2, "0");
      const hours = String(dateGMTMinus4.getUTCHours()).padStart(2, "0");
      const minutes = String(dateGMTMinus4.getUTCMinutes()).padStart(2, "0");

      // Format the string
      const formattedTime = `${year}/${month}/${day} ${hours}:${minutes}`;
      // Create a search query that looks for files containing either the meeting ID or topic
      // const searchQuery = meetingTopic
      //   ? `name contains '${formattedTime}'`
      //   : `name contains '${meetingId}'`;

      const searchQuery = `name contains '${meetingId}' or name contains '${formattedTime}'`;
      const transcriptResponse = await axios.get(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          searchQuery
        )}&fields=files(id,name,createdTime)&orderBy=createdTime desc`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (transcriptResponse?.data?.files?.length > 0) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 2); // day before yesterday
        yesterday.setHours(0, 0, 0, 0); // start of that day

        const gmeetTranscription = transcriptResponse.data.files.find(
          (file) =>
            file.mimeType &&
            file.mimeType
              ?.toLowerCase()
              .includes("application/vnd.google-apps.document")
        );
        console.log(
          "files-id",
          gmeetTranscription?.id,
          fileIds.has(gmeetTranscription?.id)
        );
        console.log("gmeetTranscription", gmeetTranscription);
        if (gmeetTranscription && !fileIds.has(gmeetTranscription?.id)) {
          return { hasRecording: true, fileId: gmeetTranscription.id };
        } else {
          return { hasRecording: false, fileId: null };
        }
      }
      return { hasRecording: false, fileId: null };
    };

    return await handleGmeetApiCall(makeApiCall, gmeetUser);
  } catch (error) {
    console.error("Error fetching Gmeet recording:", error);
    // throw error;
    return { hasRecording: false, fileId: null };
  }
};

const getGmeetTranscript = async (fileId, gmeetUser) => {
  try {
    const makeApiCall = async (accessToken) => {
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export`;
      const mimeType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          mimeType,
        },
        responseType: "arraybuffer",
      });

      const result = await mammoth.extractRawText({ buffer: response.data });
      return result.value;
    };
    const transcript = await handleGmeetApiCall(makeApiCall, gmeetUser);
    /*
    const prompt = `You are given an original meeting text transcript. Convert it into a timestamped transcript format exactly as shown below:
[Format:]
00:00:00.000 --> 00:00:00.000
SpeakerName : Transcript text.

Instructions:
- Do NOT generate any additional sentences or text.
- Assign timestamps logically, starting at 00:00:00.000 and increasing realistically based on the text provided.
- Clearly separate each speech line.
- Include the meeting ending timestamp clearly at the end if provided.

Original text: ${transcript}`;
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
    */
    const sysprompt = `You are given an original meeting text transcript. Convert it into a timestamped transcript format exactly as shown below:
      [Format:]
      00:00:00.000 --> 00:00:00.000
      SpeakerName : Transcript text.
      
      Instructions:
      - Do NOT generate any additional sentences or text.
      - Assign timestamps logically, starting at 00:00:00.000 and increasing realistically based on the text provided.
      - Clearly separate each speech line.
      - Include the meeting ending timestamp clearly at the end if provided.
      `;
    const textLines = await processAI(
      sysprompt,
      `Original text: ${transcript}`,
      1000
    );

    const processedTranscript = await processGmeetTranscript(textLines);
    return processedTranscript;
  } catch (error) {
    console.error("Error fetching Gmeet transcript:", error);
    throw error;
  }
};

const processGmeetTranscript = async (transcript) => {
  try {
    /*
    const prompt = `Below is a meeting transcript. Please create a clear and concise summary that:
                      1. Highlights the key points discussed
                      2. Notes any important decisions or action items
                      3. Preserves the context of who said what when relevant based on only transcript.

    Transcript:
    ${transcript}`;

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

    // Return both the formatted transcript and the summary
    return JSON.stringify({
      transcript: transcript,
      summary: responseBody.completion.trim(),
    });
    */
    //const sysprompt = `Provide an executive summary of the meeting.`;
    // const summary = await processAI(sysprompt, transcript, 1000);
    const {
      promptContent: sysprompt,
      model,
      maxtokens,
      apiKey,
      provider,
    } = await Prompt.get("executive_summary");
    // const summary = await processAI(sysprompt, textLines, maxtokens);
    let response_prompt = await test_prompt(
      sysprompt,
      transcript,
      maxtokens,
      provider,
      model
    );
    if (response_prompt.status === true) {
      return JSON.stringify({
        transcript: transcript,
        summary: response_prompt.preview,
      });
    } else
      return JSON.stringify({
        transcript: transcript,
        summary: "Summary not available",
      });
  } catch (error) {
    console.error("Error processing transcript:", error);
    return transcript;
  }
};

const createCalendarWatch = async (userEmail, accessToken) => {
  try {
    // Generate a valid channel ID by encoding the email and adding a timestamp
    // This ensures uniqueness and valid characters
    const channelId = Buffer.from(
      `gmeet-subscription-${userEmail}-${Date.now()}`
    )
      .toString("base64")
      .replace(/[^A-Za-z0-9\-_+/=]/g, ""); // Ensure only valid characters

    const calendarId = "primary";
    const data = {
      id: channelId,
      type: "web_hook",
      address: process.env.GMEET_WEBHOOK_URI,
    };

    console.log("Watch config:", data);
    const response = await axios.post(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId
      )}/events/watch`,
      data,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Subscription created successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Error creating calendar watch:",
      error.response?.data || error.message
    );
    throw error;
  }
};

const createSubscription = async (userId, userDB_id, gmeetUser) => {
  try {
    const makeApiCall = async (accessToken) => {
      const response = await axios.post(
        "https://workspaceevents.googleapis.com/v1/subscriptions",
        {
          targetResource: `//cloudidentity.googleapis.com/users/${userId}`,
          eventTypes: [
            "google.workspace.meet.conference.v2.started",
            "google.workspace.meet.conference.v2.ended",
            "google.workspace.meet.participant.v2.joined",
            "google.workspace.meet.participant.v2.left",
          ],
          notificationEndpoint: {
            pubsubTopic: process.env.GMEET_PUBSUB_TOPIC,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    };

    const subscriptionData = await handleGmeetApiCall(makeApiCall, gmeetUser);

    if (subscriptionData.done) {
      await Subscription.create({
        subscription_id: subscriptionData.response.uid,
        user_id: userDB_id,
        type: "gmeet",
      });
    }
    console.log("✅ Subscription created successfully:", subscriptionData);
    return subscriptionData;
    /*
✅ Subscription created successfully: {
   name: 'operations/Ci8KJGMxYjkwMTIxLWM2ZjQtNGE5OS1hNzVjLTQyYzhjMzk2ZWE4MhACGgV1c2VycxoLCN_xub8GEOjHlA4iACgB',
   metadata: {
     '@type': 'type.googleapis.com/google.apps.events.subscriptions.v1.CreateSubscriptionMetadata'
   },
   done: true,
   response: {
     '@type': 'type.googleapis.com/google.apps.events.subscriptions.v1.Subscription',
     name: 'subscriptions/meet-users-c1b90121-c6f4-4a99-a75c-42c8c396ea82',
     uid: 'meet-users-c1b90121-c6f4-4a99-a75c-42c8c396ea82',
     targetResource: '//cloudidentity.googleapis.com/users/109721995713536469966',
     eventTypes: [
       'google.workspace.meet.conference.v2.started',
       'google.workspace.meet.conference.v2.ended',
       'google.workspace.meet.participant.v2.joined',
       'google.workspace.meet.participant.v2.left'
     ],
     payloadOptions: {},
     notificationEndpoint: { pubsubTopic: 'projects/herd-ai-app/topics/meet-events-topic' },
     state: 'ACTIVE',
     authority: 'users/109721995713536469966',
     createTime: '2025-04-03T12:02:39.029697Z',
     updateTime: '2025-04-03T12:02:39.029697Z',
     expireTime: '2025-04-10T12:02:38.679263Z',
     etag: '"c0eb9af8"'
   }
 }
    */
  } catch (error) {
    console.error(
      "❌ Error creating subscription:",
      error.response?.data || error.message
    );
    throw error;
  }
};

const deleteSubscription = async (subscriptionId, gmeetUser) => {
  try {
    const makeApiCall = async (accessToken) => {
      const response = await axios.delete(
        `https://workspaceevents.googleapis.com/v1/subscriptions/${subscriptionId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      return response.data;
    };

    const result = await handleGmeetApiCall(makeApiCall, gmeetUser);
    console.log("✅ Subscription deleted successfully:", result);

    // Update subscription type to delete_gmeet after successful deletion
    await Subscription.updateType(subscriptionId, "delete_gmeet");

    return result;
  } catch (error) {
    console.error(
      "❌ Error deleting subscription:",
      error.response?.data || error.message
    );
    throw error;
  }
};

const IsReportAvailable = async (meetingId, accessToken) => {
  try {
    const makeApiCall = async (accessToken) => {
      console.log("meetingId", meetingId);

      const conferenceRecordsResponse = await axios.get(
        `https://meet.googleapis.com/v2/conferenceRecords?filter=space.meeting_code="${meetingId}"`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (conferenceRecordsResponse?.data?.conferenceRecords?.length > 0) {
        return {
          status: true,
          records: conferenceRecordsResponse?.data?.conferenceRecords,
        };
      }
      return { status: false, records: [] };
    };

    return await handleGmeetApiCall(makeApiCall, accessToken);
  } catch (error) {
    console.error("Error fetching Gmeet recording:", error.status);
    return { status: false, records: [] };
  }
};

exports.getGmeetAuth = async (req, res) => {
  console.log("Gmeet Auth called-----------");
  const clientId = process.env.GMEET_CLIENT_ID;
  const redirectUri = process.env.GMEET_REDIRECT_URI;
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent(
    "profile email https://www.googleapis.com/auth/drive.meet.readonly https://www.googleapis.com/auth/meetings.space.readonly https://www.googleapis.com/auth/calendar.events"
  )}&access_type=offline&prompt=consent select_account`;
  res.redirect(authUrl);
};

exports.handleGmeetCallback = async (req, res) => {
  try {
    const { code } = req.body;
    const user_id = req.user.id;
    // Exchange authorization code for tokens
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      {
        code,
        client_id: process.env.GMEET_CLIENT_ID,
        client_secret: process.env.GMEET_CLIENT_SECRET,
        redirect_uri: process.env.GMEET_REDIRECT_URI,
        grant_type: "authorization_code",
      }
    );
    // Token response contains: access_token, expires_in, refresh_token, scope, token_type, id_token
    const { access_token, refresh_token, id_token } = tokenResponse.data;

    // Get user information using the access token
    const userInfoResponse = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    const userInfo = userInfoResponse.data;
    /*{
    id: '110118225766242999475',
    email: 'ihorz@a4d.com',
    verified_email: true,
    name: 'Ihor Zakharchenko',
    given_name: 'Ihor ',
    family_name: 'Zakharchenko',
    picture: 'https://lh3.googleusercontent.com/a/ACg8ocI0Iqybd3e98KRTpghJGGWTC_S-Co-c8GvEAR9Y3-FrbIDElg=s96-c',
    hd: 'a4d.com'
  }*/

    let gmeetUser = await GmeetUser.findByAccountId(userInfo.id);

    if (gmeetUser) {
      console.log("Gmeet User already exists");
      await GmeetUser.update({
        account_id: userInfo.id,
        name: userInfo.name,
        mail: userInfo.email,
        user_id: user_id,
        gmeet_access_token: access_token,
        gmeet_refresh_token: refresh_token,
        tenant_id: userInfo?.hd,
        role_name: "user",
        gmeet_scheduling: true,
        type: "gmeet",
      });
      gmeetUser = await GmeetUser.findByAccountId(userInfo.id);
    } else {
      console.log("Gmeet User does not exist, creating new user");
      gmeetUser = await GmeetUser.create({
        account_id: userInfo.id,
        name: userInfo.name,
        mail: userInfo.email,
        user_id: user_id,
        gmeet_access_token: access_token,
        gmeet_refresh_token: refresh_token,
        tenant_id: userInfo?.hd,
        role_name: "user",
        gmeet_scheduling: true,
        type: "gmeet",
      });
    }

    console.log("gmeetUser", gmeetUser);

    const subscription = await Subscription.findByUserId(user_id, "gmeet");
    console.log("subscription", subscription);
    if (subscription) {
      await deleteSubscription(subscription.subscription_id, gmeetUser);
    }

    await createSubscription(userInfo.id, user_id, {
      ...gmeetUser,
      gmeet_access_token: access_token,
      gmeet_refresh_token: refresh_token,
    });

    // Redirect to frontend with user info as URL parameters
    res.json({ success: true });
  } catch (error) {
    console.error("Google OAuth error:", error.response?.data || error.message);
    res.json({
      success: false,
      message: error.response?.data || error.message,
    });
  }
};

exports.disconnectGmeet = async (req, res) => {
  try {
    const user_id = req.user.id;
    const gmeetUser = await GmeetUser.findByUserId(user_id);

    if (!gmeetUser) {
      return res.status(404).json({
        success: false,
        message: "No Google Meet connection found for this user",
      });
    }


    const subscription = await Subscription.findByUserId(user_id, "gmeet");
    console.log("subscription", subscription);
    if (subscription) {
      await deleteSubscription(subscription.subscription_id, gmeetUser);
    }

    await GmeetUser.disconnect(gmeetUser.user_id);
    res.json({
      success: true,
      message: "Successfully disconnected from Google Meet",
    });
  } catch (error) {
    console.error("Error disconnecting Google Meet:", error);
    res.status(500).json({
      success: false,
      message: "Failed to disconnect from Google Meet",
    });
  }
};

exports.retrieveMeetingsInfo = async (req, res) => {
  const user_id = req.user.id;
  const gmeetUser = await GmeetUser.findByUserId(user_id);

  // Calculate last week's date range
  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 7); // Go back 7 days
  const timeMax = new Date(); // Current date

  const meetings = await handleGmeetApiCall(async (accessToken) => {
    const response = await axios.get(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
      {
        params: {
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return response.data?.items || [];
  }, gmeetUser);

  // Get existing meeting IDs from your database
  // const { rows: existingMeetings } = await pool.query(
  //   `SELECT meeting_id
  //      FROM meetings
  //      WHERE meeting_id = ANY($1)
  //  		 AND summary IS NOT NULL
  //      AND summary != ''
  // 		 AND platform = 'gmeet'
  //      AND org_id = $2`,
  //   [meetings.map((t) => t.id), user_id]
  // );
  const ids = meetings.map((t) => t.id);
  const sequences = meetings.map((t) => t.sequence);

  const { rows: existingMeetings } = await pool.query(
    `SELECT meeting_id 
     FROM meetings 
     WHERE (meeting_id, sequence) IN (
       SELECT unnest($1::text[]), unnest($2::int[])
     )
     AND summary IS NOT NULL 
     AND summary != ''
     AND platform = 'gmeet'
     AND org_id = $3
     AND isdeleted != true`,
    [ids, sequences, gmeetUser.user_id]
  );
  console.log("Existing meetings:", existingMeetings);
  const { rows: fileIdsArray } = await pool.query(
    `SELECT record_link FROM meetings m WHERE record_link IS NOT NULL AND platform = 'gmeet' AND isdeleted != true`
  );
  const fileIds = new Set(fileIdsArray.map((row) => row.record_link));
  console.log("fileIds", fileIds);
  // console.log("Existing meetings:", existingMeetings);

  const existingMeetingIds = new Set(existingMeetings.map((m) => m.meeting_id));
  console.log("existingMeetingIds", existingMeetingIds);

  // const meetingsAllIds = new Set(meetings.map((m) => m.id));
  // console.log("meetingsAllIds", meetingsAllIds);

  const transcriptFileids = new Set();
  const filter_meetings = await Promise.all(
    meetings
      .filter((meeting) =>
        meeting.hangoutLink && meeting.organizer.email === gmeetUser.mail
          ? true
          : false
      )
      .filter((meeting) => !existingMeetingIds.has(meeting.id))
      .map(async (meeting) => {
        const startTime = new Date(meeting.start.dateTime);
        const endTime = new Date(meeting.end.dateTime);
        const durationInMinutes = Math.round(
          (endTime - startTime) / (1000 * 60)
        );

        const isreportAvailable = await IsReportAvailable(
          meeting.conferenceData?.conferenceId,
          gmeetUser
        );

        console.log("isreportAvailable", isreportAvailable);

        let reportRecords = [];
        if (isreportAvailable.status) {
          // Wait for all the inner async calls to complete
          reportRecords = await Promise.all(
            isreportAvailable.records.map(async (record) => {
              const isRecordingAvailable = await IsGmeetRecordingAvailable(
                meeting.conferenceData?.conferenceId,
                meeting.summary, // Pass the meeting topic/summary
                record,
                fileIds,
                gmeetUser
              );
              let fileId = null;
              if (
                isRecordingAvailable.hasRecording &&
                transcriptFileids.has(isRecordingAvailable.fileId)
              )
                fileId = null;
              else if (
                isRecordingAvailable.hasRecording &&
                !transcriptFileids.has(isRecordingAvailable.fileId)
              ) {
                fileId = isRecordingAvailable.fileId;
                transcriptFileids.add(fileId);
              }

              const resport_startTime = new Date(record.startTime);
              const resport_endTime = new Date(record.endTime);
              const report_duration = Math.round(
                (resport_endTime - resport_startTime) / (1000 * 60)
              );

              return {
                event_id: meeting.conferenceData?.conferenceId,
                id: meeting.id,
                topic: meeting.summary,
                start_time: startTime,
                duration: durationInMinutes,
                end_time: meeting.end.dateTime,
                join_url: meeting.hangoutLink,
                participants: meeting?.attendees || [],
                creator: meeting.creator.email,
                isValid: fileId ? isRecordingAvailable.hasRecording : false,
                fileId: isRecordingAvailable.fileId,
                isRecordingAvailable,
                reportId: record.name,
                resport_startTime: resport_startTime,
                report_duration: report_duration,
                sequence: meeting.sequence,
                type: "gmeet",
              };
            })
          );
        } else {
          reportRecords = [
            {
              event_id: meeting.conferenceData?.conferenceId,
              id: meeting.id,
              topic: meeting.summary || null,
              start_time: startTime,
              duration: durationInMinutes,
              end_time: meeting.end.dateTime,
              join_url: meeting.hangoutLink,
              participants: meeting?.attendees || [],
              creator: meeting.creator.email,
              isValid: null,
              fileId: null,
              reportId: null,
              resport_startTime: null,
              report_duration: null,
              sequence: meeting.sequence,
              type: "gmeet",
            },
          ];
        }
        // Return an array of all records for this meeting
        return reportRecords;
      })
  );

  // // Sort meetings by start_time in descending order (newest first)
  // filter_meetings.sort(
  //   (a, b) => new Date(b.start_time) - new Date(a.start_time)
  // );

  const uniqueMeetings = filter_meetings
    .flat()
    .filter((meeting, index, self) => {
      // Keep meetings with null or undefined reportId
      if (meeting.reportId == null) return true;

      // Otherwise, keep only the first occurrence of each reportId
      return self.findIndex((m) => m.reportId === meeting.reportId) === index;
    });

  // Sort meetings by start_time in descending order (newest first)
  // return { success: true, meetings: uniqueMeetings };
  res.json({
    success: true,
    meetings: uniqueMeetings
  });
};

exports.setRetrievedMeetings = async (req, res) => {
  try {
    const { meetingList } = req.body;
    console.log("meetingList", meetingList);
    const userId = req.user.id;
    const gmeetUser = await GmeetUser.findByUserId(userId);
    // const userId = req.user.id;
    // const gmeetUser = await GmeetUser.findByUserId(userId);
    const meetingListPromises = meetingList.map(async (meeting) => {
      try {
        let recording = null;
        if (meeting.isValid) {
          recording = await getGmeetTranscript(meeting.fileId, gmeetUser);
          console.log("recording", recording);
          const transcriptionData = recording ? JSON.parse(recording) : null;
          recording = transcriptionData;
          console.log("transcriptionData", transcriptionData);
        }

        let transcript = recording?.transcript || "";
        let summary = recording?.summary || "";

        // const existingMeeting = await Meeting.findByMeetingId(meeting.id);
        const { rows: existingMeeting } = await pool.query(
          `SELECT * 
           FROM meetings 
           WHERE report_id = $1 OR ( summary = '' AND schedule_datetime = $2 AND schedule_duration = $3 AND teams_id = $4 AND isdeleted != true )`,
          [
            meeting.reportId,
            meeting.start_time,
            meeting.duration,
            meeting.event_id,
          ]
        );
        let result;
        console.log("existingMeeting", existingMeeting.length);
        console.log("existingMeeting", existingMeeting);

        if (existingMeeting.length) {
          // Update existing meeting
          result = existingMeeting[0];
          console.log("result", result, existingMeeting[0].id);
          const updatedMeeting = await Meeting.updateInGmeet({
            id: existingMeeting[0].id,
            summary: summary,
            title: meeting.topic || existingMeeting[0].title,
            datetime: meeting.resport_startTime || meeting.start_time,
            duration: meeting.report_duration || meeting.duration,
            record_link: meeting.fileId || null,
            org_id:
              meeting?.creator == gmeetUser.mail
                ? gmeetUser.user_id
                : existingMeeting[0].org_id,
            transcription_link: transcript,
            report_id: meeting.reportId,
            schedule_datetime: meeting.start_time,
            schedule_duration: meeting.duration,
            sequence: meeting?.sequence || 0,
          });
          console.log("Meeting updated:", updatedMeeting);
        } else {
          console.log("create meeting", meeting.reportId);
          // Create new meeting
          result = await Meeting.create({
            meeting_id: meeting.id,
            title: meeting.topic || "NO TITLE",
            description: null,
            summary: summary,
            datetime: meeting.resport_startTime || meeting.start_time,
            duration: meeting.report_duration || meeting.duration,
            joinUrl: meeting.join_url,
            teams_id: meeting.event_id,
            status: "scheduled",
            org_id:
              meeting?.creator == gmeetUser.mail ? gmeetUser.user_id : null,
            platform: "gmeet",
            transcription_link: transcript,
            record_link: meeting.fileId || null,
            report_id: meeting.reportId,
            schedule_datetime: meeting.start_time,
            schedule_duration: meeting.duration,
          });

          // Create organizer participant record
          if (meeting?.creator == gmeetUser.mail)
            await MeetingParticipant.create({
              meetingId: result.id,
              userId: gmeetUser.user_id,
              role: "organizer",
            });
          score_agenda(result.id);
        }

        const attendees = meeting.participants
          .filter(
            (item) =>
              item.email &&
              item.email !== "" &&
              item?.email?.toLowerCase() !== gmeetUser.mail?.toLowerCase()
          )
          .map((participant) => ({
            address: participant?.email,
            name: participant?.email,
            responseStatus: participant?.responseStatus,
          }));

        await addMeetingAttendees(attendees, result?.id);
        await updateGmeetAttendeeRoles(attendees, result?.id);
        // if (result.transcription_link) await score_meeting(result?.id);
        return {
          success: true,
          meetingId: meeting.id,
          message: "Meeting retrieved successfully",
        };
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

exports.webhook = async (req, res) => {
  const channelId = req.header("X-Goog-Channel-ID");
  const resourceId = req.header("X-Goog-Resource-ID");
  const resourceState = req.header("X-Goog-Resource-State");
  console.log("channelId", channelId);
  console.log("resourceId", resourceId);
  console.log("resourceState", resourceState);
  console.log("req.body", req.body);
  const message = Buffer.from(req.body.message.data, "base64").toString();
  const messageData = JSON.parse(message);
  console.log("Meet event received:", messageData);

  const type = req.body.message.attributes["ce-type"];
  console.log("type", type);
  let delayMs = 15 * 60000;
  // Process the event data here
  if (
    type === "google.workspace.meet.conference.v2.ended1" &&
    messageData?.conferenceRecord?.name
  ) {
    console.log("start-timeout-end-webhook", messageData?.conferenceRecord);
    setTimeout(async () => {
      // Extract the conference record name
      const conferenceRecordName = messageData.conferenceRecord.name;
      console.log("Conference Record Name:", conferenceRecordName);

      // Extract subscription ID from orderingKey
      const orderingKey = req.body.message.orderingKey;
      const subscriptionId = orderingKey.split("/").pop();
      console.log("Extracted subscription ID:", subscriptionId);

      const subscription = await Subscription.findById(subscriptionId);
      console.log("subscription", subscription?.user_id);
      if (subscription) {
        const gmeetUser = await GmeetUser.findByUserId(subscription.user_id);
        if (gmeetUser) {
          // Use handleGmeetApiCall instead of direct API call to handle token refreshing
          const makeApiCall = async (accessToken) => {
            const response = await axios.get(
              `https://meet.googleapis.com/v2/${conferenceRecordName}`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              }
            );
            return response.data;
          };

          try {
            const conferenceData = await handleGmeetApiCall(
              makeApiCall,
              gmeetUser
            );
            console.log("conferenceData", conferenceData);
            const space = conferenceData.space;
            console.log("space", space);

            // Use handleGmeetApiCall for this request too
            const makeSpaceApiCall = async (accessToken) => {
              const response = await axios.get(
                `https://meet.googleapis.com/v2/${space}`,
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                  },
                }
              );
              return response.data;
            };

            const { meetingUri } = await handleGmeetApiCall(
              makeSpaceApiCall,
              gmeetUser
            );
            console.log("meetingUri", meetingUri);
            /*
           meetingUrlData {
             name: 'spaces/WQoF2j_TA4kB',
             meetingUri: 'https://meet.google.com/enq-cqdy-dom',
             meetingCode: 'enq-cqdy-dom',
             config: { accessType: 'TRUSTED', entryPointAccess: 'ALL' }
           }
          */
            const meetings = await handleGmeetApiCall(async (accessToken) => {
              const response = await axios.get(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                  },
                }
              );
              return response.data?.items || [];
            }, gmeetUser);
            meetings.map(async (meeting) => {
              if (meeting?.hangoutLink?.includes(meetingUri)) {
                console.log("meeting", meeting);
                const { rows: fileIdsArray } = await pool.query(
                  `SELECT record_link FROM meetings m WHERE record_link IS NOT NULL AND platform = 'gmeet'`
                );
                const fileIds = new Set(
                  fileIdsArray.map((row) => row.record_link)
                );
                console.log("fileIds", fileIds);
                const isRecordingAvailable = await IsGmeetRecordingAvailable(
                  meeting.conferenceData?.conferenceId,
                  meeting.summary,
                  conferenceData,
                  fileIds,
                  gmeetUser
                );
                let recording = null;
                if (isRecordingAvailable.hasRecording) {
                  console.log("Recording available");
                  recording = await getGmeetTranscript(
                    isRecordingAvailable.fileId,
                    gmeetUser
                  );
                  console.log("recording", recording);
                  const transcriptionData = recording
                    ? JSON.parse(recording)
                    : null;
                  recording = transcriptionData;
                  console.log("transcriptionData", transcriptionData);
                }
                let transcript = recording?.transcript || "";
                let summary = recording?.summary || "";

                let result;
                const startTime = new Date(meeting.start.dateTime);
                const endTime = new Date(meeting.end.dateTime);
                const durationInMinutes = Math.round(
                  (endTime - startTime) / (1000 * 60)
                );
                const resport_startTime = new Date(conferenceData.startTime);
                const resport_endTime = new Date(conferenceData.endTime);
                const report_duration = Math.round(
                  (resport_endTime - resport_startTime) / (1000 * 60)
                );
                // const existingMeeting = await Meeting.findByMeetingId(
                //   meeting.id
                // );

                // const existingMeeting = await Meeting.findByMeetingId(meeting.id);
                const { rows: existingMeeting } = await pool.query(
                  `SELECT * 
           FROM meetings 
           WHERE report_id = $1 OR ( summary = '' AND schedule_datetime = $2 AND schedule_duration = $3 AND meeting_id = $4 )`,
                  [
                    meeting.reportId,
                    startTime,
                    durationInMinutes,
                    // meeting.conferenceData?.conferenceId,
                    meeting.id,
                  ]
                );

                if (existingMeeting.length) {
                  // Update existing meeting
                  result = existingMeeting[0];
                  const updatedMeeting = await Meeting.updateInGmeet({
                    id: existingMeeting[0].id,
                    summary: summary,
                    title: meeting.topic || existingMeeting[0].title,
                    datetime: meeting.start.dateTime,
                    duration: durationInMinutes,
                    org_id:
                      meeting?.creator?.email == gmeetUser.mail
                        ? gmeetUser.user_id
                        : existingMeeting[0].org_id,
                    transcription_link: transcript,
                    record_link: isRecordingAvailable?.fileId || null,
                    report_id: conferenceData.name,
                    schedule_datetime: meeting.start_time,
                    schedule_duration: meeting.duration,
                    sequence: meeting?.sequence || 0,
                  });
                  console.log("Meeting updated:", updatedMeeting);
                } else {
                  // Create new meeting
                  result = await Meeting.create({
                    meeting_id: meeting.id,
                    title: meeting.summary || "NO TITLE",
                    description: null,
                    summary: summary,
                    datetime: resport_startTime,
                    duration: report_duration,
                    joinUrl: meeting.hangoutLink,
                    teams_id: meeting.conferenceData?.conferenceId,
                    status: "scheduled",
                    org_id:
                      meeting?.creator?.email == gmeetUser.mail
                        ? gmeetUser.user_id
                        : null,
                    platform: "gmeet",
                    transcription_link: transcript,
                    record_link: isRecordingAvailable?.fileId || null,
                    report_id: conferenceData.name,
                    schedule_datetime: startTime,
                    schedule_duration: durationInMinutes,
                  });

                  // Create organizer participant record
                  if (meeting?.creator?.email == gmeetUser.mail)
                    await MeetingParticipant.create({
                      meetingId: result.id,
                      userId: gmeetUser.user_id,
                      role: "organizer",
                    });
                  score_agenda(result.id);
                }

                const attendees = meeting?.attendees
                  .filter(
                    (item) =>
                      item.email &&
                      item.email !== "" &&
                      item?.email?.toLowerCase() !==
                      gmeetUser.mail?.toLowerCase()
                  )
                  .map((participant) => ({
                    address: participant?.email,
                    name: participant?.email,
                    responseStatus: participant?.responseStatus,
                  }));

                if (transcript) {
                  intelligence_graph(result?.id);
                  await generateTasksInside(
                    transcript,
                    result?.id,
                    gmeetUser.user_id
                  );
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

                await addMeetingAttendees(attendees, result?.id);
                await updateGmeetAttendeeRoles(attendees, result?.id);
                await score_meeting(result?.id);
              }
            });

            // Process space data
          } catch (error) {
            console.error(
              "Error fetching conference data:",
              error.response?.data || error.message
            );
          }
        }
      }
    }, delayMs);
  }

  res.status(200).send(); // Respond with 200 OK to acknowledge receipt
};

const updateGmeetAttendeeRoles = async (attendees, meetingId) => {
  for (const attendee of attendees) {
    const attendeeEmail = attendee.address?.toLowerCase();
    const responseStatus = attendee?.responseStatus?.toLowerCase() || "needsAction";

    const { rows: userRows } = await pool.query(
      `SELECT id FROM users WHERE LOWER(email) = $1`,
      [attendeeEmail]
    );
    if (!userRows.length) continue;

    const userId = userRows[0].id;

    const { rowCount } = await pool.query(
      `SELECT 1 FROM meeting_participants WHERE meeting_id = $1 AND user_id = $2`,
      [meetingId, userId]
    );
    if (rowCount === 0) continue;

    let role = "new_invite";
    if (responseStatus === "accepted" || responseStatus === "tentative") {
      role = "accepted";
    } else if (responseStatus === "declined") {
      role = "rejected";
    }

    await pool.query(
      `UPDATE meeting_participants SET role = $1 WHERE meeting_id = $2 AND user_id = $3`,
      [role, meetingId, userId]
    );
  }
};


exports.setsametimeRetrievedMeetings = async (req, res) => {
  try {
    const { meetingList, gmeetUser } = req.body;
    console.log("meetingList", meetingList);
    // const userId = req.user.id;
    // const gmeetUser = await GmeetUser.findByUserId(userId);
    const meetingListPromises = meetingList.map(async (meeting) => {
      try {
        let recording = null;
        const { rows: fileIdsArray } = await pool.query(
          `SELECT record_link FROM meetings m WHERE record_link IS NOT NULL AND platform = 'gmeet'`
        );
        const fileIds = new Set(fileIdsArray.map((row) => row.record_link));
        if (meeting.isValid && !fileIds.has(meeting.fileId)) {
          recording = await getGmeetTranscript(meeting.fileId, gmeetUser);
          console.log("recording", recording);
          const transcriptionData = recording ? JSON.parse(recording) : null;
          recording = transcriptionData;
          console.log("transcriptionData", transcriptionData);
        }

        // let meet_org = await User.findOne(
        //   `email = '${meeting.creator?.toLowerCase()}'`
        // );
        // ----- meeting org set ----
        let meet_org = "";
        const { rows: org } = await pool.query(
          `SELECT * FROM gmeet_users WHERE mail = $1`,
          [meeting.creator?.toLowerCase()]
        );
        if (org.length) meet_org = org[0].user_id;
        else {
          const global_org = await User.findOne(
            `email = '${meeting.creator?.toLowerCase()}'`
          );

          if (!global_org) {
            // Generate invite token
            const inviteToken = uuidv4();

            // Create new user with invite token
            const { rows: newUser } = await pool.query(
              "INSERT INTO users (email, name, provider, invite_token) VALUES ($1, $2, $3, $4) RETURNING *",
              [
                meeting.creator?.toLowerCase(),
                meeting.creator,
                "email",
                inviteToken,
              ]
            );
            meet_org = newUser[0].id;
            // Send email to new user
            const emailSubject =
              "Welcome to Herd AI - where we help you get productive, faster.";
            const emailBody = `
          <h2>Welcome to Our Platform!</h2>
        <p>You have been a part of a meeting that was digested by Herd AI, so we are welcoming you to create an account!</p> 
        <p>Please click the link below to join our platform:</p>
          <a href="${process.env.FRONTEND_URL}/set-password?token=${inviteToken}&email=${meeting.creator}">Join Herd AI Now</a>
          <p>Thank you!</p>
          <p>Herd AI Team</p>
      `;
            await sendEmail({
              to: meeting.creator,
              subject: emailSubject,
              html: emailBody,
            });
            console.log("Email sent to:", meeting.creator);
          } else meet_org = global_org.id;
        }

        console.log("meet_org", meet_org);
        let transcript = recording?.transcript || "";
        let summary = recording?.summary || "";

        // const existingMeeting = await Meeting.findByMeetingId(meeting.id);
        const { rows: existingMeeting } = await pool.query(
          `SELECT * 
           FROM meetings 
           WHERE meeting_id = $1`,
          [meeting.id]
        );
        // WHERE (report_id = $1 OR ( summary = '' AND ( (schedule_datetime = $2 AND schedule_duration = $3) OR sequence != $5 ))) AND meeting_id = $4
        // meeting.reportId,
        // meeting.start_time,
        // meeting.duration,
        // meeting.sequence
        let result;
        console.log("existingMeeting", existingMeeting.length);
        console.log("existingMeeting", existingMeeting);

        if (existingMeeting.length) {
          //&& !meeting.reportId

          // Update existing meeting
          result = existingMeeting[0];

          console.log("result", result, existingMeeting[0].id);

          try {
            if (transcript && !existingMeeting[0].transcription_link) {
              intelligence_graph(result?.id);
              await generateTasksInside(
                transcript,
                result.id,
                existingMeeting[0].org_id
              );
              const {
                promptContent: sysprompt,
                model,
                maxtokens,
                apiKey,
                provider,
              } = await Prompt.get("executive_summary");

              await pool.query(
                "UPDATE meetings SET api_by_summary = $1 WHERE id = $2",
                [`${provider}/${model}`, result.id]
              );
            }
          } catch (error) {
            console.log("setsametimeRetrievedMeetings error:", error);
          }

          const updatedMeeting = await Meeting.updateInGmeet({
            id: existingMeeting[0].id,
            title: meeting.topic || existingMeeting[0].title,
            summary: summary || existingMeeting[0].summary,
            description: meeting?.description || existingMeeting[0].description,
            datetime: meeting.resport_startTime || existingMeeting[0].datetime,
            duration: meeting.report_duration || existingMeeting[0].duration,
            record_link: meeting.fileId || existingMeeting[0].record_link,
            org_id:
              // meeting?.creator == gmeetUser.mail
              // ? gmeetUser.user_id :
              existingMeeting[0].org_id,
            transcription_link:
              transcript || existingMeeting[0].transcription_link,
            report_id: meeting.reportId || existingMeeting[0].report_id,
            schedule_datetime: meeting.start_time,
            schedule_duration: meeting.duration,
            sequence: meeting?.sequence || existingMeeting[0].sequence,
          });
          console.log("Meeting updated:", updatedMeeting);
        } else {
          console.log("create meeting", meeting.reportId);
          // Create new meeting
          result = await Meeting.create({
            meeting_id: meeting.id,
            title: meeting.topic || "NO TITLE",
            description: meeting?.description || null,
            summary: summary,
            datetime: meeting.resport_startTime || meeting.start_time,
            duration: meeting.report_duration || meeting.duration,
            joinUrl: meeting.join_url,
            teams_id: meeting.event_id,
            status: "scheduled",
            org_id: meet_org,
            // meeting?.creator == gmeetUser.mail ? gmeetUser.user_id : null,
            platform: "gmeet",
            transcription_link: transcript,
            record_link: meeting.fileId || null,
            report_id: meeting.reportId,
            schedule_datetime: meeting.start_time,
            schedule_duration: meeting.duration,
          });

          // Create organizer participant record
          if (meeting?.creator && meet_org)
            await MeetingParticipant.create({
              meetingId: result.id,
              userId: meet_org,
              role: "organizer",
            });
          score_agenda(result.id);
          if (transcript) {
            intelligence_graph(result?.id);
            await generateTasksInside(transcript, result.id, meet_org);
          }
        }

        const attendees = meeting.participants
          .filter(
            (item) => item.email && item.email !== ""
            // && item?.email?.toLowerCase() !== gmeetUser.mail?.toLowerCase()
          )
          .map((participant) => ({
            address: participant?.email,
            name: participant?.email,
            responseStatus: participant?.email?.toLowerCase() !== gmeetUser.mail?.toLowerCase() ? "organizer": participant?.responseStatus,
          }));

        await addMeetingAttendees(attendees, result?.id);
        await updateGmeetAttendeeRoles(attendees, result?.id);
        if (!result.send_mail && result.transcription_link) {
          await score_meeting(result?.id);
          await pool.query(
            "UPDATE meetings SET send_mail = true WHERE id = $1",
            [result?.id]
          );
          const {
            promptContent: sysprompt,
            model,
            maxtokens,
            apiKey,
            provider,
          } = await Prompt.get("executive_summary");

          await pool.query(
            "UPDATE meetings SET api_by_summary = $1 WHERE id = $2",
            [`${provider}/${model}`, result.id]
          );
        }
        return {
          success: true,
          meetingId: meeting.id,
          message: "Meeting retrieved successfully",
        };
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

const fetchUpdatedEvents = async (calendarId, accessToken) => {
  const response = await axios.get(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  return response.data;
};
exports.enablescheduling = async (req, res) => {
  try {
    const user_id = req.user.id;
    const gmeetUser = await GmeetUser.findByUserId(user_id);

    if (!gmeetUser) {
      return res.status(404).json({
        success: false,
        message: "No Google Meet connection found for this user",
      });
    }

    await GmeetUser.enablescheduling(user_id);

    res.json({
      success: true,
      message: "Google Meet scheduling enabled successfully",
    });
  } catch (err) {
    console.error("Error enabling scheduling:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.disablescheduling = async (req, res) => {
  try {
    const user_id = req.user.id;
    const gmeetUser = await GmeetUser.findByUserId(user_id);

    if (!gmeetUser) {
      return res.status(404).json({
        success: false,
        message: "No Google Meet connection found for this user",
      });
    }

    await GmeetUser.disablescheduling(user_id);

    res.json({
      success: true,
      message: "Google Meet scheduling disabled successfully",
    });
  } catch (err) {
    console.error("Error disabling scheduling:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.getUserUpcomingMeetings = async (req, res) => {
  try {
    console.log("meetings-getUserUpcomingMeetings-start");

    const clientTime = req.body.time; // should be ISO string or timestamp from client
    const user_id = req.user.id;
    const gmeetuser = await GmeetUser.findByUserId(user_id);
    console.log("meetings-getUserUpcomingMeetings-gmeetuser", gmeetuser);

    if (!gmeetuser) {
      return res.status(404).json({
        error: "Gmeet user not found",
      });
    }

    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate()); // Go back 1 days
    const timeMax = new Date(); // Current date
    timeMax.setDate(timeMax.getDate() + 14); // Go front 1 days

    let meetings = await handleGmeetApiCall(async (gmeet_access_token) => {
      const response = await axios.get(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
        {
          params: {
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            singleEvents: true,
            orderBy: "startTime",
          },
          headers: {
            Authorization: `Bearer ${gmeet_access_token}`,
          },
        }
      );
      console.log("meeting list:", response.data?.items);
      return response.data?.items || [];
    }, gmeetuser);

    console.log("meetings-getUserUpcomingMeetings", meetings);
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
        const utcDateStart = new Date(meeting.start.dateTime);
        const utcDateEnd = new Date(meeting.end.dateTime);
        const localDateStart = new Date(
          utcDateStart.getTime() + offsetMsWithUTC
        );
        const localDateEnd = new Date(utcDateEnd.getTime() + offsetMsWithUTC);
        return {
          id: meeting.id,
          subject: meeting.summary,
          start: localDateStart, //meeting.start.dateTime,
          end: localDateEnd, //meeting.end.dateTime,
          joinUrl: meeting.hangoutLink,
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

exports.createGoogleCalendarMeeting = async (req, res) => {
  try {


    const {
      title,
      description,
      startTime,//"2025-04-17T11:00:00"
      endTime,//"2025-04-17T11:30:00"
      attendees,
      timeZone,
      organizerEmail
    } = req.body;
    console.log('organizerEmail:', organizerEmail)
    const userId = await User.findByEmail(organizerEmail);
    const gmeetUser = await GmeetUser.findByUserId(userId.id);
    console.log('gmeetUser:', gmeetUser)
    if (!title || !startTime || !endTime || !timeZone) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    const calendarId = "primary";

    const createdMeeting = await handleGmeetApiCall(async (accessToken) => {
      const response = await axios.post(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          summary: title,
          description,
          start: {
            dateTime: startTime,
            timeZone: timeZone
          },
          end: {
            dateTime: endTime,
            timeZone: timeZone
          },
          attendees: attendees?.map(email => ({ email })) || [],
          conferenceData: {
            createRequest: {
              requestId: `meet-${Date.now()}`,
              conferenceSolutionKey: {
                type: "hangoutsMeet"
              }
            }
          }
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          params: {
            conferenceDataVersion: 1
          }
        }
      );

      return response.data;
    }, gmeetUser);

    res.status(201).json({
      success: true,
      calendarId,
      meeting: createdMeeting
    });

  } catch (err) {
    console.error("Error creating Google Calendar meeting:", err?.response?.data || err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};