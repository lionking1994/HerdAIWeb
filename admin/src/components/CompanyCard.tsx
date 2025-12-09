import React from 'react';
import { Company } from '../types';
import { Building2, Users, Calendar, CheckCircle, XCircle } from 'lucide-react';

interface CompanyCardProps {
  company: Company;
}

const CompanyCard: React.FC<CompanyCardProps> = ({ company }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 sm:gap-0">
        <div className="flex items-center">
          <div className="h-10 sm:h-12 w-10 sm:w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
            <Building2 className="h-5 sm:h-6 w-5 sm:w-6" />
          </div>
          <div className="ml-4">
            <h3 className="text-base sm:text-lg font-medium text-gray-900">
              {company.name}
            </h3>
            <p className="text-xs sm:text-sm text-gray-500">
              {company.industry}
            </p>
          </div>
        </div>
        <div>
          <span
            className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium ${
              company.status === 'active'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {company.status === 'active' ? (
              <CheckCircle className="mr-1 h-3 w-3" />
            ) : (
              <XCircle className="mr-1 h-3 w-3" />
            )}
            {company.status.charAt(0).toUpperCase() + company.status.slice(1)}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center text-xs sm:text-sm text-gray-600">
          <Users className="mr-2 h-4 w-4" />
          {company.employees} Employees
        </div>
        <div className="flex items-center text-xs sm:text-sm text-gray-600">
          <span className="mr-2 inline-block h-4 w-4 text-center font-bold">
            $
          </span>
          Subscription: {company.subscription}
        </div>
        <div className="flex items-center text-xs sm:text-sm text-gray-600">
          <Calendar className="mr-2 h-4 w-4" />
          Joined: {new Date(company.joinedDate).toLocaleDateString()}
        </div>
      </div>

      <div className="mt-5">
        <button className="w-full py-2 px-4 border border-blue-300 rounded-md shadow-sm text-xs sm:text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100">
          View Details
        </button>
      </div>
    </div>
  );
};

export default CompanyCard;
