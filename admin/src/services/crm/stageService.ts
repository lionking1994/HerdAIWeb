import api from '../../lib/api';
import { crmApi, handleApiError } from '../../lib/crm/api';
import { OpportunityStage } from '../../types/crm';

export class StageService {
  private companyId: string;

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  // Helper method to add company ID to request params
  private addCompanyParams(params: any = {}) {
    return { ...params, company: this.companyId };
  }

  async getOpportunityStages(): Promise<OpportunityStage[]> {
    try {
      console.log('🔄 Fetching opportunity stages from:', crmApi.stages);
      const params = this.addCompanyParams();
      const response = await api.get(crmApi.stages, { params });
      console.log('📡 Stages API response:', response);
      console.log('📊 Stages data:', response.data?.data);
      return response.data?.data || [];
    } catch (error) {
      console.error('❌ Error fetching stages:', error);
      handleApiError(error);
      return [];
    }
  }

  async getOpportunityStage(id: string): Promise<OpportunityStage> {
    try {
      const params = this.addCompanyParams();
      const response = await api.get(`${crmApi.stages}/${id}`, { params });
      return response.data?.data;
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  }

  async createOpportunityStage(stage: Omit<OpportunityStage, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<OpportunityStage> {
    try {
      const params = this.addCompanyParams();
      const response = await api.post(crmApi.stages, stage, { params });
      return response.data?.data;
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  }

  async updateOpportunityStage(id: string, stage: Partial<OpportunityStage>): Promise<OpportunityStage> {
    try {
      const params = this.addCompanyParams();
      const response = await api.put(`${crmApi.stages}/${id}`, stage, { params });
      return response.data?.data;
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  }

  async deleteOpportunityStage(id: string): Promise<void> {
    try {
      const params = this.addCompanyParams();
      await api.delete(`${crmApi.stages}/${id}`, { params });
    } catch (error) {
      handleApiError(error);
    }
  }
}

// Factory function to create stage service with company ID
export const createStageService = (companyId: string) => new StageService(companyId);

// Legacy export for backward compatibility
export const stageService = new StageService('legacy');