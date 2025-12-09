import { Course, Video, VideoDocument } from '../types';

const API_BASE_URL = 'http://localhost:3001/api/v1';

class AdminService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  // ===== COURSE MANAGEMENT =====

  async getAdminCourses(): Promise<Course[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/courses`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.courses;
    } catch (error) {
      console.error('Error fetching admin courses:', error);
      throw error;
    }
  }

  async createCourse(courseData: { title: string; description: string; thumbnail_url?: string }): Promise<Course> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/courses`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(courseData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.course;
    } catch (error) {
      console.error('Error creating course:', error);
      throw error;
    }
  }

  async updateCourse(courseId: string, courseData: { title: string; description: string; thumbnail_url?: string }): Promise<Course> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/courses/${courseId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(courseData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.course;
    } catch (error) {
      console.error('Error updating course:', error);
      throw error;
    }
  }

  async deleteCourse(courseId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/courses/${courseId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting course:', error);
      throw error;
    }
  }

  async publishCourse(courseId: string): Promise<Course> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/courses/${courseId}/publish`, {
        method: 'PATCH',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.course;
    } catch (error) {
      console.error('Error publishing course:', error);
      throw error;
    }
  }

  async unpublishCourse(courseId: string): Promise<Course> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/courses/${courseId}/unpublish`, {
        method: 'PATCH',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.course;
    } catch (error) {
      console.error('Error unpublishing course:', error);
      throw error;
    }
  }

  // ===== VIDEO MANAGEMENT =====

  async getCourseVideos(courseId: string): Promise<Video[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/courses/${courseId}/videos`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.videos;
    } catch (error) {
      console.error('Error fetching course videos:', error);
      throw error;
    }
  }

  async createVideo(courseId: string, videoData: { title: string; description: string; video_url: string; duration: number }): Promise<Video> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/courses/${courseId}/videos`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(videoData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.video;
    } catch (error) {
      console.error('Error creating video:', error);
      throw error;
    }
  }

  async updateVideo(videoId: string, videoData: { title: string; description: string; video_url: string; duration: number }): Promise<Video> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/videos/${videoId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(videoData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.video;
    } catch (error) {
      console.error('Error updating video:', error);
      throw error;
    }
  }

  async deleteVideo(videoId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/videos/${videoId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting video:', error);
      throw error;
    }
  }

  async reorderVideos(videoId: string, newOrder: Array<{ id: string; order_index: number }>): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/videos/${videoId}/reorder`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ newOrder })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error reordering videos:', error);
      throw error;
    }
  }

  async generateAIContent(videoId: string, contentData: { title: string; description: string }): Promise<Video> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/videos/${videoId}/ai-content`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(contentData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.video;
    } catch (error) {
      console.error('Error generating AI content:', error);
      throw error;
    }
  }

  // ===== DOCUMENT MANAGEMENT =====

  async getVideoDocuments(videoId: string): Promise<VideoDocument[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/videos/${videoId}/documents`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.documents;
    } catch (error) {
      console.error('Error fetching video documents:', error);
      throw error;
    }
  }

  async createDocument(videoId: string, documentData: { title: string; description: string; file_url: string; file_type: string; file_size: number }): Promise<VideoDocument> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/videos/${videoId}/documents`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(documentData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.document;
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  }

  async updateDocument(documentId: string, documentData: { title: string; description: string; file_url: string; file_type: string; file_size: number }): Promise<VideoDocument> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/documents/${documentId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(documentData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.document;
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/documents/${documentId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  async reorderDocuments(documents: Array<{ id: string; order_index: number }>): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/documents/reorder`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ documents })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error reordering documents:', error);
      throw error;
    }
  }

  // ===== ROLE MANAGEMENT =====

  async getCourseRoles(courseId: string): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/courses/${courseId}/roles`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.roles;
    } catch (error) {
      console.error('Error fetching course roles:', error);
      throw error;
    }
  }

  async assignCourseRole(courseId: string, roleId: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/courses/${courseId}/roles`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ roleId })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.roleRestriction;
    } catch (error) {
      console.error('Error assigning course role:', error);
      throw error;
    }
  }

  async removeCourseRole(courseId: string, roleId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/courses/${courseId}/roles/${roleId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error removing course role:', error);
      throw error;
    }
  }

  // ===== ANALYTICS AND DASHBOARD =====

  async getDashboardStats(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/dashboard/stats`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }

  async getCourseAnalytics(courseId: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/dashboard/courses/${courseId}/analytics`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching course analytics:', error);
      throw error;
    }
  }

  async getUserStats(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/dashboard/users`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching user stats:', error);
      throw error;
    }
  }

  // ===== BULK OPERATIONS =====

  async bulkCreateVideos(courseId: string, videos: Array<{ title: string; description: string; video_url: string; duration: number }>): Promise<Video[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/courses/${courseId}/videos/bulk`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ videos })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.videos;
    } catch (error) {
      console.error('Error bulk creating videos:', error);
      throw error;
    }
  }

  async bulkCreateDocuments(videoId: string, documents: Array<{ title: string; description: string; file_url: string; file_type: string; file_size: number }>): Promise<VideoDocument[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/videos/${videoId}/documents/bulk`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ documents })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.documents;
    } catch (error) {
      console.error('Error bulk creating documents:', error);
      throw error;
    }
  }

  async bulkDeleteVideos(courseId: string, videoIds: string[]): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/courses/${courseId}/videos/bulk`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ videoIds })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error bulk deleting videos:', error);
      throw error;
    }
  }
}

export const adminService = new AdminService();
