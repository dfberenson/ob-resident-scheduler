"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { workflowSteps } from "../workflow";

export default function WorkflowNav() {
  const pathname = usePathname();
  const currentIndex = workflowSteps.findIndex((step) => step.href === pathname);

  if (currentIndex === -1) {
    return null;
  }

  const current = workflowSteps[currentIndex];
  const previous = workflowSteps[currentIndex - 1];
  const next = workflowSteps[currentIndex + 1];

  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        padding: "1rem",
        background: "#f8fafc",
        marginBottom: "1.5rem",
      }}
    >
      <p style={{ margin: 0, fontWeight: 600 }}>
        Step {currentIndex + 1} of {workflowSteps.length}: {current.title}
      </p>
      <p style={{ margin: "0.25rem 0 0.75rem", color: "#475569" }}>{current.description}</p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        {previous ? <Link href={previous.href}>← {previous.title}</Link> : null}
        {next ? <Link href={next.href}>Next: {next.title} →</Link> : null}
      </div>
    </section>
  );
}
