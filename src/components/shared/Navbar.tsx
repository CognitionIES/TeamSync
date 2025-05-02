
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { RefreshCw, LogOut } from "lucide-react";
import { Link } from "react-router-dom";

interface NavbarProps {
  onRefresh?: () => void;
}

const Navbar = ({ onRefresh }: NavbarProps) => {
  const { user, logout } = useAuth();
  
  return (
    <nav className="bg-white border-b border-gray-200 p-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Link to="/dashboard" className="font-bold text-xl">
            TeamSync
          </Link>
          <span className="hidden md:inline text-sm px-2 py-1 bg-gray-100 rounded-lg">
            {user?.role}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="flex items-center gap-1"
            >
              <RefreshCw size={16} />
              <span className="hidden sm:inline">Refresh Data</span>
            </Button>
          )}
          
          <div className="hidden md:flex items-center space-x-2">
            <span className="text-sm font-medium">{user?.name}</span>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="flex items-center gap-1"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
