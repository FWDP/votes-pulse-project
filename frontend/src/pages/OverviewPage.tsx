import OverviewContent from '../components/content/OverviewContent'
import PageShell from '../components/PageShell';

export default function OverviewPage() {
  let newDate = new Date();
  let month = newDate.toLocaleString('default', { month: 'long' });
  let year = newDate.getFullYear();

  return (
    <PageShell title="Overview" subtitle="Summary of research findings across cities and municipalities">
      <OverviewContent />
    </PageShell>
  )
}
