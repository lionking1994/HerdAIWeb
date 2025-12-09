import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaGraduationCap, FaTimes } from 'react-icons/fa';
import './FirstLoginPopup.css';

const FirstLoginPopup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if this is the first login
    const hasSeenPopup = localStorage.getItem('hasSeenFirstLoginPopup');
    
    if (!hasSeenPopup) {
      // Show popup after a short delay
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem('hasSeenFirstLoginPopup', 'true');
  };

  const handleGoToLearning = () => {
    setIsOpen(false);
    localStorage.setItem('hasSeenFirstLoginPopup', 'true');
    navigate('/learning-dashboard');
  };

  if (!isOpen) return null;

  return (
    <div className="first-login-popup-overlay">
      <div className="first-login-popup">
        <button className="close-button" onClick={handleClose}>
          <FaTimes />
        </button>
        
        <div className="popup-header">
          <div className="popup-icon">
            <FaGraduationCap />
          </div>
          <h2>Welcome to GetHERD!</h2>
        </div>
        
        <div className="popup-content">
          <p>
            Get started with our platform by exploring these key features:
          </p>
          
          {/* <div className="feature-list">
            <div className="feature-item" onClick={handleGoToLearning}>
              <div className="feature-icon learning">
                <FaGraduationCap />
              </div>
              <div className="feature-details">
                <h3>Let's Learn Together</h3>
                <p>Access our learning resources to get the most out of the platform</p>
                <button className="feature-button">View Learning</button>
              </div>
            </div>
          </div> */}
          
          <div className="popup-footer">
            <button className="secondary-button" onClick={handleClose}>
              Skip for now
            </button>
            <button className="primary-button" onClick={handleGoToLearning}>
              Start Learning
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirstLoginPopup;

