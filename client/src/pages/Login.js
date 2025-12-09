import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loginSuccess, loginFailure } from '../store/slices/authSlice';
import Navbar from '../components/Navbar';
import { FaApple, FaMicrosoft } from 'react-icons/fa';
import axios from 'axios';
import Cookies from 'js-cookie';
import { toast } from 'react-toastify';
import useHttp from '../hooks/useHttp';

function Login() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authType, setAuthType] = useState(''); // 'signin' or 'signup'
  const [isLoading, setIsLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState(null); // 'email' or 'oauth'
  const [formType, setFormType] = useState('signin'); // Default to 'signin'
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user: reduxUser, isAuthenticated: reduxIsAuthenticated } = useSelector(state => state.auth);
  const { sendRequest } = useHttp();

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
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState('');
  const [loadingReset, setLoadingReset] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState();

  useEffect(() => {
    // Handle auth callback
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const isNewUser = params.get('isNewUser');
    if (token) {
      localStorage.setItem('token', token);
      fetchUserData(token).then(() => {
        navigate('/dashboard');
      });
    }
  }, [location, navigate, dispatch]);

  const fetchUserData = async (token) => {
    try {
      if(!token) return;
      const userData = await axios.get(`${process.env.REACT_APP_API_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      dispatch(loginSuccess(userData.data));
    } catch (error) {
      console.error('Error fetching user data:', error);
      dispatch(loginFailure(error.message));
    }
  };

  const handleAuthSuccess = (data) => {
    localStorage.setItem('token', data.token);
    fetchUserData(data.token);
    navigate('/dashboard');
  };

  const handleAuthCancel = () => {
    // Logic to handle cancel action, if needed
  };

  const handleGoogleLogin = () => {
    window.location.href = "https://wjvjbeigxp63pfy6343cfffnrq0uzckz.lambda-url.us-east-1.on.aws/auth/google";
    //window.location.href = `${process.env.REACT_APP_API_URL}/auth/google`;
  };

  const handleAppleLogin = () => {
    window.location.href = 'https://wjvjbeigxp63pfy6343cfffnrq0uzckz.lambda-url.us-east-1.on.aws/auth/apple';
  };

  const handleMicrosoftLogin = () => {
    window.location.href = 'https://wjvjbeigxp63pfy6343cfffnrq0uzckz.lambda-url.us-east-1.on.aws/auth/microsoft';
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (formType === 'signup' && formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }
      if (formType === 'signup' && !termsAccepted) {
        throw new Error('You must accept the terms and conditions');
      }

      // Set cookie if terms are accepted
      // if (termsAccepted) {
      //   Cookies.set('termsAccepted', 'true', { expires: 30 }); // Set cookie for 30 days
      // }

      const endpoint = formType === 'signup' ? '/auth/register' : '/auth/login';
      const { data } = await axios.post(
        `${process.env.REACT_APP_API_URL}${endpoint}`,
        formType === 'signup'
          ? { name: formData.name, email: formData.email, password: formData.password }
          : { email: formData.email, password: formData.password, termsAccepted: termsAccepted }
      );
      if (data.error) {
        throw new Error('You must accept the terms and conditions');
      }

      handleAuthSuccess(data);
    } catch (error) {
      // Always show a simple inline error message, no toast
      setError(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFormType = () => {
    setFormType(prevType => (prevType === 'signin' ? 'signup' : 'signin'));
    setError(''); // Clear any existing errors when switching form types
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccessMessage('');
    setShowSuccessMessage(false);
    setLoadingReset(true);

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/auth/forgot-password`, { email: resetEmail });
      toast('Password reset link sent to your email.');
      setShowSuccessMessage(true);
      setResetEmail('');
    } catch (error) {
      setResetError(error.response?.data?.error || 'Failed to send reset link. Please try again.');
    } finally {
      setLoadingReset(false);
    }
  };

  const toggleTermsModal = (e) => {
    e.stopPropagation();
    // Check if terms are accepted and toggle accordingly
    setShowTermsModal(prev => !prev)
    if (termsAccepted) {
      // Cookies.remove('termsAccepted'); // Remove cookie if already set
      setTermsAccepted(false);
    } else {
      // Cookies.set('termsAccepted', 'true', { expires: 30 }); // Set cookie for 30 days
      setTermsAccepted(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-purple-400 to-blue-500">
      <div className='w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-lg'>
        <h2 className='text-2xl font-bold text-center text-gray-800'>
          {showResetPassword ? 'Forgot Password' : (formType === 'signin' ? 'Sign In' : 'Sign Up')}
        </h2>

        {/* Conditional Rendering for Login/Signup Form */}
        {!showResetPassword ? (
          <form onSubmit={handleSubmit} className="email-auth-form space-y-4">
            {formType === 'signup' && (
              <div className="form-group">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  <span>Full Name</span>
                  <div className='input-wrapper'>
                    <input
                      type="text"
                      id="name"
                      placeholder="Enter your full name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                </label>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="input-wrapper relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength="8"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <button
                  type="button"
                  className="absolute right-3 top-4 cursor-pointer"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <i className="fas fa-eye-slash"></i> : <i className="fas fa-eye"></i>}
                </button>
              </div>
            </div>

            {formType === 'signup' && (
              <div className="form-group">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <div className="input-wrapper relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    minLength="8"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                  <button
                    type="button"
                    className="absolute  right-3 top-4 cursor-pointer"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <i className="fas fa-eye-slash"></i> : <i className="fas fa-eye"></i>}
                  </button>
                </div>
              </div>
            )}

            {formType === 'signup' && (
              <div className="mb-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mr-2"
                  />
                  I accept the &nbsp;
                  <button type="button" onClick={toggleTermsModal} className="text-blue-600 hover:underline">
                    terms and conditions
                  </button>
                </label>
              </div>
            )}

            {formType === 'signin' && (
              <div className="mb-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mr-2"
                  />
                  I accept the &nbsp;
                  <button type="button" onClick={toggleTermsModal} className="text-blue-600 hover:underline">
                    terms and conditions
                  </button>
                </label>
              </div>
            )}

            {error && (
              <div className="text-red-600 bg-red-50 border-2 border-red-400 rounded-lg p-3 mt-3 shadow-sm">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <span className="font-medium text-red-500">{error}</span>
                    {error === 'No account found' && (
                      <div className="mt-2 text-sm">
                        <span className="text-red-600">No account found, please </span>
                        <button 
                          type="button" 
                          onClick={() => {
                            setFormType('signup');
                            setError('');
                          }}
                          className="text-blue-600 hover:underline font-medium cursor-pointer"
                        >
                          sign up
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div>
              <button type="submit" className={`cursor-pointer w-full py-2 text-white ${loading ? 'bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`} disabled={loading}>
                {loading ? <span className="loading-spinner"></span> : formType === 'signup' ? 'Create Account' : 'Sign In'}
              </button>
            </div>
          </form>
        ) : (
            <form onSubmit={handleResetPassword} className="reset-password-form mt-4 space-y-4">
            <div className="form-group">
              <label htmlFor="resetEmail" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  id="resetEmail"
                  name="resetEmail"
                  placeholder="Enter your email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>
            {resetError && <div className="error-message text-red-500">{resetError}</div>}
            {resetSuccessMessage && <div className="success-message text-green-500">{resetSuccessMessage}</div>}
            <div>
              <button type="submit" className={`cursor-pointer w-full py-2 text-white ${loadingReset ? 'bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`} disabled={loadingReset}>
                {loadingReset ? <span className="loading-spinner"></span> : 'Send Reset Link'}
              </button>
            </div>
            <div className='text-center mt-4'>
              <button onClick={() => setShowResetPassword(false)} className='text-blue-600 hover:underline cursor-pointer'>
                Back to Login
              </button>
            </div>
          </form>
        )}

        {/* Show Forgot Password link only when not in reset password mode */}
        {!showResetPassword && (
          <div className='text-center mt-4'>
            <button onClick={() => setShowResetPassword(true)} className='text-blue-600 hover:underline cursor-pointer'>
              Forgot Password?
            </button>
          </div>
        )}

        <div className='flex items-center justify-between'>
          <hr className='flex-grow border-gray-300' />
          <span className='mx-2 text-gray-600'>or</span>
          <hr className='flex-grow border-gray-300' />
        </div>
        <div className='space-y-4'>
          <button className="flex cursor-pointer justify-center gap-2 w-full py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={isLoading} onClick={() => handleGoogleLogin()}>
            <img className='w-6' src="/google-icon.svg" alt="Google" />
            <span>Continue with Google</span>
          </button>

          <button className="flex cursor-pointer justify-center gap-2 w-full py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={isLoading} onClick={() => handleAppleLogin()}>
            <FaApple className="h-5 w-5" />
            <span>Continue with Apple</span>
          </button>

          <button className="flex cursor-pointer justify-center gap-2 w-full py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={isLoading} onClick={() => handleMicrosoftLogin()}>
            <FaMicrosoft className="h-5 w-5" />
            <span>Continue with Microsoft</span>
          </button>

        </div>
        <div className='text-center'>
          <span className='text-sm text-gray-600 '>
            {formType === 'signin' ? `Don't have an account?` : 'Already have an account? '}
            <button onClick={toggleFormType} className='text-blue-600 hover:underline cursor-pointer'>
              {formType === 'signin' ? 'Sign Up' : 'Sign In'}
            </button>
          </span>
        </div>

        {/* Modal for Terms and Conditions */}
        {showTermsModal && (
          <div className="fixed inset-0 bg-[#0008] bg-opacity-50 flex items-center justify-center z-50">
            <div className="modal-content bg-white rounded-lg shadow-lg p-6 max-w-lg w-full">
              {/* Header */}
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Terms and Conditions</h2>
                <span className="close cursor-pointer text-gray-500 hover:text-gray-700" onClick={toggleTermsModal}>&times;</span>
              </div>
              {/* Main Body */}
              <div className="mt-4 overflow-y-auto" style={{ maxHeight: '400px' }}>
                <p className="text-sm text-gray-700 mb-2">Last Updated: February 18, 2025</p>
                <p className="mb-4">Please read these Terms and Conditions ("Terms", "Terms and Conditions") carefully before using Herd AI, Inc.'s software-as-a-service platform ("Service").</p>

                <h3 className="font-semibold mt-4">1. Acceptance of Terms</h3>
                <p>By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of the Terms, you may not access the Service.</p>

                <h3 className="font-semibold mt-4">2. Subscription Terms</h3>
                <p>2.1. The Service is billed on a subscription basis with a Billing Cycle of thirty (30) days ("Billing Cycle"). You will be billed in advance on a recurring basis every thirty (30) days.</p>
                <p>2.2. Subscription fees are non-refundable except as specifically provided in these Terms or as required by applicable United States federal or Georgia state law.</p>
                <p>2.3. We reserve the right to change subscription fees upon thirty (30) days notice. Your continued use of the Service after such changes constitutes acceptance of the new fees.</p>

                <h3 className="font-semibold mt-4">3. User Account</h3>
                <p>3.1. You must create an account to use the Service. You are responsible for maintaining the confidentiality of your account credentials.</p>
                <p>3.2. You are responsible for all activities that occur under your account.</p>

                <h3 className="font-semibold mt-4">4. Acceptable Use</h3>
                <p>4.1. You agree not to:</p>
                <ul className="list-disc list-inside mb-4">
                  <li>Use the Service for any illegal purpose under United States federal law or Georgia state law</li>
                  <li>Violate any applicable laws or regulations</li>
                  <li>Infringe upon the rights of others</li>
                  <li>Attempt to gain unauthorized access to the Service</li>
                  <li>Transmit malware or harmful code</li>
                  <li>Interfere with the proper functioning of the Service</li>
                </ul>

                <h3 className="font-semibold mt-4">5. Intellectual Property and Data Ownership</h3>
                <p>5.1. The Service and its original content, features, and functionality are owned by Herd AI, Inc. and are protected by United States copyright, trademark, patent, trade secret, and other intellectual property laws.</p>
                <p>5.2. Any and all data, information, content, or materials submitted, uploaded, or transmitted through the Service ("User Data") shall become the exclusive property of Herd AI, Inc. By using the Service, you hereby assign and transfer to Herd AI, Inc. all right, title, and interest in and to all User Data.</p>
                <p>5.3. Herd AI, Inc. shall have the perpetual, irrevocable right to use, modify, adapt, reproduce, distribute, and exploit any User Data for any purpose, without compensation to you.</p>

                <h3 className="font-semibold mt-4">6. Data Privacy and Security</h3>
                <p>6.1. Our Privacy Policy, available at [Privacy Policy URL], describes how we collect, use, and share your information in accordance with applicable United States federal and Georgia state privacy laws.</p>
                <p>6.2. While we implement reasonable security measures, we cannot guarantee absolute security of your data.</p>

                <h3 className="font-semibold mt-4">7. Limitation of Liability</h3>
                <p>7.1. TO THE MAXIMUM EXTENT PERMITTED BY GEORGIA LAW AND UNITED STATES FEDERAL LAW, IN NO EVENT SHALL HERD AI, INC., ITS DIRECTORS, EMPLOYEES, PARTNERS, AGENTS, SUPPLIERS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:</p>
                <p>a) YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE SERVICE;</p>
                <p>b) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE SERVICE;</p>
                <p>c) ANY CONTENT OBTAINED FROM THE SERVICE; AND</p>
                <p>d) UNAUTHORIZED ACCESS, USE, OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT.</p>
                <p>7.2. IN NO EVENT SHALL OUR TOTAL LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE EXCEED THE AMOUNT PAID BY YOU FOR THE SERVICE IN THE 12 MONTHS PRECEDING THE INCIDENT.</p>

                <h3 className="font-semibold mt-4">8. Disclaimer of Warranties</h3>
                <p>8.1. THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, TO THE MAXIMUM EXTENT PERMITTED BY GEORGIA LAW.</p>
                <p>8.2. HERD AI, INC. MAKES NO WARRANTY THAT:</p>
                <p>a) THE SERVICE WILL MEET YOUR REQUIREMENTS</p>
                <p>b) THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE</p>
                <p>c) THE RESULTS FROM THE SERVICE WILL BE ACCURATE OR RELIABLE</p>

                <h3 className="font-semibold mt-4">9. Service Modifications</h3>
                <p>9.1. We reserve the right to modify or discontinue, temporarily or permanently, the Service with or without notice.</p>
                <p>9.2. We shall not be liable to you or any third party for any modification, suspension, or discontinuance of the Service.</p>

                <h3 className="font-semibold mt-4">10. Termination</h3>
                <p>10.1. We reserve the right to terminate or suspend your access to the Service immediately, at any time, with or without cause or notice, and without any liability to you.</p>
                <p>10.2. Upon termination:</p>
                <ul className="list-disc list-inside mb-4">
                  <li>a) Your right to use the Service will immediately cease</li>
                  <li>b) We may delete or retain your User Data at our sole discretion</li>
                  <li>c) Any outstanding payment obligations will become immediately due</li>
                  <li>d) Sections regarding intellectual property rights, data ownership, limitation of liability, and governing law shall survive termination</li>
                </ul>
                <p>10.3. We shall not be liable to you or any third party for any claims or damages arising from or related to any termination or suspension of the Service.</p>

                <h3 className="font-semibold mt-4">11. Governing Law and Jurisdiction</h3>
                <p>11.1. These Terms shall be governed by and construed in accordance with the laws of the State of Georgia, United States, without regard to its conflict of law provisions.</p>
                <p>11.2. Any dispute arising from or relating to these Terms shall be subject to the exclusive jurisdiction of the state and federal courts located in Georgia, United States.</p>
                <p>11.3. You agree to submit to the personal jurisdiction of the courts located in Georgia for the purpose of litigating any claims arising from these Terms.</p>

                <h3 className="font-semibold mt-4">12. Changes to Terms</h3>
                <p>12.1. We reserve the right to modify these Terms at any time. We will notify users of any material changes via email or through the Service.</p>
                <p>12.2. Your continued use of the Service after such modifications constitutes your acceptance of the modified Terms.</p>

                <h3 className="font-semibold mt-4">13. Severability</h3>
                <p>13.1. If any provision of these Terms is found to be unenforceable or invalid under any applicable law, such unenforceability or invalidity shall not render these Terms unenforceable or invalid as a whole, and such provisions shall be deleted without affecting the remaining provisions herein.</p>

                <h3 className="font-semibold mt-4">14. Contact Information</h3>
                <p>14.1. For any questions about these Terms, please contact us at support@getherd.ai.</p>

                <h3 className="font-semibold mt-4">15. Compliance with Laws</h3>
                <p>15.1. You agree to comply with all applicable federal, state, and local laws and regulations, including but not limited to United States export control laws.</p>
                <p>15.2. If you access the Service from outside the United States, you do so at your own risk and are responsible for compliance with local laws.</p>
              </div>
              {/* Footer */}
              <div className="mt-4">
                <button onClick={toggleTermsModal} className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;
