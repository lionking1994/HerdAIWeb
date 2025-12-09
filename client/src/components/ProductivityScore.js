import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { toast } from 'react-toastify';

const ProductivityScore = () => {
  const [productivityScore, setProductivityScore] = useState(0);
  const [components, setComponents] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompanyRole, setHasCompanyRole] = useState(true);

  useEffect(() => {
    fetchProductivityScore();
  }, []);

  const fetchProductivityScore = async () => {
    try {
      setIsLoading(true);
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/users/productivity-score`, {
        time: new Date().toLocaleString(),
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.status === 200) {
        const data = response.data;
        setProductivityScore(data.productivityScore * 100);
        setComponents(data.components);
        setHasCompanyRole(true);
      }
    } catch (error) {
      console.error("Error fetching productivity score:", error);
      if (error.response?.status === 404 && error.response?.data?.no_company_role) {
        setHasCompanyRole(false);
        return;
      }
      toast.error('Failed to fetch productivity score');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <motion.div
        className="bg-[#2563EB] text-white p-6 h-full flex flex-col justify-center items-center text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
        <p className="mt-4 text-lg">Loading productivity score...</p>
      </motion.div>
    );
  }

  if (!hasCompanyRole) {
    return (
      <motion.div
        className="bg-[#2563EB] text-white p-6 h-full flex flex-col justify-center items-center text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <motion.h2
          className="text-xl font-bold mb-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          Productivity Score
        </motion.h2>
        <p className="text-lg text-[#DBEAFE]">
          Company role not assigned. Please contact your administrator to set up your role.
        </p>
      </motion.div>
    );
  }
  
  return (
    <motion.div 
      className="bg-[#2563EB] text-white p-6 h-full flex flex-col justify-center items-center text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.h2 
        className="text-2xl font-bold mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        Today's Productivity: {productivityScore.toFixed(0)}%
      </motion.h2>
      
      <motion.div 
        className="w-full h-4 bg-[#1E40AF] rounded-full mb-6 overflow-hidden"
        initial={{ width: 0 }}
        animate={{ width: '100%' }}
        transition={{ delay: 0.4, duration: 0.8 }}
      >
        <motion.div 
          className="h-full bg-white rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(productivityScore, 100)}%` }}
          transition={{ delay: 0.6, duration: 1.5, ease: "easeOut" }}
        />
      </motion.div>
      
      {components && (
        <motion.div
          className="text-sm text-[#DBEAFE] space-y-2 w-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Meetings: {components.meetings.count}/{components.meetings.maxExpected}</div>
            <div>Tasks: {components.tasks.count}/{components.tasks.maxExpected}</div>
            <div>Research: {components.research.count}/{components.research.maxExpected}</div>
            <div>Ratings: {components.ratings.count}/{components.ratings.maxExpected}</div>
          </div>
        </motion.div>
      )}

      <motion.p
        className="text-lg text-[#DBEAFE] mt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0, duration: 0.6 }}
      >
        {productivityScore >= 80 ? "Excellent work! Keep it up!" :
          productivityScore >= 60 ? "Good progress! You're on track." :
            "Let's boost your productivity today!"}
      </motion.p>
    </motion.div>
  );
};

export default ProductivityScore;