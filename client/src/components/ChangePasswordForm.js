import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ChangePasswordForm.css';
import { toast } from 'react-toastify';


const ChangePasswordForm = ({ onSuccess, onCancel, user }) => {
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if user is using OAuth
  useEffect(() => {
    if (user?.provider && user.provider !== 'email') {
      setError(`Password cannot be changed for ${user.provider} accounts. 
        This account uses ${user.provider} for authentication.`);
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent submission for OAuth users
    if (user?.provider && user.provider !== 'email') {
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/auth/change-password`,
        {
          oldPassword: formData.oldPassword,
          newPassword: formData.newPassword
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (response.data.error) {
        toast(error);
      } else {
        toast(response.data.message)
      }
      onSuccess();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  // If user is using OAuth, show different UI
  if (user?.provider && user.provider !== 'email') {
    return (
      <div className="change-password-form">
        <h3>Password Change Not Available</h3>
        <div className="oauth-message">
          <p>This account uses {user.provider} for authentication.</p>
          <p>To change your password, please visit your {user.provider} account settings.</p>
        </div>
        <div className="form-actions">
          <button type="button" className="cancel-btn" onClick={onCancel}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="change-password-form">
      <h3>Change Password</h3>
      
      <div className="form-group">
        <label>Current Password</label>
        <input
          type="password"
          value={formData.oldPassword}
          onChange={(e) => setFormData({...formData, oldPassword: e.target.value})}
          required
        />
      </div>

      <div className="form-group">
        <label>New Password</label>
        <input
          type="password"
          value={formData.newPassword}
          onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
          required
          minLength="8"
        />
      </div>

      <div className="form-group">
        <label>Confirm New Password</label>
        <input
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
          required
          minLength="8"
        />
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="form-actions">
        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? <span className="loading-spinner"></span> : 'Change Password'}
        </button>
        <button type="button" className="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
};

export default ChangePasswordForm; 