import React from 'react';
import { useNavigate } from 'react-router-dom';

const Unauthorized = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-gray-800">401</h1>
        <h2 className="text-2xl font-semibold text-gray-600 mt-4">Unauthorized Access</h2>
        <p className="text-gray-500 mt-2">You don't have permission to access this meeting.</p>
        <button
          onClick={() => navigate('/meeting-list')}
          className="mt-6 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Go to Meetings
        </button>
      </div>
    </div>
  );
};

export default Unauthorized;