import api from '../../lib/api';
import { crmApi, handleApiError } from '../../lib/crm/api';
import { AccountRelationship } from '../../types/crm';

export class AccountRelationshipService {
  async getAccountRelationships(accountId: string): Promise<AccountRelationship[]> {
    try {
      const response = await api.get(`${crmApi.accounts}/${accountId}/relationships`);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  }

  async createAccountRelationship(relationship: Omit<AccountRelationship, 'id' | 'created_at'>): Promise<AccountRelationship> {
    try {
      const response = await api.post(crmApi.accountRelationships, relationship);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  }

  async updateAccountRelationship(id: string, relationship: Partial<AccountRelationship>): Promise<AccountRelationship> {
    try {
      const response = await api.put(`${crmApi.accountRelationships}/${id}`, relationship);
      return response.data;
    } catch (error) {
      handleApiError(error);
    }
  }

  async deleteAccountRelationship(id: string): Promise<void> {
    try {
      await api.delete(`${crmApi.accountRelationships}/${id}`);
    } catch (error) {
      handleApiError(error);
    }
  }
}

export const accountRelationshipService = new AccountRelationshipService();