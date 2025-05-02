
import React, { useState } from "react";
import { TaskComment } from "@/types";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormField, FormItem, FormControl } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface TaskCommentsProps {
  taskId: string;
  comments?: TaskComment[];
  onAddComment: (taskId: string, comment: string) => Promise<void>;
  className?: string;
}

const TaskComments: React.FC<TaskCommentsProps> = ({
  taskId,
  comments = [],
  onAddComment,
  className
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm({
    defaultValues: {
      comment: "",
    },
  });

  const handleSubmit = async (data: { comment: string }) => {
    setIsSubmitting(true);
    try {
      await onAddComment(taskId, data.comment);
      form.reset();
      toast.success("Comment added successfully");
    } catch (error) {
      toast.error("Failed to add comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No comments yet</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="border-b pb-3 last:border-0">
                <div className="flex justify-between items-start mb-1">
                  <div className="font-medium text-sm">
                    {comment.userName}{" "}
                    <span className="text-xs text-muted-foreground font-normal ml-1">
                      ({comment.userRole})
                    </span>
                  </div>
                  <time className="text-xs text-muted-foreground">
                    {format(new Date(comment.createdAt), "MMM d, yyyy h:mm a")}
                  </time>
                </div>
                <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
      <CardFooter className="border-t pt-3">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="w-full space-y-2">
            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Add a comment..."
                      className="min-h-[80px] resize-none"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button 
                type="submit" 
                size="sm" 
                disabled={isSubmitting || !form.watch("comment")}
              >
                {isSubmitting ? "Sending..." : "Add Comment"}
              </Button>
            </div>
          </form>
        </Form>
      </CardFooter>
    </Card>
  );
};

export default TaskComments;
