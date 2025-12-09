import { useState, useEffect } from 'react';
import { Building2, Users, Target, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import GlobalSearch from '../../components/CRM/GlobalSearch';
import { createCRMService } from '../../services/crm/crmService';
import { createCustomFieldService } from '../../services/crm/customFieldService';
import { useCompanyId } from '../../hooks/useCompanyId';
import { Pipeline } from '../../components/Pipeline';

interface DashboardStats {
  accounts: number;
  contacts: number;
  opportunities: number;
  customFields: number;
}

export default function Dashboard() {
  const companyId = useCompanyId();
  const [stats, setStats] = useState<DashboardStats>({
    accounts: 0,
    contacts: 0,
    opportunities: 0,
    customFields: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [companyId]);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      
      // Create services with company ID
      const crmService = createCRMService(companyId);
      const customFieldService = createCustomFieldService(companyId);
      
      // Load data counts in parallel
      const [accounts, contacts, opportunities, accountFields, contactFields, opportunityFields] = await Promise.all([
        crmService.getAccounts('', { page: 1, limit: -1 }),
        crmService.getContacts('', { page: 1, limit: -1 }),
        crmService.getOpportunities('', { page: 1, limit: -1 }),
        customFieldService.getCustomFieldDefinitions('accounts'),
        customFieldService.getCustomFieldDefinitions('contacts'),
        customFieldService.getCustomFieldDefinitions('opportunities'),
      ]);

      // Debug: Log the actual data being returned
      console.log('Dashboard Data Debug:', {
        accounts: accounts?.data,
        contacts: contacts?.data,
        opportunities: opportunities?.data,
        accountFields: accountFields,
        contactFields: contactFields,
        opportunityFields: opportunityFields
      });
      
      // Additional debugging for opportunities
      console.log('Opportunities Debug:', {
        opportunitiesType: typeof opportunities,
        opportunitiesIsArray: Array.isArray(opportunities),
        opportunitiesLength: opportunities?.length,
        opportunitiesRaw: opportunities
      });

      setStats({
        accounts: Array.isArray(accounts?.data) ? accounts?.data.length : 0,
        contacts: Array.isArray(contacts?.data) ? contacts?.data.length : 0,
        opportunities: Array.isArray(opportunities?.data) ? opportunities?.data.length : 0,
        customFields: (Array.isArray(accountFields) ? accountFields.length : 0) + 
                     (Array.isArray(contactFields) ? contactFields.length : 0) + 
                     (Array.isArray(opportunityFields) ? opportunityFields.length : 0),
      });
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const dashboardStats = [
    { name: 'Total Accounts', value: stats.accounts.toString(), icon: Building2, href: `/crm/accounts?company=${companyId}` },
    { name: 'Total Contacts', value: stats.contacts.toString(), icon: Users, href: `/crm/contacts?company=${companyId}` },
    { name: 'Active Opportunities', value: stats.opportunities.toString(), icon: Target, href: `/crm/opportunities?company=${companyId}` },
    { name: 'Custom Fields', value: stats.customFields.toString(), icon: Settings, href: `/crm/custom-fields?company=${companyId}` },
  ];

  return (
    <div className="crm-page-container">
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600">
              Welcome to your CRM administration panel
            </p>
          </div>

          {/* Global Search */}
          <div className="bg-white shadow-sm rounded-lg p-6">
            <div className="max-w-2xl">
              <h2 className="text-lg font-medium text-gray-900 mb-3">Global Search</h2>
              <p className="text-sm text-gray-600 mb-4">
                Search across all accounts, contacts, and opportunities from one place
              </p>
              <GlobalSearch className="w-full" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {dashboardStats.map((stat) => (
              <Link
                key={stat.name}
                to={stat.href}
                className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-200"
              >
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <stat.icon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">{stat.name}</dt>
                        <dd className="text-lg font-medium text-gray-900">{stat.value}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pipeline Visualization */}
          {/* <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Opportunity Pipeline</h2>
            <PipelineVisualization />
          </div> */}
          <Pipeline/>
        </div>
      </div>
    </div>
  );
}