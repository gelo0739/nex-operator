import React, { useState } from 'react';
import { 
  Bus, 
  Users, 
  Route as RouteIcon, 
  MessageSquare, 
  FileText, 
  BarChart3, 
  Settings, 
  Bell, 
  Info,
  Pause
} from 'lucide-react';
import { GoogleMap, useJsApiLoader, MarkerF } from '@react-google-maps/api';

// Map Center: Cavite Transit Corridor (Dasmariñas / Silang / Tagaytay)
const MAP_CENTER = { lat: 14.2800, lng: 120.9300 };

const MAP_CONTAINER_STYLE = {
  width: '100%',
  height: '100%',
  borderRadius: '1.25rem',
};

// Active Bus Markers on Map
const BUS_LOCATIONS = [
  { id: '402', lat: 14.3294, lng: 120.9367, label: 'Bus #402 (Dasmariñas)' },
  { id: '108', lat: 14.2251, lng: 120.9750, label: 'Bus #108 (Silang)' },
  { id: '305', lat: 14.1378, lng: 120.8558, label: 'Bus #305 (Alfonso)' },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('fleet');
  const [showNotifications, setShowNotifications] = useState(true);

  // Load Google Maps API using Vite environment variable
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  });

  return (
    <div className="flex h-screen bg-[#f4f6fa] text-slate-800 font-sans overflow-hidden">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-[#edf1f7] border-r border-slate-200/70 p-5 flex flex-col justify-between select-none">
        <div>
          {/* Brand Logo Header */}
          <h1 className="text-xl font-bold text-blue-900 tracking-tight px-3 py-2 mb-6">
            NEX Dashboard
          </h1>

          {/* Navigation Items */}
          <nav className="space-y-1.5">
            {[
              { id: 'fleet', label: 'Fleet Overview', icon: Bus },
              { id: 'conductors', label: 'Manage Conductors', icon: Users },
              { id: 'bus', label: 'Manage Bus', icon: Bus },
              { id: 'route', label: 'Manage Route', icon: RouteIcon },
              { id: 'feedback', label: 'Passenger Feedback', icon: MessageSquare },
              { id: 'lost-items', label: 'Lost Item Reports', icon: FileText },
              { id: 'end-reports', label: 'End of Trip Reports', icon: BarChart3 },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Link */}
        <button className="flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200/60 transition-colors">
          <Settings className="w-4 h-4 text-slate-500" />
          Account Settings
        </button>
      </aside>

      {/* MAIN CONTENT CANVAS */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* TOP HEADER */}
        <header className="h-16 px-8 flex items-center justify-end gap-5 bg-[#f4f6fa] relative z-20">
          
          {/* Notification Bell & Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-slate-600 hover:bg-slate-200/60 rounded-full relative transition-colors cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            {/* Floating Notification Box */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-100 p-3.5 space-y-2 z-50">
                <div className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <Info className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-slate-800">Bus #402 has arrived at PITX</p>
                    <p className="text-slate-400 text-[10px] mt-0.5">2 mins ago</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <MessageSquare className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-slate-800">New feedback from Alfonso - PITX Route</p>
                    <p className="text-slate-400 text-[10px] mt-0.5">15 mins ago</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-3 pl-3 border-l border-slate-300/60">
            <div className="text-right">
              <p className="text-xs font-bold text-slate-900 leading-tight">Dixon Mayaz</p>
              <p className="text-[10px] text-slate-500 font-medium">Operations Manager</p>
            </div>
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop"
              alt="Dixon Mayaz"
              className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-sm"
            />
          </div>
        </header>

        {/* DASHBOARD CONTENT BODY */}
        <main className="flex-1 p-8 pt-2 flex flex-col gap-6 overflow-y-auto">
          
          {/* STAT CARDS ROW */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Active Buses Card */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col justify-between">
              <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-3">
                <Bus className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Active Buses</p>
                <h2 className="text-3xl font-extrabold text-slate-900">3</h2>
              </div>
            </div>

            {/* Inactive Fleet Card */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col justify-between">
              <div className="w-9 h-9 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center mb-3">
                <Pause className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Inactive Fleet</p>
                <h2 className="text-3xl font-extrabold text-slate-900">12</h2>
              </div>
            </div>

            {/* Lost Item Reports Card */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col justify-between">
              <div className="w-9 h-9 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center mb-3">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Lost Item Reports</p>
                <h2 className="text-3xl font-extrabold text-slate-900">24</h2>
              </div>
            </div>
          </div>

          {/* GOOGLE MAP DISPLAY CARD */}
          <div className="flex-1 min-h-[420px] bg-white p-2 rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden relative">
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={MAP_CENTER}
                zoom={11}
                options={{
                  disableDefaultUI: false,
                  zoomControl: true,
                  streetViewControl: false,
                  mapTypeControl: false,
                }}
              >
                {BUS_LOCATIONS.map((bus) => (
                  <MarkerF
                    key={bus.id}
                    position={{ lat: bus.lat, lng: bus.lng }}
                    title={bus.label}
                  />
                ))}
              </GoogleMap>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400 rounded-2xl">
                <Bus className="w-10 h-10 animate-bounce mb-2 text-blue-500" />
                <p className="text-sm font-semibold">Loading Cavite Map...</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}