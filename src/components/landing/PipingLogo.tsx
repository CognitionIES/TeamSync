import React from 'react';

const PipingLogo: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl blur-sm transform scale-105 opacity-70"></div>
      <div className="relative bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl shadow-lg flex items-center justify-center h-full w-full">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="white" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="w-1/2 h-1/2 blue-filter"
        >
          {/* Custom Piping Icon */}
          <path d="M3 7h4a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3" />
          <path d="M7 8a8 8 0 0 1 8 0" />
          <path d="M15 8h6" />
          <path d="M15 12h6" />
          <path d="M15 16h6" />
          <circle cx="15" cy="8" r="2" />
          <circle cx="15" cy="12" r="2" />
          <circle cx="15" cy="16" r="2" />
        </svg>
      </div>
    </div>
  );
};

export default PipingLogo;
