"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDateWithDay } from "../utils/date";

interface Holiday {
  id: number;
  date: string;
  name: string;
  hospital_holiday: boolean | null;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

export default function HolidaysPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const periodId = searchParams.get("period_id");
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [seedStatus, setSeedStatus] = useState("");
  const [hospitalHoliday, setHospitalHoliday] = useState("true");
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);

  const loadHolidays = async (start?: string, end?: string) => {
    const params =
      start && end ? `?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}` : "";
    const response = await fetch(`${API_BASE_URL}/holidays${params}`);
    if (response.ok) {
      setHolidays(await response.json());
    }
  };

  useEffect(() => {
    const seedHolidays = async () => {
      setSeedStatus("");
      if (!periodId) {
        return;
      }
      const periodResponse = await fetch(`${API_BASE_URL}/periods/${periodId}`);
      if (!periodResponse.ok) {
        return;
      }
      const period = (await periodResponse.json()) as {
        start_date: string;
        end_date: string;
        name: string;
      };
      setRange({ start: period.start_date, end: period.end_date });
      const seedResponse = await fetch(
        `${API_BASE_URL}/holidays/seed?start_date=${period.start_date}&end_date=${period.end_date}&default_confirmed=true`,
        { method: "POST" }
      );
      if (seedResponse.ok) {
        const payload = await seedResponse.json();
        setSeedStatus(
          `Federal holidays for ${period.name} loaded (${payload.created} new, ${payload.updated} updated).`
        );
      }
      await loadHolidays(period.start_date, period.end_date);
    };

    seedHolidays();
  }, [periodId]);

  const allConfirmed = holidays.every((holiday) => holiday.hospital_holiday !== null);

  const proceed = () => {
    if (periodId) {
      router.push(`/requests?period_id=${periodId}`);
      return;
    }
    router.push("/requests");
  };

  const navBlock = (
    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
      <Link href="/periods">← Back to periods</Link>
      <button type="button" onClick={proceed} disabled={!periodId || !allConfirmed}>
        Save and proceed
      </button>
    </div>
  );

  const submitHoliday = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    setSeedStatus("");
    const response = await fetch(`${API_BASE_URL}/holidays`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        name,
        hospital_holiday:
          hospitalHoliday === "" ? null : hospitalHoliday === "true",
      }),
    });
    if (!response.ok) {
      setStatus("Failed to add holiday.");
      return;
    }
    setStatus("Holiday added.");
    setDate("");
    setName("");
    setHospitalHoliday("true");
    if (range) {
      await loadHolidays(range.start, range.end);
    } else {
      await loadHolidays();
    }
  };

  return (
    <main style={{ padding: "2rem" }}>
      <p>
        <Link href="/">← Back to home</Link>
      </p>
      <h1>Holidays</h1>
      {navBlock}
      {!periodId ? (
        <p>Please select a schedule month first.</p>
      ) : (
        <p>Confirm whether each federal holiday is observed by the hospital for this month.</p>
      )}
      <form onSubmit={submitHoliday} style={{ display: "grid", gap: "0.5rem", maxWidth: "420px" }}>
        <label>
          Date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>
        <label>
          Name
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          Hospital holiday?
          <select value={hospitalHoliday} onChange={(event) => setHospitalHoliday(event.target.value)}>
            <option value="">Unconfirmed</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <button type="submit" disabled={!periodId}>
          Add Holiday
        </button>
      </form>
      {seedStatus ? <p>{seedStatus}</p> : null}
      {status ? <p>{status}</p> : null}
      <div style={{ marginTop: "0.75rem" }}>
        {periodId && !allConfirmed ? (
          <p>Confirm every holiday to proceed.</p>
        ) : null}
      </div>
      <section style={{ marginTop: "2rem" }}>
        <h2>Current Holidays</h2>
        {!holidays.length ? (
          <p>No holidays configured.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Date</th>
                <th style={{ textAlign: "left" }}>Name</th>
                <th style={{ textAlign: "left" }}>Hospital holiday?</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((holiday) => (
                <tr key={holiday.id}>
                  <td>{formatDateWithDay(holiday.date)}</td>
                  <td>{holiday.name}</td>
                  <td>
                    <select
                      value={
                        holiday.hospital_holiday === null
                          ? ""
                          : holiday.hospital_holiday
                          ? "true"
                          : "false"
                      }
                      onChange={async (event) => {
                        setStatus("");
                        const value = event.target.value;
                        const response = await fetch(`${API_BASE_URL}/holidays/${holiday.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            hospital_holiday:
                              value === "" ? null : value === "true",
                          }),
                        });
                        if (!response.ok) {
                          setStatus("Failed to update holiday.");
                          return;
                        }
                        if (range) {
                          await loadHolidays(range.start, range.end);
                        } else {
                          await loadHolidays();
                        }
                      }}
                    >
                      <option value="">Unconfirmed</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <div style={{ marginTop: "1.5rem" }}>{navBlock}</div>
    </main>
  );
}
