const nodemailer = require('nodemailer');
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

const sesClient = new SESClient({
  region: "us-east-1", // Change to your AWS SES region
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});


const sendEmail = async ({ to, subject, html, text }) => {

  const params = {
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Body: html ? {
        Html: {
          Charset: "UTF-8",
          Data: html,
        }
      } : {
        Text: {
          Charset: "UTF-8",
          Data: text,
        }
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


exports.sendEmail = sendEmail;


exports.sendResetEmail = async (email, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  const html = `
    <h1>Password Reset</h1>
    <p>Click the link below to reset your password:</p>
    <a href="${resetUrl}">Reset Password</a>
    <p>This link will expire in 1 hour.</p>
  `;
  await sendEmail({ to: email, subject: 'Password Reset Request', html });
}; 