import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import axios from 'axios';
import { toast } from 'react-toastify';


const StripeContext = createContext();

export const useStripe = () => useContext(StripeContext);

export const StripeProvider = ({ children }) => {
  const [stripePromise, setStripePromise] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState({
    meetingCount: 0,
    subscriptionThreshold: 0,
    subscriptionNeeded: false,
    hasActiveSubscription: false,
    activeSubscriptions: []
  });

  useEffect(() => {
    const fetchPublishableKey = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/config/stripe-key`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        const publishableKey = response.data.publishableKey;

        setStripePromise(loadStripe(publishableKey));
      } catch (err) {
        console.error('Error fetching Stripe publishable key:', err);
        setError('Failed to load Stripe. Please try again later.');
      }
    };

    fetchPublishableKey();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/products`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setProducts(response.data.products.filter(product => product.active));
      setLoading(false);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to load subscription products. Please try again later.');
      setLoading(false);
    }
  };

  const fetchSubscriptions = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/stripe/subscriptions`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      console.log(response.data)
      setSubscriptions(response.data.subscriptions);
    } catch (err) {
      toast.error('Failed to fetch subscriptions');
      console.error('Error fetching subscriptions:', err);
    }
  };

  const checkSubscriptionStatus = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/subscription-check/status`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setSubscriptionStatus(response.data);
      return response.data;
    } catch (err) {
      toast.error('Failed to check subscription status');
      console.error('Error checking subscription status:', err);
      return null;
    }
  };

  const createCheckoutSession = async (productIds) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/stripe/checkout-sessions`,
        { productIds },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data;
    } catch (err) {
      toast.error('Failed to create checkout session');
      console.error('Error creating checkout session:', err);
      throw err;
    }
  };

  const createBillingPortalSession = async () => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/stripe/billing-portal`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data;
    } catch (err) {
      toast.error('Failed to create billing portal session');
      console.error('Error creating billing portal session:', err);
      throw err;
    }
  };

  const cancelSubscription = async (subscriptionId) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/stripe/cancel-subscription/${subscriptionId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      await checkSubscriptionStatus(); // Refresh status after cancellation
      return response.data;
    } catch (error) {
      toast.error('Failed to cancel subscription');
      console.error('Error cancelling subscription:', error);
      throw error;
    }
  };

  const value = {
    stripePromise,
    products,
    loading,
    error,
    subscriptions,
    subscriptionStatus,
    fetchProducts,
    fetchSubscriptions,
    checkSubscriptionStatus,
    createCheckoutSession,
    createBillingPortalSession,
    cancelSubscription
  };

  return (
    <StripeContext.Provider value={value}>
      {stripePromise && (
        <Elements stripe={stripePromise}>
          {children}
        </Elements>
      )}
      {!stripePromise && children}
    </StripeContext.Provider>
  );
};

export default StripeContext;
