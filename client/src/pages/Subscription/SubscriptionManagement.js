import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStripe } from '../../context/StripeContext';
import { 
  CreditCard, 
  AlertCircle, 
  Loader2, 
  Calendar,
  Clock,
  XCircle
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import { useDispatch, useSelector } from 'react-redux';
import { loginFailure, loginSuccess } from '../../store/slices/authSlice';

const SubscriptionManagement = () => {
  const navigate = useNavigate();
  const { 
    checkSubscriptionStatus, 
    subscriptionStatus, 
    fetchSubscriptions, 
    subscriptions,
    createBillingPortalSession,
    cancelSubscription 
  } = useStripe();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await checkSubscriptionStatus();
        await fetchSubscriptions();
      } catch (err) {
        setError('Failed to load subscription information');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

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
    }; if (!user) {
      fetchUserData();
    }

    loadData();
  }, []);

  useEffect(()=>{
    console.log(subscriptions)
  },[subscriptions])

  const handleUpdatePayment = () => {
    navigate('/subscription/payment-update');
  };

  const handleCancelSubscription = async () => {
    try {
      setCancellingSubscription(true);
      await cancelSubscription(currentSubscription.subscription_id);
      setShowCancelModal(false);
      await fetchSubscriptions(); // Refresh subscription data
    } catch (err) {
      setError('Failed to cancel subscription');
      console.error(err);
    } finally {
      setCancellingSubscription(false);
    }
  };


  if (loading) {
    return (
      <>
        <Navbar
          isAuthenticated={true}
          user={user}
          onOpenAuthModal={() => navigate("/")}
        />
        <div className="min-h-screen bg-gray-50 pt-20">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600">Loading subscription details...</span>
          </div>
        </div>
      </>
    );
  }

  if (!subscriptionStatus.hasActiveSubscription) {
    return (
      <>
        <Navbar
          isAuthenticated={true}
          user={user}
          onOpenAuthModal={() => navigate("/")}
        />
        <div className="min-h-screen bg-gray-50 pt-20 px-4">
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md p-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Active Subscription</h2>
              <p className="text-gray-600 mb-4">You currently don't have any active subscriptions.</p>
              <button
                onClick={() => navigate('/subscription/select')}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                View Subscription Plans
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar
        isAuthenticated={true}
        user={user}
        onOpenAuthModal={() => navigate("/")}
      />
      <div className="min-h-screen bg-gray-50 pt-20 px-4">
        <div className="max-w-3xl mx-auto">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              {error}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-6">Subscription Management</h1>

              {subscriptions.map((subscription) => (
                <div key={subscription.subscription_id} className="border-b border-gray-200 pb-6 mb-6 last:border-0 last:mb-0 last:pb-0">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Your Subscription</h2>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        subscription.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Next payment</p>
                      <p className="text-lg font-medium text-gray-900">
                        ${Number(subscription.products?.reduce((total, product) => total + Number(product.price), 0)).toFixed(2)}/month
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Included Products:</h3>
                      <ul className="space-y-2">
                        {subscription.products?.map((product) => (
                          <li key={product.id} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">{product.name}</span>
                            <span className="text-sm font-medium text-gray-900">${product.price}/month</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center text-gray-600">
                        <Calendar className="h-5 w-5 mr-2" />
                        <span>Renews on {new Date(subscription.current_period_end).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Clock className="h-5 w-5 mr-2" />
                        <span>Started on {new Date(subscription.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={handleUpdatePayment}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Update Payment Method
                    </button>
                    <button
                      onClick={() => {
                        setCurrentSubscription(subscription)
                        setShowCancelModal(true)
                      }
                      }
                      className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel Subscription
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-[#0006] flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Cancel Subscription?</h3>
              <p className="text-gray-600 mb-5">
                Are you sure you want to cancel your subscription? You'll lose access to premium features at the end of your current billing period.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  disabled={cancellingSubscription}
                >
                  Keep Subscription
                </button>
                <button
                  onClick={() => handleCancelSubscription()}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                  disabled={cancellingSubscription}
                >
                  {cancellingSubscription ? (
                    <div className="flex items-center">
                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                      Cancelling...
                    </div>
                  ) : (
                    'Yes, Cancel'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SubscriptionManagement;

