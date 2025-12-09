import React, { useState, useMemo, useEffect } from 'react';
import { Deal, PipelineStage, FilterState, } from '../types/index';
import { PipelineStageComponent } from './PipelineStage';
import { Filters } from './Filters';
import { QuarterlyForecast } from './QuarterlyForecast';
import { createStageService } from '../services/crm/stageService';
import { useSearchParams } from 'react-router-dom';
import { OpportunityStage } from '../types/crm';
import axios from 'axios';


export const Pipeline: React.FC = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stages, setStages] = useState<OpportunityStage[]>([]);
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    geography: '',
    state: '',
    salesRep: '',
    product: '',
    search: ''
  });
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  const stageService = companyId ? createStageService(companyId) : null;
  if (!stageService) return;
  // Fetch dynamic stages from API
  useEffect(() => {
    const fetchStages = async () => {
      if (!companyId) return;
      try {
        const response = await stageService.getOpportunityStages();
        const sortedData = response.sort((a, b) => a.order_index - b.order_index);
        setStages(sortedData);
        // ✅ fetch pipeline data
        const token = localStorage.getItem("token");
        const pipelineResponse = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/crm/accounts/getPipeLineData?company=${companyId}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        if (pipelineResponse.data.success) {

          const apiDeals = pipelineResponse.data.data;
          const mappedDeals: Deal[] = apiDeals.map((item: any) => ({
            id: item.id,
            title: item.title,
            company: item.company,
            value: parseFloat(item.value) || 0, // ensure number
            stage: item.stage,
            stage_id: item.stage_id,
            salesRep: item.salesrep,
            geography: item.geography,
            state: item.state,
            product: item.product,
            createdAt: new Date(item.createdat),
            lastActivity: new Date(item.lastactivity),
            movementHistory: (item.movementhistory || []).map((mh: any) => ({
              fromStage: mh.fromStage,
              toStage: mh.toStage,
              movedAt: mh.movedAt ? new Date(mh.movedAt) : undefined,
              reason: mh.reason || undefined,
            })),
            priority: item.risk_level,
            probability: item.probability,
            weight_percentage : item.weight_percentage
          }));
          console.log("Pipeline Data:", mappedDeals);
          setDeals(mappedDeals);
          console.log("Pipeline Data deals:", deals);
        }

      } catch (err) {
        console.error('Error fetching stages:', err);
      }
    };
    fetchStages();
  }, [companyId]);

  // Filters
  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      const matchesSearch =
        !filters.search ||
        deal.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        deal.company.toLowerCase().includes(filters.search.toLowerCase());

      const matchesGeography = !filters.geography || deal.geography === filters.geography;
      const matchesState = !filters.state || deal.state === filters.state;
      const matchesSalesRep = !filters.salesRep || deal.salesRep === filters.salesRep;
      const matchesProduct = !filters.product || deal.product === filters.product;

      return matchesSearch && matchesGeography && matchesState && matchesSalesRep && matchesProduct;
    });
  }, [deals, filters]);

  // Group deals by stage dynamically
  const dealsByStage = useMemo(() => {
    const grouped: Record<string, Deal[]> = {};
    stages.forEach(stage => {
      grouped[stage.name.toLowerCase()] = [];
    });
    filteredDeals.forEach(deal => {
      const key = deal.stage.toLowerCase();
      if (grouped[key]) grouped[key].push(deal);
    });
    return grouped;
  }, [filteredDeals, stages]);

  const handleDragStart = (e: React.DragEvent, deal: Deal) => {
    setDraggedDeal(deal);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const toPipelineStage = (stageName: string): PipelineStage => {
    return stageName.toLowerCase() as PipelineStage;
  };
  const handleDrop = (e: React.DragEvent, targetStage: string, stageId: string) => {
    e.preventDefault();
    if (draggedDeal && draggedDeal.stage !== toPipelineStage(targetStage)) {
      const updatedDeals = deals.map(deal => {
        if (deal.id === draggedDeal.id) {
          const updatedDeal: Deal = {
            ...deal,
            stage: toPipelineStage(targetStage),
            movementHistory: [
              ...deal.movementHistory,
              { fromStage: deal.stage, toStage: toPipelineStage(targetStage), movedAt: new Date() }
            ]
          };

          // Update probability
          if (targetStage === 'qualified') updatedDeal.probability = Math.max(25, updatedDeal.probability);
          if (targetStage === 'proposal') updatedDeal.probability = Math.max(50, updatedDeal.probability);
          if (targetStage === 'negotiation') updatedDeal.probability = Math.max(70, updatedDeal.probability);
          if (targetStage === 'closed-won') updatedDeal.probability = 100;
          if (targetStage === 'closed-lost') updatedDeal.probability = 0;

          return updatedDeal;
        }
        return deal;
      });

      setDeals(updatedDeals); // ✅ now type-safe
      const token = localStorage.getItem("token");
      axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/crm/opportunities/stage-history/${draggedDeal.id}?company=${companyId}`,
        {
          stage_id: stageId,   // <-- body/data goes here
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // fetch(
      //   `${import.meta.env.VITE_API_BASE_URL}/${draggedDeal.id}/stage-history`,
      //   {
      //     method: 'PUT',
      //     headers: {
      //       'Authorization': `Bearer ${localStorage.getItem('token')}`,
      //       'Content-Type': 'application/json'
      //     },
      //     body: JSON.stringify({
      //       stage_id: stageId
      //     })
      //   }
      // );

    }
    setDraggedDeal(null);
  };

  const totalPipelineValue = filteredDeals
    .filter(deal => !['closed-won', 'closed-lost'].includes(deal.stage))
    .reduce((sum, deal) => sum + deal.value, 0);

  const closedWonValue = filteredDeals
    .filter(deal => deal.stage === 'closed-won')
    .reduce((sum, deal) => sum + deal.value, 0);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Sales Pipeline Dashboard</h1>
        <div className="flex items-center gap-6 text-sm text-gray-600">
          <div>
            Active Pipeline Value: <span className="font-semibold text-blue-600">${totalPipelineValue.toLocaleString()}</span>
          </div>
          <div>
            Closed Won: <span className="font-semibold text-green-600">${closedWonValue.toLocaleString()}</span>
          </div>
          <div>
            Win Rate: <span className="font-semibold text-purple-600">
              {filteredDeals.filter(d => ['closed-won', 'closed-lost'].includes(d.stage)).length > 0
                ? Math.round(
                  (filteredDeals.filter(d => d.stage === 'closed-won').length /
                    filteredDeals.filter(d => ['closed-won', 'closed-lost'].includes(d.stage)).length) *
                  100
                )
                : 0}%
            </span>
          </div>
        </div>
      </div>

      <QuarterlyForecast deals={filteredDeals} />
      <Filters filters={filters} onFiltersChange={setFilters} resultCount={filteredDeals.length} />

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map(stage => (
          <PipelineStageComponent
            key={stage.id}
            stage={stage.name.toLowerCase() as PipelineStage}
            stageId={stage.id}
            title={stage.name}
            deals={dealsByStage[stage.name.toLowerCase()] || []}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragStart={handleDragStart}
            color={
              stage.is_closed_won
                ? 'bg-green-600'
                : stage.is_closed_lost
                  ? 'bg-red-600'
                  : 'bg-blue-600'
            }
          />
        ))}
      </div>
    </div>
  );
};