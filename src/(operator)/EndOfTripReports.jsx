import { BarChart3 } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import PagePlaceholder from '../components/PagePlaceholder';

export default function EndOfTripReports() {
  return (
    <MainLayout pageTitle="End of Trip Reports" pageSubtitle="Summaries submitted at the end of each trip.">
      <PagePlaceholder
        icon={BarChart3}
        title="End of Trip Reports"
        description="Review per-trip summaries — passenger counts, fare totals, and incident notes."
      />
    </MainLayout>
  );
}
