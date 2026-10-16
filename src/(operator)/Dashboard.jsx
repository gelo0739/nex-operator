import { useState } from "react";
import MainLayout from "../components/MainLayout";
import { Bus, Pause, FileText, TriangleAlert, Wrench } from "lucide-react";
import FleetMap from "../components/FleetMap";
import ConfirmDialog from "../components/ConfirmDialog";
import { useAuth } from "../context/AuthContext";
import useBuses from "../hooks/useBuses";
import useLiveBuses from "../hooks/useLiveBuses";
import useRoutes from "../hooks/useRoutes";
import useConductors from "../hooks/useConductors";
import usePendingLostItemCount from "../hooks/usePendingLostItemCount";
import useInoperableBuses from "../hooks/useInoperableBuses";
import { clearInoperableBus } from "../utils/inoperableBuses";
import { formatDateTime } from "../utils/format";

export default function Dashboard() {
  const { busLine } = useAuth();
  const { routes } = useRoutes(busLine);
  const { conductors } = useConductors(busLine);
  const liveBuses = useLiveBuses();
  // Buses a conductor marked inoperable on this line (RTDB inoperableBuses).
  const inoperableBuses = useInoperableBuses(busLine);
  const inoperableIds = new Set(inoperableBuses.map((bus) => bus.busId));

  // RTDB activeBuses has no line field: a bus belongs to this operator's line
  // if it's running one of the line's routes or driven by one of its conductors.
  // An inoperable bus is out of service even if a live entry is still around.
  const lineRouteIds = new Set(routes.map((r) => r.id));
  const lineConductorIds = new Set(conductors.map((c) => c.id));
  const lineBuses = liveBuses.filter(
    (bus) =>
      !inoperableIds.has(bus.busId) &&
      (lineRouteIds.has(bus.routeId) || lineConductorIds.has(bus.conductorId)),
  );
  const conductorNames = new Map(conductors.map((c) => [c.id, c.name || c.email]));

  const { buses: lineFleet } = useBuses(busLine);
  const totalBusCount = lineFleet.length; // this line's registered buses
  const activeBusCount = lineBuses.length; // matches the pins on the map
  const pendingLostItemCount = usePendingLostItemCount(busLine); // null while loading

  const inactiveBusCount = Math.max(totalBusCount - activeBusCount, 0);

  // "Return to service" confirm: { bus, busy, error } | null
  const [returning, setReturning] = useState(null);
  const handleReturnToService = async () => {
    setReturning((prev) => ({ ...prev, busy: true, error: null }));
    try {
      await clearInoperableBus(returning.bus.busId);
      setReturning(null); // the live listener drops the entry
    } catch (err) {
      setReturning((prev) => ({ ...prev, busy: false, error: err.message }));
    }
  };

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

      {/* INOPERABLE BUSES — marked by a conductor; cleared by "Return to service" */}
      {inoperableBuses.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
              <TriangleAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-800">
                {inoperableBuses.length === 1
                  ? "1 bus marked inoperable"
                  : `${inoperableBuses.length} buses marked inoperable`}
              </p>
              <p className="text-xs text-red-700/80">
                Taken out of service by a conductor or from Manage Bus. Trips
                can't start on these buses until you return them to service.
              </p>
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            {inoperableBuses.map((bus) => (
              <li
                key={bus.busId}
                className="flex items-center justify-between gap-4 bg-white rounded-xl border border-red-100 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-950">{bus.busId}</p>
                  <p className="text-xs text-slate-600 truncate">
                    {bus.source === "operator"
                      ? `Set inoperable by an operator · since ${formatDateTime(bus.inoperableAt)}`
                      : `${bus.routeName || "No route"} · since ${formatDateTime(bus.inoperableAt)} · reported by ${
                          bus.conductorName || conductorNames.get(bus.conductorId) || "a conductor"
                        }`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReturning({ bus, busy: false, error: null })}
                  className="shrink-0 flex items-center gap-2 text-xs font-semibold text-slate-700 px-4 py-2 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  Return to service
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* MAP — live buses on this line; click one to focus it */}
      <div className="flex-1 min-h-[460px] bg-white p-2 rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden relative">
        <FleetMap
          buses={lineBuses}
          conductorNames={conductorNames}
          inoperableBuses={inoperableBuses}
          onReturnToService={(bus) => setReturning({ bus, busy: false, error: null })}
        />
      </div>

      {returning && (
        <ConfirmDialog
          title={`Return ${returning.bus.busId} to service?`}
          message={
            returning.error ??
            "The inoperable alert is cleared and conductors can start trips on this bus again."
          }
          confirmLabel={returning.busy ? "Returning…" : "Return to Service"}
          onConfirm={returning.busy ? () => {} : handleReturnToService}
          onCancel={returning.busy ? () => {} : () => setReturning(null)}
        />
      )}
    </MainLayout>
  );
}
