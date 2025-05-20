
import React from 'react';

const BackgroundEffect: React.FC = () => {
  return (
    <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none">
      {/* Technical Blueprint Grid */}
      <div className="absolute inset-0 grid-blueprint"></div>
      
      {/* Enhanced Gradient Orbs */}
      <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-cyan-500/30 blur-circle animate-float"></div>
      <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-indigo-600/20 blur-circle animate-float" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-1/2 left-1/3 w-128 h-128 rounded-full bg-blue-500/10 blur-circle animate-pulse-slow"></div>
      <div className="absolute bottom-1/3 right-1/4 w-72 h-72 rounded-full bg-purple-500/10 blur-circle animate-float" style={{ animationDelay: '4s' }}></div>
      
      {/* Technical Elements */}
      <svg className="absolute top-10 right-10 w-32 h-32 text-blue-900/5" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="8 4" />
        <circle cx="100" cy="100" r="40" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="20" y1="100" x2="180" y2="100" stroke="currentColor" strokeWidth="1" />
        <line x1="100" y1="20" x2="100" y2="180" stroke="currentColor" strokeWidth="1" />
      </svg>
      
      <svg className="absolute bottom-10 left-10 w-48 h-48 text-blue-900/5" viewBox="0 0 200 200">
        <rect x="50" y="50" width="100" height="100" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="50" y1="50" x2="150" y2="150" stroke="currentColor" strokeWidth="1" />
        <line x1="150" y1="50" x2="50" y2="150" stroke="currentColor" strokeWidth="1" />
        <circle cx="100" cy="100" r="25" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />
      </svg>
      
      {/* Additional Engineering Elements */}
      <svg className="absolute top-1/3 left-10 w-40 h-40 text-blue-900/5" viewBox="0 0 200 200">
        <path d="M20,100 L50,60 L150,60 L180,100 L150,140 L50,140 Z" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="100" cy="100" r="30" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 2" />
        <line x1="20" y1="100" x2="180" y2="100" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 2" />
      </svg>
    </div>
  );
};

export default BackgroundEffect;