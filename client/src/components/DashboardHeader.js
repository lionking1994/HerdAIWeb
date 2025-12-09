import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, X } from 'lucide-react';
import { useSelector } from 'react-redux';
import { formatDate } from '../libs/utils';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import useHttp from '../hooks/useHttp';

const quotes = [
  "The secret of getting ahead is getting started",
  "The best way to predict your future is to create it",
  "Don't count the days, make the days",
  "Productivity is never an accident. It is always the result of a commitment to excellence",
  "The way to get started is to quit talking and begin doing"
];

const formulaText = `
Productivity Score = (M × wₘ) + (R × wᵣ) + (T × wₜ) + (G × wₖ)
Where:
- M = Meeting productivity (meetings/max expected)
- R = Research review productivity (reviews/max expected)
- T = Task completion productivity (tasks/max expected)
- G = Ratings given to others (ratings/max expected)
- w = Weight assigned to each category (wₘ + wᵣ + wₜ + wₖ = 1)
`;

const DashboardHeader = ({ userName, onStartTour, showTourButton, onResetLayout }) => {
  const [currentQuote, setCurrentQuote] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [productivityScore, setProductivityScore] = useState(0);
  const [showFormula, setShowFormula] = useState(false);
  const [components, setComponents] = useState(null);
  const [roleName, setRoleName] = useState("");
  const [hasCompanyRole, setHasCompanyRole] = useState(true);
  const { sendRequest } = useHttp();
  const navigate = useNavigate();

  const POLL_INTERVAL = 40000;

  useEffect(() => {
    fetchQuote();
    fetchProductivityScore();

    // Set intervals for updating time and productivity score
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, POLL_INTERVAL);

    // Update productivity score every 5 minutes (300000ms)
    const productivityInterval = setInterval(() => {
      fetchProductivityScore();
    }, POLL_INTERVAL);

    return () => {
      clearInterval(timeInterval);
      clearInterval(productivityInterval);
    };
  }, []);

  const fetchProductivityScore = async () => {
    try {
      const response = await sendRequest({
        url: `${process.env.REACT_APP_API_URL}/users/productivity-score`, 
        method: 'POST',
        body: {
            time: new Date().toLocaleString(),
        },
        headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.success) {
        setProductivityScore(response.productivityScore * 100);
        setComponents(response.components);
        setRoleName(response.role || "");
        setHasCompanyRole(true);
      }
    } catch (error) {
      console.error("Error fetching productivity score:", error);

      // Check if it's a "no company role" error
      if (error.response?.status === 404 && error.response?.no_company_role) {
        setHasCompanyRole(false);
        return; // Don't show error toast for missing company role
      }

      // Show error toast for other errors
      toast.error(`Failed to fetch productivity score`, {
        autoClose: 5000,
        position: "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
    }
  }

  const fetchQuote = async () => {
    const nowdate = new Date();
    const formattedLocalDate = nowdate.getFullYear() + '-' +
      String(nowdate.getMonth() + 1).padStart(2, '0') + '-' +
      String(nowdate.getDate()).padStart(2, '0');
    const response = await fetch(`${process.env.REACT_APP_API_URL}/system-settings/getProductivityQuoteForaday?todaydate=${formattedLocalDate}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (response.ok) {
      const data = await response.json();
      setCurrentQuote(data.quote);
    }
  }

  // Get current time with timezone abbreviation
  const formattedTime = currentTime.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });

  const navigateToTodaysMeetings = () => {
    navigate('/meeting-list?tab=today');
  };

  return (
    <motion.header
      className="bg-[#1D4ED8] text-white py-2 px-4"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="mx-auto flex flex-col items-center text-center">
        <motion.div
          className="text-[#BFDBFE] text-sm w-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {/* check time and say good morning/afternoon/evening, username  */}
          {userName &&
            <div className="flex flex-col md:flex-row items-center w-full md:gap-4 justify-center m-fit-content">
              <div className="flex flex-col md:flex-row gap-2 md:gap-6 ">
                <div className="text-lg font-bold whitespace-nowrap flex flex-col">
                  {currentTime.getHours() < 12 ? 'Good Morning' : currentTime.getHours() < 18 ? 'Good Afternoon' : 'Good Evening'}, {userName?.split(' ')[0]}!
                  {showTourButton && (
                    <div
                      className=""
                      onClick={onStartTour}
                      title="Take a tour of the platform"
                      style={{
                        background: 'white',
                        fontWeight: '600',
                        color: 'black',
                        fontSize: '12px',
                        padding: '5px 10px',
                        boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                        border: 'none',
                        width: 'fit-content',
                        margin: 'auto',
                        borderRadius: '10px',
                        borderWidth: '3px',
                        borderColor: 'black',
                        cursor: 'pointer'
                      }}
                    >
                      Take a Tour
                    </div>
                  )}
                  {/* {onResetLayout && (
                    <div
                      className="ml-2"
                      onClick={onResetLayout}
                      title="Reset dashboard layout to default"
                      style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        fontWeight: '600',
                        color: 'white',
                        fontSize: '12px',
                        padding: '5px 10px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        width: 'fit-content',
                        margin: 'auto',
                        borderRadius: '10px',
                        cursor: 'pointer'
                      }}
                    >
                      Reset Layout
                    </div>
                  )} */}
                </div>
                {currentQuote && <p className="text-sm md:text-lg text-[#BFDBFE] w-fit-content max-w-full md:max-w-lg">{currentQuote}</p>}
              </div>

              {/* Only show productivity score if user has company role */}
              {hasCompanyRole && (
                <div className="w-full md:w-xs items-center flex flex-col max-w-xs mt-3 md:mt-0">
                  <motion.h2
                    className="text-base md:text-lg font-bold mb-1 md:mb-2 flex items-center gap-2 cursor-pointer"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                    onClick={() => {
                      console.log("Clicking productivity score");
                      console.log("showFormula:", showFormula);
                      console.log("components:", components);
                      console.log("hasCompanyRole:", hasCompanyRole);
                      console.log("productivityScore:", productivityScore);
                      setShowFormula(true);
                    }}
                    title="Click to see calculation formula"
                  >
                    Productivity: {productivityScore.toFixed(0)} %
                  </motion.h2>

                  <motion.div
                    className="w-full h-2 md:h-3 bg-[#1E40AF] rounded-full overflow-hidden"
                    transition={{ delay: 0.4, duration: 0.8 }}
                  >
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-200 to-white rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${productivityScore}%` }}
                      transition={{ delay: 0.6, duration: 1.5, ease: "easeOut" }}
                    />
                  </motion.div>
                </div>
              )}
            </div>
          }
        </motion.div>
      </div>

      {/* Modal for formula */}
      {showFormula && hasCompanyRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0008]" onClick={() => setShowFormula(false)}>
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full relative text-gray-800" onClick={e => e.stopPropagation()}>
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 cursor-pointer"
              onClick={() => setShowFormula(false)}
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold mb-4 text-blue-700 flex items-center gap-2">
              <Zap size={20} className="text-yellow-400" /> Productivity Score Calculation
            </h3>
            
            {components ? (
              <div className="text-xs md:text-sm bg-blue-100 rounded p-3 text-gray-800">
                <div className="font-semibold mb-2">
                  Your Calculation Details{roleName ? ` (${roleName})` : ""}:
                </div>
                <div>
                  Productivity Score ({productivityScore.toFixed(0)}) =<br />
                  &nbsp;&nbsp;MeetingsScore (
                  <>Meetings: </><span
                    className="cursor-pointer text-blue-700 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateToTodaysMeetings();
                    }}
                    title="View today's meetings"
                  >
                    {components.meetings.count}
                  </span> / Max: {components.meetings.maxExpected}
                  &nbsp;× Weight: {components.meetings.weight}
                  &nbsp;=&nbsp;
                  {((components.meetings.count / components.meetings.maxExpected) * components.meetings.weight).toFixed(3)}
                  )<br />
                  + ResearchScore (
                  Research: {components.research.count} / Max: {components.research.maxExpected}
                  &nbsp;× Weight: {components.research.weight}
                  &nbsp;=&nbsp;
                  {((components.research.count / components.research.maxExpected) * components.research.weight).toFixed(3)}
                  )<br />
                  + TaskScore (
                  Tasks: {components.tasks.count} / Max: {components.tasks.maxExpected}
                  &nbsp;× Weight: {components.tasks.weight}
                  &nbsp;=&nbsp;
                  {((components.tasks.count / components.tasks.maxExpected) * components.tasks.weight).toFixed(3)}
                  )<br />
                  + RatingsScore (
                  Ratings: {components.ratings.count} / Max: {components.ratings.maxExpected}
                  &nbsp;× Weight: {components.ratings.weight}
                  &nbsp;=&nbsp;
                  {((components.ratings.count / components.ratings.maxExpected) * components.ratings.weight).toFixed(3)}
                  )
                </div>
                <div className="mt-2 font-semibold">
                  Final Score: <span className="text-blue-700">{(productivityScore.toFixed(0))}</span>
                </div>
              </div>
            ) : (
              <div className="text-xs md:text-sm bg-yellow-100 rounded p-3 text-gray-800">
                <div className="font-semibold mb-2">
                  Calculation Details Not Available
                </div>
                <div>
                  Your productivity score is {productivityScore.toFixed(0)}%, but detailed breakdown is not available at the moment.
                  This might be because:
                  <ul className="list-disc list-inside mt-2">
                    <li>You haven't completed any activities yet</li>
                    <li>Data is still being processed</li>
                    <li>There was an issue fetching detailed metrics</li>
                  </ul>
                </div>
              </div>
            )}
            
            <div className="mt-3 text-xs text-gray-500">
              {components ? 
                "Example: If you attend 3 meetings (max 5), complete 2 tasks (max 8), etc., your score is calculated as shown above." :
                "Your productivity score is calculated based on meetings, research, tasks, and ratings you give to others."
              }
            </div>
          </div>
        </div>
      )}
    </motion.header>
  );
};

export default DashboardHeader;
