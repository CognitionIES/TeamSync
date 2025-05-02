
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  FormDescription,
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

// Mock data
const mockProjects = [
  { id: "project-1", name: "Project Alpha" },
  { id: "project-2", name: "Project Beta" },
  { id: "project-3", name: "Project Gamma" },
];

const mockLineTypes = [
  { id: "type-1", name: "Process" },
  { id: "type-2", name: "Utility" },
  { id: "type-3", name: "Instrument" },
];

const mockEquipmentTypes = [
  { id: "equip-type-1", name: "Pump" },
  { id: "equip-type-2", name: "Valve" },
  { id: "equip-type-3", name: "Tank" },
];

const mockAreas = [
  { id: "area-1", name: "Area 100" },
  { id: "area-2", name: "Area 200" },
  { id: "area-3", name: "Area 300" },
];

const DataEntryDashboard = () => {
  const [activeTab, setActiveTab] = useState("pids");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [isProjectSelected, setIsProjectSelected] = useState(false);
  
  // Form for P&IDs
  const pidForm = useForm({
    defaultValues: {
      pidNumber: "",
      description: "",
      areaId: "",
    },
  });
  
  // Form for Lines
  const lineForm = useForm({
    defaultValues: {
      lineNumber: "",
      description: "",
      typeId: "",
      pidId: "",
    },
  });
  
  // Form for Equipment
  const equipmentForm = useForm({
    defaultValues: {
      equipmentNumber: "",
      description: "",
      typeId: "",
      areaId: "",
    },
  });
  
  // Update project selection status
  useEffect(() => {
    setIsProjectSelected(!!selectedProject);
  }, [selectedProject]);

  const handleRefresh = () => {
    toast.success("Data refreshed");
  };
  
  const handleProjectChange = (value: string) => {
    setSelectedProject(value);
  };
  
  const onPIDSubmit = (values: any) => {
    if (!isProjectSelected) {
      toast.error("Please select a project first");
      return;
    }
    
    console.log("P&ID Submitted:", { projectId: selectedProject, ...values });
    toast.success(`P&ID ${values.pidNumber} added successfully`);
    pidForm.reset();
  };
  
  const onLineSubmit = (values: any) => {
    if (!isProjectSelected) {
      toast.error("Please select a project first");
      return;
    }
    
    console.log("Line Submitted:", { projectId: selectedProject, ...values });
    toast.success(`Line ${values.lineNumber} added successfully`);
    lineForm.reset();
  };
  
  const onEquipmentSubmit = (values: any) => {
    if (!isProjectSelected) {
      toast.error("Please select a project first");
      return;
    }
    
    console.log("Equipment Submitted:", { projectId: selectedProject, ...values });
    toast.success(`Equipment ${values.equipmentNumber} added successfully`);
    equipmentForm.reset();
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onRefresh={handleRefresh} />
      
      <div className="container mx-auto p-4 sm:p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Data Entry Dashboard</h1>
          <p className="text-gray-500">
            Add and manage P&IDs, lines, and equipment
          </p>
        </header>
        
        {/* Project Selection - Required */}
        <Card className="mb-6 border-blue-200 shadow-sm">
          <CardHeader className="bg-blue-50 border-b border-blue-100">
            <CardTitle className="text-lg text-blue-800">Project Selection</CardTitle>
            <CardDescription>Select a project before proceeding with data entry</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <FormLabel htmlFor="project-select" className="block mb-2">
                  Select Project <span className="text-red-500">*</span>
                </FormLabel>
                <Select value={selectedProject} onValueChange={handleProjectChange}>
                  <SelectTrigger className={`w-full ${!selectedProject ? 'border-red-300 ring-1 ring-red-300' : ''}`}>
                    <SelectValue placeholder="Choose project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {mockProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isProjectSelected && (
                  <p className="text-sm text-red-500 mt-1">
                    Project selection is required to proceed with data entry
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        {!isProjectSelected && (
          <Alert variant="destructive" className="mb-6 animate-fade-in">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Action Required</AlertTitle>
            <AlertDescription>
              You must select a project before you can proceed with data entry.
            </AlertDescription>
          </Alert>
        )}
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto">
            <TabsTrigger value="pids">P&IDs</TabsTrigger>
            <TabsTrigger value="lines">Lines</TabsTrigger>
            <TabsTrigger value="equipment">Equipment</TabsTrigger>
          </TabsList>
          
          {/* P&ID Form */}
          <TabsContent value="pids" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Add New P&ID</CardTitle>
                <CardDescription>
                  Enter P&ID details for the selected project
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...pidForm}>
                  <form onSubmit={pidForm.handleSubmit(onPIDSubmit)} className="space-y-4">
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
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter P&ID description" 
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
                      name="areaId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Area</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={!isProjectSelected}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select area" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {mockAreas.map((area) => (
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
                    
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={!isProjectSelected}
                    >
                      Save P&ID
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Lines Form */}
          <TabsContent value="lines" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Add New Line</CardTitle>
                <CardDescription>
                  Enter line details for the selected project
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...lineForm}>
                  <form onSubmit={lineForm.handleSubmit(onLineSubmit)} className="space-y-4">
                    <FormField
                      control={lineForm.control}
                      name="lineNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Line Number</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., L-101" 
                              {...field}
                              disabled={!isProjectSelected} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={lineForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter line description" 
                              {...field}
                              disabled={!isProjectSelected} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={lineForm.control}
                      name="typeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Line Type</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={!isProjectSelected}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select line type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {mockLineTypes.map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                  {type.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={lineForm.control}
                      name="pidId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Associated P&ID</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={!isProjectSelected}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select P&ID" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="pid-1">P-101</SelectItem>
                              <SelectItem value="pid-2">P-102</SelectItem>
                              <SelectItem value="pid-3">P-103</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={!isProjectSelected}
                    >
                      Save Line
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Equipment Form */}
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
                  <form onSubmit={equipmentForm.handleSubmit(onEquipmentSubmit)} className="space-y-4">
                    <FormField
                      control={equipmentForm.control}
                      name="equipmentNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Equipment Number</FormLabel>
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
                      control={equipmentForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter equipment description" 
                              {...field}
                              disabled={!isProjectSelected} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={equipmentForm.control}
                      name="typeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Equipment Type</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={!isProjectSelected}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select equipment type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {mockEquipmentTypes.map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                  {type.name}
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
                      name="areaId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Area</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={!isProjectSelected}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select area" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {mockAreas.map((area) => (
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
