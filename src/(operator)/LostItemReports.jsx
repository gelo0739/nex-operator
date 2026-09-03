import { FileText } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import PagePlaceholder from '../components/PagePlaceholder';

export default function LostItemReports() {
  return (
    <MainLayout pageTitle="Lost Item Reports" pageSubtitle="Track items reported lost on trips.">
      <PagePlaceholder
        icon={FileText}
        title="Lost Item Reports"
        description="Log lost-and-found reports, match them to trips, and update their resolution status."
      />
    </MainLayout>
  );
}
