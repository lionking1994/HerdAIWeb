const axios = require("axios");
const { Pool } = require("pg");

// Load environment variables from .env file (for local development)
// In Lambda, environment variables are set via AWS Lambda configuration
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false, // Required for AWS RDS
  },
  connectionTimeoutMillis: 8000,
  idleTimeoutMillis: 40000,
  max: 30,
});

const refreshTeamsToken = async (user) => {
  try {
    if (!user || !user.teams_refresh_token) {
      throw new Error("User not found or refresh token not found");
    }
    const refreshToken = user.teams_refresh_token;
    let result;
    console.log("start refresh teams", user.user_id);
    try {
		//old code 
      // const tokenResponse = await axios.post(
        // `https://login.microsoftonline.com/${user.tenant_id}/oauth2/v2.0/token`,
        // {
          // grant_type: "refresh_token",
          // refresh_token: refreshToken,
        // },
        // {
          // headers: {
            // "Content-Type": "application/x-www-form-urlencoded",
            // Origin: "https://app.getherd.ai",
          // },
        // }
      // );
	  
	  // new code 
	  const tokenResponse = await axios.post(
        `https://login.microsoftonline.com/${user.tenant_id}/oauth2/v2.0/token`,
        {
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          scope: "https://graph.microsoft.com/.default",
          client_secret: process.env.TEAMS_CLIENT_SECRET,
          client_id: process.env.TEAMS_CLIENT_ID || "df22dff9-0e0f-4528-9b3e-c40130117d9a",
        },
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      console.log("Token Response:", tokenResponse.status);
      if (tokenResponse.status !== 200) {
        throw new Error("Failed to refresh token");
      }
      await update({
        account_id: user.account_id,
        name: user.name,
        mail: user.mail,
        user_id: user.user_id,
        teams_access_token: tokenResponse.data.access_token,
        teams_refresh_token: tokenResponse.data.refresh_token || null,
      });
      console.log(
        "updated",
        user.user_id,
        "expired",
        tokenResponse.data.expires_in
      );
      result = {
        status: true,
        message: `updated : ${user.user_id}`,
        user_id: user.user_id,
      };
    } catch (error) {
      // console.log("refresh failed", user.user_id);
      console.log("refresh - error :", error?.response.status, error?.response?.data?.error_description)
      // await pool.query(
      //   `UPDATE teams_users SET is_connected = false WHERE user_id = $1`,
      //   [user.user_id]
      // );
      // console.log("disconnected teams", user.user_id);
      // await pool.query(`UPDATE users SET use_teams = false WHERE id = $1`, [
      //   user.user_id,
      // ]);
      // console.log("disconnected use_teams", user.user_id);
      result = {
        status: false,
        message: `disconnected use_teams : ${user.user_id}`,
      };
    } finally {
      return result;
    }
  } catch (error) {
    console.error("Silent token acquisition failed:", error?.response || error);
    throw error;
  }
};

const update = async (teamsUserData) => {
  const {
    account_id,
    name,
    mail,
    user_id,
    teams_access_token,
    teams_refresh_token,
  } = teamsUserData;

  console.log("updated", user_id);
  const result = await pool.query(
    `UPDATE teams_users SET name = $1, mail = $2, user_id = $3, teams_access_token = $4, teams_refresh_token = $5, expires_at = $6, updated_at = $7, is_connected = $8 WHERE account_id = $9`,
    [
      name,
      mail.toLowerCase(),
      user_id,
      teams_access_token,
      teams_refresh_token,
      null,
      new Date(),
      true,
      account_id,
    ]
  );

  return result.rows[0];
};

const importupcomingmeetings = async (teamuser) => {
  try {
    console.log("importupcomingmeetings", teamuser.user_id);
    const after30Mins = new Date();
    after30Mins.setMinutes(after30Mins.getMinutes() + 60);
    const now = new Date();
    // now.setMinutes(now.getMinutes() - 1040);
    now.setDate(now.getDate() - 2);
    const startDate = now.toISOString();
    const endDate = after30Mins.toISOString();
    console.log(
      `${teamuser.user_id}----https://graph.microsoft.com/v1.0/me/calendar/calendarView?endDateTime=${endDate}&startDateTime=${startDate}&top=100&skip=0`
    );

    const {
      data: { value: response },
    } = await axios.get(
      `https://graph.microsoft.com/v1.0/me/calendar/calendarView?endDateTime=${endDate}&startDateTime=${startDate}&top=100&skip=0`,
      {
        headers: {
          Authorization: `Bearer ${teamuser.teams_access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.length > 0) {
      console.log("events", response.length, "user_id", teamuser.user_id);
      const valid_meetings = await Promise.all(
        response.map(async (meeting) => {

          console.log("meeting", meeting.onlineMeeting.joinUrl);
          const result = await axios.post("https://app.getherd.ai/api/teams/updatemeetingdb", {
            JoinUrl: meeting.onlineMeeting.joinUrl,
            user_id: teamuser.account_id,
            teamsUser: teamuser,
            eventDetails: meeting,
            eventId: meeting.id,
            type: "scheduled"
          }, {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.HERD_API_KEY
            },
            timeout: 60000,
            validateStatus: function (status) {
              return status >= 200 && status < 500;
            }
          });


          return { status: true, message: "meeting already exists" };
        })
      );
      return {
        status: true,
        message: `Upcoming meetings imported successfully : ${JSON.stringify(
          valid_meetings
        )}`,
      };
    }
    return { status: false, message: "No upcoming meetings found" };
  } catch (error) {
    if (error?.status === 401) {
      return {status: 401, message: "Unauthorized"};
    }
      console.error(
        "Import Upcoming meeting failed:",
        JSON.stringify(error),
        "user_id",
        teamuser.user_id
      );
      return { status: false, message: "Import upcoming meeting error" };
    
  }
};

const handleTeamsApiCall = async (apiCall, teamsUser) => {
  try {
    const api_result = await apiCall(teamsUser);
    if(api_result.status === 401)
    throw {status: 401, message: "Unauthorized"};
    return api_result;
  } catch (error) {
    if (error?.status === 401) {
      console.log("handleTeamsApiCall status", error?.status, "user_id", teamsUser.user_id);
      // Token expired, refresh it
      const result = await refreshTeamsToken(teamsUser);
      if (result.status === true) {
        console.log("refresh the result", result.message, "user_id", teamsUser.user_id);
        const refresh_teamsuser = await pool.query(
          `SELECT * FROM teams_users WHERE user_id = $1 AND is_connected = true`,
          [result.user_id]
        );
        
        console.log("refresh the result", refresh_teamsuser.rows?.length);
        // Retry the request with new token
        return await apiCall(refresh_teamsuser.rows[0]);
      }
    }

    throw error;
  }
};

exports.handler = async (event) => {
  try {
    console.log("start", process.env.DB_USER);

    const query = {
      text: `SELECT * FROM teams_users WHERE is_connected = true`,
    };

    const result = await pool.query(query);
    const data = result.rows;
    if (data.length > 0) {
      const result_promiseall = await Promise.all(
        data.map(async (teamuser) => {
          console.log(teamuser.user_id, teamuser.name);
          const result_import = await handleTeamsApiCall(async (team_user) => {
            const result_api = await importupcomingmeetings(team_user);
            return result_api;
          }, teamuser);
          console.log(
            "import the result status",
            result_import.status,
            "user_id",
            teamuser.user_id
          );
          console.log(
            "import the result",
            result_import.message,
            "user_id",
            teamuser.user_id
          );
          return { status: true, message: "refresh and import successfully" };
        })
      );
      console.log(result_promiseall);
    } else {
      console.log("No new data to send.");
    }

    return {
      statusCode: 200,
      body: JSON.stringify("Function executed successfully."),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify(`Error: ${error.message}`),
    };
  }
};
