"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { workflowSteps } from "../workflow";

export default function WorkflowNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const periodId = searchParams.get("period_id");
  const currentIndex = workflowSteps.findIndex((step) => step.href === pathname);

  if (currentIndex === -1) {
    return null;
  }

  const withPeriodId = (href: string) => (periodId ? `${href}?period_id=${periodId}` : href);
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
        {previous ? <Link href={withPeriodId(previous.href)}>← {previous.title}</Link> : null}
        {next ? <Link href={withPeriodId(next.href)}>Next: {next.title} →</Link> : null}
      </div>
    </section>
  );
}
