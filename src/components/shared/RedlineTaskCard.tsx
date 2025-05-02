
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Task, TaskItem } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface RedlineTaskCardProps {
  task: Task;
  onUpdateTask?: (task: Task, itemIds: string[]) => void;
  onUpdateStatus?: (task: Task, status: string) => void;
}

const RedlineTaskCard = ({ task, onUpdateTask, onUpdateStatus }: RedlineTaskCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [completedItems, setCompletedItems] = useState<string[]>(
    task.items.filter(item => item.completed).map(item => item.id)
  );

  // Find PID item
  const pidItem = task.items.find(item => item.type === 'PID');
  
  // Filter line items
  const lineItems = task.items.filter(item => item.type === 'Line');
  
  // Format time in HH:MM 24-hour format
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    });
  };

  const handleCheckItem = (itemId: string, checked: boolean) => {
    // Check if task is in progress
    if (task.status !== 'In Progress' && checked) {
      toast.error("You must start the task before marking items as completed");
      return;
    }
    
    // Cannot uncheck items once checked
    if (!checked && completedItems.includes(itemId)) {
      toast.error("Items cannot be unchecked once completed");
      return;
    }
    
    let updatedCompleted = [...completedItems];
    
    if (checked) {
      updatedCompleted.push(itemId);
    }
    
    setCompletedItems(updatedCompleted);
    
    // Call parent update handler
    if (onUpdateTask) {
      onUpdateTask(task, updatedCompleted);
    }
    
    // Show toast on completion
    const totalItems = task.items.length;
    const newCompletedCount = updatedCompleted.length;
    
    if (newCompletedCount === totalItems) {
      toast.success('All lines checked! Task is ready to be marked as complete.');
    }
  };

  const handleStatusChange = (status: string) => {
    if (onUpdateStatus) {
      onUpdateStatus(task, status);
    }
  };

  const isInProgress = task.status === 'In Progress';
  const isCompleted = task.status === 'Completed';

  return (
    <Card className="shadow-md hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500 animate-fade-in">
      <CardHeader className={`pb-2 ${isCompleted ? 'bg-green-50' : isInProgress ? 'bg-orange-50' : 'bg-blue-50'}`}>
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Redline Task</CardTitle>
            </div>
            <div className="text-center mt-2 py-1 px-3 bg-blue-100 rounded-md inline-block">
              {pidItem && (
                <CardDescription className="text-base font-medium text-blue-800">
                  P&ID: {pidItem.name}, Lines: {lineItems.length}
                </CardDescription>
              )}
            </div>
          </div>
          <div className="text-sm font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-800">
            {task.isComplex ? 'Complex' : 'Standard'}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 pb-2">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Progress:</span>
            <span className="text-sm font-medium">{task.progress}%</span>
          </div>
          <Progress value={task.progress} className="h-2" />
          
          <div className="flex flex-col gap-1 text-xs text-gray-600">
            <div>
              Assigned at: {formatTime(task.createdAt)}
            </div>
            <div>
              {task.completedAt ? 
                `Completed at: ${formatTime(task.completedAt)}` : 
                "Not completed"
              }
            </div>
          </div>
          
          <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="flex w-full justify-between p-0 h-8">
                <span className="font-medium">Line List ({lineItems.length})</span>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {lineItems.length > 0 ? (
                  lineItems.map((item) => (
                    <div key={item.id} className="flex items-center space-x-2 py-1 border-b border-gray-100 last:border-0">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center space-x-2 flex-grow">
                              <Checkbox
                                id={`line-${item.id}`}
                                checked={completedItems.includes(item.id) || item.completed}
                                onCheckedChange={(checked) => handleCheckItem(item.id, !!checked)}
                                disabled={isCompleted || (completedItems.includes(item.id) || item.completed)}
                                className="data-[state=checked]:bg-green-500"
                              />
                              <label
                                htmlFor={`line-${item.id}`}
                                className={`text-sm flex-1 cursor-pointer ${
                                  completedItems.includes(item.id) || item.completed ? 'line-through text-gray-500' : ''
                                }`}
                              >
                                {item.name}
                              </label>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {task.status !== 'In Progress' ? 
                              "Start task to enable this checkbox" : 
                              completedItems.includes(item.id) || item.completed ? 
                                "This item cannot be unchecked" : 
                                "Mark as completed"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No lines available for this P&ID.</p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
      <CardFooter className="pt-2 pb-4 flex justify-between">
        <div className="text-sm text-gray-600">
          Assigned at: {formatTime(task.createdAt)}
        </div>
        <div className="flex space-x-2">
          {task.status === 'Assigned' && (
            <Button 
              size="sm" 
              variant="outline" 
              className="text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100"
              onClick={() => handleStatusChange('In Progress')}
            >
              Start Task
            </Button>
          )}
          {task.status === 'In Progress' && (
            <Button 
              size="sm"
              variant="outline"
              className="text-green-600 border-green-200 bg-green-50 hover:bg-green-100"
              onClick={() => handleStatusChange('Completed')}
              disabled={completedItems.length !== lineItems.length}
            >
              <CheckCircle className="mr-1 h-4 w-4" />
              Complete Task
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};

export default RedlineTaskCard;
