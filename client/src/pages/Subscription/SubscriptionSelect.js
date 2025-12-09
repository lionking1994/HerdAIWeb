import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStripe } from '../../context/StripeContext';
import { Loader2, Check, X } from 'lucide-react';
import './SubscriptionSelect.css';
import Navbar from '../../components/Navbar';
import { loginFailure, loginSuccess } from '../../store/slices/authSlice';
import { useDispatch, useSelector } from 'react-redux';

const SubscriptionSelect = () => {
  const navigate = useNavigate();
  const {
    products,
    loading,
    error,
    fetchProducts,
    createCheckoutSession,
    checkSubscriptionStatus,
    subscriptionStatus
  } = useStripe();
  
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [includeAgent, setIncludeAgent] = useState(false);
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);

  const calculateTotal = () => {
    if (!selectedProduct) return 0;
    let total = Number(selectedProduct.default_price.unit_amount); // Ensure price is a number
    if (includeAgent) {
      const agentProduct = products.find(p => String(p.name).includes('Agent'));
      total += agentProduct ? Number(agentProduct.default_price.unit_amount) : 0; // Ensure agent price is a number
    }
    return total;
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

    fetchProducts();
    checkSubscriptionStatus();
  }, []);

  // useEffect(() => {
  //   if (subscriptionStatus && !subscriptionStatus.subscriptionNeeded && subscriptionStatus.meetingCount < subscriptionStatus.subscriptionThreshold) {
  //     navigate('/dashboard');
  //   }
  // }, [subscriptionStatus, navigate]);

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
  };

  const handleCheckout = async () => {
    if (!selectedProduct) {
      setCheckoutError('Please select a subscription plan');
      return;
    }

    setIsProcessing(true);
    setCheckoutError(null);

    try {
      const selectedProducts = [selectedProduct.id];
      if (includeAgent) {
        const agentProduct = products.find(p => String(p.name).includes('Agent'));
        if (agentProduct) selectedProducts.push(agentProduct.id);
      }
      const { url } = await createCheckoutSession(selectedProducts);
      window.location.href = url;
    } catch (err) {
      console.error('Error during checkout:', err);
      setCheckoutError('An error occurred during checkout. Please try again.');
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="subscription-select-container">
        <div className="loading-container">
          <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
          <p>Loading subscription plans...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="subscription-select-container">
        <div className="error-container">
          <X className="h-8 w-8 text-red-500" />
          <p>{error}</p>
          <button 
            className="retry-button"
            onClick={fetchProducts}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Sort products to show Single User License first and filter out Agent Licenses and Add-ons
  const sortedProducts = [...products]
    .filter(product => !String(product.name).includes('Agent')) // Filter out Agent Licenses and Add-ons
    .sort((a, b) => {
      if (a.name === 'Single User License') return -1;
      if (b.name === 'Single User License') return 1;
      return 0;
    });

  const agentProduct = products.find(p => String(p.name).includes('Agent')); // Get Agent License for add-on section

  return (
    <>
      <Navbar
        isAuthenticated={true}
        user={user}
        onOpenAuthModal={() => navigate("/")}
      />
    <div className="subscription-select-container">
      <div className="subscription-header">
        <h1>Choose Your Subscription Plan</h1>
        <p>
          You've reached {subscriptionStatus.meetingCount} meetings out of the free {subscriptionStatus.subscriptionThreshold} meeting limit.
          Select a subscription plan to continue using Herd.
        </p>
      </div>

      <div className="subscription-plans">
          {sortedProducts.map((product) => (
          <div 
            key={product.id} 
            className={`subscription-plan ${selectedProduct?.id === product.id ? 'selected' : ''}`}
            onClick={() => handleProductSelect(product)}
          >
            <div className="plan-header">
              <h2>{product.name}</h2>
              <div className="plan-price">
                  <span className="price">${(product.default_price.unit_amount / 100).toFixed(2)}</span>
                  <span className="interval">/{product.default_price.recurring.interval}</span>
              </div>
            </div>
            <div className="plan-description">
              <p>{product.description}</p>
            </div>
            <div className="plan-features">
              <h3>Features</h3>
              <ul>
                  {product.features && Array.isArray(product.features) &&
                    product.features.map((feature, index) => (
                    <li key={index}>
                      <Check className="feature-icon" />
                      <span>{feature}</span>
                    </li>
                  ))
                }
              </ul>
            </div>
            <div className="plan-select">
              <button 
                className={`select-button ${selectedProduct?.id === product.id ? 'selected' : ''}`}
                onClick={() => handleProductSelect(product)}
              >
                {selectedProduct?.id === product.id ? 'Selected' : 'Select Plan'}
              </button>
            </div>
          </div>
        ))}
      </div>

        {selectedProduct && agentProduct && (
          <div className="add-on-section">
            <h3>Add-on</h3>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAgent}
                onChange={(e) => setIncludeAgent(e.target.checked)}
                className="form-checkbox h-5 w-5 text-blue-600"
              />
              <span>AI agent</span>
              <span className="text-gray-600">${(agentProduct?.default_price?.unit_amount / 100).toFixed(2)}/month</span>
            </label>
            <div className="">
              <p>{agentProduct && agentProduct.features && Array.isArray(agentProduct.features) &&
                agentProduct.features.map((feature, index) => (
                  <div className="flex gap-2 mt-5 items-center">
                    <Check className="feature-icon" />
                    <span>{feature}</span>
                  </div>
                ))
              }</p>
            </div>
          </div>
        )}

        {selectedProduct && (
          <div className="total-section mt-4">
            <h3 className="text-xl font-bold">
              Total: ${(calculateTotal() / 100).toFixed(2)}/month
            </h3>
          </div>
        )}

      {checkoutError && (
        <div className="checkout-error">
          <p>{checkoutError}</p>
        </div>
      )}

      <div className="checkout-actions">
        <button 
          className="checkout-button"
          onClick={handleCheckout}
          disabled={isProcessing || !selectedProduct}
        >
          {isProcessing ? (
            <>
              <Loader2 className="animate-spin h-5 w-5 mr-2" />
              Processing...
            </>
          ) : (
            'Proceed to Checkout'
          )}
        </button>
      </div>
    </div>
    </>
  );
};

export default SubscriptionSelect;
