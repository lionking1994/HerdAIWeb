import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { createCRMService } from '../../services/crm/crmService';
import { useSearchParams } from 'react-router-dom';

interface GlobalSearchProps {
  className?: string;
}

interface SearchResult {
  type: 'account' | 'contact' | 'opportunity';
  id: string;
  name: string;
  description?: string;
  url: string;
}

export default function GlobalSearch({ className = '' }: GlobalSearchProps) {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Create CRM service instance
  const crmService = companyId ? createCRMService(companyId) : null;

  useEffect(() => {
    const searchTimeout = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        performSearch();
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchTerm]);

  const performSearch = async () => {
    if (!searchTerm.trim() || !crmService) return;

    setIsSearching(true);
    try {
      const searchResults = await crmService.globalSearch(searchTerm);
      
      const formattedResults: SearchResult[] = [
        ...searchResults.accounts.map(account => ({
          type: 'account' as const,
          id: account.id,
          name: account.display_name || account.name,
          description: account.industry,
          url: `/crm/accounts?company=${companyId}`
        })),
        ...searchResults.contacts.map(contact => ({
          type: 'contact' as const,
          id: contact.id,
          name: contact.display_name || `${contact.first_name} ${contact.last_name}`,
          description: contact.title,
          url: `/crm/contacts?company=${companyId}`
        })),
        ...searchResults.opportunities.map(opportunity => ({
          type: 'opportunity' as const,
          id: opportunity.id,
          name: opportunity.display_name || opportunity.name,
          description: opportunity.stage_name,
          url: `/crm/opportunities?company=${companyId}`
        }))
      ];

      setResults(formattedResults);
      setShowResults(true);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleInputFocus = () => {
    if (results.length > 0) {
      setShowResults(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding results to allow clicking on them
    setTimeout(() => setShowResults(false), 200);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'account':
        return '🏢';
      case 'contact':
        return '👤';
      case 'opportunity':
        return '🎯';
      default:
        return '📄';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'account':
        return 'Account';
      case 'contact':
        return 'Contact';
      case 'opportunity':
        return 'Opportunity';
      default:
        return 'Unknown';
    }
  };

  // Don't render if no company ID
  if (!companyId) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder="Search accounts, contacts, opportunities..."
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        />
        {isSearching && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto focus:outline-none sm:text-sm">
          {results.map((result) => (
            <div
              key={`${result.type}-${result.id}`}
              className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-blue-50"
              onClick={() => {
                window.location.href = result.url;
                setShowResults(false);
              }}
            >
              <div className="flex items-center">
                <span className="text-lg mr-2">{getTypeIcon(result.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {result.name}
                    </p>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {getTypeLabel(result.type)}
                    </span>
                  </div>
                  {result.description && (
                    <p className="text-sm text-gray-500 truncate">
                      {result.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Results Message */}
      {showResults && searchTerm.trim().length >= 2 && results.length === 0 && !isSearching && (
        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md py-3 px-3 text-sm text-gray-500 text-center">
          No results found for "{searchTerm}"
        </div>
      )}
    </div>
  );
}
