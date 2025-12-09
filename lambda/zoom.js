const axios = require("axios");
// const { file } = require("googleapis/build/src/apis/file");
const { Pool } = require("pg");
// require("dotenv").config();

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
      await pool.query(
        `UPDATE zoom_users SET zoom_access_token = $1, zoom_refresh_token = $2 WHERE account_id = $3`,
        [tokens.access_token, tokens.refresh_token, zoomUser.account_id]
      );

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
    // console.error("Error fetching Zoom participants:", error);
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

// const handler1 = async () => {
exports.handler = async (event) => {
  try {
    console.log("start", process.env.DB_USER);

    const query = {
      text: `SELECT * FROM zoom_users WHERE is_connected = true`,
    };
    const result = await pool.query(query);
    const data = result.rows;
    console.log("test list", data.length);

    if (data.length > 0) {
      const result_promiseall = await Promise.all(
        data.map(async (zoomuser) => {
          console.log(zoomuser.user_id, zoomuser.name);

          const utcStart = new Date();

          // Fetch scheduled meetings for this user
          const meeting_query = {
            text: `SELECT * FROM meetings WHERE meeting_id IS NULL AND platform = 'zoom' AND isdeleted = false AND org_id = $1 AND schedule_datetime + schedule_duration * INTERVAL '1 minute' > $2`,
          };
          const { rows: current_schedule } = await pool.query(meeting_query, [
            zoomuser.user_id,
            utcStart,
          ]);
          console.log("current_schedule", current_schedule);

          // Define your API call function
          const makeApiCall = async (accessToken) => {
            const today = new Date();

            const dayBeforeYesterday = new Date(today);
            dayBeforeYesterday.setDate(today.getDate() - 2);

            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);

            const formatDate = (date) => {
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, "0");
              const day = String(date.getDate()).padStart(2, "0");
              return `${year}-${month}-${day}`;
            };

            const startDate = formatDate(dayBeforeYesterday);
            const endDate = formatDate(tomorrow);
            const url = `${process.env.ZOOM_API_BASE_URL}/users/${zoomuser?.account_id}/meetings`;

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

          const response = await handleZoomApiCall(makeApiCall, zoomuser);
          console.log("meeting list", JSON.stringify(response));

          const ids = response.meetings.map((t) => t.id.toString());
          const upcoming_ids = new Set(ids);
          console.log(
            "upcoming_ids",
            upcoming_ids,
            upcoming_ids.has(81610407088)
          );
          current_schedule.map(async (meeting) => {
            if (upcoming_ids.has(meeting.teams_id))
              console.log("upcoming_meeting", meeting.teams_id, meeting.id);
            else {
              console.log(
                "meeting.teams_id",
                upcoming_ids.has(meeting.teams_id),
                meeting.teams_id
              );
              const { rows: update_meeting } = await pool.query(
                `UPDATE meetings SET isdeleted = true WHERE teams_id = $1`,
                [meeting.teams_id]
              );
              console.log(
                "Delete-upcoming_meeting",
                update_meeting,
                meeting.teams_id,
                meeting.id
              );
            }
          });

          // Process each meeting
          await Promise.all(
            response.meetings.map(async (meeting) => {
              // Check if meeting exists
              const exisitng_meeting_query = {
                text: `SELECT * FROM meetings WHERE org_id = $2 AND teams_id = $1`,
              };
              const { rows: existing_zoom } = await pool.query(
                exisitng_meeting_query,
                [meeting.id, zoomuser.user_id]
              );

              if (existing_zoom.length === 0) {
                // Insert new meeting
                const { rows: new_meeting } = await pool.query(
                  "INSERT INTO meetings (title, org_id, duration, datetime, status, platform, teams_id, join_url, schedule_duration, schedule_datetime) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *",
                  [
                    meeting.topic,
                    zoomuser.user_id,
                    meeting.duration,
                    meeting.start_time,
                    meeting.type,
                    "zoom",
                    meeting.id,
                    meeting.join_url,
                    meeting.duration,
                    meeting.start_time,
                  ]
                );
                console.log("New meeting inserted:", new_meeting[0]);

                // Create participant record if not exists
                const existingParticipant = await pool.query(
                  "SELECT * FROM meeting_participants WHERE meeting_id = $1 AND user_id = $2",
                  [new_meeting[0].id, zoomuser.user_id]
                );

                if (existingParticipant.rows.length === 0) {
                  await pool.query(
                    "INSERT INTO meeting_participants (meeting_id, user_id, role) VALUES ($1, $2, $3)",
                    [new_meeting[0].id, zoomuser.user_id, "organizer"]
                  );
                }
              } else if (!existing_zoom[0]?.meeting_id) {
                // Update existing meeting
                await pool.query(
                  "UPDATE meetings SET title=$1, duration=$2, datetime=$3, status=$4, platform=$5, teams_id=$6, join_url=$7, schedule_duration=$8, schedule_datetime=$9 WHERE id = $10",
                  [
                    meeting.topic,
                    meeting.duration,
                    meeting.start_time,
                    meeting.type,
                    "zoom",
                    meeting.id,
                    meeting.join_url,
                    meeting.duration,
                    meeting.start_time,
                    existing_zoom[0].id,
                  ]
                );
              }

              // Fetch participants
              let participants = [];
              try {
                participants = await getZoomParticipants(meeting.id, zoomuser);
              } catch (error) {
                console.error("Error fetching participants:", error);
              }
              console.log(
                "participants",
                participants,
                zoomuser.mail,
                meeting.topic
              );

              if (participants.length > 0) {
                try {
                  const attendees = participants
                    .filter((item) => item.user_email)
                    .filter((item) => item.user_email !== zoomuser.mail)
                    .map((participant) => ({
                      emailAddress: {
                        address: participant.user_email,
                        name:
                          participant.name ||
                          participant.user_email.split("@")[0],
                      },
                    }));

                  await axios.post(
                    "https://app.getherd.ai/api/zoom/addAttendees",
                    {
                      attendees,
                      meeting_id: meeting.id,
                    }
                  );
                } catch (error) {
                  console.error("Error processing attendees:", error);
                }
              }
            })
          );

          return {
            status: true,
            message: "refresh and import successfully",
            user_id: zoomuser.user_id,
          };
        }) // end of map
      ); // end of Promise.all

      console.log("result_promiseall", result_promiseall);
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

// handler1();
