import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Check, ChevronDown } from 'lucide-react';
import axios from 'axios';
import { WorkflowUser } from '../../types';

interface UserSearchComboboxProps {
  selectedUsers: WorkflowUser[];
  onUsersChange: (users: WorkflowUser[]) => void;
  placeholder?: string;
  className?: string;
}

const UserSearchCombobox: React.FC<UserSearchComboboxProps> = ({
  selectedUsers,
  onUsersChange,
  placeholder = "Search users...",
  className = ""
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<WorkflowUser[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search users when search term changes
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchTerm.trim() || searchTerm.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const response = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/users/search`,
          {
            email: searchTerm,
            limit: 10,
            cur_emails: selectedUsers.map(user => ({ email: user.email })),
            searchGlobal: true,
            isAddingUser: true
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        if (response.data.success) {
          // Filter out already selected users
          const filteredUsers = response.data.users.filter((user: WorkflowUser) => 
            !selectedUsers.some(selected => selected.id === user.id)
          );
          setSearchResults(filteredUsers);
        }
      } catch (error) {
        console.error('Error searching users:', error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      if (searchTerm.trim()) {
        searchUsers();
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, selectedUsers]);

  const handleUserSelect = (user: WorkflowUser) => {
    if (!selectedUsers.some(selected => selected.id === user.id)) {
      onUsersChange([...selectedUsers, user]);
    }
    setSearchTerm('');
    setSearchResults([]);
    setIsDropdownOpen(false);
    inputRef.current?.focus();
  };

  const handleUserRemove = (userId: number) => {
    onUsersChange(selectedUsers.filter(user => user.id !== userId));
  };

  const handleInputFocus = () => {
    setIsDropdownOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (e.target.value.trim()) {
      setIsDropdownOpen(true);
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Selected Users Display */}
      {selectedUsers.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm"
            >
              <span className="font-medium">{user.name}</span>
              <span className="text-blue-600">({user.email})</span>
              <button
                type="button"
                onClick={() => handleUserRemove(user.id)}
                className="ml-1 text-blue-600 hover:text-blue-800"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </div>
      </div>

      {/* Dropdown Results */}
      {isDropdownOpen && (searchResults.length > 0 || isLoading) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-gray-500">
              Searching...
            </div>
          ) : (
            <div>
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleUserSelect(user)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                  <Check className="w-4 h-4 text-blue-500" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No Results Message */}
      {isDropdownOpen && !isLoading && searchTerm.trim() && searchResults.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
          <div className="px-4 py-2 text-sm text-gray-500">
            No users found
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSearchCombobox; 