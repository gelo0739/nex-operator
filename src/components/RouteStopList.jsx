import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Crosshair, GripVertical, MapPin, X } from 'lucide-react';

const inputClass =
  'flex-1 min-w-0 h-11 rounded-xl border border-slate-200/80 bg-[#eef1fb] pl-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

function StopIcon({ variant, number }) {
  return (
    <div className="relative z-10 w-10 h-10 shrink-0 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center">
      {variant === 'start' && <span className="w-3.5 h-3.5 rounded-full border-[3px] border-blue-700" />}
      {variant === 'end' && <MapPin className="w-4 h-4 text-red-600 fill-red-600 stroke-white" />}
      {variant === 'waypoint' && <span className="text-[10px] font-bold text-slate-400">{number}</span>}
    </div>
  );
}

/** One row: icon + name input, with "place on map" (and remove for waypoints) inside the input. */
function StopRow({ variant, number, point, placeholder, isPicking, onNameChange, onPick, onRemove, dragHandle }) {
  const placed = Boolean(point?.lat != null);
  return (
    <div className="flex items-center gap-2">
      <StopIcon variant={variant} number={number} />
      <div className="relative flex-1 min-w-0 flex">
        <input
          type="text"
          value={point?.name ?? ''}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className={`${inputClass} ${onRemove ? 'pr-28' : 'pr-12'}`}
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center">
          <button
            type="button"
            onClick={onPick}
            title={placed ? 'Move this point on the map' : 'Place this point on the map'}
            aria-label={placed ? 'Move this point on the map' : 'Place this point on the map'}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isPicking
                ? 'bg-blue-600 text-white'
                : placed
                  ? 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                  : 'text-blue-600 bg-blue-50 animate-pulse'
            }`}
          >
            <Crosshair className="w-4 h-4" />
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              title="Remove stop"
              aria-label="Remove stop"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {dragHandle}
        </div>
      </div>
    </div>
  );
}

function SortableWaypoint({ waypoint, index, isPicking, onNameChange, onPick, onRemove }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: waypoint.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative ${isDragging ? 'z-20 opacity-90 drop-shadow-lg' : ''}`}
    >
      <StopRow
        variant="waypoint"
        number={index + 1}
        point={waypoint}
        placeholder={`Stop ${index + 1}`}
        isPicking={isPicking}
        onNameChange={onNameChange}
        onPick={onPick}
        onRemove={onRemove}
        dragHandle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            title="Drag to reorder"
            aria-label={`Reorder stop ${index + 1}`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        }
      />
    </div>
  );
}

/**
 * The "Route Parameters" stop list: Starting Destination → waypoints → Ending
 * Destination. Only waypoints can be reordered (drag the grip handle, or focus
 * it and use Space + arrow keys).
 *
 * `pickTarget` is 'start' | 'end' | a waypoint id | null — the point currently
 * waiting for a map click.
 */
export default function RouteStopList({ start, end, waypoints, pickTarget, onNameChange, onPick, onRemove, onReorder }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = waypoints.findIndex((w) => w.id === active.id);
    const to = waypoints.findIndex((w) => w.id === over.id);
    onReorder(arrayMove(waypoints, from, to));
  };

  return (
    <div className="relative">
      {/* Dashed connector running behind the stop icons */}
      <div className="absolute left-5 top-10 bottom-6 border-l-2 border-dashed border-slate-300" aria-hidden />

      <p className="relative pl-12 text-[11px] font-semibold text-slate-700 mb-1.5">Starting Destination</p>
      <StopRow
        variant="start"
        point={start}
        placeholder="Starting destination"
        isPicking={pickTarget === 'start'}
        onNameChange={(name) => onNameChange('start', name)}
        onPick={() => onPick('start')}
      />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={waypoints.map((w) => w.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3 mt-3">
            {waypoints.map((waypoint, index) => (
              <SortableWaypoint
                key={waypoint.id}
                waypoint={waypoint}
                index={index}
                isPicking={pickTarget === waypoint.id}
                onNameChange={(name) => onNameChange(waypoint.id, name)}
                onPick={() => onPick(waypoint.id)}
                onRemove={() => onRemove(waypoint.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <p className="relative pl-12 text-[11px] font-semibold text-slate-700 mt-3 mb-1.5">Ending Destination</p>
      <StopRow
        variant="end"
        point={end}
        placeholder="Ending destination"
        isPicking={pickTarget === 'end'}
        onNameChange={(name) => onNameChange('end', name)}
        onPick={() => onPick('end')}
      />
    </div>
  );
}
