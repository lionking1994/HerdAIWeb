import React, { useEffect, useState } from "react";
import UserProfileDrawer from "./UserProfileDrawer"; // Make sure this exists
import useHttp from "../hooks/useHttp";

const AvatarPop = ({ participant, id, size = 32 }) => {
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [userData, setUserData] = useState(participant);
  const [isLoading, setIsLoading] = useState(false);
  const { sendRequest } = useHttp();

  const getUserData = async (userId) => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      const response = await sendRequest({
        url: `${process.env.REACT_APP_API_URL}/users/get`,
        method: 'POST',
        body: { userId: userId },
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response?.user) {
        setUserData(response.user);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!participant && id) {
      getUserData(id);
    }
  }, [id, participant]);

  const openPop = () => {
    if (userData) {
      setShowProfileDrawer(true);
    }
  };

  // Don't render anything if no id and no participant provided
  if (!id && !participant) {
    return null;
  }

  // Show loading placeholder while fetching
  if (isLoading || !userData) {
    return (
      <div className="participant-avatar flex-none">
        <div 
          className="flex-none avatar-placeholder bg-gray-200 animate-pulse rounded-full"
          style={{ width: size, height: size }}
        >
          ?
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="participant-avatar flex-none">
        <button onClick={openPop}>
          {userData.avatar ? (
            <img
              src={`${process.env.REACT_APP_API_URL}/avatars/${userData.avatar}`}
              alt={userData.name || 'User'}
              style={{ width: size, height: size, borderRadius: '50%' }}
            />
          ) : (
            <div 
              className="flex-none avatar-placeholder flex items-center justify-center bg-blue-500 text-white rounded-full"
              style={{ width: size, height: size, fontSize: size * 0.4 }}
            >
              {userData.name ? userData.name.charAt(0).toUpperCase() : '?'}
            </div>
          )}
        </button>
      </div>

      {userData && userData.id && userData.id !== 1 && (
        <UserProfileDrawer
          user={userData}
          isOpen={showProfileDrawer}
          onClose={() => setShowProfileDrawer(false)}
        />
      )}
    </>
  );
};

export default AvatarPop;
