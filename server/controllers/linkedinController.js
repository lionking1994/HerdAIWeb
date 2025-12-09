const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/User");
const LinkedinUser = require("../models/LinkedinUser");
const pool = require("../config/database");

// Refresh LinkedIn token
const refreshLinkedinToken = async (refresh_token) => {
  try {
    const response = await axios.post(process.env.LINKEDIN_OAUTH_ENDPOINT, {
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      refresh_token: refresh_token,
      grant_type: "refresh_token",
    });

    const { access_token, expires_in } = response.data;
    
    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

    return { access_token, expires_at: expiresAt };
  } catch (error) {
    console.error(
      "Error refreshing LinkedIn access token:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Handle LinkedIn API calls with token refresh if needed
const handleLinkedinApiCall = async (apiCall, linkedinUser) => {
  try {
    return await apiCall(linkedinUser?.linkedin_access_token);
  } catch (error) {
    if (error.response?.status === 401) {
      // Token expired, refresh it
      const { access_token, expires_at } = await refreshLinkedinToken(linkedinUser.linkedin_refresh_token);

      // Update tokens in database
      await LinkedinUser.update({
        ...linkedinUser,
        linkedin_access_token: access_token,
        expires_at: expires_at
      });

      // Retry the request with new token
      return await apiCall(access_token);
    }
    throw error;
  }
};

// Get LinkedIn authentication URL
exports.getLinkedinAuth = async (req, res) => {
  try {
    const state = uuidv4();
    const redirectUri = `${process.env.FRONTEND_URL}/linkedin-callback`;
    
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${
      process.env.LINKEDIN_CLIENT_ID
    }&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&state=${state}&scope=r_liteprofile%20r_emailaddress%20w_member_social`;
    
    res.redirect(authUrl);
  } catch (error) {
    console.error("LinkedIn auth error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to initiate LinkedIn authentication",
    });
  }
};

// Handle LinkedIn callback
exports.handleLinkedinCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    const userId = req.user.id;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: "Authorization code is missing",
      });
    }

    const redirectUri = `${process.env.FRONTEND_URL}/linkedin-callback`;
    
    // Exchange code for tokens
    const tokenResponse = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      null,
      {
        params: {
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: process.env.LINKEDIN_CLIENT_ID,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET,
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    
    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

    // Get user profile
    const profileResponse = await axios.get(
      "https://api.linkedin.com/v2/me",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    const profile = profileResponse.data;
    
    // Get user email
    const emailResponse = await axios.get(
      "https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    const email = emailResponse.data.elements[0]["handle~"].emailAddress;
    
    // Create or update LinkedIn user
    const linkedinUserData = {
      account_id: profile.id,
      name: `${profile.localizedFirstName} ${profile.localizedLastName}`,
      email: email,
      user_id: userId,
      linkedin_access_token: access_token,
      linkedin_refresh_token: refresh_token,
      profile_url: `https://www.linkedin.com/in/${profile.vanityName || profile.id}`,
      expires_at: expiresAt
    };

    await LinkedinUser.create(linkedinUserData);
    
    // Import LinkedIn data (work history, education, skills, projects)
    await importLinkedinData(access_token, userId);

    res.redirect(`${process.env.FRONTEND_URL}/profile?tab=connections&success=true&provider=linkedin`);
  } catch (error) {
    console.error("LinkedIn callback error:", error);
    res.redirect(`${process.env.FRONTEND_URL}/profile?tab=connections&success=false&provider=linkedin`);
  }
};

// Import LinkedIn data
const importLinkedinData = async (accessToken, userId) => {
  try {
    // Get work experience
    const workResponse = await axios.get(
      "https://api.linkedin.com/v2/positions?q=members&projection=(elements*(title,company,location,dates,description))",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // Get education
    const educationResponse = await axios.get(
      "https://api.linkedin.com/v2/educations?q=members&projection=(elements*(schoolName,degree,fieldOfStudy,dates,description))",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // Get skills
    const skillsResponse = await axios.get(
      "https://api.linkedin.com/v2/skills?q=members&projection=(elements*(name,proficiency))",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // Get projects
    const projectsResponse = await axios.get(
      "https://api.linkedin.com/v2/projects?q=members&projection=(elements*(title,description,url,dates))",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // Store the data in the database
    await pool.query(
      `INSERT INTO user_linkedin_data (
        user_id, 
        work_history, 
        education, 
        skills, 
        projects, 
        created_at, 
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        work_history = $2, 
        education = $3, 
        skills = $4, 
        projects = $5, 
        updated_at = $7`,
      [
        userId,
        JSON.stringify(workResponse.data.elements || []),
        JSON.stringify(educationResponse.data.elements || []),
        JSON.stringify(skillsResponse.data.elements || []),
        JSON.stringify(projectsResponse.data.elements || []),
        new Date(),
        new Date()
      ]
    );
  } catch (error) {
    console.error("Error importing LinkedIn data:", error);
    // Continue even if data import fails
  }
};

// Disconnect LinkedIn
exports.disconnect = async (req, res) => {
  try {
    const userId = req.user.id;
    
    await LinkedinUser.disconnect(userId);
    
    res.json({
      success: true,
      message: "LinkedIn disconnected successfully",
    });
  } catch (error) {
    console.error("LinkedIn disconnect error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to disconnect LinkedIn",
    });
  }
};

// Get LinkedIn profile data
exports.getProfileData = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get LinkedIn user
    const linkedinUser = await LinkedinUser.findByUserId(userId);
    
    if (!linkedinUser) {
      return res.status(404).json({
        success: false,
        message: "No LinkedIn connection found for this user",
      });
    }
    
    // Get LinkedIn data
    const { rows } = await pool.query(
      `SELECT * FROM user_linkedin_data WHERE user_id = $1`,
      [userId]
    );
    
    const linkedinData = rows[0] || {
      work_history: [],
      education: [],
      skills: [],
      projects: []
    };
    
    res.json({
      success: true,
      data: {
        profile: {
          name: linkedinUser.name,
          email: linkedinUser.email,
          profileUrl: linkedinUser.profile_url
        },
        workHistory: JSON.parse(linkedinData.work_history || '[]'),
        education: JSON.parse(linkedinData.education || '[]'),
        skills: JSON.parse(linkedinData.skills || '[]'),
        projects: JSON.parse(linkedinData.projects || '[]')
      }
    });
  } catch (error) {
    console.error("Error getting LinkedIn profile data:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get LinkedIn profile data",
    });
  }
};

