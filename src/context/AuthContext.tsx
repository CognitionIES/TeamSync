/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useState, useContext, useEffect } from "react";
import { User, UserRole } from "@/types";
import { toast } from "sonner";
import axios from "axios";

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (role: UserRole, name: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}
// Create the auth context
export const AuthContext = createContext<AuthContextType | null>(null);

// API URL - will be taken from environment in production
const API_URL = import.meta.env.VITE_API_URL ||"https://team-sync-beige.vercel.app/api";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("teamsync_user");
    const storedToken = localStorage.getItem("teamsync_token");
    if (storedUser && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUser);
        console.log("Found stored user and token on mount:", { user: parsedUser, token: storedToken });
        setUser(parsedUser);
        setToken(storedToken);
        validateToken(storedToken);
      } catch (error) {
        console.error("Failed to parse stored user:", error);
        localStorage.removeItem("teamsync_user");
        localStorage.removeItem("teamsync_token");
        setToken(null);
      }
    } else {
      console.log("No stored user or token found on mount");
    }
  }, []);

  // Validate token with backend
  const validateToken = async (tokenToValidate: string) => {
    try {
      if (!tokenToValidate) {
        console.log("No token to validate, logging out...");
        logout();
        return;
      }

      console.log("Validating token with backend...");
      const response = await axios.get(`${API_URL}/auth/validate`, {
        headers: {
          Authorization: `Bearer ${tokenToValidate}`,
        },
      });

      console.log("Token validation response:", response.data);
      if (!response.data.user) {
        console.log("Token validation failed: No user in response, logging out...");
        logout();
      }
    } catch (error) {
      console.error("Token validation failed:", error);
      logout();
    }
  };

  // Login function
  const login = async (
    role: UserRole,
    name: string,
    password: string
  ): Promise<boolean> => {
    try {
      console.log("AuthContext login called with:", { role, name, password });
      const response = await axios.post(`${API_URL}/auth/login`, {
        name,
        password,
        role,
      });
      console.log("Login API response:", response.data);

      if (response.data.token) {
        const userData = {
          id: response.data.id,
          name: response.data.name,
          role: response.data.role,
        };

        setUser(userData);
        setToken(response.data.token);
        localStorage.setItem("teamsync_user", JSON.stringify(userData));
        localStorage.setItem("teamsync_token", response.data.token);
        console.log("Token set in localStorage:", response.data.token);
        toast.success("Login successful!");
        return true;
      } else {
        console.log("No token in login response");
        toast.error("Authentication failed");
        return false;
      }
    } catch (error: any) {
      console.error("Login error:", error);
      const errorMsg = error.response?.data?.message || "Login failed";
      toast.error(errorMsg);
      return false;
    }
  };

  // Logout function
  const logout = () => {
    console.log("Logging out...");
    setUser(null);
    setToken(null);
    localStorage.removeItem("teamsync_user");
    localStorage.removeItem("teamsync_token");
    toast.success("Logged out successfully");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};