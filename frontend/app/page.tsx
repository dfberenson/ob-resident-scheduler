export default function HomePage() {
  return (
    <main style={{ padding: "2rem" }}>
      <h1>OB Resident Scheduler</h1>
      <p>Welcome to the OB anesthesia rotation scheduling dashboard.</p>
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
