import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStripe } from '../../context/StripeContext';
import { AlertCircle, CheckCircle, Clock, CreditCard } from 'lucide-react';

const SubscriptionStatus = () => {
  const navigate = useNavigate();
  const { 
    checkSubscriptionStatus, 
    subscriptionStatus, 
    fetchSubscriptions, 
    subscriptions,
    createBillingPortalSession
  } = useStripe();
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await checkSubscriptionStatus();
      await fetchSubscriptions();
      setLoading(false);
    };

    loadData();
  }, []);

  const handleManageSubscription = async () => {
    try {
      const { url } = await createBillingPortalSession();
      window.location.href = url;
    } catch (err) {
      console.error('Error creating billing portal session:', err);
    }
  };

  const handleSubscribe = () => {
    navigate('/subscription/select');
  };

  if (loading) {
    return (
      <div className="subscription-status-container loading">
        <div className="status-loading">
          <Clock className="animate-pulse" />
          <p>Loading subscription status...</p>
        </div>
      </div>
    );
  }

  // If user has active subscriptions
  if (subscriptionStatus.hasActiveSubscription && subscriptions.length > 0) {
    return (
      <div className="subscription-status-container active">
        <div className="status-header">
          <CheckCircle className="status-icon active" />
          <h3>Active Subscription</h3>
        </div>
        <div className="subscription-details">
          {subscriptions.map((subscription) => (
            <div key={subscription.subscription_id} className="subscription-item">
              <div className="subscription-name">
                <strong>{subscription.product_name}</strong>
                <span className="subscription-status">{subscription.status}</span>
              </div>
              <div className="subscription-period">
                <span>Renews on {new Date(subscription.current_period_end).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
        <button 
          className="manage-subscription-button"
          onClick={handleManageSubscription}
        >
          <CreditCard className="button-icon" />
          Manage Subscription
        </button>
      </div>
    );
  }

  // If user needs a subscription
  if (subscriptionStatus.subscriptionNeeded) {
    return (
      <div className="subscription-status-container needed">
        <div className="status-header">
          <AlertCircle className="status-icon needed" />
          <h3>Subscription Required</h3>
        </div>
        <div className="status-message">
          <p>
            You've reached {subscriptionStatus.meetingCount} meetings out of the free {subscriptionStatus.subscriptionThreshold} meeting limit.
            Please subscribe to continue using all features.
          </p>
        </div>
        <button 
          className="subscribe-button"
          onClick={handleSubscribe}
        >
          Subscribe Now
        </button>
      </div>
    );
  }

  // Default: User doesn't need a subscription yet
  return (
    <div className="subscription-status-container free">
      <div className="status-header">
        <CheckCircle className="status-icon free" />
        <h3>Free Plan</h3>
      </div>
      <div className="status-message">
        <p>
          You've used {subscriptionStatus.meetingCount} out of {subscriptionStatus.subscriptionThreshold} free meetings.
        </p>
        <div className="meeting-progress">
          <div 
            className="meeting-progress-bar" 
            style={{ width: `${(subscriptionStatus.meetingCount / subscriptionStatus.subscriptionThreshold) * 100}%` }}
          ></div>
        </div>
      </div>
      <button 
        className="upgrade-button"
        onClick={handleSubscribe}
      >
        Upgrade to Premium
      </button>
    </div>
  );
};

export default SubscriptionStatus;

// CSS for this component
const styles = `
.subscription-status-container {
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.status-header {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
}

.status-icon {
  width: 24px;
  height: 24px;
  margin-right: 0.75rem;
}

.status-icon.active {
  color: #10b981;
}

.status-icon.needed {
  color: #ef4444;
}

.status-icon.free {
  color: #3b82f6;
}

.status-header h3 {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
}

.status-message p {
  color: #4b5563;
  margin-bottom: 1rem;
}

.meeting-progress {
  height: 8px;
  background-color: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.meeting-progress-bar {
  height: 100%;
  background-color: #3b82f6;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.subscription-details {
  margin-bottom: 1.5rem;
}

.subscription-item {
  padding: 0.75rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.subscription-item:last-child {
  border-bottom: none;
}

.subscription-name {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.subscription-status {
  text-transform: capitalize;
  font-size: 0.875rem;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  background-color: #10b981;
  color: white;
}

.subscription-period {
  font-size: 0.875rem;
  color: #6b7280;
}

.manage-subscription-button,
.subscribe-button,
.upgrade-button {
  width: 100%;
  padding: 0.75rem;
  border-radius: 6px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.manage-subscription-button {
  background-color: #f3f4f6;
  color: #4b5563;
}

.manage-subscription-button:hover {
  background-color: #e5e7eb;
}

.subscribe-button {
  background-color: #ef4444;
  color: white;
}

.subscribe-button:hover {
  background-color: #dc2626;
}

.upgrade-button {
  background-color: #3b82f6;
  color: white;
}

.upgrade-button:hover {
  background-color: #2563eb;
}

.button-icon {
  width: 18px;
  height: 18px;
  margin-right: 0.5rem;
}

.status-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 0;
}

.status-loading svg {
  width: 24px;
  height: 24px;
  color: #6b7280;
  margin-bottom: 0.75rem;
}

.status-loading p {
  color: #6b7280;
  margin: 0;
}
`;

// // Add the styles to the document
// const styleSheet = document.createElement("style");
// styleSheet.type = "text/css";
// styleSheet.innerText = styles;
// document.head.appendChild(styleSheet);
