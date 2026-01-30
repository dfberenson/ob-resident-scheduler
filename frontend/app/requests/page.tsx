"use client";

import Link from "next/link";
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

export default function RequestsPage() {
  const [requests, setRequests] = useState<ResidentRequest[]>([]);
  const [status, setStatus] = useState("");
  const [importPayload, setImportPayload] = useState(
    JSON.stringify(
      {
        requests: [
          {
            resident_name: "Alex Rivera",
            tier: 1,
            ob_months_completed: 1,
            prefer_call: [{ start_date: "2024-01-08", end_date: "2024-01-09" }],
            avoid_call: [{ start_date: "2024-01-12", end_date: "2024-01-13" }],
            weekend_off: [{ start_date: "2024-01-20", end_date: "2024-01-21" }],
          },
        ],
      },
      null,
      2
    )
  );

  const loadRequests = async () => {
    const response = await fetch(`${API_BASE_URL}/requests`);
    if (response.ok) {
      setRequests(await response.json());
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

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
      <p>
        <Link href="/">← Back to home</Link>
      </p>
      <h1>Resident Requests</h1>
      {status ? <p>{status}</p> : null}
      <section style={{ marginBottom: "2rem", maxWidth: "720px" }}>
        <h2>Import Requests</h2>
        <p>Paste JSON in the expected import format and submit to load requests.</p>
        <textarea
          value={importPayload}
          onChange={(event) => setImportPayload(event.target.value)}
          rows={12}
          style={{ width: "100%", fontFamily: "monospace" }}
        />
        <div style={{ marginTop: "0.5rem" }}>
          <button
            type="button"
            onClick={async () => {
              setStatus("");
              let parsed;
              try {
                parsed = JSON.parse(importPayload);
              } catch (error) {
                setStatus("Invalid JSON payload.");
                return;
              }
              const response = await fetch(`${API_BASE_URL}/requests/import`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(parsed),
              });
              if (!response.ok) {
                setStatus("Failed to import requests.");
                return;
              }
              setStatus("Requests imported.");
              await loadRequests();
            }}
          >
            Import Requests
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
              <th style={{ textAlign: "left" }}>Approved</th>
              <th style={{ textAlign: "left" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td>{request.resident_name}</td>
                <td>{request.request_type}</td>
                <td>{request.start_date}</td>
                <td>{request.end_date}</td>
                <td>{request.approved ? "Yes" : "No"}</td>
                <td>
                  <button type="button" onClick={() => toggleApproval(request)}>
                    {request.approved ? "Unapprove" : "Approve"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
