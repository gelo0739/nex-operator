import MainLayout from '../components/MainLayout';
import { Plus, Users, CheckCircle2, ChevronDown, Filter, FilePenLine, BusFront } from 'lucide-react';

// Sample data from the image
const conductors = [
  { id: 1, name: 'Khryss Andrei Bayan', avatar: 'https://randomuser.me/api/portraits/women/44.jpg', status: 'Active on Route', bus: 'Bus #402' },
  { id: 2, name: 'LA cabral', avatar: 'https://randomuser.me/api/portraits/women/68.jpg', status: 'Inactive', bus: null },
  { id: 3, name: 'Charisse Marie Rutherlin A. Campos', avatar: 'https://randomuser.me/api/portraits/men/75.jpg', status: 'Inactive', bus: null },
  { id: 4, name: 'Angelo Ian Conception', avatar: 'https://randomuser.me/api/portraits/men/81.jpg', status: 'Active on Route', bus: 'Bus #551' },
  // Added some extras to fill the table view
  { id: 5, name: 'Ma. Elena D. De Leon', avatar: 'https://randomuser.me/api/portraits/women/31.jpg', status: 'Inactive', bus: null },
  { id: 6, name: 'John Doe', avatar: 'https://randomuser.me/api/portraits/men/4.jpg', status: 'Inactive', bus: null },
];

export default function ManageConductors() {
  return (
    <MainLayout 
      pageTitle="Conductor Management" 
      pageSubtitle="Monitor and manage conductor assignments."
    >
      {/* HEADER ACTION ROW (Aligned right) */}
      <div className="flex justify-end mb-1">
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer">
          <Plus className="w-4 h-4" />
          Add New Conductor
        </button>
      </div>

      {/* STATS CARDS ROW (Matched to image) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-1">
        {/* Total Conductors */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Conductors</p>
            <h2 className="text-5xl font-black text-slate-950 tracking-tighter">142</h2>
          </div>
        </div>

        {/* Currently Active */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Currently Active</p>
            <h2 className="text-5xl font-black text-slate-950 tracking-tighter">3</h2>
          </div>
        </div>
      </div>

      {/* TABLE CONTAINER (White Card) */}
      <div className="flex-1 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        
        {/* Table Controls (Filter/Count) */}
        <div className="flex items-center justify-between mb-5">
          <button className="flex items-center gap-2 bg-slate-100 text-slate-700 text-[11px] font-semibold px-4 py-2 rounded-lg border border-slate-200 transition-colors hover:bg-slate-200">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            Filters
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
          </button>
          <p className="text-xs text-slate-500 font-medium">Showing 1-10 of 142 Conductors</p>
        </div>

        {/* ACTUAL TABLE */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left table-auto">
            {/* Table Headers */}
            <thead className="border-b border-slate-100">
              <tr className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider">
                <th className="px-5 py-4 min-w-[300px]">Conductor</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Assigned Bus</th>
                <th className="px-5 py-4 text-center">Actions</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {conductors.map((conductor) => {
                const isActive = conductor.status === 'Active on Route';
                return (
                  <tr key={conductor.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    {/* Conductor Column */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-4">
                        <img src={conductor.avatar} alt={conductor.name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-md ring-1 ring-slate-100" />
                        <p className="text-sm font-semibold text-slate-950">{conductor.name}</p>
                      </div>
                    </td>
                    
                    {/* Status Column (Badge) */}
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold ${
                        isActive 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {conductor.status}
                      </span>
                    </td>
                    
                    {/* Bus Column */}
                    <td className="px-5 py-4">
                      {conductor.bus ? (
                        <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-900">
                          <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                            <BusFront className="w-3.5 h-3.5" />
                          </div>
                          {conductor.bus}
                        </div>
                      ) : (
                        <p className="text-xs font-medium text-slate-400">N/A</p>
                      )}
                    </td>
                    
                    {/* Actions Column */}
                    <td className="px-5 py-4 text-center">
                      <button className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer">
                        <FilePenLine className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* PAGINATION ROW (Matched to image) */}
        <div className="flex items-center justify-between pt-5 mt-auto border-t border-slate-100">
          <button className="text-xs font-semibold text-slate-600 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200">
            Previous
          </button>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, '...', 14].map((page, i) => (
              <button key={i} className={`text-xs font-semibold w-8 h-8 rounded-lg ${
                page === 1 
                  ? 'bg-blue-600 text-white shadow shadow-blue-500/30' 
                  : 'text-slate-700 hover:bg-slate-100'
              }`}>
                {page}
              </button>
            ))}
          </div>
          <button className="text-xs font-semibold text-slate-600 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200">
            Next
          </button>
        </div>
      </div>
    </MainLayout>
  );
}