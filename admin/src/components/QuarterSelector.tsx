import React from 'react';

interface Props {
  currentQuarter: string;
  onQuarterChange: (quarter: string) => void;
}

export const QuarterSelector: React.FC<Props> = ({ currentQuarter, onQuarterChange }) => {
  return (
    <div className="inline-block">
      <select
        value={currentQuarter}
        onChange={(e) => onQuarterChange(e.target.value)}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="Q1/2025">Q1/2025</option>
        <option value="Q2/2025">Q2/2025</option>
        <option value="Q3/2025">Q3/2025</option>
        <option value="Q4/2025">Q4/2025</option>
      </select>
    </div>
  );
};