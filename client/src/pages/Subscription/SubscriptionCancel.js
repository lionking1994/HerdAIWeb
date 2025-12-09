import React from 'react';
import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';

const SubscriptionCancel = () => {
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate('/subscription/select');
  };

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-lg">
        <div className="flex flex-col items-center text-center">
          <XCircle className="h-20 w-20 text-red-500 mb-6" />

          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Subscription Cancelled
          </h1>

          <p className="text-gray-600 text-lg mb-8">
            Your subscription process was cancelled. No charges have been made to your account.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full mt-5">
            <button 
              className="w-full px-6 py-1 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 
                         rounded-lg transition duration-200 ease-in-out focus:outline-none focus:ring-2 
                         focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
              onClick={handleGoBack}
            >
              Try Again
            </button>

            <button 
              className="w-full px-6 py-1 text-base font-medium text-gray-700 bg-gray-100 
                         hover:bg-gray-200 rounded-lg transition duration-200 ease-in-out 
                         focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 cursor-pointer"
              onClick={handleGoToDashboard}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionCancel;
