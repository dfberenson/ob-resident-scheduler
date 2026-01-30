"use client";

import { useEffect, useState } from "react";

interface PeriodDetailPageProps {
  params: { id: string };
}

interface SchedulePeriod {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
}

interface ScheduleVersion {
  id: number;
  status: string;
  created_at: string;
}

interface ValidationResult {
  hard_violations: Array<{ message: string; date?: string; resident_id?: number }>;
  alerts: Array<{ date: string; message: string; severity: string }>;
  fairness: Record<string, unknown>;
  unmet_requests: Array<{ resident_id: number; request_type: string; met: boolean }>;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function PeriodDetailPage({ params }: PeriodDetailPageProps) {
  const [period, setPeriod] = useState<SchedulePeriod | null>(null);
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [status, setStatus] = useState("");

  const loadVersions = async () => {
    const response = await fetch(`${API_BASE_URL}/periods/${params.id}/versions`);
    if (response.ok) {
      const versionList = await response.json();
      setVersions(versionList);
      if (versionList.length) {
        setSelectedVersionId(versionList[0].id);
      }
    }
  };

  useEffect(() => {
    const loadPeriod = async () => {
      const response = await fetch(`${API_BASE_URL}/periods`);
      if (!response.ok) {
        return;
      }
      const periodList: SchedulePeriod[] = await response.json();
      const found = periodList.find((item) => item.id === Number(params.id));
      if (found) {
        setPeriod(found);
      }
    };
    loadPeriod();
    loadVersions();
  }, [params.id]);

  const publishVersion = async () => {
    if (!selectedVersionId) {
      return;
    }
    setStatus("");
    const response = await fetch(
      `${API_BASE_URL}/schedule-versions/${selectedVersionId}/publish`,
      { method: "POST" }
    );
    if (!response.ok) {
      setStatus("Failed to publish version.");
      return;
    }
    setStatus("Version published.");
    await loadVersions();
  };

  const loadValidation = async () => {
    if (!selectedVersionId) {
      return;
    }
    setStatus("");
    const response = await fetch(
      `${API_BASE_URL}/schedule-versions/${selectedVersionId}/validate`
    );
    if (!response.ok) {
      setStatus("Failed to validate version.");
      return;
    }
    setValidation(await response.json());
  };

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Schedule Period {params.id}</h1>
      {period ? (
        <p>
          {period.name} ({period.start_date} → {period.end_date})
        </p>
      ) : null}
      <section style={{ maxWidth: "520px" }}>
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
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
          <button type="button" onClick={loadValidation} disabled={!selectedVersionId}>
            Validate Version
          </button>
          <button type="button" onClick={publishVersion} disabled={!selectedVersionId}>
            Publish Version
          </button>
        </div>
        {status ? <p>{status}</p> : null}
      </section>
      <section style={{ marginTop: "2rem" }}>
        <h2>Validation Output</h2>
        {!validation ? (
          <p>No validation loaded.</p>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            <div>
              <h3>Hard Violations</h3>
              {!validation.hard_violations.length ? (
                <p>None.</p>
              ) : (
                <ul>
                  {validation.hard_violations.map((violation, index) => (
                    <li key={`${violation.message}-${index}`}>
                      {violation.date ? `${violation.date}: ` : ""}
                      {violation.message}
                      {violation.resident_id ? ` (Resident ${violation.resident_id})` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3>Alerts</h3>
              {!validation.alerts.length ? (
                <p>No alerts.</p>
              ) : (
                <ul>
                  {validation.alerts.map((alert, index) => (
                    <li key={`${alert.date}-${index}`}>
                      {alert.date}: {alert.message} ({alert.severity})
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3>Fairness</h3>
              <pre style={{ whiteSpace: "pre-wrap" }}>
                {JSON.stringify(validation.fairness, null, 2)}
              </pre>
            </div>
            <div>
              <h3>Unmet Requests</h3>
              {!validation.unmet_requests.length ? (
                <p>None.</p>
              ) : (
                <ul>
                  {validation.unmet_requests.map((request, index) => (
                    <li key={`${request.resident_id}-${index}`}>
                      Resident {request.resident_id}: {request.request_type} —{" "}
                      {request.met ? "met" : "unmet"}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
