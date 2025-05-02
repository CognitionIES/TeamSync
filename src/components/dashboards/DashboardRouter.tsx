
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";
import DataEntryDashboard from "./DataEntryDashboard";
import TeamMemberDashboard from "./TeamMemberDashboard";
import TeamLeadDashboard from "./TeamLeadDashboard";
import ProjectManagerDashboard from "./ProjectManagerDashboard";
import AdminDashboard from "./AdminDashboard";

const DashboardRouter = () => {
  const { user, isAuthenticated } = useAuth();
  
  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/" />;
  }
  
  // Render the appropriate dashboard based on user role
  switch (user.role) {
    case "Data Entry":
      return <DataEntryDashboard />;
    case "Team Member":
      return <TeamMemberDashboard />;
    case "Team Lead":
      return <TeamLeadDashboard />;
    case "Project Manager":
      return <ProjectManagerDashboard />;
    case "Admin":
      return <AdminDashboard />;
    default:
      // Fallback to login if role is not recognized
      return <Navigate to="/" />;
  }
};

export default DashboardRouter;
