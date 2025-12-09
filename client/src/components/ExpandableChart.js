import React, { useState, useRef } from 'react';
import { Maximize2, Download, Minimize2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import './ExpandableChart.css';

const ExpandableChart = ({ analyticsData, title, children }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const chartRef = useRef(null);

  const handleDownload = async () => {
    try {
      if (!chartRef.current) return;

      // Add a temporary class for better quality capture
      chartRef.current.classList.add('capturing');

      const canvas = await html2canvas(chartRef.current, {
        scale: 2, // Increase quality
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
      });

      // Remove temporary class
      chartRef.current.classList.remove('capturing');

      // Create download link
      const link = document.createElement('a');
      link.download = `${title?.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error downloading chart:', error);
    }
  };

  return (
    <div className={`chart-container bg-white rounded-lg shadow-md p-4 ${
      isExpanded ? 'fixed top-[100px] inset-4 z-50 overflow-auto' : 'relative'
    }`}>
      <div className="chart-header flex items-center justify-between mb-4 border-b border-gray-200 pb-3">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="chart-btn group"
            title="Download chart"
          >
            <Download className="w-5 h-5 group-hover:text-blue-600 transition-colors" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="chart-btn group"
            title={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? (
              <Minimize2 className="w-5 h-5 group-hover:text-blue-600 transition-colors" />
            ) : (
              <Maximize2 className="w-5 h-5 group-hover:text-blue-600 transition-colors" />
            )}
          </button>
        </div>
      </div>
      <div 
        ref={chartRef}
        className={`chart-content transition-all duration-300 ${
          isExpanded ? 'h-[calc(100vh-8rem)]' : 'h-[300px]'
        }`}
      >
        {children}
      </div>
    </div>
  );
};

export default ExpandableChart;


