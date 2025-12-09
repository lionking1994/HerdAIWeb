const axios = require("axios");
const User = require("../models/User");
const { v4: uuidv4 } = require("uuid");
const { OAuth2Client } = require("google-auth-library");
const { Client } = require("@microsoft/microsoft-graph-client");
const { getAccessToken } = require("../utils/teams_oauth2");
const clientId = process.env.TEAMS_CLIENT_ID;
const clientSecret = process.env.TEAMS_CLIENT_SECRET;
const redirectUri = process.env.TEAMS_REDIRECT_URI;
const Meeting = require("../models/Meeting");
const TeamsUser = require("../models/TeamsUser");
const MeetingParticipant = require("../models/MeetingParticipant");
const Subscription = require("../models/HookSubscription");
const { score_meeting } = require("./companyStrategyController");
const dotenv = require("dotenv");
const { ConfidentialClientApplication } = require("@azure/msal-node");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const pool = require("../config/database");
const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
const { sendNotification } = require("../utils/socket"); // Adjust the path as necessary
const querystring = require("querystring");
dotenv.config();
const authConfig = require("../config/azureauth");
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const { processAI, test_prompt } = require("../utils/llmservice");
const Prompt = require("../models/Prompt");
const { generateTasks, generateTasksInside } = require("./taskController");
const { score_agenda } = require("./companyStrategyController");
const { participant_value_analysis } = require("./companyStrategyController");
const { intelligence_graph } = require("./companyStrategyController");
const { email_intelligence_graph } = require("./companyStrategyController");

/*
Microsoft Graph (19)  || 
Application.ReadWrite.All   || Application   || Read and write all applications  || Yes  ||  Not granted for GetHerd.AI  || 
Calendars.Read  || Delegated  || Read user calendars  || No  ||  Granted for GetHerd.AI  || 
Calendars.Read  || Application  || Read calendars in all mailboxes  || Yes  ||  Not granted for GetHerd.AI  || 
Calendars.Read.Shared  || Delegated  || Read user and shared calendars  || No  || 
Calendars.ReadWrite  || Delegated  || Have full access to user calendars  || No  ||  Granted for GetHerd.AI  || 
Calendars.ReadWrite  || Application  || Read and write calendars in all mailboxes  || Yes  ||  Not granted for GetHerd.AI  || 
Directory.Read.All  || Delegated  || Read directory data  || Yes  ||  Granted for GetHerd.AI  || 
Directory.Read.All  || Application  || Read directory data  || Yes  ||  Not granted for GetHerd.AI  || 
Directory.ReadWrite.All  || Delegated  || Read and write directory data  || Yes  ||  Not granted for GetHerd.AI  || 
offline_access  || Delegated  || Maintain access to data you have given it access to  || No  ||  Granted for GetHerd.AI  || 
OnlineMeetingArtifact.Read.All  || Delegated  || Read user's online meeting artifacts  || No  ||  Granted for GetHerd.AI  || 
OnlineMeetings.Read  || Delegated  || Read user's online meetings  || No  || 
OnlineMeetings.ReadWrite  || Delegated  || Read and create user's online meetings  || No  || Granted for GetHerd.AI  || 
OnlineMeetingTranscript.Read.All  || Delegated  || Read all transcripts of online meetings.  || Yes  ||  Granted for GetHerd.AI  || 
openid  || Delegated  || Sign users in  || No  ||  Granted for GetHerd.AI  || 
profile  || Delegated  || View users' basic profile  || No  ||  Granted for GetHerd.AI  || 
RoleManagement.Read.Directory  || Application  || Read all directory RBAC settings  || Yes  ||  Not granted for GetHerd.AI  || 
RoleManagement.ReadWrite.Directory  || Application  || Read and write all directory RBAC settings  || Yes  ||  Not granted for GetHerd.AI  || 
User.Read  || Delegated  || Sign in and read user profile  || No  ||  Granted for GetHerd.AI  ||  
*/


const sesClient = new SESClient({
  region: "us-east-1", // Change to your AWS SES region
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const msalConfig = {
  auth: {
    clientId: process.env.TEAMS_CLIENT_ID, // Replace with your client ID
    authority:
      "https://login.microsoftonline.com/" + process.env.TEAMS_TENANT_ID, // Replace with your tenant ID
    clientSecret: process.env.TEAMS_CLIENT_SECRET, // Replace with your client secret
  },
};

const cca = new ConfidentialClientApplication(msalConfig);

let tokenRefreshInterval;

const bedrock = new BedrockRuntimeClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const processTranscription = async (webvttContent) => {
  try {
    // Extract spoken text with speaker information from WEBVTT format
    const textLines = webvttContent
      .split("\n")
      .filter(
        (line) => line.includes("</v>") || line.match(/^\d{2}:\d{2}:\d{2}/)
      )
      .map((line, index, array) => {
        if (line.match(/^\d{2}:\d{2}:\d{2}/)) {
          return line;
        }
        const match = line.match(/<v ([^>]+)>(.+)<\/v>/);
        if (!match) return "";
        const [_, speaker, text] = match;
        return `${speaker.trim()} : ${text.trim()}`;
      })
      .filter((line) => line) // Remove empty lines
      .join("\n");

    // Skip processing if there's no meaningful text
    if (!textLines.trim()) {
      return "";
    }

    /*
    const sysprompt = `Below is a meeting transcript. Please create a clear and concise summary that:
                           1. Highlights the key points discussed
                           2. Notes any important decisions or action items
                           3. Preserves the context of who said what when relevant based on only transcript.

     Transcript:`;

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

    Return both the formatted transcript and the summary
    return JSON.stringify({
      transcript: textLines,
      summary: responseBody.completion.trim(),
    });
*/
    const { promptContent: sysprompt, model, maxtokens, apiKey, provider } = await Prompt.get("executive_summary");
    // const summary = await processAI(sysprompt, textLines, maxtokens);
    let response_prompt = await test_prompt(sysprompt, textLines, maxtokens, provider, model);
    if (response_prompt.status === true) {
      return JSON.stringify({
        transcript: textLines,
        summary: response_prompt.preview,
      });
    }
    else
      return JSON.stringify({
        transcript: textLines,
        summary: "Summary not available",
      });
  } catch (error) {
    console.error("Error processing transcription:", error);
    return webvttContent; // Return original content if processing fails
  }
};

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

const handleTeamsCallback = async (req, res) => {
  try {
    const { tokenResponse, refreshToken } = req.body;
    if (!tokenResponse || !refreshToken) {
      return res.status(400).json({ error: "Token is required" });
    }
    // console.log("Refresh Token:", refreshToken);
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update user's Teams credentials with polling enabled
    await User.updateTeamsCredentials(user.id, {
      access_token: tokenResponse.accessToken,
      refresh_token: refreshToken.secret,
      is_polling_enabled: true,
      lastMeetingsState: [],
    });

    let isTenant = false;
    if (tokenResponse.account.localAccountId) {
      const teamsUser = await TeamsUser.findByAccountId(
        tokenResponse.account.localAccountId
      );
      const tenant = await TeamsUser.findByTenantId(
        tokenResponse.account.tenantId
      );
      if (tenant) {
        isTenant = true;
      }
      if (teamsUser) {
        await TeamsUser.update({
          account_id: tokenResponse.account.localAccountId,
          name: tokenResponse.account.name,
          teams_access_token: tokenResponse.accessToken,
          teams_refresh_token: refreshToken.secret,
          // tenant_id: tokenResponse.account.tenantId,
          mail: tokenResponse.account.username,
          teams_scheduling: true,
          user_id: user.id,
        });
      } else {
        await TeamsUser.create({
          account_id: tokenResponse.account.localAccountId,
          name: tokenResponse.account.name,
          teams_access_token: tokenResponse.accessToken,
          teams_refresh_token: refreshToken.secret,
          tenant_id: tokenResponse.account.tenantId,
          mail: tokenResponse.account.username,
          teams_scheduling: true,
          user_id: user.id,
        });
      }
    } else {
      res.status(500).json({
        error: "Failed to connect Teams account",
      });
    }
    // startTokenRefresh(tokenResponse.expiresOn, refreshToken.secret, user.id);

    // Create Teams subscription
    try {
      const client = Client.init({
        authProvider: (done) => {
          done(null, tokenResponse.accessToken);
        },
      });

      const subscriptionData = {
        changeType: "created,updated,deleted",
        notificationUrl: `${process.env.API_BASE_URL}/api/teams/webhook`,
        resource: "/me/events",
        expirationDateTime: new Date(
          Date.now() + 5 * 24 * 60 * 60 * 1000
        ).toISOString(), // 1 day expiration
        clientState: uuidv4(), // Using UUID for unique client state
      };
      console.log("Subscription data:", subscriptionData);

      const subscription = await client
        .api("/subscriptions")
        .post(subscriptionData);
      console.log("Subscription created successfully:", subscription);
      if (subscription.id) {
        await Subscription.create({
          subscription_id: subscription.id,
          user_id: user.id,
          type: "schedule",
        });
      }

      // You might want to store the subscription details in your database
      await User.updateTeamsSubscription(user.id, subscription);
    } catch (subError) {
      console.error("Error creating subscription:", subError);
      // Continue with the response even if subscription fails
    }
    //GET /api/teams/calendar?startDateTime=2025-02-09T00:00:00Z&endDateTime=2025-02-10T00:00:00Z
    //const events = await getCalendarSchedule(accessToken, "2025-02-09T00:00:00Z", "2025-02-15T00:00:00Z");
    //console.log("Events:", events);
    res.json({
      success: true,
      message: "Teams account connected successfully",
      isTenant: isTenant,
    });
  } catch (error) {
    console.error("Teams callback error:", error);
    res.status(500).json({
      error: error.message || "Failed to connect Teams account",
    });
  }
};

const handleTeamsApiCall = async (apiCall, teamsUser) => {
  try {
    //const accessToken = await getAccessToken(teamsData?.tenantId);
    return await apiCall(teamsUser.teams_access_token);
    //return await apiCall(accessToken);

  } catch (error) {
    if (error.response?.status === 401) {
      // Token expired, refresh it
      const tokens = await refreshTeamsToken(teamsUser.user_id);

      console.log("Tokens:", tokens);
      // Retry the request with new token
      return await apiCall(tokens.access_token);
    }

    throw error;
  }
};

const refreshTeamsToken = async (user_id) => {
  try {
    const user = await TeamsUser.findByUserId(user_id);
    if (!user || !user.teams_refresh_token) {
      throw new Error("User not found or refresh token not found");
    }
    const refreshToken = user.teams_refresh_token;

    try {
      const tokenResponse = await axios.post(
        `https://login.microsoftonline.com/${user.tenant_id}/oauth2/v2.0/token`,
        {
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          scope: "https://graph.microsoft.com/.default",
          client_secret: process.env.TEAMS_CLIENT_SECRET,
          client_id: process.env.TEAMS_CLIENT_ID,
        },
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      if (tokenResponse.status !== 200) {
        throw new Error("Failed to refresh token");
      }

      await TeamsUser.update({
        account_id: user.account_id,
        name: user.name,
        mail: user.mail,
        user_id: user.user_id,
        teams_access_token: tokenResponse.data.access_token,
        teams_refresh_token: tokenResponse.data.refresh_token || null,
      });

      return {
        access_token: tokenResponse.data.access_token,
        refresh_token: tokenResponse.data.refresh_token,
      };
    } catch (error) {
      throw error;
    }
  } catch (error) {
    console.error("Silent token acquisition failed:", error?.response || error);
    throw error;
  }
};

const startTokenRefresh = async (expiresOn, refreshToken, user_id) => {
  if (!expiresOn || !refreshToken) {
    return;
  }
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
  }

  console.log("Token expiresOn:", expiresOn);

  tokenRefreshInterval = setInterval(async () => {
    try {
      const tokenResponse = await refreshTeamsToken(user_id);
      // console.log("Access Token (Renewed):", tokenResponse.data.access_token);
    } catch (error) {
      console.error("Token refresh error:", error);
    }
  }, 30 * 60 * 1000); // Renew 30 minutes before expiry
};

const stopTokenRefresh = () => {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = null;
  }
};

const disconnectTeams = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.body?.isAdmin ?? false;
    console.log("Disconnecting Teams for user:", userId);
    const teamsUser = await TeamsUser.findByUserId(userId);
    //if user have delete to enterprise application
    if (isAdmin) {
      try {
        const events = await handleTeamsApiCall(async (accessToken) => {
          const response = await axios.get(
            `https://graph.microsoft.com/v1.0/servicePrincipals`,
            {
              params: {
                $filter: `appId eq '${process.env.TEAMS_CLIENT_ID}'`,
              },
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
            }
          );
          if (response.data.value && response.data.value.length > 0) {
            var servicePrincipalId = response.data.value[0].id;
            console.log(`Token Service principal`, accessToken);
            if (servicePrincipalId) {
              // Ensure servicePrincipalId is valid
              try {
                var response111 = await axios.delete(
                  `https://graph.microsoft.com/v1.0/servicePrincipals/${servicePrincipalId}`,
                  {
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                      "Content-Type": "application/json",
                    },
                  }
                );
                console.log(
                  `Service principal ${servicePrincipalId} deleted successfully.`
                );
              } catch (error) {
                if (error.response?.status === 403) {
                  console.error(
                    "Insufficient privileges to deleted service principal."
                  );
                } else {
                  console.error(
                    "Error deleting service principal:",
                    error.response?.data || error.message
                  );
                }
              }
            }
          } else {
            console.error("No service principal found for the given appId.");
          }
        }, teamsUser);
      } catch (error) {
        console.error("Error ServicePrincipals", error);
      }
    }
    // Use the User.disconnectTeams method we already have in User model
    const updatedUser = await User.disconnectTeams(userId);

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (teamsUser) {
      await TeamsUser.disconnect(userId);
    }

    stopTokenRefresh();

    res.json({
      success: true,
      message: "Teams disconnected successfully",
    });
  } catch (error) {
    console.error("Error disconnecting Teams:", error);
    res.status(500).json({
      success: false,
      error: "Failed to disconnect Teams",
    });
  }
};

const checkIfUserIsAdmin = async (req, res) => {
  try {
    const userId = req.user.id;
    const teamsUser = await TeamsUser.findByUserId(userId);
    let isAdmin = false;
    console.log("account_id", teamsUser.account_id);
    const events = await handleTeamsApiCall(async (accessToken) => {
      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignments?$filter=principalId eq '${teamsUser.account_id}'`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      console.log("teamsrole", response.data.value);
      // Check if the user has Global Administrator role
      isAdmin = response.data.value.some(
        (role) =>
          role.roleDefinitionId === "62e90394-69f5-4237-9190-012177145e10" //Global Administrator Role Id
      );
    }, teamsUser);

    res.json({
      success: true,
      message: "Teams disconnected successfully",
      isAdmin: isAdmin,
    });
  } catch (error) {
    console.error(
      "Error checking user roles:",
      error.response?.data || error.message
    );
    res.json({
      success: true,
      message: "Teams disconnected successfully",
      isAdmin: false,
    });
  }
};

const activateTeams = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await User.updateTeamsStatus(user.id, true);
    res.status(200).json({ message: "Teams activated successfully" });
  } catch (error) {
    console.error("Teams activation error:", error);
    res.status(500).json({ error: "Failed to activate Teams" });
  }
};

const getCalendarSchedule = async (accessToken, startDateTime, endDateTime) => {
  try {
    const response = await axios.get(`${process.env.GRAPH_API_URL}/me/events`, {
      params: {
        $filter: `start/dateTime ge '${startDateTime}' and end/dateTime le '${endDateTime}'`,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    return response.data.value;
  } catch (error) {
    console.error("Error fetching calendar schedule:", error);
    throw error;
  }
};

const getTeamsCalendar = async (req, res) => {
  try {
    const user = await TeamsUser.findByUserId(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { startDateTime, endDateTime } = req.query;
    if (!startDateTime || !endDateTime) {
      return res
        .status(400)
        .json({ error: "Start and end dates are required" });
    }

    const events = await getCalendarSchedule(
      user.teams_access_token,
      startDateTime,
      endDateTime
    );
    res.json({
      success: true,
      events,
    });
  } catch (error) {
    console.error("Teams calendar error:", error);
    res.status(500).json({
      error: error.message || "Failed to fetch Teams calendar",
    });
  }
};

const getEventDetails = async (account_id, eventId) => {
  try {
    const teamsUser = await TeamsUser.findByAccountId(account_id); // assuming accessToken is actually userId here
    if (!teamsUser) {
      throw new Error("Teams user not found");
    }

    return await handleTeamsApiCall(async (accessToken) => {
      const client = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        },
      });

      // Fetch event details using /me endpoint since we're using user's access token
      const event = await client.api(`/me/events/${eventId}`).get();
      return event;
    }, teamsUser);
  } catch (error) {
    console.error("Error fetching event details:", error);

    // Check if error is due to invalid/expired token
    if (
      error.statusCode === 401 &&
      error.code === "InvalidAuthenticationToken"
    ) {
      try {
        const teamsUser = await TeamsUser.findByAccountId(account_id); // assuming accessToken is actually userId here

        if (!teamsUser) {
          throw new Error("Teams user not found");
        }

        const user = await User.findById(teamsUser.user_id);
        if (user) {
          // Disconnect Teams for this user
          // await User.disconnectTeams(user.id);
          // await TeamsUser.disconnect(user.id);
          // stopTokenRefresh();

          console.log(
            `Teams automatically disconnected for user ${user.id} due to invalid token`
          );
        }
      } catch (disconnectError) {
        console.error(
          "Error during automatic Teams disconnect:",
          disconnectError
        );
      }
    }

    throw error;
  }
};

const getEventDetailsForWebHook = async (account_id, eventId) => {
  try {
    const teamsUser = await TeamsUser.findByAccountId(account_id); // assuming accessToken is actually userId here
    if (!teamsUser) {
      throw new Error("Teams user not found");
    }
    return await handleTeamsApiCall(async (accessToken) => {
      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/me/events/${eventId}`, // ✅ removed extra `'`
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json', // ✅ should not be empty
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    }, teamsUser);
  } catch (error) {
    if (error.status === 404) {
      console.log(`Event ${eventId} was deleted.`);
      return null;
    }
    return null;
  }
};

const getRecordingFile = async (meetingDetails, accessToken) => {
  try {
    const response = await axios.get(
      `${process.env.GRAPH_API_URL}/me/drive/root:/Recordings:/children`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Recording file:", response.data.value[0]);
    // Find recording files that match the meeting's threadId
    const matchingRecordings = response.data.value.filter(
      (file) =>
        file.source?.threadId === meetingDetails.chatInfo?.threadId &&
        file.name.endsWith(".mp4")
    );

    // Return the first matching recording or null if none found
    return matchingRecordings || null;
  } catch (error) {
    console.error("Error fetching recording file:", error);
    throw error;
  }
};

const
  handleTeamsWebhook = async (req, res) => {
    try {
      // Handle subscription validation
      if (req.query.validationToken) {
        return res.status(200).send(req.query.validationToken);
      }

      const notifications = req.body.value;

      for (const notification of notifications) {
        try {
          const eventId = notification.resource.split("/").pop();

          const user_id = notification.resource.split("/")[1];
          const subscription = await Subscription.findById(notification.subscriptionId);
          if (!subscription || !subscription.user_id) continue;
          const user = await User.findById(subscription.user_id);

          const teamsUser = await TeamsUser.findByUserId(user.id);//event for the user webhook hits
          if (!teamsUser) {
            console.log("User not connected", teamsUser.mail);
            continue;
          }

          if (notification.changeType === "deleted") {
            console.log("delete", notification)
            await pool.query(
              `UPDATE meetings SET isdeleted = true , updated_at=$1 WHERE isdeleted = false AND teams_id = $2`,
              [new Date().toISOString(), eventId]
            );
            continue;
          }
          const eventDetails = await getEventDetailsForWebHook(teamsUser.account_id, eventId);
          if (!eventDetails) {
            continue;
          }
          // duplicate meeting validation
          const orgUserEmail = eventDetails.organizer?.emailAddress?.address.toLowerCase();
          const meetingAttenes = eventDetails.attendees.map((a) => ({
            address: a.emailAddress.address.toLowerCase()
          }));
          const allConnectedUsersResult = await pool.query(`SELECT * FROM teams_users WHERE is_connected = true`);
          const allConnectedUsers = allConnectedUsersResult.rows.map(u => u.mail.toLowerCase());

          const isOrganizerConnected = allConnectedUsers.includes(orgUserEmail);
          const isWebhookUserOrganizer = teamsUser.mail.toLowerCase() === orgUserEmail;
          const isWebhookUserAttendee = meetingAttenes.some(a => a.address === teamsUser.mail.toLowerCase());

          // CASE 1: Organizer is connected — process only for organizer
          if (isOrganizerConnected) {
            if (!isWebhookUserOrganizer) {
              continue; // skip attendee
            }
          }

          // CASE 2: Organizer not connected — process only first connected attendee
          else {
            if (!isWebhookUserAttendee) {
              continue;
            }

            const firstConnectedAttendee = meetingAttenes.find(a => allConnectedUsers.includes(a.address));
            if (!firstConnectedAttendee || firstConnectedAttendee.address !== teamsUser.mail.toLowerCase()) {
              continue;
            }
          }
          console.log("Webhoor processed for", teamsUser.mail)
          // Extract Join URL
          let joinUrl = null;
          if (subscription.type === "schedule") {
            joinUrl = eventDetails.onlineMeeting?.joinUrl;
          } else if (subscription.type === "Immediate") {
            const resourceUrl = decodeURIComponent(notification.resource);
            const match = resourceUrl.match(/19:meeting_([^@]+)@thread\.v2/);
            joinUrl = match ? match[1] : null;
          }
          const startDateTime = new Date(eventDetails.start.dateTime);
          const endDateTime = new Date(eventDetails.end.dateTime);
          const durationMinutes = Math.round((endDateTime - startDateTime) / (1000 * 60));
          const isRecurring = !!eventDetails.recurrence;
          const meetingDetails = await getMeetingDetails("me", "JoinWebUrl", joinUrl, user_id);
          const meeting = meetingDetails?.value[0];
          if (isRecurring) {
            const re_now = new Date();
            const re_fourteenDaysLater = new Date();
            re_fourteenDaysLater.setDate(re_now.getDate() + 14);
            const instances = await getRecurringInstances(
              teamsUser.account_id,
              eventId,
              re_now.toISOString(),
              re_fourteenDaysLater.toISOString()
            );
            const recuringMeeting = instances.value;
            if (notification.changeType === "created") {
              const idToCheck = meeting?.id ?? null;
              const existingMeetings = idToCheck
                ? await pool.query(`SELECT * FROM meetings WHERE meeting_id = $1`, [idToCheck])
                : await pool.query(`SELECT * FROM meetings WHERE teams_id = $1`, [eventId]);
              if (!existingMeetings.rows.length) {
                for (const instance of recuringMeeting) {
                  const instanceStart = new Date(instance.start.dateTime);
                  const instanceEnd = new Date(instance.end.dateTime);
                  const duration = Math.round((instanceEnd - instanceStart) / (1000 * 60));
                  const newMeeting = await Meeting.create({
                    meeting_id: meeting?.id,
                    title: eventDetails.subject,
                    description: eventDetails.body?.content || null,
                    summary: "",
                    datetime: instanceStart,
                    duration: duration,
                    joinUrl: joinUrl,
                    teams_id: eventId,
                    status: eventDetails.isCancelled ? "cancelled" : "scheduled",
                    org_id:
                      eventDetails.organizer?.emailAddress?.address?.toLowerCase() ===
                        teamsUser.mail?.toLowerCase()
                        ? teamsUser.user_id
                        : null,
                    platform: "teams",
                    transcription_link: "",
                    record_link: null,
                    report_id: null,
                    schedule_datetime: instanceStart,
                    schedule_duration: duration,
                    event_id: instance.id,
                    occurrence_Id: instance.occurrenceId
                  });

                  if (newMeeting.org_id == null) {
                    await addParticipantTomeeting(
                      { upn: orgUserEmail },
                      newMeeting.id
                    );
                  } else {
                    await MeetingParticipant.create({
                      meetingId: newMeeting.id,
                      userId: teamsUser.user_id,
                      role: "organizer",
                    });
                  }
                  await addMeetingAttendees(
                    meeting?.id,
                    eventDetails.attendees
                      .filter((attendee) =>
                        attendee.emailAddress.address.toLowerCase() !== orgUserEmail
                      )
                      .map((attendee) => ({
                        upn: attendee.emailAddress.address,
                      })),
                    teamsUser,
                    newMeeting.id,
                    null
                  );
                  score_agenda(newMeeting.id);
                }
              }
            }
            else if (notification.changeType === "updated") {
              let existingMeeting;
              const { rows: meetingsByTeamsId } = await pool.query(
                `SELECT * FROM meetings WHERE teams_id = $1`,
                [eventId]
              );

              if (meeting && meetingsByTeamsId.length && meetingsByTeamsId.some(row => !row.meeting_id)) {
                await pool.query(
                  `UPDATE meetings SET meeting_id = $1 WHERE meeting_id IS NULL AND teams_id = $2`,
                  [meeting.id, eventId]
                );
              }

              const recuringIds = instances.value.map((instance) => instance.id);
              await pool.query(
                `UPDATE meetings SET isdeleted = true, updated_at = $1 
              WHERE isdeleted = false 
              AND teams_id = $2 
              AND datetime > $3 
              AND event_id NOT IN(SELECT unnest($4::text[]))` ,
                [new Date().toISOString(), eventId, re_now, recuringIds]
              );
              for (const instance of recuringMeeting) {
                const instanceStart = new Date(instance.start.dateTime);
                const instanceEnd = new Date(instance.end.dateTime);
                const duration = Math.round((instanceEnd - instanceStart) / (1000 * 60));
                const exists = await pool.query(
                  `SELECT * FROM meetings WHERE event_id = $1`,
                  [instance.id]
                );
                if (exists.rowCount === 0) continue;

                const meetingToUpdate = exists.rows[0];

                if (instance.isCancelled) {
                  await pool.query(
                    `UPDATE meetings SET isdeleted = true, updated_at = $1 WHERE id = $2`,
                    [new Date().toISOString(), meetingToUpdate.id]
                  );
                }
                else {
                  await Meeting.updateInTeamsMeeting({
                    id: meetingToUpdate.id,
                    title: instance.subject,
                    description: instance.body?.content || null,
                    datetime: instanceStart,
                    duration: duration,
                    status: instance.isCancelleds ? "cancelled" : "scheduled",
                    org_id:
                      eventDetails.organizer?.emailAddress?.address?.toLowerCase() ===
                        teamsUser.mail?.toLowerCase()
                        ? teamsUser.user_id
                        : null,
                    schedule_datetime: instanceStart,
                    schedule_duration: duration,
                    event_id: instance.id,
                    updated_at: new Date().toISOString(),
                    joinUrl: meetingToUpdate.joinUrl || joinUrl || meeting?.joinWebUrl,
                    occurrence_Id: instance.occurrenceId
                  });

                  await addMeetingAttendees(
                    meeting?.id,
                    eventDetails.attendees
                      .filter((attendee) =>
                        attendee.emailAddress.address.toLowerCase() !== orgUserEmail
                      )
                      .map((attendee) => ({
                        upn: attendee.emailAddress.address,
                      })),
                    teamsUser,
                    meetingToUpdate.id,
                    null
                  );
                  const eventDetailsForInstance = await getEventDetailsForWebHook(
                    teamsUser.account_id,
                    instance.id
                  );
                  await updateAttendeeRoles(eventDetailsForInstance.attendees.filter((attendee) =>
                    attendee.emailAddress.address.toLowerCase() !== orgUserEmail
                  ), meetingToUpdate.id);
                }
              }
            }
          }
          else {
            const teams_uid = eventDetails.uid;
            if (notification.changeType === "created") {
              let existingMeetings;
              if (meeting) {
                const result = await pool.query(
                  `SELECT * FROM meetings WHERE meeting_id = $1`,
                  [meeting.id]
                );
                existingMeetings = result.rows;
              } else {
                const result = await pool.query(
                  `SELECT * FROM meetings WHERE event_id = $1`,
                  [teams_uid]
                );
                existingMeetings = result.rows;
              }
              if (!existingMeetings.length) {
                const newMeeting = await Meeting.create({
                  meeting_id: meeting?.id,
                  title: eventDetails.subject,
                  description: eventDetails.body?.content || null,
                  summary: "",
                  datetime: startDateTime,
                  duration: durationMinutes,
                  joinUrl: joinUrl,
                  teams_id: eventId,
                  status: eventDetails.isCancelled ? "cancelled" : "scheduled",
                  org_id:
                    eventDetails.organizer?.emailAddress?.address?.toLowerCase() ===
                      teamsUser.mail?.toLowerCase()
                      ? teamsUser.user_id
                      : null,
                  platform: "teams",
                  transcription_link: "",
                  record_link: null,
                  report_id: null,
                  schedule_datetime: startDateTime,
                  schedule_duration: durationMinutes,
                  event_id: teams_uid,
                });

                if (newMeeting.org_id == null) {
                  await addParticipantTomeeting(
                    { upn: orgUserEmail },
                    newMeeting.id
                  );
                } else {
                  await MeetingParticipant.create({
                    meetingId: newMeeting.id,
                    userId: teamsUser.user_id,
                    role: "organizer",
                  });
                }
                await addMeetingAttendees(
                  meeting?.id,
                  eventDetails.attendees
                    .filter((attendee) =>
                      attendee.emailAddress.address.toLowerCase() !== orgUserEmail
                    )
                    .map((attendee) => ({
                      upn: attendee.emailAddress.address,
                    })),
                  teamsUser,
                  newMeeting.id,
                  null
                );
                score_agenda(newMeeting.id);
              }

            }
            else if (notification.changeType === "updated") {
              let existingMeeting;

              const { rows: meetingsByTeamsId } = await pool.query(
                `SELECT * FROM meetings WHERE event_id = $1`,
                [teams_uid]
              );

              if (meeting && meetingsByTeamsId.length && meetingsByTeamsId.some(row => !row.meeting_id)) {
                await pool.query(
                  `UPDATE meetings SET meeting_id = $1 WHERE meeting_id IS NULL AND teams_id = $2`,
                  [meeting.id, eventId]
                );
              }

              if (meeting) {
                const { rows } = await pool.query(
                  `SELECT * FROM meetings WHERE meeting_id = $1`,
                  [meeting.id]
                );
                existingMeeting = rows[0];
              } else {
                existingMeeting = meetingsByTeamsId[0];
              }

              if (existingMeeting) {
                if (eventDetails.isCancelled) {
                  await pool.query(
                    `UPDATE meetings SET isdeleted = true, updated_at = $1 WHERE id = $2`,
                    [new Date().toISOString(), existingMeeting.id]
                  );
                }
                else {
                  const { rows } = await pool.query(
                    `SELECT * FROM meetings WHERE meeting_id = $1 AND (report_id IS NULL OR report_id = '')`,
                    [meeting.id]
                  );
                  const reschduleMeeting = rows[0]
                  if (reschduleMeeting) {
                    await Meeting.updateInTeamsMeeting({
                      id: reschduleMeeting.id,
                      title: eventDetails.subject,
                      description: eventDetails.body?.content || null,
                      datetime: startDateTime,
                      duration: durationMinutes,
                      status: eventDetails.isCancelled ? "cancelled" : "scheduled",
                      org_id:
                        eventDetails.organizer?.emailAddress?.address?.toLowerCase() ===
                          teamsUser.mail?.toLowerCase()
                          ? teamsUser.user_id
                          : null,
                      schedule_datetime: startDateTime,
                      schedule_duration: durationMinutes,
                      event_id: teams_uid,
                      updated_at: new Date().toISOString(),
                      joinUrl: reschduleMeeting.joinUrl || joinUrl || meeting?.joinWebUrl
                    });

                    await addMeetingAttendees(
                      meeting?.id,
                      eventDetails.attendees
                        .filter((attendee) =>
                          attendee.emailAddress.address.toLowerCase() !== orgUserEmail
                        )
                        .map((a) => ({ upn: a.emailAddress.address })),
                      teamsUser,
                      existingMeeting.id,
                      null
                    );
                    await updateAttendeeRoles(eventDetails.attendees.filter((attendee) =>
                      attendee.emailAddress.address.toLowerCase() !== orgUserEmail
                    ), existingMeeting.id);
                  }
                  else {
                    const newMeeting = await Meeting.create({
                      meeting_id: meeting?.id,
                      title: eventDetails.subject,
                      description: eventDetails.body?.content || null,
                      summary: "",
                      datetime: startDateTime,
                      duration: durationMinutes,
                      joinUrl: joinUrl,
                      teams_id: eventId,
                      status: eventDetails.isCancelled ? "cancelled" : "scheduled",
                      org_id:
                        eventDetails.organizer?.emailAddress?.address?.toLowerCase() ===
                          teamsUser.mail?.toLowerCase()
                          ? teamsUser.user_id
                          : null,
                      platform: "teams",
                      transcription_link: "",
                      record_link: null,
                      report_id: null,
                      schedule_datetime: startDateTime,
                      schedule_duration: durationMinutes,
                      event_id: teams_uid,
                    });

                    if (newMeeting.org_id == null) {
                      await addParticipantTomeeting(
                        { upn: orgUserEmail },
                        newMeeting.id
                      );
                    } else {
                      await MeetingParticipant.create({
                        meetingId: newMeeting.id,
                        userId: teamsUser.user_id,
                        role: "organizer",
                      });
                    }
                    await addMeetingAttendees(
                      meeting?.id,
                      eventDetails.attendees
                        .filter((attendee) =>
                          attendee.emailAddress.address.toLowerCase() !== orgUserEmail
                        )
                        .map((attendee) => ({
                          upn: attendee.emailAddress.address,
                        })),
                      teamsUser,
                      newMeeting.id,
                      null
                    );
                    await updateAttendeeRoles(eventDetails.attendees.filter((attendee) =>
                      attendee.emailAddress.address.toLowerCase() !== orgUserEmail
                    ), existingMeeting.id);
                    score_agenda(newMeeting.id);
                  }
                }
              }
            }
          }
        } catch (eventError) {
          console.error("Error processing single event:", eventError);
        }
      }
      res.status(202).send("Notifications processed");
    } catch (error) {
      console.error("Webhook handler error:", error);
      res.status(500).send("Internal server error");
    }
  };


const updateAttendeeRoles = async (attendees, meetingId) => {
  for (const attendee of attendees) {
    const attendeeEmail = attendee.emailAddress.address.toLowerCase();

    const responseStatus = attendee?.status?.response?.toLowerCase() || "none";
    const { rows: userRows } = await pool.query(
      `SELECT id FROM users WHERE LOWER(email) = $1`,
      [attendeeEmail]
    );
    if (!userRows.length) continue;
    const attendeeUserId = userRows[0].id;

    const { rowCount } = await pool.query(
      `SELECT 1 FROM meeting_participants WHERE meeting_id = $1 AND user_id = $2`,
      [meetingId, attendeeUserId]
    );
    if (rowCount === 0) continue;

    let role = "new_invite";
    if (responseStatus === "accepted" || responseStatus === "tentativelyaccepted") role = "accepted";
    else if (responseStatus === "declined") role = "rejected";

    await pool.query(
      `UPDATE meeting_participants SET role = $1 WHERE meeting_id = $2 AND user_id = $3`,
      [role, meetingId, attendeeUserId]
    );
  }
};

async function addParticipantTomeeting(
  organizer,
  result_id
) {
  if (!organizer || !result_id) {
    throw new Error("Missing required parameters");
  }
  const email = organizer.upn?.toLowerCase();
  if (!email) {
    throw new Error("Organizer email is missing");
  }
  const user = await User.findOne(`email = '${email}'`);
  const meeting = await Meeting.findById(result_id);

  if (user && meeting) {
    // Existing user1
    await MeetingParticipant.create({
      meetingId: result_id,
      userId: user.id,
      role: "organizer",
    });

    // await pool.query(
    //   "INSERT INTO notifications (user_id, checked, notification, deleted, link, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    //   [
    //     user.id,
    //     false,
    //     "You have been added to a meeting",
    //     false,
    //     `/meeting-detail?id=${result_id}`,
    //     new Date(),
    //   ]
    // );

    // sendNotification({
    //   id: user.id,
    //   message: "You have been added to a meeting",
    // });
  } else {
    console.log("User not found:", attendee.emailAddress?.toLowerCase());
    // Generate invite token
    const inviteToken = uuidv4();
    const displayName = attendee.identity?.displayName || email;

    // Create new user with invite token
    const newUser = await pool.query(
      "INSERT INTO users (email, name, provider, invite_token) VALUES ($1, $2, $3, $4) RETURNING *",
      [email, displayName, "email", inviteToken]
    );

    if (!newUser?.rows?.[0]?.id) {
      throw new Error("Failed to create new user");
    }

    await pool.query(
      "INSERT INTO meeting_participants (user_id, meeting_id, role) VALUES ($1, $2, $3)",
      [newUser.rows[0].id, result_id, "organizer"]
    );

    await sendEmail({
      to: email,
      subject:
        "Welcome to Herd AI - where we help you get productive, faster.",
      html: `
              <h2>Welcome to Our Platform!</h2>
              <p>You have been a part of a meeting that was digested by Herd AI, so we are welcoming you to create an account!</p> 
              <p>Please click the link below to join our platform:</p>
              <a href="${process.env.FRONTEND_URL}/set-password?token=${inviteToken}&email=${email}">Join Herd AI Now</a>
              <p>Thank you!</p>
              <p>Herd AI Team</p>
            `,
    });
  }

  return true
}

async function getRecurringInstances(accountId, eventId, startDateTime, endDateTime) {
  try {
    const teamsUser = await TeamsUser.findByAccountId(accountId);
    if (!teamsUser) {
      throw new Error("Teams user not found");
    }
    return await handleTeamsApiCall(async (accessToken) => {
      const response = await axios.get(
        `${process.env.GRAPH_API_URL}/me/events/${eventId}/instances`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          params: {
            startDateTime,
            endDateTime
          }
        }
      );
      return response.data;
    }, teamsUser);
  } catch (error) {
    console.error("Error getting recurring instances:", error);
    return [];
  }
}

const UpdatemeetingDB = async (
  JoinUrl,
  user_id,
  teamsUser,
  eventDetails,
  eventId,
  type
) => {
  try {
    const meeting_details = await getMeetingDetails(
      "me",
      "JoinWebUrl",
      JoinUrl,
      user_id
    );

    if (!meeting_details?.value?.[0]?.id) {
      console.error("Invalid meeting details received");
      return;
    }

    console.log("Meeting details:", meeting_details.value[0].id);

    let delayMs = 10;
    let processingTime;

    if (type === "webhook") {
      if (!eventDetails?.end?.dateTime) {
        console.error("Invalid event end time");
        return;
      }
      // Schedule the processing to occur 15 minutes after event end time
      const eventEndTime = new Date(eventDetails.end.dateTime);
      processingTime = new Date(eventEndTime.getTime() + 15 * 60000);
      const currentTime = new Date();
      delayMs = processingTime.getTime() - currentTime.getTime();

      if (delayMs < 0) {
        delayMs = 10 * 60 * 1000; // 10 minutes in milliseconds if event already ended
      }
    }

    const existing_meeting_reports = (await Meeting.findAll({})) || [];
    const existing_meeting_reports_ids = new Set(
      existing_meeting_reports.map((a) => a?.report_id).filter(Boolean)
    );

    console.log("start setting timeout", delayMs);

    setTimeout(async () => {
      console.log("Getting meeting report IDs");
      try {
        const { meetingReportIDs: meeting_Reports, totalReports } =
          await getMeetingReportIDs(
            meeting_details.value[0].id,
            teamsUser,
            existing_meeting_reports_ids
          );

        if (!meeting_Reports) {
          console.error("No meeting reports found");
          return;
        }

        // console.log("Meeting Reports:", meeting_Reports);
        // const report_id = meeting_Reports[0];
        // console.log("Meeting Report:", report_id);

        if (meeting_Reports.length > 0) {
          await Promise.all(
            meeting_Reports.map(async (report_id) => {
              try {
                console.log("Meeting Report:", report_id);
                const transcription_ids = await getTranscriptionIDFromReport(
                  report_id.id,
                  meeting_details.value[0].id,
                  teamsUser
                );

                console.log("Transcription ID:", transcription_ids);
                let transcript = "";
                let summary = "";

                if (transcription_ids?.length > 0) {
                  try {
                    const transcriptionPromises = transcription_ids
                      .filter((id) => id !== null && id?.id)
                      .map(async (transcription_id) => {
                        try {
                          const content = await getTranscriptionContent(
                            transcription_id.id,
                            meeting_details.value[0].id,
                            teamsUser
                          );
                          return content;
                        } catch (error) {
                          console.error(
                            "Error getting transcription content:",
                            error
                          );
                          return "";
                        }
                      });

                    const contents = await Promise.all(transcriptionPromises);
                    transcript = contents.join("\n");

                    if (transcript) {
                      try {
                        const processedTranscription =
                          await processTranscription(transcript);
                        const transcriptionData = processedTranscription
                          ? JSON.parse(processedTranscription)
                          : null;
                        transcript = transcriptionData?.transcript || "";
                        summary = transcriptionData?.summary || "";
                      } catch (error) {
                        console.error("Error processing transcription:", error);
                      }
                    }
                  } catch (error) {
                    console.error("Error processing transcriptions:", error);
                  }
                }

                // Database operations wrapped in try-catch
                if (transcript) {
                  try {
                    let descriptionhtml = null;
                    const eventDetails = await getEventDetailsForWebHook(teamsUser.account_id, eventId);
                    descriptionhtml = eventDetails?.body?.content;

                    const occurrenceId = eventDetails?.occurrenceId || null;
                    let existingMeetingResult;
                    let existingMeeting;

                    if (occurrenceId === null) {
                      // Case when occurrenceId is null
                      existingMeetingResult = await pool.query(
                        `SELECT * FROM meetings WHERE report_id IS NULL AND meeting_id = $1 AND occurrence_id IS NULL`,
                        [meeting_details.value[0].id]
                      );
                      existingMeeting = existingMeetingResult.rows;

                      if (existingMeeting.length === 0) {
                        existingMeetingResult = await pool.query(
                          `SELECT * FROM meetings WHERE report_id = $1 AND meeting_id = $2 AND occurrence_id IS NULL`,
                          [report_id.id, meeting_details.value[0].id]
                        );
                        existingMeeting = existingMeetingResult.rows;
                      }
                    } else {
                      // Case when occurrenceId has a value
                      existingMeetingResult = await pool.query(
                        `SELECT * FROM meetings WHERE report_id IS NULL AND meeting_id = $1 AND occurrence_id = $2`,
                        [meeting_details.value[0].id, occurrenceId]
                      );
                      existingMeeting = existingMeetingResult.rows;

                      if (existingMeeting.length === 0) {
                        existingMeetingResult = await pool.query(
                          `SELECT * FROM meetings WHERE report_id = $1 AND meeting_id = $2 AND occurrence_id = $3`,
                          [report_id.id, meeting_details.value[0].id, occurrenceId]
                        );
                        existingMeeting = existingMeetingResult.rows;
                      }
                    }
                    //old logic before handling null and non-null occurrenceId separately
                    // let existingMeetingResult = await pool.query(
                    //   `SELECT * FROM meetings WHERE report_id IS NULL AND meeting_id = $1 AND occurrence_id = $2`,
                    //   [meeting_details.value[0].id, occurrenceId]
                    // );

                    // let existingMeeting = existingMeetingResult.rows;

                    // if (existingMeeting.length === 0) {
                    //   existingMeetingResult = await pool.query(
                    //     `SELECT * FROM meetings WHERE report_id = $1 AND meeting_id = $2 AND occurrence_id = $3`,
                    //     [report_id.id, meeting_details.value[0].id, occurrenceId]
                    //   );
                    //   existingMeeting = existingMeetingResult.rows;
                    // }

                    let result;

                    //  if (!existingMeeting.length && created_meeting.length) {
                    //   existingMeeting = created_meeting;
                    // }
                    const startDateTime = new Date(report_id.meetingStartDateTime);
                    const endDateTime = new Date(report_id.meetingEndDateTime);
                    const schedule_datetime = new Date(eventDetails.startDateTime);
                    const schedule_endDateTime = new Date(eventDetails.endDateTime);
                    const schedule_duration = Math.round((schedule_endDateTime - schedule_datetime) / (1000 * 60));
                    const durationMinutes = Math.round((endDateTime - startDateTime) / (1000 * 60));

                    if (existingMeeting.length > 0) {
                      result = existingMeeting[0];
                      if (result.isdeleted == true) {
                        return
                      }

                      await Meeting.updateInTeams({
                        id: existingMeeting[0].id,
                        meeting_id: meeting_details.value[0].id,
                        title: meeting_details.value[0].subject,
                        description: existingMeeting[0].description || descriptionhtml,
                        summary: existingMeeting[0].summary || summary,
                        datetime: startDateTime,
                        duration: durationMinutes,
                        joinUrl:
                          meeting_details.value[0].joinMeetingIdSettings
                            ?.joinWebUrl,
                        teams_id: eventId,
                        status: meeting_details.value[0].isCancelled
                          ? "cancelled"
                          : "scheduled",
                        org_id:
                          meeting_details.value[0].participants?.organizer
                            ?.identity?.user?.id === teamsUser.account_id
                            ? teamsUser.user_id
                            : null,
                        platform: "teams",
                        transcription_link: existingMeeting[0].transcription_link || transcript,
                        record_link: null,
                        report_id: report_id.id,
                        occurrence_Id: occurrenceId
                      });

                      if (!existingMeeting[0].summary || summary) {
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
                    } else if (transcript) {
                      result = await Meeting.create({
                        meeting_id: meeting_details.value[0].id,
                        title: meeting_details.value[0].subject,
                        description: descriptionhtml || null,
                        summary: summary,
                        datetime: startDateTime,
                        duration: durationMinutes,
                        joinUrl: meeting_details.value[0].joinWebUrl,
                        teams_id: eventId,
                        status: meeting_details.value[0].isCancelled
                          ? "cancelled"
                          : "scheduled",
                        org_id:
                          meeting_details.value[0].participants?.organizer
                            ?.identity?.user?.id === teamsUser.account_id
                            ? teamsUser.user_id
                            : null,
                        platform: "teams",
                        transcription_link: transcript,
                        record_link: null,
                        report_id: report_id.id,
                        schedule_datetime: schedule_datetime,
                        schedule_duration: schedule_duration,
                        occurrence_Id: occurrenceId
                      });

                      await MeetingParticipant.create({
                        meetingId: result.id,
                        userId: teamsUser.user_id,
                        role: "organizer",
                      });

                      if (summary) {
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
                    }

                    if (result?.id) {
                      await addMeetingAttendees(
                        meeting_details.value[0].id,
                        meeting_details.value[0].participants?.attendees,
                        teamsUser,
                        result.id,
                        report_id.id
                      );
                    }
                    intelligence_graph(result.id);
                    participant_value_analysis(result.id);
                    score_agenda(result.id);
                    try {
                      await generateTasksInside(transcript, result.id, teamsUser.user_id);
                    } catch (error) {
                      console.log("setsametimeRetrievedMeetings error:", error);
                    }
                    try {
                      score_meeting(result?.id); // fire-and-forget
                    } catch (e) {
                      console.error("Unexpected error in fire-and-forget scoring:", e);
                    }
                  } catch (dbError) {
                    console.error("Database operation error:", dbError);
                  }
                }
              } catch (reportError) {
                console.error("Error processing report:", reportError);
              }
            })
          );
        }
        // Remove the meeting create and update logic beacause it is already handled in the webhook
        // else if (totalReports >= 0 && meeting_Reports?.length === 0) {
        //   try {
        //     const startDateTime = new Date(eventDetails?.start?.dateTime);
        //     const endDateTime = new Date(eventDetails?.end?.dateTime);
        //     const durationMinutes = Math.round(
        //       (endDateTime - startDateTime) / (1000 * 60)
        //     );

        //     const { rows: existingMeeting } = await pool.query(
        //       `SELECT *
        //        FROM meetings 
        //        WHERE meeting_id = $1`,
        //       [meeting_details.value[0].id]
        //     );

        //     let result;

        //     if (existingMeeting.length > 0) {
        //       result = existingMeeting[0];
        //       await Meeting.updateInTeams({
        //         id: existingMeeting[0].id,
        //         meeting_id: meeting_details.value[0].id,
        //         title: meeting_details.value[0].subject,
        //         description: meeting_details.value[0]?.bodyPreview || null,
        //         summary: existingMeeting[0].summary || "",
        //         datetime: startDateTime,
        //         duration: durationMinutes,
        //         joinUrl:
        //           meeting_details.value[0].joinMeetingIdSettings?.joinWebUrl,
        //         teams_id: eventId,
        //         status: meeting_details.value[0].isCancelled
        //           ? "cancelled"
        //           : "scheduled",
        //         org_id:
        //           meeting_details.value[0].participants?.organizer?.identity
        //             ?.user?.id === teamsUser.account_id
        //             ? teamsUser.user_id
        //             : null,
        //         platform: "teams",
        //         transcription_link: existingMeeting[0].transcription_link || "",
        //         record_link: null,
        //         report_id: existingMeeting[0].report_id || null,
        //       });
        //     } else if (!eventDetails.recurrence) {
        //       result = await Meeting.create({
        //         meeting_id: meeting_details.value[0].id,
        //         title: meeting_details.value[0].subject,
        //         description: meeting_details.value[0]?.bodyPreview || null,
        //         summary: "",
        //         datetime: startDateTime,
        //         duration: durationMinutes,
        //         joinUrl: meeting_details.value[0].joinWebUrl,
        //         teams_id: eventId,
        //         status: meeting_details.value[0].isCancelled
        //           ? "cancelled"
        //           : "scheduled",
        //         org_id:
        //           meeting_details.value[0].participants?.organizer?.identity
        //             ?.user?.id === teamsUser.account_id
        //             ? teamsUser.user_id
        //             : null,
        //         platform: "teams",
        //         transcription_link: "",
        //         record_link: null,
        //         report_id: null,
        //         schedule_datetime: startDateTime,
        //         schedule_duration: durationMinutes,
        //       });

        //       if (result?.id) {
        //         await MeetingParticipant.create({
        //           meetingId: result.id,
        //           userId: teamsUser.user_id,
        //           role: "organizer",
        //         });
        //       }
        //     }

        //     if (result?.id) {
        //       await addMeetingAttendees(
        //         meeting_details.value[0].id,
        //         meeting_details.value[0].participants?.attendees,
        //         teamsUser,
        //         result.id,
        //         null
        //       );
        //     }
        //   } catch (noReportError) {
        //     console.error(
        //       "Error processing meeting without report:",
        //       noReportError
        //     );
        //   }
        // }
      } catch (error) {
        console.error("Error in delayed meeting processing:", error);
      }
    }, delayMs);

    if (processingTime) {
      console.log(
        `Meeting processing scheduled for ${processingTime.toISOString()}`
      );
    }
    return { status: true, message: "Success update DB" };
  } catch (error) {
    console.error("Error in UpdatemeetingDB:", error);
    return { status: false, message: "Failed update DB", error: error };
  }
};

const updatemeetingdbapi = async (req, res) => {
  const { JoinUrl, user_id, teamsUser, eventDetails, eventId } = req.body;
  try {
    if (teamsUser?.is_outlook_connected == true || teamsUser.is_outlook_connected.toLowerCase() === "true") {
      chechkOutlookEmailSubscriptionIsActive(teamsUser?.teams_access_token, teamsUser?.user_id);
    }
    chechkSubscriptionIsActive(teamsUser?.teams_access_token, teamsUser.user_id)
    const result = await UpdatemeetingDB(
      JoinUrl,
      user_id,
      teamsUser,
      eventDetails,
      eventId,
      "lambda"
    );
    if (result.status)
      res.json({
        success: true,
        message: result.message,
      });
    else
      res.status(500).json({
        success: false,
        error: result.error,
      });
  } catch (error) {
    console.error("Error in updatemeetingdbapi:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update meeting database",
    });
  }
};

const getMeetingAttendanceReports = async (meeting_id, teamsUser) => {
  try {
    return await handleTeamsApiCall(async (accessToken) => {
      const response = await axios.get(
        `${process.env.GRAPH_API_URL}/me/onlineMeetings/${meeting_id}/attendanceReports`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.value.length > 0) {
        console.log("Attendance report found");
        return getAttendanceReportDetails(
          response.data.value[0].id,
          meeting_id,
          teamsUser
        );
      }
      return null;
    }, teamsUser);
  } catch (error) {
    console.error("Error getting attendance reports:", error);
    throw error;
  }
};

const getAttendanceReportDetails = async (
  attendance_report_id,
  meeting_id,
  teamsUser
) => {
  try {
    return await handleTeamsApiCall(async (accessToken) => {
      console.log(
        `Getting attendance report details : ${process.env.GRAPH_API_URL}/me/onlineMeetings/${meeting_id}/attendanceReports/${attendance_report_id}?$expand=attendanceRecords`
      );
      const response = await axios.get(
        `${process.env.GRAPH_API_URL}/me/onlineMeetings/${meeting_id}/attendanceReports/${attendance_report_id}?$expand=attendanceRecords`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.attendanceRecords.length > 0) {
        console.log(
          "Attendance report details:",
          response.data.attendanceRecords
        );
        return response.data.attendanceRecords;
      }
      return null;
    }, teamsUser);
  } catch (error) {
    console.error("Error getting attendance report details:", error);
    throw error;
  }
};

const getMeetingReportIDs = async (
  meeting_id,
  teamsUser,
  existing_meeting_reports_ids
) => {
  try {
    return await handleTeamsApiCall(async (accessToken) => {
      const response = await axios.get(
        `${process.env.GRAPH_API_URL}/me/onlineMeetings/${meeting_id}/attendanceReports`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      // Filter reports from the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const meetingReportIDs = response.data.value
        .filter((meetingReport) => {
          // Check if the meeting start time is within the last 7 days
          const meetingStartTime = new Date(meetingReport.meetingStartDateTime);
          return meetingStartTime >= sevenDaysAgo;
        })
        .filter(
          (meetingReport) => !existing_meeting_reports_ids.has(meetingReport.id)
        );
      // .map((meetingReport) => meetingReport.id);
      console.log("Meeting Report IDs:", meetingReportIDs);
      return { meetingReportIDs, totalReports: response.data.value.length };
    }, teamsUser);
  } catch (error) {
    console.error("Error getting meeting report IDs:", error);
    throw error;
  }
};

const getMeetingReportIDsForWebhook = async (
  meeting_id,
  teamsUser,
) => {
  try {
    return await handleTeamsApiCall(async (accessToken) => {
      const response = await axios.get(
        `${process.env.GRAPH_API_URL}/me/onlineMeetings/${meeting_id}/attendanceReports`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      const meetingReportIDs = response.data.value;

      return { meetingReportIDs };
    }, teamsUser);
  } catch (error) {
    console.error("Error getting meeting report IDs:", error);
    throw error;
  }
};

const addMeetingAttendees = async (
  meeting_id,
  meeting_attendees,
  teamsUser,
  result_id,
  report_id
) => {
  try {
    // Validate input parameters
    if (!teamsUser || !result_id) {
      throw new Error("Missing required parameters");
    }
    let attendees;
    if (report_id) {
      const response = await getAttendanceReportDetails(
        report_id,
        meeting_id,
        teamsUser
      );
      //: await getMeetingAttendanceReports(meeting_id, teamsUser);
      if (!response) {
        console.log("No attendance report found");
        return;
      }
      console.log("Attendance report:", response.length);
      attendees = response.filter((attendee) => attendee.role !== "Organizer");

      console.log("Attendees:", attendees.length);
      console.log("Attendees:", attendees);
    }

    const existing_attendees = new Set(
      attendees?.length > 0
        ? attendees.map((a) => a?.emailAddress?.toLowerCase())
        : []
    );
    console.log("Existing attendees:", existing_attendees);
    const invited_meeting_attendees = meeting_attendees
      .filter((attendee) => attendee.upn !== "" || attendee.upn !== null)
      .filter((attendee) => !existing_attendees.has(attendee.upn?.toLowerCase()))
      .map((attendee) => {
        return {
          emailAddress: attendee.upn,
          role: "new_invite",
          identity: { displayName: attendee.upn },
        };
      });

    console.log("Invited meeting attendees:", invited_meeting_attendees.length);
    console.log("Invited meeting attendees:", invited_meeting_attendees);
    let new_attendees = [];
    if (attendees?.length > 0) {
      new_attendees = [...invited_meeting_attendees, ...attendees];
    } else {
      new_attendees = invited_meeting_attendees;
    }
    console.log("New attendees:", new_attendees);

    if (!new_attendees?.length) {
      return;
    }

    for (const attendee of new_attendees) {
      try {
        if (!attendee.emailAddress) {
          console.log("Skipping attendee with no email address");
          continue;
        }

        const email = attendee.emailAddress?.toLowerCase();
        const user = await User.findOne(`email = '${email}'`);
        const meeting = await Meeting.findById(result_id);

        if (user && meeting) {
          // Handle existing user
          await MeetingParticipant.create({
            meetingId: result_id,
            userId: user.id,
            role: attendee.role == "new_invite" ? attendee.role : null,
          });

          // await pool.query(
          //   "INSERT INTO notifications (user_id, checked, notification, deleted, link, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
          //   [
          //     user.id,
          //     false,
          //     "You have been added to a meeting",
          //     false,
          //     `/meeting-detail?id=${result_id}`,
          //     new Date(),
          //   ]
          // );

          // sendNotification({
          //   id: user.id,
          //   message: "You have been added to a meeting",
          // });
        } else {
          console.log("User not found:", attendee.emailAddress?.toLowerCase());
          // Generate invite token
          const inviteToken = uuidv4();
          const displayName = attendee.identity?.displayName || email;

          // Create new user with invite token
          const newUser = await pool.query(
            "INSERT INTO users (email, name, provider, invite_token) VALUES ($1, $2, $3, $4) RETURNING *",
            [email, displayName, "email", inviteToken]
          );

          if (!newUser?.rows?.[0]?.id) {
            throw new Error("Failed to create new user");
          }

          await pool.query(
            "INSERT INTO meeting_participants (user_id, meeting_id, role) VALUES ($1, $2, $3)",
            [newUser.rows[0].id, result_id, attendee.role]
          );

          await sendEmail({
            to: email,
            subject:
              "Welcome to Herd AI - where we help you get productive, faster.",
            html: `
              <h2>Welcome to Our Platform!</h2>
              <p>You have been a part of a meeting that was digested by Herd AI, so we are welcoming you to create an account!</p> 
              <p>Please click the link below to join our platform:</p>
              <a href="${process.env.FRONTEND_URL}/set-password?token=${inviteToken}&email=${email}">Join Herd AI Now</a>
              <p>Thank you!</p>
              <p>Herd AI Team</p>
            `,
          });
        }
      } catch (attendeeError) {
        // Log error but continue processing other attendees
        console.error(
          `Error processing attendee ${attendee.emailAddress}:`,
          attendeeError
        );
      }
    }
  } catch (error) {
    console.error("Error adding meeting attendees:", error);
    throw error;
  }
};

const createMeeting = async (req, res) => {
  try {
    const { title, startDateTime, endDateTime, teamsData, joinUrl } = req.body;
    const organizerId = req.user.id;

    const join_url_id = joinUrl
      .split("19%3ameeting_")[1]
      .split("%40thread.v2")[0];
    console.log("Extracted Meeting ID:", join_url_id);

    const result = await Meeting.create({
      meeting_id: teamsData?.id,
      title,
      description: null,
      datetime: startDateTime,
      duration: (new Date(endDateTime) - new Date(startDateTime)) / (1000 * 60),
      joinUrl: join_url_id,
      teams_id: teamsData?.id,
      summary: null,
      org_id: organizerId,
      status: "immediate",
      platform: "teams",
      transcription_link: null,
      record_link: null,
      schedule_datetime: startDateTime,
      schedule_duration:
        (new Date(endDateTime) - new Date(startDateTime)) / (1000 * 60),
    });

    await MeetingParticipant.create({
      meetingId: result?.id,
      userId: organizerId,
      role: "organizer",
    });
    score_agenda(result.id);
    const accessToken = await getAccessToken(teamsData?.tenantId);

    // Create subscription for meeting updates
    const subscriptionData = {
      changeType: "updated",
      notificationUrl: `${process.env.API_BASE_URL}/api/teams/webhook`,
      resource: `communications/onlineMeetings?$filter=JoinWebUrl eq '${joinUrl}'`,
      expirationDateTime: new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ).toISOString(), // 24 hours
      clientState: "zoom-meeting-event",
    };

    try {
      const response = await axios.post(
        `${process.env.GRAPH_API_URL}/subscriptions`,
        subscriptionData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("Subscription Response:", response.data);
      await Subscription.create({
        subscription_id: response.data.id,
        user_id: organizerId,
        type: "Immediate",
      });
      res.json({
        success: true,
        message: "Meeting and subscription created successfully",
        subscriptionId: response.data.id,
      });
    } catch (error) {
      console.error(
        "Error Creating Subscription:",
        error.response?.data || error.message
      );
      res.status(500).json({
        success: false,
        error: error.response?.data || error.message,
      });
    }
  } catch (error) {
    console.error("Error creating Teams meeting:", error);
    res.status(500).json({
      error: error.message || "Failed to create meeting",
    });
  }
};

const getTranscriptionContent = async (
  transcription_id,
  meeting_id,
  teamsUser
) => {
  try {

    return await handleTeamsApiCall(async (accessToken) => {
      const response = await axios.get(
        `${process.env.GRAPH_API_URL}/me/onlineMeetings/${meeting_id}/transcripts/${transcription_id}/content`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "",
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    }, teamsUser);


  } catch (error) {
    console.error("Error fetching transcription content:", error);
    throw error;
  }
};

const getTranscriptionLink = async (user_id) => {
  try {
    const teamsUser = await TeamsUser.findByAccountId(user_id);

    return await handleTeamsApiCall(async (accessToken) => {
      const response = await axios.get(
        `${process.env.GRAPH_API_URL}/users/${user_id}/onlineMeetings/getAllTranscripts?$filter=MeetingOrganizer/User/Id eq '${user_id}'`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    }, teamsUser);
  } catch (error) {
    console.error("Error fetching transcription link:", error);
    throw error;
  }
};

const getMeetingDetails = async (type, filter, filter_value, user_id) => {
  try {
    const teamsUser = await TeamsUser.findByAccountId(user_id);
    if (!teamsUser) {
      throw new Error("Teams user not found");
    }

    const url = type === "me" ? "/me" : `/users/${user_id}`;

    return await handleTeamsApiCall(async (accessToken) => {
      if (filter === "meetingId") {
        const response = await axios.get(
          `${process.env.GRAPH_API_URL}${url}/onlineMeetings/${filter_value}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );
        return response;
      } else {
        const response = await axios.get(
          `${process.env.GRAPH_API_URL}${url}/onlineMeetings?$filter=${filter} eq '${filter_value}'`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );
        return response.data;
      }
    }, teamsUser);
  } catch (error) {
    console.error("Error fetching meeting details:", error);
    return null;
  }
};

const filterTranscriptionLink = async (transcription_list) => {
  try {
    // Get date range for past week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    console.log("Transcription list:", transcription_list.length);
    // Filter transcriptions from the past week
    const recentTranscriptions = transcription_list.filter((transcription) => {
      const createdDate = new Date(transcription.createdDateTime);
      return createdDate >= oneWeekAgo;
    });
    console.log("Recent transcriptions:", recentTranscriptions.length);

    // Get existing meetings with meeting_id and non-empty transcription_link
    const { rows: existingMeetings } = await pool.query(
      `SELECT meeting_id 
       FROM meetings 
       WHERE meeting_id = ANY($1) 
       AND transcription_link IS NOT NULL 
       AND transcription_link != ''`,
      [recentTranscriptions.map((t) => t.meetingId)]
    );
    console.log("Existing meetings:", existingMeetings.length);
    // console.log("Existing meetings:", existingMeetings);

    const existingMeetingIds = new Set(
      existingMeetings.map((m) => m.meeting_id)
    );

    // Filter out transcriptions that already have meetings recorded with transcriptions
    const newTranscriptions = recentTranscriptions.filter(
      (transcription) => !existingMeetingIds.has(transcription.meetingId)
    );

    return newTranscriptions;
  } catch (error) {
    console.error("Error filtering transcription links:", error);
    throw error;
  }
};

const isTranscriptionValid = async (event, user_id) => {
  try {
    const teamsUser = await TeamsUser.findByAccountId(user_id);
    console.log("Teams User:", teamsUser.account_id);
    if (!teamsUser) {
      return false;
    }

    let meeting = await getMeetingDetails(
      "me",
      "JoinWebUrl",
      event.onlineMeeting.joinUrl,
      teamsUser.account_id
    );
    console.log("Meeting:", meeting?.value[0].id);
    const transcription_ids = await getTranscriptionIds(
      meeting.value[0].id,
      teamsUser.account_id
    );

    return transcription_ids.length > 0;
  } catch (error) {
    console.error("Error checking transcription validity:", error);
    throw error;
  }
};

const getLastweekMeetingList = async (user_id) => {
  try {
    const teamsUser = await TeamsUser.findByAccountId(user_id);

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() - 7);
    const endDate = new Date().toISOString();
    const startDate = sevenDaysFromNow.toISOString();

    const existing_meeting_reports = await Meeting.findAll({});
    const existing_meeting_reports_ids = new Set(
      existing_meeting_reports.map((a) => a?.report_id)
    );

    // Use handleTeamsApiCall to make the request
    const events = await handleTeamsApiCall(async (accessToken) => {
      const response = await axios.get(
        `${process.env.GRAPH_API_URL}/me/calendar/calendarView?endDateTime=${endDate}&startDateTime=${startDate}&$top=100&$skip=0&`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data.value;
    }, teamsUser);
    // Filter and format meetings as before
    const formattedEvents = events
      .filter(
        (event) =>
          event.onlineMeeting &&
          event.organizer.emailAddress.address?.toLowerCase() ==
          teamsUser.mail?.toLowerCase()
      )
      .map((event) => ({
        id: event.id,
        subject: event.subject,
        startDateTime: event.start?.dateTime,
        endDateTime: event.end?.dateTime,
        onlineMeeting: event.onlineMeeting,
        body: event.body?.content || "", // full description
        seriesMasterId: event.seriesMasterId || null,
        occurrenceId: event.occurrenceId || null,
        participants: {
          attendees:
            event.attendees?.map((attendee) => ({
              email: attendee.emailAddress?.address,
              name: attendee.emailAddress?.name,
            })) || [],
        },
      }));

    const uniqueJoinUrls = new Set();
    const uniqueValidEvents = formattedEvents.filter((event) => {
      if (uniqueJoinUrls.has(event.onlineMeeting.joinUrl)) {
        return false;
      }
      uniqueJoinUrls.add(event.onlineMeeting.joinUrl);
      return true;
    });

    // Check transcription validity with handleTeamsApiCall
    const validEvents = await Promise.all(
      uniqueValidEvents.map(async (event) => {
        const meetingDetails = await getMeetingDetails(
          "me",
          "JoinWebUrl",
          event.onlineMeeting.joinUrl,
          teamsUser.account_id
        );
        const meeting_id = meetingDetails?.value[0].id;
        const { meetingReportIDs: reports, totalReports } =
          await getMeetingReportIDs(
            meeting_id,
            teamsUser,
            existing_meeting_reports_ids
          );
        const report_ids = reports.map((report) => report.id);
        if (totalReports > 0 && reports.length == 0) {
          return null;
        }
        return {
          ...event,
          subject: `${event.subject} (${report_ids?.length || 0})`,
          isValid: await isTranscriptionValid(event, user_id),
          meeting_id: meeting_id,
          report_ids: report_ids?.length > 0 ? report_ids : null,
          meeting_details: meetingDetails,
          report_details: reports?.length > 0 ? reports : null,
        };
      })
    );

    // First filter out null events and sort them
    const filteredEvents = validEvents
      .filter((event) => event !== null)
      .sort((a, b) => new Date(b.startDateTime) - new Date(a.startDateTime));

    // Then handle the async filtering properly
    const newMeetings = [];
    for (const event of filteredEvents) {
      if (event.report_ids) {
        newMeetings.push(event);
      } else {
        const { rows: existingMeeting } = await pool.query(
          `SELECT * 
           FROM meetings 
           WHERE teams_id = $1 AND datetime = $2 AND isdeleted != true`,
          [event.id, new Date(event.startDateTime)]
        );
        console.log("Existing meeting:", existingMeeting.length);
        if (existingMeeting.length === 0) {
          newMeetings.push(event);
        }
      }
    }

    return newMeetings;
  } catch (error) {
    console.error(
      "Error fetching last week meetings:",
      error.response?.data || error.message
    );
    throw error;
  }
};

const retrieveMeetingsInfo = async (req, res) => {
  try {
    const user = req.user;
    const user_id = user.id;
    const teamsUser = await TeamsUser.findByUserId(user_id);
    if (!teamsUser) {
      return res.status(404).json({
        error: "Teams user not found",
      });
    } else {
      const account_id = teamsUser.account_id;
      // const response = await getTranscriptionLink(account_id);
      // const filteredResponse = await filterTranscriptionLink(response.value);
      // // Use Promise.all to wait for all meeting details to be fetched
      // //      const response = await getLastweekMeetingList(account_id);
      // const meeting_details_list = await Promise.all(
      //   filteredResponse.map((transcription) =>
      //     getMeetingDetails("me", "meetingId", transcription.meetingId, account_id)
      //   )
      // );

      // // Extract the data from each response
      // const meetings = meeting_details_list.map((details) => details.data);
      const response = await getLastweekMeetingList(account_id);
      res.json({
        success: true,
        message: "Transcription link retrieved successfully",
        meetinglist: response, //meetings, //
        teamsUser: teamsUser,
      });
    }
  } catch (error) {
    console.error("Error retrieving meetings info:", error);
    throw error;
  }
};

const chechkSubscriptionIsActive = async (access_token, userId) => {
  // Create Teams subscription
  try {

    const client = Client.init({
      authProvider: (done) => {
        done(null, access_token);
      },
    });

    const existingSubscriptions = await client.api("/subscriptions").get();
    const subscriptionDataList = existingSubscriptions.value;
    const webhookUrl = `${process.env.API_BASE_URL}/api/teams/webhook`;
    const matchingSubscriptions = subscriptionDataList.filter(sub => sub.notificationUrl === webhookUrl);

    matchingSubscriptions.sort((a, b) =>
      new Date(b.expirationDateTime) - new Date(a.expirationDateTime)
    );
    const subscriptionsToDelete = matchingSubscriptions.slice(1);

    if (subscriptionsToDelete.length > 0) {
      for (const subscription of subscriptionsToDelete) {
        if (subscription.resource === "/me/events") {
          await client.api(`/subscriptions/${subscription.id}`).delete();
          console.log(`Deleted existing subscription: ${subscription.id}`);
        }
      }
    }
    if (matchingSubscriptions.length === 0) {
      const subscriptionData = {
        changeType: "created,updated,deleted",
        notificationUrl: `${process.env.API_BASE_URL}/api/teams/webhook`,
        resource: "/me/events",
        expirationDateTime: new Date(
          Date.now() + 5 * 24 * 60 * 60 * 1000
        ).toISOString(), // 1 day expiration
        clientState: uuidv4(), // Using UUID for unique client state
      };
      console.log("Subscription data:", subscriptionData);

      const subscription = await client
        .api("/subscriptions")
        .post(subscriptionData);
      console.log("Subscription created successfully:", subscription);
      if (subscription.id) {
        await Subscription.create({
          subscription_id: subscription.id,
          user_id: userId,
          type: "schedule",
        });

        // You might want to store the subscription details in your database
        await User.updateTeamsSubscription(userId, subscription);
      }
    }
  } catch (subError) {
    console.error("Error creating subscription:", subError);
  }
  return true;
}

const chechkOutlookEmailSubscriptionIsActive = async (access_token, userId) => {
  // Create Teams subscription
  try {
    const client = Client.init({
      authProvider: (done) => done(null, access_token),
    });

    const webhookUrl = `${process.env.API_BASE_URL}/api/teams/handleEmailWebhook`;
    const existingSubscriptions = await client.api("/subscriptions").get();
    const subscriptionDataList = existingSubscriptions.value || [];

    // Define both inbox and sent items configs
    const resources = [
      { name: "inbox", resource: "/me/messages" },
      { name: "sent", resource: "/me/mailFolders('sentitems')/messages" },
    ];

    for (const { name, resource } of resources) {
      const matchingSubs = subscriptionDataList
        .filter((sub) => sub.notificationUrl === webhookUrl && sub.resource === resource)
        .sort((a, b) => new Date(b.expirationDateTime) - new Date(a.expirationDateTime));

      // Keep only the most recent one
      const toDelete = matchingSubs.slice(1);
      for (const sub of toDelete) {
        try {
          await client.api(`/subscriptions/${sub.id}`).delete();
          console.log(`Deleted duplicate ${name} subscription: ${sub.id}`);
        } catch (err) {
          console.error(`Failed to delete ${name} subscription ${sub.id}:`, err.message);
        }
      }

      // Create a new subscription if none exist
      if (matchingSubs.length === 0) {
        const newSubData = {
          changeType: "created",
          notificationUrl: webhookUrl,
          resource,
          expirationDateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days
          clientState: uuidv4(),
        };

        console.log(`Creating new ${name} subscription:`, newSubData);

        const newSub = await client.api("/subscriptions").post(newSubData);
        console.log(`${name} subscription created successfully:`, newSub.id);

        if (newSub.id) {
          await Subscription.create({
            subscription_id: newSub.id,
            user_id: userId,
            type: "schedule/outlook",
          });
        }
      }
    }
  } catch (err) {
    console.error("Error creating Outlook email subscription:", err.message);
  }
  return true;
}

const getTranscriptionIds = async (meeting_id, account_id) => {
  const teamsUser = await TeamsUser.findByAccountId(account_id);
  if (!teamsUser) {
    throw new Error("Teams user not found");
  }

  return handleTeamsApiCall(async (accessToken) => {
    const response = await axios.get(
      `${process.env.GRAPH_API_URL}/me/onlineMeetings/${meeting_id}/transcripts`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data.value.map((transcription) => transcription.id);
  }, teamsUser);
};

const getTranscriptionIDFromReport = async (
  report_id,
  meeting_id,
  teamsUser
) => {
  try {
    return await handleTeamsApiCall(async (accessToken) => {

      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/me/onlineMeetings/${meeting_id}/transcripts??$filter=callId eq '${report_id}'`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "",
            "Content-Type": "application/json",
          },
        }
      );
      return response.data.value;
    }, teamsUser);
  } catch (error) {
    console.error("Error fetching transcription content:", error);
    throw error;
  }
};

const setRetrievedMeetings = async (req, res) => {
  try {
    const { meetingList: eventList } = req.body;
    const user = req.user;
    const user_id = user.id;
    const teamsUser = await TeamsUser.findByUserId(user_id);

    if (!teamsUser) {
      return res.status(404).json({ error: "Teams user not found" });
    }

    const meetingListPromises = eventList.map(async (event_details) => {
      try {
        const meeting = event_details.meeting_details.value[0];
        const meetingReportIDs = event_details.report_details;

        if (meetingReportIDs?.length > 0) {
          // Parallel processing for multiple reports
          const reportResults = await Promise.all(
            meetingReportIDs.map(async (report) => {
              const transcription_details = await getTranscriptionIDFromReport(report.id, meeting.id, teamsUser);

              let transcript = "";
              let summary = "";

              if (transcription_details.length > 0) {
                const transcriptionContents = await Promise.all(
                  transcription_details
                    .filter(id => id !== null)
                    .map(td =>
                      getTranscriptionContent(td.id, meeting.id, teamsUser)
                    )
                );
                transcript = transcriptionContents.join("\n");

                const processedTranscription = transcript ? await processTranscription(transcript) : 0;
                const transcriptionData = transcript ? JSON.parse(processedTranscription) : null;
                transcript = transcriptionData?.transcript;
                summary = transcriptionData?.summary;
              }

              const occurrenceId = event_details?.occurrenceId || null;

              let existingMeetingResult;
              let existingMeeting;

              if (occurrenceId === null) {
                // Case when occurrenceId is null
                existingMeetingResult = await pool.query(
                  `SELECT * FROM meetings WHERE report_id IS NULL AND meeting_id = $1 AND occurrence_id IS NULL AND isdeleted != true`,
                  [event_details.meeting_id]
                );
                existingMeeting = existingMeetingResult.rows;

                if (existingMeeting.length === 0) {
                  existingMeetingResult = await pool.query(
                    `SELECT * FROM meetings WHERE report_id = $1 AND meeting_id = $2 AND occurrence_id IS NULL AND isdeleted != true`,
                    [report.id, event_details.meeting_id]
                  );
                  existingMeeting = existingMeetingResult.rows;
                }
              } else {
                // Case when occurrenceId has a value
                existingMeetingResult = await pool.query(
                  `SELECT * FROM meetings WHERE report_id IS NULL AND meeting_id = $1 AND occurrence_id = $2 AND isdeleted != true`,
                  [event_details.meeting_id, occurrenceId]
                );
                existingMeeting = existingMeetingResult.rows;

                if (existingMeeting.length === 0) {
                  existingMeetingResult = await pool.query(
                    `SELECT * FROM meetings WHERE report_id = $1 AND meeting_id = $2 AND occurrence_id = $3 AND isdeleted != true`,
                    [report.id, event_details.meeting_id, occurrenceId]
                  );
                  existingMeeting = existingMeetingResult.rows;
                }
              }
              // let existingMeetingResult = await pool.query(
              //   `SELECT * FROM meetings WHERE report_id IS NULL AND meeting_id = $1 AND isdeleted != true`,
              //   [event_details.meeting_id]
              // );

              // let existingMeeting = existingMeetingResult.rows;

              // if (existingMeeting.length === 0) {
              //   existingMeetingResult = await pool.query(
              //     `SELECT * FROM meetings WHERE report_id = $1 AND meeting_id = $2 AND isdeleted != true`,
              //     [report.id, event_details.meeting_id]
              //   );
              //   existingMeeting = existingMeetingResult.rows;
              // }


              let result;
              const startDateTime = new Date(report.meetingStartDateTime);
              const endDateTime = new Date(report.meetingEndDateTime);
              const durationMinutes = Math.round((endDateTime - startDateTime) / (1000 * 60));
              const schedule_datetime = new Date(event_details.startDateTime);
              const schedule_endDateTime = new Date(event_details.endDateTime);
              const schedule_duration = Math.round((schedule_endDateTime - schedule_datetime) / (1000 * 60));

              const commonFields = {
                meeting_id: meeting.id,
                title: meeting.subject,
                description: event_details?.body || null,
                summary,
                datetime: startDateTime,
                duration: durationMinutes,
                joinUrl: meeting.joinMeetingIdSettings?.joinWebUrl,
                teams_id: event_details.id,
                status: meeting.isCancelled ? "cancelled" : "scheduled",
                org_id: meeting.participants?.organizer?.identity?.user?.id === teamsUser.account_id ? user.id : null,
                platform: "teams",
                transcription_link: transcript,
                record_link: null,
                report_id: report.id,
                schedule_datetime: schedule_datetime,
                schedule_duration: schedule_duration,
                event_id: event_details.id,
                occurrence_Id: event_details.occurrenceId || null,
              };

              if (existingMeeting.length > 0) {
                result = existingMeeting[0];
                await Meeting.updateInTeams({ id: result.id, ...commonFields });
              } else {
                result = await Meeting.create(commonFields);
                await MeetingParticipant.create({ meetingId: result.id, userId: user.id, role: "organizer" });
                score_agenda(result.id);
              }

              await addMeetingAttendees(meeting.id, meeting.participants?.attendees, teamsUser, result.id, report.id);

              if (summary) {
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

              try {
                if (transcript) {
                  intelligence_graph(result.id);
                  participant_value_analysis(result.id);
                  await generateTasksInside(transcript, result.id, user.id);
                }
              } catch (error) {
                console.log("setsametimeRetrievedMeetings error:", error);
              }
              try {
                if (transcript) {
                  score_meeting(result?.id); // fire-and-forget
                }
              } catch (e) {
                console.error("Unexpected error in fire-and-forget scoring:", e);
              }
            })
          );

        } else {
          // No report case
          let transcript = "", summary = "";

          const startDateTime = new Date(event_details?.startDateTime);
          const endDateTime = new Date(event_details?.endDateTime);
          const durationMinutes = Math.round((endDateTime - startDateTime) / (1000 * 60));

          const { rows: existingMeeting } = await pool.query(
            `SELECT * FROM meetings WHERE teams_id = $1 AND datetime = $2 AND isdeleted != true`,
            [event_details.id, startDateTime]
          );

          let result;
          const commonFields = {
            meeting_id: meeting.id,
            title: meeting.subject,
            description: event_details?.body || null,
            summary,
            datetime: startDateTime,
            duration: durationMinutes,
            joinUrl: meeting.joinWebUrl,
            teams_id: event_details.id,
            status: meeting.isCancelled ? "cancelled" : "scheduled",
            org_id: meeting.participants?.organizer?.identity?.user?.id === teamsUser.account_id ? user.id : null,
            platform: "teams",
            transcription_link: transcript,
            record_link: null,
            report_id: null,
            schedule_datetime: startDateTime,
            schedule_duration: durationMinutes,
            occurrence_Id: event_details.occurrenceId || null,
          };

          if (existingMeeting.length > 0) {
            result = existingMeeting[0];
            await Meeting.updateInTeams({ id: result.id, ...commonFields });
          } else {
            result = await Meeting.create(commonFields);
            await MeetingParticipant.create({ meetingId: result.id, userId: user.id, role: "organizer" });
            score_agenda(result.id);
          }

          await addMeetingAttendees(meeting.id, meeting.participants?.attendees, teamsUser, result.id, null);
        }

        return {
          success: true,
          meetingId: meeting.id,
          message: "Meeting retrieved successfully",
        };
      } catch (error) {
        return Promise.reject({
          meetingId: event_details.id,
          error: error.message || "Failed to process meeting",
        });
      }
    });

    // Wait for all meetings to process in parallel
    const results = await Promise.allSettled(meetingListPromises);
    const successful = results.filter(r => r.status === "fulfilled").map(r => r.value);
    const failed = results.filter(r => r.status === "rejected").map(r => r.reason);

    res.json({
      success: true,
      message: "Meetings retrieved successfully",
      results: {
        successful,
        failed,
        totalSuccessful: successful.length,
        totalFailed: failed.length,
      },
    });

  } catch (error) {
    console.error("Teams set retrieved meetings error:", error);
    res.status(500).json({ success: false, error: "Failed to set retrieved meetings" });
  }
};

const handleTranscriptionWebhook = async (req, res) => {
  res.json({
    success: true,
    message: "Transcription webhook received successfully",
  });
};

const getMeetings = async (user_id) => {
  try {
    const teamsUser = await TeamsUser.findByAccountId(user_id);

    const onehourFromNow = new Date();
    onehourFromNow.setHours(onehourFromNow.getHours() + 1);
    const endDate = onehourFromNow.toISOString();
    const startDate = new Date().toISOString();

    const existing_meeting_reports = await Meeting.findAll({});
    const existing_meeting_reports_ids = new Set(
      existing_meeting_reports.map((a) => a?.report_id)
    );

    // Use handleTeamsApiCall to make the request
    const events = await handleTeamsApiCall(async (accessToken) => {
      const response = await axios.get(
        // `${process.env.GRAPH_API_URL}/me/events?$filter=start/dateTime ge '${startDate}' and start/dateTime le '${endDate}'`,
        `${process.env.GRAPH_API_URL}/me/calendar/calendarView?endDateTime=${endDate}&startDateTime=${startDate}&top=100&skip=0`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data.value;
    }, teamsUser);
    // Filter and format meetings as before
    const formattedEvents = events
      .filter(
        (event) =>
          event.onlineMeeting &&
          event.organizer.emailAddress.address?.toLowerCase() ==
          teamsUser.mail?.toLowerCase()
      )
      .map((event) => ({
        id: event.id,
        subject: event.subject,
        startDateTime: event.start?.dateTime,
        endDateTime: event.end?.dateTime,
        onlineMeeting: event.onlineMeeting,
        body: event.bodyPreview,
        participants: {
          attendees:
            event.attendees?.map((attendee) => ({
              email: attendee.emailAddress?.address,
              name: attendee.emailAddress?.name,
            })) || [],
        },
      }));

    const uniqueJoinUrls = new Set();
    const uniqueValidEvents = formattedEvents.filter((event) => {
      if (uniqueJoinUrls.has(event.onlineMeeting.joinUrl)) {
        return false;
      }
      uniqueJoinUrls.add(event.onlineMeeting.joinUrl);
      return true;
    });

    // Check transcription validity with handleTeamsApiCall
    const validEvents = await Promise.all(
      uniqueValidEvents.map(async (event) => {
        const meetingDetails = await getMeetingDetails(
          "me",
          "JoinWebUrl",
          event.onlineMeeting.joinUrl,
          teamsUser.account_id
        );
        const meeting_id = meetingDetails?.value[0].id;
        const { meetingReportIDs: reports, totalReports } =
          await getMeetingReportIDs(
            meeting_id,
            teamsUser,
            existing_meeting_reports_ids
          );
        const report_ids = reports.map((report) => report.id);
        if (totalReports > 0 && reports.length == 0) {
          return null;
        }
        return {
          ...event,
          subject: `${event.subject} (${report_ids?.length || 0})`,
          startDateTime:
            reports[0]?.meetingStartDateTime || event.startDateTime,
          endDateTime: reports[0]?.meetingEndDateTime || event.endDateTime,
          isValid: await isTranscriptionValid(event, user_id),
          meeting_id: meeting_id,
          report_ids: report_ids?.length > 0 ? report_ids : null,
          meeting_details: meetingDetails,
          report_details: reports?.length > 0 ? reports : null,
        };
      })
    );

    // First filter out null events and sort them
    const filteredEvents = validEvents
      .filter((event) => event !== null)
      .sort((a, b) => new Date(b.startDateTime) - new Date(a.startDateTime));

    // Then handle the async filtering properly
    const newMeetings = [];
    for (const event of filteredEvents) {
      if (event.report_ids) {
        newMeetings.push(event);
      } else {
        const { rows: existingMeeting } = await pool.query(
          `SELECT * 
           FROM meetings 
           WHERE teams_id = $1 AND datetime = $2`,
          [event.id, new Date(event.startDateTime)]
        );
        console.log("Existing meeting:", existingMeeting.length);
        if (existingMeeting.length === 0) {
          newMeetings.push(event);
        }
      }
    }

    return newMeetings;
  } catch (error) {
    console.error(
      "Error fetching last week meetings:",
      error.response?.data || error.message
    );
    throw error;
  }
};

const getTeamsCalendarSchedule = async (req, res) => {
  try {
    const { schedules, startTime, endTime, timeZone, interval } = req.body;
    if (!schedules || !startTime || !endTime || !timeZone || !interval) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const user = req.user;
    const user_id = user.id;
    const teamsUser = await TeamsUser.findByUserId(user_id);
    if (!teamsUser) {
      return res.status(404).json({
        error: "Teams user not found",
      });
    }

    // ✅ Domain validation
    const domains = schedules.map((email) => email.split("@")[1]?.toLowerCase());
    const firstDomain = teamsUser.mail.split("@")[1]?.toLowerCase();
    const allSameDomain = domains.every((domain) => domain === firstDomain);

    if (!allSameDomain) {
      return res
        .status(400)
        .json({ error: "All email addresses must belong to the same domain" });
    }

    const calendarSchedule = await handleTeamsApiCall(async (accessToken) => {
      const data = {
        schedules,
        startTime: {
          dateTime: startTime,
          timeZone: timeZone,
        },
        endTime: {
          dateTime: endTime,
          timeZone: timeZone,
        },
        availabilityViewInterval: interval,
      };
      let config = {
        method: "post",
        maxBodyLength: Infinity,
        url: "https://graph.microsoft.com/v1.0/me/calendar/getSchedule",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Prefer: 'outlook.timezone="India Standard Time"',
          "Content-Type": "application/json",
        },
        data: data,
      };

      const response = await axios.request(config);
      return response?.data?.value || null;
    }, teamsUser);

    return res.json({
      success: true,
      message: "Teams Calendar Schedule List",
      data: calendarSchedule,
    });
  } catch (error) {
    res.json({
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const login = async (req, res) => {
  // Replace with your Azure AD application details
  console.log("login");
  const redirectUri = "http://localhost:3000/teams-callback"; // Must match your Azure AD registration
  const scope =
    "openid profile User.Read OnlineMeetings.ReadWrite OnlineMeetingTranscript.Read.All OnlineMeetingArtifact.Read.All Calendars.Read Calendars.ReadWrite offline_access Application.ReadWrite.All Directory.Read.All RoleManagement.Read.Directory"; // Add other necessary scopes
  const authEndpoint = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/authorize`;

  const authUrl = `${authEndpoint}?client_id=${process.env.TEAMS_CLIENT_ID
    }&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${encodeURIComponent(scope)}&prompt=consent`;
  res.redirect(authUrl);
};

const handleAzureCallback = async (req, res) => {
  const { code } = req.body;
  console.log("Code received:", code);
  const userId = req.user.id;
  console.log("User ID:", userId);
  const redirectUri = "http://localhost:3000/teams-callback"; // Must match your Azure AD registration
  const scope =
    "openid profile User.Read OnlineMeetings.ReadWrite OnlineMeetingTranscript.Read.All OnlineMeetingArtifact.Read.All Calendars.Read Calendars.ReadWrite offline_access Application.ReadWrite.All Directory.Read.All RoleManagement.Read.Directory"; // Add other necessary scopes
  const tokenEndpoint = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`;

  if (code && userId) {
    try {
      const tokenResponse = await axios.post(
        tokenEndpoint,
        querystring.stringify({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: redirectUri,
          client_id: process.env.TEAMS_CLIENT_ID,
          client_secret: process.env.TEAMS_CLIENT_SECRET,
          scope: scope,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );
      const { access_token, refresh_token, id_token, expires_in } =
        tokenResponse.data;

      console.log("Access Token:", access_token);
      console.log("Refresh Token:", refresh_token);
      console.log("ID Token:", id_token);
      console.log("Expires In (seconds):", expires_in);

      if (!tokenResponse || !refresh_token) {
        return res.status(400).json({ error: "Token is required" });
      }

      // Decode the ID token to access its claims
      const decodedIdToken = JSON.parse(
        Buffer.from(id_token.split(".")[1], "base64").toString()
      );

      const accountId = decodedIdToken.oid; // Object ID of the user
      const tenantId = decodedIdToken.tid; // Tenant ID
      const accountName = decodedIdToken.name; // User's name
      const accountUsername = decodedIdToken.preferred_username?.toLowerCase(); // User's email address
      console.log("Account ID:", accountId);
      console.log("Tenant ID from Token:", tenantId);
      // console.log("Refresh Token:", refresh_token);
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Update user's Teams credentials with polling enabled
      await User.updateTeamsCredentials(user.id, {
        access_token: access_token,
        refresh_token: refresh_token,
        is_polling_enabled: true,
        lastMeetingsState: [],
      });

      let isTenant = false;
      if (accountId) {
        const teamsUser = await TeamsUser.findByAccountId(accountId);
        const tenant = await TeamsUser.findByTenantId(tenantId);
        if (tenant) {
          isTenant = true;
        }
        if (teamsUser) {
          await TeamsUser.update({
            account_id: accountId,
            name: accountName,
            teams_access_token: access_token,
            teams_refresh_token: refresh_token,
            // tenant_id: tokenResponse.account.tenantId,
            mail: accountUsername,
            user_id: user.id,
          });
        } else {
          await TeamsUser.create({
            account_id: accountId,
            name: accountName,
            teams_access_token: access_token,
            teams_refresh_token: refresh_token,
            tenant_id: tenantId,
            mail: accountUsername,
            user_id: user.id,
          });
        }
      } else {
        res.status(500).json({
          error: "Failed to connect Teams account",
        });
      }

      // Create Teams subscription
      try {
        const client = Client.init({
          authProvider: (done) => {
            done(null, access_token);
          },
        });

        const subscriptionData = {
          changeType: "created,updated,deleted",
          notificationUrl: `${process.env.API_BASE_URL}/api/teams/webhook`,
          resource: "/me/events",
          expirationDateTime: new Date(
            Date.now() + 5 * 24 * 60 * 60 * 1000
          ).toISOString(), // 1 day expiration
          clientState: uuidv4(), // Using UUID for unique client state
        };
        console.log("Subscription data:", subscriptionData);

        const subscription = await client
          .api("/subscriptions")
          .post(subscriptionData);
        console.log("Subscription created successfully:", subscription);
        if (subscription.id) {
          await Subscription.create({
            subscription_id: subscription.id,
            user_id: user.id,
            type: "schedule",
          });
        }

        // You might want to store the subscription details in your database
        await User.updateTeamsSubscription(user.id, subscription);
      } catch (subError) {
        console.error("Error creating subscription:", subError);
        // Continue with the response even if subscription fails
      }
      //GET /api/teams/calendar?startDateTime=2025-02-09T00:00:00Z&endDateTime=2025-02-10T00:00:00Z
      //const events = await getCalendarSchedule(accessToken, "2025-02-09T00:00:00Z", "2025-02-15T00:00:00Z");
      //console.log("Events:", events);
      res.json({
        success: true,
        message: "Teams account connected successfully",
        isTenant: isTenant,
      });
    } catch (error) {
      console.error("Error exchanging code for token:", error.message);
      if (error.response && error.response.data) {
        console.error("Error details:", error.response.data);
      }
      res.status(500).send("Authentication failed");
    }
  } else {
    res.status(400).send("Authorization code not received");
  }
};

const scheduleTeamsMeeting = async (req, res) => {
  try {
    const { subject, startTime, endTime, timeZone, attendees, contentType, content } = req.body;

    if (!subject || !startTime || !endTime || !timeZone || !attendees) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const user = req.user;
    const user_id = user.id;

    console.log("---scheduleTeamsMeeting log 1 start ---");

    const teamsUser = await TeamsUser.findByUserId(user_id);
    if (!teamsUser) {
      return res.status(404).json({ error: "Teams user not found" });
    }

    const meetingResponse = await handleTeamsApiCall(async (accessToken) => {
      const payload = {
        subject: subject,
        start: {
          dateTime: startTime,
          timeZone: timeZone,
        },
        end: {
          dateTime: endTime,
          timeZone: timeZone,
        },
        location: {
          displayName: "Microsoft Teams Meeting",
        },
        attendees: attendees,
        allowNewTimeProposals: true,
        isOnlineMeeting: true,
        onlineMeetingProvider: "teamsForBusiness",
        body: {
          contentType: contentType || "HTML", //"HTML", // or "Text"
          content: content || "" // Replace with your actual description variable
        }
      };

      const config = {
        method: 'post',
        url: 'https://graph.microsoft.com/v1.0/me/events',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        data: payload
      };

      const response = await axios.request(config);
      return response.data;
    }, teamsUser);


    return res.status(200).json({
      success: true,
      message: "Meeting created successfully",
      data: meetingResponse
    });

  }
  catch (error) {
    res.json({
      success: false,
      message: error.message,
    });
  }
}


const scheduleTeamsMeetingAgent = async (req, res) => {
  try {
    const { organizerEmail, title, startTime, endTime, timeZone, attendees, contentType, content } = req.body;
    console.log("---scheduleTeamsMeetingAgent log 1 start ---");
    console.log('organizerEmail: ', organizerEmail);
    console.log('title: ', title);
    console.log('startTime: ', startTime);
    console.log('endTime: ', endTime);
    console.log('timeZone: ', timeZone);
    console.log('attendees: ', attendees);
    console.log('contentType: ', contentType);
    console.log('content: ', content);
    console.log("---scheduleTeamsMeetingAgent log 1 end ---");

    const userQuery = await pool.query('SELECT * FROM users WHERE email = $1', [organizerEmail]);
    if (userQuery.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = userQuery.rows[0];
    console.log("---scheduleTeamsMeetingAgent log 2 start ---");
    console.log('user: ', user);
    console.log("---scheduleTeamsMeetingAgent log 2 end ---");

    const user_id = user.id;
    const teamsUser = await TeamsUser.findByUserId(user_id);
    if (!teamsUser) {
      return res.status(404).json({ error: "Teams user not found" });
    }
    console.log("---scheduleTeamsMeetingAgent log 3 start ---");
    console.log('teamsUser: ', teamsUser);
    console.log("---scheduleTeamsMeetingAgent log 3 end ---");

    const meetingResponse = await handleTeamsApiCall(async (accessToken) => {
      // Format attendees properly for Microsoft Graph API
      const formattedAttendees = Array.isArray(attendees)
        ? attendees.map(email => {
          if (typeof email === 'string') {
            return {
              emailAddress: {
                address: email,
                name: email.split('@')[0] // Extract name from email
              },
              type: "required"
            };
          } else if (email && email.emailAddress) {
            // Already formatted
            return email;
          } else {
            // Handle other object formats if needed
            return {
              emailAddress: {
                address: email.email || email.address || email,
                name: email.name || email.displayName || (email.email || email.address || email).split('@')[0]
              },
              type: email.type || "required"
            };
          }
        })
        : [];

      const payload = {
        subject: title,
        start: {
          dateTime: startTime,
          timeZone: timeZone,
        },
        end: {
          dateTime: endTime,
          timeZone: timeZone,
        },
        attendees: formattedAttendees,
        allowNewTimeProposals: true,
        isOnlineMeeting: true,
        onlineMeetingProvider: "teamsForBusiness",
        body: {
          contentType: contentType || "HTML", //"HTML", // or "Text"
          content: content || "" // Replace with your actual description variable
        }
      };
      console.log("---scheduleTeamsMeetingAgent log 4 start ---");
      console.log('payload: ', payload);
      console.log("---scheduleTeamsMeetingAgent log 4 end ---");
      const config = {
        method: 'post',
        url: 'https://graph.microsoft.com/v1.0/me/events',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        data: payload
      };
      console.log("---scheduleTeamsMeetingAgent log 5 start ---");
      console.log('config: ', config);
      console.log("---scheduleTeamsMeetingAgent log 5 end ---");
      const response = await axios.request(config);
      console.log("---scheduleTeamsMeetingAgent log 6 start ---");
      console.log('response: ', response.data);
      console.log("---scheduleTeamsMeetingAgent log 6 end ---");
      return response.data;
    }, teamsUser);
    console.log("---scheduleTeamsMeetingAgent log 7 start ---");
    console.log('meetingResponse: ', meetingResponse);
    console.log("---scheduleTeamsMeetingAgent log 7 end ---");
    return res.status(200).json({
      success: true,
      message: "Meeting created successfully",
      data: meetingResponse
    });
  }
  catch (error) {
    console.log("---scheduleTeamsMeetingAgent log 8 start ---");
    console.log('error: ', error);
    console.log("---scheduleTeamsMeetingAgent log 8 end ---");
    res.json({
      success: false,
      message: error.message,
    });

  }
}

const getUserUpcomingMeetings = async (req, res) => {
  try {
    const user = req.user;
    const user_id = user.id;
    const clientTime = req.body.time; // should be ISO string or timestamp from client

    const now = new Date();
    now.setHours(0, 0, 0, 0); // Set to start of the day
    const later = new Date(now);
    later.setDate(later.getDate() + 14); // Adds 14 days to today
    later.setHours(23, 59, 59, 999);  // End of 14th day

    const { rows: usermeeting } = await pool.query(
      `SELECT 
        m.id, m.title, m.schedule_datetime, m.schedule_duration, m.join_Url
       FROM meetings m
      INNER JOIN meeting_participants mp ON m.id = mp.meeting_id
      WHERE m.isdeleted = false 
      AND mp.user_id = $1 
      AND m.platform = $2 AND m.schedule_datetime BETWEEN $3 AND $4
      GROUP BY m.id, m.title, m.schedule_datetime, m.schedule_duration, m.join_Url`,
      [user_id, 'teams', now, later]
    );

    const serverNow = new Date();
    const clientNow = clientTime ? new Date(clientTime) : serverNow;
    // Calculate the offset in milliseconds (client - server)
    const offsetMs = clientNow.getTime() - serverNow.getTime();

    const offsetMsWithUTC = offsetMs + (0 - serverNow.getTimezoneOffset()) * 60000;

    const teamsMeetings = usermeeting
      .map((meeting) => {
        const utcDateStart = new Date(meeting.schedule_datetime);
        const utcDateEnd = new Date(meeting.schedule_datetime);
        const localDateStart = new Date(utcDateStart.getTime() + offsetMsWithUTC);
        const localDateEnd = new Date(utcDateEnd.getTime() + offsetMsWithUTC + (meeting.schedule_duration * 60 * 1000));
        return {
          id: meeting.id,
          subject: meeting.title,
          start: localDateStart,
          end: localDateEnd,
          joinUrl: meeting.join_Url,
        };
      });
    res.json({
      success: true,
      message: "",
      upcomingMeeting: teamsMeetings
    });

  }
  catch (error) {
    throw error;
  }
}
const enablescheduling = async (req, res) => {
  try {
    const user = req.user;
    const user_id = user.id;

    const teamsUser = await TeamsUser.findByUserId(user_id);
    if (!teamsUser) {
      return res.status(404).json({ error: "Teams user not found" });
    }

    await TeamsUser.enablescheduling(user_id);

    res.json({
      success: true,
      message: "Teams scheduling enabled successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const disablescheduling = async (req, res) => {
  try {
    const user = req.user;
    const user_id = user.id;

    const teamsUser = await TeamsUser.findByUserId(user_id);
    if (!teamsUser) {
      return res.status(404).json({ error: "Teams user not found" });
    }

    await TeamsUser.disablescheduling(user_id); // ✅ Fixed this line

    res.json({
      success: true,
      message: "Teams scheduling disabled successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};
const handleAzureredirect = async (req, res) => {
  const { code, utid } = req.body;
  const userId = req.user?.id;

  if (code && userId && utid) {
    try {
      const tokenEndpoint = `https://login.microsoftonline.com/${utid}/oauth2/v2.0/token`;
      const tokenResponse = await axios.post(
        tokenEndpoint,
        querystring.stringify({
          client_id: process.env.TEAMS_CLIENT_ID,
          client_secret: process.env.TEAMS_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: process.env.REACT_APP_AZURE_REDIRECT_URI,
          scope: "User.Read OnlineMeetings.ReadWrite OnlineMeetingTranscript.Read.All OnlineMeetingArtifact.Read.All Calendars.Read Calendars.ReadWrite offline_access Application.ReadWrite.All Directory.Read.All RoleManagement.Read.Directory Mail.Read Mail.ReadBasic"
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          }
        }
      );
      const { access_token, refresh_token, expires_in, ext_expires_in, scope, token_type } = tokenResponse.data;

      const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });
      const azuser = response.data;

      // These map to your desired values
      const accountId = azuser.id; // Similar to oid
      const accountName = azuser.displayName;
      const accountUsername = azuser.userPrincipalName?.toLowerCase(); // Similar to preferred_username
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Update user's Teams credentials with polling enabled
      await User.updateTeamsCredentials(user.id, {
        access_token: access_token,
        refresh_token: refresh_token,
        is_polling_enabled: true,
        lastMeetingsState: [],
      });
      const teamsUser = await TeamsUser.findByAccountId(accountId);
      if (teamsUser) {
        await TeamsUser.update({
          account_id: accountId,
          name: accountName,
          teams_access_token: access_token,
          teams_refresh_token: refresh_token,
          tenant_id: utid,
          mail: accountUsername,
          user_id: user.id,
        });
      } else {
        await TeamsUser.create({
          account_id: accountId,
          name: accountName,
          teams_access_token: access_token,
          teams_refresh_token: refresh_token,
          tenant_id: utid,
          mail: accountUsername,
          user_id: user.id,
        });
      }
      // Create Teams subscription
      try {
        const client = Client.init({
          authProvider: (done) => {
            done(null, access_token);
          },
        });

        const subscriptionData = {
          changeType: "created,updated,deleted",
          notificationUrl: `${process.env.API_BASE_URL}/api/teams/webhook`,
          resource: "/me/events",
          expirationDateTime: new Date(
            Date.now() + 5 * 24 * 60 * 60 * 1000
          ).toISOString(), // 1 day expiration
          clientState: uuidv4(), // Using UUID for unique client state
        };
        console.log("Subscription data:", subscriptionData);

        const subscription = await client
          .api("/subscriptions")
          .post(subscriptionData);
        console.log("Subscription created successfully:", subscription);
        if (subscription.id) {
          await Subscription.create({
            subscription_id: subscription.id,
            user_id: user.id,
            type: "schedule",
          });

          // You might want to store the subscription details in your database
          await User.updateTeamsSubscription(user.id, subscription);
        }
        try {
          //create outlook subscription
          if (user.company_role) {
            subscriptionForEmail(user.id);
          }
          console.log("Email subscription created for user:", user.id)
        } catch (emailSubError) {
          console.error("Error creating email subscription:", emailSubError);
        }
      } catch (subError) {
        console.error("Error creating subscription:", subError);
        // Continue with the response even if subscription fails
      }
      try {
        // Fetch and set upcoming meetings for the user 14 days from now
        getAnndSetUpcomingTwoWeeksMeetings(userId);
      }
      catch (error) {
        console.error("Error fetching upcoming meetings:", error);
      }
      return res.json({
        success: true,
        message: "Teams account connected successfully"
      });

    } catch (error) {
      console.error("Error exchanging code for token:", error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        message: "Teams account not connected successfully"
      });
    }


  } else {
    return res.status(400).json({
      success: false,
      message: "Missing required parameters"
    });
  }
};

const getFreeSlotTimeGetherdCalendar = async (req, res) => {
  try {
    const user = req.user;
    const user_id = user.id;
    const clientTime = req.body.time; // should be ISO string or timestamp from client
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const now = new Date(startDate);
    now.setHours(0, 0, 0, 0); // Set to start of the day
    const later = new Date(endDate);
    later.setHours(23, 59, 59, 999);  // Set end of the day

    const { rows: usermeeting } = await pool.query(
      `SELECT 
        m.id, m.title, m.schedule_datetime, m.schedule_duration, m.join_Url
       FROM meetings m
      INNER JOIN meeting_participants mp ON m.id = mp.meeting_id
      WHERE m.isdeleted = false 
      AND mp.user_id = $1 
      AND m.platform = $2 AND m.schedule_datetime BETWEEN $3 AND $4
      GROUP BY m.id, m.title, m.schedule_datetime, m.schedule_duration, m.join_Url`,
      [user_id, 'teams', now, later]
    );

    const serverNow = new Date();
    const clientNow = clientTime ? new Date(clientTime) : serverNow;
    // Calculate the offset in milliseconds (client - server)
    const offsetMs = clientNow.getTime() - serverNow.getTime();

    const offsetMsWithUTC = offsetMs + (0 - serverNow.getTimezoneOffset()) * 60000;

    const teamsMeetings = usermeeting
      .map((meeting) => {
        const utcDateStart = new Date(meeting.schedule_datetime);
        const utcDateEnd = new Date(meeting.schedule_datetime);
        const localDateStart = new Date(utcDateStart.getTime() + offsetMsWithUTC);
        const localDateEnd = new Date(utcDateEnd.getTime() + offsetMsWithUTC + (meeting.schedule_duration * 60 * 1000));
        return {
          id: meeting.id,
          subject: meeting.title,
          start: localDateStart,
          end: localDateEnd,
          joinUrl: meeting.join_Url,
        };
      });
    const intervalMinutes = 30;
    const MS_PER_MINUTE = 60 * 1000;
    const freeSlotsPerDay = {};

    for (
      let slotStart = now;
      slotStart <= later;
      slotStart = new Date(slotStart.getTime() + intervalMinutes * MS_PER_MINUTE)
    ) {
      const slotEnd = new Date(slotStart.getTime() + intervalMinutes * MS_PER_MINUTE);

      const overlaps = teamsMeetings.some((meeting) => {
        const meetingStart = new Date(meeting.start);
        const meetingEnd = new Date(meeting.end);

        return slotStart < meetingEnd && slotEnd > meetingStart;
      });

      if (!overlaps) {
        const year = slotStart.getFullYear();
        const month = String(slotStart.getMonth() + 1).padStart(2, '0'); // Month is 0-based
        const day = String(slotStart.getDate()).padStart(2, '0');
        const hours = String(slotStart.getHours()).padStart(2, '0');
        const minutes = String(slotStart.getMinutes()).padStart(2, '0');

        const dayKey = `${year}-${month}-${day}`; // "YYYY-MM-DD"
        const timeStr = `${hours}:${minutes}`; // "HH:mm"

        if (!freeSlotsPerDay[dayKey]) {
          freeSlotsPerDay[dayKey] = [];
        }
        freeSlotsPerDay[dayKey].push(timeStr);
      }
    }
    res.json({
      success: true,
      message: "",
      freeSlotsPerDay: freeSlotsPerDay
    });

  }
  catch (error) {
    res.status(500).json({
      success: false,
      message: error?.message || "Unexpected error occurred",
      freeSlotsPerDay: []
    });
  }
}

const getAnndSetUpcomingTwoWeeksMeetings = async (user_id) => {
  try {

    const teamsUser = await TeamsUser.findByUserId(user_id);
    if (!teamsUser) {
      return null;
    }
    // Filter meetings to get only those within the next two weeks
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 14);
    const events = await handleTeamsApiCall(async (accessToken) => {
      const response = await axios.get(
        `${process.env.GRAPH_API_URL}/me/calendar/calendarView?endDateTime=${endDate.toISOString()}&startDateTime=${startDate.toISOString()}&top=100&skip=0&`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data.value;
    }, teamsUser);
    if (!events) {
      return null;
    }

    for (const eventDetails of events) {
      try {
        const eventId = eventDetails.seriesMasterId ?? eventDetails.id;
        const orgUserEmail = eventDetails.organizer?.emailAddress?.address.toLowerCase();
        const joinUrl = eventDetails.onlineMeeting?.joinUrl;
        const meetingDetails = await getMeetingDetails("me", "JoinWebUrl", joinUrl, teamsUser.account_id);
        const meeting = meetingDetails?.value[0];
        const isRecurring = eventDetails.type === "occurrence";
        const startDateTime = new Date(eventDetails.start.dateTime);
        const endDateTime = new Date(eventDetails.end.dateTime);
        const durationMinutes = Math.round((endDateTime - startDateTime) / (1000 * 60));
        if (eventDetails.subject == "Test auto import recuring profile") {
          console.log("Skipping Test auto import recuring profile event");
        }
        if (isRecurring) {
          const re_now = new Date();
          const re_fourteenDaysLater = new Date();
          re_fourteenDaysLater.setDate(re_now.getDate() + 14);
          const instances = await getRecurringInstances(
            teamsUser.account_id,
            eventId,
            re_now.toISOString(),
            re_fourteenDaysLater.toISOString()
          );
          const recuringMeeting = instances.value;
          const idToCheck = meeting?.id ?? null;
          const existingMeetings = idToCheck
            ? await pool.query(`SELECT * FROM meetings WHERE isdeleted != true AND meeting_id = $1`, [idToCheck])
            : await pool.query(`SELECT * FROM meetings WHERE isdeleted != true AND teams_id = $1`, [eventId]);
          if (!existingMeetings.rows.length) {
            for (const instance of recuringMeeting) {
              const instanceStart = new Date(instance.start.dateTime);
              const instanceEnd = new Date(instance.end.dateTime);
              const duration = Math.round((instanceEnd - instanceStart) / (1000 * 60));
              const newMeeting = await Meeting.create({
                meeting_id: meeting?.id,
                title: eventDetails.subject,
                description: eventDetails.body?.content || null,
                summary: "",
                datetime: instanceStart,
                duration: duration,
                joinUrl: joinUrl,
                teams_id: eventId,
                status: eventDetails.isCancelled ? "cancelled" : "scheduled",
                org_id:
                  eventDetails.organizer?.emailAddress?.address?.toLowerCase() ===
                    teamsUser.mail?.toLowerCase()
                    ? teamsUser.user_id
                    : null,
                platform: "teams",
                transcription_link: "",
                record_link: null,
                report_id: null,
                schedule_datetime: instanceStart,
                schedule_duration: duration,
                event_id: instance.id,
                occurrence_Id: instance.occurrenceId
              });

              if (newMeeting.org_id == null) {
                await addParticipantTomeeting(
                  { upn: orgUserEmail },
                  newMeeting.id
                );
              } else {
                await MeetingParticipant.create({
                  meetingId: newMeeting.id,
                  userId: teamsUser.user_id,
                  role: "organizer",
                });
              }
              await addMeetingAttendees(
                meeting?.id,
                eventDetails.attendees.map((attendee) => ({
                  upn: attendee.emailAddress.address,
                })),
                teamsUser,
                newMeeting.id,
                null
              );
              score_agenda(newMeeting.id);
            }
          }
        }
        else {
          const teams_uid = eventDetails.uid;
          let existingMeetings;
          if (meeting) {
            const result = await pool.query(
              `SELECT * FROM meetings WHERE meeting_id = $1 AND isdeleted != true`,
              [meeting.id]
            );
            existingMeetings = result.rows;
          } else {
            const result = await pool.query(
              `SELECT * FROM meetings WHERE event_id = $1 AND isdeleted != true`,
              [teams_uid]
            );
            existingMeetings = result.rows;
          }
          if (!existingMeetings.length) {
            const newMeeting = await Meeting.create({
              meeting_id: meeting?.id,
              title: eventDetails.subject,
              description: eventDetails.body?.content || null,
              summary: "",
              datetime: startDateTime,
              duration: durationMinutes,
              joinUrl: meeting?.joinWebUrl,
              teams_id: eventId,
              status: eventDetails.isCancelled ? "cancelled" : "scheduled",
              org_id:
                eventDetails.organizer?.emailAddress?.address?.toLowerCase() ===
                  teamsUser.mail?.toLowerCase()
                  ? teamsUser.user_id
                  : null,
              platform: "teams",
              transcription_link: "",
              record_link: null,
              report_id: null,
              schedule_datetime: startDateTime,
              schedule_duration: durationMinutes,
              event_id: teams_uid,
            });

            if (newMeeting.org_id == null) {
              await addParticipantTomeeting(
                { upn: orgUserEmail },
                newMeeting.id
              );
            } else {
              await MeetingParticipant.create({
                meetingId: newMeeting.id,
                userId: teamsUser.user_id,
                role: "organizer",
              });
            }
            await addMeetingAttendees(
              meeting?.id,
              eventDetails.attendees.map((attendee) => ({
                upn: attendee.emailAddress.address,
              })),
              teamsUser,
              newMeeting.id,
              null
            );
            score_agenda(newMeeting.id);
          }
        }

      }
      catch (error) {
        console.error("Error processing event:", error);
      }
    }
  }
  catch (error) {
    console.error("Error in getAnndSetUpcomingTwoWeeksMeetings:", error);
  }
}

const handleEmailWebhook = async (req, res) => {
  try {
    // Validation handshake
    if (req.query.validationToken) {
      return res.status(200).send(req.query.validationToken);
    }

    const notifications = req.body.value;

    for (const notification of notifications) {
      try {
        const messageId = notification.resourceData?.id;
        const account_id = notification.resource.split("/")[1];

        if (!messageId) {
          console.warn("No message ID found in notification:", notification);
          continue;
        }
        const teamsUser = await TeamsUser.findByAccountId(account_id);
        if (!teamsUser || teamsUser.is_outlook_connected != true) {
          console.warn("User not connected outlook");
          continue
        }

        const subscription = await Subscription.findById(notification.subscriptionId);
        if (!subscription || !subscription.user_id) continue;

        // Fetch message details with internetMessageId
        const graphUrl = `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=subject,from,toRecipients,ccRecipients,internetMessageId,receivedDateTime,body,isDraft,sentDateTime,parentFolderId`;

        const response = await axios.get(graphUrl, {
          headers: {
            Authorization: `Bearer ${teamsUser.teams_access_token}`,
          },
        });

        const message = response.data;

        const internetMessageId = message.internetMessageId;
        console.log("internetMessageId", internetMessageId)
        if (message.isDraft) {
          console.log("📝 This message is a draft.");
          continue
        }
        else if (message.sentDateTime) {
          console.log("📤 This message has been sent.");
        }
        const subject = message.subject || null;
        const sender = message.from?.emailAddress?.address || null;
        const toRecipients =
          message.toRecipients?.map(r => r.emailAddress?.address) || [];
        const ccRecipients =
          message.ccRecipients?.map(r => r.emailAddress?.address) || [];
        const receivedAt = message.receivedDateTime || null;
        const body = message.body?.content || null;
        // ✅ Save only if internetMessageId exists
        if (internetMessageId) {
          const client = await pool.connect();
          try {
            // Check if email already exists
            const checkQuery = `
            SELECT 1 FROM email_messages WHERE internet_message_id = $1 LIMIT 1;
             `;
            const checkResult = await client.query(checkQuery, [internetMessageId]);

            if (checkResult.rowCount > 0) {

              const checkQuery = `
            update email_messages set 
            subject = $1,
            body = $2
             WHERE internet_message_id = $3 ;
             `;
              await client.query(checkQuery, [subject, body, internetMessageId]);
              console.log("⚠️ Email already exists, skipping save:", internetMessageId);
            } else {
              const insertQuery = `
              INSERT INTO email_messages 
              (internet_message_id, subject, body, sender, to_recipients, cc_recipients, received_at)
              VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
              RETURNING id;
              `;

              const values = [
                internetMessageId,
                subject,
                body,
                sender,
                JSON.stringify(toRecipients),
                JSON.stringify(ccRecipients),
                receivedAt,
              ];

              const result = await client.query(insertQuery, values);
              const emailId = result.rows[0].id;

              // Create contacts for sender and recipients if not exist
              createContact(message.from?.emailAddress, message.toRecipients, message.ccRecipients, teamsUser.user_id);

              // ✅ Call email intelligence with the new email ID
              email_intelligence_graph(emailId, teamsUser.user_id, teamsUser.user_id);
              console.log("✅ New email saved:", { internetMessageId, subject });
            }
          } finally {
            client.release();
          }
        } else {
          console.warn("⚠️ No internetMessageId found, skipping save:", {
            messageId,
            subject,
          });
        }
      } catch (eventError) {
        console.error("❌ Error processing single email:", eventError);
      }
    }
    // ✅ Response after processing all notifications
    res.status(202).send("Email notifications processed");
  } catch (error) {
    console.error("❌ Email webhook handler error:", error);
    res.status(500).send("Internal server error");
  }
};


async function subscriptionForEmail(user_id) {
  try {
    // Initialize Microsoft Graph client
    const teamsUser = await TeamsUser.findByUserId(user_id);
    if (!teamsUser || teamsUser.is_outlook_connected != true) {
      throw new Error("User not connected outlook");
    }

    const client = Client.init({
      authProvider: (done) => done(null, teamsUser.teams_access_token),
    });
    // const subscriptions = await client.api("/subscriptions").get();
    // for (const sub of subscriptions.value) {
    //   if (sub.resource && sub.resource.includes("messages")) {
    //     await client.api(`/subscriptions/${sub.id}`).delete();
    //   }
    // }
    const resources = [
      "/me/messages",     // For received emails
      "/me/mailFolders('sentitems')/messages"  // For sent emails
    ];
    // Prepare subscription data
    let lastSubscription = null;

    // Create subscription for each folder
    for (const resource of resources) {
      const subscriptionData = {
        changeType: "created",
        notificationUrl: `${process.env.API_BASE_URL}/api/teams/handleEmailWebhook`,
        resource: resource,
        expirationDateTime: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 72 hours
        clientState: uuidv4(),
      };
      console.log("Subscription data:", subscriptionData);

      // Create subscription via Graph API
      const subscription = await client.api("/subscriptions").post(subscriptionData);

      if (!subscription.id) {
        console.log("Failed to create email subscription");
        continue;
      }
      if (subscription.id) {
        await Subscription.create({
          subscription_id: subscription.id,
          user_id: user_id,
          type: "schedule/outlook",
        });
      }
      lastSubscription = subscription;
    }
    return lastSubscription;
  } catch (error) {
    console.error("Error creating email subscription:", error.response?.data || error.message);
    throw error;
  }
}
async function createContact(emailAddress, toRecipients, ccRecipients, user_id) {
  if (!emailAddress || !user_id) {
    console.log("❌ Missing Email or User ID");
    return;
  }

  try {
    const client = await pool.connect();
    try {
      // 1️⃣ Get company/tenant ID
      const companyIdResult = await client.query(`
        SELECT r.company_id 
        FROM users u 
        JOIN company_roles r ON u.company_role = r.id
        WHERE u.id = $1
      `, [user_id]);

      const companyId = companyIdResult.rows[0]?.company_id;
      if (!companyId) {
        console.log("❌ No company ID found for user");
        return;
      }

      // 2️⃣ Collect all unique users
      const allUsers = {};

      // Helper to add recipients with lowercase emails
      const addRecipients = (recipients) => {
        if (Array.isArray(recipients)) {
          recipients.forEach(r => {
            const email = r?.emailAddress?.address?.trim().toLowerCase();
            const name = r?.emailAddress?.name || null;
            if (email && !allUsers[email]) {
              allUsers[email] = { name, email };
            }
          });
        }
      };

      // Add sender
      const senderEmail = emailAddress.address.trim().toLowerCase();
      allUsers[senderEmail] = { name: emailAddress.name || null, email: senderEmail };

      addRecipients(toRecipients);
      addRecipients(ccRecipients);

      // 3️⃣ Check which contacts already exist
      const emails = Object.keys(allUsers);
      if (emails.length === 0) return;

      const placeholders = emails.map((_, i) => `$${i + 1}`).join(', ');
      const existingResult = await client.query(
        `SELECT LOWER(email) AS email FROM contacts WHERE LOWER(email) IN (${placeholders}) AND tenant_id = $${emails.length + 1}`,
        [...emails, companyId]
      );

      const existingEmails = new Set(existingResult.rows.map(r => r.email));

      // 4️⃣ Prepare new contacts
      const newContacts = [];
      for (const user of Object.values(allUsers)) {
        if (!existingEmails.has(user.email)) {
          const [firstName, ...rest] = user.name?.split(' ') || [];
          const lastName = rest.join(' ') || null;
          newContacts.push({ firstName, lastName, email: user.email });
        }
      }

      // 5️⃣ Batch insert new contacts
      if (newContacts.length > 0) {
        const insertValues = [];
        const insertPlaceholders = [];
        newContacts.forEach((c, i) => {
          const idx = i * 5; // 5 dynamic values per row
          insertPlaceholders.push(`($${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, NOW(), $${idx + 5})`);
          insertValues.push(c.firstName, c.lastName, c.email, companyId, user_id);
        });

        await client.query(
          `INSERT INTO contacts (first_name, last_name, email, tenant_id, created_at, created_by) VALUES ${insertPlaceholders.join(', ')}`,
          insertValues
        );

        console.log(`✅ Inserted ${newContacts.length} new contacts`);
      } else {
        console.log("ℹ️ No new contacts to insert");
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("❌ Error in createContact:", err);
  }
}



module.exports = {
  login,
  handleAzureCallback,
  handleTeamsCallback,
  handleTeamsWebhook,
  disconnectTeams,
  activateTeams,
  getTeamsCalendar,
  getEventDetails,
  createMeeting,
  retrieveMeetingsInfo,
  setRetrievedMeetings,
  handleTranscriptionWebhook,
  checkIfUserIsAdmin,
  getTeamsCalendarSchedule,
  updatemeetingdbapi,
  scheduleTeamsMeeting,
  getUserUpcomingMeetings,
  enablescheduling,
  disablescheduling,
  handleAzureredirect,
  scheduleTeamsMeetingAgent,
  getFreeSlotTimeGetherdCalendar,
  handleTeamsApiCall,
  handleEmailWebhook
};
