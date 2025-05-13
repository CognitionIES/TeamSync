import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";

const Index = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect to dashboard if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" />;
  }

  // Handle navigation to login page
  const handleSignIn = () => {
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center  p-4">
      {/* Header Section */}
      <div className="text-center space-y-4 animate-fade-in">
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </div>
        </div>
        <h1 className="text-5xl font-bold text-gray-900 tracking-tight">
          Welcome to TeamSync
        </h1>
        <p className="text-xl text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 font-medium">
          Engineering Project Management Made Simple
        </p>
        <p className="text-lg text-gray-600 max-w-lg mx-auto">
          Some Random Text To Convience you this is good
        </p>
      </div>

      {/* Call-to-Action Button */}
      <div className="mt-8">
        <button
          onClick={handleSignIn}
          className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-lg shadow-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300"
        >
          Sign In to Your Dashboard
        </button>
      </div>

      {/* Footer Section */}
      <div className="mt-16 text-center">
        <p className="text-gray-500 text-sm mb-2">
          Trusted by None to deliver projects on time and within budget.
        </p>
        <p className="text-gray-500 text-xs">
          © {new Date().getFullYear()} TeamSync | 
        </p>
      </div>
    </div>
  );
};

export default Index;