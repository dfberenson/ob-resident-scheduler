"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDateWithDay } from "../utils/date";
import { formatDateWithDay } from "../utils/date";

interface TimeOffBlock {
  id: number;
  resident_id: number;
  start_date: string;
  end_date: string;
  block_type: string;
  approved: boolean;
  pre_approved: boolean;
}

interface Resident {
  id: number;
  name: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

export default function TimeOffPage() {
  const [blocks, setBlocks] = useState<TimeOffBlock[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [residentId, setResidentId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("");

  const loadBlocks = async () => {
    const response = await fetch(`${API_BASE_URL}/time-off`);
    if (response.ok) {
      setBlocks(await response.json());
    }
  };

  const loadResidents = async () => {
    const response = await fetch(`${API_BASE_URL}/residents`);
    if (response.ok) {
      setResidents(await response.json());
    }
  };

  useEffect(() => {
    loadBlocks();
    loadResidents();
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
        block_type: "BT_DAY",
        approved: false,
        pre_approved: false,
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

  const toggleApproval = async (block: TimeOffBlock) => {
    setStatus("");
    const response = await fetch(`${API_BASE_URL}/time-off/${block.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: !block.approved }),
    });
    if (!response.ok) {
      setStatus("Failed to update approval.");
      return;
    }
    await loadBlocks();
  };

  const residentLookup = new Map(residents.map((resident) => [resident.id, resident.name]));

  return (
    <main style={{ padding: "2rem" }}>
      <p>
        <Link href="/">← Back to home</Link>
      </p>
      <h1>Time Off Blocks</h1>
      <form onSubmit={submitBlock} style={{ display: "grid", gap: "0.5rem", maxWidth: "400px" }}>
        <label>
          Resident
          <select value={residentId} onChange={(event) => setResidentId(event.target.value)} required>
            <option value="">Select resident</option>
            {residents.map((resident) => (
              <option key={resident.id} value={resident.id}>
                {resident.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Start Date
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
        </label>
        <label>
          End Date
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
        </label>
        <p style={{ margin: 0 }}>Block Type: BT-Day</p>
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
                <th style={{ textAlign: "left" }}>Resident</th>
                <th style={{ textAlign: "left" }}>Start</th>
                <th style={{ textAlign: "left" }}>End</th>
                <th style={{ textAlign: "left" }}>Type</th>
                <th style={{ textAlign: "left" }}>Status</th>
                <th style={{ textAlign: "left" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((block) => (
                <tr key={block.id}>
                  <td>{residentLookup.get(block.resident_id) ?? block.resident_id}</td>
                  <td>{formatDateWithDay(block.start_date)}</td>
                  <td>{formatDateWithDay(block.end_date)}</td>
                  <td>{block.block_type === "BT_DAY" ? "BT-Day" : block.block_type}</td>
                  <td>
                    {block.pre_approved
                      ? "Pre-Approved"
                      : block.approved
                      ? "Approved"
                      : "Not approved"}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => toggleApproval(block)}
                      disabled={block.pre_approved}
                      title={block.pre_approved ? "Pre-approved time off cannot be edited." : ""}
                    >
                      {block.approved ? "Unapprove" : "Approve"}
                    </button>{" "}
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
