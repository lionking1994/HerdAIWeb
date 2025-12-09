import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

function LinkedinCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const queryParams = new URLSearchParams(location.search);
        const code = queryParams.get('code');
        const state = queryParams.get('state');
        
        if (!code) {
          throw new Error('Authorization code is missing');
        }

        const token = localStorage.getItem('token');
        
        // Exchange code for tokens
        await axios.get(
          `${process.env.REACT_APP_API_URL}/linkedin/callback?code=${code}&state=${state}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        // Redirect to profile connections tab with success message
        navigate('/profile?tab=connections', {
          state: { success: true, provider: 'linkedin' }
        });
        
        toast.success('LinkedIn connected successfully');
      } catch (error) {
        console.error('LinkedIn callback error:', error);
        setError('Failed to connect LinkedIn account');
        
        // Redirect to profile connections tab with error message
        navigate('/profile?tab=connections');
        
        toast.error('Failed to connect LinkedIn account');
      } finally {
        setIsLoading(false);
      }
    };

    handleCallback();
  }, [location, navigate]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-lg">Connecting your LinkedIn account...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-red-500 text-xl">Error: {error}</div>
        <button
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => navigate('/profile?tab=connections')}
        >
          Return to Profile
        </button>
      </div>
    );
  }

  return null;
}

export default LinkedinCallback;

