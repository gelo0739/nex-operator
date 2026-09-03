import { Route as RouteIcon } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import PagePlaceholder from '../components/PagePlaceholder';

export default function ManageRoute() {
  return (
    <MainLayout pageTitle="Route Management" pageSubtitle="Define and maintain transit routes.">
      <PagePlaceholder
        icon={RouteIcon}
        title="Route Management"
        description="Create routes with stops and schedules, then map them to active buses."
      />
    </MainLayout>
  );
}
