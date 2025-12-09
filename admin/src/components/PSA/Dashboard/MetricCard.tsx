import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: typeof LucideIcon;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo';
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'bg-blue-500',
    text: 'text-blue-700',
    change: {
      increase: 'text-green-600',
      decrease: 'text-red-600',
    }
  },
  green: {
    bg: 'bg-green-50',
    icon: 'bg-green-500',
    text: 'text-green-700',
    change: {
      increase: 'text-green-600',
      decrease: 'text-red-600',
    }
  },
  yellow: {
    bg: 'bg-yellow-50',
    icon: 'bg-yellow-500',
    text: 'text-yellow-700',
    change: {
      increase: 'text-green-600',
      decrease: 'text-red-600',
    }
  },
  red: {
    bg: 'bg-red-50',
    icon: 'bg-red-500',
    text: 'text-red-700',
    change: {
      increase: 'text-green-600',
      decrease: 'text-red-600',
    }
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'bg-purple-500',
    text: 'text-purple-700',
    change: {
      increase: 'text-green-600',
      decrease: 'text-red-600',
    }
  },
  indigo: {
    bg: 'bg-indigo-50',
    icon: 'bg-indigo-500',
    text: 'text-indigo-700',
    change: {
      increase: 'text-green-600',
      decrease: 'text-red-600',
    }
  },
};

export default function MetricCard({ title, value, icon: Icon, change, color }: MetricCardProps) {
  const classes = colorClasses[color];
  
  return (
    <div className={`${classes.bg} rounded-xl p-6 border border-gray-100 hover:shadow-lg transition-shadow duration-200`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {change && (
            <div className="flex items-center mt-2">
              <span className={`text-sm font-medium ${classes.change[change.type]}`}>
                {change.type === 'increase' ? '+' : '-'}{Math.abs(change.value)}%
              </span>
              <span className="text-gray-500 text-sm ml-2">vs last period</span>
            </div>
          )}
        </div>
        <div className={`${classes.icon} p-3 rounded-xl`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}