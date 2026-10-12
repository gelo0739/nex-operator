import MainLayout from "../components/MainLayout";
import { Bus, Pause, FileText } from "lucide-react";
import { GoogleMap } from "@react-google-maps/api";
import useGoogleMaps, { MAP_ID } from "../hooks/useGoogleMaps";
import AdvancedMarker from "../components/AdvancedMarker";
import MapPin from "../components/MapPin";
import useActiveBusCount from "../hooks/useActiveBusCount";
import useBusCount from "../hooks/useBusCount";
import usePendinglostItemCount from "../hooks/usePendingLostItemCount";
// (Kept from original Dashboard.jsx)
const MAP_CENTER = { lat: 14.28, lng: 120.93 };
const MAP_CONTAINER_STYLE = {
  width: "100%",
  height: "100%",
  borderRadius: "1.25rem",
};
const MAP_OPTIONS = { mapId: MAP_ID };
const BUS_LOCATIONS = [
  { id: "402", lat: 14.3294, lng: 120.9367, label: "Bus #402" },
  { id: "108", lat: 14.2251, lng: 120.975, label: "Bus #108" },
];

export default function Dashboard() {
  const { isLoaded } = useGoogleMaps();

  const totalBusCount = useBusCount();
  const activeBusCount = useActiveBusCount();
  const pendingLostItemCount = usePendinglostItemCount();

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
                  {stat.value}
                </h2>
              </div>
            </div>
          );
        })}
      </div>

      {/* MAP */}
      <div className="flex-1 min-h-[420px] bg-white p-2 rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden relative">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={MAP_CONTAINER_STYLE}
            center={MAP_CENTER}
            zoom={11}
            options={MAP_OPTIONS}
          >
            {BUS_LOCATIONS.map((bus) => (
              <AdvancedMarker
                key={bus.id}
                position={{ lat: bus.lat, lng: bus.lng }}
                title={bus.label}
              >
                <MapPin variant="bus" label={bus.label} />
              </AdvancedMarker>
            ))}
          </GoogleMap>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400 rounded-2xl">
            <Bus className="w-10 h-10 animate-bounce mb-2 text-blue-500" />
            <p className="text-sm font-semibold">Loading Cavite Map...</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
