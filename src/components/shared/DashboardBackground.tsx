import React from "react";

interface DashboardBackgroundProps {
  role:
    | "Team Member"
    | "Team Lead"
    | "Data Entry"
    | "Project Manager"
    | "Admin";
}

const DashboardBackground: React.FC<DashboardBackgroundProps> = ({ role }) => {
  // Different color schemes based on role
  const getGradientColors = () => {
    switch (role) {
      case "Team Lead":
        return "from-blue-600/10 via-cyan-500/5 to-transparent";
      case "Data Entry":
        return "from-green-600/10 via-teal-500/5 to-transparent";
      case "Project Manager":
        return "from-purple-600/10 via-indigo-500/5 to-transparent";
      case "Admin":
        return "from-red-600/10 via-orange-500/5 to-transparent";
      default:
        return "from-red-600/10 via-orange-500/5 to-transparent";
    }
  };

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
      {/* Blueprint grid */}
      <div className="absolute inset-0 grid-blueprint"></div>

      {/* Role-specific gradient */}
      <div
        className={`absolute top-0 left-0 w-full h-full bg-gradient-to-b ${getGradientColors()} opacity-70`}
      ></div>

      {/* Animated gradient blobs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-600/10 blur-circle animate-float"></div>
      <div
        className="absolute -bottom-48 -right-48 w-128 h-128 rounded-full bg-cyan-500/10 blur-circle animate-float"
        style={{ animationDelay: "2s" }}
      ></div>

      {/* Technical Elements */}
      <svg
        className="absolute top-20 right-10 opacity-10"
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
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

      {/* Role-specific accent elements */}
      {role === "Team Lead" && (
        <svg
          className="absolute bottom-20 left-20 opacity-10"
          width="160"
          height="160"
          viewBox="0 0 160 160"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M80,20 L140,80 L80,140 L20,80 Z"
            stroke="#2A629D"
            strokeWidth="1"
            fill="none"
          />
          <circle
            cx="80"
            cy="80"
            r="40"
            stroke="#2A629D"
            strokeWidth="1"
            strokeDasharray="4 2"
          />
          <line
            x1="20"
            y1="80"
            x2="140"
            y2="80"
            stroke="#2A629D"
            strokeWidth="0.5"
          />
          <line
            x1="80"
            y1="20"
            x2="80"
            y2="140"
            stroke="#2A629D"
            strokeWidth="0.5"
          />
        </svg>
      )}

      {role === "Data Entry" && (
        <svg
          className="absolute bottom-20 left-20 opacity-10"
          width="160"
          height="160"
          viewBox="0 0 160 160"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="40"
            y="40"
            width="80"
            height="80"
            stroke="#2A8C70"
            strokeWidth="1"
            strokeDasharray="4 2"
          />
          <line
            x1="40"
            y1="60"
            x2="120"
            y2="60"
            stroke="#2A8C70"
            strokeWidth="0.5"
          />
          <line
            x1="40"
            y1="80"
            x2="120"
            y2="80"
            stroke="#2A8C70"
            strokeWidth="0.5"
          />
          <line
            x1="40"
            y1="100"
            x2="120"
            y2="100"
            stroke="#2A8C70"
            strokeWidth="0.5"
          />
        </svg>
      )}

      {role === "Project Manager" && (
        <svg
          className="absolute bottom-20 left-20 opacity-10"
          width="160"
          height="160"
          viewBox="0 0 160 160"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="80"
            cy="80"
            r="60"
            stroke="#6941C6"
            strokeWidth="1"
            strokeDasharray="4 2"
          />
          <path d="M80,20 L80,140" stroke="#6941C6" strokeWidth="0.5" />
          <path d="M20,80 L140,80" stroke="#6941C6" strokeWidth="0.5" />
          <circle cx="80" cy="50" r="5" stroke="#6941C6" strokeWidth="1" />
          <circle cx="80" cy="110" r="5" stroke="#6941C6" strokeWidth="1" />
          <circle cx="50" cy="80" r="5" stroke="#6941C6" strokeWidth="1" />
          <circle cx="110" cy="80" r="5" stroke="#6941C6" strokeWidth="1" />
        </svg>
      )}

      {role === "Admin" && (
        <svg
          className="absolute bottom-20 left-20 opacity-10"
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
            stroke="#C92A2A"
            strokeWidth="1"
          />
          <path d="M30,30 L130,130" stroke="#C92A2A" strokeWidth="0.5" />
          <path d="M30,130 L130,30" stroke="#C92A2A" strokeWidth="0.5" />
          <circle
            cx="80"
            cy="80"
            r="30"
            stroke="#C92A2A"
            strokeWidth="1"
            strokeDasharray="3 1"
          />
        </svg>
      )}
    </div>
  );
};

export default DashboardBackground;
