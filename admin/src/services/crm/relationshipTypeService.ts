import api from '../../lib/api';

export interface RelationshipType {
  id: string;
  name: string;
  description: string;
  entity_type_from: string;
  entity_type_to: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateRelationshipTypeData {
  name: string;
  description?: string;
  entity_type_from: string;
  entity_type_to: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface UpdateRelationshipTypeData extends Partial<CreateRelationshipTypeData> {}

export class RelationshipTypeService {
  private baseUrl: string;
  private companyId: string;

  constructor(companyId: string) {
    this.baseUrl = `${import.meta.env.VITE_API_BASE_URL}/crm/relationship-types`;
    this.companyId = companyId;
  }

  // Helper method to add company ID to request params
  private addCompanyParams(params: any = {}) {
    return { ...params, company: this.companyId };
  }

  async getRelationshipTypes(params?: {
    entity_type_from?: string;
    entity_type_to?: string;
    include_inactive?: boolean;
  }): Promise<RelationshipType[]> {
    const apiParams = this.addCompanyParams(params);
    
    const response = await api.get(this.baseUrl, { params: apiParams });
    return response.data?.data || [];
  }

  async getRelationshipTypeById(id: string): Promise<RelationshipType> {
    const apiParams = this.addCompanyParams();
    
    const response = await api.get(`${this.baseUrl}/${id}`, { params: apiParams });
    return response.data?.data;
  }

  async createRelationshipType(data: CreateRelationshipTypeData): Promise<RelationshipType> {
    const apiParams = this.addCompanyParams();
    
    const response = await api.post(this.baseUrl, data, { params: apiParams });
    return response.data?.data;
  }

  async updateRelationshipType(id: string, data: UpdateRelationshipTypeData): Promise<RelationshipType> {
    const apiParams = this.addCompanyParams();
    
    const response = await api.put(`${this.baseUrl}/${id}`, data, { params: apiParams });
    return response.data?.data;
  }

  async deleteRelationshipType(id: string): Promise<void> {
    const apiParams = this.addCompanyParams();
    
    await api.delete(`${this.baseUrl}/${id}`, { params: apiParams });
  }

  async getEntityTypeCombinations(): Promise<Array<{ entity_type_from: string; entity_type_to: string }>> {
    const apiParams = this.addCompanyParams();
    
    const response = await api.get(`${this.baseUrl}/combinations`, { params: apiParams });
    return response.data?.data || [];
  }

  async bulkUpdateSortOrder(sortOrderData: Array<{ id: string; sort_order: number }>): Promise<void> {
    const apiParams = this.addCompanyParams();
    
    await api.put(`${this.baseUrl}/sort-order/bulk`, { sortOrderData }, { params: apiParams });
  }
}

export const createRelationshipTypeService = (companyId: string) => new RelationshipTypeService(companyId);
