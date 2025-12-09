import api from '../../lib/api';
import { crmApi } from '../../lib/crm/api';
import { Account, Contact, Opportunity } from '../../types/crm';

export class CRMService {
  private companyId: string;

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  // Helper method to add company ID to request params
  private addCompanyParams(params: any = {}) {
    return { ...params, company: this.companyId };
  }

  // Accounts
  async getAccounts(searchTerm?: string, paginationParams?: { page: number; limit: number }): Promise<Account[] | { data: Account[]; pagination: { pages: number; total: number } }> {
    try {
      const params: any = {};
      
      if (searchTerm) {
        params.search = searchTerm;
      }
      
      if (paginationParams) {
        params.page = paginationParams.page;
        params.limit = paginationParams.limit;
      }
      
      const requestParams = this.addCompanyParams(params);
      const response = await api.get(crmApi.accounts, { params: requestParams });
      
      // If pagination params were provided, return the full response object
      if (paginationParams) {
        return response.data || { data: [], pagination: { pages: 1, total: 0 } };
      }
      
      // Otherwise, return just the data array for backward compatibility
      return response.data?.data || [];
    } catch (error) {
      console.error('Error fetching accounts:', error);
      return paginationParams ? { data: [], pagination: { pages: 1, total: 0 } } : [];
    }
  }

  async getAccount(id: string): Promise<Account> {
    try {
      const params = this.addCompanyParams();
      const response = await api.get(`${crmApi.accounts}/${id}`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching account:', error);
      throw error;
    }
  }

  async createAccount(account: Omit<Account, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<Account> {
    try {
      const params = this.addCompanyParams();
      const response = await api.post(crmApi.accounts, account, { params });
      return response.data;
    } catch (error) {
      console.error('Error creating account:', error);
      throw error;
    }
  }

  async updateAccount(id: string, account: Partial<Account>): Promise<Account> {
    try {
      const params = this.addCompanyParams();
      const response = await api.put(`${crmApi.accounts}/${id}`, account, { params });
      return response.data;
    } catch (error) {
      console.error('Error updating account:', error);
      throw error;
    }
  }

  async deleteAccount(accountId: string, forceDelete: boolean = false): Promise<void> {
    try {
      const params = this.addCompanyParams();
      if (forceDelete) {
        params.forceDelete = 'true';
      }
      await api.delete(`${crmApi.accounts}/${accountId}`, { params });
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }

  // Contacts
  async getContacts(searchTerm?: string, paginationParams?: { page: number; limit: number }): Promise<Contact[] | { data: Contact[]; pagination: { pages: number; total: number } }> {
    try {
      const params: any = {};
      
      if (searchTerm) {
        params.search = searchTerm;
      }
      
      if (paginationParams) {
        params.page = paginationParams.page;
        params.limit = paginationParams.limit;
      }
      
      const requestParams = this.addCompanyParams(params);
      const response = await api.get(crmApi.contacts, { params: requestParams });
      
      // If pagination params were provided, return the full response object
      if (paginationParams) {
        return response.data || { data: [], pagination: { pages: 1, total: 0 } };
      }
      
      // Otherwise, return just the data array for backward compatibility
      return response.data?.data || [];
    } catch (error) {
      console.error('Error fetching contacts:', error);
      return paginationParams ? { data: [], pagination: { pages: 1, total: 0 } } : [];
    }
  }

  async getContact(id: string): Promise<Contact> {
    try {
      const params = this.addCompanyParams();
      const response = await api.get(`${crmApi.contacts}/${id}`, { params });
      // The API returns { success: true, data: {...} }
      return response.data?.data;
    } catch (error) {
      console.error('Error fetching contact:', error);
      throw error;
    }
  }

  async createContact(contact: Omit<Contact, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<Contact> {
    try {
      const params = this.addCompanyParams();
      const response = await api.post(crmApi.contacts, contact, { params });
      // The API returns { success: true, data: {...}, message: "..." }
      return response.data?.data;
    } catch (error) {
      console.error('Error creating contact:', error);
      throw error;
    }
  }

  async updateContact(id: string, contact: Partial<Contact>): Promise<Contact> {
    try {
      const params = this.addCompanyParams();
      const response = await api.put(`${crmApi.contacts}/${id}`, contact, { params });
      // The API returns { success: true, data: {...}, message: "..." }
      return response.data?.data;
    } catch (error) {
      console.error('Error updating contact:', error);
      throw error;
    }
  }

  async deleteContact(id: string): Promise<void> {
    try {
      const params = this.addCompanyParams();
      await api.delete(`${crmApi.contacts}/${id}`, { params });
    } catch (error) {
      console.error('Error deleting contact:', error);
      throw error;
    }
  }

  // Opportunities
  async getOpportunities(searchTerm?: string, paginationParams?: { page: number; limit: number }): Promise<Opportunity[] | { data: Opportunity[]; pagination: { pages: number; total: number } }> {
    try {
      const params: any = {};
      
      if (searchTerm) {
        params.search = searchTerm;
      }
      
      if (paginationParams) {
        params.page = paginationParams.page;
        params.limit = paginationParams.limit;
      }
      
      const requestParams = this.addCompanyParams(params);
      console.log('🔍 Fetching opportunities with params:', requestParams);
      
      const response = await api.get(crmApi.opportunities, { params: requestParams });
      console.log('🔍 Opportunities API response:', response);
      
      // If pagination params were provided, return the full response object
      if (paginationParams) {
        return response.data || { data: [], pagination: { pages: 1, total: 0 } };
      }
      
      // Otherwise, return just the data array for backward compatibility
      return response.data?.data || [];
    } catch (error) {
      console.error('Error fetching opportunities:', error);
      return paginationParams ? { data: [], pagination: { pages: 1, total: 0 } } : [];
    }
  }

  async getOpportunity(id: string): Promise<Opportunity> {
    try {
      const params = this.addCompanyParams();
      const response = await api.get(`${crmApi.opportunities}/${id}`, { params });
      return response.data?.data;
    } catch (error) {
      console.error('Error fetching opportunity:', error);
      throw error;
    }
  }

  async createOpportunity(opportunity: Omit<Opportunity, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<Opportunity> {
    try {
      const params = this.addCompanyParams();
      const response = await api.post(crmApi.opportunities, opportunity, { params });
      return response.data?.data;
    } catch (error) {
      console.error('Error creating opportunity:', error);
      throw error;
    }
  }

  async updateOpportunity(id: string, opportunity: Partial<Opportunity>): Promise<Opportunity> {
    try {
      const params = this.addCompanyParams();
      const response = await api.put(`${crmApi.opportunities}/${id}`, opportunity, { params });
      return response.data?.data;
    } catch (error) {
      console.error('Error updating opportunity:', error);
      throw error;
    }
  }

  async deleteOpportunity(opportunityId: string, forceDelete: boolean = false): Promise<void> {
    try {
      const params = this.addCompanyParams();
      if (forceDelete) {
        params.forceDelete = 'true';
      }
      await api.delete(`${crmApi.opportunities}/${opportunityId}`, { params });
    } catch (error) {
      console.error('Error deleting opportunity:', error);
      throw error;
    }
  }

  // Search
  async searchCRM(query: string, filters: any = {}): Promise<any> {
    try {
      const params = this.addCompanyParams({ query, filters });
      const response = await api.post(crmApi.search, { query, filters }, { params });
      return response.data?.data || [];
    } catch (error) {
      console.error('Error searching CRM:', error);
      return [];
    }
  }

  // Global Search - matches the backend API structure
  async globalSearch(query: string): Promise<{
    accounts: any[];
    contacts: any[];
    opportunities: any[];
  }> {
    try {
      const params = this.addCompanyParams({ query });
      const response = await api.get(crmApi.search + '/global', { params });
      
      // The API returns { success: true, data: { results: [...] } }
      const results = response.data?.data?.results || [];
      
      // Separate results by entity type
      const accounts = results.filter((r: any) => r.entity_type === 'account');
      const contacts = results.filter((r: any) => r.entity_type === 'contact');
      const opportunities = results.filter((r: any) => r.entity_type === 'opportunity');
      
      return {
        accounts,
        contacts,
        opportunities
      };
    } catch (error) {
      console.error('Error performing global search:', error);
      return {
        accounts: [],
        contacts: [],
        opportunities: []
      };
    }
  }

  // Account Relationships (Account ↔ Account)
  async getAccountRelationships(accountId: string): Promise<any[]> {
    try {
      const params = this.addCompanyParams({ account_id: accountId });
      const response = await api.get(`${crmApi.relationships}`, { params });
      return response.data?.data || [];
    } catch (error) {
      console.error('Error fetching account relationships:', error);
      return [];
    }
  }

  async createAccountRelationship(relationship: {
    parent_account_id: string;
    child_account_id: string;
    relationship_type: string;
    tenant_id: number;
  }): Promise<any> {
    try {
      const params = this.addCompanyParams();
      const response = await api.post(`${crmApi.accounts}/relationships`, relationship, { params });
      return response.data?.data;
    } catch (error) {
      console.error('Error creating account relationship:', error);
      throw error;
    }
  }

  async deleteAccountRelationship(relationshipId: number): Promise<void> {
    try {
      const params = this.addCompanyParams();
      await api.delete(`${crmApi.accounts}/relationships/${relationshipId}`, { params });
    } catch (error) {
      console.error('Error deleting account relationship:', error);
      throw error;
    }
  }

  async updateAccountRelationship(relationshipId: number, updates: {
    relationship_type?: string;
    description?: string;
  }): Promise<any> {
    try {
      const params = this.addCompanyParams();
      const response = await api.put(`${crmApi.accounts}/relationships/${relationshipId}`, updates, { params });
      return response.data?.data;
    } catch (error) {
      console.error('Error updating account relationship:', error);
      throw error;
    }
  }

  // Account Contacts (Account ↔ Contact)
  async getAccountContacts(accountId?: string, contactId?: string): Promise<any[]> {
    try {
      const params = this.addCompanyParams();
      let url = crmApi.accounts;
      
      if (accountId) {
        url += `/${accountId}/contacts`;
      } else if (contactId) {
        url = `${crmApi.contacts}/${contactId}/accounts`;
      } else {
        url += '/contacts';
      }
      
      const response = await api.get(url, { params });
      return response.data?.data || [];
    } catch (error) {
      console.error('Error fetching account contacts:', error);
      return [];
    }
  }

  async createAccountContact(relationship: {
    account_id: string;
    contact_id: string;
    role: string;
    tenant_id: number;
  }): Promise<any> {
    try {
      const params = this.addCompanyParams();
      const response = await api.post(`${crmApi.accounts}/contacts`, relationship, { params });
      return response.data?.data;
    } catch (error) {
      console.error('Error creating account contact:', error);
      throw error;
    }
  }

  async updateAccountContact(relationshipId: number, updates: {
    role?: string;
    description?: string;
  }): Promise<any> {
    try {
      const params = this.addCompanyParams();
      const response = await api.put(`${crmApi.accounts}/contacts/${relationshipId}`, updates, { params });
      return response.data?.data;
    } catch (error) {
      console.error('Error updating account contact:', error);
      throw error;
    }
  }

  async deleteAccountContact(relationshipId: number): Promise<void> {
    try {
      const params = this.addCompanyParams();
      await api.delete(`${crmApi.accounts}/contacts/${relationshipId}`, { params });
    } catch (error) {
      console.error('Error deleting account contact:', error);
      throw error;
    }
  }

  // Opportunity Contacts (Opportunity ↔ Contact)
  async getOpportunityContacts(opportunityId?: string, contactId?: string): Promise<any[]> {
    try {
      const params = this.addCompanyParams();
      let url = crmApi.opportunities;
      
      if (opportunityId) {
        url += `/${opportunityId}/contacts`;
      } else if (contactId) {
        url = `${crmApi.contacts}/${contactId}/opportunities`;
      } else {
        url += '/contacts';
      }
      
      const response = await api.get(url, { params });
      return response.data?.data || [];
    } catch (error) {
      console.error('Error fetching opportunity contacts:', error);
      return [];
    }
  }

  async createOpportunityContact(relationship: {
    opportunity_id: string;
    contact_id: string;
    role: string;
    tenant_id: number;
  }): Promise<any> {
    try {
      const params = this.addCompanyParams();
      const response = await api.post(`${crmApi.opportunities}/contacts`, relationship, { params });
      return response.data?.data;
    } catch (error) {
      console.error('Error creating opportunity contact:', error);
      throw error;
    }
  }

  async deleteOpportunityContact(relationshipId: number): Promise<void> {
    try {
      const params = this.addCompanyParams();
      await api.delete(`${crmApi.opportunities}/contacts/${relationshipId}`, { params });
    } catch (error) {
      console.error('Error deleting opportunity contact:', error);
      throw error;
    }
  }

  async updateOpportunityContact(relationshipId: number, updates: {
    role?: string;
  }): Promise<any> {
    try {
      const params = this.addCompanyParams();
      const response = await api.put(`${crmApi.opportunities}/contacts/${relationshipId}`, updates, { params });
      return response.data?.data;
    } catch (error) {
      console.error('Error updating opportunity contact:', error);
      throw error;
    }
  }

  // Check opportunity relationships before deletion
  async checkOpportunityRelations(opportunityId: string): Promise<any> {
    try {
      const params = this.addCompanyParams();
      const response = await api.get(`${crmApi.opportunities}/${opportunityId}/check-relations`, { params });
      return response.data;
    } catch (error) {
      console.error('Error checking opportunity relationships:', error);
      throw error;
    }
  }

  // Check account relationships before deletion
  async checkAccountRelations(accountId: string): Promise<any> {
    try {
      console.log('🔍 CRM Service: checkAccountRelations called for accountId:', accountId);
      const params = this.addCompanyParams();
      console.log('🔍 CRM Service: API params:', params);
      
      const url = `${crmApi.accounts}/${accountId}/check-relations`;
      console.log('🔍 CRM Service: API URL:', url);
      
      const response = await api.get(url, { params });
      console.log('🔍 CRM Service: API response:', response);
      
      return response.data;
    } catch (error) {
      console.error('❌ CRM Service: Error checking account relationships:', error);
      throw error;
    }
  }
}

// Factory function to create CRM service with company ID
export const createCRMService = (companyId: string) => new CRMService(companyId);

// Default export for backward compatibility
export default CRMService;