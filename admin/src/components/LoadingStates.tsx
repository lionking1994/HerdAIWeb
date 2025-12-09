import React from 'react';
import { Building2, Users, TreePine } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface LoadingStatesProps {
  type: 'roles' | 'hierarchy' | 'organizations' | 'general';
  message?: string;
}

const LoadingStates: React.FC<LoadingStatesProps> = ({ type, message }) => {
  const getLoadingContent = () => {
    switch (type) {
      case 'roles':
        return {
          icon: <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />,
          text: message || 'Loading company roles...'
        };
      case 'hierarchy':
        return {
          icon: <TreePine className="h-12 w-12 text-gray-400 mx-auto mb-4" />,
          text: message || 'Loading role hierarchy...'
        };
      case 'organizations':
        return {
          icon: <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />,
          text: message || 'Loading organizations...'
        };
      default:
        return {
          icon: <LoadingSpinner size="lg" />,
          text: message || 'Loading...'
        };
    }
  };

  const { icon, text } = getLoadingContent();

  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center space-y-4">
        {icon}
        <p className="text-gray-600 dark:text-gray-300">{text}</p>
      </div>
    </div>
  );
};

// Skeleton loading components
export const RoleTableSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
    <div className="animate-pulse">
      <div className="h-12 bg-gray-200 dark:bg-gray-700"></div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4 p-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/8"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const HierarchySkeleton: React.FC = () => (
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
    <div className="lg:col-span-5">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>
          ))}
        </div>
      </div>
    </div>
    <div className="lg:col-span-7">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded border-2 border-dashed"></div>
        </div>
      </div>
    </div>
  </div>
);

export const FormSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6">
    <div className="animate-pulse">
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
        ))}
      </div>
      <div className="flex justify-end space-x-2">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
      </div>
    </div>
  </div>
);

export default LoadingStates;
