"use client";

import { useEffect, useState } from "react";

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

  return (
    <main style={{ padding: "2rem" }}>
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
      {!dates.length ? (
        <p>No assignments available.</p>
      ) : (
        <section style={{ display: "grid", gap: "1rem" }}>
          {dates.map((date) => {
            const dayAlerts = alertsByDate[date] ?? [];
            const hasAlerts = dayAlerts.length > 0;
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
                      {assignmentsByDate[date].map((assignment) => (
                        <tr key={assignment.id}>
                          <td>{residentLookup.get(assignment.resident_id) ?? assignment.resident_id}</td>
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
      )}
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
    </main>
  );
}
