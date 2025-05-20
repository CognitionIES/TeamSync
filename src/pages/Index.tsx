// import { useEffect } from "react";
// import { useAuth } from "@/context/AuthContext";
// import { Navigate, useNavigate } from "react-router-dom";

// const Index = () => {
//   const { isAuthenticated } = useAuth();
//   const navigate = useNavigate();

//   // Redirect to dashboard if already authenticated
//   if (isAuthenticated) {
//     return <Navigate to="/dashboard" />;
//   }

//   // Handle navigation to login page
//   const handleSignIn = () => {
//     navigate("/login");
//   };

//   return (
//     <div className="min-h-screen flex flex-col items-center justify-center  p-4">
//       {/* Header Section */}
//       <div className="text-center space-y-4 animate-fade-in">
//         <div className="flex justify-center mb-6">
//           <div className="h-20 w-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg flex items-center justify-center">
//             <svg
//               xmlns="http://www.w3.org/2000/svg"
//               width="40"
//               height="40"
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="white"
//               strokeWidth="2"
//               strokeLinecap="round"
//               strokeLinejoin="round"
//             >
//               <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
//             </svg>
//           </div>
//         </div>
//         <h1 className="text-5xl font-bold text-gray-900 tracking-tight">
//           Welcome to TeamSync
//         </h1>
//         <p className="text-xl text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 font-medium">
//           Engineering Project Management Made Simple
//         </p>
//         <p className="text-lg text-gray-600 max-w-lg mx-auto">
//           Some Random Text To Convience you this is good
//         </p>
//       </div>

//       {/* Call-to-Action Button */}
//       <div className="mt-8">
//         <button
//           onClick={handleSignIn}
//           className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-lg shadow-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300"
//         >
//           Sign In to Your Dashboard
//         </button>
//       </div>

//       {/* Footer Section */}
//       <div className="mt-16 text-center">
//         <p className="text-gray-500 text-sm mb-2">
//           Trusted by None to deliver projects on time and within budget.
//         </p>
//         <p className="text-gray-500 text-xs">
//           © {new Date().getFullYear()} TeamSync |
//         </p>
//       </div>
//     </div>
//   );
// };

// export default Index;
import { useAuth } from "@/context/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import BackgroundEffect from "@/components/landing/BackgroundEffect";
import PipingLogo from "@/components/landing/PipingLogo";
import FeatureHighlight from "@/components/landing/FeatureHighlight";
import { ArrowRight, Check } from "lucide-react";

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
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background Elements */}
      <BackgroundEffect />

      {/* Header Navigation */}
      <header className="px-24 relative z-10 w-full py-6 px-8 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <PipingLogo className="h-10 w-10" />
          <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-500">
            TeamSync
          </span>
        </div>
        <button
          onClick={handleSignIn}
          className="px-5 py-2 bg-white/90 hover:bg-white transition-colors rounded-lg shadow-md text-blue-600 font-medium text-sm"
        >
          Sign In
        </button>
      </header>

      {/* Main Content */}
      <main className="px-24 flex-1 flex flex-col md:flex-row items-center justify-center px-8 py-12 relative z-10">
        {/* Left Side - Hero Content */}
        <div className="w-full md:w-1/2 space-y-6 pr-0 md:pr-10 text-center md:text-left">
          <div
            className="space-y-4 animate-slide-up opacity-0"
            style={{ animationDelay: "0.1s" }}
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight ">
              Engineering Excellence In
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
                Project Management
              </span>
            </h1>
            <p className="text-lg text-gray-600 max-w-md mx-auto md:mx-0">
              Some Random Text To Convience you this is good.
            </p>
          </div>

          <div
            className="animate-slide-up opacity-0"
            style={{ animationDelay: "0.2s" }}
          >
            <button
              onClick={handleSignIn}
              className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 flex items-center justify-center space-x-2"
            >
              <span>Access Your Dashboard</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
            <p className="text-sm text-gray-500 mt-3">
              Trusted by None to deliver projects on time and within budget.
            </p>
          </div>

          
        </div>

        {/* Right Side - Visual */}
        <div
          className="w-full md:w-1/2 mt-12 md:mt-0 animate-slide-up opacity-0"
          style={{ animationDelay: "0.4s" }}
        >
          <div className="relative">
            {/* Main Image */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-2xl shadow-lg border border-blue-100 transform rotate-1">
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="h-8 flex items-center space-x-2 mb-4">
                  <div className="h-3 w-3 bg-red-400 rounded-full"></div>
                  <div className="h-3 w-3 bg-yellow-400 rounded-full"></div>
                  <div className="h-3 w-3 bg-green-400 rounded-full"></div>
                  <div className="h-4 w-32 bg-gray-100 rounded-md ml-4"></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-24 bg-blue-50 rounded-lg flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-blue-500"
                    >
                      <path d="M3 7h4a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3"></path>
                      <path d="M7 8a8 8 0 0 1 8 0"></path>
                      <path d="M15 8h6"></path>
                      <path d="M15 12h6"></path>
                      <path d="M15 16h6"></path>
                    </svg>
                  </div>
                  <div className="h-24 bg-cyan-50 rounded-lg flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-cyan-500"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                      <path d="M3 9h18"></path>
                      <path d="M9 21V9"></path>
                    </svg>
                  </div>
                  <div className="h-24 bg-indigo-50 rounded-lg flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-indigo-500"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                  </div>
                  <div className="col-span-2 h-32 bg-gray-50 rounded-lg p-3">
                    <div className="h-4 w-2/3 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 w-full bg-gray-100 rounded mb-1"></div>
                    <div className="h-3 w-full bg-gray-100 rounded mb-1"></div>
                    <div className="h-3 w-3/4 bg-gray-100 rounded"></div>
                    <div className="flex items-center space-x-2 mt-4">
                      <div className="h-6 w-16 bg-blue-100 rounded"></div>
                      <div className="h-6 w-16 bg-green-100 rounded"></div>
                    </div>
                  </div>
                  <div className="h-32 bg-blue-50 rounded-lg overflow-hidden relative">
                    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1 p-2">
                      <div className="bg-blue-100 rounded"></div>
                      <div className="bg-blue-200 rounded"></div>
                      <div className="bg-blue-300 rounded"></div>
                      <div className="bg-blue-400 rounded"></div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 h-10 bg-gray-50 rounded-lg"></div>
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute -top-6 -right-6 h-20 w-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg transform rotate-12 animate-float">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>

            <div
              className="absolute -bottom-4 -left-4 h-16 w-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg transform -rotate-6 animate-float"
              style={{ animationDelay: "2s" }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
            </div>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <div className="relative z-10 py-12 px-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureHighlight
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                </svg>
              }
              title="Piping Design Management"
              description="Track and manage complex piping designs with intuitive visual workflows"
            />
            <FeatureHighlight
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              }
              title="UPV Redline Control"
              description="Streamline approval processes with automated redline tracking and versioning"
            />
            <FeatureHighlight
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              }
              title="Team Collaboration"
              description="Effortlessly coordinate engineering teams across projects and disciplines"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 py-6 px-8 bg-gradient-to-r from-gray-50 to-blue-50">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2">
            <PipingLogo className="h-8 w-8" />
            <span className="text-sm font-medium text-gray-600">TeamSync</span>
          </div>
          <div className="mt-4 md:mt-0 flex items-center">
            <div className="mx-4 h-6 w-[1px] bg-gray-200 hidden md:block"></div>
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} TeamSync - All Rights Reserved. |
              Developed by Shah Namra
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
