"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import WorkflowNav from "../components/WorkflowNav";

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

interface Alert {
  date: string;
  message: string;
  severity: string;
}

interface SchedulePeriod {
  id: number;
  name: string | null;
  start_date: string;
  end_date: string;
}

interface ScheduleVersion {
  id: number;
  status: string;
  created_at: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

export default function CalendarPage() {
  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [status, setStatus] = useState<string>("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>("");
  const [jobResult, setJobResult] = useState<string>("");
  const [editingAssignmentId, setEditingAssignmentId] = useState<number | null>(null);
  const [editResidentId, setEditResidentId] = useState<string>("");
  const [editDate, setEditDate] = useState<string>("");
  const [editShiftType, setEditShiftType] = useState<string>("");
  const [viewMode, setViewMode] = useState<"date" | "resident" | "shift">("date");
  const [sortMode, setSortMode] = useState<"resident" | "shift">("resident");

  useEffect(() => {
    const load = async () => {
      const [residentsResponse, periodsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/residents`),
        fetch(`${API_BASE_URL}/periods`),
      ]);
      if (residentsResponse.ok) {
        setResidents(await residentsResponse.json());
      }
      if (!periodsResponse.ok) {
        return;
      }
      const periodList = await periodsResponse.json();
      if (!periodList.length) {
        return;
      }
      setPeriods(periodList);
      setSelectedPeriodId(periodList[0].id);
    };

    load();
  }, []);

  useEffect(() => {
    if (!selectedPeriodId) {
      return;
    }
    const loadVersions = async () => {
      const versionsResponse = await fetch(`${API_BASE_URL}/periods/${selectedPeriodId}/versions`);
      if (!versionsResponse.ok) {
        return;
      }
      const versionList = await versionsResponse.json();
      setVersions(versionList);
      if (versionList.length) {
        setSelectedVersionId(versionList[0].id);
      } else {
        setSelectedVersionId(null);
      }
    };
    loadVersions();
  }, [selectedPeriodId]);

  useEffect(() => {
    if (!selectedVersionId) {
      setAssignments([]);
      setAlerts([]);
      return;
    }
    const loadVersionData = async () => {
      const [assignmentsResponse, alertsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/schedule-versions/${selectedVersionId}/assignments`),
        fetch(`${API_BASE_URL}/schedule-versions/${selectedVersionId}/alerts`),
      ]);
      if (assignmentsResponse.ok) {
        setAssignments(await assignmentsResponse.json());
      }
      if (alertsResponse.ok) {
        setAlerts(await alertsResponse.json());
      }
    };
    loadVersionData();
  }, [selectedVersionId]);

  useEffect(() => {
    if (!jobId) {
      return;
    }
    let isActive = true;
    const interval = setInterval(async () => {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`);
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      if (!isActive) {
        return;
      }
      setJobStatus(payload.status);
      if (payload.result) {
        setJobResult(JSON.stringify(payload.result));
      }
      if (payload.status === "SUCCESS" || payload.status === "FAILURE") {
        clearInterval(interval);
        if (payload.result?.version_id) {
          setSelectedVersionId(payload.result.version_id);
        }
        if (selectedPeriodId) {
          const versionsResponse = await fetch(
            `${API_BASE_URL}/periods/${selectedPeriodId}/versions`
          );
          if (versionsResponse.ok) {
            const versionList = await versionsResponse.json();
            setVersions(versionList);
          }
        }
      }
    }, 2000);
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [jobId, selectedPeriodId]);

  const startEditing = (assignment: Assignment) => {
    setStatus("");
    setEditingAssignmentId(assignment.id);
    setEditResidentId(String(assignment.resident_id));
    setEditDate(assignment.date);
    setEditShiftType(assignment.shift_type);
  };

  const cancelEditing = () => {
    setEditingAssignmentId(null);
    setEditResidentId("");
    setEditDate("");
    setEditShiftType("");
  };

  const saveAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingAssignmentId || !selectedVersionId) {
      return;
    }
    const response = await fetch(`${API_BASE_URL}/assignments/${editingAssignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resident_id: editResidentId ? Number(editResidentId) : null,
        date: editDate || null,
        shift_type: editShiftType || null,
      }),
    });

    if (!response.ok) {
      setStatus("Failed to update assignment.");
      return;
    }
    setStatus("Assignment updated.");
    setEditingAssignmentId(null);
    setEditResidentId("");
    setEditDate("");
    setEditShiftType("");
    const assignmentsResponse = await fetch(
      `${API_BASE_URL}/schedule-versions/${selectedVersionId}/assignments`
    );
    if (assignmentsResponse.ok) {
      setAssignments(await assignmentsResponse.json());
    }
  };

  const publishVersion = async () => {
    if (!selectedVersionId) {
      return;
    }
    const response = await fetch(
      `${API_BASE_URL}/schedule-versions/${selectedVersionId}/publish`,
      { method: "POST" }
    );
    if (!response.ok) {
      setStatus("Failed to publish version.");
      return;
    }
    setStatus("Version published.");
    if (selectedPeriodId) {
      const versionsResponse = await fetch(`${API_BASE_URL}/periods/${selectedPeriodId}/versions`);
      if (versionsResponse.ok) {
        setVersions(await versionsResponse.json());
      }
    }
  };

  const generateAsync = async () => {
    if (!selectedPeriodId) {
      return;
    }
    setJobStatus("PENDING");
    setJobResult("");
    const response = await fetch(`${API_BASE_URL}/schedule-periods/${selectedPeriodId}/generate`, {
      method: "POST",
    });
    if (!response.ok) {
      setStatus("Failed to start generation job.");
      return;
    }
    const payload = await response.json();
    setJobId(payload.job_id);
    setStatus(`Generation started (job ${payload.job_id}).`);
  };

  const residentLookup = new Map(residents.map((resident) => [resident.id, resident.name]));
  const getResidentName = (residentId: number) => residentLookup.get(residentId) ?? `${residentId}`;
  const assignmentsByDate = assignments.reduce<Record<string, Assignment[]>>((acc, assignment) => {
    if (!acc[assignment.date]) {
      acc[assignment.date] = [];
    }
    acc[assignment.date].push(assignment);
    return acc;
  }, {});
  const dates = Object.keys(assignmentsByDate).sort();
  const alertsByDate = alerts.reduce<Record<string, Alert[]>>((acc, alert) => {
    if (!acc[alert.date]) {
      acc[alert.date] = [];
    }
    acc[alert.date].push(alert);
    return acc;
  }, {});
  const sortAssignments = (items: Assignment[]) => {
    const sorted = [...items];
    if (sortMode === "resident") {
      sorted.sort((a, b) => getResidentName(a.resident_id).localeCompare(getResidentName(b.resident_id)));
      return sorted;
    }
    sorted.sort((a, b) => {
      const shiftCompare = a.shift_type.localeCompare(b.shift_type);
      if (shiftCompare !== 0) {
        return shiftCompare;
      }
      return getResidentName(a.resident_id).localeCompare(getResidentName(b.resident_id));
    });
    return sorted;
  };
  const assignmentsByResident = assignments.reduce<Record<string, Assignment[]>>((acc, assignment) => {
    const key = getResidentName(assignment.resident_id);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(assignment);
    return acc;
  }, {});
  const residentNames = Object.keys(assignmentsByResident).sort();
  const assignmentsByShift = assignments.reduce<Record<string, Assignment[]>>((acc, assignment) => {
    const key = assignment.shift_type;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(assignment);
    return acc;
  }, {});
  const shiftTypes = Object.keys(assignmentsByShift).sort();
  const summarizeDay = (items: Assignment[]) => {
    const counts: Record<string, number> = {};
    for (const assignment of items) {
      counts[assignment.shift_type] = (counts[assignment.shift_type] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([shift, count]) => `${shift}: ${count}`)
      .join(" • ");
  };

  return (
    <main style={{ padding: "2rem" }}>
      <WorkflowNav />
      <p>
        <Link href="/">← Back to home</Link>
      </p>
      <h1>Schedule Calendar</h1>
      <section style={{ display: "grid", gap: "0.75rem", maxWidth: "640px" }}>
        <label>
          Schedule Period
          <select
            value={selectedPeriodId ?? ""}
            onChange={(event) => setSelectedPeriodId(Number(event.target.value))}
          >
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.name ?? `Period ${period.id}`} ({period.start_date} → {period.end_date})
              </option>
            ))}
          </select>
        </label>
        <label>
          Schedule Version
          <select
            value={selectedVersionId ?? ""}
            onChange={(event) => setSelectedVersionId(Number(event.target.value))}
          >
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                {version.id} • {version.status} • {new Date(version.created_at).toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        <label>
          View mode
          <select
            value={viewMode}
            onChange={(event) => setViewMode(event.target.value as "date" | "resident" | "shift")}
          >
            <option value="date">Calendar by date</option>
            <option value="resident">Resident schedule</option>
            <option value="shift">Shift roster</option>
          </select>
        </label>
        <label>
          Sort assignments by
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as "resident" | "shift")}
            disabled={viewMode !== "date"}
          >
            <option value="resident">Resident name (A→Z)</option>
            <option value="shift">Shift (A→Z)</option>
          </select>
        </label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" onClick={generateAsync} disabled={!selectedPeriodId}>
            Generate Draft (Async)
          </button>
          <button type="button" onClick={publishVersion} disabled={!selectedVersionId}>
            Publish Selected Version
          </button>
        </div>
        {jobId ? (
          <div>
            <strong>Job</strong> {jobId} — {jobStatus || "PENDING"}
            {jobResult ? <pre style={{ whiteSpace: "pre-wrap" }}>{jobResult}</pre> : null}
          </div>
        ) : null}
      </section>
      {!assignments.length ? (
        <p>No assignments available.</p>
      ) : null}
      {viewMode === "date" && assignments.length ? (
        <section style={{ display: "grid", gap: "1rem" }}>
          {dates.map((date) => {
            const dayAssignments = assignmentsByDate[date] ?? [];
            const dayAlerts = alertsByDate[date] ?? [];
            const hasAlerts = dayAlerts.length > 0;
            const summary = summarizeDay(dayAssignments);
            return (
              <article
                key={date}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  padding: "1rem",
                  background: hasAlerts ? "#fff5f5" : "white",
                }}
              >
                <header style={{ display: "flex", justifyContent: "space-between" }}>
                  <h2 style={{ margin: 0 }}>{date}</h2>
                  {hasAlerts ? (
                    <span style={{ color: "#b42318", fontWeight: 600 }}>
                      {dayAlerts.length} Alert{dayAlerts.length > 1 ? "s" : ""}
                    </span>
                  ) : null}
                </header>
                {summary ? <p style={{ marginTop: "0.5rem" }}>{summary}</p> : null}
                {hasAlerts ? (
                  <ul style={{ marginTop: "0.5rem", color: "#b42318" }}>
                    {dayAlerts.map((alert, index) => (
                      <li key={`${alert.date}-${index}`}>
                        {alert.message} ({alert.severity})
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div style={{ marginTop: "0.75rem" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>Resident</th>
                        <th style={{ textAlign: "left" }}>Shift</th>
                        <th style={{ textAlign: "left" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortAssignments(dayAssignments).map((assignment) => (
                        <tr key={assignment.id}>
                          <td>{getResidentName(assignment.resident_id)}</td>
                          <td>{assignment.shift_type}</td>
                          <td>
                            <button type="button" onClick={() => startEditing(assignment)}>
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
      {viewMode === "resident" && assignments.length ? (
        <section style={{ display: "grid", gap: "1rem" }}>
          {residentNames.map((residentName) => {
            const items = [...assignmentsByResident[residentName]].sort((a, b) =>
              a.date.localeCompare(b.date)
            );
            return (
              <article
                key={residentName}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  padding: "1rem",
                  background: "white",
                }}
              >
                <header>
                  <h2 style={{ margin: 0 }}>{residentName}</h2>
                </header>
                <div style={{ marginTop: "0.75rem" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>Date</th>
                        <th style={{ textAlign: "left" }}>Shift</th>
                        <th style={{ textAlign: "left" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((assignment) => (
                        <tr key={assignment.id}>
                          <td>{assignment.date}</td>
                          <td>{assignment.shift_type}</td>
                          <td>
                            <button type="button" onClick={() => startEditing(assignment)}>
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
      {viewMode === "shift" && assignments.length ? (
        <section style={{ display: "grid", gap: "1rem" }}>
          {shiftTypes.map((shiftType) => {
            const items = [...assignmentsByShift[shiftType]].sort((a, b) =>
              a.date.localeCompare(b.date)
            );
            return (
              <article
                key={shiftType}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  padding: "1rem",
                  background: "white",
                }}
              >
                <header>
                  <h2 style={{ margin: 0 }}>{shiftType}</h2>
                </header>
                <div style={{ marginTop: "0.75rem" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>Date</th>
                        <th style={{ textAlign: "left" }}>Resident</th>
                        <th style={{ textAlign: "left" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((assignment) => (
                        <tr key={assignment.id}>
                          <td>{assignment.date}</td>
                          <td>{getResidentName(assignment.resident_id)}</td>
                          <td>
                            <button type="button" onClick={() => startEditing(assignment)}>
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
      <section style={{ marginTop: "2rem" }}>
        <h2>Edit Assignment</h2>
        {editingAssignmentId ? (
          <form
            onSubmit={saveAssignment}
            style={{ display: "grid", gap: "0.5rem", maxWidth: "420px" }}
          >
            <label>
              Assignment ID
              <input type="number" value={editingAssignmentId} readOnly />
            </label>
            <label>
              Resident
              <select
                value={editResidentId}
                onChange={(event) => setEditResidentId(event.target.value)}
              >
                <option value="">Select resident</option>
                {residents.map((resident) => (
                  <option key={resident.id} value={resident.id}>
                    {resident.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input
                type="date"
                value={editDate}
                onChange={(event) => setEditDate(event.target.value)}
              />
            </label>
            <label>
              Shift
              <input
                type="text"
                value={editShiftType}
                onChange={(event) => setEditShiftType(event.target.value)}
              />
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="submit">Save Changes</button>
              <button type="button" onClick={cancelEditing}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <p>Select an assignment to edit.</p>
        )}
        {status ? <p>{status}</p> : null}
      </section>
      <WorkflowNav />
    </main>
  );
}
