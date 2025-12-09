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

const refreshGmeetToken = async (gmeetuser) => {
  try {
    const response = await axios.post(process.env.GMEET_OAUTH_ENDPOINT, {
      client_id: process.env.GMEET_CLIENT_ID,
      client_secret: process.env.GMEET_CLIENT_SECRET,
      refresh_token: gmeetuser?.gmeet_refresh_token,
      grant_type: "refresh_token",
    });

    const { access_token, expires_in, scope, token_type } = response.data;

    console.log("New Access Token:", access_token, gmeetuser.user_id);
    // console.log("Expires in (seconds):", expires_in);
    // console.log("Scopes:", scope);
    // console.log("Token Type:", token_type);

    return { ...gmeetuser, gmeet_access_token: access_token };
  } catch (error) {
    console.error(
      "Error refreshing access token:",
      gmeetuser.user_id
      // error.response?.data || error.message, gmeetuser.user_id
    );
    return false;
  }
};

const handleGmeetApiCall = async (apiCall, gmeetuser) => {
  try {
    return await apiCall(gmeetuser);
  } catch (error) {
    if (error.response?.status === 401) {
      console.log("handleTeamsApiCall status", gmeetuser.user_id);
      // Token expired, refresh it
      const result = await refreshGmeetToken(gmeetuser);
      console.log("handle-refresh-token", result);
      // Retry the request with new token
      if (result != false) return await apiCall(result);
    }
    return false;
  }
};

const IsGmeetRecordingAvailable = async (
  meetingId,
  meetingTopic,
  record,
  fileIds,
  gmeetuser
) => {
  try {
    const makeApiCall = async (gmeetuser) => {
      // console.log("meetingId", meetingId);
      // console.log("meetingTopic", meetingTopic);
      // console.log("record", JSON.stringify(record));
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
      console.log(formattedTime, gmeetuser.user_id);
      // Create a search query that looks for files containing either the meeting ID or topic
      // const searchQuery = meetingTopic
      //   ? `name contains '${formattedTime}'`
      //   : `name contains '${meetingId}'`;

      const searchQuery = `name contains '${formattedTime}' or name contains '${meetingId}'`;
      const transcriptResponse = await axios.get(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          searchQuery
        )}&fields=files(id,name,mimeType,createdTime)&orderBy=createdTime desc`,
        {
          headers: {
            Authorization: `Bearer ${gmeetuser.gmeet_access_token}`,
          },
        }
      );
      console.log(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          searchQuery
        )}&fields=files(id,name,createdTime)&orderBy=createdTime desc`,
        gmeetuser.user_id
      );
      if (transcriptResponse?.data?.files?.length > 0) {
        // const gmeetTranscription = transcriptResponse.data.files.find((file) =>
        //   file.mimeType
        //     .toLowerCase()
        //     .includes("application/vnd.google-apps.document")
        // );
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 2); // day before yesterday
        yesterday.setHours(0, 0, 0, 0); // start of that day

        const gmeetTranscriptions = transcriptResponse.data.files
          .filter(
            (file) =>
              file.mimeType &&
              file.mimeType
                .toLowerCase()
                .includes("application/vnd.google-apps.document")
            // && file.createdTime // ensure createdTime exists
            // && new Date(file.createdTime) > yesterday
          )
          .filter((file) => {
            if (!fileIds.has(file.id) && file.name.includes(formattedTime))
              return true;
            else return false;
          });
        console.log(
          "files-id",
          gmeetTranscriptions,
          formattedTime,
          gmeetuser.user_id
        );
        console.log(
          "gmeetTranscription",
          gmeetTranscriptions,
          gmeetuser.user_id
        );
        if (gmeetTranscriptions.length) {
          return { hasRecording: true, fileId: gmeetTranscriptions };
        } else {
          return { hasRecording: false, fileId: null };
        }
      }
      return { hasRecording: false, fileId: null };
    };

    const result = await handleGmeetApiCall(makeApiCall, gmeetuser);
    if (result == false) return { hasRecording: false, fileId: null };
    return result;
  } catch (error) {
    console.error(
      "Error fetching Gmeet recording:",
      error.status,
      gmeetuser.user_id
    );
    return { hasRecording: false, fileId: null };
  }
};

const IsReportAvailable = async (
  meetingId,
  meeting_date,
  recurringEventId,
  reportIds,
  gmeetuser
) => {
  try {
    const makeApiCall = async (gmeetuser) => {
      console.log("meetingId", meetingId, gmeetuser.user_id);

      const conferenceRecordsResponse = await axios.get(
        `https://meet.googleapis.com/v2/conferenceRecords?filter=space.meeting_code="${meetingId}"`,
        {
          headers: {
            Authorization: `Bearer ${gmeetuser.gmeet_access_token}`,
          },
        }
      );

      if (conferenceRecordsResponse?.data?.conferenceRecords?.length > 0) {
        // Calculate start/end of this week
        // const now = new Date();
        const dayOfMeeting = meeting_date.getDate();

        // const startOfWeek = new Date(now);
        // startOfWeek.setDate(now.getDate() - dayOfWeek);
        // startOfWeek.setHours(0, 0, 0, 0);

        // const endOfWeek = new Date(startOfWeek);
        // endOfWeek.setDate(startOfWeek.getDate() + 6);
        // endOfWeek.setHours(23, 59, 59, 999);

        // Filter records within this week
        console.log(
          "conferenceRecordsResponse",
          conferenceRecordsResponse.data.conferenceRecords,
          meetingId
        );
        const recordsThisWeek = conferenceRecordsResponse.data.conferenceRecords
          .filter((record) => {
            return !reportIds.has(record.name);
          })
          .filter((record) => {
            let recordTime = new Date(record.startTime);
            const recordDate = recordTime.getDate();
            console.log(
              "recordTime",
              recordDate,
              dayOfMeeting,
              recurringEventId
            );
            if (recurringEventId && recordDate != dayOfMeeting) return false; //startOfWeek && recordTime <= endOfWeek;
            return true;
          });

        return recordsThisWeek.length
          ? { status: true, records: recordsThisWeek, msg: "here" }
          : { status: false, records: [], msg: "all of existing in db" };
      }
      return { status: false, records: [], msg: "records no length" };
    };

    const result = await handleGmeetApiCall(makeApiCall, gmeetuser);
    if (result == false) return { status: false, records: [] };
    return result;
  } catch (error) {
    console.error(
      "Error IsReportAvailable fetching Gmeet recording:",
      error.status,
      gmeetuser.user_id
    );
    return { status: false, records: [], msg: "error" };
  }
};

const importupcomingmeetings = async (gmeetuser, current_schedule) => {
  // Calculate last week's date range
  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 2); // Go back 1 days
  const timeMax = new Date(); // Current date
  timeMax.setDate(timeMax.getDate() + 14); // Go front 1 days

  let meetings = await handleGmeetApiCall(async (gmeetuser) => {
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
          Authorization: `Bearer ${gmeetuser.gmeet_access_token}`,
        },
      }
    );
    console.log("meeting list:", response.data?.items, gmeetuser.user_id);
    return response.data?.items || [];
  }, gmeetuser);

  if (meetings == false) meetings = [];
  // Get existing meeting IDs from your database
  const ids = meetings.map((t) => t.id);
  const sequences = meetings.map((t) => t.sequence);
  const upcoming_ids = new Set(ids);
  current_schedule.map(async (meeting) => {
    if (!upcoming_ids.has(meeting.meeting_id)) {
      const { rows: update_meeting } = await pool.query(
        `UPDATE meetings SET isdeleted = true WHERE id = $1 AND platform = 'gmeet'`,
        [meeting.id]
      );
      console.log(
        "Delete-upcoming_meeting",
        update_meeting,
        meeting.meeting_id,
        meeting.id
      );
    }
  });

  const { rows: existingMeetings } = await pool.query(
    `SELECT meeting_id 
     FROM meetings 
     WHERE (meeting_id, sequence) IN (
       SELECT unnest($1::text[]), unnest($2::int[])
     )
     AND summary IS NOT NULL 
     AND summary != ''
     AND platform = 'gmeet'
     AND org_id = $3`,
    [ids, sequences, gmeetuser.user_id]
  );
  console.log("Existing meetings:", existingMeetings, gmeetuser.user_id);
  const { rows: fileIdsArray } = await pool.query(
    `SELECT record_link FROM meetings m WHERE record_link IS NOT NULL AND platform = 'gmeet'`
  );
  const fileIds = new Set(fileIdsArray.map((row) => row.record_link));

  const { rows: reportIdsArray } = await pool.query(
    `SELECT report_id FROM meetings m WHERE summary IS NOT NULL AND summary != '' AND report_id IS NOT NULL AND platform = 'gmeet'`
  );
  const reportIds = new Set(reportIdsArray.map((row) => row.report_id));

  console.log("reportIds", reportIds, gmeetuser.user_id);

  // console.log("fileIds", fileIds);
  // console.log("Existing meetings:", existingMeetings);

  const existingMeetingIds = new Set(existingMeetings.map((m) => m.meeting_id));
  // console.log("existingMeetingIds", existingMeetingIds);

  const meetingsAllIds = new Set(meetings.map((m) => m.id));
  // console.log("meetingsAllIds", meetingsAllIds);

  const transcriptFileids = new Set();
  const filter_meetings = await Promise.all(
    meetings
      .filter(
        (meeting) => meeting.hangoutLink
        // && meeting.organizer.email === gmeetuser.mail
        //   ? true
        //   : false
      )
      // .filter((meeting) => !existingMeetingIds.has(meeting.id))
      .map(async (meeting) => {
        let reportRecords = [];
        const startTime = new Date(meeting.start.dateTime);
        const endTime = new Date(meeting.end.dateTime);
        const durationInMinutes = Math.round(
          (endTime - startTime) / (1000 * 60)
        );

        if (meeting.organizer.email === gmeetuser.mail) {
          const isreportAvailable = await IsReportAvailable(
            meeting.conferenceData?.conferenceId,
            startTime,
            meeting?.recurringEventId || null,
            reportIds,
            gmeetuser
          );

          console.log(
            "isreportAvailable",
            isreportAvailable,
            meeting.conferenceData?.conferenceId,
            gmeetuser.user_id
          );

          if (isreportAvailable.status) {
            // Wait for all the inner async calls to complete
            // if (isreportAvailable.records.length) {
            reportRecords = await Promise.all(
              isreportAvailable.records.map(async (record) => {
                const isRecordingAvailable = await IsGmeetRecordingAvailable(
                  meeting.conferenceData?.conferenceId,
                  meeting.summary,
                  record,
                  fileIds,
                  gmeetuser
                );
                let recordsmeeting = [];
                if (isRecordingAvailable.hasRecording) {
                  recordsmeeting = isRecordingAvailable.fileId.map((file) => {
                    let fileId = null;
                    if (transcriptFileids.has(file.id)) fileId = null;
                    else {
                      fileId = file.id;
                      transcriptFileids.add(fileId);
                    }
                    console.log(
                      "fileId------",
                      transcriptFileids,
                      fileId,
                      file.id
                    );

                    let resport_startTime = new Date(record.startTime);
                    let resport_endTime = new Date(record.endTime);
                    let report_duration = Math.round(
                      (resport_endTime - resport_startTime) / (1000 * 60)
                    );
                    return {
                      event_id: meeting.conferenceData?.conferenceId,
                      id: meeting.id,
                      topic: meeting.summary,
                      description: meeting.description || null,
                      start_time: startTime,
                      duration: durationInMinutes,
                      end_time: meeting.end.dateTime,
                      join_url: meeting.hangoutLink,
                      participants: meeting?.attendees || [],
                      creator: meeting.creator.email,
                      isValid: fileId
                        ? isRecordingAvailable.hasRecording
                        : false,
                      fileId: fileId,
                      isRecordingAvailable: file,
                      reportId: record.name,
                      resport_startTime: resport_startTime,
                      report_duration: report_duration,
                      sequence: meeting.sequence,
                      type: "gmeet",
                    };
                  });
                } else {
                  let resport_startTime = new Date(record.startTime);
                  let resport_endTime = new Date(record.endTime);
                  let report_duration = Math.round(
                    (resport_endTime - resport_startTime) / (1000 * 60)
                  );
                  recordsmeeting = [
                    {
                      event_id: meeting.conferenceData?.conferenceId,
                      id: meeting.id,
                      topic: meeting.summary,
                      description: meeting.description || null,
                      start_time: startTime,
                      duration: durationInMinutes,
                      end_time: meeting.end.dateTime,
                      join_url: meeting.hangoutLink,
                      participants: meeting?.attendees || [],
                      creator: meeting.creator.email,
                      isValid: isRecordingAvailable.hasRecording,
                      fileId: null,
                      isRecordingAvailable,
                      reportId: record.name,
                      resport_startTime: resport_startTime,
                      report_duration: report_duration,
                      sequence: meeting.sequence,
                      type: "gmeet",
                    },
                  ];
                }

                return recordsmeeting;
              })
            );
            // console.log("zxczxc123", JSON.stringify(reportRecords));
            // }
          } else {
            reportRecords = [
              {
                event_id: meeting.conferenceData?.conferenceId,
                id: meeting.id,
                topic: meeting.summary || null,
                description: meeting.description || null,
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
        } else {
          reportRecords = [
            {
              event_id: meeting.conferenceData?.conferenceId,
              id: meeting.id,
              topic: meeting.summary || null,
              description: meeting.description || null,
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
  // console.log("filter_meetings-------------", JSON.stringify(filter_meetings));

  const uniqueMeetings = filter_meetings
    .flat()
    .filter((meeting, index, self) => {
      // Keep meetings with null or undefined reportId
      if (meeting.reportId == null) return true;

      // Otherwise, keep only the first occurrence of each reportId
      return self.findIndex((m) => m.reportId === meeting.reportId) === index;
    }); //

  // Sort meetings by start_time in descending order (newest first)
  return { success: true, meetings: uniqueMeetings.flat() };
};

exports.handler = async (event) => {
// const handler1 = async () => {
  try {
    console.log("start", process.env.DB_USER);

    const query = {
      text: `SELECT * FROM gmeet_users WHERE is_connected = true`,
    };

    const result = await pool.query(query);
    const data = result.rows;
    console.log("test list", data.length);
    if (data.length > 0) {
      const result_promiseall = await Promise.all(
        data
          // .filter((user) => (user.user_id == 66 ? true : false))
          .map(async (gmeetuser) => {
            console.log(gmeetuser.user_id, gmeetuser.name);

            const utcStart = new Date(); // <-- Use current time (hour, min, sec)
            const meeting_query = {
              text: `SELECT * FROM meetings WHERE report_id IS NULL AND platform = 'gmeet' AND isdeleted = false AND org_id = $1 AND schedule_datetime + schedule_duration * INTERVAL '1 minute' > $2`,
            };
            const current_schedule = await pool.query(meeting_query, [
              gmeetuser.user_id,
              utcStart,
            ]);
            console.log("current_schedule", current_schedule.rows, utcStart);

            const result_import = await handleGmeetApiCall(
              async (gmeetuser) => {
                const result_api = await importupcomingmeetings(
                  gmeetuser,
                  current_schedule.rows
                );
                console.log(
                  "api_result",
                  JSON.stringify(result_api),
                  gmeetuser.user_id
                );

                const api = result_api.meetings.filter((meeting) => {
                  if (
                    !meeting.isValid &&
                    !meeting.fileId &&
                    meeting.isRecordingAvailable?.id
                  )
                    return false;
                  else return true;
                });
                // console.log("api----------",
                // JSON.stringify(api) )
                // return result_api;
                const result_final = await axios.post(
                  "https://app.getherd.ai/api/gmeet/setsametimeRetrievedMeetings",
                  { meetingList: api, gmeetUser: gmeetuser }
                );
                return result_final;
              },
              gmeetuser
            );
            if (result_import == false)
              return {
                status: false,
                message: "refresh and import failed",
                user_id: gmeetuser.user_id,
              };
            console.log("result_import", result_import.status);
            return {
              status: true,
              message: "refresh and import successfully",
              user_id: gmeetuser.user_id,
            };
          })
      );
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
