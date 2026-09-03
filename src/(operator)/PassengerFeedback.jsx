import { MessageSquare } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import PagePlaceholder from '../components/PagePlaceholder';

export default function PassengerFeedback() {
  return (
    <MainLayout pageTitle="Passenger Feedback" pageSubtitle="Review rider comments and ratings.">
      <PagePlaceholder
        icon={MessageSquare}
        title="Passenger Feedback"
        description="Read feedback submitted by passengers and follow up on recurring issues."
      />
    </MainLayout>
  );
}
