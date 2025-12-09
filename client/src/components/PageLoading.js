import React from 'react';
import { motion } from 'framer-motion';

const PageLoading = ({ message = 'Loading content...' }) => {
  return (
    <motion.div 
      className="flex flex-col items-center justify-center min-h-[200px] w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="w-12 h-12 border-4 border-t-blue-600 border-blue-200 rounded-full animate-spin"></div>
      <p className="mt-3 text-gray-600 font-medium">{message}</p>
    </motion.div>
  );
};

export default PageLoading;