async function fetchHealth() {
  const baseUrl = process.env.API_BASE_URL ?? "http://localhost:8000";
  const response = await fetch(`${baseUrl}/health`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  return response.json() as Promise<{ status: string }>;
}

export default async function HomePage() {
  let healthStatus = "unknown";
  try {
    const health = await fetchHealth();
    healthStatus = health.status;
  } catch {
    healthStatus = "unreachable";
  }

  return (
    <main style={{ padding: "2rem" }}>
      <h1>OB Resident Scheduler</h1>
      <p>Welcome to the OB anesthesia rotation scheduling dashboard.</p>
      <p>
        API status: <strong>{healthStatus}</strong>
      </p>
      <section>
        <h2>Next steps</h2>
        <ul>
          <li>Create schedule periods.</li>
          <li>Collect resident requests and time off.</li>
          <li>Generate and validate draft schedules.</li>
        </ul>
      </section>
    </main>
  );
}
