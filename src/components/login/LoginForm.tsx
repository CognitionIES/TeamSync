
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { UserRole } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";

// API URL - will be taken from environment in production
const API_URL = "/api";

const LoginForm = () => {
  const [role, setRole] = useState<UserRole | "">("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [nameOptions, setNameOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Update name options when role changes
  useEffect(() => {
    if (role) {
      fetchUsersByRole(role as UserRole);
    } else {
      setNameOptions([]);
      setName("");
    }
  }, [role]);

  // Fetch users by role from backend
  const fetchUsersByRole = async (selectedRole: UserRole) => {
    setIsLoadingUsers(true);
    try {
      const response = await axios.get(`${API_URL}/users/role/${selectedRole}`);
      if (response.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setNameOptions(response.data.map((user: any) => user.name));
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
      setNameOptions([]);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!role || !name || !password) {
      return;
    }
    
    setIsLoading(true);
    try {
      const success = await login(role as UserRole, name, password);
      if (success) {
        navigate("/dashboard");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">TeamSync</CardTitle>
        <CardDescription className="text-center">
          Enter your credentials to access your dashboard
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="role" className="text-sm font-medium">
              Position
            </label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as UserRole)}
            >
              <SelectTrigger id="role" aria-label="Select position">
                <SelectValue placeholder="Select your position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Data Entry">Data Entry</SelectItem>
                <SelectItem value="Team Member">Team Member</SelectItem>
                <SelectItem value="Team Lead">Team Lead</SelectItem>
                <SelectItem value="Project Manager">Project Manager</SelectItem>
                <SelectItem value="Admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <Select
              value={name}
              onValueChange={setName}
              disabled={!role || isLoadingUsers}
            >
              <SelectTrigger id="name" aria-label="Select name">
                <SelectValue placeholder={isLoadingUsers ? "Loading..." : role ? "Select your name" : "Select a position first"} />
              </SelectTrigger>
              <SelectContent>
                {nameOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={!name}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            type="submit" 
            className="w-full"
            disabled={!role || !name || !password || isLoading}
          >
            {isLoading ? "Logging in..." : "Login"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default LoginForm;
