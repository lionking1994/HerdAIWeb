import React, { useState, useEffect } from 'react';
import { User, MessageCircle, Clock, Loader2 } from 'lucide-react';
import api from '../../../lib/api';

interface StoryHoverTooltipProps {
  storyId: string;
  assigneeId?: string;
  assigneeDetails?: {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    role?: string;
  } | null;
  isVisible: boolean;
  position: { x: number; y: number };
}

interface StoryDiscussion {
  id: string;
  comment_text: string;
  created_at: string;
  user_name: string;
  user_avatar?: string;
}

const StoryHoverTooltip: React.FC<StoryHoverTooltipProps> = ({
  storyId,
  assigneeId,
  assigneeDetails,
  isVisible,
  position
}) => {
  const [discussions, setDiscussions] = useState<StoryDiscussion[]>([]);
  const [loading, setLoading] = useState(false);
  const [loggedHours, setLoggedHours] = useState<number>(0);

  useEffect(() => {
    if (isVisible && storyId) {
      fetchStoryDetails();
    }
  }, [isVisible, storyId]);

  const fetchStoryDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch discussions
      try {
        const discussionsResponse = await api.get(`/psa/story/${storyId}/discussions`);
        console.log('Discussions API Response:', discussionsResponse.data);
        if (discussionsResponse.data.success) {
          // The API returns data.discussions, not data.data
          setDiscussions(discussionsResponse.data.data?.discussions || []);
        }
      } catch (error) {
        console.error('Error fetching discussions:', error);
        setDiscussions([]);
      }

      // For now, we'll simulate logged hours since time tracking API might not exist
      // In a real implementation, you'd fetch this from a time tracking API
      setLoggedHours(Math.floor(Math.random() * 20) + 1); // Random hours for demo
      
    } catch (error) {
      console.error('Error fetching story details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-sm"
      style={{
        left: position.x - 50,
        top: position.y -5 ,
        transform: 'translate(-50%, -100%)' // Center horizontally and position above
      }}
    >
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm text-gray-600">Loading...</span>
        </div>
      ) : (
        <div className="space-y-3">
           {/* Assignee Section */}
           <div className="border-b border-gray-100 pb-3">
             <div className="flex items-center space-x-2 mb-2">
               <User className="h-4 w-4 text-blue-600" />
               <span className="text-sm font-medium text-gray-900">Assigned To</span>
             </div>
             {assigneeDetails ? (
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center">
                  {assigneeDetails.avatar ? (
                    <img
                      src={`${import.meta.env.VITE_API_BASE_URL}/avatars/${assigneeDetails.avatar}`}
                      alt={assigneeDetails.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to default icon if image fails to load
                        e.currentTarget.style.display = 'none';
                        const fallbackElement = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallbackElement) {
                          fallbackElement.style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  <div 
                    className={`w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-medium ${assigneeDetails.avatar ? 'hidden' : ''}`}
                    style={{ display: assigneeDetails.avatar ? 'none' : 'flex' }}
                  >
                    {assigneeDetails.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{assigneeDetails.name}</p>
                  <p className="text-xs text-gray-500">{assigneeDetails.email}</p>
                </div>
              </div>
            ) : (
               <div className="flex items-center space-x-2">
                 <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                   <User className="h-3 w-3 text-gray-500" />
                 </div>
                 <div>
                   <p className="text-sm text-gray-500">No assignee</p>
                   <p className="text-xs text-gray-400">Click to assign</p>
                 </div>
               </div>
             )}
           </div>

          {/* Logged Hours Section */}
          <div className="border-b border-gray-100 pb-3">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-gray-900">Time Logged</span>
            </div>
            <p className="text-sm text-gray-600">{loggedHours} hours logged</p>
          </div>

          {/* Comments Thread Section */}
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <MessageCircle className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-gray-900">Comments</span>
              <span className="text-xs text-gray-500">({discussions.length})</span>
            </div>
            
            {discussions.length > 0 ? (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {discussions.slice(0, 3).map((discussion) => (
                  <div key={discussion.id} className="bg-gray-50 rounded-lg p-2">
                    <div className="flex items-start space-x-2">
                      {discussion.user_avatar ? (
                        <img
                          src={discussion.user_avatar}
                          alt={discussion.user_name}
                          className="w-4 h-4 rounded-full object-cover mt-0.5"
                        />
                      ) : (
                        <div className="w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center text-white text-xs font-medium mt-0.5">
                          {discussion.user_name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900">{discussion.user_name}</p>
                         <p className="text-xs text-gray-600 mt-1 line-clamp-2">{discussion.comment_text}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatDate(discussion.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {discussions.length > 3 && (
                  <p className="text-xs text-gray-500 text-center">
                    +{discussions.length - 3} more comments
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No comments yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryHoverTooltip;
