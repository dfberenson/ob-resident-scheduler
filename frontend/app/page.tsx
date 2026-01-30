"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

  const navLinks = [
    { href: "/periods", label: "Schedule Periods" },
    { href: "/calendar", label: "Calendar" },
    { href: "/admin", label: "Admin Dashboard" },
    { href: "/requests", label: "Resident Requests" },
    { href: "/time-off", label: "Time Off" },
    { href: "/residents", label: "Residents" },
    { href: "/holidays", label: "Holidays" },
  ];

  return (
    <main style={{ padding: "2rem" }}>
      <h1>OB Resident Scheduler</h1>
      <p>Welcome to the OB anesthesia rotation scheduling dashboard.</p>
      <p>
        API status: <strong>{healthStatus}</strong>
      </p>
      <section style={{ marginTop: "1.5rem" }}>
        <h2>Navigation</h2>
        <nav>
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.5rem" }}>
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>
      <section>
        <h2>Next steps</h2>
        <ul>
          <li>Create schedule periods.</li>
          <li>Collect resident requests and time off.</li>
          <li>Generate and validate draft schedules.</li>
        </ul>
      </section>
    </main>
  );
}
