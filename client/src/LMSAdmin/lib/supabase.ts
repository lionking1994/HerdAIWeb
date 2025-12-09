import { createClient } from '@supabase/supabase-js';

// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// const supabaseUrl = process.env.VITE_SUPABASE_URL;
// const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = "https://vbijsuemppzfpkwjieax.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaWpzdWVtcHB6ZnBrd2ppZWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODE1MzksImV4cCI6MjA2OTc1NzUzOX0.XzzCqxSbFRi93mrBR6L1KLniUDb-9tYoOike1k64ruo";

// console.log("supabaseUrl", supabaseUrl)
// console.log("supabaseAnonKey", supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// AI Service for generating quizzes and summaries
export class AIService {
  static async generateQuiz(videoTitle: string, videoDescription: string): Promise<any> {
    try {
      // This would integrate with OpenAI or similar AI service
      // For demo purposes, returning mock data
      return {
        title: `Quiz: ${videoTitle}`,
        questions: [
          {
            id: '1',
            question: `What is the main topic covered in "${videoTitle}"?`,
            options: [
              'Basic concepts and fundamentals',
              'Advanced techniques',
              'Practical applications',
              'Historical background'
            ],
            correct_answer: 0,
            explanation: 'This video focuses on introducing the fundamental concepts.'
          },
          {
            id: '2',
            question: 'Which key principle was emphasized in this lesson?',
            options: [
              'Speed over accuracy',
              'Understanding before memorizing',
              'Quantity over quality',
              'Theory without practice'
            ],
            correct_answer: 1,
            explanation: 'The lesson emphasizes the importance of understanding concepts thoroughly.'
          }
        ]
      };
    } catch (error) {
      console.error('Error generating quiz:', error);
      throw error;
    }
  }

  static async generateSummary(videoTitle: string, videoDescription: string): Promise<string> {
    try {
      // Mock AI-generated summary
      return `This lesson on "${videoTitle}" covers essential concepts and practical applications. Key learning outcomes include understanding fundamental principles, applying theoretical knowledge to real-world scenarios, and developing critical thinking skills in this subject area.`;
    } catch (error) {
      console.error('Error generating summary:', error);
      throw error;
    }
  }

  static async generateKeyPoints(videoTitle: string, videoDescription: string): Promise<string[]> {
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
}