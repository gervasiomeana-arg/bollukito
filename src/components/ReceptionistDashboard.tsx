import { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  User,
  Phone,
  Calendar,
  DollarSign,
  Building,
  ShieldCheck,
  Search,
  Filter,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { ConfirmedReservation, HotelConfig } from '../types';

interface ReceptionistDashboardProps {
  reservations: ConfirmedReservation[];
  hotelConfig: HotelConfig;
  onToggleLoadedInSystem: (id: string, currentStatus: boolean) => void;
}

export function ReceptionistDashboard({
  reservations,
  hotelConfig,
  onToggleLoadedInSystem,
}: ReceptionistDashboardProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'loaded'>('all');
  const [search, setSearch] = useState('');
  const [selectedResId, setSelectedResId] = useState<string | null>(
    reservations.length > 0 ? reservations[0].id : null
  );

  const filteredReservations = reservations.filter((r) => {
    const matchesFilter =
      filter === 'all'
        ? true
        : filter === 'pending'
        ? !r.loadedInHotelSystem
        : r.loadedInHotelSystem;

    const matchesSearch =
      r.guestName.toLowerCase().includes(search.toLowerCase()) ||
      r.bookingId.toLowerCase().includes(search.toLowerCase()) ||
      r.roomType.toLowerCase().includes(search.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const selectedReservation =
    reservations.find((r) => r.id === selectedResId) || reservations[0];

  const getWhatsAppHumanTemplate = (res: ConfirmedReservation) => {
    return `🛎️ *¡NUEVA RESERVA CONFIRMADA Y PAGADA!*
━━━━━━━━━━━━━━━━━━━━━━━━━━
🏨 *Hotel:* ${hotelConfig.hotelName}
🤖 *Gestionado por:* Bollukito 🐾 (Bot IA WhatsApp)

👤 *Huésped:* ${res.guestName}
🆔 *DNI / Pasaporte:* ${res.guestDoc}
📱 *WhatsApp Huésped:* ${res.guestPhone}

🛏️ *Habitación:* ${res.roomType} (${res.guests} personas)
📅 *Check-in:* ${res.checkIn} (a partir de las ${hotelConfig.checkInTime} hs)
📅 *Check-out:* ${res.checkOut} (hasta las ${hotelConfig.checkOutTime} hs)
🌙 *Estadía:* ${res.nights} ${res.nights === 1 ? 'noche' : 'noches'}

💵 *Monto Total Pagado:* US$ ${res.totalPrice}
💳 *Medio de Pago:* ${res.paymentMethod}
🧾 *Comprobante Ref:* #${res.paymentRef}
🔖 *Código de Reserva:* #${res.bookingId}
━━━━━━━━━━━━━━━━━━━━━━━━━━
👉 *ACCIÓN REQUERIDA PARA RECEPCIÓN:*
Cargar en el sistema o planilla de turnos del Hotel Bolluk y asignar número de habitación.`;
  };

  const handleCopy = (res: ConfirmedReservation) => {
    const text = getWhatsAppHumanTemplate(res);
    navigator.clipboard.writeText(text);
    setCopiedId(res.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const totalEarnings = reservations.reduce((acc, r) => acc + r.totalPrice, 0);
  const pendingCount = reservations.filter((r) => !r.loadedInHotelSystem).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Explanation */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-6 text-white shadow-xl border border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-400 text-slate-950 flex items-center">
                <Bell className="w-3.5 h-3.5 mr-1" /> Notificaciones al Humano
              </span>
              <span className="text-xs text-slate-300">
                Teléfono receptor: <strong className="text-white">{hotelConfig.receptionistPhone}</strong>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Bandeja de Avisos para el Recepcionista
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Cada vez que un cliente reserva y paga con <strong>Bollukito</strong>, se genera este mensaje de WhatsApp para el personal humano del hotel, con todos los datos limpios para cargarlo inmediatamente a tu sistema interno o planilla.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 text-center border border-white/15 min-w-[110px]">
              <span className="block text-xs text-slate-300">Pendientes</span>
              <span className={`text-2xl font-black ${pendingCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {pendingCount}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 text-center border border-white/15 min-w-[130px]">
              <span className="block text-xs text-slate-300">Total Cobrado</span>
              <span className="text-2xl font-black text-emerald-400">
                US$ {totalEarnings}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left side list, Right side WhatsApp Message Preview for Receptionist */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: List of reservations */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center">
                <Building className="w-4 h-4 mr-1.5 text-emerald-600" />
                Reservas Confirmadas por el Bot
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {reservations.length} en total
              </span>
            </div>

            {/* Filter buttons */}
            <div className="flex space-x-1.5 p-1 bg-slate-100 rounded-xl text-xs font-medium">
              <button
                onClick={() => setFilter('all')}
                className={`flex-1 py-1.5 rounded-lg transition-colors ${
                  filter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todas ({reservations.length})
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`flex-1 py-1.5 rounded-lg transition-colors ${
                  filter === 'pending'
                    ? 'bg-amber-100 text-amber-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pendientes ({pendingCount})
              </button>
              <button
                onClick={() => setFilter('loaded')}
                className={`flex-1 py-1.5 rounded-lg transition-colors ${
                  filter === 'loaded'
                    ? 'bg-emerald-100 text-emerald-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cargadas ({reservations.length - pendingCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por huésped o código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Reservation items */}
          <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
            {filteredReservations.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 text-slate-500 text-xs">
                No hay reservas que coincidan con este filtro.
              </div>
            ) : (
              filteredReservations.map((res) => {
                const isSelected = selectedReservation?.id === res.id;
                return (
                  <div
                    key={res.id}
                    onClick={() => setSelectedResId(res.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {res.guestName}
                          </span>
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                            {res.roomType}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center space-x-1">
                          <span>{res.checkIn} al {res.checkOut}</span>
                          <span>•</span>
                          <span>{res.nights} {res.nights === 1 ? 'noche' : 'noches'}</span>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-extrabold text-sm text-slate-900 block">
                          US$ {res.totalPrice}
                        </span>
                        {res.loadedInHotelSystem ? (
                          <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full mt-1">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Cargado
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full mt-1 animate-pulse">
                            <Clock className="w-3 h-3 mr-1" /> Pendiente
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column: Simulated WhatsApp message on Receptionist's phone */}
        <div className="lg:col-span-7">
          {selectedReservation ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Phone Header simulation */}
              <div className="bg-[#075e54] text-white p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <img
                      src="/bollukito.jpg"
                      alt="Bollukito"
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-white/60"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[#075e54] rounded-full"></span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">
                      WhatsApp del Recepcionista ({hotelConfig.receptionistPhone})
                    </h4>
                    <p className="text-xs text-emerald-200">
                      Mensaje automático enviado por Bollukito 🐾
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleCopy(selectedReservation)}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-colors"
                >
                  {copiedId === selectedReservation.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Ficha</span>
                    </>
                  )}
                </button>
              </div>

              {/* Chat Body simulating WhatsApp */}
              <div className="p-5 bg-[#efeae2] bg-[radial-gradient(#d1c7b7_1px,transparent_1px)] [background-size:16px_16px] min-h-[420px] flex flex-col justify-between">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 text-xs sm:text-sm text-slate-800 leading-relaxed font-mono whitespace-pre-line max-w-xl">
                  {getWhatsAppHumanTemplate(selectedReservation)}
                </div>

                {/* Human Receptionist Action Box */}
                <div className="mt-4 bg-white/95 backdrop-blur-md rounded-xl p-4 border border-slate-300 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-slate-700">
                    <strong className="block font-bold text-slate-900 text-sm">
                      Estado de carga en el sistema del hotel:
                    </strong>
                    {selectedReservation.loadedInHotelSystem ? (
                      <span className="text-emerald-700 flex items-center font-medium mt-0.5">
                        <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" />
                        Esta reserva ya fue cargada en el software del hotel.
                      </span>
                    ) : (
                      <span className="text-amber-700 flex items-center font-medium mt-0.5">
                        <Clock className="w-4 h-4 mr-1 text-amber-600" />
                        Pendiente: El recepcionista debe ingresarla a su sistema o planilla.
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() =>
                      onToggleLoadedInSystem(
                        selectedReservation.id,
                        selectedReservation.loadedInHotelSystem
                      )
                    }
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center space-x-2 shrink-0 ${
                      selectedReservation.loadedInHotelSystem
                        ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {selectedReservation.loadedInHotelSystem
                        ? 'Desmarcar (Volver a pendiente)'
                        : 'Marcar como Cargada en el Sistema'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200">
              Selecciona una reserva para ver el mensaje enviado al recepcionista.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
