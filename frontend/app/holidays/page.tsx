"use client";

import { useEffect, useState } from "react";

interface Holiday {
  id: number;
  date: string;
  name: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");

  const loadHolidays = async () => {
    const response = await fetch(`${API_BASE_URL}/holidays`);
    if (response.ok) {
      setHolidays(await response.json());
    }
  };

  useEffect(() => {
    loadHolidays();
  }, []);

  const submitHoliday = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    const response = await fetch(`${API_BASE_URL}/holidays`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, name }),
    });
    if (!response.ok) {
      setStatus("Failed to add holiday.");
      return;
    }
    setStatus("Holiday added.");
    setDate("");
    setName("");
    await loadHolidays();
  };

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Holidays</h1>
      <form onSubmit={submitHoliday} style={{ display: "grid", gap: "0.5rem", maxWidth: "400px" }}>
        <label>
          Date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>
        <label>
          Name
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <button type="submit">Add Holiday</button>
      </form>
      {status ? <p>{status}</p> : null}
      <section style={{ marginTop: "2rem" }}>
        <h2>Current Holidays</h2>
        {!holidays.length ? (
          <p>No holidays configured.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Date</th>
                <th style={{ textAlign: "left" }}>Name</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((holiday) => (
                <tr key={holiday.id}>
                  <td>{holiday.date}</td>
                  <td>{holiday.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
