const pool = require("../config/database");
const User = require("../models/User");
const TeamsUser = require("../models/TeamsUser");
const dotenv = require("dotenv");
const { Client } = require("@microsoft/microsoft-graph-client");
const Subscription = require("../models/HookSubscription");
const { v4: uuidv4 } = require("uuid");

dotenv.config();

const connectOutlook = async (req, res) => {
  try {
    const user_id = req.user?.id;
    const teams_user = await TeamsUser.findByUserId(user_id);
    if (!teams_user) {
      return res.status(404).json({ error: "Teams user not found." });
    }

    const updatedUser = await pool.query(
      `UPDATE teams_users
             SET is_outlook_connected = true,
             outlook_created_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
      [teams_user.id]
    );
    createSubscriptionForEmail(user_id);
    res.status(200).json({
      message: "Outlook connected successfully",
      user: updatedUser.rows[0],
    });
  } catch (error) {
    console.error("Outlook activation error:", error);
    res.status(500).json({ error: "Failed to activate Outlook" });
  }
}

const disconnectOutlook = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("Disconnecting Outlook for user:", userId);
    const teams_user = await TeamsUser.findByUserId(userId);
    if (!teams_user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update the database
    const updatedUser = await pool.query(
      `UPDATE teams_users
       SET is_outlook_connected = false,
           outlook_created_at = NULL
       WHERE id = $1
       RETURNING *`,
      [teams_user.id]
    );

    if (!updatedUser.rows.length) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Outlook disconnected successfully",
      user: updatedUser.rows[0],
    });
  } catch (error) {
    console.error("Error disconnecting Outlook:", error);
    res.status(500).json({
      success: false,
      error: "Failed to disconnect Outlook",
    });
  }
};
async function createSubscriptionForEmail(user_id) {
  try {
    // Initialize Microsoft Graph client
    const teamsUser = await TeamsUser.findByUserId(user_id);
    if (!teamsUser || teamsUser.is_outlook_connected != true) {
      console.log("User not connected to Outlook");
      return;
    }
    const webhookUrl = `${process.env.API_BASE_URL}/api/teams/handleEmailWebhook`;
    const client = Client.init({
      authProvider: (done) => done(null, teamsUser.teams_access_token),
    });
    const subscriptions = await client.api("/subscriptions").get();
    const subscriptionDataList = subscriptions.value;
    const matchingSubscriptions = subscriptionDataList.filter(sub => sub.notificationUrl === webhookUrl);
    for (const sub of matchingSubscriptions) {
      if (sub.resource && (sub.resource == "/me/messages" || sub.resource == "/me/mailFolders('sentitems')/messages")) {
        await client.api(`/subscriptions/${sub.id}`).delete();
      }
    }

    const resources = [
      "/me/messages",     // For received emails
      "/me/mailFolders('sentitems')/messages"  // For sent emails
    ];

    let lastSubscription = null;

    // Create subscription for each folder
    for (const resource of resources) {
      const subscriptionData = {
        changeType: "created",
        notificationUrl: `${process.env.API_BASE_URL}/api/teams/handleEmailWebhook`,
        resource: resource,
        expirationDateTime: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 72 hours
        clientState: uuidv4(),
      };
      console.log("Subscription data:", subscriptionData);

      // Create subscription via Graph API
      const subscription = await client.api("/subscriptions").post(subscriptionData);

      if (!subscription.id) {
        console.log("Failed to create email subscription");
        continue;
      }
      if (subscription.id) {
        await Subscription.create({
          subscription_id: subscription.id,
          user_id: user_id,
          type: "schedule/outlook",
        });
      }
      lastSubscription = subscription;
    }

    console.log("All subscriptions created successfully.");
    return lastSubscription; // Return after the loop
  } catch (error) {
    console.error("Error creating email subscription:", error.response?.data || error.message);
    return;
  }
}


module.exports = {
  connectOutlook,
  disconnectOutlook
}