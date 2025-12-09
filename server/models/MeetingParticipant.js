const pool = require("../config/database");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

class MeetingParticipant {
  static async create(meetingParticipantData) {
    const { meetingId, userId, role } = meetingParticipantData;

    // First check if participant already exists
    const existingParticipant = await pool.query(
      "SELECT * FROM meeting_participants WHERE meeting_id = $1 AND user_id = $2",
      [meetingId, userId]
    );

    // If participant already exists, return null or existing record
    if (existingParticipant.rows.length > 0) {
      return null;
    }

    // If no existing participant, proceed with insertion
    const result = await pool.query(
      "INSERT INTO meeting_participants (meeting_id, user_id, role) VALUES ($1, $2, $3) RETURNING *",
      [meetingId, userId, role]
    );

    return result.rows[0];
  }

  static async save(meetingParticipantData) {
    const { meetingId, userId, role } = meetingParticipantData;

    const result = await pool.query(
      "UPDATE meeting_participants SET role = $1 WHERE meeting_id = $2 AND user_id = $3",
      [role, meetingId, userId]
    );

    return result.rows[0];
  }
  static async findByMeetingIdandUserId(meetingId, userId) {
    const result = await pool.query(
      "SELECT * FROM meeting_participants WHERE meeting_id = $1 AND user_id = $2",
      [meetingId, userId]
    );
    return result.rows[0];
  }
}

module.exports = MeetingParticipant;
