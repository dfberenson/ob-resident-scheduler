"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { workflowSteps } from "./workflow";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

export default function HomePage() {
  const [healthStatus, setHealthStatus] = useState("unknown");

  useEffect(() => {
    const loadHealth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Health check failed: ${response.status}`);
        }
        const payload = (await response.json()) as { status: string };
        setHealthStatus(payload.status);
      } catch {
        setHealthStatus("unreachable");
      }
    };

    loadHealth();
  }, []);

  return (
    <main style={{ padding: "2rem" }}>
      <h1>OB Resident Scheduler</h1>
      <p>Welcome to the OB anesthesia rotation scheduling dashboard.</p>
      <p>
        API status: <strong>{healthStatus}</strong>
      </p>
      <section style={{ marginTop: "1.5rem" }}>
        <h2>Workflow</h2>
        <ol style={{ paddingLeft: "1.25rem", display: "grid", gap: "0.5rem" }}>
          {workflowSteps.map((step) => (
            <li key={step.href}>
              <strong>{step.title}</strong>
              <div style={{ color: "#475569" }}>{step.description}</div>
            </li>
          ))}
        </ol>
        <div style={{ marginTop: "1rem" }}>
          <Link href={workflowSteps[0].href}>Start workflow →</Link>
        </div>
      </section>
      <section style={{ marginTop: "2rem" }}>
        <h2>Published Schedule</h2>
        <p>Print a published schedule in a clean, readable format.</p>
        <Link href="/print">Print published schedule →</Link>
      </section>
    </main>
  );
}
