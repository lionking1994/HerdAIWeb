// CRM API Configuration
const CRM_API_BASE = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/crm` : '/api/crm';

export const crmApi = {
  // Base URLs
  tenants: `${CRM_API_BASE}/tenants`,
  accounts: `${CRM_API_BASE}/accounts`,
  contacts: `${CRM_API_BASE}/contacts`,
  opportunities: `${CRM_API_BASE}/opportunities`,
  customFields: `${CRM_API_BASE}/custom-fields`,
  stages: `${CRM_API_BASE}/stages`,
  accountRelationships: `${CRM_API_BASE}/account-relationships`,
  relationships: `${CRM_API_BASE}/relationships`,
  search: `${CRM_API_BASE}/search`,
};

export const handleApiError = (error: any) => {
  console.error('API Error:', error);
  if (error.response?.data?.message) {
    throw new Error(error.response.data.message);
  }
  throw new Error('An unexpected error occurred');
};

export const formatDate = (date: string | Date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString();
};

export const formatCurrency = (amount: number) => {
  if (!amount) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};