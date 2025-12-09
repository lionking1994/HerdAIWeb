import React from 'react';

interface YearSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  years: string[];
}

export const YearSelect: React.FC<YearSelectProps> = ({ value, onChange, className, years }) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 ${className}`}
    >
      <option value="" disabled>Select Year</option>
      {years.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </select>
  );
};