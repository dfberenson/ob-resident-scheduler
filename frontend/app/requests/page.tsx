"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import WorkflowNav from "../components/WorkflowNav";
import { formatDateWithDay } from "../utils/date";

interface ResidentRequest {
  id: number;
  resident_id: number;
  resident_name: string;
  request_type: string;
  start_date: string;
  end_date: string;
  approved: boolean;
  pre_approved: boolean;
}

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

export default function RequestsPage() {
  const [requests, setRequests] = useState<ResidentRequest[]>([]);
  const [timeOffBlocks, setTimeOffBlocks] = useState<TimeOffBlock[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [status, setStatus] = useState("");
  const [timeOffStatus, setTimeOffStatus] = useState("");
  const [timeOffResidentId, setTimeOffResidentId] = useState("");
  const [timeOffStartDate, setTimeOffStartDate] = useState("");
  const [timeOffEndDate, setTimeOffEndDate] = useState("");
  const [csvPayload, setCsvPayload] = useState("");
  const [csvFileName, setCsvFileName] = useState("");

  const loadRequests = async () => {
    const response = await fetch(`${API_BASE_URL}/requests`);
    if (response.ok) {
      setRequests(await response.json());
    }
  };

  const loadTimeOff = async () => {
    const response = await fetch(`${API_BASE_URL}/time-off`);
    if (response.ok) {
      setTimeOffBlocks(await response.json());
    }
  };

  const loadResidents = async () => {
    const response = await fetch(`${API_BASE_URL}/residents`);
    if (response.ok) {
      setResidents(await response.json());
    }
  };

  useEffect(() => {
    loadRequests();
    loadTimeOff();
    loadResidents();
  }, []);

  const formatRequestType = (type: string) => {
    if (type === "PREFER_CALL") {
      return "Request Call";
    }
    if (type === "AVOID_CALL") {
      return "No Call";
    }
    if (type === "WEEKEND_OFF") {
      return "Weekend Off";
    }
    return type;
  };

  const submitTimeOffBlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setTimeOffStatus("");
    const response = await fetch(`${API_BASE_URL}/time-off`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resident_id: Number(timeOffResidentId),
        start_date: timeOffStartDate,
        end_date: timeOffEndDate,
        block_type: "BT_DAY",
        approved: false,
        pre_approved: false,
      }),
    });
    if (!response.ok) {
      setTimeOffStatus("Failed to create time off block.");
      return;
    }
    setTimeOffStatus("Time off block created.");
    setTimeOffResidentId("");
    setTimeOffStartDate("");
    setTimeOffEndDate("");
    await loadTimeOff();
  };

  const toggleTimeOffApproval = async (block: TimeOffBlock) => {
    setTimeOffStatus("");
    const response = await fetch(`${API_BASE_URL}/time-off/${block.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: !block.approved }),
    });
    if (!response.ok) {
      setTimeOffStatus("Failed to update time off approval.");
      return;
    }
    await loadTimeOff();
  };

  const toggleApproval = async (request: ResidentRequest) => {
    setStatus("");
    const response = await fetch(`${API_BASE_URL}/requests/${request.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: !request.approved }),
    });
    if (!response.ok) {
      setStatus("Failed to update request approval.");
      return;
    }
    await loadRequests();
  };

  return (
    <main style={{ padding: "2rem" }}>
      <WorkflowNav />
      <p>
        <Link href="/">← Back to home</Link>
      </p>
      <h1>Resident Requests</h1>
      {status ? <p>{status}</p> : null}
      <section style={{ marginBottom: "2rem", maxWidth: "720px" }}>
        <h2>Import Requests (CSV)</h2>
        <p>Paste the Microsoft Forms CSV export (tab- or comma-delimited) and submit to load requests.</p>
        <label>
          Upload CSV file
          <input
            type="file"
            accept=".csv,text/csv,text/tab-separated-values"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (!file) {
                setCsvFileName("");
                return;
              }
              setCsvFileName(file.name);
              const reader = new FileReader();
              reader.onload = () => {
                const text = typeof reader.result === "string" ? reader.result : "";
                setCsvPayload(text);
              };
              reader.readAsText(file);
            }}
          />
        </label>
        {csvFileName ? <p>Loaded file: {csvFileName}</p> : null}
        <textarea
          value={csvPayload}
          onChange={(event) => setCsvPayload(event.target.value)}
          rows={12}
          style={{ width: "100%", fontFamily: "monospace" }}
        />
        <div style={{ marginTop: "0.5rem" }}>
          <button
            type="button"
            onClick={async () => {
              setStatus("");
              if (!csvPayload.trim()) {
                setStatus("CSV payload is empty.");
                return;
              }
              const response = await fetch(`${API_BASE_URL}/requests/import-csv`, {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: csvPayload,
              });
              if (!response.ok) {
                setStatus("Failed to import requests.");
                return;
              }
              const payload = await response.json();
              setStatus(
                `Requests imported (${payload.imported_requests} requests, ${payload.imported_time_off} time-off).`
              );
              setCsvPayload("");
              setCsvFileName("");
              await loadRequests();
              await loadTimeOff();
            }}
          >
            Import CSV
          </button>
        </div>
      </section>
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
              <th style={{ textAlign: "left" }}>Status</th>
              <th style={{ textAlign: "left" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td>{request.resident_name}</td>
                <td>{formatRequestType(request.request_type)}</td>
                <td>{formatDateWithDay(request.start_date)}</td>
                <td>{formatDateWithDay(request.end_date)}</td>
                <td>
                  {request.pre_approved
                    ? "Pre-Approved"
                    : request.approved
                    ? "Approved"
                    : "Not approved"}
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => toggleApproval(request)}
                    disabled={request.pre_approved}
                    title={request.pre_approved ? "Pre-approved requests cannot be edited." : ""}
                  >
                    {request.approved ? "Unapprove" : "Approve"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <section style={{ marginTop: "2rem" }}>
        <h2>BT-Day Time Off</h2>
        <form
          onSubmit={submitTimeOffBlock}
          style={{ display: "grid", gap: "0.5rem", maxWidth: "400px", marginBottom: "1rem" }}
        >
          <label>
            Resident
            <select
              value={timeOffResidentId}
              onChange={(event) => setTimeOffResidentId(event.target.value)}
              required
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
            Start Date
            <input
              type="date"
              value={timeOffStartDate}
              onChange={(event) => setTimeOffStartDate(event.target.value)}
              required
            />
          </label>
          <label>
            End Date
            <input
              type="date"
              value={timeOffEndDate}
              onChange={(event) => setTimeOffEndDate(event.target.value)}
              required
            />
          </label>
          <p style={{ margin: 0 }}>Block Type: BT-Day</p>
          <button type="submit">Add Time Off Request</button>
        </form>
        {timeOffStatus ? <p>{timeOffStatus}</p> : null}
        {timeOffBlocks.filter((block) => block.block_type === "BT_DAY").length === 0 ? (
          <p>No BT vacation blocks entered yet.</p>
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
              {timeOffBlocks
                .filter((block) => block.block_type === "BT_DAY")
                .map((block) => {
                const residentName =
                  residents.find((resident) => resident.id === block.resident_id)?.name ??
                  block.resident_id;
                return (
                  <tr key={block.id}>
                    <td>{residentName}</td>
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
                        onClick={() => toggleTimeOffApproval(block)}
                        disabled={block.pre_approved}
                        title={block.pre_approved ? "Pre-approved time off cannot be edited." : ""}
                      >
                        {block.approved ? "Unapprove" : "Approve"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      <WorkflowNav />
    </main>
  );
}
