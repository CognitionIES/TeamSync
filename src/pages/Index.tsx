
import { useEffect } from "react";
import LoginForm from "@/components/login/LoginForm";
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";

const Index = () => {
  const { isAuthenticated } = useAuth();
  
  // Redirect to dashboard if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 via-white-50 to-gray-100 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2 animate-fade-in">
          <div className="mb-8">
            <div className="flex justify-center">
              <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">TeamSync</h1>
            <div className="mt-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 font-medium text-lg">
              Engineering Project Management
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="p-6 sm:p-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">Sign In</h2>
              <LoginForm />
            </div>
            
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 px-6 py-4 text-center border-t">
              <p className="text-sm text-gray-600">
                Select your position and enter your credentials to access your dashboard
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-12 text-center">
        <p className="text-gray-500 text-sm mb-2">
          Streamline project management with integrated tasks, timelines, and team collaboration
        </p>
        <p className="text-gray-500 text-xs">
          &copy; {new Date().getFullYear()} TeamSync Engineering. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Index;
