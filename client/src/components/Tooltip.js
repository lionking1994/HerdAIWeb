import React, { useState } from 'react';

export const Tooltip = ({ text, children }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative group inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
      <div className="absolute left-1/2 top-full z-10 mt-2 w-64 max-w-xs sm:max-w-sm md:max-w-md lg:w-64 -translate-x-1/2 rounded-xl border-2 border-yellow-400 bg-[#fffbe6] px-4 py-2 text-sm text-black shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {text}
      </div>
      )}
    </div>
  );
};

