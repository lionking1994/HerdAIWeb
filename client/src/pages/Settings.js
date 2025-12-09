import React, { useState, useEffect } from "react";
import { useSafeMsal } from "../hooks/useSafeMsal";
import Navbar from "../components/Navbar";
import "./Settings.css";
import axios from "axios";
import { FormControlLabel, Switch } from "@mui/material";
import { useTheme } from "../context/ThemeContext";
import Notification from "../components/Notification";
import { toast } from "react-toastify";
import MeetingsModal from "../components/MeetingsModal";
import Footer from "../components/Footer";
import { useNavigate, useSearchParams } from "react-router-dom";
import DeleteConfirmationModal from "../components/DeleteConfirmationModal/DeleteConfirmationModal";
// import { msalConfig, loginRequest } from "../config/msalConfig";

function Settings() {
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode } = useTheme();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrievingMeetings, setIsRetrievingMeetings] = useState(false);
  const [notification, setNotification] = useState(null);
  const [teams_user, setTeamsUser] = useState(null);
  const [zoom_user, setZoomUser] = useState(null);
  const [google_user, setGoogleUser] = useState(null);
  const { instance, accounts } = useSafeMsal();
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    darkMode: darkMode,
    language: "en",
    twoFactorAuth: false,
    use_zoom: false,
    use_zoom_agent: false,
    use_teams: false,
  });

  const [showMeetingsModal, setShowMeetingsModal] = useState(false);
  const [tenantLink, setTenantLink] = useState("");
  const [meetingsList, setMeetingsList] = useState([]);
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");
  const admin_consent = searchParams.get("admin_consent");
  const message = searchParams.get("message");
  const type = searchParams.get("type");
  const tab = searchParams.get("tab");
  const success = searchParams.get("success");
  const provider = searchParams.get("provider");

  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    setSettings((prev) => ({
      ...prev,
      darkMode,
    }));
  }, [darkMode]);

  useEffect(() => {
    if (success && provider === "gmeet") {
      toast.success("Google Meet connected successfully");
    }
    if (!success && provider === "gmeet") {
      toast.error("Failed to connect to Google Meet");
    }
    if (error && provider !== "gmeet") {
      toast.error("Failed to connect to Teams Admin Consent");
    }
    if (admin_consent && !error) {
      toast.success("Teams Admin Consent granted");
    }
    if (message && type) {
      toast[type](message);
    }
  }, []);

  const fetchUserData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/auth/profile`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setSettings({
          ...settings,
          use_teams: userData.use_teams,
          use_zoom: userData.use_zoom,
          use_zoom_agent: userData.use_zoom_agent,
          use_google: userData?.googleUser?.is_connected,
        });
        setTeamsUser(userData?.teamsUser?.mail);
        setZoomUser(userData?.zoomUser?.mail);
        setGoogleUser(userData?.googleUser?.mail);
        // You might want to fetch actual settings from the backend here
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSchedulingToggle = (setting, isEnabled) => {
    let platform = ""; 
    let zoom_scheduling = false;
    let teams_scheduling = false;
    let google_scheduling = false;
    switch(setting){
      case "zoom_scheduling": 
        platform = "zoom";
        zoom_scheduling = isEnabled;
        break;
      case "teams_scheduling":
        platform = "teams";
        teams_scheduling = isEnabled;
        break;
      case "google_scheduling":
        platform = "google";
        google_scheduling = isEnabled;
        break;
      }
    const endpoint = isEnabled ? "connect-scheduling" : "disconnect-scheduling";
    setSettings((prev) => ({
      ...prev,
      zoom_scheduling: zoom_scheduling,
      teams_scheduling: teams_scheduling,
      google_scheduling: google_scheduling,
    }));
  };

  const handleLanguageChange = (e) => {
    setSettings((prev) => ({
      ...prev,
      language: e.target.value,
    }));
  };

  const handleZoomToggle = async (event) => {
    const isEnabled = event.target.checked;

    try {
      if (isEnabled) {
        // If enabling Zoom, initiate OAuth flow
        const clientId = process.env.REACT_APP_ZOOM_API_KEY;
        const redirectUri = encodeURIComponent(
          process.env.REACT_APP_ZOOM_REDIRECT_URI
        );
        const zoomAuthUrl = `https://zoom.us/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;
        window.location.href = zoomAuthUrl;
      } else {
        // If disabling Zoom, disconnect it
        const response = await axios.delete(
          `${process.env.REACT_APP_API_URL}/zoom/disconnect`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (response.data.success) {
          setSettings((prev) => ({
            ...prev,
            use_zoom: false,
          }));
        }
      }
    } catch (error) {
      console.error("Failed to toggle Zoom integration:", error);
      toast.error('Failed to toggle Zoom integration');
      // Revert the toggle if there was an error
      setSettings((prev) => ({
        ...prev,
        use_zoom: !isEnabled,
      }));
    }
  };

  const handleAgentToggle = async (handleagent, isEnabled) => {

    try {
      const token = localStorage.getItem("token");
      let platform = "";
      switch(handleagent){
        case "use_zoom_agent":
          platform = "zoom";
          break;
        case "use_teams_agent":
          platform = "teams";
          break;
        case "use_google_agent":
          platform = "google";
          break;
      }
      const endpoint = isEnabled ? "connect-agent" : "disconnect-agent";

      const response = await axios({
        method: isEnabled ? "post" : "delete",
        url: `${process.env.REACT_APP_API_URL}/${platform}/${endpoint}`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 200) {
        toast.success(
          `${platform} agent ${isEnabled ? "connected" : "disconnected"} successfully`
        );
        setSettings((prev) => ({
          ...prev,
          [handleagent] : isEnabled,
        }));
      } else {
        throw new Error(
          `Failed to ${isEnabled ? "connect" : "disconnect"} ${platform} agent`
        );
      }
    } catch (error) {
      console.error("Failed to toggle agent:", error);
      toast.error(
        error.response?.data?.message ||
          `Failed to ${isEnabled ? "connect" : "disconnect"} agent`
      );
      // Revert the toggle if there was an error
      setSettings((prev) => ({
        ...prev,
        [handleagent]: !isEnabled,
      }));
    }
  };

  const handlePreferenceToggle = async (preference) => {
    if (preference === "use_zoom") {
      try {
        if (!settings.use_zoom) {
          window.location.href = `${process.env.REACT_APP_API_URL}/zoom/zoomauth`;
        } else {
          // User is disabling Zoom
          const response = await axios.delete(
            `${process.env.REACT_APP_API_URL}/zoom/disconnect`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            }
          );

          if (response.data.success) {
            setSettings((prev) => ({
              ...prev,
              use_zoom: false,
            }));

            toast.success("Zoom disconnected successfully");
          }
        }
      } catch (error) {
        console.error("Failed to toggle Zoom integration:", error); // Revert the toggle if there was an error
      }
    }
    else if (preference === "use_teams") {
      // Handle Teams toggle
      if (!settings.use_teams) {
        const loginRequest = {
          scopes: [
            "User.Read",
            "OnlineMeetings.ReadWrite",
            "OnlineMeetingTranscript.Read.All",
            "OnlineMeetingArtifact.Read.All",
            "Calendars.Read",
            "Calendars.ReadWrite",
            "offline_access",
            'Application.ReadWrite.All',
            "Directory.Read.All",
            "RoleManagement.Read.Directory",
          ],
          prompt: "select_account", //"consent", //
          // authority: `https://login.microsoftonline.com/${process.env.REACT_APP_AZURE_TENANT_ID}`,
        };

        try {
          const loginResponse = await instance.loginPopup(loginRequest);
          try {
            const tokenResponse = await instance.acquireTokenSilent({
              scopes: [
                "User.Read",
                "OnlineMeetings.ReadWrite",
                "OnlineMeetingArtifact.Read.All",
                "OnlineMeetingTranscript.Read.All",
                "Calendars.Read",
                "Calendars.ReadWrite",
                "offline_access",
                'Application.ReadWrite.All',
                "Directory.Read.All",
                "RoleManagement.Read.Directory",
              ],
              account: loginResponse.account,
            });

            const jwtToken = localStorage.getItem("token");

            // Retrieve refresh token from session storage
            const refreshToken = Object.keys(sessionStorage).find(
              (key) =>
                key.includes("refreshtoken") &&
                key.includes(loginResponse.account.homeAccountId)
            );
            if (refreshToken) {
              console.log("refreshToken", refreshToken);
              const tokenValue = sessionStorage.getItem(refreshToken);
              console.log(
                "Retrieved refresh token for account:",
                JSON.parse(tokenValue)
              );


              // Send both access token and refresh token to backend
              
              const response = await axios.post(
                `${process.env.REACT_APP_API_URL}/teams/callback`,
                {
                  tokenResponse: tokenResponse,
                  refreshToken: JSON.parse(tokenValue),
                },
                {
                  headers: {
                    Authorization: `Bearer ${jwtToken}`,
                    "Content-Type": "application/json",
                  },
                }
              );

              if (response.data.success) {
                console.log("response.data.isTenant", response.data.isTenant);
                if (response.data.isTenant === false) {
                  setTenantLink(
                    `https://login.microsoftonline.com/${
                      tokenResponse.account.tenantId
                    }/adminconsent?client_id=${
                      process.env.REACT_APP_AZURE_CLIENT_ID
                    }&state=12345&redirect_uri=${encodeURIComponent(
                      process.env.REACT_APP_AZURE_REDIRECT_URI
                    )}`
                  );
                  setShowTenantModal(true);
                }
                setTeamsUser(tokenResponse.account.username);
                setSettings((prev) => ({
                  ...prev,
                  use_teams: true,
                }));
                toast.success("Teams connected successfully");
              }
            } else {
              console.log("No refresh token found");
              console.error("Failed to get refresh token");
              toast.error("Failed to get refresh token");
            }
          } catch (silentError) {
            console.error("Failed to acquire token silently:", silentError);

            toast.error("Sorry, please try again");
          }
        } catch (error) {
          console.error("Teams authentication failed:", error);
          toast.error("Sorry, please try again");
        }
      } else {
        // Handle Teams disconnect
        try {
          const token = localStorage.getItem("token");
          console.log("Attempting to disconnect Teams...");
          // Check user is global administrator
          const response_GA = await axios.get(
            `${process.env.REACT_APP_API_URL}/teams/checkuseris-admin`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (response_GA.data.success) {
            if (response_GA.data.isAdmin) {
              setIsDeleteModalOpen(true)
            }
            else {
              await disconectTemasUse(false);
            }
          }
          // const response = await axios.post(
          //   `${process.env.REACT_APP_API_URL}/teams/disconnect`,
          //   {
          //     isAdmin: true
          //   },
          //   {
          //     headers: { Authorization: `Bearer ${token}` },
          //   }
          // );

          // if (response.data.success) {
          //   setSettings((prev) => ({
          //     ...prev,
          //     use_teams: false,
          //   }));

          //   toast.success("Teams disconnected successfully");
          // } 
          // else {
          //   throw new Error(
          //     response.data.error || "Failed to disconnect Teams"
          //   );
          // }
        } catch (error) {
          console.error("Failed to disconnect Teams:", error);
          toast.error(
            error.response?.data?.error || "Failed to disconnect Teams"
          );
          // Revert the toggle state since the operation failed
          setSettings((prev) => ({
            ...prev,
            use_teams: true,
          }));
        }
      }
    }
    else if (preference === "use_google") {
      try {
        if (!settings.use_google) {
          window.location.href = `${process.env.REACT_APP_API_URL}/gmeet/gmeetauth`;
        } else {
          // Handle Gmeet disconnect
          try {
            const token = localStorage.getItem("token");
            console.log("Attempting to disconnect Gmeet...");

            const response = await axios.delete(
              `${process.env.REACT_APP_API_URL}/gmeet/disconnect`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );

            if (response.data.success) {
              setSettings((prev) => ({
                ...prev,
                use_google: false,
              }));

              toast.success("Gmeet disconnected successfully");
            } else {
              throw new Error(
                response.data.error || "Failed to disconnect Gmeet"
              );
            }
          } catch (error) {
            console.error("Failed to disconnect Gmeet:", error);
            toast.error(
              error.response?.data?.error || "Failed to disconnect Gmeet"
            );
            // Revert the toggle state since the operation failed
            setSettings((prev) => ({
              ...prev,
              use_google: true,
            }));
          }
        }
      } catch (error) {
        console.error("Failed to connect to Google:", error);
        toast.error("Failed to connect to Google");
      }
    }
  };
  const handleDeleteConfirm = async() => {
    setIsDeleteModalOpen(false);
    await disconectTemasUse(true);
  };

  const handleDeleteCancel = async() => {
    setIsDeleteModalOpen(false);
   await disconectTemasUse(false);
  };

  const disconectTemasUse = async (isAsmin) => {
    debugger;
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/teams/disconnect`,
        {
          isAdmin: isAsmin
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setSettings((prev) => ({
          ...prev,
          use_teams: false,
        }));

        toast.success("Teams disconnected successfully");
      }
      else {
        throw new Error(
          response.data.error || "Failed to disconnect Teams"
        );
      }
    }
    catch (error) {
      console.error("Failed to disconnect Teams:", error);
      toast.error(
        error.response?.data?.error || "Failed to disconnect Teams"
      );
      // Revert the toggle state since the operation failed
      setSettings((prev) => ({
        ...prev,
        use_teams: true,
      }));
    }
  }

  const retrieveZoomMeetingsInfo = async () => {
    try {
      setShowMeetingsModal(true);
      setIsRetrievingMeetings(true);
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/zoom/retrieve-meetings-info`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (response.data.success) {
        setMeetingsList(response.data.meetings);
        setIsRetrievingMeetings(false);
        toast.success("Zoom meetings info retrieved successfully");
      }
    } catch (error) {
      toast.error("Failed to retrieve Zoom meetings info");
      setIsRetrievingMeetings(false);
      setMeetingsList([]);
    }
  };

  const retrieveTeamsMeetingsInfo = async () => {
    try {
      setShowMeetingsModal(true);
      setIsRetrievingMeetings(true);
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/teams/retrieve-meetings-info`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (response.data.success) {
        setMeetingsList(response.data.meetinglist);
        setIsRetrievingMeetings(false);
        toast.success("Teams meetings info retrieved successfully");
      }
    } catch (error) {
      toast.error("Failed to retrieve Teams meetings info");
      setIsRetrievingMeetings(false);
      setMeetingsList([]);
    }
  };

  const retrieveGoogleMeetingsInfo = async () => {
    try {
      setShowMeetingsModal(true);
      setIsRetrievingMeetings(true);
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/gmeet/retrieve-meetings-info`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (response.data.success) {
        setMeetingsList(response.data.meetings);
        setIsRetrievingMeetings(false);
        toast.success("Google meetings info retrieved successfully");
      }
    } catch (error) {
      toast.error("Failed to retrieve Google meetings info");
      setIsRetrievingMeetings(false);
      setMeetingsList([]);
    }
  };

  const setRetrievedMeetings = async (selectedMeetingList, type) => {
    console.log("Selected meetings1:", selectedMeetingList);
    setIsRetrievingMeetings(true);
    console.log("type", type);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/${type}/set-retrieved-meetings`,
        {
          meetingList: selectedMeetingList,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      console.log("response", response.data);
      if (response.data.success) {
        if (response.data.results.totalSuccessful)
          toast.success(`Activity info ${response.data.results.totalSuccessful
            } out of ${response.data.results.totalSuccessful +
            response.data.results.totalFailed
            } was successfully retrieved.`);
        if (response.data.results.totalFailed) {
          toast.error(`Failed to retrieve activities info ${response.data.results.totalFailed
            } out of ${response.data.results.totalSuccessful +
            response.data.results.totalFailed
            }`);
          response.data.results.failed.map((item) =>
            toast.error(`${item.error} in "${item.meetingTopic}"`)
          );
        }
      } else {
        toast.error("Failed to retrieve activities info");
      }
    } catch (error) {
      toast.error("Failed to retrieve activities info");
    } finally {
      setShowMeetingsModal(false);
      setIsRetrievingMeetings(false);
    }
  };

  const renderInterations = () => (
    <div className="integrations-table-container">
      <div className="hidden md:block">
        <table className="integrations-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Activity Connect</th>
              <th>Agent</th>
              <th>Scheduling</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Zoom</td>
              <td>
                <label className="toggle-label">
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      name="use_zoom"
                      checked={settings.use_zoom}
                      onChange={() => handlePreferenceToggle("use_zoom")}
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </td>
              <td>
                <label className="toggle-label">
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      name="use_zoom_agent"
                      checked={settings.use_zoom_agent}
                      onChange={() =>
                        handleAgentToggle("use_zoom_agent", !settings.use_zoom_agent)
                      }
                      disabled={!settings.use_zoom}
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </td>
              <td>
                <label className="toggle-label">
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      name="zoom_scheduling"
                      checked={settings.zoom_scheduling}
                      onChange={() => handleSchedulingToggle("zoom_scheduling", !settings.zoom_scheduling)}
                      disabled={!settings.use_zoom}
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </td>
            </tr>
            <tr>
              <td>Teams</td>
              <td>
                <label className="toggle-label">
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      name="use_teams"
                      checked={settings.use_teams}
                      onChange={() => handlePreferenceToggle("use_teams")}
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </td>
              <td>
                <label className="toggle-label">
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      name="use_teams_agent"
                      checked={settings.use_teams_agent}
                      onChange={() => handleAgentToggle("use_teams_agent", !settings.use_teams_agent)}
                      // disabled={!settings.use_teams}
                      disabled={false}
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </td>
              <td>
                <label className="toggle-label">
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      name="teams_scheduling"
                      checked={settings.teams_scheduling}
                      onChange={() => handleSchedulingToggle("teams_scheduling", !settings.teams_scheduling)}
                      disabled={!settings.use_teams}
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </td>
            </tr>
            <tr>
              <td>Google</td>
              <td>
                <label className="toggle-label">
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      name="use_google"
                      checked={settings.use_google}
                      onChange={() => handlePreferenceToggle("use_google")}
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </td>
              <td>
                <label className="toggle-label">
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      name="use_google_agent"
                      checked={settings.use_google_agent}
                      onChange={() => handleAgentToggle("use_google_agent", !settings.use_google_agent)}
                      disabled={!settings.use_google}
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </td>
              <td>
                <label className="toggle-label">
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      name="google_scheduling"
                      checked={settings.google_scheduling}
                      onChange={() => handleSchedulingToggle("google_scheduling", !settings.google_scheduling)}
                      disabled={!settings.use_google}
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
        <div className="md:hidden">
          <div className="flex flex-col integrations-item">
          <h3>Zoom</h3>
          <div className="flex flex-col gap-4">
              <label className="toggle-label">  
                <span className="toggle-label-span">Connected</span>
                <div className="toggle-switch">
                  <input type="checkbox" name="use_zoom" checked={settings.use_zoom} onChange={() => handlePreferenceToggle("use_zoom")} />
                  <span className="toggle-slider"></span>
                </div>
              </label>
          </div>
          <div className="flex flex-col gap-4">
              <label className="toggle-label">
                <span className="toggle-label-span">Agent</span>
                <div className="toggle-switch">
                  <input type="checkbox" name="use_zoom_agent" checked={settings.use_zoom_agent} onChange={() => handleAgentToggle("use_zoom_agent", !settings.use_zoom_agent)} disabled={!settings.use_zoom} />
                  <span className="toggle-slider"></span>
                </div>
              </label>
          </div>
          <div className="flex flex-col gap-4">
              <label className="toggle-label">
                <span className="toggle-label-span">Scheduling</span>
                <div className="toggle-switch">
                  <input type="checkbox" name="zoom_scheduling" checked={settings.zoom_scheduling} onChange={() => handleSchedulingToggle("zoom_scheduling", !settings.zoom_scheduling)} disabled={!settings.use_zoom} />
                  <span className="toggle-slider"></span>
                </div>
              </label>
          </div>
          </div>
          <div className="flex flex-col integrations-item">
          <h3>Teams</h3>
          <div className="flex flex-col gap-4">
            <label className="toggle-label">
              <span className="toggle-label-span">Connected</span>
              <div className="toggle-switch">
                <input type="checkbox" name="use_teams" checked={settings.use_teams} onChange={() => handlePreferenceToggle("use_teams")} />
                <span className="toggle-slider"></span>
              </div>
            </label>
          </div>
          <div className="flex flex-col gap-4">
            <label className="toggle-label">
              <span className="toggle-label-span">Agent</span>
              <div className="toggle-switch">
                <input type="checkbox" name="use_teams_agent" checked={settings.use_teams_agent} onChange={() => handleAgentToggle("use_teams_agent", !settings.use_teams_agent)} disabled={!settings.use_teams} />
                <span className="toggle-slider"></span>
              </div>
            </label>
          </div>
          <div className="flex flex-col gap-4">
            <label className="toggle-label">
              <span className="toggle-label-span">Scheduling</span>
              <div className="toggle-switch">
                <input type="checkbox" name="teams_scheduling" checked={settings.teams_scheduling} onChange={() => handleSchedulingToggle("teams_scheduling", !settings.teams_scheduling)} disabled={!settings.use_teams} />
                <span className="toggle-slider"></span>
              </div>
            </label>
          </div>
          </div>
          <div className="flex flex-col integrations-item">
          <h3>Google</h3>
          <div className="flex flex-col gap-4">
            <label className="toggle-label">
              <span className="toggle-label-span">Connected</span>
              <div className="toggle-switch">
                <input type="checkbox" name="use_google" checked={settings.use_google} onChange={() => handlePreferenceToggle("use_google")} />
                <span className="toggle-slider"></span>
              </div>
            </label>
          </div>
          <div className="flex flex-col gap-4">
            <label className="toggle-label">
              <span className="toggle-label-span">Agent</span>
              <div className="toggle-switch">
                <input type="checkbox" name="use_google_agent" checked={settings.use_google_agent} onChange={() => handleAgentToggle("use_google_agent", !settings.use_google_agent)} disabled={!settings.use_google} />
                <span className="toggle-slider"></span>
              </div>
            </label>
          </div>  
          <div className="flex flex-col gap-4">
            <label className="toggle-label">
              <span className="toggle-label-span">Scheduling</span>
              <div className="toggle-switch">
                <input type="checkbox" name="google_scheduling" checked={settings.google_scheduling} onChange={() => handleSchedulingToggle("google_scheduling", !settings.google_scheduling)} disabled={!settings.use_google} />
                <span className="toggle-slider"></span>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="page-container flex flex-col">
      <Navbar isAuthenticated={true} user={user} />

      <div className="settings-container overflow-auto flex-1">
        <h1>Settings</h1>

        <div className="settings-section">
          <h2>Integrations</h2>
          {renderInterations()}
        </div>

        {settings.use_zoom && (
          <div className="settings-section">
            <h2>Zoom - {zoom_user}</h2>
            <div className="setting-item">
              <div className="setting-info">
                <h3>Retrieving Zoom activities info from the past period.</h3>
                <p>
                  This will retrieve all Zoom activities info from the past period
                  and store it in the database.
                </p>
              </div>
            </div>
            <button
              className="primary-button mt-8"
              onClick={() => retrieveZoomMeetingsInfo()}
            >
              Retrieve Zoom activities info
            </button>
          </div>
        )}

        {settings.use_teams && (
          <div className="settings-section">
            <h2>Teams - {teams_user}</h2>
            <div className="setting-item">
              <div className="setting-info">
                <h3>Retrieving Teams activities info from the past period.</h3>
                <p>
                  This will retrieve all Teams activities info from the past
                  period and store it in the database.
                </p>
              </div>
            </div>
            <button
              className="primary-button mt-8"
              onClick={() => retrieveTeamsMeetingsInfo()}
            >
              Retrieve Teams activities info
            </button>
          </div>
        )}
      </div>

      {settings.use_google && (
        <div className="settings-section">
          <h2>Google - {google_user}</h2>
          <div className="setting-item">
            <div className="setting-info">
              <h3>Retrieving Google activities info from the past period.</h3>
              <p>
                This will retrieve all Google activities info from the past period
                and store it in the database.
              </p>
            </div>
          </div>
          <button
            className="primary-button mt-8"
            onClick={() => retrieveGoogleMeetingsInfo()}
          >
            Retrieve Google activities info
          </button>
        </div>
      )}
      <MeetingsModal
        showMeetingsModal={showMeetingsModal}
        setShowMeetingsModal={setShowMeetingsModal}
        meetingsList={meetingsList}
        isLoading={isRetrievingMeetings}
        onRetrieve={(selectedMeetingList, type) => {
          setRetrievedMeetings(selectedMeetingList, type);
        }}
      />

      {/* Add Tenant Modal */}

      {showTenantModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Access Required</h2>
            <p>
              First-time users will need to grant access to Teams activity
              resources.
            </p>
            <button
              className="primary-button"
              onClick={() => {
                setShowTenantModal(false);
                window.location.href = tenantLink;
              }}
            >
              Proceed
            </button>
          </div>
        </div>
      )}

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
      <Footer />
      {isDeleteModalOpen && (
        <DeleteConfirmationModal
          isOpen={isDeleteModalOpen}
          onClose={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
          taskTitle={"Do you want to delete the enterprise application?"}
          taskSubTitle={""}
        />
      )}
    </div>

  );
}

export default Settings;
