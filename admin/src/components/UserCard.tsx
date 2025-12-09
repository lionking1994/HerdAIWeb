import React from 'react';
import { User as UserType } from '../types';
import {
  User,
  Mail,
  Briefcase,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface UserCardProps {
  user: UserType;
  onToggleStatus: (id: string, currentStatus: 'active' | 'inactive') => void;
}

const UserCard: React.FC<UserCardProps> = ({ user, onToggleStatus }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 sm:gap-0">
        <div className="flex items-center">
          <div className="h-10 sm:h-12 w-10 sm:w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <User className="h-5 sm:h-6 w-5 sm:w-6" />
          </div>
          <div className="ml-4">
            <h3 className="text-base sm:text-lg font-medium text-gray-900">
              {user.name}
            </h3>
            <p className="text-xs sm:text-sm text-gray-500">{user.role}</p>
          </div>
        </div>
        <div>
          <span
            className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium ${
              user.status === 'active'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {user.status === 'active' ? (
              <CheckCircle className="mr-1 h-3 w-3" />
            ) : (
              <XCircle className="mr-1 h-3 w-3" />
            )}
            {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center text-xs sm:text-sm text-gray-600">
          <Mail className="mr-2 h-4 w-4" />
          {user.email}
        </div>
        <div className="flex items-center text-xs sm:text-sm text-gray-600">
          <Briefcase className="mr-2 h-4 w-4" />
          {user.company}
        </div>
        <div className="flex items-center text-xs sm:text-sm text-gray-600">
          <Clock className="mr-2 h-4 w-4" />
          Last login: {formatDate(user.lastLogin)}
        </div>
      </div>

      <div className="mt-5">
        <button
          onClick={() => onToggleStatus(user.id, user.status)}
          className={`w-full py-2 px-4 border rounded-md text-xs sm:text-sm font-medium ${
            user.status === 'active'
              ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
              : 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
          }`}
        >
          {user.status === 'active' ? 'Deactivate User' : 'Activate User'}
        </button>
      </div>
    </div>
  );
};

export default UserCard;
