"use client";

import { useEffect, useState } from "react";

interface TimeOffBlock {
  id: number;
  resident_id: number;
  start_date: string;
  end_date: string;
  block_type: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function TimeOffPage() {
  const [blocks, setBlocks] = useState<TimeOffBlock[]>([]);
  const [residentId, setResidentId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [blockType, setBlockType] = useState("BT_V");
  const [status, setStatus] = useState("");

  const loadBlocks = async () => {
    const response = await fetch(`${API_BASE_URL}/time-off`);
    if (response.ok) {
      setBlocks(await response.json());
    }
  };

  useEffect(() => {
    loadBlocks();
  }, []);

  const submitBlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    const response = await fetch(`${API_BASE_URL}/time-off`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resident_id: Number(residentId),
        start_date: startDate,
        end_date: endDate,
        block_type: blockType,
      }),
    });
    if (!response.ok) {
      setStatus("Failed to create time off block.");
      return;
    }
    setStatus("Time off block created.");
    setResidentId("");
    setStartDate("");
    setEndDate("");
    await loadBlocks();
  };

  const deleteBlock = async (blockId: number) => {
    setStatus("");
    const response = await fetch(`${API_BASE_URL}/time-off/${blockId}`, { method: "DELETE" });
    if (!response.ok) {
      setStatus("Failed to delete time off block.");
      return;
    }
    setStatus("Time off block deleted.");
    await loadBlocks();
  };

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Time Off Blocks</h1>
      <form onSubmit={submitBlock} style={{ display: "grid", gap: "0.5rem", maxWidth: "400px" }}>
        <label>
          Resident ID
          <input
            type="number"
            value={residentId}
            onChange={(event) => setResidentId(event.target.value)}
            required
          />
        </label>
        <label>
          Start Date
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
        </label>
        <label>
          End Date
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
        </label>
        <label>
          Block Type
          <select value={blockType} onChange={(event) => setBlockType(event.target.value)}>
            <option value="BT_V">BT_V</option>
            <option value="BT_O">BT_O</option>
          </select>
        </label>
        <button type="submit">Add Time Off</button>
      </form>
      {status ? <p>{status}</p> : null}
      <section style={{ marginTop: "2rem" }}>
        <h2>Existing Blocks</h2>
        {!blocks.length ? (
          <p>No time off blocks yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Resident ID</th>
                <th style={{ textAlign: "left" }}>Start</th>
                <th style={{ textAlign: "left" }}>End</th>
                <th style={{ textAlign: "left" }}>Type</th>
                <th style={{ textAlign: "left" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((block) => (
                <tr key={block.id}>
                  <td>{block.resident_id}</td>
                  <td>{block.start_date}</td>
                  <td>{block.end_date}</td>
                  <td>{block.block_type}</td>
                  <td>
                    <button type="button" onClick={() => deleteBlock(block.id)}>
                      Delete
                    </button>
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
