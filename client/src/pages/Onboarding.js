import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Onboarding.css';
import { toast } from 'react-toastify';


function Onboarding() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const handleComplete = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${process.env.REACT_APP_API_URL}/auth/complete-onboarding`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      navigate('/dashboard');
    } catch (error) {
      toast.error('Failed to complete onboarding');
      console.error('Error completing onboarding:', error);
    }
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-content">
        <h1>Welcome to Our App!</h1>
        {step === 1 && (
          <div className="onboarding-step">
            <h2>Step 1: Welcome</h2>
            <p>Thank you for joining! Let's get you started.</p>
            <button onClick={() => setStep(2)}>Next</button>
          </div>
        )}
        {step === 2 && (
          <div className="onboarding-step">
            <h2>Step 2: Terms of Service</h2>
            <p>Please read and accept our terms of service.</p>
            <button onClick={() => setStep(3)}>Accept & Continue</button>
          </div>
        )}
        {step === 3 && (
          <div className="onboarding-step">
            <h2>All Set!</h2>
            <p>You're ready to start using our app.</p>
            <button onClick={handleComplete}>Get Started</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Onboarding; 