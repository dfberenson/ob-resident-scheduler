"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import WorkflowNav from "../components/WorkflowNav";
import { formatDateWithDay } from "../utils/date";

interface SchedulePeriod {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [monthValue, setMonthValue] = useState("");
  const [status, setStatus] = useState("");
  const router = useRouter();

  const quickMonths = useMemo(() => {
    const results: { name: string; start: string; end: string }[] = [];
    const now = new Date();
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    for (let offset = 0; offset < 6; offset += 1) {
      const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
      const label = start.toLocaleString("en-US", { month: "long", year: "numeric" });
      results.push({ name: label, start: formatDate(start), end: formatDate(end) });
    }
    return results;
  }, []);

  const loadPeriods = async () => {
    const response = await fetch(`${API_BASE_URL}/periods`);
    if (response.ok) {
      setPeriods(await response.json());
    }
  };

  useEffect(() => {
    loadPeriods();
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    setMonthValue(`${now.getFullYear()}-${month}`);
  }, []);

  const createPeriod = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    if (!monthValue) {
      setStatus("Please choose a month.");
      return;
    }
    const [year, month] = monthValue.split("-").map(Number);
    const response = await fetch(`${API_BASE_URL}/periods/monthly`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year,
        month,
      }),
    });
    if (response.status === 409) {
      const payload = await response.json();
      setStatus(payload.detail?.message ?? "Schedule period already exists.");
      if (payload.detail?.period_id) {
        router.push(`/holidays?period_id=${payload.detail.period_id}`);
      }
      return;
    }
    if (!response.ok) {
      setStatus("Failed to create schedule period.");
      return;
    }
    const created = await response.json();
    setStatus("Schedule period created.");
    await loadPeriods();
    router.push(`/holidays?period_id=${created.id}`);
  };

  return (
    <main style={{ padding: "2rem" }}>
      <WorkflowNav />
      <p>
        <Link href="/">← Back to home</Link>
      </p>
      <h1>Schedule Periods</h1>
      <section style={{ marginBottom: "1.5rem" }}>
        <h2>Quick pick (current + next 5 months)</h2>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {quickMonths.map((month) => (
            <button
              key={month.start}
              type="button"
              onClick={() => {
                setMonthValue(month.start.slice(0, 7));
              }}
            >
              {month.name}
            </button>
          ))}
        </div>
      </section>
      <form onSubmit={createPeriod} style={{ display: "grid", gap: "0.5rem", maxWidth: "360px" }}>
        <label>
          Month
          <input
            type="month"
            value={monthValue}
            onChange={(event) => setMonthValue(event.target.value)}
            required
          />
        </label>
        <button type="submit">Select Month</button>
      </form>
      {status ? <p>{status}</p> : null}
      <section style={{ marginTop: "2rem" }}>
        <h2>Existing Periods</h2>
        {!periods.length ? (
          <p>No schedule periods yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Name</th>
                <th style={{ textAlign: "left" }}>Start</th>
                <th style={{ textAlign: "left" }}>End</th>
                <th style={{ textAlign: "left" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period.id}>
                  <td>{period.name}</td>
                  <td>{formatDateWithDay(period.start_date)}</td>
                  <td>{formatDateWithDay(period.end_date)}</td>
                  <td>
                    <Link href={`/holidays?period_id=${period.id}`}>Resume</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <WorkflowNav />
    </main>
  );
}
