import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CircularProgress, Alert, Box } from '@mui/material';
import { toast } from 'react-toastify';
import { useSafeMsal } from "../hooks/useSafeMsal";

const TeamsCallback = () => {
  debugger;
  const navigate = useNavigate();
  const hash = localStorage.getItem('hash');
  const { instance, accounts } = useSafeMsal();
  const account = instance?.getActiveAccount?.() || accounts[0];
  useEffect(() => {
    const handleTeamsCallback = async () => {
      const loginRequest = {
        scopes: [
          "User.Read",
          "OnlineMeetings.ReadWrite",
          "OnlineMeetingTranscript.Read.All",
          "OnlineMeetingArtifact.Read.All",
          "Calendars.Read",
          "Calendars.ReadWrite",
          "offline_access",
          "Application.ReadWrite.All",
          "Directory.Read.All",
          "RoleManagement.Read.Directory",
          "Mail.Read",
          "Mail.ReadBasic"
        ],
        prompt: "select_account",
        redirectUri: process.env.REACT_APP_AZURE_REDIRECT_URI,
      };
      console.log("-----------hash-----------", hash);
      if (!hash) {
        instance.loginRedirect(loginRequest);
      }
      else {
        debugger;

        const params = new URLSearchParams(hash);
        const client_info = params.get("client_info");
        console.log("-----------client_info-----------", client_info);
        const result = decodeClientInfo(client_info);
        const { utid } = result;
        console.log("-----------utid-----------", utid);
        // localStorage.removeItem('hash');
        const queryParameters = new URLSearchParams(window.location.search);
        console.log("-----------queryParameters-----------", queryParameters.size);
        if (queryParameters.size == 0) {
          console.log("-----------window.location.href-----------", "https://login.microsoftonline.com/" + utid + "/oauth2/v2.0/authorize?client_id=df22dff9-0e0f-4528-9b3e-c40130117d9a&response_type=code&redirect_uri=" + process.env.REACT_APP_AZURE_REDIRECT_URI + "&response_mode=query&scope=https://graph.microsoft.com/.default offline_access");
          window.location.href = "https://login.microsoftonline.com/" + utid + "/oauth2/v2.0/authorize?client_id=df22dff9-0e0f-4528-9b3e-c40130117d9a&response_type=code&redirect_uri=" + process.env.REACT_APP_AZURE_REDIRECT_URI + "&response_mode=query&scope=https://graph.microsoft.com/.default offline_access"
        }
        let code = queryParameters.get("code");
        if (utid && code) {
          try {
            const response = await axios.post(
              `${process.env.REACT_APP_API_URL}/teams/azureredirect`,
              { code, utid },
              {
                headers: {
                  Authorization: `Bearer ${localStorage.getItem('token')}`
                }
              }
            );
            if (response.data.success) {
              localStorage.removeItem('hash');
              navigate('/profile?tab=connections', {
                state: { message: 'Teams account connected successfully' }
              });
            } else {
              localStorage.removeItem('hash');
              navigate('/profile?tab=connections', {
                state: { message: 'Teams account connected successfully' }
              });
            }
          }
          catch (error) {
            localStorage.removeItem('hash');
            navigate('/profile?tab=connections', {
              state: { message: 'Teams account connected successfully' }
            });
          }
        }
      }
    }
    handleTeamsCallback();
  }, [hash]);

  function decodeClientInfo(clientInfo) {
    // Decode Base64 string (atob is built-in)
    const decoded = atob(clientInfo);
    // Parse JSON string
    const parsed = JSON.parse(decoded);
    return parsed;
  }

  return (
    <Box sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh'
    }}>
      <CircularProgress />
    </Box>
  );
};

export default TeamsCallback; 
