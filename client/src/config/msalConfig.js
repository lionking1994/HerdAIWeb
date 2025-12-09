export const msalConfig = {
    auth: {
        clientId: 'df22dff9-0e0f-4528-9b3e-c40130117d9a', // Replace with your client ID
        authority: 'https://login.microsoftonline.com/common', // Replace with your tenant ID
        redirectUri: 'https://app.getherd.ai/teams-callback', // Must match the redirect URI in Azure
    },
};

export const loginRequest = {
    scopes: [
        'User.Read',
        'OnlineMeetings.ReadWrite',
        'Calendars.Read',
        'OnlineMeetings.Read',
        'offline_access'], // Replace with your required scopes
        prompt: 'consent' // Force consent prompt
};