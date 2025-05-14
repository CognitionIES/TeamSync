/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import Navbar from "../shared/Navbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import axios, { AxiosError } from "axios";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "https://team-sync-beige.vercel.apphttps://team-sync-beige.vercel.app/api"; // Updated to match port 3000

const DataEntryDashboard = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("pids");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [isProjectSelected, setIsProjectSelected] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [showNewAreaForm, setShowNewAreaForm] = useState(false); // State for new area form
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  const pidForm = useForm({
    defaultValues: {
      areaId: "",
      pidNumber: "",
      lines: "",
    },
  });

  const equipmentForm = useForm({
    defaultValues: {
      areaId: "",
      equipmentList: "",
    },
  });

  const newProjectForm = useForm({
    defaultValues: {
      projectName: "",
    },
  });

  const newAreaForm = useForm({
    defaultValues: {
      areaName: "",
    },
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      toast.error("Please log in to access the dashboard.");
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, navigate]);
  const fetchProjects = async () => {
    try {
      const response = await axios.get<{
        data: { id: number; name: string }[];
      }>(`${API_URL}/projects`, getAuthHeaders());
      const projectData = response.data.data.map((project) => ({
        id: project.id.toString(),
        name: project.name,
      }));
      setProjects(projectData);
      if (projectData.length > 0) {
        setSelectedProject(projectData[0].id);
      } else {
        toast.warning(
          "No projects available. Please contact an Admin to be assigned to a project."
        );
      }
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching projects:", axiosError);
      const errorMessage =
        axiosError.response?.data?.message || "Failed to fetch projects";
      toast.error(errorMessage);
      if (axiosError.response?.status === 403) {
        toast.error(
          "You are not authorized to view projects. Redirecting to login..."
        );
        navigate("/login", { replace: true });
      } else if (axiosError.response?.status === 500) {
        toast.error(
          "A server error occurred while fetching projects. Please try again later or contact support."
        );
      }
    }
  };
  const fetchAreas = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/areas/project/${selectedProject}`
      );
      let areaData = [];
      if (Array.isArray(response.data)) {
        areaData = response.data;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        areaData = response.data.data;
      } else {
        throw new Error("Unexpected response format from areas API");
      }

      setAreas(
        areaData.map((area: any) => ({
          id: area.id.toString(),
          name: area.name,
        }))
      );
      setIsProjectSelected(true);
    } catch (error: any) {
      console.error("Error fetching areas:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      let errorMessage = "Failed to fetch areas for the selected project.";
      if (error.response?.status === 404) {
        errorMessage = "No areas found for this project.";
        setAreas([]); // Allow dashboard to continue without areas
        setIsProjectSelected(true); // Enable forms, but area selection will be empty
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      toast.error(errorMessage);
    }
  };

  useEffect(() => {
    if (!selectedProject) {
      setAreas([]);
      setIsProjectSelected(false);
      return;
    }

    if (isAuthenticated) {
      fetchAreas();
    }
  }, [selectedProject, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProjects();
    }
  }, [isAuthenticated]);

  const handleRefresh = () => {
    toast.success("Data refreshed");
    fetchProjects();
    if (selectedProject) {
      fetchAreas();
    }
  };

  const handleProjectChange = (value: string) => {
    setSelectedProject(value);
  };

  const onNewProjectSubmit = async (values: any) => {
    try {
      await axios.post(`${API_URL}/projects`, { name: values.projectName });
      toast.success(`Project ${values.projectName} created successfully`);
      newProjectForm.reset();
      setShowNewProjectForm(false);
      fetchProjects();
    } catch (error: any) {
      console.error("Error creating project:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to create project";
      toast.error(errorMessage);
    }
  };

  const onNewAreaSubmit = async (values: any) => {
    try {
      await axios.post(`${API_URL}/areas`, {
        name: values.areaName,
        project_id: selectedProject, // Change `projectId` to `project_id`
      });
      toast.success(`Area ${values.areaName} created successfully`);
      newAreaForm.reset();
      setShowNewAreaForm(false);
      fetchAreas(); // Refresh areas list
    } catch (error: any) {
      console.error("Error creating area:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to create area";
      toast.error(errorMessage);
    }
  };

  const onPIDSubmit = async (values: any) => {
    if (!isProjectSelected) {
      toast.error("Please select a project first");
      return;
    }

    try {
      const pidResponse = await axios.post(`${API_URL}/pids`, {
        pid_number: values.pidNumber,
        description: `P&ID for ${values.pidNumber}`,
        area_id: values.areaId || null,
        project_id: selectedProject,
      });

      const pidId = pidResponse.data.data.id;

      if (values.lines) {
        const lines = values.lines
          .split("\n")
          .map((line: string) => line.trim())
          .filter((line: string) => line);

        for (const lineNumber of lines) {
          await axios.post(`${API_URL}/lines`, {
            line_number: lineNumber,
            description: `Line ${lineNumber}`,
            type_id: 1,
            pid_id: pidId,
            project_id: selectedProject,
          });
        }
      }

      toast.success(
        `P&ID ${values.pidNumber} and associated lines added successfully`
      );
      pidForm.reset();
    } catch (error: any) {
      console.error("Error submitting P&ID:", error);
      const errorMessage =
        error.response?.data?.message ||
        "Failed to add P&ID and lines. Please try again.";
      toast.error(errorMessage);
      if (error.response?.status === 403) {
        toast.error(
          "You are not authorized to create P&IDs or lines. Please contact an admin."
        );
        navigate("/login", { replace: true });
      }
    }
  };

  const onEquipmentSubmit = async (values: any) => {
    if (!isProjectSelected) {
      toast.error("Please select a project first");
      return;
    }

    try {
      const equipmentList = values.equipmentList
        .split("\n")
        .map((equip: string) => equip.trim())
        .filter((equip: string) => equip);

      for (const equipmentNumber of equipmentList) {
        await axios.post(`${API_URL}/equipment`, {
          equipmentNumber,
          description: `Equipment ${equipmentNumber}`,
          areaId: values.areaId || null,
          projectId: selectedProject,
        });
      }

      toast.success(`Equipment added successfully`);
      equipmentForm.reset();
    } catch (error: any) {
      console.error("Error submitting equipment:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to add equipment";
      toast.error(errorMessage);
    }
  };

  if (!isAuthenticated) {
    return null; // Render nothing while redirecting
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onRefresh={handleRefresh} />
      <div className="container mx-auto p-4 sm:p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Data Entry Dashboard</h1>
          <p className="text-gray-500">Add and manage P&IDs and Equipment</p>
        </header>
        <Card className="mb-6 border-blue-200 shadow-sm">
          <CardHeader className="bg-blue-50 border-b border-blue-100">
            <CardTitle className="text-lg text-blue-800">
              Project Selection
            </CardTitle>
            <CardDescription>
              Select a project or create a new one before proceeding with data
              entry
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-end space-x-4">
                <div className="flex-1">
                  <FormLabel htmlFor="project-select" className="block mb-2">
                    Select Project <span className="text-red-500">*</span>
                  </FormLabel>
                  <Select
                    value={selectedProject}
                    onValueChange={handleProjectChange}
                    disabled={isLoadingProjects}
                  >
                    <SelectTrigger
                      className={`w-full ${
                        !selectedProject
                          ? "border-red-300 ring-1 ring-red-300"
                          : ""
                      }`}
                    >
                      {isLoadingProjects ? (
                        <div className="flex items-center">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Loading projects...
                        </div>
                      ) : (
                        <SelectValue placeholder="Choose project..." />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!isProjectSelected && projects.length > 0 && (
                    <p className="text-sm text-red-500 mt-1">
                      Project selection is required to proceed with data entry
                    </p>
                  )}
                  {projects.length === 0 && !isLoadingProjects && (
                    <p className="text-sm text-red-500 mt-1">
                      No projects available. Please create a new project.
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowNewProjectForm(!showNewProjectForm)}
                  disabled={isLoadingProjects}
                >
                  {showNewProjectForm ? "Cancel" : "New Project"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowNewAreaForm(!showNewAreaForm)}
                  disabled={isLoadingProjects || !selectedProject}
                >
                  {showNewAreaForm ? "Cancel" : "New Area"}
                </Button>
              </div>
              {showNewProjectForm && (
                <div className="mt-4">
                  <Form {...newProjectForm}>
                    <form
                      onSubmit={newProjectForm.handleSubmit(onNewProjectSubmit)}
                      className="space-y-4"
                    >
                      <FormField
                        control={newProjectForm.control}
                        name="projectName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Project Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter project name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full">
                        Create Project
                      </Button>
                    </form>
                  </Form>
                </div>
              )}
              {showNewAreaForm && selectedProject && (
                <div className="mt-4">
                  <Form {...newAreaForm}>
                    <form
                      onSubmit={newAreaForm.handleSubmit(onNewAreaSubmit)}
                      className="space-y-4"
                    >
                      <FormField
                        control={newAreaForm.control}
                        name="areaName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Area Number</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter area number (e.g., Area A)"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full">
                        Create Area
                      </Button>
                    </form>
                  </Form>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        {!isProjectSelected && projects.length > 0 && (
          <Alert variant="destructive" className="mb-6 animate-fade-in">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Action Required</AlertTitle>
            <AlertDescription>
              You must select a project before you can proceed with data entry.
            </AlertDescription>
          </Alert>
        )}
        {isProjectSelected && areas.length === 0 && (
          <Alert variant="default" className="mb-6 animate-fade-in">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Areas Available</AlertTitle>
            <AlertDescription>
              No areas are defined for this project. You can add a new area
              above or proceed without selecting an area.
            </AlertDescription>
          </Alert>
        )}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto">
            <TabsTrigger value="pids">P&IDs</TabsTrigger>
            <TabsTrigger value="equipment">Equipment</TabsTrigger>
          </TabsList>
          <TabsContent value="pids" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Add New P&ID</CardTitle>
                <CardDescription>
                  Enter P&ID details and associated lines for the selected
                  project
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...pidForm}>
                  <form
                    onSubmit={pidForm.handleSubmit(onPIDSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={pidForm.control}
                      name="areaId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Area Number (Optional)</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={!isProjectSelected || areas.length === 0}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={
                                    areas.length === 0
                                      ? "No areas available"
                                      : "Select area"
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {areas.map((area) => (
                                <SelectItem key={area.id} value={area.id}>
                                  {area.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={pidForm.control}
                      name="pidNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>P&ID Number</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., P-101"
                              {...field}
                              disabled={!isProjectSelected}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={pidForm.control}
                      name="lines"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lines (one per line)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter line numbers, one per line (e.g., L-101\nL-102\nL-103)"
                              {...field}
                              disabled={!isProjectSelected}
                              rows={5}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={!isProjectSelected}
                    >
                      Save P&ID and Lines
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="equipment" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Add New Equipment</CardTitle>
                <CardDescription>
                  Enter equipment details for the selected project
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...equipmentForm}>
                  <form
                    onSubmit={equipmentForm.handleSubmit(onEquipmentSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={equipmentForm.control}
                      name="areaId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Area Number (Optional)</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={!isProjectSelected || areas.length === 0}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={
                                    areas.length === 0
                                      ? "No areas available"
                                      : "Select area"
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {areas.map((area) => (
                                <SelectItem key={area.id} value={area.id}>
                                  {area.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={equipmentForm.control}
                      name="equipmentList"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Equipment (one per line)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter equipment numbers, one per line (e.g., E-101\nE-102\nE-103)"
                              {...field}
                              disabled={!isProjectSelected}
                              rows={5}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={!isProjectSelected}
                    >
                      Save Equipment
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DataEntryDashboard;

// Replace the placeholder function at the bottom of the file
function getAuthHeaders() {
  const token = localStorage.getItem("teamsync_token");
  if (!token) {
    throw new Error("No authentication token found");
  }
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
} // This code is a React component for a data entry dashboard that allows users to add P&IDs and equipment to selected projects and areas. It includes form handling, API calls, and user feedback using toast notifications.
