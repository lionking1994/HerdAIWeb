import React, { useState, useEffect } from 'react';
import { Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { OpportunityStage } from '../../types/crm';
import { createStageService } from '../../services/crm/stageService';
import StageForm from '../../components/CRM/StageForm';
import DataTable from '../../components/CRM/DataTable';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import ConfirmationModal from '../../components/ui/confirmation-modal';

export default function Stages() {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  const [stages, setStages] = useState<OpportunityStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStage, setEditingStage] = useState<OpportunityStage | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; stage: OpportunityStage | null }>({ isOpen: false, stage: null });
  const { showSuccess, showError } = useToast();

  // Create stage service instance
  const stageService = companyId ? createStageService(companyId) : null;

  useEffect(() => {
    if (companyId) {
      loadStages();
    }
  }, [companyId]);

  const loadStages = async () => {
    if (!stageService) return;
    
    try {
      setIsLoading(true);
      const data = await stageService.getOpportunityStages();
      // Sort by order_index
      const sortedData = data.sort((a, b) => a.order_index - b.order_index);
      setStages(sortedData);
    } catch (error) {
      console.error('Failed to load stages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (stage: OpportunityStage) => {
    setEditingStage(stage);
    setShowForm(true);
  };

  const handleDelete = async (stage: OpportunityStage) => {
    setDeleteModal({ isOpen: true, stage });
  };

  const confirmDelete = async () => {
    if (!stageService || !deleteModal.stage) return;
    
    try {
      await stageService.deleteOpportunityStage(deleteModal.stage.id);
      await loadStages();
      showSuccess('Stage deleted successfully');
    } catch (error) {
      console.error('Failed to delete stage:', error);
      showError('Failed to delete stage. Please try again.');
    } finally {
      setDeleteModal({ isOpen: false, stage: null });
    }
  };

  const handleCreate = () => {
    setEditingStage(undefined);
    setShowForm(true);
  };

  const handleSubmit = async (stageData: Partial<OpportunityStage>) => {
    if (!stageService) return;
    
    try {
      setIsSubmitting(true);
      if (editingStage) {
        await stageService.updateOpportunityStage(editingStage.id, stageData);
      } else {
        await stageService.createOpportunityStage({
          ...stageData,
          order_index: stages.length,
          weight_percentage: stageData.weight_percentage || 0,
        } as Omit<OpportunityStage, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>);
      }
      setShowForm(false);
      await loadStages();
    } catch (error) {
      console.error('Failed to save stage:', error);
      showError('Failed to save stage. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };



  const getStageTypeIcon = (stage: OpportunityStage) => {
    if (stage.is_closed_won) {
      return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Won</span>;
    }
    if (stage.is_closed_lost) {
      return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Lost</span>;
    }
    return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">Active</span>;
  };

  // Helper function to safely get weight percentage
  const getWeightPercentage = (stage: OpportunityStage): number => {
    if (typeof stage.weight_percentage === 'number') {
      return stage.weight_percentage;
    }
    if (typeof stage.weight_percentage === 'string') {
      const parsed = parseFloat(stage.weight_percentage);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  // Calculate total weight
  const totalWeight = stages.reduce((sum, stage) => sum + getWeightPercentage(stage), 0);

  const columns = [
    { key: 'order_index', label: 'Order', sortable: true },
    { key: 'name', label: 'Stage Name', sortable: true },
    { key: 'description', label: 'Description', sortable: true },
    { key: 'weight_percentage', label: 'Weight %', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'is_active', label: 'Status', sortable: true },
    { key: 'created_at', label: 'Created', sortable: true },
  ];

  const formatData = (stage: OpportunityStage) => {
    return {
      order_index: stage.order_index,
      name: stage.name,
      description: stage.description || '—',
      weight_percentage: (
        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
          {getWeightPercentage(stage) ? `${getWeightPercentage(stage)}%` : '0%'}
        </span>
      ),
      type: getStageTypeIcon(stage),
      is_active: (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
          stage.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {stage.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
      created_at: stage.created_at ? new Date(stage.created_at).toLocaleDateString() : '—',
    };
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Opportunity Stages</h1>
          <p className="mt-1 text-sm text-gray-600">
            Define and manage the stages that opportunities progress through
          </p>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Stage Management</h3>
          <p className="text-sm text-gray-600">
            Create stages that represent your sales process. Each opportunity will track its progression through these stages with timestamps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <ArrowUp className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-900">Active Stages</p>
                <p className="text-sm text-blue-700">Opportunities can be moved through these stages</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 font-bold text-xs">W</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-900">Closed Won</p>
                <p className="text-sm text-green-700">Successfully closed opportunities</p>
              </div>
            </div>
          </div>

          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 font-bold text-xs">L</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-900">Closed Lost</p>
                <p className="text-sm text-red-700">Lost or cancelled opportunities</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg mb-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-bold text-xs">%</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-purple-900">Weight Percentage</p>
              <p className="text-sm text-purple-700">
                Each stage has a weight percentage that represents its importance in the sales pipeline. 
                Total weights should ideally equal 100% for accurate forecasting.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Opportunity Stages</h3>
          <button
            onClick={handleCreate}
            className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add New</span>
          </button>
        </div>
        
        {stages.length === 0 && !isLoading ? (
          <div className="px-6 py-8 text-center">
            <p className="text-gray-500 mb-2">No opportunity stages found.</p>
            <button
              onClick={handleCreate}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Create your first opportunity stage
            </button>
          </div>
        ) : (
          <>
            <DataTable
              data={stages}
              columns={columns}
              formatData={formatData}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isLoading={isLoading}
            />
            
            {stages.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Total Stages: <span className="font-medium">{stages.length}</span>
                  </span>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-600">
                      Total Weight: 
                      <span className={`font-medium ml-1 ${
                        totalWeight === 100 
                          ? 'text-green-600' 
                          : 'text-orange-600'
                      }`}>
                        {totalWeight.toFixed(1)}%
                      </span>
                    </span>
                    {totalWeight !== 100 && (
                      <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                        {totalWeight < 100 ? 'Under 100%' : 'Over 100%'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showForm && (
        <StageForm
          stage={editingStage}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
          isSubmitting={isSubmitting}
        />
      )}
      
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, stage: null })}
        onConfirm={confirmDelete}
        title="Delete Stage"
        description={`Are you sure you want to delete "${deleteModal.stage?.name}" from stages?`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
}