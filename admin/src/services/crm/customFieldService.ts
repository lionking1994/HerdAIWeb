import api from '../../lib/api';
import { crmApi, handleApiError } from '../../lib/crm/api';
import { CustomFieldDefinition, TableName } from '../../types/crm';

export class CustomFieldService {
  private companyId: string;

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  // Helper method to add company ID to request params
  private addCompanyParams(params: any = {}) {
    return { ...params, company: this.companyId };
  }

  async getCustomFieldDefinitions(tableName: TableName): Promise<CustomFieldDefinition[]> {
    try {
      console.log('🔄 Fetching custom fields for table:', tableName);
      const params = this.addCompanyParams();
      const response = await api.get(`${crmApi.customFields}/table/${tableName}`, { params });
      console.log('📡 Custom fields API response:', response);
      console.log('📊 Custom fields data:', response.data?.data);
      return response.data?.data || [];
    } catch (error) {
      console.error('❌ Error fetching custom field definitions:', error);
      handleApiError(error);
      return [];
    }
  }

  async createCustomField(definition: Omit<CustomFieldDefinition, 'id' | 'tenant_id' | 'created_at' | 'updated_at' | 'version'>): Promise<CustomFieldDefinition> {
    try {
      console.log('🔄 Creating custom field:', definition);
      const params = this.addCompanyParams();
      const response = await api.post(crmApi.customFields, definition, { params });
      console.log('📡 Create custom field response:', response);
      return response.data?.data;
    } catch (error) {
      console.error('❌ Error creating custom field:', error);
      handleApiError(error);
      throw error;
    }
  }

  async updateCustomField(id: string, definition: Partial<CustomFieldDefinition>): Promise<CustomFieldDefinition> {
    try {
      console.log('🔄 Updating custom field:', id, definition);
      const params = this.addCompanyParams();
      const response = await api.put(`${crmApi.customFields}/${id}`, definition, { params });
      console.log('📡 Update custom field response:', response);
      return response.data?.data;
    } catch (error) {
      console.error('❌ Error updating custom field:', error);
      handleApiError(error);
      throw error;
    }
  }

  async deleteCustomField(id: string): Promise<void> {
    try {
      console.log('🔄 Deleting custom field:', id);
      const params = this.addCompanyParams();
      await api.delete(`${crmApi.customFields}/${id}`, { params });
      console.log('✅ Custom field deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting custom field:', error);
      handleApiError(error);
      throw error;
    }
  }

  async getCustomFieldSchema(tableName: TableName): Promise<Record<string, any>> {
    try {
      console.log('🔄 Fetching custom field schema for table:', tableName);
      const params = this.addCompanyParams();
      const response = await api.get(`${crmApi.customFields}/table/${tableName}/schema`, { params });
      console.log('📡 Schema API response:', response);
      return response.data?.data || {};
    } catch (error) {
      console.error('❌ Error fetching custom field schema:', error);
      handleApiError(error);
      return {};
    }
  }
}

// Factory function to create custom field service with company ID
export const createCustomFieldService = (companyId: string) => new CustomFieldService(companyId);