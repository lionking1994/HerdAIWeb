const pool = require("../config/database");
const { processAI } = require("../utils/llmservice");
const TeamsUser = require("../models/TeamsUser");
const { handleTeamsApiCall } = require("./teamsController");
const axios = require("axios");



const getAllUpcomingMeeting = async (req, res) => {
    try {
        const user = req.user;
        const user_id = user.id;
        const clientTime = req.body.time; // should be ISO string or timestamp from client

        const previous = new Date();
        previous.setHours(0, 0, 0, 0); // Set to start of the day
        previous.setDate(previous.getDate() - 7); // Subtract 7 days to get the previous week start

        const later = new Date();
        later.setDate(later.getDate() + 14); // Add 14 days to get the end date
        later.setHours(23, 59, 59, 999);  // Set to end of the day


        const { rows: usermeeting } = await pool.query(
            `SELECT
        m.id, m.title, m.schedule_datetime, m.schedule_duration, m.join_Url
       FROM meetings m
      INNER JOIN meeting_participants mp ON m.id = mp.meeting_id
      WHERE m.isdeleted = false
      AND mp.user_id = $1
      AND m.schedule_datetime BETWEEN $2 AND $3
      GROUP BY m.id, m.title, m.schedule_datetime, m.schedule_duration, m.join_Url`,
            [user_id, previous, later]
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
        res.status(500).json({
            success: false,
            message: error?.message || "Unexpected error occurred",
            upcomingMeeting: []
        });
    }
}
const getUpcomingMeetingsUnderstandSchedule = async (req, res) => {
    try {
        const user = req.user;
        const user_id = user.id;

        const now = new Date();
        now.setHours(0, 0, 0, 0); // Start of today
        const later = new Date(now);
        later.setDate(later.getDate() + 14);
        later.setHours(23, 59, 59, 999); // End of 14th day

        const { rows: usermeeting } = await pool.query(
            `SELECT
        m.id, m.title, m.schedule_datetime, m.schedule_duration, m.description,
         json_agg(
          DISTINCT jsonb_build_object(
            'id', u.id,
            'name', u.name,
            'email', u.email,
            'avatar', u.avatar,
            'role', mp_at.role
          )
        ) as attendees
       FROM meetings m
      INNER JOIN meeting_participants mp ON m.id = mp.meeting_id
      INNER JOIN meeting_participants mp_at ON m.id = mp_at.meeting_id
      INNER JOIN users u ON mp_at.user_id = u.id
      WHERE m.isdeleted = false
      AND mp.user_id = $1
      AND m.schedule_datetime BETWEEN $2 AND $3
      GROUP BY m.id, m.title, m.schedule_datetime, m.schedule_duration, m.description`,
            [user_id, now, later]
        );

        const meetingDetails = usermeeting.map(meeting => `
  Meeting Title: ${meeting.title}
  Description: ${meeting.description || "No description provided"}
  Attendees: ${meeting.attendees.map(attendee => attendee.name).join(", ")}
  Meeting Date: ${meeting.schedule_datetime} UTC
  Meeting Duration: ${meeting.schedule_duration} minutes
`).join('\n\n');

        const sysprompt = "Analyze this meeting.";

        const userprompt = `
You are an expert executive assistant. Analyze the following meetings and extract the following:

1. Primary focus item
2. Secondary focus item
3. Key themes (up to 4 tags)
4. Top 3 research areas the user should look into before the week starts:

Meeting Details: ${meetingDetails}

Respond only in this exact JSON format:
{
  "capability_score": "<percent as number between 0 and 100>",
  "primary_focus": "<primary focus item>",
  "secondary_focus": "<secondary focus item>",
  "key_themes": ["<tag1>", "<tag2>", "<tag3>", "<tag4>"],
  "key_research_areas": ["<area1>", "<area2>", "<area3>"]
}`;

        const maxtokens = 2024;
        const responsetext = await processAI(sysprompt, userprompt, maxtokens);
        const match = responsetext.match(/\{[\s\S]*?\}/);
        const parsedResult = JSON.parse(match[0]);

        res.json({
            success: true,
            message: "",
            ai_summary: parsedResult
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error?.message || "Unexpected error occurred",
            data: []
        });
    }
};


const getTeamsCalendar = async (req, res) => {
    try {
        const user_id = req.user.id
        const clientTime = req.body.time;
        // const teamsUser = await TeamsUser.findByUserId(user_id);
        // if (!teamsUser) {
        //     return null;
        // }

        // const user = await TeamsUser.findByUserId(req.user.id);
        // if (!user) {
        //     return res.status(404).json({ error: "User not found" });
        // }

        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        startDate.setDate(startDate.getDate() - 7);

        const endDate = new Date();
        endDate.setHours(0, 0, 0, 0);
        endDate.setDate(endDate.getDate() + 14);

        const { rows: usermeeting } = await pool.query(
            `SELECT
        m.id, m.title, m.schedule_datetime, m.schedule_duration, m.join_Url,teams_id
       FROM meetings m
      INNER JOIN meeting_participants mp ON m.id = mp.meeting_id
      WHERE m.isdeleted = false
      AND mp.user_id = $1
      AND m.schedule_datetime BETWEEN $2 AND $3
      GROUP BY m.id, m.title, m.schedule_datetime, m.schedule_duration, m.join_Url`,
            [user_id, startDate, endDate]
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
                    teams_id: meeting.teams_id
                };
            });

        // const events = await handleTeamsApiCall(async (accessToken) => {
        //     const response = await axios.get(
        //         `${process.env.GRAPH_API_URL}/me/calendar/calendarView?endDateTime=${endDate.toISOString()}&startDateTime=${startDate.toISOString()}&top=100&skip=0&`,
        //         {
        //             headers: {
        //                 Authorization: `Bearer ${accessToken}`,
        //                 "Content-Type": "application/json",
        //             },
        //         }
        //     );
        //     return response.data.value;
        // }, teamsUser);

        // if (!events) {
        //     return null;
        // }

        // const teamsCalendarMeetings = events.map((meeting) => {
        //     const utcDateStart = new Date(meeting.start.dateTime);
        //     const utcDateEnd = new Date(meeting.end.dateTime);
        //     const schedule_duration = Math.round((utcDateEnd - utcDateStart) / (1000 * 60));
        //     const localDateStart = new Date(utcDateStart.getTime() + offsetMsWithUTC);
        //     const localDateEnd = new Date(utcDateStart.getTime() + offsetMsWithUTC + (schedule_duration * 60 * 1000));
        //     return {
        //         id: 0,
        //         teams_id: meeting.id,
        //         subject: meeting.subject,
        //         start: localDateStart,
        //         end: localDateEnd,
        //         joinUrl: meeting.onlineMeeting,
        //     };
        // });

        // const existingTeamsIds = new Set(teamsMeetings.map(m => m.teams_id));

        // const mergedMeetings = [
        //     ...teamsMeetings,
            // ...teamsCalendarMeetings.filter(m => !existingTeamsIds.has(m.teams_id))
        // ];



        res.json({
            success: true,
            message: "",
            upcomingMeeting: teamsMeetings,
        });
    } catch (error) {
        console.error("Teams calendar error:", error);
        res.status(500).json({
            error: error.message || "Failed to fetch Teams calendar",
        });
    }
};

module.exports = {
    getUpcomingMeetingsUnderstandSchedule,
    getAllUpcomingMeeting,
    getTeamsCalendar
};

