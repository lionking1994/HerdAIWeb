const { SchedulerClient, CreateScheduleCommand } = require('@aws-sdk/client-scheduler');
const moment = require('moment');
require('dotenv').config();

const schedulerClient = new SchedulerClient({ 
    region: "us-east-1", // Change to your AWS SES region
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

async function scheduleWebhookNotification(meetingId, startTimeISO) {
  try {
    // Schedule 30 mins before meeting start
    console.log("scheduleWebhookNotification", meetingId, startTimeISO);
    // const notificationTime = moment(startTimeISO).subtract(3, 'minutes').toISOString(); moment().add(3, 'minutes').toISOString();
    const notificationTime = moment().add(3, 'minutes').toISOString();

    const scheduleName = `webhook-notification-${meetingId}`;

    const command = new CreateScheduleCommand({
      Name: scheduleName,
      ScheduleExpression: `at(${notificationTime})`,
      FlexibleTimeWindow: { Mode: 'OFF' },
      Target: {
        Arn: process.env.WEBHOOK_ENDPOINT_ARN, // Correct ARN now
        RoleArn: process.env.SCHEDULER_ROLE_ARN,
        HttpParameters: {
          HeaderParameters: {
            'Content-Type': ['application/json']
          }
        },
        Input: JSON.stringify({ meetingId })
      }
    });

    const response = await schedulerClient.send(command);
    console.log('✅ Schedule created:', response);
    return response;
  } catch (error) {
    console.error('❌ Error creating schedule:', error);
    throw error;
  }
}

module.exports = { scheduleWebhookNotification };