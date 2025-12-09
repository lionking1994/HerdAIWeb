import React, { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
import { createCRMService } from '../../services/crm/crmService';
import { createStageService } from '../../services/crm/stageService';
import { formatCurrency } from '../../lib/crm/api';
import { useCompanyId } from '../../hooks/useCompanyId';

interface PipelineData {
  stage: string;
  count: number;
  value: number;
}

export default function PipelineVisualization() {
  const companyId = useCompanyId();
  const [pipelineData, setPipelineData] = useState<PipelineData[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Create CRM service instances
  const crmService = companyId ? createCRMService(companyId) : null;
  const stageService = companyId ? createStageService(companyId) : null;

  useEffect(() => {
    if (companyId) {
      loadPipelineData();
    }
  }, [companyId]);

  const loadPipelineData = async () => {
    if (!crmService || !stageService) return;
    
    try {
      setIsLoading(true);
      
      const [opportunities, stages] = await Promise.all([
        crmService.getOpportunities(),
        stageService.getOpportunityStages(),
      ]);

      // Enhanced debugging to identify the issue
      console.log('🔍 Pipeline Debug Info:', {
        opportunitiesCount: opportunities?.length || 0,
        stagesCount: stages?.length || 0,
        opportunities: opportunities,
        stages: stages
      });

      // Log each opportunity's stage information
      if (opportunities && opportunities.length > 0) {
        console.log('🔍 Individual Opportunity Stage Info:');
        opportunities.forEach((opp, index) => {
          console.log(`Opportunity ${index + 1}:`, {
            id: opp.id,
            name: opp.name,
            stage: opp.stage,
            stage_id: opp.stage_id,
            amount: opp.amount,
            amountType: typeof opp.amount
          });
        });
      }

      // Log stage information
      if (stages && stages.length > 0) {
        console.log('🔍 Available Stages:');
        stages.forEach((stage, index) => {
          console.log(`Stage ${index + 1}:`, {
            id: stage.id,
            name: stage.name,
            order_index: stage.order_index
          });
        });
      }

      // Group opportunities by stage - try multiple approaches
      const stageMap = new Map<string, { count: number; value: number }>();
      
      // Initialize all stages with 0 count and value
      stages.forEach(stage => {
        stageMap.set(stage.name, { count: 0, value: 0 });
      });

      // Count opportunities and sum values for each stage
      if (opportunities && opportunities.length > 0) {
        opportunities.forEach(opp => {
          let stageName = null;
          
          // Try to find stage by stage_id first (more reliable)
          if (opp.stage_id) {
            const stageById = stages.find(s => s.id === opp.stage_id);
            if (stageById) {
              stageName = stageById.name;
              console.log(`✅ Found stage by ID: ${opp.name} -> ${stageName}`);
            }
          }
          
          // Fallback to stage string if stage_id didn't work
          if (!stageName && opp.stage) {
            const stageByName = stages.find(s => s.name === opp.stage);
            if (stageByName) {
              stageName = opp.stage;
              console.log(`✅ Found stage by name: ${opp.name} -> ${stageName}`);
            } else {
              console.log(`❌ Stage name mismatch: ${opp.name} has stage "${opp.stage}" but no matching stage found`);
            }
          }
          
          // If still no stage found, log the issue
          if (!stageName) {
            console.log(`❌ No stage found for opportunity: ${opp.name}`, {
              stage: opp.stage,
              stage_id: opp.stage_id,
              availableStages: stages.map(s => s.name)
            });
            return; // Skip this opportunity
          }

          if (stageMap.has(stageName)) {
            const current = stageMap.get(stageName)!;
            // Convert amount to number, handle null/undefined/empty strings
            const amount = opp.amount ? parseFloat(opp.amount.toString()) : 0;
            stageMap.set(stageName, {
              count: current.count + 1,
              value: current.value + (isNaN(amount) ? 0 : amount)
            });
            console.log(`✅ Categorized opportunity: ${opp.name} -> ${stageName} (amount: ${amount})`);
          }
        });
      }

      // Convert to array and sort by stage order
      const sortedStages = stages.sort((a, b) => a.order_index - b.order_index);
      const pipelineData = sortedStages.map(stage => {
        const data = stageMap.get(stage.name) || { count: 0, value: 0 };
        return {
          stage: stage.name,
          count: data.count,
          value: data.value
        };
      });

      setPipelineData(pipelineData);
      
      // Calculate total value with proper number conversion
      const totalValue = opportunities.reduce((sum, opp) => {
        const amount = opp.amount ? parseFloat(opp.amount.toString()) : 0;
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
      
      setTotalValue(totalValue);
      
      // Final debug summary
      console.log('🔍 Pipeline Processing Summary:', {
        totalOpportunities: opportunities?.length || 0,
        totalStages: stages?.length || 0,
        categorizedOpportunities: pipelineData.reduce((sum, stage) => sum + stage.count, 0),
        totalValue: totalValue,
        stageMap: Object.fromEntries(stageMap)
      });
      
    } catch (error) {
      console.error('Failed to load pipeline data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center mb-4">
          <BarChart3 className="h-5 w-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Sales Pipeline</h3>
        </div>
        <div className="text-center py-8">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  if (pipelineData.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center mb-4">
          <BarChart3 className="h-5 w-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Sales Pipeline</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Track opportunities through your sales process
        </p>
        <div className="text-center py-8 text-gray-500">
          No active stages found. Create opportunity stages to see your pipeline.
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalValue)}</div>
          <div className="text-sm text-gray-500">Total Pipeline Value</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center mb-4">
        <BarChart3 className="h-5 w-5 text-blue-600 mr-2" />
        <h3 className="text-lg font-medium text-gray-900">Sales Pipeline</h3>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        Track opportunities through your sales process
      </p>
      
      <div className="space-y-4">
        {pipelineData.map((stage, index) => (
          <div key={stage.stage} className="flex items-center">
            <div className="w-24 text-sm font-medium text-gray-900">
              {stage.stage}
            </div>
            <div className="flex-1 mx-4">
              <div className="bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${pipelineData.length > 0 ? (stage.count / Math.max(...pipelineData.map(s => s.count), 1)) * 100 : 0}%` 
                  }}
                ></div>
              </div>
            </div>
            <div className="w-20 text-right text-sm text-gray-600">
              {stage.count} opps
            </div>
            <div className="w-24 text-right text-sm font-medium text-gray-900">
              {formatCurrency(stage.value)}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Total Opportunities: {pipelineData.reduce((sum, stage) => sum + stage.count, 0)}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalValue)}</div>
            <div className="text-sm text-gray-500">Total Pipeline Value</div>
          </div>
        </div>
      </div>
    </div>
  );
}
