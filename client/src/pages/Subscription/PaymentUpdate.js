import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStripe as useStripeContext } from '../../context/StripeContext';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import Navbar from '../../components/Navbar';
import { useDispatch, useSelector } from 'react-redux';
import { loginFailure, loginSuccess } from '../../store/slices/authSlice';

const PaymentUpdate = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
  const { createBillingPortalSession } = useStripeContext();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setLoading(true);
    setError(null);
    
    try {
      // Redirect to Stripe Billing Portal for payment method update
      const { url } = await createBillingPortalSession();
      window.location.href = url;
    } catch (err) {
      console.error('Error updating payment method:', err);
      setError('Failed to update payment method. Please try again.');
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/auth/profile`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (response.ok) {
          const userData = await response.json();
          dispatch(loginSuccess(userData));
        } else if (response.status === 403) {
          localStorage.removeItem("token");
          navigate("/");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        dispatch(loginFailure(error.message));
      }
    };
    if (!user) {
      fetchUserData();
    }

  }, []);

  const handleGoBack = () => {
    navigate('/subscription/manage');
  };

  return (
    <>
      <Navbar
        isAuthenticated={true}
        user={user}
        onOpenAuthModal={() => navigate("/")}
      />
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-lg mx-auto px-4">
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                Update Payment Method
              </h1>

              {error && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  <span>{error}</span>
                </div>
              )}

              <div className="text-center mb-8">
                <p className="text-gray-600">
                  You'll be redirected to Stripe's secure payment portal to update your payment information.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex flex-col gap-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin h-5 w-5 mr-2" />
                        Redirecting...
                      </>
                    ) : (
                      'Continue to Payment Update'
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleGoBack}
                    className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Back to Subscription
                  </button>
                </div>
              </form>

              <div className="mt-8 border-t border-gray-200 pt-6">
                <div className="flex items-center justify-center text-sm text-gray-500">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Secure payment processing by Stripe</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PaymentUpdate;
