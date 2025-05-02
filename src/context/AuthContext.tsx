/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { createContext, useState, useContext, useEffect } from "react";
import { User, UserRole, AuthContextType } from "@/types";
import { toast } from "sonner";
import axios from "axios";

// Create the auth context
export const AuthContext = createContext<AuthContextType | null>(null);

// API URL - will be taken from environment in production
const API_URL = "/api";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("teamsync_user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);

        // Validate token with backend
        validateToken();
      } catch (error) {
        console.error("Failed to parse stored user:", error);
        localStorage.removeItem("teamsync_user");
      }
    }
  }, []);

  // Validate token with backend
  const validateToken = async () => {
    try {
      const token = localStorage.getItem("teamsync_token");
      if (!token) {
        logout();
        return;
      }

      const response = await axios.get(`${API_URL}/auth/validate`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.data.valid) {
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
      const response = await axios.post(`${API_URL}/auth/login`, {
        name,
        password,
        role,
      });

      if (response.data.token) {
        const userData = {
          id: response.data.user.id,
          name: response.data.user.name,
          role: response.data.user.role,
        };

        setUser(userData);
        localStorage.setItem("teamsync_user", JSON.stringify(userData));
        localStorage.setItem("teamsync_token", response.data.token);
        toast.success("Login successful!");
        return true;
      } else {
        toast.error("Authentication failed");
        return false;
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || "Login failed";
      toast.error(errorMsg);
      return false;
    }
  };

  // Logout function
  const logout = () => {
    setUser(null);
    localStorage.removeItem("teamsync_user");
    localStorage.removeItem("teamsync_token");
    toast.success("Logged out successfully");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
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
