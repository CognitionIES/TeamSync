import React from 'react';

type FeatureProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
};

const FeatureHighlight: React.FC<FeatureProps> = ({ icon, title, description }) => {
  return (
    <div className="flex items-start space-x-3 p-4 rounded-xl hover:bg-blue-50/50 transition-colors animate-slide-up opacity-0 group" style={{ animationDelay: '0.3s' }}>
      <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </div>
  );
};

export default FeatureHighlight;
