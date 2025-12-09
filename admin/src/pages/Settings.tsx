import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Plus, Edit2, Trash2, FileText } from 'lucide-react';
import { toast } from 'react-toastify';
import { YearSelect } from '../components/YearSelect';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

interface Company {
  id: string;
  name: string;
  description: string;
  domain: string;
  created_at: string;
  auto_create_tasks_from_activities?: boolean;
  default_cph?: number;
  show_cost_estimates?: boolean;
}

interface Strategy {
  id: string;
  strategy: string;
  created_at: string;
  year: string;
}

const generateYearRange = (currentYear: number): string[] => {
  return [
    (currentYear - 2).toString(),
    (currentYear - 1).toString(),
    currentYear.toString(),
    (currentYear + 1).toString(),
    (currentYear + 2).toString(),
  ];
};

const Settings: React.FC = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const isCurrentOrFutureYear = parseInt(selectedYear) >= currentYear;
  const [formData, setFormData] = useState({ strategy: '' });
  const [company, setCompany] = useState<Company | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [description, setDescription] = useState('');
  const [defaultCPH, setDefaultCPH] = useState<number | ''>('');
  const [isEditingCPH, setIsEditingCPH] = useState(false);
  const [showCostEstimates, setShowCostEstimates] = useState<boolean>(false);

  // Define YearSelectWithAvailableYears inside the component to access availableYears
  const YearSelectWithAvailableYears: React.FC<{
    value: string;
    onChange: (value: string) => void;
    className?: string;
  }> = ({ value, onChange, className }) => (
    <YearSelect
      value={value}
      onChange={onChange}
      className={className}
      years={availableYears}
    />
  );

  // Fetch available years
  const fetchAvailableYears = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/company-strategy/years/${companyId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Merge the API years with our generated range and remove duplicates
      const apiYears = response.data.years;
      const yearRange = generateYearRange(currentYear);
      const mergedYears = [...new Set([...yearRange, ...apiYears])].sort((a, b) => b.localeCompare(a));

      setAvailableYears(mergedYears);

      // Set default year to current year
      setValue('year', currentYear.toString());
      setSelectedYear(currentYear.toString());
    } catch {
      toast.error('Failed to fetch available years');
    }
  };

  useEffect(() => {
    if (companyId) {
      fetchAvailableYears();
      fetchStrategies(selectedYear);
    }
  }, [companyId]);

  const strategyFormSchema = z.object({
    strategy: z.string().min(1, "Strategy is required"),
    year: z.string().refine(
      (year) => availableYears.includes(year),
      "Invalid year selected"
    ),
  });

  type StrategyFormData = z.infer<typeof strategyFormSchema>;

  const form = useForm<StrategyFormData>({
    resolver: zodResolver(strategyFormSchema),
    defaultValues: {
      strategy: '',
      year: '',
    },
  });

  const { register, handleSubmit, formState: { errors }, setValue, reset } = form;

  // Update year selection handler
  const handleYearChange = (year: string) => {
    console.log(year)
    setValue('year', year);
    setSelectedYear(year);
    fetchStrategies(year);
  };

  const fetchStrategies = async (year: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/company-strategy/${companyId}`,
        {
          params: { year },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setStrategies(response.data.strategies);
    } catch (error) {
      void (error as Error);
      toast.error('Failed to fetch strategies');
    }
  };

  const handleAdd = async (data: StrategyFormData) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/company-strategy/${companyId}`,
        data,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setIsAddModalOpen(false);
      reset(); // Reset the form
      fetchStrategies(selectedYear);
      toast.success('Strategy added successfully');
    } catch (error) {
      void (error as Error);
      toast.error('Failed to add strategy');
    }
  };

  const handleEdit = async (data: StrategyFormData) => {
    if (!selectedStrategy || parseInt(selectedStrategy.year) < currentYear) {
      toast.error("Cannot edit strategies from past years");
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const payload = {
        strategy: data.strategy,
        year: data.year
      };

      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/company-strategy/${selectedStrategy.id}`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setIsEditModalOpen(false);
      setSelectedStrategy(null);
      fetchStrategies(selectedYear);
      toast.success('Strategy updated successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to update strategy');
    }
  };

  const handleEditSubmit = async () => {
    if (!selectedStrategy || parseInt(selectedStrategy.year) < currentYear) {
      toast.error("Cannot edit strategies from past years");
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const payload = {
        strategy: formData.strategy,
        year: selectedStrategy.year
      };

      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/company-strategy/${selectedStrategy.id}`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setIsEditModalOpen(false);
      setSelectedStrategy(null);
      setFormData({ strategy: '' });
      fetchStrategies(selectedYear);
      toast.success('Strategy updated successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to update strategy');
    }
  };

  const handleDelete = async () => {
    if (!selectedStrategy) return;

    if (parseInt(selectedStrategy.year) < currentYear) {
      toast.error("Cannot delete strategies from past years");
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${import.meta.env.VITE_API_BASE_URL}/company-strategy/${selectedStrategy.id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setIsDeleteModalOpen(false);
      setSelectedStrategy(null);
      fetchStrategies(selectedYear);
      toast.success('Strategy deleted successfully');
    } catch (error) {
      void (error as Error);
      toast.error('Failed to delete strategy');
    }
  };

  // Add this useEffect to handle populating the edit form
  useEffect(() => {
    if (selectedStrategy) {
      reset({
        strategy: selectedStrategy.strategy,
        year: selectedStrategy.year
      });
    }
  }, [selectedStrategy, reset]);

  // When opening the Add modal, set the current year
  const handleOpenAddModal = () => {
    reset({
      strategy: '',
      year: currentYear.toString()
    });
    setIsAddModalOpen(true);
  };

  // Add this function to fetch company details
  const fetchCompanyDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/company/${companyId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setCompany(response.data.company);
      setDescription(response.data.company.description || '');
      setDefaultCPH(response.data.company.default_cph ?? '');
      setShowCostEstimates(response.data.company.show_cost_estimates ?? false);
    } catch {
      toast.error('Failed to fetch company details');
    }
  };

  // Add this function to update company description
  const handleUpdateDescription = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/company/${companyId}`,
        { ...company, description },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setIsEditingDescription(false);
      fetchCompanyDetails();
      toast.success('Company description updated successfully');
    } catch {
      toast.error('Failed to update company description');
    }
  };

  // Add this function to update company auto create tasks setting
  const handleToggleAutoCreateTasks = async (value: boolean) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/company/${companyId}/toggle-auto-create-tasks`,
        { autoCreateTasks: value },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setCompany(prev => prev ? { ...prev, auto_create_tasks_from_activities: value } : null);
      toast.success('Auto create tasks setting updated successfully');
    } catch {
      toast.error('Failed to update auto create tasks setting');
    }
  };

  // Add this function to update defaultCPH
  const handleUpdateDefaultCPH = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/company/${companyId}`,
        { ...company, default_cph: defaultCPH },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setIsEditingCPH(false);
      fetchCompanyDetails();
      toast.success('Default Cost Per Hour updated successfully');
    } catch {
      toast.error('Failed to update Default Cost Per Hour');
    }
  };

  // Add this function to update show cost estimates setting
  const handleToggleShowCostEstimates = async (value: boolean) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/company/${companyId}/toggle-show-cost-estimates`,
        { showCostEstimates: value },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setShowCostEstimates(value);
      toast.success('Show Cost Estimates setting updated successfully');
    } catch {
      toast.error('Failed to update Show Cost Estimates setting');
    }
  };

  // Add this useEffect to fetch company details on mount
  useEffect(() => {
    if (companyId) {
      fetchCompanyDetails();
    }
  }, [companyId]);

  return (
    <div className="p-6 flex-1 overflow-y-auto">
      {/* Company Description Section */}
      <div className="mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold">Company Profile</h2>
            {!isEditingDescription && (
              <button
                onClick={() => setIsEditingDescription(true)}
                className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
              >
                <Edit2 size={16} />
                Edit Description
              </button>
            )}
          </div>
          
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">{company?.name}</h3>
            <p className="text-gray-600 text-sm mb-2">Domain: {company?.domain}</p>
          </div>

          {isEditingDescription ? (
            <div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 border rounded-lg mb-4"
                rows={4}
                placeholder="Enter company description..."
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setIsEditingDescription(false);
                    setDescription(company?.description || '');
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateDescription}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="prose max-w-none">
              {company?.description ? (
                <p className="text-gray-700">{company.description}</p>
              ) : (
                <p className="text-gray-500 italic">No company description available</p>
              )}
            </div>
          )}

          {/* Auto Create Tasks Toggle */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-md font-semibold">Auto Create Tasks from Activities</h3>
                <p className="text-sm text-gray-600 mt-1">
                  When enabled, tasks will be automatically created from activities when meetings are imported and scored.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={company?.auto_create_tasks_from_activities || false}
                  onChange={(e) => handleToggleAutoCreateTasks(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* Default Cost Per Hour and Show Cost Estimates */}
          <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Default Cost Per Hour:</span>
              {isEditingCPH ? (
                <>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={defaultCPH}
                    onChange={e => setDefaultCPH(e.target.value === '' ? '' : Number(e.target.value))}
                    className="border rounded px-2 py-1 w-24"
                  />
                  <button
                    onClick={handleUpdateDefaultCPH}
                    className="ml-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setIsEditingCPH(false); setDefaultCPH(company?.default_cph ?? ''); }}
                    className="ml-1 px-3 py-1 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="ml-1">${company?.default_cph ?? 'N/A'}</span>
                  <button
                    onClick={() => setIsEditingCPH(true)}
                    className="ml-2 px-2 py-1 text-blue-600 hover:text-blue-800 border border-blue-200 rounded"
                  >
                    Edit
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Show Cost Estimates?</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={showCostEstimates}
                  onChange={e => handleToggleShowCostEstimates(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Existing Company Strategy Section */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Company Strategy</h1>
        <div className="flex items-center gap-3">
          <YearSelectWithAvailableYears
            value={selectedYear}
            onChange={handleYearChange}
            className="w-[140px]"
          />
          <button
            onClick={handleOpenAddModal}
            className={`bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 whitespace-nowrap ${!isCurrentOrFutureYear ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            disabled={!isCurrentOrFutureYear}
          >
            <Plus size={20} /> Add Strategy
          </button>
        </div>
      </div>

      {strategies.length > 0 ? (
        <div className="bg-white rounded-lg shadow">
          <ul className="divide-y divide-gray-200">
            {strategies.map((strategy) => (
              <li key={strategy.id} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                      <p className="text-gray-700">{strategy.strategy}</p>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 ml-4">
                      Created: {new Date(strategy.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {isCurrentOrFutureYear && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setSelectedStrategy(strategy);
                          setFormData({ strategy: strategy.strategy });
                          setIsEditModalOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 p-1"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStrategy(strategy);
                          setIsDeleteModalOpen(true);
                        }}
                        className="text-red-600 hover:text-red-800 p-1"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow">
          <FileText size={48} className="text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No Strategies Found</h3>
          <p className="text-gray-500 text-center mb-4">
              {isCurrentOrFutureYear
                ? "Get started by adding your first company strategy"
                : "No strategies found for this year"}
          </p>
            {isCurrentOrFutureYear && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
              >
                <Plus size={20} /> Add Your First Strategy
              </button>
            )}
        </div>
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-[500px]">
            <h2 className="text-xl font-bold mb-4">Add New Strategy</h2>
            <form onSubmit={handleSubmit(handleAdd)}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Year
                </label>
                <input
                  type="text"
                  {...register('year')}
                  className="w-full p-2 border rounded"
                  readOnly
                />
                {errors.year && (
                  <p className="text-red-500 text-sm">{errors.year.message}</p>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Strategy
                </label>
                <textarea
                  {...register('strategy')}
                  className="w-full p-2 border rounded"
                  rows={4}
                  placeholder="Enter your strategy"
                />
                {errors.strategy && (
                  <p className="text-red-500 text-sm">{errors.strategy.message}</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    setIsAddModalOpen(false);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-[500px]">
            <h2 className="text-xl font-bold mb-4">Edit Strategy</h2>
            <textarea
              placeholder="Enter your strategy"
              className="w-full p-2 border rounded mb-4"
              value={formData.strategy}
              onChange={(e) => setFormData({ strategy: e.target.value })}
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setFormData({ strategy: '' });
                  setIsEditModalOpen(false);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-[400px]">
            <h2 className="text-xl font-bold mb-4">Delete Strategy</h2>
            <p>Are you sure you want to delete this strategy?</p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
