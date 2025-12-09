import React, { useState } from 'react';
import axios from 'axios';
import { Button, CircularProgress, Alert } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import { useDispatch } from 'react-redux';
import { loginSuccess } from '../store/slices/authSlice';

const ZoomIntegration = ({ user, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const dispatch = useDispatch();

  const handleZoomAuth = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user.use_zoom) {
        // Update user's use_zoom status first
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/zoom/activate`,
          {},
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }
          }
        );

        if (response.data.success) {
          // Update local user state
          const updatedUser = { ...user, use_zoom: true };
          dispatch(loginSuccess(updatedUser));
          localStorage.setItem('user', JSON.stringify(updatedUser));

          // Now redirect to Zoom OAuth
          const clientId = process.env.REACT_APP_ZOOM_API_KEY;
          const redirectUri = encodeURIComponent(process.env.REACT_APP_ZOOM_REDIRECT_URI);
          const zoomAuthUrl = `https://zoom.us/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;
          window.location.href = zoomAuthUrl;
        }
      } else {
        // Disconnect Zoom
        const response = await axios.delete(
          `${process.env.REACT_APP_API_URL}/zoom/disconnect`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }
          }
        );

        if (response.data.success) {
          // Update local user state
          const updatedUser = { ...user, use_zoom: false };
          dispatch(loginSuccess(updatedUser));
          localStorage.setItem('user', JSON.stringify(updatedUser));
          onUpdate(updatedUser);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process Zoom integration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Button
        variant="contained"
        color={user.use_zoom ? "error" : "primary"}
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <VideocamIcon />}
        onClick={handleZoomAuth}
        disabled={loading}
        fullWidth
      >
        {user.use_zoom ? 'Disconnect Zoom' : 'Connect Zoom Account'}
      </Button>
    </div>
  );
};

export default ZoomIntegration; 