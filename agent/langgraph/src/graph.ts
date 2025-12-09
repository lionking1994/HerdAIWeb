import { tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, ToolMessage, AIMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { date, z } from "zod";
import axios from "axios";
import pg from 'pg';
import { DateTime } from "luxon";
import { RunnableConfig } from "@langchain/core/runnables";
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Environment variables setup - Load from environment, do not hardcode secrets
process.env.LANGSMITH_TRACING = process.env.LANGSMITH_TRACING || "true";
process.env.LANGSMITH_ENDPOINT = process.env.LANGSMITH_ENDPOINT || "https://api.smith.langchain.com";
// LANGSMITH_API_KEY, OPENAI_API_KEY, and HERD_API_KEY should be set via .env file
// Do not hardcode API keys in source code

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'agentherddb',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
});

const PUBLIC_EMAIL_DOMAINS = [
    'gmail.com', 'googlemail.com',
    'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'ymail.com',
    'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
    'aol.com',
    'proton.me', 'protonmail.com',
    'mail.com',
    'icloud.com', 'me.com', 'mac.com',
    'zoho.com',
    'gmx.com', 'gmx.net'
];

async function getUserInfo(userEmail: string) {
    const client = await pool.connect();

    try {
        const userQuery = await client.query(`
            SELECT id, name, email FROM users WHERE email = $1
        `, [userEmail]);

        if (userQuery.rows.length === 0) {
            return false;
        }

        return {
            user_id: userQuery.rows[0].id,
            user_name: userQuery.rows[0].name,
            user_email: userQuery.rows[0].email
        };
    } catch (error) {
        console.error('Error:', error);
        return false;
    } finally {
        client.release();
    }
}

// Assistant tools
const getMeetingHistory = tool(
    async ({ userEmail }: {
        userEmail: string;
    }) => {
        const client = await pool.connect();

        try {
            // Find the user and their domain
            const userQuery = await client.query(`
                SELECT id, name, email FROM users WHERE email = $1
            `, [userEmail]);

            console.log('getMeetingHistory Email:', userEmail);

            if (userQuery.rows.length === 0) {
                throw new Error('User not found');
            }

            const userId = userQuery.rows[0].id;
            const userName = userQuery.rows[0].name;
            console.log(userId, userName);
            const emailDomain = userEmail.split('@')[1];

            // Find coworkers (users with same email domain)
            const coworkersQuery = await client.query(`
                SELECT id, email FROM users 
                WHERE (
                email LIKE $1 
                OR (
                    email LIKE ANY($2) 
                    AND split_part(email, '@', 2) = ANY($3)
                )
                ) 
                AND id != $4
            `, [
                `%@${emailDomain}`,           // Same domain users
                Array(PUBLIC_EMAIL_DOMAINS.length).fill('%@%'),  // Wildcard for all emails
                PUBLIC_EMAIL_DOMAINS,         // Public domains list
                userId                        // Exclude current user
            ]);

            const coworkerIds = coworkersQuery.rows.map((row: { id: any; }) => row.id);

            // Find meetings where coworkers participated
            const meetingsQuery = await client.query(`
                SELECT DISTINCT m.id, m.title, m.summary, m.datetime
                FROM meetings m
                INNER JOIN meeting_participants mp ON m.id = mp.meeting_id
                WHERE (mp.user_id = ANY($1) OR mp.user_id = $2)
                AND m.summary IS NOT NULL 
                AND m.summary != ''
            `, [coworkerIds, userId]);

            // Get detailed information for each meeting
            const result = await Promise.all(meetingsQuery.rows.map(async (meeting: { id: any; title: any; summary: any; datetime: any; }) => {
                // Check if the user attended this meeting
                const attendanceQuery = await client.query(`
                    SELECT 1 FROM meeting_participants 
                    WHERE meeting_id = $1 AND user_id = $2
                `, [meeting.id, userId]);

                // Get coworker participants and their tasks
                const participantsQuery = await client.query(`
                    SELECT 
                    mp.user_id,
                    u.name,
                    u.email,
                    mp.role,
                    json_agg(
                        json_build_object(
                        'title', t.title,
                        'description', t.description,
                        'status', t.status,
                        'rate', t.rate,
                        'review', t.review
                        )
                    ) as tasks
                    FROM meeting_participants mp
                    INNER JOIN users u ON u.id = mp.user_id
                    LEFT JOIN tasks t ON t.meeting_id = mp.meeting_id AND t.assigned_id = mp.user_id
                    WHERE mp.meeting_id = $1 AND mp.user_id = ANY($2)
                    GROUP BY mp.user_id, u.name, u.email, mp.role
                `, [meeting.id, coworkerIds]);

                return {
                    id: meeting.id,
                    title: meeting.title,
                    summary: meeting.summary, //.slice(0, 100),
                    datetime: meeting.datetime,
                    meeting_participants: participantsQuery.rows.map(participant => ({
                        user_id: participant.user_id,
                        name: participant.name,
                        email: participant.email,
                        role: participant.role,
                        tasks: participant.tasks.filter((task: { title: null; }) => task.title !== null) // Filter out null tasks
                    })),
                    is_attended: attendanceQuery.rows.length > 0
                };
            }));

            return {
                meetings: result,
                data_interpretation: `
                ------------
                As to task, if a user completes the task, its status is Completed. And then the reviewer set review and rate. rate is 1 - 5 and 5 is good and 1 is bad. When set the review, the status of task is Rated.
                When a task is created, its status is set to "Pending".
                When the task is assigned to a team member, the status changes to "Assigned".
                When the member begins working on the task, the status becomes "In Progress".
                When the task is completed, the status changes to "Completed".
                After the task owner reviews it, the status is updated to "Rated".
                Therefore, the final status is "Rated".
                ------------
                coworker refers to the user who is in the same domain or public domain. e.g. matt@herd.ai, james@gmail.com and thomas@herd.ai are coworkers
                ------------
                As for each meeting,
                {
                    id,
                    title,
                    summary, // meeting summary of transcription
                    datetime,
                    meeting_participants: [ // this is an array of just only coworkers(of ${userEmail}) attended the meeting
                        {
                            user_id,
                            name,
                            email,
                            role, // meeting organizer or not
                            tasks: [ // this is an array of tasks which assigned to this coworker in this meeting
                                {
                                    title,
                                    description,
                                    status, // status progression (Pending → Assigned → In Progress → Completed → Rated)
                                    rate, // rate score the task owner set, 5 is the best and 1 is the worst
                                    review // review the task owner set
                                }
                            ]
                        }
                    ],
                    is_attended: true or false // this is true if ${userEmail} attended the meeting
                }`
            };
        } catch (error) {
            console.error('Error:', error);
            return `Error: ${error}`;
        } finally {
            client.release();
        }
    },
    {
        name: "get_meeting_history",
        description: "Get the meeting history of a user based on the email of the user.",
        schema: z.object({
            userEmail: z.string().describe("It is the email of the user to get the meeting history.")
        })
    }
);

const getTaskList = tool(
    async ({ userEmail }: {
        userEmail: string;
    }) => {
        try {
            const response = await axios.post('https://app.getherd.ai/api/tasks/todo-task', 
                { email: userEmail },
                { 
                    headers: { 
                        'x-api-key': process.env.HERD_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000,
                    validateStatus: function (status) {
                        return status >= 200 && status < 500;
                    }
                }
            );

            if (response.data.success) {
                console.log(response.data.data);
                return response.data.data;
            } else {
                throw new Error('Failed to fetch tasks');
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNABORTED') {
                    return `Error: Request timed out. Please try again.`;
                }
                if (error.response) {
                    return `Error: Server responded with status ${error.response.status}`;
                }
                if (error.request) {
                    return `Error: No response received from server`;
                }
            }
            console.error('Error:', error);
            return `Error: ${error}`;
        }
    },
    {
        name: "get_task_list",
        description: "Get the in progress task list of a user based on the email of the user.",
        schema: z.object({
            userEmail: z.string().describe("It is the email of the user to get the in progress task list.")
        })
    }
);

const getTaskAssistanceById = tool(
    async ({ taskId }: {
        taskId: number;
    }) => {
        try {
            const response = await axios.post('https://app.getherd.ai/api/tasks/get-return-help', 
                { taskId },
                { 
                    headers: { 
                        'x-api-key': process.env.HERD_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000,
                    validateStatus: function (status) {
                        return status >= 200 && status < 500;
                    }
                }
            );

            if (response.data.success) {
                console.log(response.data.data.aiHelp);
                return response.data.data.aiHelp;
            } else {
                throw new Error('Failed to fetch task assistance');
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNABORTED') {
                    return `Error: Request timed out. Please try again.`;
                }
                if (error.response) {
                    return `Error: Server responded with status ${error.response.status}`;
                }
                if (error.request) {
                    return `Error: No response received from server`;
                }
            }
            console.error('Error:', error);
            return `Error: ${error}`;
        }
    },
    {
        name: "get_task_assistance",
        description: "Get the assistance for a task based on the task id.",
        schema: z.object({
            taskId: z.number().describe("It is the id of the task to get the assistance.")
        })
    }
);

const getTaskAssistanceWithTitle = tool(
    async ({ title, description, userEmail }: {
        title: string;
        description: string;
        userEmail: string;
    }) => {
        try {
            const response = await axios.post('https://app.getherd.ai/api/tasks/get-return-help-with-title', 
                {
                    title,
                    description,
                    email: userEmail
                },
                { 
                    headers: { 
                        'x-api-key': process.env.HERD_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000,
                    validateStatus: function (status) {
                        return status >= 200 && status < 500;
                    }
                }
            );

            if (response.data.success) {
                console.log(response.data.data.aiHelp);
                return { aiHelp: response.data.data.aiHelp, similarTasks: response.data.data.similarTasks.map((task: any) => ({
                    task_id: task.id,
                    title: task.title,
                    description: task.description,
                    status: task.status,
                    rate: task.rate,
                    review: task.review,
                    assignee_id: `${task.assigneeId} // user_id of the assignee`,
                    assignee_name: `${task.assigneeName} // user_name of the assignee`
                })) };
            } else {
                throw new Error('Failed to fetch task assistance');
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNABORTED') {
                    return `Error: Request timed out. Please try again.`;
                }
                if (error.response) {
                    return `Error: Server responded with status ${error.response.status}`;
                }
                if (error.request) {
                    return `Error: No response received from server`;
                }
            }
            console.error('Error:', error);
            return `Error: ${error}`;
        }
    },
    {
        name: "get_task_assistance_with_title",
        description: "Get the assistance for a task based on the task title and description.",
        schema: z.object({
            title: z.string().describe("It is the title of the task to get the assistance."),
            description: z.string().describe("It is the description of the task to get the assistance. As optional, description can be empty string."),
            userEmail: z.string().describe("It is the email of the user to get the assistance.")
        })
    }
);

const researchWithTopic = tool(
    async ({ topic, userEmail }: {
        topic: string;
        userEmail: string;
    }) => {
        try {
            const response = await axios.post('https://app.getherd.ai/api/tasks/start-research/', 
                {
                    topic,
                    email: userEmail
                },
                { 
                    headers: { 
                        'x-api-key': process.env.HERD_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000,
                    validateStatus: function (status) {
                        return status >= 200 && status < 500;
                    }
                }
            );

            if (response.data.success) {
                console.log(response.data.data.requestId);
                return { requestId: response.data.data.requestId };
            } else {
                throw new Error('Failed to fetch research result');
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNABORTED') {
                    return `Error: Request timed out. Please try again.`;
                }
                if (error.response) {
                    return `Error: Server responded with status ${error.response.status}`;
                }
                if (error.request) {
                    return `Error: No response received from server`;
                }
            }
            console.error('Error:', error);
            return `Error: ${error}`;
        }
    },
    {
        name: "research_with_topic",
        description: "Get the research result with the topic.",
        schema: z.object({
            topic: z.string().describe("It is the topic to get the research."),
            userEmail: z.string().describe("It is the email of the user to get the research.")
        })
    }
);

const prepareUpcomingMeeting = tool(
    async ({ userEmail, meetingId }: {
        userEmail: string;
        meetingId: string;
    }) => {
        try {
            console.log("-------------------------------------Prepare Upcoming Meeting---------------------------------------");
            console.log(`userEmail:${userEmail}, meetingId: ${meetingId}`)
            const response = await axios.post('https://app.getherd.ai/api/meeting/prepare', 
                {
                    email: userEmail,
                    meetingId: meetingId
                },
                {
                    headers: { 
                        'x-api-key': process.env.HERD_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000,
                    validateStatus: function (status) {
                        return status >= 200 && status < 500;
                    }
                }
            );
            console.log(response.data)
            if (response.data.success) {
                const formattedResponse = {
                    meeting: {
                        ...response.data.meeting,
                         schedule_datetime: new Date(response.data.meeting.schedule_datetime),
                        description: response.data.meeting.description ||
                            "Meeting preparation summary will be generated based on available context.",
                        organizer_name: response.data.meeting.organizer_name,
                        organizer_email: response.data.meeting.organizer_email
                    },
                    participants: response.data.participants || 0
                };

                return {
                    success: true,
                    data: formattedResponse,
                    message: formatMeetingPreparationMessage(formattedResponse)
                };
            } else {
                throw new Error('Failed to prepare meeting');
            }
        } catch (error) {
            console.error('Error in prepareUpcomingMeeting:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    },
    {
        name: "prepare_upcoming_meeting",
        description: "Prepares for specified meeting using meeting ID. Use when user mentions 'prepare for meeting', 'meeting prep', or provides a meeting ID.",
        schema: z.object({
            userEmail: z.string().describe("Email of the user preparing for the meeting"),
            meetingId: z.string().describe("ID of the upcoming meeting")
        })
    }
);

const scheduleMeeting = tool(
    async (
        { title, attendees, userEmail, description }:
            {
                title: string;
                attendees: string[];
                userEmail: string;
                description?: string;
            }
    ) => {
        try {
            console.log('---scheduleMeeting tool is called log 1 start ---');
            console.log(`title: ${title}, attendees: ${attendees}, userEmail: ${userEmail}, description: ${description}`);
            console.log("---scheduleMeeting tool is called log 1 end ---");

            const allParticipants = [...new Set([userEmail, ...attendees])];

            const defaultPlatformResponse = await axios.get(`https://app.getherd.ai/api/auth/default-platform/${userEmail}`, {
                headers: {
                    'x-api-key': process.env.HERD_API_KEY,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            if (!defaultPlatformResponse.data.success) {
                throw new Error('Failed to fetch default platform.');
            }

            const defaultPlatform: string = defaultPlatformResponse.data.platform;

            console.log("---defaultPlatformResponse log 2 start ---");
            console.log(defaultPlatformResponse.data);
            console.log("---defaultPlatformResponse log 2 end ---");

            const upcomingMeetingsResponse = await axios.post(
                'https://app.getherd.ai/api/meeting/get-users-upcoming-meetings',
                { userEmails: allParticipants },
                {
                    headers: {
                        'x-api-key': process.env.HERD_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            console.log("---upcomingMeetingsResponse log 3 start ---");
            console.log(upcomingMeetingsResponse.data.meetings);
            console.log("---upcomingMeetingsResponse log 3 end ---");

            if (!upcomingMeetingsResponse.data.success) {
                throw new Error('Failed to fetch upcoming meetings for participants.');
            }

            const existingMeetings = upcomingMeetingsResponse.data.meetings.map((meeting: any) => ({
                start: DateTime.fromISO(meeting.datetime),
                end: DateTime.fromISO(meeting.datetime).plus({ minutes: meeting.duration }),
            }));

            // Helper function to get the next available time slot
            const getNextAvailableSlot = (currentTime: DateTime) => {
                // Round up to the next 30-minute slot
                const minutes = currentTime.minute;
                const roundedMinutes = Math.ceil(minutes / 30) * 30;

                if (roundedMinutes >= 60) {
                    return currentTime.plus({ hours: 1 }).set({ minute: 0, second: 0, millisecond: 0 });
                } else {
                    return currentTime.set({ minute: roundedMinutes, second: 0, millisecond: 0 });
                }
            };

            // Helper function to get next business day (Monday-Friday)
            const getNextBusinessDay = (currentTime: DateTime) => {
                let nextDay = currentTime;

                // If it's Saturday (6) or Sunday (7), move to Monday
                while (nextDay.weekday === 6 || nextDay.weekday === 7) {
                    nextDay = nextDay.plus({ days: 1 });
                }

                return nextDay;
            };

            const now = DateTime.now().setZone('America/New_York');

            // Start from the next available slot after current time, but not before 9 AM and only on business days
            let proposedTime: DateTime;
            if (now.hour < 9) {
                // If before 9 AM, start from 9 AM today (if it's a business day)
                proposedTime = getNextBusinessDay(now).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
            } else if (now.hour >= 17 || now.weekday === 6 || now.weekday === 7) {
                // If after 5 PM or on weekend, start from 9 AM next business day
                proposedTime = getNextBusinessDay(now.plus({ days: 1 })).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
            } else {
                // If during business hours on a business day, start from next available slot
                proposedTime = getNextAvailableSlot(now);
            }

            let scheduled = false;
            let meetingLink = '';

            // Try to schedule for the next 14 business days
            for (let i = 0; i < 14 * 16; i++) { // 16 slots per day (30-min slots from 9-5)
                console.log("--- proposedTime log 7 start ---");
                console.log('i: ', i, 'proposedTime:', proposedTime.toISO(), 'weekday:', proposedTime.weekday);
                console.log("--- proposedTime log 7 end ---");

                // Skip weekends
                if (proposedTime.weekday === 6 || proposedTime.weekday === 7) {
                    proposedTime = getNextBusinessDay(proposedTime.plus({ days: 1 })).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
                    continue;
                }

                // Business hours: 9 AM to 5 PM on business days only
                while (proposedTime.hour >= 9 && proposedTime.hour < 17 && proposedTime.weekday >= 1 && proposedTime.weekday <= 5) {
                    const proposedEndTime = proposedTime.plus({ minutes: 30 });

                    // Ensure the proposed time is after current time
                    if (proposedTime > now) {
                        const isConflict = existingMeetings.some((meeting: any) =>
                            (proposedTime >= meeting.start && proposedTime < meeting.end) ||
                            (proposedEndTime > meeting.start && proposedEndTime <= meeting.end) ||
                            (proposedTime <= meeting.start && proposedEndTime >= meeting.end)
                        );

                        if (!isConflict) {
                            const payload = {
                                title,
                                description: description || '',
                                startTime: proposedTime.toISO(),
                                endTime: proposedEndTime.toISO(),
                                attendees: allParticipants,
                                organizerEmail: userEmail,
                                timeZone: 'America/New_York',
                                contentType: "HTML",
                                content: description || ''
                            };

                            const scheduleApiMap = {
                                'google': 'https://app.getherd.ai/api/gmeet/create-google-calendar-meeting',
                                'zoom': 'https://app.getherd.ai/api/zoom/create-zoom-meeting',
                                'teams': 'https://app.getherd.ai/api/teams/schedule-teams-meeting-agent'
                            };
                            const apiLink = scheduleApiMap[defaultPlatform as keyof typeof scheduleApiMap];
                            console.log("--- apiLink log 4 start ---");
                            console.log(apiLink);
                            console.log("--- apiLink log 4 end ---");
                            const scheduleResponse = await axios.post(apiLink, JSON.stringify(payload), {
                                headers: {
                                    'x-api-key': process.env.HERD_API_KEY,
                                    'Content-Type': 'application/json'
                                },
                                timeout: 30000
                            });
                            console.log("--- scheduleResponse log 5 start ---");
                            console.log(scheduleResponse.data);
                            console.log("--- scheduleResponse log 5 end ---");
                            // switch (defaultPlatform) {
                            //     case 'teams':
                            //         if (scheduleResponse.data.success) {
                            //             scheduled = true;
                            //             meetingLink = scheduleResponse.data.data.onlineMeeting.joinUrl;
                            //             break;
                            //         }
                            //         break;
                            //     case 'google':
                            //         if (scheduleResponse.data.success) {
                            //             scheduled = true;
                            //             meetingLink = scheduleResponse.data.meeting.hangoutLink;
                            //             break;
                            //         }
                            //         break;
                            //     case 'zoom':
                            //         if (scheduleResponse.data.success) {
                            //             scheduled = true;
                            //             meetingLink = scheduleResponse.data.data.join_url;
                            //             break;
                            //         }
                            //         break;
                            // }
                            if (scheduleResponse.data.success) {
                                scheduled = true;
                                meetingLink = defaultPlatform === 'teams' ? scheduleResponse.data.data.onlineMeeting.joinUrl : defaultPlatform === 'google' ? scheduleResponse.data.meeting.hangoutLink : scheduleResponse.data.data.join_url;
                                break;
                            }

                        }
                    }

                    // Move to the next 30-minute slot
                    proposedTime = proposedTime.plus({ minutes: 30 });
                }

                if (scheduled) break;

                // Move to the next business day, 9 AM
                proposedTime = getNextBusinessDay(proposedTime.plus({ days: 1 })).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
            }

            if (!scheduled) {
                // Fallback: Book the first available slot for the organizer only
                console.log("--- fallback start ---");
                console.log('now: ', now.toISO());
                console.log("--- fallback end ---");

                let organizerTime: DateTime;
                if (now.hour < 9) {
                    organizerTime = getNextBusinessDay(now).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
                } else if (now.hour >= 17 || now.weekday === 6 || now.weekday === 7) {
                    organizerTime = getNextBusinessDay(now.plus({ days: 1 })).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
                } else {
                    organizerTime = getNextAvailableSlot(now);
                }

                for (let i = 0; i < 14 * 16; i++) { // 16 slots per day (30-min slots from 9-5)
                    console.log("--- organizerTime log 6 start ---");
                    console.log('i: ', i, 'organizerTime:', organizerTime.toISO(), 'weekday:', organizerTime.weekday);
                    console.log("--- organizerTime log 6 end ---");

                    // Skip weekends
                    if (organizerTime.weekday === 6 || organizerTime.weekday === 7) {
                        organizerTime = getNextBusinessDay(organizerTime.plus({ days: 1 })).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
                        continue;
                    }

                    while (organizerTime.hour >= 9 && organizerTime.hour < 17 && organizerTime.weekday >= 1 && organizerTime.weekday <= 5) {
                        const organizerEndTime = organizerTime.plus({ minutes: 30 });

                        // Ensure the organizer time is after current time
                        if (organizerTime > now) {
                            const isConflict = existingMeetings.some((meeting: any) =>
                                (organizerTime >= meeting.start && organizerTime < meeting.end) ||
                                (organizerEndTime > meeting.start && organizerEndTime <= meeting.end)
                            );

                            if (!isConflict) {
                                const payload = {
                                    title,
                                    description: description || '',
                                    startTime: organizerTime.toISO(),
                                    endTime: organizerEndTime.toISO(),
                                    attendees: [userEmail],
                                    organizerEmail: userEmail,
                                    contentType: "HTML",
                                    content: description || ''
                                };

                                const scheduleApiMap = {
                                    'gmeet': 'https://app.getherd.ai/api/gmeet/schedule-gmeet-meeting',
                                    'zoom': 'https://app.getherd.ai/api/zoom/schedule-zoom-meeting',
                                    'teams': 'https://app.getherd.ai/api/teams/schedule-teams-meeting'
                                };

                                const scheduleResponse = await axios.post(scheduleApiMap[defaultPlatform as keyof typeof scheduleApiMap], JSON.stringify(payload), {
                                    headers: {
                                        'x-api-key': process.env.HERD_API_KEY,
                                        'Content-Type': 'application/json'
                                    },
                                    timeout: 30000
                                });

                                console.log("--- scheduleResponse log 7 start ---");
                                console.log(scheduleResponse.data);
                                console.log("--- scheduleResponse log 7 end ---");

                                if (scheduleResponse.data.success) {
                                    meetingLink = scheduleResponse.data.onlineMeeting.joinUrl;
                                    proposedTime = organizerTime; // Update proposedTime for the response
                                    scheduled = true;
                                    break;
                                }
                            }
                        }
                        organizerTime = organizerTime.plus({ minutes: 30 });
                    }
                    if (scheduled) break;
                    organizerTime = getNextBusinessDay(organizerTime.plus({ days: 1 })).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
                }
            }

            if (scheduled) {
                return {
                    success: true,
                    meeting: {
                        title,
                        description: description || '',
                        attendees: allParticipants,
                        dateTime: proposedTime.toISO(),
                        platform: defaultPlatform,
                        joinUrl: meetingLink
                    },
                    message: `Meeting scheduled successfully for ${proposedTime.toLocaleString()} EST`
                };
            } else {
                return {
                    success: false,
                    error: 'Failed to schedule meeting after trying all available slots.',
                    meeting: {
                        title,
                        description: description || '',
                        attendees: allParticipants,
                        dateTime: null,
                        platform: defaultPlatform,
                        joinUrl: null
                    }
                };
            }

        } catch (error: any) {
            console.error('Error in scheduleMeeting tool:', error);
            const errorMessage = axios.isAxiosError(error)
                ? `Error scheduling meeting: ${error.response?.data?.message || error.message}`
                : `Error scheduling meeting: ${error.message}`;

            return {
                success: false,
                error: errorMessage,
                meeting: {
                    title: title || '',
                    description: description || '',
                    attendees: attendees || [],
                    dateTime: null,
                    platform: null,
                    joinUrl: null
                }
            };
        }
    },
    {
        name: "schedule_meeting",
        description: "Schedule a new meeting. This tool will automatically find the best time for all attendees.",
        schema: z.object({
            title: z.string().describe("The title of the meeting."),
            attendees: z.array(z.string()).describe("A list of attendee emails to invite."),
            userEmail: z.string().describe("The email of the user who is scheduling the meeting (organizer)."),
            description: z.string().optional().describe("A description for the meeting.")
        })
    }
);

// Helper function to format the meeting preparation message
const formatMeetingPreparationMessage = (data: any) => {
    let message = ``;

    // Meeting Overview
    message += `### Meeting Overview\n`;
    message += `- **Title**: ${data.meeting.title}\n`;
    message += `- **Description**: ${data.meeting.description}\n`;
    message += `- **Date & Time**: ${new Date(data.meeting.datetime).toLocaleString()}\n`;
    message += `- **Platform**: ${data.meeting.platform}\n`;
    message += `- **Organizer**: ${data.meeting.organizer_name} (${data.meeting.organizer_email})\n\n`;

    console.log("data.participants: ", data.participants)
    // Participants with Open Tasks
    if (data.participants && data.participants.length > 0) {
        const participantsWithTasks = data.participants;

        if (participantsWithTasks.length > 0) {
            message += `### Participants with Pending Tasks\n`;
            participantsWithTasks.forEach((participant: any) => {
                message += `- <USER_ID>${participant.name}[${participant.user_id}]</USER_ID> has [PAST_MEETING_COUNT]${participant.open_tasks_count}[/PAST_MEETING_COUNT](${data.meeting.id}, ${participant.user_id}) pending ${parseInt(participant.open_tasks_count) === 1 ? 'task' : 'tasks'} from previous meetings\n`;
            });
            message += '\n';
        }
    }

    // Join URL if available
    if (data.meeting.join_url) {
        message += `### Meeting Link\n`;
        message += `[Join Meeting](${data.meeting.join_url})\n`;
    }

    return message;
};

const tools = [getMeetingHistory, getTaskAssistanceWithTitle, researchWithTopic, prepareUpcomingMeeting, scheduleMeeting];

class WorkflowManager {
    private model;
    private workflow: any;

    constructor() {
        this.model = this.getLLM();
        this.workflow = this.createWorkflow();
    }

    private getLLM() {
        const llm = new ChatOpenAI({
            modelName: "gpt-4o",
            temperature: 0
        });

        const llmWithTools = llm.bindTools(tools);

        return llmWithTools;
    }

    private createWorkflow() {
        // Create tool node
        const toolNode = new ToolNode(tools);

        // Define the function that determines whether to continue or not
        const shouldContinue = async ({ messages }: typeof MessagesAnnotation.State, config: RunnableConfig) => {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.additional_kwargs.tool_calls) {
                if (lastMessage.additional_kwargs.tool_calls.some(
                    toolCall => toolCall.function.name === "get_meeting_history"
                )) {
                    const oldGetMeetingHistories = messages.slice(0, -1).filter((message: any) => message.additional_kwargs.tool_calls && message.additional_kwargs.tool_calls.some(
                        (toolCall: any) => toolCall.function.name === "get_meeting_history"
                    ));

                    await this.workflow.updateState({
                        configurable: {
                            thread_id: config.metadata?.thread_id
                        }
                    }, {
                        messages: oldGetMeetingHistories.map((message: any) => {
                            message.content = "test";
                            return message;
                        })
                    });
                }
                return "tools";
            }
            return "__end__";
        };

        // Define the function that calls the model
        const callModel = async (state: typeof MessagesAnnotation.State) => {
            console.log(`Request started at: ${DateTime.now().toISO()}`);
            const startTime = Date.now();

            const response = await this.model.invoke(state.messages);

            const endTime = Date.now();
            console.log(`Response received at: ${DateTime.now().toISO()}`);
            console.log(`Total execution time: ${(endTime - startTime) / 1000} seconds`);

            return { messages: [response] };
        };

        // Create and compile the workflow
        const workflow = new StateGraph(MessagesAnnotation)
            .addNode("agent", callModel)
            .addNode("tools", toolNode)
            .addEdge("__start__", "agent")
            .addConditionalEdges("agent", shouldContinue)
            .addEdge("tools", "agent")
            .compile({ checkpointer: new MemorySaver() });

        return workflow;
    }

    async invoke(input: string, threadId: string = "default_thread") {
        const state = await this.workflow.getState({
            configurable: {
                thread_id: threadId
            }
        });

        if (state?.values?.messages) {
            console.log(state.values.messages.map((message: any) => {
                message.content = (message.content || "").slice(0, 100);
                return message;
            }));
        }

        const stream = await this.workflow.stream(
            {
                messages: [new HumanMessage(input)]
            },
            {
                configurable: {
                    thread_id: threadId
                },
                streamMode: "messages",
            }
        );

        return stream;
    }

    async setState(threadId: string = "default_thread", userEmail: string) {
        const state = await this.workflow.getState({
            configurable: {
                thread_id: threadId
            }
        });

        if ((state?.values?.messages || []).length > 0) return false;

        const userInfo = await getUserInfo(userEmail);

        if (userInfo) {
            return await this.workflow.updateState({
                configurable: {
                    thread_id: threadId
                }
            }, {
                messages: [{
                    role: "system",
                    content: `You are a helpful assistant to handle tasks below.

            Here are some services that you can provide while make conversation with the user
            ###
                Step 1. Recommend better title and agenda for the meeting based on the given title and description. Also recommend who to invite and why need to invite them one by one
                    - When a user says "schedule meeting" or similar phrases, you should immediately display a form with the following attributes:
                        * Title: [Suggested title based on context or empty]
                        * Description: [Suggested agenda/description or empty]
                        * Attendees: [List of recommended attendees with their names and emails]
                    - If the user provides a subject/intent or title and description, you should use the [meeting history tool] to get historical meetings related to the user for the meeting recommendation.
                    - As soon as you get the historical meetings, you should recommend a better title and agenda for the meeting based on the given title, description and historical meetings.
                    - After recommending better title and agenda, you should recommend who to invite (name and email) and why they should be invited based on their historical meeting contributions and task ratings/reviews. Take note of Rule 6 unconditionally!
                    - Present the form with your recommendations filled in, allowing the user to modify any field before proceeding.
                    - IMPORTANT: At the end of your response, you MUST include the <PrePopulateMeeting></PrePopulateMeeting> tag to trigger the meeting form popup.
                Step 2. Help with meeting scheduling
                    - Attendees may be null from request, on this case, use empty array, don't use intial attendees on last request.
                    - After collecting meeting details (title, description, attendees), use the [schedule_meeting] tool to create the meeting.
                    - The tool will return either:
                        * Success: title and description and attendees and date and time and platform and join link and confirmation message
                        * Failure: Error message explaining what went wrong
                    - Present the result to the user clearly:
                        * If successful: Show the meeting details, and confirmation
                        * If failed: Explain the error and suggest next steps
                    - Default meeting platform is 'teams' unless user specifies otherwise
                    - Default duration is 30 minutes unless user specifies otherwise
                    - Always include the user's email when calling the schedule_meeting tool
                    - If attendees is empty, use empty array for scheduling meeting.
                Step 3. Help with meeting updates
                    - If the user wants to update the meeting, ask for the meeting ID and the updates they want to make.
                    - For cancellations, use the [meeting cancellation tool] with the provided meeting ID.
                    - For rescheduling or revisions, cancel the existing meeting and schedule a new one using the [meeting scheduling tool] with the updated information.
                    - Follow Step 2 guidelines when collecting updated meeting information.

            Service 2. Help a user with his particular tasks
                - When a user asks you to help with tasks, you should ask the user what task the use wants to get help from.
                - After getting the task, you should use the [task assistance with title tool] to get the similar_tasks and AI_help for the task.
                - After that, you should absolutely incorporate the similar_tasks data as examples({assigneeName}[{assigneeId}], who rated similar task {task title} with {rating} // Take note of Rule 10 and 11) into AI_help if similar tasks are helpful. so the result should be used as detailed explanation on how best to complete the task the user wants to get help.
                - You shouldn't use similar tasks as the alone section in your response. You should incorporate the similar tasks data into AI_help.

            Service 3. Help a research any topic a user want
                - When a user asks you to help with research, you should use the [research with topic tool] to get the research result.
                - When use [research with topic tool], you will get the requestId. You should return the requestId to the user with saying "your research is on the way".
                - 'requestId' should be wrapped with <REQUEST_ID> tag. e.g. <REQUEST_ID>y77znjvufl3m</REQUEST_ID>

            Service 4. Help remind a user to prepare for upcoming meetings
                - When a user mentions keywords like "prepare for meeting", "meeting preparation", or provides a meeting ID (in any format), you MUST immediately use the [prepare_upcoming_meeting] tool.
                - Meeting ID examples:
                    * Direct: "test-transcription-asdqwe"
                    * In quotes: "test-transcription-asdqwe"
                    * In sentence: "[PREPARE_MEETING]5437[/PREPARE_MEETING]" → ID is 5437
                - ALWAYS include the user's email (${userInfo.user_email}) and extracted meeting ID when calling the tool.
                - If no meeting ID is provided, ask the user to specify it.
                - After getting the meeting information, you must organize and present:
                    1. Meeting Overview:
                        - Title, Description, date, time
                        - Meeting format/platform
                        - Organizer information
                    2. Meeting Objectives (if available)
                    3. Participants with Pending Tasks:
                        - Format: "<USER_ID>participant_name[user_id]</USER_ID> has [PAST_MEETING_COUNT]count[/PAST_MEETING_COUNT](meeting_id, user_id) pending task(s)"
                        - Example: "<USER_ID>John Doe[123]</USER_ID> has [PAST_MEETING_COUNT]5[/PAST_MEETING_COUNT](456, 123) pending tasks"
                    4. Meeting Link (if available)
                    5. Preparation Suggestion:
                        - Given this meeting, what is the best way to prepare with meeting's title, description, and attendees, give me a 300 word summary.
                        - Example: "To prepare for the "Google Reoccurring Test" meeting, focus on reviewing the current status of the mobile app for precise equity firms. Start by gathering all relevant updates and progress reports on the app's development since the last meeting. Identify any challenges or issues that have arisen and consider potential solutions or workarounds. Ensure you have access to any necessary data or analytics that can support your discussion ..."
                    6. Preparation Research:
                        - Given this meeting, what is the single best research topic I should consider to help me prepare? , Topic must be one sentence and less than 20 words. return as topic
                        - Must follow format, need markdown format. {Topic} <Research_Topic>{Topic} Yes?</Research_Topic>
                        - Example: Improve productivity through automation <Research_Topic>{Improve productivity through automation} Yes? </Research_Topic>
            ###

            Here are some rules that you need to keep while make conversation with the user
            ###
            Rule 1. Please make the conversation based on the user's request.
            Rule 2. Your first greeting should mention the user's name and let them know what you can help including coming services so engage the user to ask services you can provide.
                e.g. "Hi ${userInfo.user_name}! I can help you with\n1. Plan your next awesome meeting.\n2. Help with particular tasks.\n3. Research any topic you need vai researchby.ai. \nWhat can I help you with today?"
            Rule 3. You MUST use the [prepare_upcoming_meeting] tool when meeting preparation is mentioned, even if the meeting ID needs extraction.
            Rule 4. As soon as you get the output from the tool, you should give your response based on the tool's output.
            Rule 5. You should lock agenda to 30min to 1 hour while recommending the meeting.
            Rule 6. While recommending the meeting, you should only recommend people who completed or are doing tasks that are related to the given topic. The fact that someone has the potential to do it cannot be a reason for a recommendation. If you cannot find anyone who fits for the subject or title/description the user is planning, you absolutely must say that you have no one to recommend for the meeting.
            Rule 7. You shouldn't ask the user to provide description of the meeting if the user doesn't mention about it.
            Rule 8. Once you get subject or intent of the meeting that the user plans, you shouldn't ask the user to provide title and description of the meeting.
            Rule 9. You shouldn't say "Unfortunately, I couldn't find any other specific individuals who have been involved in tasks directly related to the given topic." when you recommend more than 1 invitee who is related to the given topic.
            Rule 10. You should apply the pattern below to all recognizable usernames except "${userInfo.user_name}" (interlocutor talking with you now) in your response. pattern: "<USER_ID>user_name[user_id]</USER_ID>"
                e.g. "For your meeting, <USER_ID>John Doe[322]</USER_ID> and <USER_ID>Jane Doe[422]</USER_ID> will be invited."
            Rule 11. You shouldn't miss task rating while incorporating the similar tasks data into AI_help.
            Rule 12. When a user mentions scheduling a meeting or uses phrases like "schedule meeting", "set up a meeting", "plan a meeting", etc., you MUST include the <PrePopulateMeeting></PrePopulateMeeting> tag at the end of your response to trigger the meeting form popup.
            ###

            Here are some feedbacks of the responses you generated before. You need adjust your response based on these feedbacks
            ###
            Feedback 1. You don't give the user the better title and agenda for the meeting when there is no one for recommendation. Even though no one for recommendation, you should give the user the better title and agenda for the meeting.
            Feedback 2. You said "Unfortunately, I couldn't find any other specific individuals who have been involved in tasks directly related to the given topic." even though you have recommended 1 more person who is related to the given topic. You shouldn't say that when you have some recommended invitees.
            Feedback 3. You answered "Could you please provide more details about the financial model you want to create?" when the user asked you like "Help me create a financial model" without saying #2 because you didn't understand this was help for a task. You should notice which service the user is requesting based on the 4 services you can offer and then give the user instant response without asking for more details.
            Feedback 4. You often forget to include the <PrePopulateMeeting></PrePopulateMeeting> tag when discussing meeting scheduling. Always include this tag at the end of your response when the user mentions scheduling a meeting.
            ###
            
            Note: You are talking with ${userInfo.user_name} who email is ${userInfo.user_email}.
                    `
                }]
            });
        } else {
            return await this.workflow.updateState({
                configurable: {
                    thread_id: threadId
                }
            }, {
                messages: [{
                    role: "system",
                    content: `You should tell the user that the user is not registered in the system so you can't help him now. Our customer support team: support@getherd.ai
                    `
                }]
            });
        }
    }
}

// Example usage
async function main() {
    const workflowManager = new WorkflowManager();
    await workflowManager.setState("1", "matt.francis@getherd.ai");
    const result = await workflowManager.invoke("Hi!", "1");
    console.log(result);
}

if (require.main === module) {
    main().catch(console.error);
}

export { WorkflowManager };



