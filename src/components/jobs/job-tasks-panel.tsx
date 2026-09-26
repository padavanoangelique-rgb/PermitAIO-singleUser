"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createJobTask, toggleJobTask, requestJobTaskUpdate } from "@/lib/job-tasks/actions";
import type { JobTask } from "@/lib/job-tasks/types";
import type { Teammate } from "@/lib/notifications/compose-actions";

function nameFor(teammates: Teammate[], userId: string | null): string {
  if (!userId) return "Unassigned";
  return teammates.find((t) => t.userId === userId)?.name ?? "Former teammate";
}

function TaskRow({
  task,
  jobId,
  teammates,
  currentUserId,
}: {
  task: JobTask;
  jobId: string;
  teammates: Teammate[];
  currentUserId: string;
}) {
  const [, toggleAction, togglePending] = useActionState(toggleJobTask, { error: null });
  const [requestState, requestAction, requestPending] = useActionState(requestJobTaskUpdate, { error: null });
  const [asked, setAsked] = useState(false);
  const done = !!task.done_at;
  const canAskForUpdate = !done && !!task.assigned_to && task.assigned_to !== currentUserId;

return (
  <li className="border-b py-2.5 last:border-b-0">
  <div className="flex items-start justify-between gap-3">
  <div className="flex flex-1 items-start gap-2">
  <form action={toggleAction}>
  <input type="hidden" name="taskId" value={task.id} />
  <input type="hidden" name="jobId" value={jobId} />
  <button
    type="submit"
    disabled={togglePending}
    aria-label={done ? "Mark not done" : "Mark done"}
    className="mt-0.5"
    >
    {done ? (
      <CheckCircle2 className="h-4 w-4 text-primary" />
      ) : (
      <Circle className="h-4 w-4 text-muted-foreground" />
      )}
  </button>
  </form>
  <div className="flex-1">
  <p className={done ? "text-sm text-muted-foreground line-through" : "text-sm"}>{task.title}</p>
  <p className="mt-0.5 text-xs text-muted-foreground">
    {nameFor(teammates, task.assigned_to)} ·{" "}
    {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
  </p>
  </div>
  </div>
    {canAskForUpdate &&
      (asked ? (
        <span className="shrink-0 text-xs text-muted-foreground">Asked</span>
        ) : (
        <form
          action={requestAction}
          onSubmit={() => setAsked(true)}
          >
        <input type="hidden" name="taskId" value={task.id} />
        <input type="hidden" name="jobId" value={jobId} />
        <button
          type="submit"
          disabled={requestPending}
          className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
        Ask for update
        </button>
        </form>
        ))}
  </div>
    {requestState.error ? <p className="mt-1 text-xs text-destructive">{requestState.error}</p> : null}
  </li>
  );
}

export function JobTasksPanel({
  jobId,
  currentUserId,
  initialTasks,
  teammates,
}: {
  jobId: string;
  currentUserId: string;
  initialTasks: JobTask[];
  teammates: Teammate[];
}) {
  const [open, setOpen] = useState(false);
  const [assignedTo, setAssignedTo] = useState("");
  const [state, formAction, pending] = useActionState(createJobTask, { error: null });
  const submittedRef = useRef(false);
  
  useEffect(() => {
    if (submittedRef.current && !pending && !state.error) {
      submittedRef.current = false;
      setOpen(false);
      setAssignedTo("");
    }
  }, [pending, state.error]);
  
  return (
    <div className="space-y-3">
    <div className="flex items-center justify-between">
    <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tasks</h2>
    <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setOpen((v) => !v)}>
    <Plus className="h-3.5 w-3.5" /> Add task
    </Button>
    </div>
    
      {open && (
      <form
        action={formAction}
        className="space-y-2 rounded-md border p-3"
        onSubmit={() => {
          submittedRef.current = true;
        }}
        >
      <input type="hidden" name="jobId" value={jobId} />
      <Input name="title" placeholder="What needs to happen?" required />
      <input type="hidden" name="assignedTo" value={assignedTo} />
      <Select value={assignedTo} onValueChange={setAssignedTo}>
      <SelectTrigger className="w-full">
      <SelectValue placeholder="Assign to (optional)" />
      </SelectTrigger>
      <SelectContent>
        {teammates.map((t) => (
          <SelectItem key={t.userId} value={t.userId}>
            {t.name}
          </SelectItem>
          ))}
      </SelectContent>
      </Select>
        {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
      </form>
    )}
    
      {initialTasks.length === 0 ? (
      <p className="text-sm text-muted-foreground">No tasks yet.</p>
      ) : (
      <ul>
        {initialTasks.map((task) => (
        <TaskRow key={task.id} task={task} jobId={jobId} teammates={teammates} currentUserId={currentUserId} />
        ))}
      </ul>
    )}
    </div>
    );
}
