import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Building2, User, Target, ChevronDown, ChevronRight, Mail, Phone, Globe, MapPin, Calendar, DollarSign, Loader2 } from 'lucide-react';
import UserProfileDrawer from '../UserProfileDrawer';

const CrmApprovalNode = ({ nodeInstance, onApproval, isSubmitting = false, isApproval = '' }) => {
  const { result, status, node_name } = nodeInstance;
  const [selectedCrmItems, setSelectedCrmItems] = useState([]);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [crmData, setCrmData] = useState({
    accounts: [],
    contacts: [],
    opportunities: []
  });
  const [companyUsers, setCompanyUsers] = useState([]);
  const [isLoadingCrmData, setIsLoadingCrmData] = useState(false);
  const [comments, setComments] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({
    accounts: true,
    contacts: true,
    opportunities: true
  });

  const [approverUser, setApproverUser] = useState(null);
  const [assignedSellers, setAssignedSellers] = useState({});
  const [meetingOwner, setMeetingOwner] = useState(null);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  useEffect(() => {
    const fetchApproverUser = async () => {
    if( status === 'completed' && result.approverId){
      const response = await fetch(`${process.env.REACT_APP_API_URL}/users/get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          userId: result.approverId
        })
      });
      const data = await response.json();
      setApproverUser(data.user);
    }
  };
  fetchApproverUser();
}, [status, result.approverId]);


  // Fetch CRM data when component mounts
  const fetchCrmData = useCallback(async () => {
    setIsLoadingCrmData(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/workflow/crm-data?workflow_node_instance_id=${nodeInstance.id}`);
      const data = await response.json();
      
      const crmData = {
        accounts: [],
        contacts: [],
        opportunities: []
      }

      for(const item of data.graph_data.graph_data.visualization.nodes){
        if(item.group === 'company'){
          crmData.accounts.push(item);
        }
        else if(item.group === 'person'){
          crmData.contacts.push(item);
        } else if(item.group === 'opportunity'){
          crmData.opportunities.push(item);
        }
      }
      console.log("🤔🤔🤔 crmData:", crmData);
      setCrmData(crmData);
      
      // Set company users from API response
      if (data.company_users) {
        setCompanyUsers(data.company_users);
        console.log("🏢 Company users:", data.company_users);
      }
      
      // Set all items as selected by default
      const allItemIds = [
        ...crmData.accounts.map(item => item.id),
        ...crmData.contacts.map(item => item.id),
        ...crmData.opportunities.map(item => item.id)
      ];
      setSelectedCrmItems(allItemIds);

      // Get meeting owner from workflow instance data
      if (data.workflow_instance && data.workflow_instance.data) {
        const workflowData = data.workflow_instance.data;
        if (workflowData.meeting_owner_id) {
          setMeetingOwner({
            id: workflowData.meeting_owner_id,
            name: workflowData.meeting_owner_name || 'Meeting Owner'
          });
        }
      }
      
    } catch (error) {
      console.error('Error fetching CRM data:', error);
    } finally {
      setIsLoadingCrmData(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'waiting_user_input') {
      fetchCrmData();
    }
  }, [status, fetchCrmData]);

  // Set default assigned sellers to meeting owner when data is loaded
  useEffect(() => {
    if (meetingOwner && crmData.opportunities.length > 0 && Object.keys(assignedSellers).length === 0) {
      const defaultAssignedSellers = {};
      crmData.opportunities.forEach(opportunity => {
        // Find if meeting owner exists in company users
        const meetingOwnerUser = companyUsers.find(user => user.user_id === meetingOwner.id);
        if (meetingOwnerUser) {
          defaultAssignedSellers[opportunity.id] = meetingOwner.id;
        }
      });
      setAssignedSellers(defaultAssignedSellers);
    }
  }, [meetingOwner, crmData.opportunities, companyUsers, assignedSellers]);

  const handleItemCheckboxChange = (type, itemId, checked) => {
    setSelectedCrmItems(prev => {
      if (checked) {
        // Add item ID to the array if not already present
        if (!prev.includes(itemId)) {
          return [...prev, itemId];
        }
      } else {
        // Remove item ID from the array
        return prev.filter(id => id !== itemId);
      }
      return prev;
    });
  };

  const handleAssignedSellerChange = (opportunityId, contactId) => {
    setAssignedSellers(prev => ({
      ...prev,
      [opportunityId]: contactId
    }));
  };

  const toggleGroupExpansion = (groupType) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupType]: !prev[groupType]
    }));
  };

  const handleApprovalWithCrmItems = (decision) => {
    // Send the selected item IDs and assigned sellers to the approval API
    const approvalData = {
      selectedCrmItems,
      assignedSellers,
      comments
    };
    onApproval(decision, approvalData);
  };

  const renderAccountItem = (account) => (
    <div key={account.id} className="bg-white border border-gray-200 rounded-lg p-4 mb-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <input 
            type="checkbox" 
            checked={selectedCrmItems.includes(account.id)}
            onChange={(e) => handleItemCheckboxChange('accounts', account.id, e.target.checked)}
            className="w-5 h-5 rounded border-gray-300 focus:ring-2 focus:ring-blue-500 focus:ring-1 mt-1"
          />
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <h4 className="font-semibold text-gray-900">{account.label}</h4>
              {account.account_type && (
                <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                  {account.account_type}
                </span>
              )}
            </div>
            
            {account.description && (
              <p className="text-sm text-gray-600 mb-3">{account.description}</p>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {account.industry && (
                <div className="flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{account.industry}</span>
                </div>
              )}
              {account.website && (
                <div className="flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-gray-400" />
                  <a href={account.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {account.website}
                  </a>
                </div>
              )}
              {account.phone && (
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{account.phone}</span>
                </div>
              )}
              {account.email && (
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{account.email}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContactItem = (contact) => (
    <div key={contact.id} className="bg-white border border-gray-200 rounded-lg p-4 mb-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <input 
            type="checkbox" 
            checked={selectedCrmItems.includes(contact.id)}
            onChange={(e) => handleItemCheckboxChange('contacts', contact.id, e.target.checked)}
            className="w-5 h-5 rounded border-gray-300 focus:ring-2 focus:ring-green-500 focus:ring-1 mt-1"
          />
          <div className="flex-1 flex gap-6">
            <div className="flex items-center space-x-2 ">
              <User className="w-4 h-4 text-green-600" />
              <h4 className="font-semibold text-gray-900">
                {contact.label}
              </h4>
              {contact.title && (
                <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                  {contact.title}
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {contact.email && (
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                    {contact.email}
                  </a>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{contact.phone}</span>
                </div>
              )}
              {contact.mobile_phone && (
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Mobile: {contact.mobile_phone}</span>
                </div>
              )}
              {contact.department && (
                <div className="flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{contact.department}</span>
                </div>
              )}
              {(contact.city || contact.state || contact.country) && (
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">
                    {[contact.city, contact.state, contact.country].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderOpportunityItem = (opportunity) => (
    <div key={opportunity.id} className="bg-white border border-gray-200 rounded-lg p-4 mb-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <input 
            type="checkbox" 
            checked={selectedCrmItems.includes(opportunity.id)}
            onChange={(e) => handleItemCheckboxChange('opportunities', opportunity.id, e.target.checked)}
            className="w-5 h-5 rounded border-gray-300 focus:ring-2 focus:ring-purple-500 focus:ring-1 mt-1"
          />
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <Target className="w-4 h-4 text-purple-600" />
              <h4 className="font-semibold text-gray-900">{opportunity.label}</h4>
              {opportunity.stage && (
                <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                  {opportunity.stage}
                </span>
              )}
            </div>
            
            {opportunity.description && (
              <p className="text-sm text-gray-600 mb-3">{opportunity.description}</p>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {opportunity.amount && (
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600 font-medium">{formatCurrency(opportunity.amount)}</span>
                </div>
              )}
              {opportunity.probability && (
                <div className="flex items-center space-x-2">
                  <Target className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{opportunity.probability}% probability</span>
                </div>
              )}
              {opportunity.expected_close_date && (
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Close: {formatDate(opportunity.expected_close_date)}</span>
                </div>
              )}
              {opportunity.lead_source && (
                <div className="flex items-center space-x-2">
                  <Target className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Source: {opportunity.lead_source}</span>
                </div>
              )}
            </div>

            {/* Assign Seller Dropdown */}
            <div className="mt-4">
              <label htmlFor={`assignedSeller-${opportunity.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                Assign Seller
              </label>
              <select
                id={`assignedSeller-${opportunity.id}`}
                value={assignedSellers[opportunity.id] || ''}
                onChange={(e) => handleAssignedSellerChange(opportunity.id, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a seller</option>
                {companyUsers.map(user => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.user_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCrmGroup = (groupType, items, icon, title, color) => (
    <div className="mb-6">
      <div 
        className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => toggleGroupExpansion(groupType)}
      >
        <div className="flex items-center space-x-3">
          {icon}
          <span className="text-lg font-semibold text-gray-900">{title}</span>
          <span className="px-2 py-1 text-sm bg-gray-200 text-gray-700 rounded-full">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
          <span className="px-2 py-1 text-sm bg-blue-100 text-blue-700 rounded-full">
            {items.filter(item => selectedCrmItems.includes(item.id)).length} selected
          </span>
        </div>
        {expandedGroups[groupType] ? (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-500" />
        )}
      </div>
      
      {expandedGroups[groupType] && (
        <div className="mt-3 ml-6">
          {isLoadingCrmData ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading {title}...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <icon.type className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No {title.toLowerCase()} found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(item => {
                switch (groupType) {
                  case 'accounts':
                    return renderAccountItem(item);
                  case 'contacts':
                    return renderContactItem(item);
                  case 'opportunities':
                    return renderOpportunityItem(item);
                  default:
                    return null;
                }
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {node_name || 'CRM Approval Required'}
        </h3>
        <p className="text-sm text-gray-600">
          Review and select CRM items before approving or rejecting
        </p>
      </div>
      
      {/* Approval Status */}
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className={`w-3 h-3 rounded-full ${
            status === 'completed' 
              ? result?.decision === 'approved' ? 'bg-green-500' : 'bg-red-500'
              : 'bg-blue-500'
          }`}></div>
          <span className="font-medium text-gray-900">
            Status: {status === 'completed' ? 'Completed' : 'Pending'}
          </span>
        </div>
        
        {status === 'completed' && result && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                result.decision === 'approved' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {result.decision === 'approved' ? 'Approved' : 'Rejected'}
              </span>
              {result.approverName && (
                <span className="text-sm text-gray-600 flex gap-4 items-center">
                  by {approverUser?.name} <img src={`${process.env.REACT_APP_API_URL}/avatars/${approverUser?.avatar}`} alt="approver" className="w-8 h-8 rounded-full" onClick={() => setShowProfileDrawer(true)} />
                </span>
              )}
            </div>
            {result.selectedCrmItems && Object.keys(result.selectedCrmItems).some(key => result.selectedCrmItems[key].length > 0) && (
              <div className="text-sm text-gray-700 mt-2">
                <strong>Selected CRM Items:</strong>
                <div className="mt-1 space-y-1">
                  {Object.entries(result.selectedCrmItems).map(([type, items]) => 
                    items.length > 0 && (
                      <div key={type} className="text-xs">
                        <span className="font-medium capitalize">{type}:</span> {items.length} selected
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
            {result.timestamp && (
              <div className="text-xs text-gray-500 mt-2">
                {formatDate(result.timestamp)}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* CRM Item Selection - Only show if pending */}
      {status === 'waiting_user_input' && onApproval && (
        <div className="border-t pt-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Select CRM Items</h4>
          
         
          {/* CRM Groups */}
          <div className="space-y-4">
            {renderCrmGroup(
              'accounts', 
              crmData.accounts, 
              <Building2 className="w-5 h-5 text-blue-600" />, 
              'Accounts', 
              'blue'
            )}
            
            {renderCrmGroup(
              'contacts', 
              crmData.contacts, 
              <User className="w-5 h-5 text-green-600" />, 
              'Contacts', 
              'green'
            )}
            
            {renderCrmGroup(
              'opportunities', 
              crmData.opportunities, 
              <Target className="w-5 h-5 text-purple-600" />, 
              'Opportunities', 
              'purple'
            )}
          </div>
          
          <div className="mt-6 flex space-x-3">
            <button
              onClick={() => handleApprovalWithCrmItems('approved')}
              disabled={isSubmitting}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(isSubmitting && isApproval === 'approved') ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Approve</span>
                </>
              )}
            </button>
            <button
              onClick={() => handleApprovalWithCrmItems('rejected')}
              disabled={isSubmitting}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2 font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(isSubmitting && isApproval === 'rejected') ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5" />
                  <span>Reject</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
      <UserProfileDrawer
        user={approverUser}
        isOpen={showProfileDrawer}
        onClose={() => setShowProfileDrawer(false)}
      />
    </div>
  );
};

export default CrmApprovalNode; 