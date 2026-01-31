export interface WorkflowStep {
  href: string;
  title: string;
  description: string;
}

export const workflowSteps: WorkflowStep[] = [
  {
    href: "/periods",
    title: "Choose schedule period",
    description: "Pick calendar months, starting with the present.",
  },
  {
    href: "/requests",
    title: "Review resident requests",
    description: "Import and confirm resident preferences.",
  },
  {
    href: "/constraints",
    title: "Review system constraints",
    description: "Check time off, holidays, and staffing inputs.",
  },
  {
    href: "/calendar",
    title: "Create the schedule",
    description: "Generate and review the draft schedule.",
  },
];
