import { Bus } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import PagePlaceholder from '../components/PagePlaceholder';

export default function ManageBus() {
  return (
    <MainLayout pageTitle="Bus Management" pageSubtitle="Register and assign fleet vehicles.">
      <PagePlaceholder
        icon={Bus}
        title="Bus Management"
        description="Add buses, track plate numbers and capacity, and assign them to conductors and routes."
      />
    </MainLayout>
  );
}
