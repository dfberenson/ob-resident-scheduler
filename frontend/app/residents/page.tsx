"use client";

import { useEffect, useState } from "react";

interface Resident {
  id: number;
  name: string;
  tier: number;
  ob_months_completed: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

export default function ResidentsPage() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [name, setName] = useState("");
  const [tier, setTier] = useState("1");
  const [obMonths, setObMonths] = useState("0");
  const [status, setStatus] = useState("");

  const loadResidents = async () => {
    const response = await fetch(`${API_BASE_URL}/residents`);
    if (response.ok) {
      setResidents(await response.json());
    }
  };

  useEffect(() => {
    loadResidents();
  }, []);

  const createResident = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    const response = await fetch(`${API_BASE_URL}/residents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        tier: Number(tier),
        ob_months_completed: Number(obMonths),
      }),
    });
    if (!response.ok) {
      setStatus("Failed to create resident.");
      return;
    }
    setName("");
    setTier("1");
    setObMonths("0");
    await loadResidents();
  };

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Residents</h1>
      <form onSubmit={createResident} style={{ display: "grid", gap: "0.5rem", maxWidth: "400px" }}>
        <label>
          Name
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          Tier
          <input type="number" value={tier} onChange={(event) => setTier(event.target.value)} required />
        </label>
        <label>
          OB Months Completed
          <input type="number" value={obMonths} onChange={(event) => setObMonths(event.target.value)} required />
        </label>
        <button type="submit">Add Resident</button>
      </form>
      {status ? <p>{status}</p> : null}
      <section style={{ marginTop: "2rem" }}>
        <h2>Current Residents</h2>
        {!residents.length ? (
          <p>No residents configured.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Name</th>
                <th style={{ textAlign: "left" }}>Tier</th>
                <th style={{ textAlign: "left" }}>OB Months Completed</th>
              </tr>
            </thead>
            <tbody>
              {residents.map((resident) => (
                <tr key={resident.id}>
                  <td>{resident.name}</td>
                  <td>{resident.tier}</td>
                  <td>{resident.ob_months_completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
