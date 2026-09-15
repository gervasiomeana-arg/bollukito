import { useState, useEffect } from 'react';
import {
  Bed,
  Layers,
  Plus,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Sliders,
  Check,
  X,
  Lock,
  Wrench,
  UserCheck,
} from 'lucide-react';
import { RoomTypeData, RoomData, RoomStatus } from '../types';

export function InventoryManagement() {
  const [subTab, setSubTab] = useState<'types' | 'rooms'>('types');
  const [roomTypes, setRoomTypes] = useState<RoomTypeData[]>([]);
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Room Type Form States
  const [editingType, setEditingType] = useState<RoomTypeData | null>(null);
  const [typeForm, setTypeForm] = useState({
    name: '',
    description: '',
    capacity: 2,
    baseRate: 43000,
    active: true,
  });

  // Room Form States
  const [editingRoom, setEditingRoom] = useState<RoomData | null>(null);
  const [roomForm, setRoomForm] = useState<{
    number: string;
    roomTypeId: string;
    status: RoomStatus;
    active: boolean;
  }>({
    number: '',
    roomTypeId: '',
    status: 'AVAILABLE',
    active: true,
  });

  const fetchData = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const [resTypes, resRooms] = await Promise.all([
        fetch('/api/room-types'),
        fetch('/api/rooms'),
      ]);

      if (!resTypes.ok || !resRooms.ok) {
        throw new Error('Error al cargar datos del inventario desde el servidor');
      }

      const typesData: RoomTypeData[] = await resTypes.json();
      const roomsData: RoomData[] = await resRooms.json();

      setRoomTypes(typesData);
      setRooms(roomsData);

      if (typesData.length > 0 && !roomForm.roomTypeId) {
        setRoomForm((prev) => ({ ...prev, roomTypeId: typesData[0].id }));
      }
    } catch (err: any) {
      console.error('Error fetching inventory:', err);
      setFeedback({ type: 'error', message: err.message || 'No se pudo cargar el inventario' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Save / Edit Room Type
  const handleSaveRoomType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeForm.name.trim()) {
      setFeedback({ type: 'error', message: 'El nombre del tipo de habitación es obligatorio' });
      return;
    }
    if (typeForm.capacity < 1) {
      setFeedback({ type: 'error', message: 'La capacidad debe ser de al menos 1 huésped' });
      return;
    }
    if (typeForm.baseRate < 0) {
      setFeedback({ type: 'error', message: 'La tarifa base no puede ser negativa' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const url = editingType ? `/api/room-types/${editingType.id}` : '/api/room-types';
      const method = editingType ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: typeForm.name.trim(),
          description: typeForm.description.trim() || null,
          capacity: Number(typeForm.capacity),
          baseRate: Number(typeForm.baseRate),
          active: typeForm.active,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al guardar tipo de habitación');
      }

      setFeedback({
        type: 'success',
        message: editingType
          ? `Tipo "${typeForm.name}" actualizado correctamente.`
          : `Tipo "${typeForm.name}" creado correctamente.`,
      });

      setEditingType(null);
      setTypeForm({
        name: '',
        description: '',
        capacity: 2,
        baseRate: 43000,
        active: true,
      });

      await fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Save / Edit Room
  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomForm.number.trim()) {
      setFeedback({ type: 'error', message: 'El número o nombre de habitación es obligatorio' });
      return;
    }
    if (!roomForm.roomTypeId) {
      setFeedback({ type: 'error', message: 'Selecciona un tipo de habitación válido' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const url = editingRoom ? `/api/rooms/${editingRoom.id}` : '/api/rooms';
      const method = editingRoom ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: roomForm.number.trim(),
          roomTypeId: roomForm.roomTypeId,
          status: roomForm.status,
          active: roomForm.active,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al guardar habitación');
      }

      setFeedback({
        type: 'success',
        message: editingRoom
          ? `Habitación "${roomForm.number}" actualizada correctamente.`
          : `Habitación "${roomForm.number}" creada en inventario real.`,
      });

      setEditingRoom(null);
      setRoomForm({
        number: '',
        roomTypeId: roomTypes[0]?.id || '',
        status: 'AVAILABLE',
        active: true,
      });

      await fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditType = (type: RoomTypeData) => {
    setEditingType(type);
    setTypeForm({
      name: type.name,
      description: type.description || '',
      capacity: type.capacity,
      baseRate: Number(type.baseRate),
      active: type.active ?? true,
    });
    window.scrollTo({ top: 350, behavior: 'smooth' });
  };

  const cancelEditType = () => {
    setEditingType(null);
    setTypeForm({
      name: '',
      description: '',
      capacity: 2,
      baseRate: 43000,
      active: true,
    });
  };

  const startEditRoom = (r: RoomData) => {
    setEditingRoom(r);
    setRoomForm({
      number: r.number,
      roomTypeId: r.roomTypeId,
      status: r.status,
      active: r.active ?? true,
    });
    window.scrollTo({ top: 350, behavior: 'smooth' });
  };

  const cancelEditRoom = () => {
    setEditingRoom(null);
    setRoomForm({
      number: '',
      roomTypeId: roomTypes[0]?.id || '',
      status: 'AVAILABLE',
      active: true,
    });
  };

  const getStatusBadge = (status: RoomStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <Check className="w-3 h-3 mr-1 text-emerald-600" /> Disponible
          </span>
        );
      case 'OCCUPIED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <UserCheck className="w-3 h-3 mr-1 text-blue-600" /> Ocupada
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <Lock className="w-3 h-3 mr-1 text-amber-600" /> Bloqueada
          </span>
        );
      case 'MAINTENANCE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <Wrench className="w-3 h-3 mr-1 text-rose-600" /> Mantenimiento
          </span>
        );
      default:
        return <span className="text-xs text-slate-600">{status}</span>;
    }
  };

  return (
    <div id="inventory-management-section" className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
              <Sliders className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              Gestión de Inventario Real (Hotel Bolluk)
            </h3>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Administra los tipos de habitación oficiales y el parque de habitaciones físicas de Hotel Bolluk. Los cambios se guardan directamente en PostgreSQL y actualizan la disponibilidad en tiempo real.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchData}
          disabled={isLoading}
          className="inline-flex items-center px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center space-x-2 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Subtab Toggle */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setSubTab('types')}
          className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            subTab === 'types'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4 mr-1.5" />
          Tipos de Habitación ({roomTypes.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('rooms')}
          className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            subTab === 'rooms'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Bed className="w-4 h-4 mr-1.5" />
          Habitaciones Físicas ({rooms.length})
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          <p className="text-xs">Cargando inventario de PostgreSQL...</p>
        </div>
      ) : subTab === 'types' ? (
        /* ================================================= */
        /* TAB: TIPOS DE HABITACIÓN (room_types)             */
        /* ================================================= */
        <div className="space-y-6">
          {/* Form */}
          <form
            onSubmit={handleSaveRoomType}
            className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center">
                {editingType ? <Edit2 className="w-4 h-4 mr-1.5 text-purple-600" /> : <Plus className="w-4 h-4 mr-1.5 text-purple-600" />}
                {editingType ? `Editar Tipo: ${editingType.name}` : 'Crear Nuevo Tipo de Habitación'}
              </span>
              {editingType && (
                <button
                  type="button"
                  onClick={cancelEditType}
                  className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center"
                >
                  <X className="w-3.5 h-3.5 mr-1" /> Cancelar edición
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Nombre del Tipo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Habitación Triple Superior"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                  className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Capacidad de Huéspedes *
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  required
                  value={typeForm.capacity}
                  onChange={(e) => setTypeForm({ ...typeForm, capacity: parseInt(e.target.value) || 1 })}
                  className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Tarifa Base por Noche ($) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  required
                  value={typeForm.baseRate}
                  onChange={(e) => setTypeForm({ ...typeForm, baseRate: parseFloat(e.target.value) || 0 })}
                  className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer h-10 px-3 bg-white border border-slate-300 rounded-lg w-full">
                  <input
                    type="checkbox"
                    checked={typeForm.active}
                    onChange={(e) => setTypeForm({ ...typeForm, active: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                  />
                  <span>Activo para reservas</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Descripción (opcional)
              </label>
              <textarea
                rows={2}
                placeholder="Ej: Cama matrimonial king o dos camas individuales, vista al mar, aire acondicionado frío/calor, frigobar y balcón."
                value={typeForm.description}
                onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                )}
                {editingType ? 'Guardar Cambios' : 'Crear Tipo de Habitación'}
              </button>
            </div>
          </form>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Descripción</th>
                  <th className="p-3 text-center">Capacidad</th>
                  <th className="p-3 text-right">Tarifa Base</th>
                  <th className="p-3 text-center">Estado</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roomTypes.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-semibold text-slate-900">{t.name}</td>
                    <td className="p-3 max-w-xs truncate text-slate-500">{t.description || '—'}</td>
                    <td className="p-3 text-center font-medium">{t.capacity} pers.</td>
                    <td className="p-3 text-right font-bold text-slate-900">
                      ${Number(t.baseRate).toLocaleString('es-AR')}
                    </td>
                    <td className="p-3 text-center">
                      {t.active ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => startEditType(t)}
                        className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors"
                      >
                        <Edit2 className="w-3 h-3 mr-1" /> Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================================================= */
        /* TAB: HABITACIONES FÍSICAS (rooms)                */
        /* ================================================= */
        <div className="space-y-6">
          {/* Form */}
          <form
            onSubmit={handleSaveRoom}
            className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center">
                {editingRoom ? <Edit2 className="w-4 h-4 mr-1.5 text-purple-600" /> : <Plus className="w-4 h-4 mr-1.5 text-purple-600" />}
                {editingRoom ? `Editar Habitación: ${editingRoom.number}` : 'Crear Nueva Habitación Física'}
              </span>
              {editingRoom && (
                <button
                  type="button"
                  onClick={cancelEditRoom}
                  className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center"
                >
                  <X className="w-3.5 h-3.5 mr-1" /> Cancelar edición
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Número o Nombre de Habitación *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 102 o Suite 201"
                  value={roomForm.number}
                  onChange={(e) => setRoomForm({ ...roomForm, number: e.target.value })}
                  className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Tipo de Habitación *
                </label>
                <select
                  required
                  value={roomForm.roomTypeId}
                  onChange={(e) => setRoomForm({ ...roomForm, roomTypeId: e.target.value })}
                  className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                >
                  {roomTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name} ({rt.capacity} pers. - ${Number(rt.baseRate).toLocaleString('es-AR')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Estado Operativo *
                </label>
                <select
                  required
                  value={roomForm.status}
                  onChange={(e) => setRoomForm({ ...roomForm, status: e.target.value as RoomStatus })}
                  className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                >
                  <option value="AVAILABLE">AVAILABLE (Disponible)</option>
                  <option value="OCCUPIED">OCCUPIED (Ocupada)</option>
                  <option value="BLOCKED">BLOCKED (Bloqueada)</option>
                  <option value="MAINTENANCE">MAINTENANCE (Mantenimiento)</option>
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer h-10 px-3 bg-white border border-slate-300 rounded-lg w-full">
                  <input
                    type="checkbox"
                    checked={roomForm.active}
                    onChange={(e) => setRoomForm({ ...roomForm, active: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                  />
                  <span>Activa en Inventario</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                )}
                {editingRoom ? 'Guardar Cambios' : 'Crear Habitación'}
              </button>
            </div>
          </form>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Habitación</th>
                  <th className="p-3">Tipo Asociado</th>
                  <th className="p-3 text-center">Capacidad</th>
                  <th className="p-3 text-center">Estado</th>
                  <th className="p-3 text-center">Activa</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rooms.map((r) => {
                  const type = roomTypes.find((t) => t.id === r.roomTypeId) || r.roomType;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-bold text-slate-900 flex items-center">
                        <Bed className="w-3.5 h-3.5 mr-2 text-purple-600" />
                        Habitación {r.number}
                      </td>
                      <td className="p-3 text-slate-700 font-medium">
                        {type?.name || 'Tipo no asignado'}
                      </td>
                      <td className="p-3 text-center">
                        {type?.capacity ? `${type.capacity} pers.` : '—'}
                      </td>
                      <td className="p-3 text-center">
                        {getStatusBadge(r.status)}
                      </td>
                      <td className="p-3 text-center">
                        {r.active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Sí
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                            No
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => startEditRoom(r)}
                          className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors"
                        >
                          <Edit2 className="w-3 h-3 mr-1" /> Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
