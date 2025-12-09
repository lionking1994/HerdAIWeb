import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CircularProgress, Alert, Box } from '@mui/material';
import { toast } from 'react-toastify';

const ZoomCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleZoomCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (!code) {
          throw new Error('No authorization code received from Zoom');
        }

        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/zoom/callback`, 
          { code },
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }
          }
        );

        if (response.data.success) {
          navigate('/profile?tab=connections', {
            state: { message: 'Zoom account connected successfully' }
          });
          toast.success('Zoom account connected successfully');
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to connect Zoom account');
        // Navigate back to settings after error
        toast.error('Failed to connect Zoom account');
        // Navigate back to settings after error
        setTimeout(() => {
          navigate('/profile?tab=connections');
        }, 3000);
      }
    };

    handleZoomCallback();
  }, [navigate]);

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh' 
    }}>
      <CircularProgress />
    </Box>
  );
};

export default ZoomCallback; 