import { useState, useEffect } from 'react';
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
import {
  ConfirmedReservation,
  HotelConfig,
  Conversation,
  ConversationMessage,
  MessageSenderType,
} from '../types';

const CONVERSATION_STATUS_LABELS: Record<Conversation['status'], string> = {
  BOT_ACTIVE: 'Bollukito atendiendo',
  WAITING_HUMAN: 'Necesita recepción',
  HUMAN_ACTIVE: 'Recepción atendiendo',
  BOT_RESUMED: 'Devuelto a Bollukito',
  CLOSED: 'Cerrada',
};

const CONVERSATION_STATUS_BADGES: Record<Conversation['status'], string> = {
  BOT_ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  WAITING_HUMAN: 'bg-amber-50 text-amber-700 border-amber-200',
  HUMAN_ACTIVE: 'bg-blue-50 text-blue-700 border-blue-200',
  BOT_RESUMED: 'bg-teal-50 text-teal-700 border-teal-200',
  CLOSED: 'bg-slate-100 text-slate-600 border-slate-200',
};

const formatMessageTime = (dateStr: string | Date): string => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
};

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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'loaded'>('all');
  const [search, setSearch] = useState('');
  const [selectedResId, setSelectedResId] = useState<string | null>(
    reservations.length > 0 ? reservations[0].id : null
  );
  const [receptionSummary, setReceptionSummary] = useState<{
    checkInsToday: number;
    checkOutsToday: number;
    pendingReservations: number;
    confirmedReservations: number;
    cancelledReservations: number;
  }>({
    checkInsToday: 0,
    checkOutsToday: 0,
    pendingReservations: 0,
    confirmedReservations: 0,
    cancelledReservations: 0,
  });
  const [todayReceptionReservations, setTodayReceptionReservations] = useState<any[]>([]);

  const handleSelectConversation = async (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      if (res.ok) {
        const data: ConversationMessage[] = await res.json();
        const sorted = [...data].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setConversationMessages(sorted);
      } else {
        setConversationMessages([]);
      }
    } catch (err) {
      console.error('Error fetching conversation messages:', err);
      setConversationMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleTakeConversation = async () => {
    if (!selectedConversationId || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/conversations/${selectedConversationId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'HUMAN_ACTIVE' }),
      });
      if (res.ok) {
        const updated: Conversation = await res.json();
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversationId ? { ...c, status: updated.status } : c
          )
        );
      }
    } catch (err) {
      console.error('Error updating conversation status:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleReturnToBollukito = async () => {
    if (!selectedConversationId || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/conversations/${selectedConversationId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'BOT_RESUMED' }),
      });
      if (res.ok) {
        const updated: Conversation = await res.json();
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversationId ? { ...c, status: updated.status } : c
          )
        );
      }
    } catch (err) {
      console.error('Error updating conversation status:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCloseConversation = async () => {
    if (!selectedConversationId || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/conversations/${selectedConversationId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSED' }),
      });
      if (res.ok) {
        const updated: Conversation = await res.json();
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversationId ? { ...c, status: updated.status } : c
          )
        );
      }
    } catch (err) {
      console.error('Error updating conversation status to CLOSED:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSendMessage = async () => {
    const trimmed = replyText.trim();
    if (!trimmed || !selectedConversationId || isSendingMessage) {
      return;
    }

    setIsSendingMessage(true);
    try {
      const res = await fetch(`/api/conversations/${selectedConversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderType: 'HUMAN',
          content: trimmed,
        }),
      });

      if (res.ok) {
        setReplyText('');
        // Recargar el historial de esa conversación
        const msgRes = await fetch(`/api/conversations/${selectedConversationId}/messages`);
        if (msgRes.ok) {
          const data: ConversationMessage[] = await msgRes.json();
          const sorted = [...data].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          setConversationMessages(sorted);
        }
      } else {
        console.error('Error al guardar mensaje humano en PostgreSQL');
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setIsSendingMessage(false);
    }
  };

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await fetch('/api/conversations');
        if (res.ok) {
          const data: Conversation[] = await res.json();
          setConversations(data);
          if (data.length > 0) {
            handleSelectConversation(data[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching conversations:', err);
      }
    };

    fetchConversations();
  }, []);

  useEffect(() => {
    const fetchReceptionSummary = async () => {
      try {
        const res = await fetch('/api/reception-summary');
        if (res.ok) {
          const data = await res.json();
          setReceptionSummary(data);
        }
      } catch (err) {
        console.error('Error fetching reception summary:', err);
      }
    };

    fetchReceptionSummary();
  }, []);

  useEffect(() => {
    const fetchTodayReceptionReservations = async () => {
      try {
        const res = await fetch('/api/reception-reservations-today');
        if (res.ok) {
          const data = await res.json();
          setTodayReceptionReservations(data);
        }
      } catch (err) {
        console.error('Error fetching today reception reservations:', err);
      }
    };

    fetchTodayReceptionReservations();
  }, []);

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);

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
              <span className="block text-xs text-slate-300">Check-ins de hoy</span>
              <span className="text-2xl font-black text-white">
                {receptionSummary.checkInsToday}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 text-center border border-white/15 min-w-[110px]">
              <span className="block text-xs text-slate-300">Check-outs de hoy</span>
            </div>
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

      {/* Reservas de hoy */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
        <h3 className="font-bold text-slate-900 text-sm">
          Reservas de hoy
        </h3>
        {todayReceptionReservations.length === 0 ? (
          <p className="text-xs text-slate-500">No hay reservas para hoy.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {todayReceptionReservations.map((item, idx) => {
              const matching = reservations.find(
                (r) => r.id === item.id || r.bookingId === item.reservationCode
              );
              const guestName =
                item.guestName ||
                item.customerName ||
                item.customer?.name ||
                matching?.guestName ||
                'Huésped';
              const room =
                item.roomNumber ||
                item.roomType ||
                item.room?.roomNumber ||
                matching?.roomType ||
                'Habitación';
              const checkIn =
                (item.checkIn ? String(item.checkIn).split('T')[0] : '') ||
                matching?.checkIn ||
                '';
              const checkOut =
                (item.checkOut ? String(item.checkOut).split('T')[0] : '') ||
                matching?.checkOut ||
                '';
              const reservationStatus =
                item.reservationStatus || matching?.reservationStatus || 'CONFIRMED';

              return (
                <div
                  key={item.id || idx}
                  className="py-2.5 flex flex-wrap items-center justify-between text-xs text-slate-700 gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{guestName}</span>
                    <span className="text-slate-400">•</span>
                    <span>{room}</span>
                  </div>
                  <div className="flex items-center gap-4 text-slate-600">
                    <span>{checkIn}</span>
                    <span>{checkOut}</span>
                    <span className="font-medium text-slate-900">{reservationStatus}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
                      src="/bollukito_avatar.jpg?v=5"
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

      {/* Conversaciones */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">
            Conversaciones
          </h3>
          {conversations.length > 0 && (
            <span className="text-xs text-slate-500 font-medium">
              {conversations.length} en total
            </span>
          )}
        </div>

        {conversations.length === 0 ? (
          <div className="text-xs text-slate-500">
            No hay conversaciones activas.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Lista de conversaciones */}
            <div className="md:col-span-5 divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
              {conversations.map((conv) => {
                const isSelected = selectedConversationId === conv.id;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`w-full text-left py-2.5 px-3 flex items-center justify-between text-xs transition-colors ${
                      isSelected
                        ? 'bg-slate-100/90 font-medium text-slate-900'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="font-medium">{conv.phoneNumber}</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                        CONVERSATION_STATUS_BADGES[conv.status] ||
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {CONVERSATION_STATUS_LABELS[conv.status] || conv.status}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Historial de mensajes */}
            <div className="md:col-span-7 bg-slate-50/70 border border-slate-100 rounded-xl p-3.5 flex flex-col min-h-[220px]">
              {selectedConversation ? (
                <>
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-800">
                        {selectedConversation.phoneNumber}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          CONVERSATION_STATUS_BADGES[selectedConversation.status] ||
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {CONVERSATION_STATUS_LABELS[selectedConversation.status] || selectedConversation.status}
                      </span>
                    </div>

                    {(selectedConversation.status === 'BOT_ACTIVE' ||
                      selectedConversation.status === 'WAITING_HUMAN') && (
                      <button
                        type="button"
                        onClick={handleTakeConversation}
                        disabled={isUpdatingStatus}
                        className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-semibold transition-colors shadow-xs"
                      >
                        {isUpdatingStatus ? 'TOMANDO...' : 'TOMAR CONVERSACIÓN'}
                      </button>
                    )}

                    {selectedConversation.status === 'HUMAN_ACTIVE' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleReturnToBollukito}
                          disabled={isUpdatingStatus}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-semibold transition-colors shadow-xs"
                        >
                          {isUpdatingStatus ? 'DEVOLVIENDO...' : 'DEVOLVER A BOLLUKITO'}
                        </button>
                        <button
                          id="btn-close-conversation"
                          type="button"
                          onClick={handleCloseConversation}
                          disabled={isUpdatingStatus}
                          className="px-3 py-1 rounded-lg bg-slate-600 hover:bg-slate-700 disabled:opacity-50 text-white text-[11px] font-semibold transition-colors shadow-xs"
                        >
                          {isUpdatingStatus ? 'CERRANDO...' : 'CERRAR CONVERSACIÓN'}
                        </button>
                      </div>
                    )}
                  </div>

                  {isLoadingMessages ? (
                    <div className="m-auto text-xs text-slate-400">
                      Cargando mensajes...
                    </div>
                  ) : conversationMessages.length === 0 ? (
                    <div className="m-auto text-xs text-slate-500">
                      No hay mensajes en esta conversación.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                      {conversationMessages.map((msg) => {
                        const time = formatMessageTime(msg.createdAt);

                        if (msg.senderType === 'SYSTEM') {
                          return (
                            <div key={msg.id} className="flex justify-center my-1.5">
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-[11px] text-slate-500 text-center max-w-[85%]">
                                <span>{msg.content}</span>
                                <span className="text-[10px] text-slate-400">· {time}</span>
                              </div>
                            </div>
                          );
                        }

                        const isCustomer = msg.senderType === 'CUSTOMER';
                        const isBot = msg.senderType === 'BOT';
                        const isHuman = msg.senderType === 'HUMAN';

                        const containerClass = isCustomer ? 'flex justify-start' : 'flex justify-end';

                        let bubbleClass = 'bg-white border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm';
                        let timeClass = 'text-slate-400';

                        if (isBot) {
                          bubbleClass = 'bg-emerald-50 border-emerald-200/90 text-slate-800 rounded-2xl rounded-tr-sm';
                          timeClass = 'text-emerald-700/60';
                        } else if (isHuman) {
                          bubbleClass = 'bg-blue-50 border-blue-200/90 text-slate-800 rounded-2xl rounded-tr-sm';
                          timeClass = 'text-blue-600/60';
                        }

                        return (
                          <div key={msg.id} className={containerClass}>
                            <div className={`p-2.5 rounded-2xl border text-xs max-w-[82%] shadow-xs space-y-1 ${bubbleClass}`}>
                              {isHuman && (
                                <div className="text-[10px] font-semibold text-blue-700/80">
                                  Recepción
                                </div>
                              )}
                              <p className="whitespace-pre-wrap leading-relaxed break-words">
                                {msg.content}
                              </p>
                              <div className={`text-[10px] text-right ${timeClass}`}>
                                {time}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {selectedConversation.status === 'HUMAN_ACTIVE' && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center gap-2">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        disabled={isSendingMessage}
                        placeholder="Escribe una respuesta como recepcionista..."
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={handleSendMessage}
                        disabled={isSendingMessage}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                      >
                        {isSendingMessage ? 'ENVIANDO...' : 'ENVIAR'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="m-auto text-xs text-slate-400">
                  Selecciona una conversación para ver sus mensajes.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
