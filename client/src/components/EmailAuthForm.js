import React, { useState } from 'react';
import axios from 'axios';
import './EmailAuthForm.css';
import { toast } from 'react-toastify';

const EmailAuthForm = ({ type, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (type === 'signup' && formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      const endpoint = type === 'signup' ? '/auth/register' : '/auth/login';
      const { data } = await axios.post(
        `${process.env.REACT_APP_API_URL}${endpoint}`,
        type === 'signup' 
          ? { name: formData.name, email: formData.email, password: formData.password }
          : { email: formData.email, password: formData.password }
      );

      onSuccess(data);
    } catch (error) {
      toast(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setError('Please enter your email first');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/auth/forgot-password`, {
        email: formData.email
      });
      setShowForgotPassword(true);
    } catch (error) {
      toast(error.response?.data?.error || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="email-auth-form">
      <div className="form-header">
        <h3>{type === 'signup' ? 'Create Account' : 'Welcome Back'}</h3>
        <p>{type === 'signup' ? 'Join our community today' : 'Sign in to your account'}</p>
      </div>

      {type === 'signup' && (
        <div className="form-group">
          <label htmlFor="name">
            <span>Full Name</span>
            <div className='input-wrapper'>
              <input
                type="text"
                id="name"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
          </label>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="email">
          <span>Email Address</span>
          <div className="input-wrapper">
            <input
              type="email"
              id="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="password">
          <span>Password</span>
          <div className="input-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              placeholder={type === 'signup' ? 'Create a password' : 'Enter your password'}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength="8"
            />
            <button 
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <i className="fas fa-eye-slash"></i>
              ) : (
                <i className="fas fa-eye"></i>
              )}
            </button>
          </div>
        </label>
      </div>

      {type === 'signup' && (
        <div className="form-group">
          <label htmlFor="confirmPassword">
            <span>Confirm Password</span>
            <div className="input-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                minLength="8"
              />
              <button 
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <i className="fas fa-eye-slash"></i>
                ) : (
                  <i className="fas fa-eye"></i>
                )}
              </button>
            </div>
          </label>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {type === 'signin' && !showForgotPassword && (
        <div className="forgot-password">
          <button type="button" onClick={handleForgotPassword}>
            Forgot your password?
          </button>
        </div>
      )}

      {showForgotPassword ? (
        <div className="success-message">
          Password reset instructions have been sent to your email.
        </div>
      ) : (
        <div className="form-actions">
          <button type="submit" className="cancel-btn" disabled={loading}>
            {loading ? (
              <span className="loading-spinner"></span>
            ) : (
              type === 'signup' ? 'Create Account' : 'Sign In'
            )}
          </button>
          <button type="button" className="cancel-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      )}
    </form>
  );
};

export default EmailAuthForm; 