import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './ResetPassword.css';

function ResetPassword() {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const token = new URLSearchParams(location.search).get('token');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (token) {
        // Reset password with token
        await axios.post(`${process.env.REACT_APP_API_URL}/auth/reset-password`, {
          token,
          newPassword
        });
        setMessage('Password reset successful. You can now login.');
        setTimeout(() => navigate('/'), 3000);
      } else {
        // Request password reset
        await axios.post(`${process.env.REACT_APP_API_URL}/auth/forgot-password`, {
          email
        });
        setMessage('Password reset instructions sent to your email.');
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-purple-400 to-blue-500">
      <div className='w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-lg'>
        <h2>{token ? 'Reset Your Password' : 'Forgot Password'}</h2>
        
        {message ? (
          <div className="success-message">{message}</div>
        ) : (
          <form onSubmit={handleSubmit}>
            {token ? (
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength="8"
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            ) : (
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            )}

            {error && <div className="error-message">{error}</div>}

              <button type="submit" disabled={loading} className={`cursor-pointer w-full py-2 text-white ${loading ? 'bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}>
              {loading ? 'Please wait...' : token ? 'Reset Password' : 'Send Reset Link'}
            </button>

              <button type="button" className="back-btn text-blue-600 hover:underline cursor-pointer" onClick={() => navigate('/')}>
              Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default ResetPassword; 