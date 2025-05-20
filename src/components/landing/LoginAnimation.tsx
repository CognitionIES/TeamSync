import React from "react";

const LoginAnimation: React.FC = () => {
  return (
    <div className="fixed inset-0 w-full h-full -z-10 pointer-events-none overflow-hidden">
      {/* Blueprint grid */}
      <div className="absolute inset-0 grid-blueprint"></div>

      {/* Enhanced animated gradient blobs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-600/10 blur-circle animate-float"></div>
      <div
        className="absolute -bottom-48 -right-48 w-128 h-128 rounded-full bg-cyan-500/10 blur-circle animate-float"
        style={{ animationDelay: "2s" }}
      ></div>
      <div
        className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-purple-500/10 blur-circle animate-float"
        style={{ animationDelay: "3s" }}
      ></div>

      {/* Technical Elements */}
      <div className="absolute top-20 right-10 opacity-10">
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svzg"
        >
          <circle
            cx="60"
            cy="60"
            r="50"
            stroke="#2A629D"
            strokeWidth="1"
            strokeDasharray="4 2"
          />
          <circle cx="60" cy="60" r="30" stroke="#2A629D" strokeWidth="1" />
          <line
            x1="10"
            y1="60"
            x2="110"
            y2="60"
            stroke="#2A629D"
            strokeWidth="0.5"
          />
          <line
            x1="60"
            y1="10"
            x2="60"
            y2="110"
            stroke="#2A629D"
            strokeWidth="0.5"
          />
          <rect
            x="40"
            y="40"
            width="40"
            height="40"
            stroke="#2A629D"
            strokeWidth="0.75"
            strokeDasharray="3 1.5"
          />
        </svg>
      </div>

      <div className="absolute bottom-10 left-10 opacity-10">
        <svg
          width="160"
          height="160"
          viewBox="0 0 160 160"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="30"
            y="30"
            width="100"
            height="100"
            stroke="#2A629D"
            strokeWidth="1"
          />
          <rect
            x="50"
            y="50"
            width="60"
            height="60"
            stroke="#2A629D"
            strokeWidth="1"
          />
          <line
            x1="30"
            y1="30"
            x2="130"
            y2="130"
            stroke="#2A629D"
            strokeWidth="0.5"
          />
          <line
            x1="130"
            y1="30"
            x2="30"
            y2="130"
            stroke="#2A629D"
            strokeWidth="0.5"
          />
          <path
            d="M80,30 L130,80 L80,130 L30,80 Z"
            stroke="#2A629D"
            strokeWidth="0.5"
            fill="none"
          />
        </svg>
      </div>

      {/* Engineering Diagram */}
      <div
        className="absolute top-1/2 left-20 opacity-10"
        style={{ transform: "translateY(-50%)" }}
      >
        <svg
          width="140"
          height="140"
          viewBox="0 0 140 140"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M20,70 L40,40 L100,40 L120,70 L100,100 L40,100 Z"
            stroke="#2A629D"
            strokeWidth="1"
            fill="none"
          />
          <circle cx="70" cy="70" r="20" stroke="#2A629D" strokeWidth="1" />
          <line
            x1="50"
            y1="70"
            x2="90"
            y2="70"
            stroke="#2A629D"
            strokeWidth="0.5"
          />
          <line
            x1="70"
            y1="50"
            x2="70"
            y2="90"
            stroke="#2A629D"
            strokeWidth="0.5"
          />
          <circle cx="40" cy="40" r="3" fill="#2A629D" fillOpacity="0.3" />
          <circle cx="100" cy="40" r="3" fill="#2A629D" fillOpacity="0.3" />
          <circle cx="120" cy="70" r="3" fill="#2A629D" fillOpacity="0.3" />
          <circle cx="100" cy="100" r="3" fill="#2A629D" fillOpacity="0.3" />
          <circle cx="40" cy="100" r="3" fill="#2A629D" fillOpacity="0.3" />
          <circle cx="20" cy="70" r="3" fill="#2A629D" fillOpacity="0.3" />
        </svg>
      </div>
    </div>
  );
};

export default LoginAnimation;
