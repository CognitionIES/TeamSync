/* eslint-disable @typescript-eslint/no-explicit-any */
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Analytics } from "@vercel/analytics/react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import DashboardRouter from "./components/dashboards/DashboardRouter";
import LoginForm from "@/components/login/LoginForm";
import ProtectedRoute from "@/components/ProtectedRoute";
import TeamLeadMemberView from "@/components/dashboards/TeamLeadMemberView";
import TeamLeadDashboard from "@/components/dashboards/TeamLeadDashboard";
import axios from "axios";

// Configure axios defaults
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("teamsync_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Handle unauthorized responses globally
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("teamsync_user");
      localStorage.removeItem("teamsync_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
const CreateTaskRoute = () => {
  const { user } = useAuth();

  if (!["Team Lead", "Project Manager"].includes(user?.role || "")) {
    return <Navigate to="/" replace />;
  }

  return <TeamLeadDashboard />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Analytics />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<LoginForm />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardRouter />
                </ProtectedRoute>
              }
            />
            {/* ✅ FIXED: Single create-task route */}
            <Route
              path="/create-task"
              element={
                <ProtectedRoute>
                  <CreateTaskRoute />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-tasks"
              element={
                <ProtectedRoute>
                  <TeamLeadMemberView />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
