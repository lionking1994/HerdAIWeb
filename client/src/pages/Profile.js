import React, { useState, useEffect } from "react";
import { useSafeMsal } from "../hooks/useSafeMsal";
import Navbar from "../components/Navbar";
import ChangePasswordForm from "../components/ChangePasswordForm";
import axios from "axios";
import "./Profile.css";
import Footer from "../components/Footer";
import { useTheme } from "../context/ThemeContext";
import { toast } from "react-toastify";
import MeetingsModal from "../components/MeetingsModal";
import DeleteConfirmationModal from "../components/DeleteConfirmationModal/DeleteConfirmationModal";
import { useSearchParams, useNavigate } from "react-router-dom";
import { FaLinkedin } from "react-icons/fa";
import { Pause, Play } from "lucide-react";

function Profile() {
  const navigate = useNavigate();
  const { instance, accounts } = useSafeMsal();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [companyRoles, setCompanyRoles] = useState([]);
  const [userCompanies, setUserCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "general";

  const [activeTab, setActiveTab] = useState(tab);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    location: "",
    bio: "",
    use_zoom: false,
    use_teams: false,
    use_google: false,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [settings, setSettings] = useState({
    darkMode: false,
    language: "en",
    use_teams: false,
    use_teams_agent: false,
    teams_scheduling: false,
    email_processing: false,
    use_zoom: false,
    use_zoom_agent: false,
    zoom_scheduling: false,
    use_google: false,
    use_google_agent: false,
    google_scheduling: false,
    use_linkedin: false,
  });
  const [teams_user, setTeamsUser] = useState(null);
  const [zoom_user, setZoomUser] = useState(null);
  const [google_user, setGoogleUser] = useState(null);
  const [isRetrievingMeetings, setIsRetrievingMeetings] = useState(false);
  const [meetingsList, setMeetingsList] = useState([]);
  const [showMeetingsModal, setShowMeetingsModal] = useState(false);
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [tenantLink, setTenantLink] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLinkedInModalOpen, setIsLinkedInModalOpen] = useState(false);
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [isLinkedInLoading, setIsLinkedInLoading] = useState(false);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [agentVoice, setAgentVoice] = useState("");
  const [agentPfp, setAgentPfp] = useState("");
  const [agentPfpFile, setAgentPfpFile] = useState(null);
  const [agentPfpPreview, setAgentPfpPreview] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [playingPreview, setPlayingPreview] = useState(null);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [loadedVoiceId, setLoadedVoiceId] = useState(null);
  const [agentData, setAgentData] = useState({
    myagent_name: '',
    myagent_voice_id: '',
    myagent_profile_picture: ''
  });

  const [isTestModalOpen, setIsTestModalOpen] = useState(false);



  const testMyAgent = async (agentIntro, meetingTopic, meetingId, meetingLink) => {
    try {
      const token = localStorage.getItem("token");
      console.log('Voice:', agentVoice)
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/agent/test-my-agent`, {
        userName: user.name,
        userId: user.id,
        userEmail: user.email,
        botName: agentName,
        voiceId: agentVoice,
        agentAvatar: agentPfp,
        meetingId: meetingId,
        meetingLink: meetingLink,
        meetingTopic: meetingTopic,
        agentIntro: agentIntro || `Hello everyone! I'm ${agentName || 'your AI assistant'}, here to help facilitate this meeting.`
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.status === 200) {
        toast.success("Agent tested successfully");
        setIsTestModalOpen(false);
      } else {
        throw new Error("Failed to test agent");
      }
    } catch (error) {
      console.error('Error testing agent:', error);
      toast.error(error.response?.data?.error || "Failed to test agent");
    }
  };

  const conectOutlookUser = async (isAsmin) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/outlook/connect`,
        {
          isAdmin: isAsmin
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.status === 200) {
        setSettings((prev) => ({
          ...prev,
          email_processing: true,
        }));

        toast.success("Email connected successfully");
      }
      else {
        throw new Error(
          response.data.error || "Failed to connect Email"
        );
      }
    }
    catch (error) {
      console.error("Failed to connect Email:", error);
      toast.error(
        error.response?.data?.error || "Failed to connect Email"
      );
      setSettings((prev) => ({
        ...prev,
        email_processing: false,
      }));
    }
  }

  const disconectOutlookUser = async (isAsmin) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/outlook/disconnect`,
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
          email_processing: false,
        }));

        toast.success("Email disconnected successfully");
      }
      else {
        throw new Error(
          response.data.error || "Failed to disconnect Email"
        );
      }
    }
    catch (error) {
      console.error("Failed to disconnect Email:", error);
      toast.error(
        error.response?.data?.error || "Failed to disconnect Email"
      );
      setSettings((prev) => ({
        ...prev,
        email_processing: true,
      }));
    }
  }

  const playVoicePreview = async (voice) => {
    if (currentAudio && loadedVoiceId === voice.voice_id) {
      if (currentAudio.paused) {
        try {
          await currentAudio.play();
          setPlayingPreview(voice.voice_id);
        } catch (error) {
          console.error('Error resuming audio:', error);
          toast.error('Failed to resume voice preview');
        }
      } else {
        currentAudio.pause();
        setPlayingPreview(null);
      }
      return;
    }

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setPlayingPreview(null);
      setLoadedVoiceId(null);
    }

    const audio = new Audio(voice.preview_url);

    audio.addEventListener('ended', () => {
      setPlayingPreview(null);
    });

    audio.addEventListener('error', () => {
      setPlayingPreview(null);
      setCurrentAudio(null);
      setLoadedVoiceId(null);
      toast.error('Failed to play voice preview');
    });

    try {
      await audio.play();
      setCurrentAudio(audio);
      setLoadedVoiceId(voice.voice_id);
      setPlayingPreview(voice.voice_id);
    } catch (error) {
      console.error('Error playing audio:', error);
      toast.error('Failed to play voice preview');
      setPlayingPreview(null);
      setCurrentAudio(null);
      setLoadedVoiceId(null);
    }
  };

  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
    };
  }, [currentAudio]);

  const handleVoiceSelect = (voice) => {
    setSelectedVoice(voice);
  };

  const { darkMode, toggleDarkMode } = useTheme();

  const handleAgentToggle = async (agentType, isEnabled) => {
    try {
      const token = localStorage.getItem("token");
      let platform = "";
      switch (agentType) {
        case "use_zoom_agent":
          platform = "zoom";
          break;
        case "use_teams_agent":
          platform = "teams";
          break;
        case "use_google_agent":
          platform = "google";
          break;
        case "use_email_agent":
          platform = "email";
          break;
        default:
          throw new Error("Unknown agent type");
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
        toast.success(`${platform} agent ${isEnabled ? "connected" : "disconnected"} successfully`);

        setSettings((prev) => ({
          ...prev,
          [agentType]: isEnabled,
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

      setSettings((prev) => ({
        ...prev,
        [agentType]: !isEnabled,
      }));
    }
  };

  const handleSchedulingToggle = async (schedulingType, isEnabled) => {
    try {
      const token = localStorage.getItem("token");
      let platform = "";

      switch (schedulingType) {
        case "zoom_scheduling":
          platform = "zoom";
          break;
        case "teams_scheduling":
          platform = "teams";
          break;
        case "google_scheduling":
          platform = "gmeet";
          break;
        default:
          throw new Error("Unknown scheduling type");
      }

      if (isEnabled) {
        setSettings((prev) => ({
          ...prev,
          zoom_scheduling: schedulingType === "zoom_scheduling",
          teams_scheduling: schedulingType === "teams_scheduling",
          google_scheduling: schedulingType === "google_scheduling",
        }));

        const otherPlatforms = [];
        if (schedulingType !== "zoom_scheduling" && settings.zoom_scheduling) {
          otherPlatforms.push({ type: "zoom_scheduling", platform: "zoom" });
        }
        if (schedulingType !== "teams_scheduling" && settings.teams_scheduling) {
          otherPlatforms.push({ type: "teams_scheduling", platform: "teams" });
        }
        if (schedulingType !== "google_scheduling" && settings.google_scheduling) {
          otherPlatforms.push({ type: "google_scheduling", platform: "gmeet" });
        }

        for (const otherPlatform of otherPlatforms) {
          try {
            await axios({
              method: "post",
              url: `${process.env.REACT_APP_API_URL}/${otherPlatform.platform}/disable-scheduling`,
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
          } catch (error) {
            console.error(`Failed to disable ${otherPlatform.platform} scheduling:`, error);
          }
        }
      }

      const endpoint = isEnabled ? "enable-scheduling" : "disable-scheduling";

      const response = await axios({
        method: "post",
        url: `${process.env.REACT_APP_API_URL}/${platform}/${endpoint}`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 200) {
        toast.success(response.data.message);

        setSettings((prev) => ({
          ...prev,
          [schedulingType]: isEnabled,
        }));
      } else {
        throw new Error(
          `Failed to ${isEnabled ? "enable" : "disable"} ${platform} scheduling`
        );
      }
    } catch (error) {
      console.error("Failed to toggle scheduling:", error);
      toast.error(
        error.response?.data?.message ||
        `Failed to ${isEnabled ? "enable" : "disable"} scheduling`
      );

      setSettings((prev) => ({
        ...prev,
        [schedulingType]: !isEnabled,
      }));
    }
  };

  const retrieveTeamsMeetingsInfo = async () => {
    setIsRetrievingMeetings(true);
    setShowMeetingsModal(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/teams/retrieve-meetings-info`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setMeetingsList(response.data.meetinglist);
        toast.success("Teams meetings retrieved successfully");
      } else {
        throw new Error(response.data.error || "Failed to retrieve meetings");
      }
    } catch (error) {
      console.error("Failed to retrieve Teams meetings:", error);
      toast.error(
        error.response?.data?.error || "Failed to retrieve Teams meetings"
      );
    } finally {
      setIsRetrievingMeetings(false);
    }
  };

  const retrieveZoomMeetingsInfo = async () => {
    setIsRetrievingMeetings(true);
    setShowMeetingsModal(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/zoom/retrieve-meetings-info`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setMeetingsList(response.data.meetings);
        toast.success("Zoom meetings retrieved successfully");
      } else {
        throw new Error(response.data.error || "Failed to retrieve meetings");
      }
    } catch (error) {
      console.error("Failed to retrieve Zoom meetings:", error);
      toast.error(
        error.response?.data?.error || "Failed to retrieve Zoom meetings"
      );
    } finally {
      setIsRetrievingMeetings(false);
    }
  };

  const retrieveGoogleMeetingsInfo = async () => {
    setIsRetrievingMeetings(true);
    setShowMeetingsModal(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/gmeet/retrieve-meetings-info`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setMeetingsList(response.data.meetings);
        toast.success("Google meetings retrieved successfully");
      } else {
        throw new Error(response.data.error || "Failed to retrieve meetings");
      }
    } catch (error) {
      console.error("Failed to retrieve Google meetings:", error);
      toast.error(
        error.response?.data?.error || "Failed to retrieve Google meetings"
      );
    } finally {
      setIsRetrievingMeetings(false);
    }
  };

  const fetchAvailableVoices = async () => {
    const response = await axios.get(
      `${process.env.REACT_APP_API_URL}/agent/available-voices`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );
    setAvailableVoices(response.data.availableVoices);
    console.log(response.data.availableVoices);
  };

  useEffect(() => {
    fetchAvailableVoices();
  }, []);

  useEffect(() => {
    fetchAgentData();
    fetchUserData();
  }, []);

  useEffect(() => {
    const success = searchParams.get("success");
    const provider = searchParams.get("provider");
    const admin_consent = searchParams.get("admin_consent");
    const error = searchParams.get("error");
    const type = searchParams.get("type");
    const message = searchParams.get("message");

    if (error && provider !== "gmeet") {
      setSearchParams({ tab: "connections" });
      toast.error("Failed to connect to Teams Admin Consent");
    }
    if (admin_consent && !error) {
      setSearchParams({ tab: "connections" });
      toast.success("Teams Admin Consent granted");
    }
    if (message && type) {
      toast[type](message);
    }
  }, [searchParams]);

  const fetchUserData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/auth/profile`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setUser(response.data);
      setFormData({
        name: response.data.name || "",
        email: response.data.email || "",
        phone: response.data.phone || "",
        location: response.data.location || "",
        bio: response.data.bio || "",
        use_zoom: response.data.use_zoom || false,
        use_teams: response.data.use_teams || false,
        use_google: response.data?.googleUser?.is_connected || false,
        email_processing: response.data?.teamsUser?.is_outlook_connected || false,
      });

      setSettings({
        darkMode: darkMode,
        use_teams: response.data.use_teams || false,
        use_teams_agent: response.data.use_teams_agent || false,
        teams_scheduling: response.data?.teamsUser?.teams_scheduling || false,
        email_processing: response.data?.teamsUser?.is_outlook_connected || false,
        use_zoom: response.data.use_zoom || false,
        use_zoom_agent: response.data.use_zoom_agent || false,
        zoom_scheduling: response.data?.zoomUser?.zoom_scheduling || false,
        use_google: response.data?.googleUser?.is_connected || false,
        use_google_agent: response.data.use_google_agent || false,
        google_scheduling: response.data?.googleUser?.google_scheduling || false,
        use_linkedin: response.data?.linkedinUser?.is_connected || false,
      });

      setTeamsUser(response.data?.teamsUser?.mail);
      setZoomUser(response.data?.zoomUser?.mail);
      setGoogleUser(response.data?.googleUser?.mail);
      setLinkedInUrl(response.data?.linkedin_url);
    } catch (error) {
      console.error("Error fetching user data:", error);
      toast.error("Failed to load user profile");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCompanyRoles = async (companyId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/company-roles/${companyId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setCompanyRoles(response.data.roles);
      }
    } catch (error) {
      console.error("Error fetching company roles:", error);
    }
  };

  const updateUserCompanyRole = async (companyId, roleId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/company-roles/user/${user.id}/company/${companyId}`,
        {
          company_role_id: roleId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        toast.success("Company role updated successfully");
        fetchUserData();
      }
    } catch (error) {
      console.error("Error updating company role:", error);
      toast.error("Failed to update company role");
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/auth/profile/update`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUser(response.data);
      toast.success("Profile updated successfully");
      setIsEditing(false);
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to update profile");
    }
  };

  const handlePasswordChange = () => {
    setShowPasswordForm(false);
  };

  const handlePreferenceToggle = async (preference) => {
    if (preference === "use_zoom") {
      try {
        if (!settings.use_zoom) {
          window.location.href = `${process.env.REACT_APP_API_URL}/zoom/zoomauth`;
        } else {
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
              zoom_scheduling: false,
            }));

            toast.success("Zoom disconnected successfully");
          }
        }
      } catch (error) {
        console.error("Failed to toggle Zoom integration:", error);
      }
    } else if (preference === "use_teams") {
      if (!settings.use_teams) {
        navigate('/teams-callback');
      } else {
        try {
          const token = localStorage.getItem("token");
          console.log("Attempting to disconnect Teams...");
          const response_GA = await axios.get(
            `${process.env.REACT_APP_API_URL}/teams/checkuseris-admin`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (response_GA.data.success) {
            if (response_GA.data.isAdmin) {
              setIsDeleteModalOpen(true);
            } else {
              await disconectTemasUse(false);
            }
          }
        } catch (error) {
          console.error("Failed to disconnect Teams:", error);
          toast.error(
            error.response?.data?.error || "Failed to disconnect Teams"
          );
          setSettings((prev) => ({
            ...prev,
            use_teams: true,
          }));
        }
      }
    } else if (preference === "use_google") {
      try {
        if (!settings.use_google) {
          window.location.href = `${process.env.REACT_APP_API_URL}/gmeet/gmeetauth`;
        } else {
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
                google_scheduling: false,
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
    } else if (preference === "use_linkedin") {
      try {
        if (!settings.use_linkedin) {
          window.location.href = `${process.env.REACT_APP_API_URL}/linkedin/linkedinauth`;
        } else {
          try {
            const token = localStorage.getItem("token");
            console.log("Attempting to disconnect LinkedIn...");

            const response = await axios.delete(
              `${process.env.REACT_APP_API_URL}/linkedin/disconnect`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );

            if (response.data.success) {
              setSettings((prev) => ({
                ...prev,
                use_linkedin: false,
              }));

              toast.success("LinkedIn disconnected successfully");
            } else {
              throw new Error(
                response.data.error || "Failed to disconnect LinkedIn"
              );
            }
          } catch (error) {
            console.error("Failed to disconnect LinkedIn:", error);
            toast.error(
              error.response?.data?.error || "Failed to disconnect LinkedIn"
            );
            setSettings((prev) => ({
              ...prev,
              use_linkedin: true,
            }));
          }
        }
      } catch (error) {
        console.error("Failed to connect to LinkedIn:", error);
        toast.error("Failed to connect to LinkedIn");
      }
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const formData = new FormData();
        formData.append("avatar", file);

        const token = localStorage.getItem("token");
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/auth/profile/avatar`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data",
            },
          }
        );

        setUser((prev) => ({
          ...prev,
          avatar: response.data.avatar,
        }));

        toast.success("Avatar updated successfully");
      } catch (error) {
        toast.error(error.response?.data?.error || "Failed to update avatar");
      }
    }
  };

  const renderGeneralTab = () => (
    <div className="profile-tab-content">
      <div className="profile-form-section">
        <h3>Personal Information</h3>
        <form onSubmit={handleSubmit} className="responsive-form">
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              disabled={!isEditing}
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              disabled={!isEditing}
            />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              disabled={!isEditing}
            />
          </div>
          <div className="form-group">
            <label>Location</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              disabled={!isEditing}
            />
          </div>
          <div className="form-group">
            <label>Bio</label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              disabled={!isEditing}
              rows="4"
            />
          </div>

          {user?.certifications && Array.isArray(user.certifications) && user.certifications.length > 0 && (
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-gray-600">Certifications</label>
              <div className="w-full p-3 text-base bg-white border border-gray-300 rounded-lg font-inherit transition-all duration-200 text-gray-900 max-h-48 overflow-y-auto focus-within:border-blue-500 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]">
                {user.certifications.map((cert, index) => (
                  <div key={index} className="p-3 border-b border-gray-100 mb-2 last:border-b-0 last:mb-0 border-l-3 border-l-amber-500 pl-3">
                    <div className="mb-2">
                      <h4 className="text-base font-semibold text-gray-900 mb-1 leading-5">{cert.title}</h4>
                      {cert.subtitle && <span className="text-sm text-gray-600 font-medium">{cert.subtitle}</span>}
                    </div>
                    {cert.meta && <p className="text-xs text-gray-600 my-1">{cert.meta}</p>}
                    {cert.url && (
                      <a href={cert.url} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-blue-600 no-underline mt-2 px-2 py-1 border border-blue-600 rounded transition-all duration-200 hover:bg-blue-600 hover:text-white hover:no-underline">
                        View Certification
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {user?.skills && Array.isArray(user.skills) && user.skills.length > 0 && (
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-gray-600">Skills</label>
              <div className="w-full p-3 text-base bg-white border border-gray-300 rounded-lg font-inherit transition-all duration-200 text-gray-900 flex flex-wrap gap-2 min-h-[45px] max-h-36 overflow-y-auto focus-within:border-blue-500 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]">
                {user.skills.map((skill, index) => (
                  <span key={index} className="inline-block bg-gray-100 text-gray-900 px-2 py-1 rounded text-sm font-medium border border-gray-300 transition-all duration-200 hover:bg-blue-600 hover:text-white hover:border-blue-600">
                    {typeof skill === 'string' ? skill : skill.name || skill.title}
                  </span>
                ))}
              </div>
            </div>
          )}

          {user?.projects && Array.isArray(user.projects) && user.projects.length > 0 && (
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-gray-600">Projects</label>
              <div className="w-full p-3 text-base bg-white border border-gray-300 rounded-lg font-inherit transition-all duration-200 text-gray-900 max-h-48 overflow-y-auto focus-within:border-blue-500 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]">
                {user.projects.map((project, index) => (
                  <div key={index} className="p-3 border-b border-gray-100 mb-2 last:border-b-0 last:mb-0 border-l-3 border-l-purple-500 pl-3">
                    <div className="mb-2">
                      <h4 className="text-base font-semibold text-gray-900 mb-1 leading-5">{project.title}</h4>
                      {project.start_date && <span className="text-sm text-gray-600 font-medium">{project.start_date}</span>}
                    </div>
                    {project.description && <p className="text-xs text-gray-600 my-1">{project.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {user?.recommendations && Array.isArray(user.recommendations) && user.recommendations.length > 0 && (
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-gray-600">Recommendations</label>
              <div className="w-full p-3 text-base bg-white border-gray-300 rounded-lg font-inherit transition-all duration-200 text-gray-900 max-h-48 overflow-y-auto focus-within:border-blue-500 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]">
                {user.recommendations.map((recommendation, index) => (
                  <div key={index} className="p-3 border-b border-gray-100 mb-2 last:border-b-0 last:mb-0 border-l-3 border-l-pink-500 pl-3">
                    <div className="mb-2">
                      <h4 className="text-base font-semibold text-gray-900 mb-1 leading-5">{recommendation}</h4>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {user?.publications && Array.isArray(user.publications) && user.publications.length > 0 && (
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-gray-600">Publications</label>
              <div className="w-full p-3 text-base bg-white border border-gray-300 rounded-lg font-inherit transition-all duration-200 text-gray-900 max-h-48 overflow-y-auto focus-within:border-blue-500 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]">
                {user.publications.map((publication, index) => (
                  <div key={index} className="p-3 border-b border-gray-100 mb-2 last:border-b-0 last:mb-0 border-l-3 border-l-green-500 pl-3">
                    <div className="mb-2">
                      <h4 className="text-base font-semibold text-gray-900 mb-1 leading-5">{publication.title}</h4>
                      {publication.subtitle && <span className="text-sm text-gray-600 font-medium">{publication.subtitle}</span>}
                    </div>
                    {publication.date && <p className="text-xs text-gray-600 my-1">{publication.date}</p>}
                    {publication.description && <p className="text-xs text-gray-600 my-1">{publication.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {userCompanies.length > 0 && companyRoles.length > 0 && (
            <div className="form-group">
              <label>Company</label>
              <select
                name="company"
                value={selectedCompany}
                onChange={(e) => {
                  setSelectedCompany(e.target.value);
                  fetchCompanyRoles(e.target.value);
                }}
                disabled={!isEditing}
                className="form-select"
              >
                {userCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>

              <label className="mt-4">Company Role</label>
              <select
                name="companyRole"
                value={user?.company_role_id || ''}
                onChange={(e) => updateUserCompanyRole(selectedCompany, e.target.value)}
                disabled={!isEditing}
                className="form-select"
              >
                <option value="">None</option>
                {companyRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-500 mt-1">
                Your company role determines your visibility and weighting in reports
              </p>
            </div>
          )}

          {isEditing ? (
            <div className="flex flex-col gap-2 md:flex-row md:gap-3">
              <button type="submit" className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg border-none cursor-pointer transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-3 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed">
                Save Changes
              </button>
              <button
                type="button"
                className="w-full px-6 py-3 bg-transparent text-gray-700 font-medium rounded-lg border border-gray-300 cursor-pointer transition-all duration-200 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-3 focus:ring-gray-300"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg border-none cursor-pointer transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-3 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setIsEditing(true)}
            >
              Edit Profile
            </button>
          )}
        </form>
      </div>
    </div>
  );

  const renderConnectionsTab = () => (
    <div className="profile-tab-content">
      <div className="integrations-section">
        <h3>Meeting Integrations</h3>

        <div className="integrations-table-container">
          <div className="hidden md:block">
            <table className="integrations-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="text-center"><span className="text-center">Activity Connect</span></th>
                  <th className="text-center"><span className="text-center">Scheduling</span></th>
                  {user?.company_role && (
                  <th className="text-center"><span className="text-center">Email</span></th>
                  )}
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
                          name="zoom_scheduling"
                          checked={settings.zoom_scheduling}
                          onChange={() =>
                            handleSchedulingToggle(
                              "zoom_scheduling",
                              !settings.zoom_scheduling
                            )
                          }
                          disabled={!settings.use_zoom}
                        />
                        <span className="toggle-slider"></span>
                      </div>
                    </label>
                  </td>
                  {user?.company_role && (
                  <td></td>
                  )}
                </tr>

                <tr>
                  <td>Microsoft Teams</td>
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
                          name="teams_scheduling"
                          checked={settings.teams_scheduling}
                          onChange={() =>
                            handleSchedulingToggle(
                              "teams_scheduling",
                              !settings.teams_scheduling
                            )
                          }
                          disabled={!settings.use_teams}
                        />
                        <span className="toggle-slider"></span>
                      </div>
                    </label>
                  </td>
                  {user?.company_role && (
                  <td>
                    <label className="toggle-label">
                      <div className="toggle-switch">
                        <input
                          type="checkbox"
                          name="email_processing"
                          checked={settings.email_processing}
                          onChange={() => {
                            if (!settings.use_teams) return;
                            if (!settings.email_processing) {
                              conectOutlookUser(false);
                            } else {
                              disconectOutlookUser(false);
                            }
                          }}

                          disabled={!settings.use_teams}
                        />
                        <span className="toggle-slider"></span>
                      </div>
                    </label>
                  </td>
                  )}
                </tr>

                <tr>
                  <td>Google Meet</td>
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
                          name="google_scheduling"
                          checked={settings.google_scheduling}
                          onChange={() =>
                            handleSchedulingToggle(
                              "google_scheduling",
                              !settings.google_scheduling
                            )
                          }
                          disabled={!settings.use_google}
                        />
                        <span className="toggle-slider"></span>
                      </div>
                    </label>
                  </td>
                  {user?.company_role && (
                  <td></td>
                  )}
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
                    <input
                      type="checkbox"
                      name="use_zoom"
                      checked={settings.use_zoom}
                      onChange={() => handlePreferenceToggle("use_zoom")}
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </div>
              <div className="flex flex-col gap-4">
                <label className="toggle-label">
                  <span className="toggle-label-span">Agent</span>
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      name="use_zoom_agent"
                      checked={settings.use_zoom_agent}
                      onChange={() =>
                        handleAgentToggle(
                          "use_zoom_agent",
                          !settings.use_zoom_agent
                        )
                      }
                      disabled={!settings.use_zoom}
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </div>
              <div className="flex flex-col gap-4">
                <label className="toggle-label">
                  <span className="toggle-label-span">Scheduling</span>
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      name="zoom_scheduling"
                      checked={settings.zoom_scheduling}
                      onChange={() =>
                        handleSchedulingToggle(
                          "zoom_scheduling",
                          !settings.zoom_scheduling
                        )
                      }
                      disabled={!settings.use_zoom}
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex flex-col integrations-item">
              <h3>Microsoft Teams</h3>
              <div className="flex flex-col gap-4">
                <label className="toggle-label">
                  <span className="toggle-label-span">Connected</span>
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
              </div>
              <div className="flex flex-col gap-4">
                <label className="toggle-label">
                  <span className="toggle-label-span">Agent</span>
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      name="use_teams_agent"
                      checked={settings.use_teams_agent}
                      onChange={() =>
                        handleAgentToggle(
                          "use_teams_agent",
                          !settings.use_teams_agent
                        )
                      }
                      disabled={!settings.use_teams}
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </div>
              <div className="flex flex-col gap-4">
                <label className="toggle-label">
                  <span className="toggle-label-span">Scheduling</span>
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      name="teams_scheduling"
                      checked={settings.teams_scheduling}
                      onChange={() =>
                        handleSchedulingToggle(
                          "teams_scheduling",
                          !settings.teams_scheduling
                        )
                      }
                      disabled={!settings.use_teams}
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </div>
              {user?.company_role && (
              <div className="flex flex-col gap-4">
                <label className="toggle-label">
                  <span className="toggle-label-span">Email</span>
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      name="email_processing"
                      checked={settings.email_processing}
                      onChange={() => {
                        if (!settings.email_processing) {
                          conectOutlookUser(false);
                        } else {
                          disconectOutlookUser(false);
                        }
                      }
                      }
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </div>
               )} 
            </div>

            
            <div className="flex flex-col integrations-item">
              <h3>Google Meet</h3>
              <div className="flex flex-col gap-4">
                <label className="toggle-label">
                  <span className="toggle-label-span">Connected</span>
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
                <label className="toggle-label">
                  <span className="toggle-label-span">Agent</span>
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      name="use_google_agent"
                      checked={settings.use_google_agent}
                      onChange={() =>
                        handleAgentToggle(
                          "use_google_agent",
                          !settings.use_google_agent
                        )
                      }
                      disabled={!settings.use_google}
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
                <label className="toggle-label">
                  <span className="toggle-label-span">Scheduling</span>
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      name="google_scheduling"
                      checked={settings.google_scheduling}
                      onChange={() =>
                        handleSchedulingToggle(
                          "google_scheduling",
                          !settings.google_scheduling
                        )
                      }
                      disabled={!settings.use_google}
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {settings.use_zoom && (
          <div className="connection-section mt-6">
            <h3>Zoom - {zoom_user}</h3>
            <p className="connection-description">
              Retrieve Zoom Meet activities info from the past period and
              store it in the database.
            </p>
            <button
              className="primary-button mt-4"
              onClick={() => retrieveZoomMeetingsInfo()}
            >
              Retrieve Zoom activities info
            </button>
          </div>
        )}

        {settings.use_teams && (
          <div className="connection-section mt-6">
            <h3>Teams - {teams_user}</h3>
            <p className="connection-description">
              Retrieve Teams Meet activities info from the past period and
              store it in the database.
            </p>
            <button
              className="primary-button mt-4"
              onClick={() => retrieveTeamsMeetingsInfo()}
            >
              Retrieve Teams activities info
            </button>
          </div>
        )}

        {settings.use_google && (
          <div className="connection-section mt-6">
            <h3>Google Meet - {google_user}</h3>
            <p className="connection-description">
              Retrieve Google Meet activities info from the past period and
              store it in the database.
            </p>
            <button
              className="primary-button mt-4"
              onClick={retrieveGoogleMeetingsInfo}
            >
              Retrieve Google activities info
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderMyAgentTab = () => {
    const handleSaveAgent = async () => {
      try {
        const voiceToSet = selectedVoice ? selectedVoice.voice_id : agentVoice;

        const formData = new FormData();

        if (agentName.trim()) {
          formData.append('name', agentName.trim());
        }

        if (voiceToSet) {
          formData.append('voice', voiceToSet);
        }

        if (agentPfpFile) {
          formData.append('profilePicture', agentPfpFile);
        }

        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/agent/update`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        if (response.data.success) {
          if (response.data.profilePictureUrl) {
            setAgentPfp(response.data.profilePictureUrl);
          }
          setAgentVoice(voiceToSet);

          setAgentData({
            myagent_name: agentName.trim(),
            myagent_voice_id: voiceToSet,
            myagent_profile_picture: response.data.profilePictureUrl || agentPfp
          });

          toast.success('Agent updated successfully!');
        } else {
          throw new Error(response.data.error || 'Failed to update agent');
        }

        setIsAgentModalOpen(false);
        setAgentPfpFile(null);
        setAgentPfpPreview(null);
        setSelectedVoice(null);

      } catch (error) {
        console.error('Error updating agent:', error);
        toast.error(error.response?.data?.error || 'Failed to update agent');
      }
    };

    const handleProfilePictureChange = (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error('File size must be less than 5MB');
          return;
        }

        if (!file.type.startsWith('image/')) {
          toast.error('Please select an image file');
          return;
        }

        setAgentPfpFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
          setAgentPfpPreview(e.target.result);
        };
        reader.readAsDataURL(file);
      }
    };

    const TestMyAgentModal = () => {
      const [agentIntro, setAgentIntro] = useState("");
      const [meetingTopic, setMeetingTopic] = useState("");
      const [meetingLink, setMeetingLink] = useState("");
      const [selectedMeeting, setSelectedMeeting] = useState(null);
      const [upcomingMeetings, setUpcomingMeetings] = useState([]);
      const [isLoading, setIsLoading] = useState(false);
      const [isLoadingMeetings, setIsLoadingMeetings] = useState(false);
      const [useDirectLink, setUseDirectLink] = useState(false);

      const handleIntroChange = (e) => {
        setAgentIntro(e.target.value);
      };

      const handleMeetingTopicChange = (e) => {
        setMeetingTopic(e.target.value);
      };

      const handleMeetingLinkChange = (e) => {
        setMeetingLink(e.target.value);
      };

      const fetchUpcomingMeetings = async () => {
        setIsLoadingMeetings(true);
        try {
          const token = localStorage.getItem("token");
          const response = await axios.post(
            `${process.env.REACT_APP_API_URL}/meeting/todays-schedule`,
            {
              time: new Date().toLocaleString(),
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (response.data.success) {
            setUpcomingMeetings(response.data.meetings || []);
          }
        } catch (error) {
          console.error("Failed to fetch upcoming meetings:", error);
          toast.error("Failed to fetch upcoming meetings");
        } finally {
          setIsLoadingMeetings(false);
        }
      };

      const handleSubmit = async (e) => {
        e.preventDefault();

        if (meetingTopic.trim() === "") {
          toast.error("Please enter a meeting topic");
          return;
        }

        if (useDirectLink) {
          if (!meetingLink.trim()) {
            toast.error("Please enter a meeting link");
            return;
          }
        } else {
          if (!selectedMeeting) {
            toast.error("Please select a meeting");
            return;
          }
        }



        setIsLoading(true);
        try {
          if (useDirectLink) {
            await testMyAgent(agentIntro, meetingTopic, null, meetingLink);
          } else {
            await testMyAgent(agentIntro, meetingTopic, selectedMeeting.id);
          }
        } finally {
          setIsLoading(false);
        }
      };

      // Fetch meetings when modal opens
      React.useEffect(() => {
        if (isTestModalOpen) {
          fetchUpcomingMeetings();
        }
      }, [isTestModalOpen]);

      return (
        <div className="fixed inset-0 bg-[#0007] flex items-center justify-center z-[67676767]">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Test My Agent
              </h3>
              <button
                onClick={() => setIsTestModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl cursor-pointer"
                disabled={isLoading}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Meeting Topic
                </label>
                <textarea
                  value={meetingTopic}
                  onChange={handleMeetingTopicChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter meeting topic"
                  disabled={isLoading}
                />
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Agent Introduction
                </label>
                <textarea
                  value={agentIntro}
                  onChange={handleIntroChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                  placeholder={`Hello everyone! I'm ${agentName || 'your AI assistant'}, here to help facilitate this meeting.`}
                  rows={3}
                  disabled={isLoading}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Optional: Customize how the agent introduces itself when joining the meeting
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Meeting Selection
                </label>

                <div className="flex gap-4 mb-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="meetingType"
                      checked={!useDirectLink}
                      onChange={() => setUseDirectLink(false)}
                      className="mr-2"
                      disabled={isLoading}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Select from calendar</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="meetingType"
                      checked={useDirectLink}
                      onChange={() => setUseDirectLink(true)}
                      className="mr-2"
                      disabled={isLoading}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Enter meeting link</span>
                  </label>
                </div>

                {useDirectLink ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Meeting Link
                    </label>
                    <input
                      type="url"
                      value={meetingLink}
                      onChange={handleMeetingLinkChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://zoom.us/j/123456789 or https://teams.microsoft.com/l/meetup-join/..."
                      disabled={isLoading}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Enter the meeting link (Zoom, Teams, Google Meet, etc.)
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Upcoming Meeting
                    </label>
                    {isLoadingMeetings ? (
                      <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                        Loading meetings...
                      </div>
                    ) : upcomingMeetings.length > 0 ? (
                      <div className="w-full max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg">
                        {upcomingMeetings.map((meeting) => (
                          <div
                            key={meeting.id}
                            className={`p-3 cursor-pointer transition-colors border-b border-gray-200 dark:border-gray-600 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedMeeting?.id === meeting.id
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500'
                              : ''
                              }`}
                            onClick={() => setSelectedMeeting(meeting)}
                          >
                            <div className="font-medium text-sm text-gray-900 dark:text-white">
                              {meeting.title}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {new Date(meeting.datetime).toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              {meeting.platform || 'Unknown platform'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                        No upcoming meetings found
                      </div>
                    )}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Select a meeting from your calendar to test the agent
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setIsTestModalOpen(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors cursor-pointer"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors font-medium cursor-pointer"
                  disabled={isLoading || (useDirectLink ? !meetingLink.trim() : !selectedMeeting)}
                >
                  {isLoading ? "Testing..." : "Test Agent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    };

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">My Agent</h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
            The MyAgent is your personal business assistant that can run meetings, help answer questions and has the knowledge of the entire companies previous meetings, tasks and research at their finger tip to help you be more successful!
          </p>
        </div>

        {!isAgentModalOpen && (
          <div className="space-y-12">
            {/* Agent Profile Section - Horizontal Layout */}
            <div className="flex items-start gap-12">
              {/* Profile Picture */}
              <div className="flex-shrink-0">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center border-2 border-gray-300 dark:border-gray-600">
                  {agentPfp ? (
                    <img
                      src={agentPfp}
                      alt="Agent Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-gray-500 dark:text-gray-400 text-xl font-bold">
                      {agentName?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                  )}
                </div>
              </div>

              {/* Agent Details */}
              <div className="flex-1 space-y-8">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Name</h4>
                  <p className="text-gray-900 dark:text-white text-lg font-medium">
                    {agentName || 'Not set'}
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Voice</h4>
                  <div className="flex items-center gap-2">
                    <p className="text-gray-900 dark:text-white text-lg">
                      {availableVoices.find(v => v.voice_id === agentVoice)?.name || 'Not set'}
                    </p>
                    {agentVoice && availableVoices.find(v => v.voice_id === agentVoice)?.preview_url && (
                      <button
                        onClick={() => playVoicePreview(availableVoices.find(v => v.voice_id === agentVoice))}
                        className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                      >
                        {(playingPreview === agentVoice && currentAudio && !currentAudio.paused) ? (
                          <Pause className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        ) : (
                          <Play className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Edit and Test Buttons - Side by Side */}
            <div className="pt-4 flex gap-3">
              <button
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium cursor-pointer"
                onClick={() => setIsAgentModalOpen(true)}
              >
                Edit Agent
              </button>
              <button
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium cursor-pointer"
                onClick={() => setIsTestModalOpen(true)}
              >
                Test My Agent
              </button>
            </div>
          </div>
        )}

        {isAgentModalOpen && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">Edit Agent</h4>
              <button
                onClick={() => {
                  setIsAgentModalOpen(false);
                  setAgentPfpFile(null);
                  setAgentPfpPreview(null);
                  setSelectedVoice(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer text-xl"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center border-2 border-gray-300 dark:border-gray-600">
                {agentPfpPreview || agentPfp ? (
                  <img
                    src={agentPfpPreview || agentPfp}
                    alt="Agent Profile Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-gray-500 dark:text-gray-400 text-2xl font-bold">
                    {agentName?.charAt(0)?.toUpperCase() || 'A'}
                  </div>
                )}
              </div>

              <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors">
                Upload Profile Picture
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                />
              </label>
              {agentPfpFile && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  New image selected: {agentPfpFile.name}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter agent name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Voice
                </label>
                <div className="w-full max-h-[400px] overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg">
                  {availableVoices.map((voice) => (
                    <div
                      key={voice.voice_id}
                      className={`p-3 cursor-pointer transition-colors border-b border-gray-200 dark:border-gray-600 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedVoice?.voice_id === voice.voice_id || (!selectedVoice && agentVoice === voice.voice_id)
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500'
                        : ''
                        }`}
                      onClick={() => handleVoiceSelect(voice)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-900 dark:text-white">
                            {voice.name}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {voice.labels?.gender} • {voice.labels?.age} • {voice.labels?.accent}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 line-clamp-2">
                            {voice.description}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playVoicePreview(voice);
                          }}
                          className="ml-2 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                        >
                          {(playingPreview === voice.voice_id && currentAudio && !currentAudio.paused) ? (
                            <Pause className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          ) : (
                            <Play className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-600">
              <button
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                onClick={() => {
                  setIsAgentModalOpen(false);
                  setAgentPfpFile(null);
                  setAgentPfpPreview(null);
                  setSelectedVoice(null);
                }}
              >
                Cancel
              </button>
              <button
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                onClick={handleSaveAgent}
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Test My Agent Modal */}
        {isTestModalOpen && <TestMyAgentModal />}
      </div>
    );
  };

  const renderSecurityTab = () => (
    <div className="profile-tab-content">
      <div className="security-section">
        <h3>Security Settings</h3>
        <div className="security-options">
          <div className="security-option">
            <h4>Password</h4>
            <p>Change your account password</p>
            <button
              className="security-btn"
              onClick={() => setShowPasswordForm(true)}
            >
              Change Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderProfileAvatar = () => (
    <div className="profile-avatar">
      <div className="avatar-image">
        {user?.avatar ? (
          <img
            src={`${process.env.REACT_APP_API_URL}/avatars/${user.avatar}`}
            alt="Profile"
          />
        ) : (
          <div className="avatar-placeholder">
            {user?.name?.charAt(0) || "U"}
          </div>
        )}
      </div>
      <label htmlFor="avatar-upload" className="avatar-upload-button">
        <span className="camera-icon">+</span>
      </label>
      <input
        id="avatar-upload"
        type="file"
        accept="image/*"
        onChange={handleAvatarChange}
        style={{ display: "none" }}
      />
    </div>
  );

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

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

  const handleDeleteConfirm = async () => {
    setIsDeleteModalOpen(false);
    await disconectTemasUse(true);
  };

  const handleDeleteCancel = async () => {
    setIsDeleteModalOpen(false);
    await disconectTemasUse(false);
  };

  const disconectTemasUse = async (isAsmin) => {
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
          teams_scheduling: false,
          email_processing:false,
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
      setSettings((prev) => ({
        ...prev,
        use_teams: true,
      }));
    }
  }

  const handleLinkedInSubmit = async (e) => {
    e.preventDefault();

    const linkedInPattern = /^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?$/;
    if (!linkedInPattern.test(linkedInUrl)) {
      toast.error('Please enter a valid LinkedIn profile URL');
      return;
    }

    setIsLinkedInLoading(true);

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/users/update-linkedin`, {
        linkedInUrl: linkedInUrl
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.data.success) {
        await fetchUserData();
        toast.success('Profile updated with LinkedIn data!');
        setIsLinkedInModalOpen(false);
      } else {
        toast.error('Failed to save LinkedIn URL');
      }

      setIsLinkedInModalOpen(false);

    } catch (error) {
      console.error('Error saving LinkedIn URL:', error);
      toast.error('Failed to save LinkedIn URL');
    } finally {
      setIsLinkedInLoading(false);
    }
  };


  const fetchAgentData = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/agent/profile`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        const agent = response.data.agent;
        setAgentData(agent);
        setAgentName(agent.myagent_name || '');
        setAgentVoice(agent.myagent_voice_id || '');
        setAgentPfp(agent.myagent_profile_picture || '');
      }
    } catch (error) {
      console.error('Error fetching agent data:', error);
    }
  };

  return (
    <div className="page-container flex flex-col h-screen">
      <Navbar isAuthenticated={true} user={user} />
      <div className="w-full overflow-auto flex-1">
        <div className="profile-container overflow-auto">
          <div className="profile-header flex justify-between">
            <div className="profile-header-content">
              {renderProfileAvatar()}
              <div className="profile-title">
                <h1>{user?.name}</h1>
                <p>{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className={`text-white rounded-full w-10 h-10 flex items-center justify-center cursor-pointer  transition-colors ${user?.linkedin_url ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'}`}
                onClick={() => setIsLinkedInModalOpen(true)}
              >
                <FaLinkedin className="text-white text-2xl" />
              </button>
              <p className="text-sm">{user?.linkedin_url ? 'LinkedIn Synced' : 'Sync LinkedIn'}</p>
            </div>
          </div>

          {successMessage && (
            <div className="success-message">{successMessage}</div>
          )}

          <div className="profile-content">
            <div className="profile-tabs">
              <button
                className={`tab-button ${activeTab === "general" ? "active" : ""
                  }`}
                onClick={() => {
                  setActiveTab("general");
                  setSearchParams((prev) => ({
                    tab: "general",
                  }));
                }}
              >
                General
              </button>
              <button
                className={`tab-button ${activeTab === "security" ? "active" : ""
                  }`}
                onClick={() => {
                  setActiveTab("security");
                  setSearchParams((prev) => ({
                    tab: "security",
                  }));
                }}
              >
                Security
              </button>
              <button
                className={`tab-button ${activeTab === "connections" ? "active" : ""
                  }`}
                onClick={() => {
                  setActiveTab("connections");
                  setSearchParams((prev) => ({
                    tab: "connections",
                  }));
                }}
              >
                Connections
              </button>
              <button
                className={`tab-button ${activeTab === "my-agent" ? "active" : ""
                  }`}
                onClick={() => {
                  setActiveTab("my-agent");
                  setSearchParams((prev) => ({
                    tab: "my-agent",
                  }));
                }}
              >
                My Agent
              </button>
            </div>

            <div className="tab-content">
              {activeTab === "general" && renderGeneralTab()}
              {activeTab === "security" && renderSecurityTab()}
              {activeTab === "connections" && renderConnectionsTab()}
              {activeTab === "my-agent" && renderMyAgentTab()}
            </div>
          </div>

          {showPasswordForm && (
            <div className="modal-overlay">
              <div className="modal-content">
                <ChangePasswordForm
                  onSuccess={handlePasswordChange}
                  onCancel={() => setShowPasswordForm(false)}
                  user={user}
                />
              </div>
            </div>
          )}
        </div>

        {isDeleteModalOpen && (
          <DeleteConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={handleDeleteCancel}
            onConfirm={handleDeleteConfirm}
            taskTitle={"Do you want to delete the enterprise application?"}
            taskSubTitle={"This will disconnect Teams for all users in your organization."}
          />
        )}
      </div>
      <Footer />
      {showMeetingsModal && (
        <MeetingsModal
          showMeetingsModal={showMeetingsModal}
          setShowMeetingsModal={setShowMeetingsModal}
          meetingsList={meetingsList}
          isLoading={isRetrievingMeetings}
          onRetrieve={(selectedMeetingList, type) => {
            setRetrievedMeetings(selectedMeetingList, type);
          }}
        />
      )}

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

      {isLinkedInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0004]">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <FaLinkedin className="text-blue-600" />
                Add LinkedIn Profile
              </h3>
              <button
                onClick={() => {
                  setIsLinkedInModalOpen(false);
                  setLinkedInUrl('');
                }}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleLinkedInSubmit}>
              <div className="mb-4">
                <label htmlFor="linkedinUrl" className="block text-sm font-medium text-gray-700 mb-2">
                  LinkedIn Profile URL
                </label>
                <input
                  type="url"
                  id="linkedinUrl"
                  value={linkedInUrl}
                  onChange={(e) => setLinkedInUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/in/your-profile"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsLinkedInModalOpen(false);
                    setLinkedInUrl('');
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  {isLinkedInLoading ? 'Syncing...' : 'Sync with LinkedIn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;
