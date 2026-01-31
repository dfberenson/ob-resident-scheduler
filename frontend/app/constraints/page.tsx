"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import WorkflowNav from "../components/WorkflowNav";

interface SolverConstraints {
  id: number;
  config: {
    coverage: {
      weekday: CoverageRequirements;
      friday: CoverageRequirements;
      weekend_or_holiday: CoverageRequirements;
    };
    tier0_call_prohibition: {
      days: number[];
    };
    call_targets: {
      tier0: [number, number];
      tier1: [number, number];
      tier2: [number, number];
      tier3: [number, number] | null;
    };
    weights: {
      understaff: number;
      call: number;
      weekend: number;
      request: number;
    };
  };
}

interface CoverageRequirements {
  ob_oc: number;
  ob_l3: number;
  ob_l4: number;
  ob_day_min: number;
  ob_day_max: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

export default function ConstraintsPage() {
  const [constraints, setConstraints] = useState<SolverConstraints | null>(null);
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    const loadConstraints = async () => {
      const response = await fetch(`${API_BASE_URL}/constraints`);
      if (response.ok) {
        setConstraints(await response.json());
      }
    };
    loadConstraints();
  }, []);

  const coverage = constraints?.config.coverage;
  const tier0Call = constraints?.config.tier0_call_prohibition;
  const callTargets = constraints?.config.call_targets;
  const weights = constraints?.config.weights;

  const updateCoverage = (
    section: keyof NonNullable<typeof coverage>,
    field: keyof CoverageRequirements,
    value: number
  ) => {
    if (!constraints) {
      return;
    }
    setConstraints({
      ...constraints,
      config: {
        ...constraints.config,
        coverage: {
          ...constraints.config.coverage,
          [section]: {
            ...constraints.config.coverage[section],
            [field]: value,
          },
        },
      },
    });
  };

  const updateWeights = (field: keyof NonNullable<typeof weights>, value: number) => {
    if (!constraints) {
      return;
    }
    setConstraints({
      ...constraints,
      config: {
        ...constraints.config,
        weights: {
          ...constraints.config.weights,
          [field]: value,
        },
      },
    });
  };

  const updateCallTarget = (tier: "tier0" | "tier1" | "tier2", index: 0 | 1, value: number) => {
    if (!constraints) {
      return;
    }
    const current = constraints.config.call_targets[tier] ?? [0, 0];
    const updated: [number, number] = index === 0 ? [value, current[1]] : [current[0], value];
    setConstraints({
      ...constraints,
      config: {
        ...constraints.config,
        call_targets: {
          ...constraints.config.call_targets,
          [tier]: updated,
        },
      },
    });
  };

  const updateTier0Days = (value: string) => {
    if (!constraints) {
      return;
    }
    const days = value
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((day) => Number.isInteger(day) && day >= 1 && day <= 31);
    setConstraints({
      ...constraints,
      config: {
        ...constraints.config,
        tier0_call_prohibition: { days },
      },
    });
  };

  const saveConstraints = async () => {
    if (!constraints) {
      return;
    }
    setSaveStatus("");
    const response = await fetch(`${API_BASE_URL}/constraints`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: constraints.config }),
    });
    if (!response.ok) {
      setSaveStatus("Failed to save constraints.");
      return;
    }
    setSaveStatus("Constraints saved.");
    setConstraints(await response.json());
  };

  return (
    <main style={{ padding: "2rem" }}>
      <WorkflowNav />
      <p>
        <Link href="/">← Back to home</Link>
      </p>
      <h1>System Constraints</h1>
      <p>Review solver constraints and staffing inputs before generating a schedule.</p>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Staffing Inputs</h2>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <Link href="/residents">Residents</Link>
        </div>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Solver Constraints</h2>
        <div style={{ display: "grid", gap: "1rem" }}>
          <div>
            <h3 style={{ marginBottom: "0.5rem" }}>Hard constraints (must be satisfied)</h3>
            <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
              <li>At most one OB shift per resident per day.</li>
              <li>OB_L3 requires OB_OC for the same resident on the next day.</li>
              <li>OB_OC or OB_L4 requires OB_POSTCALL the following day.</li>
              <li>Time off blocks (BT_V / BT_O) prevent OB assignments during those dates.</li>
              <li>Tier 0 residents (0 OB months) cannot take OB_L3, OB_OC, OB_L4, or OB_POSTCALL on the configured days.</li>
            </ul>
          </div>
          <div>
            <h3 style={{ marginBottom: "0.5rem" }}>Tier 0 call prohibition</h3>
            <label>
              Restricted days of month (comma-separated)
              <input
                type="text"
                value={tier0Call ? tier0Call.days.join(", ") : ""}
                onChange={(event) => updateTier0Days(event.target.value)}
                placeholder="1, 2, 3"
              />
            </label>
          </div>
          <div>
            <h3 style={{ marginBottom: "0.5rem" }}>Coverage requirements</h3>
            {coverage ? (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {(
                  [
                    ["weekday", "Weekdays (Mon–Thu)"],
                    ["friday", "Fridays"],
                    ["weekend_or_holiday", "Weekends & hospital holidays"],
                  ] as const
                ).map(([key, label]) => {
                  const current = coverage[key];
                  return (
                    <div key={key} style={{ border: "1px solid #e2e8f0", padding: "0.75rem" }}>
                      <strong>{label}</strong>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                          gap: "0.5rem",
                          marginTop: "0.5rem",
                        }}
                      >
                        {(
                          [
                            ["ob_oc", "OB_OC"],
                            ["ob_l3", "OB_L3"],
                            ["ob_l4", "OB_L4"],
                            ["ob_day_min", "OB_DAY min"],
                            ["ob_day_max", "OB_DAY max"],
                          ] as const
                        ).map(([field, labelText]) => (
                          <label key={field}>
                            {labelText}
                            <input
                              type="number"
                              min={0}
                              value={current[field]}
                              onChange={(event) =>
                                updateCoverage(key, field, Number(event.target.value))
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p>Loading coverage requirements…</p>
            )}
          </div>
          <div>
            <h3 style={{ marginBottom: "0.5rem" }}>Soft constraints (optimized)</h3>
            {callTargets ? (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <div style={{ border: "1px solid #e2e8f0", padding: "0.75rem" }}>
                  <strong>Call targets (OB_OC) by tier</strong>
                  <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.5rem" }}>
                    {(["tier0", "tier1", "tier2"] as const).map((tier) => (
                      <div key={tier} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <span style={{ width: "80px" }}>{tier.toUpperCase()}</span>
                        <label>
                          Min
                          <input
                            type="number"
                            min={0}
                            value={callTargets[tier][0]}
                            onChange={(event) =>
                              updateCallTarget(tier, 0, Number(event.target.value))
                            }
                          />
                        </label>
                        <label>
                          Max
                          <input
                            type="number"
                            min={0}
                            value={callTargets[tier][1]}
                            onChange={(event) =>
                              updateCallTarget(tier, 1, Number(event.target.value))
                            }
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ border: "1px solid #e2e8f0", padding: "0.75rem" }}>
                  <strong>Objective weights</strong>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                      gap: "0.5rem",
                      marginTop: "0.5rem",
                    }}
                  >
                    {(
                      [
                        ["understaff", "Understaffing"],
                        ["call", "Call target"],
                        ["weekend", "Weekend balance"],
                        ["request", "Resident requests"],
                      ] as const
                    ).map(([field, labelText]) => (
                      <label key={field}>
                        {labelText}
                        <input
                          type="number"
                          min={0}
                          value={weights ? weights[field] : 0}
                          onChange={(event) => updateWeights(field, Number(event.target.value))}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p>Loading optimization settings…</p>
            )}
          </div>
        </div>
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button type="button" onClick={saveConstraints} disabled={!constraints}>
            Save constraints
          </button>
          {saveStatus ? <span>{saveStatus}</span> : null}
        </div>
      </section>
      <WorkflowNav />
    </main>
  );
}
