import React, { useState, useEffect } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { FilterState } from '../types/index';
import { useSearchParams } from 'react-router-dom';
//import { salesReps, states, products } from '../data/mockData';
import api from '../lib/api';
import { any } from 'zod';
interface FiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  resultCount: number;
}

export const Filters: React.FC<FiltersProps> = ({ filters, onFiltersChange, resultCount }) => {
  const [searchParams] = useSearchParams();
  const [salesReps, setsalesReps] = useState([""]);
  const companyId = searchParams.get('company');
  const updateFilter = (key: keyof FilterState, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const [usersData] = await Promise.all([
          api.post('/users/all', {
            company: parseInt(companyId || '0'),
            status: 'enabled',
            filter: '',
            page: 1,
            per_page: 1000
          })
        ]);
        if (usersData?.data?.users) {
          const names = usersData.data.users.map((user: { name: string }) => user.name);
          setsalesReps(names);
        }
        console.log("Users Response:", usersData.data?.users);
        // maybe setState(response.data) here?
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchUsers();
  }, []);

  const clearFilter = (key: keyof FilterState) => {
    onFiltersChange({ ...filters, [key]: '' });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      geography: '',
      state: '',
      salesRep: '',
      product: '',
      search: ''
    });
  };

  const hasActiveFilters = Object.values(filters).some(value => value !== '');

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-medium">
            {resultCount} deals
          </span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search deals..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Geography */}
        <div className="relative">
          <select
            value={filters.geography}
            onChange={(e) => updateFilter('geography', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white transition-colors"
          >
            <option value="">All Countries</option>
            <option value="US">United States</option>
            <option value="CA">Canada</option>
            <option value="UK">United Kingdom</option>
            <option value="AU">Australia</option>
            <option value="DE">Germany</option>
            <option value="FR">France</option>
            <option value="JP">Japan</option>
            <option value="IN">India</option>
            <option value="BR">Brazil</option>
            <option value="MX">Mexico</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* State */}
        {/* <div className="relative">
          <select
            value={filters.state}
            onChange={(e) => updateFilter('state', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white transition-colors"
          >
            <option value="">All States</option>
            {states.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div> */}



        {/* Product */}
        <div className="relative">
          <select
            value={filters.product}
            onChange={(e) => updateFilter('product', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white transition-colors"
          >
            <option value="">Select Industry</option>
            <option value="Technology">Technology</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Finance">Finance</option>
            <option value="Manufacturing">Manufacturing</option>
            <option value="Retail">Retail</option>
            <option value="Education">Education</option>
            <option value="Real Estate">Real Estate</option>
            <option value="Transportation">Transportation</option>
            <option value="Energy">Energy</option>
            <option value="Media & Entertainment">Media & Entertainment</option>
            <option value="Telecommunications">Telecommunications</option>
            <option value="Consulting">Consulting</option>
            <option value="Legal">Legal</option>
            <option value="Insurance">Insurance</option>
            <option value="Hospitality">Hospitality</option>
            <option value="Food & Beverage">Food & Beverage</option>
            <option value="Automotive">Automotive</option>
            <option value="Aerospace">Aerospace</option>
            <option value="Construction">Construction</option>
            <option value="Pharmaceuticals">Pharmaceuticals</option>
            <option value="Biotechnology">Biotechnology</option>
            <option value="Chemicals">Chemicals</option>
            <option value="Mining">Mining</option>
            <option value="Agriculture">Agriculture</option>
            <option value="Fashion & Apparel">Fashion & Apparel</option>
            <option value="Sports & Recreation">Sports & Recreation</option>
            <option value="Non-Profit">Non-Profit</option>
            <option value="Government">Government</option>
            <option value="E-commerce">E-commerce</option>
            <option value="SaaS">SaaS</option>
            <option value="Fintech">Fintech</option>
            <option value="EdTech">EdTech</option>
            <option value="HealthTech">HealthTech</option>
            <option value="Clean Energy">Clean Energy</option>
            <option value="Cybersecurity">Cybersecurity</option>
            <option value="Artificial Intelligence">Artificial Intelligence</option>
            <option value="Blockchain">Blockchain</option>
            <option value="Other">Other</option>
          </select>
        </div>
        {/* Sales Rep */}
        <div className="relative">
          <select
            value={filters.salesRep}
            onChange={(e) => updateFilter('salesRep', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white transition-colors"
          >
            <option value="">All Sales Reps</option>
            {salesReps.map(rep => (
              <option key={rep} value={rep}>{rep}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-200">
          {filters.search && (
            <div className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              <span>Search: "{filters.search}"</span>
              <button onClick={() => clearFilter('search')} className="hover:bg-blue-200 rounded-full p-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          {filters.geography && (
            <div className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              <span>{filters.geography}</span>
              <button onClick={() => clearFilter('geography')} className="hover:bg-blue-200 rounded-full p-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          {/* {filters.state && (
            <div className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              <span>{filters.state}</span>
              <button onClick={() => clearFilter('state')} className="hover:bg-blue-200 rounded-full p-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
          )} */}
          {filters.salesRep && (
            <div className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              <span>{filters.salesRep}</span>
              <button onClick={() => clearFilter('salesRep')} className="hover:bg-blue-200 rounded-full p-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          {filters.product && (
            <div className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              <span>{filters.product}</span>
              <button onClick={() => clearFilter('product')} className="hover:bg-blue-200 rounded-full p-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};