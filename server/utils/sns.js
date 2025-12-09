const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' }); // Replace with your region

const sns = new AWS.SNS({ apiVersion: '2010-03-31' });

const publishMessage = async (message) => {
    const params = {
        Message: message,
        TopicArn: 'arn:aws:sns:us-east-1:115366276173:GetHerd'
    };

    try {
        const result = await sns.publish(params).promise();
        console.log(`Message sent to SNS: ${result.MessageId}`);
    } catch (error) {
        console.error(`Error sending message to SNS: ${error}`);
    }
};

// Example usage
publishMessage('Hello from AWS SNS');