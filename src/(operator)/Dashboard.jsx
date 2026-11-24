import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import MainLayout from "../components/MainLayout";
import { Bus, Pause, FileText, MapPin, TriangleAlert, Wrench } from "lucide-react";
import FleetMap from "../components/FleetMap";
import ConfirmDialog from "../components/ConfirmDialog";
import { useAuth } from "../context/AuthContext";
import useBuses from "../hooks/useBuses";
import useLiveBuses from "../hooks/useLiveBuses";
import useRoutes from "../hooks/useRoutes";
import useConductors from "../hooks/useConductors";
import usePendingLostItemCount from "../hooks/usePendingLostItemCount";
import useUnavailableBuses from "../hooks/useUnavailableBuses";
import { hasPosition, returnBusToService } from "../utils/unavailableBuses";
import { formatDateTime } from "../utils/format";

export default function Dashboard() {
  const { busLine } = useAuth();
  const { routes } = useRoutes(busLine);
  const { conductors } = useConductors(busLine);
  const liveBuses = useLiveBuses();
  // Buses on this line marked unavailable (RTDB unavailableBuses).
  const unavailableBuses = useUnavailableBuses(busLine);
  const unavailableIds = new Set(unavailableBuses.map((bus) => bus.busId));

  // ?unavailable=<busId> — the unavailable bus focused on the map (the bell
  // links here). Pin clicks replace the entry so Back doesn't step through them.
  const [searchParams, setSearchParams] = useSearchParams();
  const focusedUnavailableId = searchParams.get("unavailable");
  const setFocusedUnavailableId = useCallback(
    (busId) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (busId) next.set("unavailable", busId);
          else next.delete("unavailable");
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  // RTDB activeBuses has no line field: a bus belongs to this operator's line
  // if it's running one of the line's routes or driven by one of its conductors.
  // An unavailable bus is out of service even if a live entry is still around.
  const lineRouteIds = new Set(routes.map((r) => r.id));
  const lineConductorIds = new Set(conductors.map((c) => c.id));
  const lineBuses = liveBuses.filter(
    (bus) =>
      !unavailableIds.has(bus.busId) &&
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
      await returnBusToService(returning.bus.busId);
      if (focusedUnavailableId === returning.bus.busId) setFocusedUnavailableId(null);
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

      {/* UNAVAILABLE BUSES — marked by a conductor; cleared by "Return to service" */}
      {unavailableBuses.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-red-100 text-red-600 rounded-xl flex items-center justify-center shrink-0">
              <TriangleAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-800">
                {unavailableBuses.length === 1
                  ? "1 bus marked unavailable"
                  : `${unavailableBuses.length} buses marked unavailable`}
              </p>
              <p className="text-xs text-red-700/80">
                Trips can't start on these buses until you return them to service.
              </p>
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            {unavailableBuses.map((bus) => (
              <li
                key={bus.busId}
                className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-red-100 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-950">{bus.busId}</p>
                  <p className="text-xs text-slate-600 truncate">
                    {bus.source === "operator"
                      ? `Set unavailable by an operator · ${formatDateTime(bus.unavailableAt)}`
                      : `${bus.routeName || "No route"} · ${formatDateTime(bus.unavailableAt)} · reported by ${
                          bus.conductorName || conductorNames.get(bus.conductorId) || "a conductor"
                        }`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {hasPosition(bus) ? (
                    <button
                      type="button"
                      onClick={() => setFocusedUnavailableId(bus.busId)}
                      className="flex items-center gap-2 text-xs font-semibold text-blue-700 px-4 py-2 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      Show on map
                    </button>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-400">Location unknown</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setReturning({ bus, busy: false, error: null })}
                    className="flex items-center gap-2 text-xs font-semibold text-slate-700 px-4 py-2 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Return to service
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* MAP — live buses on this line (click one to focus it) + red pins
          where buses were marked unavailable */}
      <div className="flex-1 min-h-[460px] bg-white p-2 rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden relative">
        <FleetMap
          buses={lineBuses}
          conductorNames={conductorNames}
          unavailableBuses={unavailableBuses}
          focusedUnavailableId={focusedUnavailableId}
          onFocusUnavailable={setFocusedUnavailableId}
          onReturnToService={(bus) => setReturning({ bus, busy: false, error: null })}
        />
      </div>

      {returning && (
        <ConfirmDialog
          title={`Return ${returning.bus.busId} to service?`}
          message={
            returning.error ??
            "The unavailable alert is cleared and conductors can start trips on this bus again."
          }
          confirmLabel={returning.busy ? "Returning…" : "Return to Service"}
          onConfirm={returning.busy ? () => {} : handleReturnToService}
          onCancel={returning.busy ? () => {} : () => setReturning(null)}
        />
      )}
    </MainLayout>
  );
}
