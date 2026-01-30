"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface SchedulePeriod {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("");

  const loadPeriods = async () => {
    const response = await fetch(`${API_BASE_URL}/periods`);
    if (response.ok) {
      setPeriods(await response.json());
    }
  };

  useEffect(() => {
    loadPeriods();
  }, []);

  const createPeriod = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    const response = await fetch(`${API_BASE_URL}/periods`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        start_date: startDate,
        end_date: endDate,
      }),
    });
    if (!response.ok) {
      setStatus("Failed to create schedule period.");
      return;
    }
    setStatus("Schedule period created.");
    setName("");
    setStartDate("");
    setEndDate("");
    await loadPeriods();
  };

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Schedule Periods</h1>
      <form onSubmit={createPeriod} style={{ display: "grid", gap: "0.5rem", maxWidth: "420px" }}>
        <label>
          Name
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          Start Date
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            required
          />
        </label>
        <label>
          End Date
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
        </label>
        <button type="submit">Create Period</button>
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
                  <td>{period.start_date}</td>
                  <td>{period.end_date}</td>
                  <td>
                    <Link href={`/periods/${period.id}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
