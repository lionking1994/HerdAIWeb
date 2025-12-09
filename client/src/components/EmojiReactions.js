import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Popover } from "@headlessui/react";
import { FaSmile } from "react-icons/fa";

// Common emoji set
const commonEmojis = [
  { emoji: "👍", name: "thumbs up" },
  { emoji: "👎", name: "thumbs down" },
  { emoji: "❤️", name: "heart" },
  { emoji: "🎉", name: "celebration" },
  { emoji: "👏", name: "clap" },
  { emoji: "🔥", name: "fire" },
  { emoji: "😄", name: "smile" },
  { emoji: "🙏", name: "thank you" },
];

const EmojiReactions = ({ threadId, onReactionChange, currentUser, apiType = "task" }) => {
  const [reactions, setReactions] = useState([]);
  const [userReactions, setUserReactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Fetch reactions for this thread
  const fetchReactions = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      
      // Use different API endpoints based on apiType
      const baseUrl = apiType === "psa" ? "/psa/emoji-reactions" : "/emoji-reactions";
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}${baseUrl}/${threadId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        // Group reactions by emoji
        const groupedReactions = response.data.reactions.reduce((acc, reaction) => {
          if (!acc[reaction.emoji]) {
            acc[reaction.emoji] = [];
          }
          acc[reaction.emoji].push(reaction);
          return acc;
        }, {});

        setReactions(groupedReactions);

        // Get current user ID and set it
        setCurrentUserId(currentUser?.id);
        
        // Determine which emojis the current user has reacted with
        const userEmojis = response.data.reactions
          .filter(reaction => reaction.user_id === currentUser?.id)
          .map(reaction => reaction.emoji);

          console.log("emoji", response.data.reactions);
        setUserReactions(userEmojis);
      }
    } catch (error) {
      console.error("Error fetching reactions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (threadId) {
      fetchReactions();
    }
  }, [threadId]);

  // Toggle an emoji reaction
  const toggleReaction = async (emoji) => {
    try {
      const token = localStorage.getItem("token");
      console.log("emoji", emoji, userReactions);
      const hasReacted = userReactions.includes(emoji);

      const endpoint = hasReacted ? 'remove' : 'add';
      
      // Use different API endpoints based on apiType
      const baseUrl = apiType === "psa" ? "/psa/emoji-reactions" : "/emoji-reactions";
      
      // Use different payload structure for PSA vs Task
      const payload = apiType === "psa" 
        ? { comment_id: threadId, emoji }
        : { threadId, emoji };

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}${baseUrl}/${endpoint}`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        // Update local state
        fetchReactions();

        // Notify parent component
        if (onReactionChange) {
          onReactionChange(emoji, !hasReacted);
        }
      }
    } catch (error) {
      console.error(`Error ${userReactions.includes(emoji) ? 'removing' : 'adding'} reaction:`, error);
      toast.error("Failed to update reaction");
    }
  };

  // Handle emoji click to show users list
  const handleEmojiClick = (emoji) => {
    if (selectedEmoji === emoji) {
      setSelectedEmoji(null); // Close the list if clicking the same emoji
    } else {
      setSelectedEmoji(emoji); // Show users for this emoji
    }
  };

  // Handle user click in the users list
  const handleUserClick = (emoji, userId) => {
    // If the clicked user is the current user, remove their reaction
    if (userId === currentUserId) {
      toggleReaction(emoji);
    }
    // Close the users list after clicking
    setSelectedEmoji(null);
  };

  // Render emoji buttons with counts
  const renderEmojiButtons = () => {
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {Object.entries(reactions).map(([emoji, users]) => (
          <div key={emoji} className="relative">
            <button
              onClick={() => handleEmojiClick(emoji)}
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                userReactions.includes(emoji)
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-800"
              }`}
            >
              <span className="mr-1">{emoji}</span>
              <span>{users.length}</span>
            </button>
            
            {/* Users list popup */}
            {selectedEmoji === emoji && (
              <div className="absolute z-20 mt-1 bg-white rounded-lg shadow-lg p-2 border border-gray-200 w-48">
                <div className="text-xs font-medium text-gray-700 mb-1">
                  People who reacted with {emoji}:
                </div>
                <ul className="max-h-40 overflow-y-auto">
                  {users.map((user) => (
                    <li 
                      key={user.user_id}
                      onClick={() => handleUserClick(emoji, user.user_id)}
                      className={`py-1 px-2 text-sm rounded cursor-pointer hover:bg-gray-100 flex items-center ${
                        user.user_id === currentUserId ? "bg-blue-50" : ""
                      }`}
                    >
                      {user.avatar && (
                        <img 
                        src={`${process.env.REACT_APP_API_URL}/avatars/${user.avatar}`}
                          alt={user.name} 
                          className="w-5 h-5 rounded-full mr-2"
                        />
                      )}
                      <span>
                        {user.name}
                        {user.user_id === currentUserId && " (You)"}
                      </span>
                    </li>
                  ))}
                </ul>
                {currentUserId && users.some(user => user.user_id === currentUserId) && (
                  <div className="text-xs text-gray-500 mt-1 italic">
                    Click on your name to remove your reaction
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Close users list when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectedEmoji && !event.target.closest('.emoji-reactions')) {
        setSelectedEmoji(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedEmoji]);

  return (
    <div className="emoji-reactions">
      <div className="flex items-center">
        {/* Existing reactions */}
        {Object.keys(reactions).length > 0 && renderEmojiButtons()}

        {/* Emoji picker */}
        <Popover className="relative ml-1">
          <Popover.Button className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full">
            <FaSmile className="w-4 h-4" />
          </Popover.Button>

          <Popover.Panel className="absolute z-10 mt-1 bg-white rounded-lg shadow-lg p-2 border border-gray-200">
            <div className="w-35 grid grid-cols-4 gap-2">
              {commonEmojis.map((item) => (
                <button
                  key={item.emoji}
                  onClick={() => {
                    toggleReaction(item.emoji);
                  }}
                  className={`p-2 hover:bg-gray-100 rounded ${
                    userReactions.includes(item.emoji) ? "bg-blue-100" : ""
                  }`}
                  title={item.name}
                >
                  <span className="text-lg">{item.emoji}</span>
                </button>
              ))}
            </div>
          </Popover.Panel>
        </Popover>
      </div>
    </div>
  );
};

export default EmojiReactions;

