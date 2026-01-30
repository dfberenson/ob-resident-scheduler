interface PeriodDetailPageProps {
  params: { id: string };
}

export default function PeriodDetailPage({ params }: PeriodDetailPageProps) {
  return (
    <main style={{ padding: "2rem" }}>
      <h1>Schedule Period {params.id}</h1>
      <p>Draft and published versions will appear here.</p>
    </main>
  );
}
