"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatDateWithDay } from "../utils/date";

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
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toUtcDate = (raw?: string | null) => {
  if (!raw) {
    return null;
  }
  const [year, month, day] = raw.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day));
};

const formatDateKey = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function PrintSchedulePage() {
  const searchParams = useSearchParams();
  const periodIdParam = searchParams.get("period_id");
  const versionIdParam = searchParams.get("version_id");
  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const loadBaseData = async () => {
      const [periodsResponse, residentsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/periods`),
        fetch(`${API_BASE_URL}/residents`),
      ]);
      if (periodsResponse.ok) {
        const periodList = await periodsResponse.json();
        setPeriods(periodList);
        const desiredId = periodIdParam ? Number(periodIdParam) : null;
        const matched = desiredId ? periodList.find((period) => period.id === desiredId) : null;
        setSelectedPeriodId(matched ? matched.id : periodList[0]?.id ?? null);
      }
      if (residentsResponse.ok) {
        setResidents(await residentsResponse.json());
      }
    };

    loadBaseData();
  }, [periodIdParam]);

  useEffect(() => {
    if (!selectedPeriodId) {
      setVersions([]);
      setSelectedVersionId(null);
      setAssignments([]);
      return;
    }
    const loadVersions = async () => {
      const versionsResponse = await fetch(`${API_BASE_URL}/periods/${selectedPeriodId}/versions`);
      if (!versionsResponse.ok) {
        setVersions([]);
        setSelectedVersionId(null);
        return;
      }
      const versionList = await versionsResponse.json();
      setVersions(versionList);
      const requestedId = versionIdParam ? Number(versionIdParam) : null;
      const requested = requestedId
        ? versionList.find((version) => version.id === requestedId)
        : null;
      const published = versionList.find((version) => version.status === "PUBLISHED") ?? null;
      const selected = requested?.status === "PUBLISHED" ? requested : published;
      setSelectedVersionId(selected ? selected.id : null);
      if (requested && requested.status !== "PUBLISHED") {
        setStatus("The selected version is not published yet.");
      } else {
        setStatus("");
      }
    };
    loadVersions();
  }, [selectedPeriodId, versionIdParam]);

  useEffect(() => {
    if (!selectedVersionId) {
      setAssignments([]);
      return;
    }
    const loadAssignments = async () => {
      const assignmentsResponse = await fetch(
        `${API_BASE_URL}/schedule-versions/${selectedVersionId}/assignments`
      );
      if (!assignmentsResponse.ok) {
        setAssignments([]);
        return;
      }
      setAssignments(await assignmentsResponse.json());
    };
    loadAssignments();
  }, [selectedVersionId]);

  const residentLookup = useMemo(
    () => new Map(residents.map((resident) => [resident.id, resident.name])),
    [residents]
  );
  const assignmentsByDate = useMemo(() => {
    return assignments.reduce<Record<string, Assignment[]>>((acc, assignment) => {
      if (!acc[assignment.date]) {
        acc[assignment.date] = [];
      }
      acc[assignment.date].push(assignment);
      return acc;
    }, {});
  }, [assignments]);
  const selectedPeriod = periods.find((period) => period.id === selectedPeriodId) ?? null;
  const selectedVersion = versions.find((version) => version.id === selectedVersionId) ?? null;
  const calendarDates = useMemo(() => {
    if (!selectedPeriod) {
      return [];
    }
    const start = toUtcDate(selectedPeriod.start_date);
    const end = toUtcDate(selectedPeriod.end_date);
    if (!start || !end) {
      return [];
    }
    const dates: Date[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      dates.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
  }, [selectedPeriod]);
  const calendarCells = useMemo(() => {
    if (!calendarDates.length) {
      return [];
    }
    const firstDay = calendarDates[0].getUTCDay();
    const totalCells = Math.ceil((firstDay + calendarDates.length) / 7) * 7;
    const cells: Array<Date | null> = Array.from({ length: totalCells }).fill(null);
    calendarDates.forEach((date, index) => {
      cells[firstDay + index] = date;
    });
    return cells;
  }, [calendarDates]);

  return (
    <main style={{ padding: "2rem" }}>
      <style jsx global>{`
        @media print {
          @page {
            size: letter landscape;
            margin: 0.35in;
          }
          .print-controls {
            display: none !important;
          }
          main {
            padding: 0.25rem !important;
          }
          .calendar-grid {
            gap: 0.2rem !important;
            height: calc(100vh - 1.1in) !important;
            grid-auto-rows: 1fr !important;
          }
          .calendar-cell {
            min-height: 1.35in !important;
            overflow: hidden !important;
          }
          .calendar-body {
            font-size: 9px !important;
            line-height: 1.2 !important;
          }
          .print-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
      <div className="print-controls">
        <p>
          <Link href="/">← Back to home</Link>
        </p>
        <h1>Print Published Schedule</h1>
        <p>Select a schedule period to print the published schedule.</p>
        <section style={{ display: "grid", gap: "0.75rem", maxWidth: "520px" }}>
          <label>
            Schedule Period
            <select
              value={selectedPeriodId ?? ""}
              onChange={(event) => setSelectedPeriodId(Number(event.target.value))}
            >
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.name ?? `Period ${period.id}`} ({formatDateWithDay(period.start_date)} →{" "}
                  {formatDateWithDay(period.end_date)})
                </option>
              ))}
            </select>
          </label>
          <label>
            Published Version
            <select value={selectedVersionId ?? ""} onChange={(event) => setSelectedVersionId(Number(event.target.value))}>
              {versions
                .filter((version) => version.status === "PUBLISHED")
                .map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.id} • {version.status} • {formatDateWithDay(version.created_at)}
                  </option>
                ))}
            </select>
          </label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" onClick={() => window.print()} disabled={!selectedVersionId}>
              Print now
            </button>
            <Link
              href={
                selectedPeriodId
                  ? `/calendar?period_id=${selectedPeriodId}`
                  : "/calendar"
              }
            >
              Back to schedule creation →
            </Link>
          </div>
          {status ? <p>{status}</p> : null}
        </section>
      </div>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>
          {selectedPeriod
            ? `${selectedPeriod.name ?? `Period ${selectedPeriod.id}`} (${formatDateWithDay(
                selectedPeriod.start_date
              )} → ${formatDateWithDay(selectedPeriod.end_date)})`
            : "Schedule"}
        </h2>
        {selectedVersion ? (
          <p>Published version {selectedVersion.id} • {formatDateWithDay(selectedVersion.created_at)}</p>
        ) : (
          <p>No published schedule found for this period.</p>
        )}
      </section>

      {!assignments.length ? (
        <p>No assignments available.</p>
      ) : (
        <section style={{ marginTop: "1rem" }}>
          <div
            className="calendar-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "0.35rem",
              gridAutoRows: "minmax(0, 1fr)",
            }}
          >
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                style={{
                  textAlign: "center",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  color: "#1f2937",
                }}
              >
                {day}
              </div>
            ))}
            {calendarCells.map((date, index) => {
              if (!date) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="calendar-cell"
                    style={{
                      border: "1px solid transparent",
                      minHeight: "1.75in",
                    }}
                  />
                );
              }
              const dateKey = formatDateKey(date);
              const dayAssignments = assignmentsByDate[dateKey] ?? [];
              const sortedAssignments = [...dayAssignments].sort((a, b) =>
                a.shift_type.localeCompare(b.shift_type)
              );
              return (
                <article
                  key={dateKey}
                  className="calendar-cell print-card"
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    padding: "0.35rem",
                    minHeight: "1.75in",
                    display: "grid",
                    gridTemplateRows: "auto 1fr",
                    background: "white",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.35rem" }}>
                    <strong style={{ fontSize: "0.85rem" }}>{date.getUTCDate()}</strong>
                    <span style={{ fontSize: "0.7rem", color: "#6b7280" }}>
                      {formatDateWithDay(dateKey)}
                    </span>
                  </div>
                  <div className="calendar-body" style={{ fontSize: "0.7rem", marginTop: "0.2rem" }}>
                    {!sortedAssignments.length ? (
                      <span style={{ color: "#9ca3af" }}>No assignments</span>
                    ) : (
                      <ul
                        style={{
                          listStyle: "none",
                          padding: 0,
                          margin: 0,
                          display: "grid",
                          gap: "0.1rem",
                          alignContent: "start",
                        }}
                      >
                        {sortedAssignments.map((assignment) => (
                          <li key={assignment.id}>
                            <strong>{assignment.shift_type}</strong>{" "}
                            {residentLookup.get(assignment.resident_id) ?? assignment.resident_id}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
