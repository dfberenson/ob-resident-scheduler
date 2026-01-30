"use client";

import { useEffect, useState } from "react";

interface ResidentRequest {
  id: number;
  resident_id: number;
  resident_name: string;
  request_type: string;
  start_date: string;
  end_date: string;
  approved: boolean;
}

interface Assignment {
  id: number;
  resident_id: number;
  date: string;
  shift_type: string;
}

interface Resident {
  id: number;
  name: string;
}

interface Conflict {
  resident_id: number;
  resident_name: string;
  date: string;
  assignment_ids: number[];
}

interface AssignmentHistory {
  id: number;
  assignment_id: number;
  changed_at: string;
  old_resident_id: number;
  new_resident_id: number;
  old_date: string;
  new_date: string;
  old_shift_type: string;
  new_shift_type: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function AdminDashboard() {
  const [requests, setRequests] = useState<ResidentRequest[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [assignmentId, setAssignmentId] = useState("");
  const [residentId, setResidentId] = useState("");
  const [date, setDate] = useState("");
  const [shiftType, setShiftType] = useState("");
  const [status, setStatus] = useState<string>("");
  const [historyAssignmentId, setHistoryAssignmentId] = useState("");
  const [history, setHistory] = useState<AssignmentHistory[]>([]);

  const loadData = async () => {
      const requestsResponse = await fetch(`${API_BASE_URL}/requests`);
      if (requestsResponse.ok) {
        setRequests(await requestsResponse.json());
      }

      const residentsResponse = await fetch(`${API_BASE_URL}/residents`);
      if (residentsResponse.ok) {
        setResidents(await residentsResponse.json());
      }

      const periodsResponse = await fetch(`${API_BASE_URL}/periods`);
      if (!periodsResponse.ok) {
        return;
      }
      const periods = await periodsResponse.json();
      if (!periods.length) {
        return;
      }
      const periodId = periods[0].id as number;
      const draftResponse = await fetch(`${API_BASE_URL}/schedule-periods/${periodId}/draft`);
      if (!draftResponse.ok) {
        return;
      }
      const draft = await draftResponse.json();
      if (!draft) {
        return;
      }
      const assignmentsResponse = await fetch(
        `${API_BASE_URL}/schedule-versions/${draft.id}/assignments`
      );
      if (assignmentsResponse.ok) {
        setAssignments(await assignmentsResponse.json());
      }
      const conflictsResponse = await fetch(
        `${API_BASE_URL}/schedule-versions/${draft.id}/conflicts`
      );
      if (conflictsResponse.ok) {
        setConflicts(await conflictsResponse.json());
      }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMove = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    if (!assignmentId) {
      setStatus("Assignment ID is required.");
      return;
    }

    const response = await fetch(`${API_BASE_URL}/assignments/${assignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resident_id: residentId ? Number(residentId) : null,
        date: date || null,
        shift_type: shiftType || null,
      }),
    });

    if (!response.ok) {
      setStatus("Failed to update assignment.");
      return;
    }
    setStatus("Assignment updated.");
    await loadData();
  };

  const fetchHistory = async (event: React.FormEvent) => {
    event.preventDefault();
    setHistory([]);
    if (!historyAssignmentId) {
      return;
    }
    const response = await fetch(`${API_BASE_URL}/assignments/${historyAssignmentId}/history`);
    if (response.ok) {
      setHistory(await response.json());
    }
  };

  const conflictKey = (conflict: Conflict) => `${conflict.resident_id}-${conflict.date}`;
  const conflictLookup = new Set(conflicts.map(conflictKey));
  const residentLookup = new Map(residents.map((resident) => [resident.id, resident.name]));

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Scheduling Admin Dashboard</h1>

      <section>
        <h2>Imported Requests</h2>
        {!requests.length ? (
          <p>No requests imported yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Resident</th>
                <th style={{ textAlign: "left" }}>Type</th>
                <th style={{ textAlign: "left" }}>Start</th>
                <th style={{ textAlign: "left" }}>End</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>{request.resident_name}</td>
                  <td>{request.request_type}</td>
                  <td>{request.start_date}</td>
                  <td>{request.end_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Draft Schedule</h2>
        {!assignments.length ? (
          <p>No draft assignments available.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Assignment ID</th>
                <th style={{ textAlign: "left" }}>Resident</th>
                <th style={{ textAlign: "left" }}>Date</th>
                <th style={{ textAlign: "left" }}>Shift</th>
                <th style={{ textAlign: "left" }}>Conflict</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => {
                const hasConflict = conflictLookup.has(
                  `${assignment.resident_id}-${assignment.date}`
                );
                return (
                  <tr key={assignment.id} style={{ background: hasConflict ? "#ffe6e6" : "transparent" }}>
                    <td>{assignment.id}</td>
                    <td>{residentLookup.get(assignment.resident_id) ?? assignment.resident_id}</td>
                    <td>{assignment.date}</td>
                    <td>{assignment.shift_type}</td>
                    <td>{hasConflict ? "Conflict" : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Move Assignment</h2>
        <form onSubmit={handleMove} style={{ display: "grid", gap: "0.5rem", maxWidth: "400px" }}>
          <label>
            Assignment ID
            <input
              type="number"
              value={assignmentId}
              onChange={(event) => setAssignmentId(event.target.value)}
              required
            />
          </label>
          <label>
            New Resident ID
            <input
              type="number"
              value={residentId}
              onChange={(event) => setResidentId(event.target.value)}
            />
          </label>
          <label>
            New Date (YYYY-MM-DD)
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label>
            New Shift Type
            <input
              type="text"
              value={shiftType}
              onChange={(event) => setShiftType(event.target.value)}
              placeholder="OB_OC"
            />
          </label>
          <button type="submit">Update Assignment</button>
        </form>
        {status ? <p>{status}</p> : null}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Assignment History</h2>
        <form onSubmit={fetchHistory} style={{ display: "grid", gap: "0.5rem", maxWidth: "400px" }}>
          <label>
            Assignment ID
            <input
              type="number"
              value={historyAssignmentId}
              onChange={(event) => setHistoryAssignmentId(event.target.value)}
              required
            />
          </label>
          <button type="submit">Load History</button>
        </form>
        {!history.length ? (
          <p>No history loaded.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Changed At</th>
                <th style={{ textAlign: "left" }}>Old</th>
                <th style={{ textAlign: "left" }}>New</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.changed_at}</td>
                  <td>
                    {entry.old_resident_id} | {entry.old_date} | {entry.old_shift_type}
                  </td>
                  <td>
                    {entry.new_resident_id} | {entry.new_date} | {entry.new_shift_type}
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
