// authConfig.js

const authConfig = {
    auth: {
        clientId: process.env.TEAMS_CLIENT_ID,
        clientSecret: process.env.TEAMS_CLIENT_SECRET,
        authority: "https://login.microsoftonline.com/common",
    },
    system: {
        loggerOptions: {
            loggerCallback(loglevel, message, containsPii) {
            },
            piiLoggingEnabled: false,
            logLevel: "Info",
        }
    }
};

module.exports = authConfig;