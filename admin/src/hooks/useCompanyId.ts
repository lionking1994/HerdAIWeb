import { useSearchParams } from 'react-router-dom';

export const useCompanyId = () => {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  
  if (!companyId) {
    throw new Error('Company ID is required. Please ensure you are accessing CRM with a valid company parameter (e.g., /crm?company=123)');
  }
  
  return companyId;
};
