import MainLayout from "../components/MainLayout";
import { Bus, Pause, FileText } from "lucide-react";
import FleetMap from "../components/FleetMap";
import { useAuth } from "../context/AuthContext";
import useBuses from "../hooks/useBuses";
import useLiveBuses from "../hooks/useLiveBuses";
import useRoutes from "../hooks/useRoutes";
import useConductors from "../hooks/useConductors";
import usePendingLostItemCount from "../hooks/usePendingLostItemCount";

export default function Dashboard() {
  const { busLine } = useAuth();
  const { routes } = useRoutes(busLine);
  const { conductors } = useConductors(busLine);
  const liveBuses = useLiveBuses();

  // RTDB activeBuses has no line field: a bus belongs to this operator's line
  // if it's running one of the line's routes or driven by one of its conductors.
  const lineRouteIds = new Set(routes.map((r) => r.id));
  const lineConductorIds = new Set(conductors.map((c) => c.id));
  const lineBuses = liveBuses.filter(
    (bus) => lineRouteIds.has(bus.routeId) || lineConductorIds.has(bus.conductorId),
  );
  const conductorNames = new Map(conductors.map((c) => [c.id, c.name || c.email]));

  const { buses: lineFleet } = useBuses(busLine);
  const totalBusCount = lineFleet.length; // this line's registered buses
  const activeBusCount = lineBuses.length; // matches the pins on the map
  const pendingLostItemCount = usePendingLostItemCount(busLine); // null while loading

  const inactiveBusCount = Math.max(totalBusCount - activeBusCount, 0);
  return (
    <MainLayout
      pageTitle="Fleet Overview"
      pageSubtitle="Live monitoring of active transit vehicles."
    >
      {/* STAT CARDS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          {
            label: "Active Buses",
            value: activeBusCount,
            icon: Bus,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "Inactive Fleet",
            value: inactiveBusCount,
            icon: Pause,
            color: "text-slate-500",
            bg: "bg-slate-100",
          },
          {
            label: "Pending Lost Item Reports",
            value: pendingLostItemCount,
            icon: FileText,
            color: "text-slate-500",
            bg: "bg-slate-100",
          },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col justify-between"
            >
              <div
                className={`w-9 h-9 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center mb-3`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">
                  {stat.label}
                </p>
                <h2 className="text-3xl font-extrabold text-slate-900">
                  {stat.value ?? "–"}
                </h2>
              </div>
            </div>
          );
        })}
      </div>

      {/* MAP — live buses on this line; click one to focus it */}
      <div className="flex-1 min-h-[460px] bg-white p-2 rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden relative">
        <FleetMap buses={lineBuses} conductorNames={conductorNames} />
      </div>
    </MainLayout>
  );
}
