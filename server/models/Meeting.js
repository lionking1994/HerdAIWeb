const pool = require("../config/database");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

class Meeting {
  static async create(meetingData) {
    const {
      meeting_id,
      title,
      datetime,
      duration,
      joinUrl,
      teams_id,
      summary,
      description,
      org_id,
      status,
      platform,
      transcription_link,
      record_link,
      report_id,
      schedule_datetime,
      schedule_duration,
      event_id,
      occurrence_Id
    } = meetingData;

    const result = await pool.query(
      `INSERT INTO meetings (
                meeting_id, title, datetime, duration, join_url, teams_id, 
                summary, description, org_id, status, platform, 
                transcription_link, record_link, report_id, schedule_datetime, schedule_duration, event_id, occurrence_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
      [
        meeting_id,
        title,
        datetime,
        duration,
        joinUrl,
        teams_id,
        summary,
        description,
        org_id,
        status,
        platform,
        transcription_link,
        record_link,
        report_id,
        schedule_datetime || datetime,
        schedule_duration || duration,
        event_id || null,
        occurrence_Id || null
      ]
    );

    return result.rows[0];
  }
  static async update(meetingData) {
    const {
      // title,
      datetime,
      duration,
      // joinUrl,
      id,
      // teams_id,
      summary,
      org_id,
      // status,
      // platform,
      transcription_link,
      meeting_id,
      // recordLink
      report_id,
      schedule_datetime,
      schedule_duration
    } = meetingData;

    const result = await pool.query(
      `UPDATE meetings SET datetime=$1, duration=$2, summary = $3, org_id = $4, transcription_link = $5, meeting_id=$6, report_id=$7, schedule_datetime=$8, schedule_duration=$9 WHERE id = $10`,
      [
        // title,
        datetime,
        duration,
        // joinUrl,
        // teams_id,
        summary,
        org_id,
        // status,
        // platform,
        transcription_link,
        meeting_id,
        // recordLink,
        report_id,
        schedule_datetime,
        schedule_duration,
        id,
      ]
    );

    return result;
  }
  static async updateInTeams(meetingData) {
    const {
      // title,
      // datetime,
      // duration,
      // joinUrl,
      id,
      // teams_id,
      summary,
      org_id,
      // status,
      // platform,
      transcription_link,
      // recordLink
      report_id
    } = meetingData;

    const result = await pool.query(
      `UPDATE meetings SET summary = $1, org_id = $2, transcription_link = $3, report_id = $4 WHERE id = $5`,
      [
        // title,
        // datetime,
        // duration,
        // joinUrl,
        // teams_id,
        summary,
        org_id,
        // status,
        // platform,
        transcription_link,
        // recordLink,
        report_id || null,
        id,
      ]
    );

    return result;
  }

  static async updateInTeamsMeeting(meetingData) {
    const {
      id,
      title,
      description,
      datetime,
      duration,
      org_id,
      schedule_datetime,
      schedule_duration,
      status,
      event_id,
      updated_at,
      joinUrl,
      occurrence_Id
    } = meetingData;

    const result = await pool.query(
      `UPDATE meetings 
     SET title = $1, 
         description = $2, 
         datetime = $3, 
         duration = $4, 
         org_id = $5, 
         schedule_datetime = $6, 
         schedule_duration = $7, 
         status = $8 ,
         event_id = $9,
         updated_at = $10,
         join_url = $11,
         occurrence_id = $12
     WHERE id = $13`,
      [
        title,
        description,
        datetime,
        duration,
        org_id,
        schedule_datetime || datetime,
        schedule_duration || duration,
        status,
        event_id,
        updated_at,
        joinUrl,
        occurrence_Id || null,
        id
      ]
    );

    return result;
  }


  static async updateInGmeet(meetingData) {
    const {
      // title,
      // joinUrl,
      id,
      // teams_id,
      title,
      datetime,
      duration,
      summary,
      org_id,
      description,
      // status,
      // platform,
      transcription_link,
      record_link,
      report_id,
      schedule_datetime,
      schedule_duration,
      sequence
    } = meetingData;
    const result = await pool.query(
      `UPDATE meetings SET summary = $1, org_id = $2, transcription_link = $3, record_link = $4, report_id = $5, datetime = $6, duration = $7, description = $8, schedule_datetime = $9, schedule_duration = $10, sequence = $11, title= $12 WHERE id = $13`,
      [
        // title,
        // joinUrl,
        // teams_id,
        summary,
        org_id,
        // status,
        // platform,
        transcription_link,
        record_link,
        report_id,
        datetime,
        duration,
        description || null,
        schedule_datetime,
        schedule_duration,
        sequence || 0,
        title,
        id,
      ]
    );

    return result;
  }

  static async findByJoinUrl(joinUrl) {
    const result = await pool.query(
      `SELECT * FROM meetings WHERE join_url = $1`,
      [joinUrl]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT * FROM meetings WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  }
  static async findByMeetingId(meetingId) {
    const result = await pool.query(
      `SELECT * FROM meetings WHERE meeting_id = $1 AND isdeleted != true`,
      [meetingId]
    );
    return result.rows[0];
  }

  static async getMeetingParticipants(meetingId) {
    const result = await pool.query(
      `SELECT mp.user_id FROM meeting_participants mp WHERE mp.meeting_id = $1`,
      [meetingId]
    );
    return result.rows.map(row => row.user_id);
  }

  static async findByTeamsId(eventId) {
    const result = await pool.query(
      `SELECT * FROM meetings WHERE teams_id = $1 AND meeting_id IS NULL`,
      [eventId]
    );
    return result.rows[0];
  }
  static async findAll(options = {}) {
    let query = 'SELECT * FROM meetings WHERE isdeleted != true';
    const values = [];

    if (options.where) {
      const conditions = [];
      let paramIndex = 1;

      // Handle meeting_id array condition
      if (options.where.meeting_id) {
        conditions.push(`meeting_id = ANY($${paramIndex})`);
        values.push(options.where.meeting_id);
        paramIndex++;
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
    }

    // Handle specific attributes selection
    if (options.attributes) {
      query = query.replace('*', options.attributes.join(', '));
    }

    const result = await pool.query(query, values);
    return result.rows;
  }
  static async findRelated(title, participants) {
    try {
      const query = `
        WITH similarity_scores AS (
          SELECT 
            m.id,
            m.title,
            m.summary,
            m.datetime,
            m.transcription_link,
            (
              similarity(LOWER(m.title), LOWER($1)) * 0.6 +
              COALESCE(
                (
                  SELECT COUNT(DISTINCT mp_count.user_id)::float /
                  GREATEST(
                    (SELECT COUNT(DISTINCT mp2.user_id)
                    FROM meeting_participants mp2
                    WHERE mp2.meeting_id = m.id),
                    array_length($2::int[], 1)
                  )
                  FROM meeting_participants mp_count
                  WHERE mp_count.meeting_id = m.id
                  AND mp_count.user_id = ANY($2::int[])
                ),
                0
              ) * 0.4
            ) as relevance_score
          FROM meetings m
          WHERE
            m.summary IS NOT NULL
            AND m.summary != ''
            AND m.isdeleted = false
            AND EXISTS (
              SELECT 1
              FROM meeting_participants mp_exists
              WHERE mp_exists.meeting_id = m.id
              AND mp_exists.user_id = ANY($2::int[])
            )
        )
        SELECT
          s.*,
          (
            SELECT json_agg(json_build_object(
              'user_id', u.id,
              'name', u.name,
              'email', u.email,
              'role', mp.role
            ))
            FROM meeting_participants mp
            JOIN users u ON u.id = mp.user_id
            WHERE mp.meeting_id = s.id
          ) as participants,
          (
            SELECT json_agg(json_build_object(
              'id', t.id,
              'title', t.title,
              'status', t.status,
              'assigned_to', json_build_object(
                'id', u.id,
                'name', u.name,
                'email', u.email
              )
            ))
            FROM tasks t
            LEFT JOIN users u ON u.id = t.assigned_id
            WHERE t.meeting_id = s.id
            AND t.isdeleted = false
          ) as tasks
        FROM similarity_scores s
        WHERE relevance_score > 0.2
        ORDER BY relevance_score DESC
        LIMIT 5;
      `;

      const result = await pool.query(query, [
        title,
        participants
      ]);

      return result.rows.map(meeting => ({
        id: meeting.id,
        title: meeting.title,
        summary: meeting.summary,
        datetime: meeting.datetime,
        transcription_link: meeting.transcription_link,
        relevance_score: meeting.relevance_score,
        participants: meeting.participants || [],
        tasks: meeting.tasks || [],
        common_participants: meeting.participants ?
          meeting.participants.filter(p => participants.includes(p.user_id)) :
          []
      }));

    } catch (error) {
      console.error('Error in findRelated:', error);
      throw error;
    }
  }
}

module.exports = Meeting;
