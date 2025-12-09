const pool = require('../config/database');


function getUserId(req) {
   return (
      req.user?.userId ||         // if middleware sets `userId`
      req.user?.id ||             // matches your JWT's `id`
      req.headers['x-user-id'] || // fallback from header
      req.query.userId ||         // fallback from query param
      req.body?.userId ||         // fallback from body
      null
   );
}

const generateSummary = async (videoTitle) => {
   try {
      // Mock AI-generated summary
      return `This lesson on "${videoTitle}" covers essential concepts and practical applications. Key learning outcomes include understanding fundamental principles, applying theoretical knowledge to real-world scenarios, and developing critical thinking skills in this subject area.`;
   } catch (error) {
      console.error('Error generating summary:', error);
      throw error;
   }
}

const generateKeyPoints = async () => {
   try {
      // Mock AI-generated key points
      return [
         'Master the fundamental concepts and terminology',
         'Understand the practical applications and use cases',
         'Learn best practices and common pitfalls to avoid',
         'Develop problem-solving skills through examples',
         'Connect theory with real-world implementation'
      ];
   } catch (error) {
      console.error('Error generating key points:', error);
      throw error;
   }
}





async function getDashboardData(req, res) {
   try {
      const userId = getUserId(req); // may be null if guest
      console.log("✅ Resolved userId:", userId);

      const result = await pool.query(
         `SELECT r.company_id, u.company_role, u.role FROM public.users u 
         LEFT JOIN public.company_roles r ON u.company_role = r.id 
         WHERE u.id = $1`,
         [userId]
      );

      let companyId = null;
      let company_role = null;
      let platform_role = null;
      if (result.rows.length > 0) {
         companyId = result.rows[0].company_id;
         company_role = result.rows[0].company_role;
         platform_role = result.rows[0].role;
      }
      if(!platform_role)
         platform_role='user'

      // Always get all published courses
      const { rows: allCourses } = await pool.query(
         `SELECT c.*
         FROM courses c
         LEFT JOIN course_role_restrictions r ON c.id = r.course_id
         WHERE (c.company_id IS NULL OR c.company_id = $1)
            AND c.is_published = true
            AND (
               r.role_id IS NULL
               OR r.role_id = $2
               OR r.role_id = $3
            )
         `,
         [companyId, company_role, platform_role]
      );

      let enrollmentData = [];
      if (userId) {
         const result = await pool.query(
            `SELECT
              ce.*,
              c.id            AS c_id,
              c.title         AS c_title,
              c.description   AS c_description,
              c.thumbnail_url AS c_thumbnail_url,
              c.created_by    AS c_created_by,
              c.created_at    AS c_created_at,
              c.updated_at    AS c_updated_at,
              c.is_published  AS c_is_published,
              c.total_videos  AS c_total_videos,
              c.total_duration AS c_total_duration
             FROM course_enrollments ce
             JOIN courses c ON c.id = ce.course_id
             WHERE ce.user_id = $1
             `,
            //AND ce.progress_percentage < 100
            [userId]
         );
         enrollmentData = result.rows;
      }

      return res.json({
         enrollments: enrollmentData,
         courses: allCourses
      });

   } catch (error) {
      console.error('getDashboardData error', error);
      return res.status(500).json({ message: 'Internal Server Error' });
   }
}



async function searchCourses(req, res) {
   try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      const q = (req.query.q || '').toString().trim();
      if (!q) return res.json([]);

      // Search only in course title and description
      const { rows: courseResults } = await pool.query(
         `SELECT * FROM courses
       WHERE is_published = true
         AND (title ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%')`,
         [q]
      );

      // Return all found courses (no enrollment restriction for search)
      // Users should be able to discover and search all available courses
      const allFoundCourses = courseResults;
      
      // Sort by relevance: exact title matches first, then by title
      allFoundCourses.sort((a, b) => {
         const aExactMatch = a.title.toLowerCase() === q.toLowerCase();
         const bExactMatch = b.title.toLowerCase() === q.toLowerCase();
         
         if (aExactMatch && !bExactMatch) return -1;
         if (!aExactMatch && bExactMatch) return 1;
         
         const aTitleMatch = a.title.toLowerCase().includes(q.toLowerCase());
         const bTitleMatch = b.title.toLowerCase().includes(q.toLowerCase());
         
         if (aTitleMatch && !bTitleMatch) return -1;
         if (!aTitleMatch && bTitleMatch) return 1;
         
         return a.title.localeCompare(b.title);
      });

      return res.json(allFoundCourses);
   } catch (error) {
      console.error('searchCourses error', error);
      return res.status(500).json({ message: 'Internal Server Error' });
   }
}

async function exitCourse(req, res) {
   try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      const { courseId } = req.body || {};
      if (!courseId) return res.status(400).json({ message: 'courseId is required' });

      await pool.query(
         `DELETE FROM course_enrollments WHERE user_id = $1 AND course_id = $2`,
         [userId, courseId]
      );

      await pool.query(
         `DELETE FROM user_progress WHERE user_id = $1 AND course_id = $2`,
         [userId, courseId]
      );

      return res.json({ success: true });
   } catch (error) {
      console.error('exitCourse error', error);
      return res.status(500).json({ message: 'Internal Server Error' });
   }
}

// Provide stubs for legacy routes so Express can register without crashing
function notImplemented(name) {
   return function (req, res) {
      res.status(501).json({ message: `${name} not implemented` });
   };
}

// ===== STUDENT-FACING (PUBLIC) ENDPOINTS =====
async function getPublicCourse(req, res) {
   try {
      const { courseId } = req.params;
      const userId = getUserId(req);

      // Must be published
      const { rows } = await pool.query(
         `SELECT * FROM courses WHERE id = $1 AND is_published = true`,
         [courseId]
      );
      const course = rows[0];
      if (!course) return res.status(404).json({ message: 'Course not found' });

      // Optional access check if user provided
      if (userId) {
         const ac = await pool.query(
            `SELECT user_can_access_course($1::uuid, $2::uuid) AS can`,
            [courseId, userId]
         );
         if (ac.rows?.[0]?.can === false) return res.status(403).json({ message: 'Access denied' });
      }

      return res.json({ course });
   } catch (error) {
      console.error('getPublicCourse error', error);
      return res.status(500).json({ message: 'Internal Server Error' });
   }
}

async function getPublicCourseVideos(req, res) {
   console.log("getPublicCourseVideos api is callsed ----");
   try {
      const { courseId } = req.params;
      const userId = getUserId(req);

      // ensure course is published
      const c = await pool.query(
         `SELECT id FROM courses WHERE id = $1 AND is_published = true`,
         [courseId]
      );
      if (c.rows.length === 0) return res.status(404).json({ message: 'Course not found' });

      if (userId) {
         const ac = await pool.query(
            `SELECT user_can_access_course($1::uuid, $2::uuid) AS can`,
            [courseId, userId]
         );
         if (ac.rows?.[0]?.can === false) return res.status(403).json({ message: 'Access denied' });
      }

      const vids = await pool.query(
         `SELECT * FROM videos WHERE course_id = $1 ORDER BY order_index`,
         [courseId]
      );
      return res.json({ videos: vids.rows });
   } catch (error) {
      console.error('getPublicCourseVideos error', error);
      return res.status(500).json({ message: 'Internal Server Error' });
   }
}

async function getPublicVideoDocuments(req, res) {
   try {
      const { videoId } = req.params;
      const userId = getUserId(req);

      // verify video's course is published
      const vc = await pool.query(
         `SELECT c.id as course_id FROM videos v JOIN courses c ON c.id = v.course_id WHERE v.id = $1 AND c.is_published = true`,
         [videoId]
      );
      const courseId = vc.rows?.[0]?.course_id;
      if (!courseId) return res.status(404).json({ message: 'Video not found' });

      if (userId) {
         const ac = await pool.query(
            `SELECT user_can_access_course($1::uuid, $2::uuid) AS can`,
            [courseId, userId]
         );
         if (ac.rows?.[0]?.can === false) return res.status(403).json({ message: 'Access denied' });
      }

      const docs = await pool.query(
         `SELECT * FROM video_documents WHERE video_id = $1 ORDER BY order_index`,
         [videoId]
      );
      return res.json({ documents: docs.rows });
   } catch (error) {
      console.error('getPublicVideoDocuments error', error);
      return res.status(500).json({ message: 'Internal Server Error' });
   }
}

async function enrollInCourse(req, res) {
   try {
      const userId = getUserId(req) || req.user?.id || req.user?.userId;
      const { courseId } = req.body || {};
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      if (!courseId) return res.status(400).json({ message: 'courseId is required' });

      // ensure course is published
      const c = await pool.query(`SELECT id FROM courses WHERE id = $1 AND is_published = true`, [courseId]);
      if (c.rows.length === 0) return res.status(404).json({ message: 'Course not found' });

      // upsert enrollment
      const ins = await pool.query(
         `INSERT INTO course_enrollments (user_id, course_id, progress_percentage, enrolled_at)
          VALUES ($1, $2, 0, NOW())
          ON CONFLICT (user_id, course_id) DO UPDATE SET enrolled_at = EXCLUDED.enrolled_at
          RETURNING *`,
         [userId, courseId]
      );
      return res.status(201).json({ enrollment: ins.rows[0] });
   } catch (error) {
      console.error('enrollInCourse error', error);
      return res.status(500).json({ message: 'Internal Server Error' });
   }
}

async function upsertProgress(req, res) {
   try {
      const userId = getUserId(req) || req.user?.id || req.user?.userId;
      const { courseId, videoId, watchTime, watch_time, completed, quiz_score } = req.body || {};
      // Handle both camelCase and snake_case for backward compatibility
      const finalWatchTime = watchTime !== undefined ? watchTime : watch_time;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      if (!courseId || !videoId) return res.status(400).json({ message: 'courseId and videoId are required' });

      console.log('📥 Backend: Received progress update:', {
         userId,
         courseId,
         videoId,
         watchTime,
         watch_time,
         finalWatchTime,
         completed,
         quiz_score,
         watchTimeType: typeof finalWatchTime,
         completedType: typeof completed
      });

      // upsert per-video progress
      const sanitizedWatchTime = (typeof finalWatchTime === 'number' && !isNaN(finalWatchTime)) ? finalWatchTime : 0;
      const sanitizedCompleted = !!completed;
      
      console.log('💾 Backend: Sanitized values:', {
         original_watch_time: finalWatchTime,
         sanitized_watch_time: sanitizedWatchTime,
         original_completed: completed,
         sanitized_completed: sanitizedCompleted
      });
      
      const queryResult = await pool.query(
         `INSERT INTO user_progress (user_id, course_id, video_id, watch_time, completed, quiz_score, last_watched_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          ON CONFLICT (user_id, course_id, video_id)
          DO UPDATE SET watch_time = EXCLUDED.watch_time, completed = EXCLUDED.completed, quiz_score = EXCLUDED.quiz_score, last_watched_at = NOW()
          RETURNING *`,
         [userId, courseId, videoId, sanitizedWatchTime, sanitizedCompleted, quiz_score ?? null]
      );

      console.log('💾 Backend: Progress saved to DB:', queryResult.rows[0]);

      // recompute enrollment progress percentage
      const totals = await pool.query(`SELECT COUNT(*)::int as total FROM videos WHERE course_id = $1`, [courseId]);
      const done = await pool.query(
         `SELECT COUNT(*)::int as completed FROM user_progress WHERE user_id = $1 AND course_id = $2 AND completed = true`,
         [userId, courseId]
      );
      const total = totals.rows[0]?.total || 0;
      const comp = done.rows[0]?.completed || 0;
      const pct = total > 0 ? Math.round((comp / total) * 100) : 0;
      await pool.query(
         `UPDATE course_enrollments SET progress_percentage = $1 WHERE user_id = $2 AND course_id = $3`,
         [pct, userId, courseId]
      );

      return res.json({ success: true, progress_percentage: pct });
   } catch (error) {
      console.error('upsertProgress error', error);
      return res.status(500).json({ message: 'Internal Server Error' });
   }
}

async function getVideoQuiz(req, res) {
   try {
      const { videoId } = req.params;
      const q = await pool.query(`SELECT * FROM quizzes WHERE video_id = $1 ORDER BY created_at DESC LIMIT 1`, [videoId]);
      if (q.rows.length === 0) return res.json({ quiz: null });
      return res.json({ quiz: q.rows[0] });
   } catch (error) {
      console.error('getVideoQuiz error', error);
      return res.status(500).json({ message: 'Internal Server Error' });
   }
}

async function getProgressDashboard(req, res) {
   try {
      const { userId } = req.params;

      if (!userId) {
         return res.status(400).json({ error: 'User ID is required' });
      }

      // Get courses created by the user
      const coursesQuery = `
       SELECT * FROM courses
       WHERE created_by = $1
       ORDER BY created_at DESC
     `;

      const coursesResult = await pool.query(coursesQuery, [userId]);
      const courses = coursesResult.rows;

      if (courses.length === 0) {
         return res.json({
            courses: [],
            enrollments: [],
            stats: {
               totalEnrollments: 0,
               activeStudents: 0,
               completedCourses: 0,
               averageProgress: 0
            }
         });
      }

      // Get course IDs for enrollments query
      const courseIds = courses.map(c => c.id);
      const placeholders = courseIds.map((_, index) => `$${index + 1}`).join(',');

      // Get enrollments with user and course details
      const enrollmentsQuery = `
       SELECT
         ce.*,
         u.id as user_id,
         u.email,
         u.full_name,
         c.id as course_id,
         c.title as course_title,
         c.description as course_description
       FROM course_enrollments ce
       INNER JOIN users u ON ce.user_id = u.id
       INNER JOIN courses c ON ce.course_id = c.id
       WHERE ce.course_id IN (${placeholders})
       ORDER BY ce.enrolled_at DESC
     `;

      const enrollmentsResult = await pool.query(enrollmentsQuery, courseIds);
      const enrollments = enrollmentsResult.rows;

      // Calculate statistics
      const totalEnrollments = enrollments.length;
      const activeStudents = new Set(enrollments.map(e => e.user_id)).size;
      const completedCourses = enrollments.filter(e => e.completed_at).length;
      const averageProgress = totalEnrollments > 0
         ? Math.round(enrollments.reduce((sum, e) => sum + (e.progress_percentage || 0), 0) / totalEnrollments)
         : 0;

      const stats = {
         totalEnrollments,
         activeStudents,
         completedCourses,
         averageProgress
      };

      // Format enrollments to match the frontend expectations
      const formattedEnrollments = enrollments.map(enrollment => ({
         id: enrollment.id,
         user_id: enrollment.user_id,
         course_id: enrollment.course_id,
         progress_percentage: enrollment.progress_percentage || 0,
         enrolled_at: enrollment.enrolled_at,
         completed_at: enrollment.completed_at,
         users: {
            id: enrollment.user_id,
            email: enrollment.email,
            full_name: enrollment.full_name
         },
         courses: {
            id: enrollment.course_id,
            title: enrollment.course_title,
            description: enrollment.course_description
         }
      }));

      res.json({
         courses,
         enrollments: formattedEnrollments,
         stats
      });

   } catch (error) {
      console.error('Error in getProgressDashboard:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
}

// Get progress data for a specific course
async function getCourseProgress(req, res) {
   try {
      const { courseId } = req.params;

      if (!courseId) {
         return res.status(400).json({ error: 'Course ID is required' });
      }

      const query = `
       SELECT
         ce.*,
         u.id as user_id,
         u.email,
         u.full_name,
         c.id as course_id,
         c.title as course_title
       FROM course_enrollments ce
       INNER JOIN users u ON ce.user_id = u.id
       INNER JOIN courses c ON ce.course_id = c.id
       WHERE ce.course_id = $1
       ORDER BY ce.enrolled_at DESC
     `;

      const result = await pool.query(query, [courseId]);
      const enrollments = result.rows;

      // Calculate course-specific stats
      const totalEnrollments = enrollments.length;
      const activeStudents = new Set(enrollments.map(e => e.user_id)).size;
      const completedCourses = enrollments.filter(e => e.completed_at).length;
      const averageProgress = totalEnrollments > 0
         ? Math.round(enrollments.reduce((sum, e) => sum + (e.progress_percentage || 0), 0) / totalEnrollments)
         : 0;

      const stats = {
         totalEnrollments,
         activeStudents,
         completedCourses,
         averageProgress
      }

      res.json({
         enrollments,
         stats
      });

   } catch (error) {
      console.error('Error in getCourseProgress:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

// Update student progress
async function updateStudentProgress(req, res) {
   try {
      const { enrollmentId } = req.params;
      const { progress_percentage, completed_at } = req.body;

      if (!enrollmentId) {
         return res.status(400).json({ error: 'Enrollment ID is required' });
      }

      // Note: Your table doesn't have updated_at column, so removing it
      const updateQuery = `
       UPDATE course_enrollments
       SET
         progress_percentage = $1,
         completed_at = $2
       WHERE id = $3
       RETURNING *
     `;

      const result = await pool.query(updateQuery, [
         progress_percentage || 0,
         completed_at || null,
         enrollmentId
      ]);

      if (result.rows.length === 0) {
         return res.status(404).json({ error: 'Enrollment not found' });
      }

      res.json({
         message: 'Progress updated successfully',
         enrollment: result.rows[0]
      });

   } catch (error) {
      console.error('Error in updateStudentProgress:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
}

// Get user's enrolled courses
async function getUserEnrollments(req, res) {
   try {
      const { userId } = req.params;

      if (!userId) {
         return res.status(400).json({ error: 'User ID is required' });
      }

      const query = `
       SELECT
         ce.*,
         c.title as course_title,
         c.description as course_description,
         c.created_by
       FROM course_enrollments ce
       INNER JOIN courses c ON ce.course_id = c.id
       WHERE ce.user_id = $1
       ORDER BY ce.enrolled_at DESC
     `;

      const result = await pool.query(query, [userId]);
      const enrollments = result.rows;

      res.json({ enrollments });

   } catch (error) {
      console.error('Error in getUserEnrollments:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
}

// NEW: Get detailed user progress including video progress
async function getUserDetailedProgress(req, res) {
   try {
      const { userId, courseId } = req.params;

      if (!userId || !courseId) {
         return res.status(400).json({ error: 'User ID and Course ID are required' });
      }

      // Get video progress for the user in this course
      const videoProgressQuery = `
       SELECT
         up.*,
         v.title as video_title,
         v.description as video_description,
         v.order_index,
         v.duration
       FROM user_progress up
       INNER JOIN videos v ON up.video_id = v.id
       WHERE up.user_id = $1 AND up.course_id = $2
       ORDER BY v.order_index ASC
     `;

      const videoProgressResult = await pool.query(videoProgressQuery, [userId, courseId]);
      const videoProgress = videoProgressResult.rows;

      // Get course enrollment info
      const enrollmentQuery = `
       SELECT * FROM course_enrollments
       WHERE user_id = $1 AND course_id = $2
     `;

      const enrollmentResult = await pool.query(enrollmentQuery, [userId, courseId]);
      const enrollment = enrollmentResult.rows[0] || null;

      // Get total videos in course
      const totalVideosQuery = `
       SELECT COUNT(*) as total_videos, SUM(duration) as total_duration
       FROM videos
       WHERE course_id = $1
     `;

      const totalVideosResult = await pool.query(totalVideosQuery, [courseId]);
      const { total_videos, total_duration } = totalVideosResult.rows[0];

      // Calculate overall progress
      const completedVideos = videoProgress.filter(vp => vp.completed).length;
      const overallProgress = total_videos > 0 ? Math.round((completedVideos / total_videos) * 100) : 0;

      res.json({
         enrollment,
         videoProgress,
         courseStats: {
            totalVideos: parseInt(total_videos),
            totalDuration: parseInt(total_duration || 0),
            completedVideos,
            overallProgress
         }
      });

   } catch (error) {
      console.error('Error in getUserDetailedProgress:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
}

// NEW: Get course analytics with video-level details
async function getCourseAnalytics(req, res) {
   try {
      const { courseId } = req.params;

      if (!courseId) {
         return res.status(400).json({ error: 'Course ID is required' });
      }

      // Get all videos in the course
      const videosQuery = `
       SELECT * FROM videos
       WHERE course_id = $1
       ORDER BY order_index ASC
     `;

      const videosResult = await pool.query(videosQuery, [courseId]);
      const videos = videosResult.rows;

      // Get enrollment count
      const enrollmentCountQuery = `
       SELECT COUNT(*) as total_enrollments
       FROM course_enrollments
       WHERE course_id = $1
     `;

      const enrollmentCountResult = await pool.query(enrollmentCountQuery, [courseId]);
      const totalEnrollments = parseInt(enrollmentCountResult.rows[0].total_enrollments);

      // Get video completion stats
      const videoStatsQuery = `
       SELECT
         v.id as video_id,
         v.title as video_title,
         COUNT(up.user_id) as total_watchers,
         COUNT(CASE WHEN up.completed = true THEN 1 END) as completed_count,
         AVG(up.watch_time) as avg_watch_time
       FROM videos v
       LEFT JOIN user_progress up ON v.id = up.video_id
       WHERE v.course_id = $1
       GROUP BY v.id, v.title, v.order_index
       ORDER BY v.order_index ASC
     `;

      const videoStatsResult = await pool.query(videoStatsQuery, [courseId]);
      const videoStats = videoStatsResult.rows;

      res.json({
         courseId,
         totalEnrollments,
         totalVideos: videos.length,
         videos,
         videoStats
      });

   } catch (error) {
      console.error('Error in getCourseAnalytics:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
}



// Gauravji's code 
const getAdminCourses = async (req, res) => {
   try {
      const { companyId } = req.query;
      if (companyId && companyId !== 'null') {
         const result = await pool.query(
            'SELECT * FROM courses WHERE company_id = $1 ORDER BY created_at DESC',
            [companyId]
         );
         res.json({ courses: result.rows });
      } else {
         const result = await pool.query(
            'SELECT * FROM courses WHERE company_id IS NULL ORDER BY created_at DESC'
         );
         res.json({ courses: result.rows });
      }

   } catch (error) {
      console.error('Get admin courses error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};


// Get a single course by ID for the authenticated owner
const getAdminCourseById = async (req, res) => {
   try {
      console.log("getAdminCourseById api is callsed ----", req.user);
      const { courseId } = req.params;
      const userId = req.user.id;


      // Verify ownership
      const ownershipResult = await pool.query(
         'SELECT * FROM courses WHERE id = $1 AND created_by = $2',
         [courseId, userId]
      );

      if (ownershipResult.rows.length === 0) {
         return res.status(403).json({ error: 'Access denied' });
      }

      const course = ownershipResult.rows[0];

      // Load role restrictions for this course
      const roleRestrictionsResult = await pool.query(
         `SELECT crr.*, r.name as role_name, r.description as role_description
          FROM course_role_restrictions crr
          JOIN roles r ON r.id = crr.role_id
          WHERE crr.course_id = $1`,
         [courseId]
      );

      return res.json({ course, roles: roleRestrictionsResult.rows });
   } catch (error) {
      console.error('Get admin course by id error:', error);
      return res.status(500).json({ error: 'Internal server error' });
   }
};

// Create new course
const createCourse = async (req, res) => {
   try {
      const { title, description, thumbnail_url, companyId } = req.body;
      const userId = req.user.id;
      const companyIdValue = companyId ?? null;
      const result = await pool.query(
         `INSERT INTO courses (title, description, thumbnail_url, created_by, created_at, updated_at, is_published, total_videos, total_duration, company_id) 
        VALUES ($1, $2, $3, $4, NOW(), NOW(), false, 0, 0, $5) 
        RETURNING *`,
         [title, description, thumbnail_url, userId, companyIdValue]
      );

      res.status(201).json({ course: result.rows[0] });
   } catch (error) {
      console.error('Create course error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

// Update course
const updateCourse = async (req, res) => {
   try {
      const { courseId } = req.params;
      const { title, description, thumbnail_url } = req.body;
      const userId = req.user.id;

      // Check if user owns the course
      const ownershipResult = await pool.query(
         'SELECT id FROM courses WHERE id = $1 AND created_by = $2',
         [courseId, userId]
      );

      if (ownershipResult.rows.length === 0) {
         return res.status(403).json({ error: 'Access denied' });
      }

      const result = await pool.query(
         `UPDATE courses 
        SET title = $1, description = $2, thumbnail_url = $3, updated_at = NOW() 
        WHERE id = $4 
        RETURNING *`,
         [title, description, thumbnail_url, courseId]
      );

      res.json({ course: result.rows[0] });
   } catch (error) {
      console.error('Update course error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};
const deleteCourse = async (req, res) => {
   try {
      const { courseId } = req.params;
      const userId = req.user.id;

      // Check if user owns the course
      const ownershipResult = await pool.query(
         'SELECT id FROM courses WHERE id = $1 AND created_by = $2',
         [courseId, userId]
      );

      // if (ownershipResult.rows.length === 0) {
      //    return res.status(403).json({ error: 'Access denied' });
      // }

      // Delete related records first
      await pool.query('DELETE FROM video_documents WHERE video_id IN (SELECT id FROM videos WHERE course_id = $1)', [courseId]);
      await pool.query('DELETE FROM quizzes WHERE video_id IN (SELECT id FROM videos WHERE course_id = $1)', [courseId]);
      await pool.query('DELETE FROM videos WHERE course_id = $1', [courseId]);
      await pool.query('DELETE FROM course_role_restrictions WHERE course_id = $1', [courseId]);
      await pool.query('DELETE FROM course_enrollments WHERE course_id = $1', [courseId]);

      // Finally delete the course
      await pool.query('DELETE FROM courses WHERE id = $1', [courseId]);

      res.json({ message: 'Course and all related content deleted successfully' });
   } catch (error) {
      console.error('Delete course error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

// Publish course
const publishCourse = async (req, res) => {
   try {
      const { courseId } = req.params;
      const userId = req.user.id;

      console.log("🔍 courseId param:", courseId);
      console.log("🔍 user id:", userId);

      const ownershipResult = await pool.query(
         'SELECT id, created_by FROM courses WHERE id = $1',
         [courseId]
      );
      // Check if user owns the course
      // const ownershipResult = await pool.query(
      //    'SELECT id FROM courses WHERE id = $1 AND created_by = $2',
      //    [courseId, userId]
      // );

      if (ownershipResult.rows.length === 0) {
         return res.status(403).json({ error: 'Access denied' });
      }

      const result = await pool.query(
         'UPDATE courses SET is_published = true, updated_at = NOW() WHERE id = $1 RETURNING *',
         [courseId]
      );

      res.json({ course: result.rows[0] });
   } catch (error) {
      console.error('Publish course error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

// Unpublish course
const unpublishCourse = async (req, res) => {
   try {
      const { courseId } = req.params;
      const userId = req.user.id;

      console.log("🔍 courseId param:", courseId);
      console.log("🔍 user id:", userId);

      const ownershipResult = await pool.query(
         'SELECT id, created_by FROM courses WHERE id = $1',
         [courseId]
      );
      // Check if user owns the course
      // const ownershipResult = await pool.query(
      //    'SELECT id FROM courses WHERE id = $1 AND created_by = $2',
      //    [courseId, userId]
      // );

      if (ownershipResult.rows.length === 0) {
         return res.status(403).json({ error: 'Access denied' });
      }

      const result = await pool.query(
         'UPDATE courses SET is_published = false, updated_at = NOW() WHERE id = $1 RETURNING *',
         [courseId]
      );

      res.json({ course: result.rows[0] });
   } catch (error) {
      console.error('Unpublish course error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

// ===== VIDEO MANAGEMENT =====


const getCourseVideos = async (req, res) => {
   console.log("getCourseVideos api is called ----");
   try {
      const { courseId } = req.params;
      const userId = req.user?.id || req.user?.userId || req.headers['x-user-id'];
      const userRole = req.user?.role || req.headers['x-user-role'] || 'user';

      console.log('userId:', userId);
      console.log('userRole:', userRole);

      // 🚀 Direct access for admin and user roles
      if (userRole === 'cadmin' || userRole === 'user' || userRole === 'padmin') {
         const result = await pool.query(
            'SELECT * FROM videos WHERE course_id = $1 ORDER BY order_index',
            [courseId]
         );
         return res.json({ videos: result.rows });
      }

      // ✅ Owner check
      const ownershipResult = await pool.query(
         'SELECT id FROM courses WHERE id = $1 AND created_by = $2',
         [courseId, userId]
      );

      if (ownershipResult.rows.length === 0) {
         // Not owner; allow if published and user has access
         const pub = await pool.query(
            'SELECT is_published FROM courses WHERE id = $1',
            [courseId]
         );
         const isPublished = pub.rows?.[0]?.is_published === true;
         if (!isPublished) {
            return res.status(403).json({ error: 'Access denied' });
         }

         if (userId) {
            const ac = await pool.query(
               `SELECT user_can_access_course($1::uuid, $2::uuid) AS can`,
               [courseId, userId]
            );
            const can = ac.rows?.[0]?.can === true;
            if (!can) return res.status(403).json({ error: 'Access denied' });
         }
      }

      // ✅ Return videos
      const result = await pool.query(
         'SELECT * FROM videos WHERE course_id = $1 ORDER BY order_index',
         [courseId]
      );

      res.json({ videos: result.rows });

   } catch (error) {
      console.error('Get course videos error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};



// Create video
// const createVideo = async (req, res) => {
//    try {
//       const { courseId } = req.params;
//       const { title, description, video_url, duration } = req.body;
//       // const userId = req.user?.id || req.user?.userId || req.headers['x-user-id'];
//      const userId =  req.user.id;
//      console.log("🔍 userId from create video:", userId);

//       // Check if user owns the course
//       const ownershipResult = await pool.query(
//          'SELECT id FROM courses WHERE id = $1 AND created_by = $2',
//          [courseId, userId]
//       );

//       if (ownershipResult.rows.length === 0) {
//          return res.status(403).json({ error: 'Access denied' });
//       }

//       // Get current video count for order_index
//       const videoCountResult = await pool.query(
//          'SELECT COUNT(*) as count FROM videos WHERE course_id = $1',
//          [courseId]
//       );
//       const orderIndex = videoCountResult.rows[0].count;

//       const result = await pool.query(
//          `INSERT INTO videos (course_id, title, description, video_url, duration, order_index, created_at, updated_at) 
//         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) 
//         RETURNING *`,
//          [courseId, title, description, video_url, duration, orderIndex]
//       );

//       // Update course totals
//       await pool.query(
//          `UPDATE courses 
//         SET total_videos = total_videos + 1, 
//             total_duration = total_duration + $1, 
//             updated_at = NOW() 
//         WHERE id = $2`,
//          [duration, courseId]
//       );

//       res.status(201).json({ video: result.rows[0] });
//    } catch (error) {
//       console.error('Create video error:', error);
//       res.status(500).json({ error: 'Internal server error' });
//    }
// };

// const createVideo = async (req, res) => {
//    try {
//      const { courseId } = req.params;
//      const { title, description, video_url, duration } = req.body;

//      // Get current video count for order_index
//      const videoCountResult = await pool.query(
//        'SELECT COUNT(*) as count FROM videos WHERE course_id = $1',
//        [courseId]
//      );
//      const orderIndex = videoCountResult.rows[0].count;

//      const result = await pool.query(
//        `INSERT INTO videos 
//          (course_id, title, description, video_url, duration, order_index, created_at, updated_at) 
//         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) 
//         RETURNING *`,
//        [courseId, title, description, video_url, duration, orderIndex]
//      );

//      // Update course totals
//      await pool.query(
//        `UPDATE courses 
//         SET total_videos = total_videos + 1, 
//             total_duration = total_duration + $1, 
//             updated_at = NOW() 
//         WHERE id = $2`,
//        [duration, courseId]
//      );

//      res.status(201).json({ video: result.rows[0] });
//    } catch (error) {
//      console.error('Create video error:', error);
//      res.status(500).json({ error: 'Internal server error' });
//    }
//  };

const createVideo = async (req, res) => {
   try {
      const { courseId } = req.params;
      const { title, description, video_url, duration } = req.body;
      const userId = req.user?.id || req.user?.userId || req.headers['x-user-id'];

      // Check if user owns the course
      const ownershipResult = await pool.query(
         'SELECT id FROM courses WHERE id = $1 AND created_by = $2',
         [courseId, userId]
      );

      // if (ownershipResult.rows.length === 0) {
      //    return res.status(403).json({ error: 'Access denied' });
      // }

      // Get current video count for order_index
      const videoCountResult = await pool.query(
         'SELECT COUNT(*) as count FROM videos WHERE course_id = $1',
         [courseId]
      );
      const orderIndex = videoCountResult.rows[0].count;

      const result = await pool.query(
         `INSERT INTO videos (course_id, title, description, video_url, duration, order_index, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING *`,
         [courseId, title, description, video_url, duration, orderIndex]
      );

      // Update course totals
      await pool.query(
         `UPDATE courses
        SET total_videos = total_videos + 1,
            total_duration = total_duration + $1,
            updated_at = NOW()
        WHERE id = $2`,
         [duration, courseId]
      );

      res.status(201).json({ video: result.rows[0] });
   } catch (error) {
      console.error('Create video error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

const uploadVideoFile = async (req, res) => {
   try {
      if (!req.file) {
         return res.status(400).json({ error: 'No file uploaded' });
      }

      // Extract metadata (optional)
      const { originalname, filename } = req.file;
      const fileUrl = `/videos/${filename}`;

      // If you want to store metadata in DB:
      // await pool.query(
      //   `INSERT INTO videos (title, file_url, duration, created_by) VALUES ($1, $2, $3, $4)`,
      //   [originalname, fileUrl, req.body.duration, req.user?.id]
      // );

      return res.status(200).json({
         publicUrl: fileUrl,
         filename: originalname
      });
   } catch (error) {
      console.error('Video upload error:', error);
      res.status(500).json({ error: 'Failed to upload video' });
   }
};


const updateVideo = async (req, res) => {
   try {
      const { videoId } = req.params;
      const { title, description, video_url, duration } = req.body;
      const userId = req.user?.id || req.user?.userId || req.headers['x-user-id'];

      // Check if user owns the video's course
      const ownershipResult = await pool.query(
         `SELECT c.id FROM courses c
        JOIN videos v ON v.course_id = c.id
        WHERE v.id = $1 AND c.created_by = $2`,
         [videoId, userId]
      );

      if (ownershipResult.rows.length === 0) {
         return res.status(403).json({ error: 'Access denied' });
      }

      const result = await pool.query(
         `UPDATE videos
        SET title = $1, description = $2, video_url = $3, duration = $4, updated_at = NOW()
        WHERE id = $5
        RETURNING *`,
         [title, description, video_url, duration, videoId]
      );

      res.json({ video: result.rows[0] });
   } catch (error) {
      console.error('Update video error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};


const deleteVideo = async (req, res) => {
   try {
      const { videoId } = req.params;
      const userId = req.user?.id || req.user?.userId || req.headers['x-user-id'];

      // Check if user owns the video's course
      const ownershipResult = await pool.query(
         `SELECT c.id, v.duration FROM courses c
        JOIN videos v ON v.course_id = c.id
        WHERE v.id = $1 AND c.created_by = $2`,
         [videoId, userId]
      );

      if (ownershipResult.rows.length === 0) {
         return res.status(403).json({ error: 'Access denied' });
      }

      const courseId = ownershipResult?.rows?.[0]?.id;
      const videoDuration = ownershipResult?.rows?.[0]?.duration;

      // Delete related records first
      await pool.query('DELETE FROM video_documents WHERE video_id = $1', [videoId]);
      await pool.query('DELETE FROM quizzes WHERE video_id = $1', [videoId]);

      // Delete the video
      await pool.query('DELETE FROM videos WHERE id = $1', [videoId]);

      // Update course totals
      await pool.query(
         `UPDATE courses
        SET total_videos = total_videos - 1,
            total_duration = total_duration - $1,
            updated_at = NOW()
        WHERE id = $2`,
         [videoDuration, courseId]
      );

      res.json({ message: 'Video deleted successfully' });
   } catch (error) {
      console.error('Delete video error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

// Reorder videos
const reorderVideos = async (req, res) => {
   try {
      const { videoId } = req.params;
      const { newOrder } = req.body;
      const userId = req.user?.id || req.user?.userId || req.headers['x-user-id'];

      // Check if user owns the video's course
      const ownershipResult = await pool.query(
         `SELECT c.id FROM courses c 
        JOIN videos v ON v.course_id = c.id 
        WHERE v.id = $1 AND c.created_by = $2`,
         [videoId, userId]
      );

      if (ownershipResult.rows.length === 0) {
         return res.status(403).json({ error: 'Access denied' });
      }

      // Update order_index for all videos
      for (const video of newOrder) {
         await pool.query(
            'UPDATE videos SET order_index = $1 WHERE id = $2',
            [video.order_index, video.id]
         );
      }

      res.json({ message: 'Videos reordered successfully' });
   } catch (error) {
      console.error('Reorder videos error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

const generateAIContent = async (req, res) => {
   try {
      const { videoId } = req.params;
      const { title, description } = req.body;
      const summary = await generateSummary(title);
      const key_points = await generateKeyPoints();
      const userId = req.user?.id || req.user?.userId || req.headers['x-user-id'];

      // Check if user owns the video's course
      const ownershipResult = await pool.query(
         `SELECT c.id FROM courses c
        JOIN videos v ON v.course_id = c.id
        WHERE v.id = $1 AND c.created_by = $2`,
         [videoId, userId]
      );

      if (ownershipResult.rows.length === 0) {
         return res.status(403).json({ error: 'Access denied' });
      }

      // Update video timestamp
      // const result = await pool.query(
      //    `UPDATE videos
      //   SET updated_at = NOW()
      //   WHERE id = $1
      //   RETURNING *`,
      //    [videoId]
      // );
      const result = await pool.query(
         `UPDATE videos
   SET ai_summary = $1,
       key_points = $2,
       updated_at = NOW()
   WHERE id = $3
   RETURNING *`,
         [summary, key_points, videoId]
      );

      res.json({
         video: result.rows[0],
         message: 'Video updated successfully'
      });
   } catch (error) {
      console.error('Generate AI content error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

// ===== DOCUMENT MANAGEMENT =====

// Get video documents
const getVideoDocuments = async (req, res) => {
   try {
      const { videoId } = req.params;
      const userId = req.user.id;

      // Check if user owns the video's course
      const ownershipResult = await pool.query(
         `SELECT c.id FROM courses c
        JOIN videos v ON v.course_id = c.id
        WHERE v.id = $1 AND c.created_by = $2`,
         [videoId, userId]
      );

      // if (ownershipResult.rows.length === 0) {
      //    return res.status(403).json({ error: 'Access denied' });
      // }

      const result = await pool.query(
         'SELECT * FROM video_documents WHERE video_id = $1 ORDER BY order_index',
         [videoId]
      );

      res.json({ documents: result.rows });
   } catch (error) {
      console.error('Get video documents error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

// Create document
const createDocument = async (req, res) => {
   try {
      const { videoId } = req.params;
      const { title, description, file_url, file_type, file_size } = req.body;
      const userId = req.user.id;

      // Check if user owns the video's course
      const ownershipResult = await pool.query(
         `SELECT c.id FROM courses c
        JOIN videos v ON v.course_id = c.id
        WHERE v.id = $1 AND c.created_by = $2`,
         [videoId, userId]
      );

      // if (ownershipResult.rows.length === 0) {
      //    return res.status(403).json({ error: 'Access denied' });
      // }

      // Get current document count for order_index
      const docCountResult = await pool.query(
         'SELECT COUNT(*) as count FROM video_documents WHERE video_id = $1',
         [videoId]
      );
      const orderIndex = docCountResult.rows[0].count;

      const result = await pool.query(
         `INSERT INTO video_documents (video_id, title, description, file_url, file_type, file_size, order_index, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *`,
         [videoId, title, description, file_url, file_type, file_size, orderIndex]
      );

      res.status(201).json({ document: result.rows[0] });
   } catch (error) {
      console.error('Create document error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

const uploadDocument = async (req, res) => {
   if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
   }

   try {
      const { originalname, filename, mimetype, size, video_url } = req.file;
      const fileUrl = `/documents/${filename}`;

      // Insert metadata into DB
      await pool.query(
         `INSERT INTO video_documents (title, video_id, file_url, file_type, file_size)
        VALUES ($1, $2, $3, $4, $5)`,
         [originalname, video_url, fileUrl, mimetype, size]
      );

      res.json({
         success: true,
         message: 'Document uploaded successfully',
         fileUrl,
         originalName: originalname,
         mimeType: mimetype,
         size
      });
   } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ error: 'Failed to upload document' });
   }
};

// Update document
const updateDocument = async (req, res) => {
   try {
      const { documentId } = req.params;
      const { title, description, file_url, file_type, file_size } = req.body;
      const userId = req.user.id;

      // Check if user owns the document's video's course
      const ownershipResult = await pool.query(
         `SELECT c.id FROM courses c 
        JOIN videos v ON v.course_id = c.id 
        JOIN video_documents vd ON vd.video_id = v.id 
        WHERE vd.id = $1 AND c.created_by = $2`,
         [documentId, userId]
      );

      if (ownershipResult.rows.length === 0) {
         return res.status(403).json({ error: 'Access denied' });
      }

      const result = await pool.query(
         `UPDATE video_documents 
        SET title = $1, description = $2, file_url = $3, file_type = $4, file_size = $5 
        WHERE id = $6 
        RETURNING *`,
         [title, description, file_url, file_type, file_size, documentId]
      );

      res.json({ document: result.rows[0] });
   } catch (error) {
      console.error('Update document error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

// Delete document
const deleteDocument = async (req, res) => {
   try {
      const { documentId } = req.params;
      const userId = req.user.id;

      // Check if user owns the document's video's course
      const ownershipResult = await pool.query(
         `SELECT c.id FROM courses c
        JOIN videos v ON v.course_id = c.id
        JOIN video_documents vd ON vd.video_id = v.id
        WHERE vd.id = $1 AND c.created_by = $2`,
         [documentId, userId]
      );

      // if (ownershipResult.rows.length === 0) {
      //    return res.status(403).json({ error: 'Access denied' });
      // }

      await pool.query('DELETE FROM video_documents WHERE id = $1', [documentId]);

      res.json({ message: 'Document deleted successfully' });
   } catch (error) {
      console.error('Delete document error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

// Reorder documents
const reorderDocuments = async (req, res) => {
   try {
      const { documents } = req.body;
      const userId = req.user.id;

      // Check if user owns all documents' videos' courses
      for (const doc of documents) {
         const ownershipResult = await pool.query(
            `SELECT c.id FROM courses c 
          JOIN videos v ON v.course_id = c.id 
          JOIN video_documents vd ON vd.video_id = v.id 
          WHERE vd.id = $1 AND c.created_by = $2`,
            [doc.id, userId]
         );

         if (ownershipResult.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
         }
      }

      // Update order_index for all documents
      for (const doc of documents) {
         await pool.query(
            'UPDATE video_documents SET order_index = $1 WHERE id = $2',
            [doc.order_index, doc.id]
         );
      }

      res.json({ message: 'Documents reordered successfully' });
   } catch (error) {
      console.error('Reorder documents error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

// ===== ROLE MANAGEMENT =====

// Get course roles
const getCourseRoles = async (req, res) => {
   try {
      const { courseId } = req.params;
      const userId = req.user.id;

      // Check if user owns the course
      const ownershipResult = await pool.query(
         'SELECT id FROM courses WHERE id = $1 AND created_by = $2',
         [courseId, userId]
      );

      if (ownershipResult.rows.length === 0) {
         return res.status(403).json({ error: 'Access denied' });
      }

      const result = await pool.query(
         `SELECT crr.*, r.name as role_name, r.description as role_description 
        FROM course_role_restrictions crr 
        JOIN roles r ON r.id = crr.role_id 
        WHERE crr.course_id = $1`,
         [courseId]
      );

      res.json({ roles: result.rows });
   } catch (error) {
      console.error('Get course roles error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

// Assign course role
const assignCourseRole = async (req, res) => {
   try {
      const { courseId } = req.params;
      const { roleId } = req.body;
      const userId = req.user.id;

      // Check if user owns the course
      const ownershipResult = await pool.query(
         'SELECT id FROM courses WHERE id = $1 AND created_by = $2',
         [courseId, userId]
      );

      if (ownershipResult.rows.length === 0) {
         return res.status(403).json({ error: 'Access denied' });
      }

      // Check if role restriction already exists
      const existingResult = await pool.query(
         'SELECT id FROM course_role_restrictions WHERE course_id = $1 AND role_id = $2',
         [courseId, roleId]
      );

      if (existingResult.rows.length > 0) {
         return res.status(400).json({ error: 'Role restriction already exists' });
      }

      const result = await pool.query(
         `INSERT INTO course_role_restrictions (course_id, role_id, created_at) 
        VALUES ($1, $2, NOW()) 
        RETURNING *`,
         [courseId, roleId]
      );

      res.status(201).json({ roleRestriction: result.rows[0] });
   } catch (error) {
      console.error('Assign course role error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

// Remove course role
const removeCourseRole = async (req, res) => {
   try {
      const { courseId, roleId } = req.params;
      const userId = req.user.id;

      // Check if user owns the course
      const ownershipResult = await pool.query(
         'SELECT id FROM courses WHERE id = $1 AND created_by = $2',
         [courseId, userId]
      );

      if (ownershipResult.rows.length === 0) {
         return res.status(403).json({ error: 'Access denied' });
      }

      await pool.query(
         'DELETE FROM course_role_restrictions WHERE course_id = $1 AND role_id = $2',
         [courseId, roleId]
      );

      res.json({ message: 'Role restriction removed successfully' });
   } catch (error) {
      console.error('Remove course role error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

// ===== ANALYTICS AND DASHBOARD =====

// Get dashboard stats
const getDashboardStats = async (req, res) => {
   try {
      const userId = req.user.id;

      // Get course counts
      const courseStats = await pool.query(
         `SELECT 
          COUNT(*) as total_courses,
          COUNT(CASE WHEN is_published = true THEN 1 END) as published_courses,
          COUNT(CASE WHEN is_published = false THEN 1 END) as draft_courses,
          SUM(total_videos) as total_videos,
          SUM(total_duration) as total_duration
        FROM courses 
        WHERE created_by = $1`,
         [userId]
      );

      // Get enrollment stats
      const enrollmentStats = await pool.query(
         `SELECT COUNT(*) as total_enrollments
        FROM enrollments e
        JOIN courses c ON c.id = e.course_id
        WHERE c.created_by = $1`,
         [userId]
      );

      // Get recent activity
      const recentActivity = await pool.query(
         `SELECT 
          'course' as type,
          c.title as title,
          c.created_at as date
        FROM courses c
        WHERE c.created_by = $1
        UNION ALL
        SELECT 
          'video' as type,
          v.title as title,
          v.created_at as date
        FROM videos v
        JOIN courses c ON c.id = v.course_id
        WHERE c.created_by = $1
        ORDER BY date DESC
        LIMIT 10`,
         [userId]
      );

      res.json({
         stats: {
            ...courseStats.rows[0],
            total_enrollments: enrollmentStats.rows[0]?.total_enrollments || 0
         },
         recent_activity: recentActivity.rows
      });
   } catch (error) {
      console.error('Get dashboard stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

// Get course analytics
// const getCourseAnalytics = async (req, res) => {
//    try {
//       const { courseId } = req.params;
//       const userId = req.user.userId;

//       // Check if user owns the course
//       const ownershipResult = await pool.query(
//          'SELECT id FROM courses WHERE id = $1 AND created_by = $2',
//          [courseId, userId]
//       );

//       if (ownershipResult.rows.length === 0) {
//          return res.status(403).json({ error: 'Access denied' });
//       }

//       // Get enrollment data
//       const enrollmentData = await pool.query(
//          `SELECT 
//           DATE(e.created_at) as date,
//           COUNT(*) as enrollments
//         FROM enrollments e
//         WHERE e.course_id = $1
//         GROUP BY DATE(e.created_at)
//         ORDER BY date DESC
//         LIMIT 30`,
//          [courseId]
//       );

//       // Get progress data
//       const progressData = await pool.query(
//          `SELECT 
//           p.user_id,
//           u.email,
//           p.completed_videos,
//           p.total_videos,
//           p.last_activity
//         FROM progress p
//         JOIN users u ON u.id = p.user_id
//         WHERE p.course_id = $1
//         ORDER BY p.last_activity DESC`,
//          [courseId]
//       );

//       res.json({
//          enrollments: enrollmentData.rows,
//          progress: progressData.rows
//       });
//    } catch (error) {
//       console.error('Get course analytics error:', error);
//       res.status(500).json({ error: 'Internal server error' });
//    }
// };

// Get user stats
const getUserStats = async (req, res) => {
   try {
      const userId = req.user.id;

      // Get user enrollment stats
      const userStats = await pool.query(
         `SELECT 
          COUNT(DISTINCT e.user_id) as unique_learners,
          COUNT(e.id) as total_enrollments,
          AVG(p.completed_videos::float / p.total_videos) as avg_completion_rate
        FROM enrollments e
        LEFT JOIN progress p ON p.course_id = e.course_id AND p.user_id = e.user_id
        JOIN courses c ON c.id = e.course_id
        WHERE c.created_by = $1`,
         [userId]
      );

      // Get top learners
      const topLearners = await pool.query(
         `SELECT 
          u.email,
          p.completed_videos,
          p.total_videos,
          p.last_activity
        FROM progress p
        JOIN users u ON u.id = p.user_id
        JOIN courses c ON c.id = p.course_id
        WHERE c.created_by = $1
        ORDER BY (p.completed_videos::float / p.total_videos) DESC
        LIMIT 10`,
         [userId]
      );

      res.json({
         stats: userStats.rows[0],
         top_learners: topLearners.rows
      });
   } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

// ===== BULK OPERATIONS =====

// Bulk create videos
const bulkCreateVideos = async (req, res) => {
   try {
      const { courseId } = req.params;
      const { videos } = req.body;
      const userId = req.user.id || req.user.userId || req.headers['x-user-id'];

      // Check if user owns the course
      const ownershipResult = await pool.query(
         'SELECT id FROM courses WHERE id = $1 AND created_by = $2',
         [courseId, userId]
      );

      if (ownershipResult.rows.length === 0) {
         return res.status(403).json({ error: 'Access denied' });
      }

      const createdVideos = [];
      let totalDuration = 0;

      for (const video of videos) {
         const { title, description, video_url, duration } = video;

         const result = await pool.query(
            `INSERT INTO videos (course_id, title, description, video_url, duration, order_index, created_at, updated_at) 
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) 
          RETURNING *`,
            [courseId, title, description, video_url, duration, createdVideos.length]
         );

         createdVideos.push(result.rows[0]);
         totalDuration += duration;
      }

      // Update course totals
      await pool.query(
         `UPDATE courses 
        SET total_videos = total_videos + $1, 
            total_duration = total_duration + $2, 
            updated_at = NOW() 
        WHERE id = $3`,
         [videos.length, totalDuration, courseId]
      );

      res.status(201).json({ videos: createdVideos });
   } catch (error) {
      console.error('Bulk create videos error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

// Bulk create documents
const bulkCreateDocuments = async (req, res) => {
   try {
      const { videoId } = req.params;
      const { documents } = req.body;
      const userId = req.user.userId || req.user.id;

      // Check if user owns the video's course
      const ownershipResult = await pool.query(
         `SELECT c.id FROM courses c 
        JOIN videos v ON v.course_id = c.id 
        WHERE v.id = $1 AND c.created_by = $2`,
         [videoId, userId]
      );

      if (ownershipResult.rows.length === 0) {
         return res.status(403).json({ error: 'Access denied' });
      }

      const createdDocuments = [];

      for (const doc of documents) {
         const { title, description, file_url, file_type, file_size } = doc;

         const result = await pool.query(
            `INSERT INTO video_documents (video_id, title, description, file_url, file_type, file_size, order_index, created_at) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) 
          RETURNING *`,
            [videoId, title, description, file_url, file_type, file_size, createdDocuments.length]
         );

         createdDocuments.push(result.rows[0]);
      }

      res.status(201).json({ documents: createdDocuments });
   } catch (error) {
      console.error('Bulk create documents error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};

// Bulk delete videos
const bulkDeleteVideos = async (req, res) => {
   try {
      const { courseId } = req.params;
      const { videoIds } = req.body;
      const userId = req.user.userId || req.user.id;

      // Check if user owns the course
      const ownershipResult = await pool.query(
         'SELECT id FROM courses WHERE id = $1 AND created_by = $2',
         [courseId, userId]
      );

      if (ownershipResult.rows.length === 0) {
         return res.status(403).json({ error: 'Access denied' });
      }

      // Get total duration of videos to be deleted
      const durationResult = await pool.query(
         'SELECT SUM(duration) as total_duration FROM videos WHERE id = ANY($1)',
         [videoIds]
      );
      const totalDuration = durationResult.rows[0].total_duration || 0;

      // Delete related records first
      await pool.query('DELETE FROM video_documents WHERE video_id = ANY($1)', [videoIds]);
      await pool.query('DELETE FROM quizzes WHERE video_id = ANY($1)', [videoIds]);

      // Delete the videos
      await pool.query('DELETE FROM videos WHERE id = ANY($1)', [videoIds]);

      // Update course totals
      await pool.query(
         `UPDATE courses 
        SET total_videos = total_videos - $1, 
            total_duration = total_duration - $2, 
            updated_at = NOW() 
        WHERE id = $3`,
         [videoIds.length, totalDuration, courseId]
      );

      res.json({ message: `${videoIds.length} videos deleted successfully` });
   } catch (error) {
      console.error('Bulk delete videos error:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
};


// ===== COURSE ROUTES shuvina =====

async function getAllCourses(req, res) {
   try {
      const query = `
       SELECT
         c.*,
         COUNT(v.id) as total_videos,
         COALESCE(SUM(v.duration), 0) as total_duration
       FROM courses c
       LEFT JOIN videos v ON c.id = v.course_id
       WHERE c.is_published = true
       GROUP BY c.id
       ORDER BY c.created_at DESC
     `;

      const result = await pool.query(query);
      res.json(result.rows);
   } catch (error) {
      console.error('Error fetching courses:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
}

async function getCourseById(req, res) {
   try {
      const { courseId } = req.params;
      const { userId } = req.query;

      // Get course details
      const courseQuery = 'SELECT * FROM courses WHERE id = $1';
      const courseResult = await pool.query(courseQuery, [courseId]);

      if (courseResult.rows.length === 0) {
         return res.status(404).json({ error: 'Course not found' });
      }

      const course = courseResult.rows[0];

      // Get videos for the course
      const videosQuery = `
       SELECT * FROM videos
       WHERE course_id = $1
       ORDER BY order_index
     `;
      const videosResult = await pool.query(videosQuery, [courseId]);
      const videos = videosResult.rows;

      // Get user enrollment status
      let enrollment = null;
      if (userId) {
         const enrollmentQuery = `
         SELECT * FROM course_enrollments
         WHERE user_id = $1 AND course_id = $2
       `;
         const enrollmentResult = await pool.query(enrollmentQuery, [userId, courseId]);
         enrollment = enrollmentResult.rows[0] || null;
      }

      // Get user progress if enrolled
      let progress = [];
      if (enrollment && userId) {
         const progressQuery = `
         SELECT * FROM user_progress
         WHERE user_id = $1 AND course_id = $2
       `;
         const progressResult = await pool.query(progressQuery, [userId, courseId]);
         progress = progressResult.rows;
         
         console.log('📊 Backend: Loading progress for getCourseById:', {
            userId,
            courseId,
            progressCount: progress.length,
            progress: progress.map(p => ({
               video_id: p.video_id,
               watch_time: p.watch_time,
               completed: p.completed,
               isYouTube: videos.find(v => v.id === p.video_id)?.video_url?.includes('youtube.com') || 
                         videos.find(v => v.id === p.video_id)?.video_url?.includes('youtu.be')
            }))
         });
      }

      // Calculate progress percentage
      let progressPercentage = 0;
      if (enrollment && videos.length > 0) {
         const completedVideos = progress.filter(p => p.completed).length;
         progressPercentage = Math.round((completedVideos / videos.length) * 100);
      }

      res.json({
         course,
         videos,
         enrollment,
         progress,
         progressPercentage
      });
   } catch (error) {
      console.error('Error fetching course:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
}

// Get courses for dashboard (enrolled + available)
async function getDashboardCourses(req, res) {
   try {
      const { userId } = req.query;

      if (!userId) {
         return res.status(400).json({ error: 'User ID is required' });
      }

      // Get enrolled courses
      const enrolledQuery = `
       SELECT
         ce.*,
         c.*,
         COUNT(v.id) as total_videos,
         COALESCE(SUM(v.duration), 0) as total_duration
       FROM course_enrollments ce
       JOIN courses c ON ce.course_id = c.id
       LEFT JOIN videos v ON c.id = v.course_id
       WHERE ce.user_id = $1
       GROUP BY ce.id, c.id
       ORDER BY ce.enrolled_at DESC
     `;
      const enrolledResult = await pool.query(enrolledQuery, [userId]);
      const enrolledCourses = enrolledResult.rows;

      // Get available courses (not enrolled)
      const enrolledCourseIds = enrolledCourses.map(e => e.course_id);
      let availableQuery = `
       SELECT
         c.*,
         COUNT(v.id) as total_videos,
         COALESCE(SUM(v.duration), 0) as total_duration
       FROM courses c
       LEFT JOIN videos v ON c.id = v.course_id
       WHERE c.is_published = true
     `;

      if (enrolledCourseIds.length > 0) {
         availableQuery += ` AND c.id NOT IN (${enrolledCourseIds.map((_, i) => `$${i + 2}`).join(',')})`;
      }

      availableQuery += ' GROUP BY c.id ORDER BY c.created_at DESC';

      const availableParams = enrolledCourseIds.length > 0 ? [userId, ...enrolledCourseIds] : [userId];
      const availableResult = await pool.query(availableQuery, availableParams);
      const availableCourses = availableResult.rows;

      res.json({
         enrolledCourses,
         availableCourses
      });
   } catch (error) {
      console.error('Error fetching dashboard courses:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
}

async function enrollInCourse2(req, res) {
   try {
      const { userId, courseId } = req.body;

      if (!userId || !courseId) {
         return res.status(400).json({ error: 'User ID and Course ID are required' });
      }

      // Check if already enrolled
      const existingQuery = `
       SELECT * FROM course_enrollments
       WHERE user_id = $1 AND course_id = $2
     `;
      const existingResult = await pool.query(existingQuery, [userId, courseId]);

      if (existingResult.rows.length > 0) {
         return res.status(400).json({ error: 'User already enrolled in this course' });
      }

      // Check if course is published
      const courseQuery = 'SELECT * FROM courses WHERE id = $1 AND is_published = true';
      const courseResult = await pool.query(courseQuery, [courseId]);

      if (courseResult.rows.length === 0) {
         return res.status(404).json({ error: 'Course not found or not published' });
      }

      // Enroll user
      const enrollQuery = `
       INSERT INTO course_enrollments (user_id, course_id, progress_percentage)
       VALUES ($1, $2, 0)
       RETURNING *
     `;
      const enrollResult = await pool.query(enrollQuery, [userId, courseId]);

      res.status(201).json(enrollResult.rows[0]);
   } catch (error) {
      console.error('Error enrolling in course:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
}

// Update video progress
async function updateVideoProgress(req, res) {
   try {
      const { userId, courseId, videoId, watchTime, completed, quizScore } = req.body;

      let intWatchTime = Math.floor(watchTime);
      let intQuizScore = Math.floor(quizScore);

      if (!userId || !courseId || !videoId) {
         return res.status(400).json({ error: 'User ID, Course ID, and Video ID are required' });
      }

      // Check if progress record exists
      const existingQuery = `
       SELECT * FROM user_progress
       WHERE user_id = $1 AND course_id = $2 AND video_id = $3
     `;
      const existingResult = await pool.query(existingQuery, [userId, courseId, videoId]);

      if (existingResult.rows.length > 0) {
         // Update existing progress
         const updateQuery = `
         UPDATE user_progress
         SET watch_time = $4, completed = $5, quiz_score = $6, last_watched_at = NOW()
         WHERE user_id = $1 AND course_id = $2 AND video_id = $3
         RETURNING *
       `;
         const updateResult = await pool.query(updateQuery, [userId, courseId, videoId, intWatchTime, completed, intQuizScore]);

         // Update course enrollment progress
         await updateCourseProgress(userId, courseId);

         res.json(updateResult.rows[0]);
      } else {
         // Create new progress record
         const insertQuery = `
         INSERT INTO user_progress (user_id, course_id, video_id, watch_time, completed, quiz_score)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *
       `;
         const insertResult = await pool.query(insertQuery, [userId, courseId, videoId, intWatchTime, completed, intQuizScore]);

         // Update course enrollment progress
         await updateCourseProgress(userId, courseId);

         res.status(201).json(insertResult.rows[0]);
      }
   } catch (error) {
      console.error('Error updating video progress:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
}

// Update course progress percentage
async function updateCourseProgress(userId, courseId) {
   try {
      // FIXED: Get total videos from videos table, not user_progress
      const totalVideosQuery = `SELECT COUNT(*)::int as total FROM videos WHERE course_id = $1`;
      const totalResult = await pool.query(totalVideosQuery, [courseId]);

      // Get completed videos from user_progress (only count videos that still exist in the course)
      const completedQuery = `
         SELECT COUNT(*)::int as completed 
         FROM user_progress up
         INNER JOIN videos v ON up.video_id = v.id
         WHERE up.user_id = $1 AND up.course_id = $2 AND up.completed = true AND v.course_id = $2
      `;
      const completedResult = await pool.query(completedQuery, [userId, courseId]);

      const totalVideos = totalResult.rows[0]?.total || 0;
      const completedVideos = completedResult.rows[0]?.completed || 0;

      const progressPercentage = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0;

      const updateQuery = `
         UPDATE course_enrollments
         SET progress_percentage = $3,
             completed_at = CASE WHEN $3 = 100 THEN NOW() ELSE NULL END
         WHERE user_id = $1 AND course_id = $2
      `;
      await pool.query(updateQuery, [userId, courseId, progressPercentage]);

      console.log(`Progress updated for user ${userId}, course ${courseId}: ${completedVideos}/${totalVideos} = ${progressPercentage}%`);
   } catch (error) {
      console.error('Error updating course progress:', error);
   }
}

// Get course progress for a user
async function getCourseProgress2(req, res) {
   try {
      const { userId, courseId } = req.params;

      const progressQuery = `
       SELECT
         up.*,
         v.title as video_title,
         v.order_index
       FROM user_progress up
       JOIN videos v ON up.video_id = v.id
       WHERE up.user_id = $1 AND up.course_id = $2
       ORDER BY v.order_index
     `;
      const progressResult = await pool.query(progressQuery, [userId, courseId]);

      const enrollmentQuery = `
       SELECT * FROM course_enrollments
       WHERE user_id = $1 AND course_id = $2
     `;
      const enrollmentResult = await pool.query(enrollmentQuery, [userId, courseId]);

      res.json({
         progress: progressResult.rows,
         enrollment: enrollmentResult.rows[0] || null
      });
   } catch (error) {
      console.error('Error fetching course progress:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
}

// Exit course (remove enrollment)
async function exitCourse2(req, res) {
   try {
      const { userId, courseId } = req.params;

      // Delete enrollment
      const deleteEnrollmentQuery = `
       DELETE FROM course_enrollments
       WHERE user_id = $1 AND course_id = $2
     `;
      await pool.query(deleteEnrollmentQuery, [userId, courseId]);

      // Delete all progress records
      const deleteProgressQuery = `
       DELETE FROM user_progress
       WHERE user_id = $1 AND course_id = $2
     `;
      await pool.query(deleteProgressQuery, [userId, courseId]);

      res.json({ message: 'Successfully exited course' });
   } catch (error) {
      console.error('Error exiting course:', error);
      res.status(500).json({ error: 'Internal server error' });
   }
}


// ===== role selector dimple =====

const saveCourseRoleRestrictions = async (req, res) => {
   const { courseId } = req.params;
   const { restrictions } = req.body; // array of { course_id, role_id }

   if (!Array.isArray(restrictions)) {
      return res.status(400).json({ error: 'Invalid payload: restrictions must be an array' });
   }

   const client = await pool.connect();

   try {
      await client.query('BEGIN');

      // 1. Delete existing restrictions for this course
      await client.query(
         'DELETE FROM course_role_restrictions WHERE course_id = $1',
         [courseId]
      );

      // 2. Insert new restrictions (role_id is actually a role name here)
      if (restrictions.length > 0) {
         const valuesClause = restrictions
            .map((_, index) => `($1, $${index + 2})`)
            .join(', ');

         const roleNames = restrictions.map(r => r.role_id);

         await client.query(
            `INSERT INTO course_role_restrictions (course_id, role_id) VALUES ${valuesClause}`,
            [courseId, ...roleNames]
         );
      }

      await client.query('COMMIT');

      return res.json({
         success: true,
         message: 'Role restrictions updated successfully'
      });
   } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error saving role restrictions:', err);
      res.status(500).json({ error: 'Error saving role restrictions' });
   } finally {
      client.release();
   }
};

const getCourseRoleRestrictions = async (req, res) => {
   const { courseId } = req.params;

   try {
      const query = `
       SELECT *
       FROM course_role_restrictions
       WHERE course_id = $1
     `;

      const { rows } = await pool.query(query, [courseId]);
      console.log(rows, "rpws")

      // Extract just the role strings into an array
      const roleNames = rows.map(r => r.role_id); // assumes column is `role_name`

      return res.json({
         restrictions: rows,
         roles: roleNames
      });
   } catch (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: 'Error fetching role restrictions' });
   }
}



///////////////////new?//////////////////////





// Only keep truly legacy names that are not implemented in this file
const legacyHandlers = {
   loadProgressData: notImplemented('loadProgressData'),
   loadRoleData: notImplemented('loadRoleData'),
   loadVideoDocuments: notImplemented('loadVideoDocuments'),
   loadCourses: notImplemented('loadCourses'),
   loadData: notImplemented('loadData'),
   saveRoleRestrictions: notImplemented('saveRoleRestrictions'),
   loadUserRoles: notImplemented('loadUserRoles'),
   loadVideos: notImplemented('loadVideos'),
   handleVideoUpload: notImplemented('handleVideoUpload'),
   handleAddVideo: notImplemented('handleAddVideo'),
   handleDocumentUpload: notImplemented('handleDocumentUpload'),
   handleDocumentReorder: notImplemented('handleDocumentReorder'),
   handleDeleteDocument: notImplemented('handleDeleteDocument'),
   handleVideoReorder: notImplemented('handleVideoReorder'),
   handleDeleteVideo: notImplemented('handleDeleteVideo'),
   handlePublishCourse: notImplemented('handlePublishCourse'),
   loadCourseData: notImplemented('loadCourseData'),
   handleEnroll: notImplemented('handleEnroll'),
   handleVideoProgress: notImplemented('handleVideoProgress'),
   handleVideoComplete: notImplemented('handleVideoComplete'),
   handleQuizComplete: notImplemented('handleQuizComplete'),
   performSearch: notImplemented('performSearch'),
   loadDashboardData: notImplemented('loadDashboardData'),
   handleExitCourse: notImplemented('handleExitCourse'),
   getPublicCourseVideos: notImplemented('getPublicCourseVideos'),
};

module.exports = {
   // legacy stubs first so real handlers below override if names clash
   ...legacyHandlers,

   // implemented handlers
   getDashboardData,
   searchCourses,
   exitCourse,

   // Progress & analytics
   getProgressDashboard,
   getCourseProgress,
   updateStudentProgress,
   getUserEnrollments,
   getUserDetailedProgress,
   getCourseAnalytics,

   // Admin: courses
   getAdminCourses,
   getAdminCourseById,
   createCourse,
   updateCourse,
   deleteCourse,
   publishCourse,
   unpublishCourse,

   // Admin: videos
   getCourseVideos,
   createVideo,
   updateVideo,
   deleteVideo,
   reorderVideos,
   generateAIContent,

   // Admin: documents
   getVideoDocuments,
   createDocument,
   updateDocument,
   deleteDocument,
   reorderDocuments,

   // Admin: roles
   getCourseRoles,
   assignCourseRole,
   removeCourseRole,

   // Admin: dashboard & user stats
   getDashboardStats,
   getUserStats,

   // Bulk operations
   bulkCreateVideos,
   bulkCreateDocuments,
   bulkDeleteVideos,

   // student-facing
   getPublicCourse,
   getPublicCourseVideos,
   getPublicVideoDocuments,
   enrollInCourse,
   upsertProgress,
   getVideoQuiz,
   uploadVideoFile,


   getAllCourses,
   getCourseById,
   getDashboardCourses,
   enrollInCourse2,
   updateVideoProgress,
   updateCourseProgress,
   getCourseProgress2,
   exitCourse2,


   saveCourseRoleRestrictions,
   getCourseRoleRestrictions,
   uploadDocument

};
