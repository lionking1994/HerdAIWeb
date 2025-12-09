import React, { useEffect, useState } from 'react';
import { Bell, User, ChevronDown, MessageSquare } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { setQuarter } from '../store/slices/quarterSlice';
import type { RootState } from '../store';
import { useSearchParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import FeedbackDrawer from '../components/Feedback/FeedbackDrawer';

interface HeaderProps {
  isMobile: boolean;
  isMenuOpen: boolean;
  setIsMenuOpen: (isOpen: boolean) => void;
}

interface FeedbackStats {
  pending: number;
  approved: number;
  rejected: number;
  completed: number;
}

const Header: React.FC<HeaderProps> = ({
  isMenuOpen,
  setIsMenuOpen
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [companyName, setCompanyName] = useState<string>('');
  const [feedbackCount, setFeedbackCount] = useState<number>(0);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const company = searchParams.get('company');
  const isDashboard = location.pathname === '/dashboard' || location.pathname === '/';
  const { user } = useAuth();
  const [isFeedbackDrawerOpen, setIsFeedbackDrawerOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const currentQuarter = useSelector((state: RootState) => state.quarter.currentQuarter);

  const dispatch = useDispatch();

  const getCurrentQuarter = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuat = Math.floor(now.getMonth() / 3) + 1;
    return `Q${currentQuat}/${currentYear}`;
  };

  const generateQuarters = () => {
    const currentYear = new Date().getFullYear();
    return [
      `YTD/${currentYear}`,
      `Q1/${currentYear}`,
      `Q2/${currentYear}`,
      `Q3/${currentYear}`,
      `Q4/${currentYear}`,
    ];
  };

  const quarters = generateQuarters();

  // Initialize current quarter on component mount
  useEffect(() => {
    dispatch(setQuarter(getCurrentQuarter()));
  }, [dispatch]);

  const handleQuarterSelect = (quarter: string) => {
    dispatch(setQuarter(quarter));
    setIsDropdownOpen(false);
  };


  useEffect(() => {
    const fetchCompanyName = async () => {
      if (company) {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(
            `${import.meta.env.VITE_API_BASE_URL}/company/${company}`,
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          );
          setCompanyName(response.data.company.name);
        } catch (error) {
          console.error('Error fetching company:', error);
          setCompanyName('Unknown Company');
        }
      }
    };

    fetchCompanyName();
  }, [company]);


  useEffect(() => {
    const fetchFeedbackCount = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get<FeedbackStats>(
          `${import.meta.env.VITE_API_BASE_URL}/feedback/stats?path=${window.location.pathname}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        // Set count based on user role
        if (user?.role === 'padmin' || user?.role === 'cadmin') {
          setFeedbackCount(response.data.pending || 0);
        } else if (user?.role === 'dev') {
          setFeedbackCount(response.data.approved || 0);
        }
      } catch (error) {
        console.error('Error fetching feedback count:', error);
      }
    };

    if (user?.role === 'padmin' || user?.role === 'cadmin' || user?.role === 'dev') {
      fetchFeedbackCount();
    }
  }, [location.pathname, user?.role]);

  const getFeedbackTooltip = () => {
    if (user?.role === 'padmin' || user?.role === 'cadmin') {
      return `${feedbackCount} pending requests`;
    } else if (user?.role === 'dev') {
      return `${feedbackCount} approved requests`;
    }
    return '';
  };

  const FeedbackIcon = () => (
    <div className="relative" title={getFeedbackTooltip()}>
      <MessageSquare
        className="h-6 w-6 text-gray-500 hover:text-gray-700 cursor-pointer"
        onClick={() => setIsFeedbackDrawerOpen(true)}
      />
      {feedbackCount > 0 && (
        <span className={`absolute -top-2 -right-2 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ${user?.role === 'dev' ? 'bg-green-500' : 'bg-red-500'
          }`}>
          {feedbackCount}
        </span>
      )}
    </div>
  );

  return (
    <>
      <header className="bg-white shadow-sm px-4 py-3">
        {/* Mobile Header */}
        <div className="sm:hidden">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              {!isMenuOpen && (
                <button
                  className="text-gray-500 p-2 -ml-2"
                  onClick={() => setIsMenuOpen(true)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                </button>
              )}
              <h1 className="text-xl font-bold text-gray-800">
                {company ? companyName : 'Platform'}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <FeedbackIcon />
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
                <img src={`${import.meta.env.VITE_API_BASE_URL}/avatars/${user?.avatar}`} alt="User Avatar" className="h-full w-full object-cover rounded-full" />
              </div>
              <span className="text-sm text-gray-700">Hi, {user?.name}</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3">
            {isDashboard && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Viewing:</span>
                <div className="relative">
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="bg-blue-600 text-white px-3 py-1.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center space-x-1"
                  >
                    <span>{currentQuarter}</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                      {quarters.map((quarter) => (
                        <button
                          key={quarter}
                          onClick={() => handleQuarterSelect(quarter)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${currentQuarter === quarter ? 'bg-blue-100' : ''}`}
                        >
                          {quarter}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center gap-10">
            <h1 className="text-2xl font-bold text-gray-800">
              {company ? companyName : 'Platform'}
            </h1>
            {isDashboard && (
              <div className="flex items-center">
                <span className="text-gray-600 mr-2">Viewing:</span>
                <div className="relative">
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center space-x-2"
                  >
                    <span>{currentQuarter}</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                      {quarters.map((quarter) => (
                        <button
                          key={quarter}
                          onClick={() => handleQuarterSelect(quarter)}
                          className={`w-full text-left px-4 py-2 hover:bg-blue-50 ${currentQuarter === quarter ? 'bg-blue-100' : ''}`}
                        >
                          {quarter}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-6">
            <FeedbackIcon />
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
                <img src={`${import.meta.env.VITE_API_BASE_URL}/avatars/${user?.avatar}`} alt="User Avatar" className="h-full w-full object-cover rounded-full" />
              </div>
              <span className="font-medium text-gray-700">Welcome, {user?.name}</span>
            </div>
          </div>
        </div>
      </header>

      <FeedbackDrawer
        isOpen={isFeedbackDrawerOpen}
        onClose={() => setIsFeedbackDrawerOpen(false)}
        selectedFeedback={selectedFeedback}
        setSelectedFeedback={setSelectedFeedback}
        user={user}
      />
    </>
  );
};

export default Header;
