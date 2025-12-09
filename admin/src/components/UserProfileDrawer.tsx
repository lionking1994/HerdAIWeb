import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X, User, AlertCircle, Phone, MapPin, ChevronDown, Check, NotebookPen, Loader2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Switch, Listbox } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import 'react-toastify/dist/ReactToastify.css';
import CancelSubscriptionModal from './CancelSubscriptionModal';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  address?: string;
  bio?: string;
  avatar?: string;
  phone?: string;
  location?: string;
  lastLogin?: string;
  company_role_id?: string;
}

interface Subscription {
  id: string;
  subscription_id: string;
  status: string;
  current_period_end: string;
  products: {
    id: number;
    name: string;
    description: string;
    price: {
      amount: number;
      currency: string;
      interval: string;
    }
  }[];
}

interface CompanyRole {
  id: string;
  name: string;
  description: string;
}

interface UserProfileDrawerProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (userId: string, status: string) => void;
  onRoleChange?: (userId: string, role: string) => void;
  onCompanyRoleChange?: (userId: string, companyRoleId: string) => void;
  currentUserRole?: string; // Add this prop
}

const UserProfileDrawer: React.FC<UserProfileDrawerProps> = ({ 
  user, 
  isOpen, 
  onClose,
  onStatusChange,
  onRoleChange,
  onCompanyRoleChange,
  currentUserRole = 'cadmin' // Default to 'user' if not provided
}) => {

  const [isSubscriptions, setIsSubscriptions] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);
  const [companyRoles, setCompanyRoles] = useState<CompanyRole[]>([]);
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');

  const roles = [
    { id: 'user', name: 'User' },
    { id: 'cadmin', name: 'Company Admin' },
    { id: 'padmin', name: 'Platform Admin' },
    { id: 'dev', name: 'Developer' }
  ];

  const getRoleName = (roleId: string) => {
    return roles.find(role => role.id === roleId)?.name || 'User';
  };

  const getCompanyRoleName = (roleId: string) => {
    return companyRoles.find(role => role.id === roleId)?.name || 'None';
  };

  const fetchCompanyRoles = async () => {
    if (!companyId) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/company-roles/${companyId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.data.success) {
        setCompanyRoles(response.data.roles);
      }
    } catch (error) {
      console.error('Error fetching company roles:', error);
    }
  };

  const fetchSubscriptions = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/stripe/a_subscription`,
        {
          subscriptionUserId: user.id
        }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success) {
        setSubscriptions(response.data.subscriptions);
        setIsSubscriptions(response.data.subscriptions.length > 0);
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      toast.error('Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!selectedSubscription) return;
    console.log(selectedSubscription)

    setCancellingSubscription(true);
    try {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/stripe/cancel-subscription/${selectedSubscription.subscription_id}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );


      setShowCancelModal(false);
      fetchSubscriptions(); // Refresh subscription data
      toast.success('Subscription cancelled successfully');
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast.error('Failed to cancel subscription');
    } finally {
      setCancellingSubscription(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      fetchSubscriptions();
      fetchCompanyRoles();
    }
  }, [isOpen, user, companyId]);


  const handleStatusChange = async () => {
    try {
      const newStatus = (user?.status === 'enabled' || !user?.status) ? 'disabled' : 'enabled';
      await onStatusChange?.(user.id, newStatus);
      // Update the local user state
      if (user) {
        user.status = newStatus;
      }
      // Show success toast
      toast.success(`User ${newStatus === 'enabled' ? 'enabled' : 'disabled'} successfully`, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } catch (error) {
      console.error('Failed to update status:', error);
      // Show error toast
      toast.error('Failed to update user status', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  };

  if (!user) return null;

  return (
    <AnimatePresence>
      {isOpen && 
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-xl z-50 overflow-y-auto"
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">User Profile</h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Profile Content */}
              <div className="space-y-6">
                {/* Avatar and Name */}
                <div className="flex items-center space-x-4">
                  <div className="h-24 w-24 flex-none rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                    {user.avatar ? (
                      <img
                        src={`${import.meta.env.VITE_API_BASE_URL}/avatars/${user.avatar}`}
                        alt={user.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl font-semibold text-gray-500 dark:text-gray-400">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">{user.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      mail: <a href={`mailto:${user.email}`} className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">{user.email}</a>
                    </p>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3">
                  {user.phone && (
                    <div className="flex items-center text-sm">
                      <Phone className="h-5 w-5 text-gray-400 mr-3" />
                      <a href={`tel:${user.phone}`} className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">{user.phone}</a>
                    </div>
                  )}
                  {user.location && (
                    <div className="flex items-center text-sm">
                      <MapPin className="h-5 w-5 text-gray-400 mr-3" />
                      <span className="text-gray-600 dark:text-gray-300">{user.location}</span>
                    </div>
                  )}
                  {/* Role Section */}
                {currentUserRole === 'padmin' && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">User Role</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Manage user's access level and permissions
                        </p>
                      </div>
                      <div className="relative">
                        <Listbox
                          value={user.company_role_id}
                          onChange={async (newRole) => {
                            try {
                              await onRoleChange?.(user.id, newRole);
                              // Update the local user state
                              if (user) {
                                user.role = newRole;
                              }
                            } catch (error) {
                              console.error('Failed to update role:', error);
                            }
                          }}
                        >
                          <div className="relative">
                            <Listbox.Button className="inline-flex items-center justify-between w-48 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'cadmin' || user.role === 'padmin'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                  : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                }`}>
                                {getRoleName(user.role)}
                              </span>
                              <ChevronDown className="w-5 h-5 ml-2 -mr-1 text-gray-400" aria-hidden="true" />
                            </Listbox.Button>

                            <Listbox.Options className="absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none">
                              {roles.map((role) => (
                                <Listbox.Option
                                  key={role.id}
                                  value={role.id}
                                  className={({ active, selected }) => `
                                      ${active ? 'bg-indigo-100 dark:bg-indigo-900' : 'text-gray-900 dark:text-gray-100'}
                                      ${selected ? 'bg-indigo-50 dark:bg-indigo-800' : ''}
                                      cursor-pointer select-none relative py-2 pl-3 pr-9
                                    `}
                                >
                                  {({ selected }) => (
                                    <div className="flex items-center">
                                      <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'
                                        }`}>
                                        {role.name}
                                      </span>
                                      {selected && (
                                        <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-indigo-600 dark:text-indigo-400">
                                          <Check className="w-5 h-5" aria-hidden="true" />
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </div>
                        </Listbox>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {user.role === 'padmin' ? 'Full access to all platform features and settings' :
                          user.role === 'cadmin' ? 'Administrative access to company-specific features' :
                            user.role === 'dev' ? 'Developer access to technical features' :
                              'Standard user access to basic features'}
                      </p>
                    </div>
                    </div>
                )}

                {/* Company Role Section */}
                {(currentUserRole === 'padmin' || currentUserRole === 'cadmin') && companyId && companyRoles.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mt-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Company Role</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Assign a company-specific role to this user
                        </p>
                      </div>
                      <div className="relative">
                        <Listbox
                          value={user.company_role_id || ''}
                          onChange={async (newRoleId) => {
                            try {
                              await onCompanyRoleChange?.(user.id, newRoleId);
                              // Update the local user state
                              if (user) {
                                user.company_role_id = newRoleId;
                              }
                            } catch (error) {
                              console.error('Failed to update company role:', error);
                            }
                          }}
                        >
                          <div className="relative">
                            <Listbox.Button className="inline-flex items-center justify-between w-48 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                {user.company_role_id ? getCompanyRoleName(user.company_role_id) : 'None'}
                              </span>
                              <ChevronDown className="w-5 h-5 ml-2 -mr-1 text-gray-400" aria-hidden="true" />
                            </Listbox.Button>

                            <Listbox.Options className="absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none">
                              <Listbox.Option
                                key="none"
                                value=""
                                className={({ active, selected }) => `
                                    ${active ? 'bg-indigo-100 dark:bg-indigo-900' : 'text-gray-900 dark:text-gray-100'}
                                    ${selected ? 'bg-indigo-50 dark:bg-indigo-800' : ''}
                                    cursor-pointer select-none relative py-2 pl-3 pr-9
                                  `}
                              >
                                {({ selected }) => (
                                  <div className="flex items-center">
                                    <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'
                                      }`}>
                                      None
                                    </span>
                                    {selected && (
                                      <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-indigo-600 dark:text-indigo-400">
                                        <Check className="w-5 h-5" aria-hidden="true" />
                                      </span>
                                    )}
                                  </div>
                                )}
                              </Listbox.Option>
                              {companyRoles.map((role) => (
                                <Listbox.Option
                                  key={role.id}
                                  value={role.id}
                                  className={({ active, selected }) => `
                                      ${active ? 'bg-indigo-100 dark:bg-indigo-900' : 'text-gray-900 dark:text-gray-100'}
                                      ${selected ? 'bg-indigo-50 dark:bg-indigo-800' : ''}
                                      cursor-pointer select-none relative py-2 pl-3 pr-9
                                    `}
                                >
                                  {({ selected }) => (
                                    <div className="flex items-center">
                                      <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'
                                        }`}>
                                        {role.name}
                                      </span>
                                      {selected && (
                                        <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-indigo-600 dark:text-indigo-400">
                                          <Check className="w-5 h-5" aria-hidden="true" />
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </div>
                        </Listbox>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Company roles determine user weights and visibility in reports
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Account Status Section */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Account Status</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {user.status !== 'disabled' 
                          ? 'User has full access to the platform' 
                          : 'User access is currently restricted'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Switch
                        checked={user.status !== 'disabled'}
                        onChange={handleStatusChange}
                        className={`${
                          user.status !== 'disabled' ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'
                        } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2`}
                      >
                        <span className="sr-only">Toggle user status</span>
                        <span
                          className={`${
                            user.status !== 'disabled' ? 'translate-x-6' : 'translate-x-1'
                          } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                        />
                      </Switch>
                      <span className={`text-sm font-medium ${
                        user.status !== 'disabled' 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {user.status !== 'disabled' ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>
                {
                  isSubscriptions && (
                    <div className="mt-6 bg-blue-50 dark:bg-blue-900/50 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-lg font-medium text-blue-800 dark:text-blue-200">
                            Active Subscription
                          </h4>
                          <p className="text-sm text-blue-600 dark:text-blue-300 mb-2">
                            This user has an active subscription plan.
                          </p>

                          {subscriptions.length > 0 && subscriptions[0].products && (
                            <div className="mt-2 space-y-1">
                              {subscriptions[0].products.map(product => (
                                <div key={product.id} className="flex justify-between text-sm">
                                  <span className="font-medium">{product.name}</span>
                                  <span>${product.price.amount}/{product.price.interval}</span>
                                </div>
                              ))}
                              <div className="text-xs text-blue-600 dark:text-blue-300 pt-1">
                                Renews: {new Date(subscriptions[0].current_period_end).toLocaleDateString()}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-blue-200 dark:border-blue-700">
                        <button
                          onClick={() => {
                            setSelectedSubscription(subscriptions[0]);
                            setShowCancelModal(true);
                          }}
                          className="w-full flex items-center justify-center px-4 py-2 bg-white dark:bg-gray-800 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                        >
                          <AlertCircle className="w-4 h-4 mr-2" />
                          Cancel Subscription
                        </button>
                      </div>
                    </div>
                  )
                }
              </div>
            </div>
          </div>
          </motion.div>
          <CancelSubscriptionModal
            isOpen={showCancelModal}
            onClose={() => setShowCancelModal(false)}
            onConfirm={handleCancelSubscription}
            isLoading={cancellingSubscription}
            userName={user?.name || 'this user'}
          />
        </>
      }
    </AnimatePresence>
  );
};

export default UserProfileDrawer;
