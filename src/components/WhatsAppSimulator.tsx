import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Phone,
  Video,
  MoreVertical,
  CheckCheck,
  CreditCard,
  CheckCircle2,
  Calendar,
  Users,
  Building,
  RotateCcw,
  Volume2,
} from 'lucide-react';
import { ChatMessage, ReservationOffer, HotelConfig } from '../types';
import { PaymentModal } from './PaymentModal';

interface WhatsAppSimulatorProps {
  hotelConfig: HotelConfig;
  onNewConfirmedReservation: (reservation: any) => void;
}

export function WhatsAppSimulator({
  hotelConfig,
  onNewConfirmedReservation,
}: WhatsAppSimulatorProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-init',
      sender: 'bot',
      text: `¡Hola! 🐾🛎️ ¡Guau! Soy **Bollukito**, la mascota oficial y conserje virtual de **${hotelConfig.hotelName}**.\n\nEstoy aquí para ayudarte a consultar tarifas, ver disponibilidad y reservar tu estadía directamente por WhatsApp sin esperas. ¿En qué fechas estás planeando visitarnos y para cuántas personas?`,
      timestamp: '14:20',
      quickReplies: ['Para 2 personas (Hab. Doble)', 'Para 3 personas (Hab. Triple)', '¿Tienen cochera?'],
    },
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activePaymentOffer, setActivePaymentOffer] = useState<ReservationOffer | null>(null);
  const [guestData, setGuestData] = useState({ name: '', doc: '', phone: '+54 9 11 5541-9988' });
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const sendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isLoading) return;

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: userTime,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.slice(-8), // Send recent context
          hotelConfig,
        }),
      });

      const data = await res.json();
      const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let reservationOffer: ReservationOffer | undefined = undefined;
      if (data.reservationOffer) {
        reservationOffer = {
          bookingId: `BOL-${Math.floor(1000 + Math.random() * 9000)}`,
          roomType: data.reservationOffer.roomType || 'Doble',
          guests: data.reservationOffer.guests || 2,
          checkIn: data.reservationOffer.checkIn || '2026-09-12',
          checkOut: data.reservationOffer.checkOut || '2026-09-14',
          nights: data.reservationOffer.nights || 2,
          pricePerNight: data.reservationOffer.pricePerNight || hotelConfig.doubleRoomPrice,
          totalPrice: data.reservationOffer.totalPrice || hotelConfig.doubleRoomPrice * 2,
          currency: 'US$',
          status: 'pending_payment',
        };
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: data.reply || '¡Guau! Con gusto te ayudo con tu consulta en Hotel Bolluk.',
        timestamp: botTime,
        reservationOffer,
        quickReplies: data.quickReplies || [],
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: '¡Guau! 🐾 Tuve un pequeño tropiezo de red, pero estoy listo. ¿Qué fechas y tipo de habitación te gustaría consultar?',
          timestamp: botTime,
          quickReplies: ['Habitación Doble', 'Habitación Triple'],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentDetails: {
    paymentRef: string;
    paymentMethod: string;
    guestName: string;
    guestDoc: string;
    guestPhone: string;
  }) => {
    if (!activePaymentOffer) return;

    setGuestData({
      name: paymentDetails.guestName,
      doc: paymentDetails.guestDoc,
      phone: paymentDetails.guestPhone,
    });

    // 1. Mark the offer as paid in the chat messages
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.reservationOffer?.bookingId === activePaymentOffer.bookingId) {
          return {
            ...msg,
            reservationOffer: {
              ...msg.reservationOffer,
              status: 'paid',
              paymentRef: paymentDetails.paymentRef,
              guestName: paymentDetails.guestName,
              guestDoc: paymentDetails.guestDoc,
              guestPhone: paymentDetails.guestPhone,
            },
          };
        }
        return msg;
      })
    );

    // 2. Post to backend reservations API
    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: activePaymentOffer.bookingId,
          guestName: paymentDetails.guestName,
          guestDoc: paymentDetails.guestDoc,
          guestPhone: paymentDetails.guestPhone,
          roomType: activePaymentOffer.roomType,
          guests: activePaymentOffer.guests,
          checkIn: activePaymentOffer.checkIn,
          checkOut: activePaymentOffer.checkOut,
          nights: activePaymentOffer.nights,
          totalPrice: activePaymentOffer.totalPrice,
          currency: activePaymentOffer.currency,
          paymentRef: paymentDetails.paymentRef,
          paymentMethod: paymentDetails.paymentMethod,
        }),
      });

      const confirmedData = await response.json();
      onNewConfirmedReservation(confirmedData);

      // 3. Bollukito sends instant celebratory confirmation in WhatsApp chat
      const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-paid-${Date.now()}`,
            sender: 'bot',
            text: `🎉🐾 ¡GUAUUU! ¡Felicitaciones **${paymentDetails.guestName}**! \n\nTu pago de **US$ ${activePaymentOffer.totalPrice}** con ${paymentDetails.paymentMethod} fue aprobado exitosamente (*Ref: ${paymentDetails.paymentRef}*).\n\n✅ **Habitación ${activePaymentOffer.roomType} RESERVADA**\n📅 **Check-in:** ${activePaymentOffer.checkIn} (a partir de las ${hotelConfig.checkInTime} hs)\n📅 **Check-out:** ${activePaymentOffer.checkOut} (hasta las ${hotelConfig.checkOutTime} hs)\n🛎️ **Código de Reserva:** #${activePaymentOffer.bookingId}\n📍 **Ubicación:** ${hotelConfig.address}\n\n🚨 *Nota del sistema:* En este mismo instante le envié la ficha completa con tus datos al WhatsApp del recepcionista del hotel para que cargue tu reserva en el sistema. ¡Te esperamos con muchas ganas! 🐾`,
            timestamp: botTime,
            quickReplies: ['¿Cómo llegar al hotel?', '¿Horario del desayuno?'],
          },
        ]);

        // Show toast alert
        setNotificationToast(`🛎️ ¡Alerta enviada al recepcionista humano en WhatsApp! (Reserva #${activePaymentOffer.bookingId})`);
        setTimeout(() => setNotificationToast(null), 7000);
      }, 600);
    } catch (e) {
      console.error('Error saving reservation:', e);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: `msg-${Date.now()}`,
        sender: 'bot',
        text: `¡Hola! 🐾🛎️ ¡Guau! Soy **Bollukito**, la mascota oficial de **${hotelConfig.hotelName}**.\n\nEstoy listo para atenderte en WhatsApp 24/7. ¿Para qué fecha estás buscando alojamiento?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: ['Para 2 personas (Doble)', 'Para 3 personas (Triple)', '¿Tienen cochera?'],
      },
    ]);
  };

  return (
    <div className="relative max-w-4xl mx-auto">
      {/* Toast Alert */}
      {notificationToast && (
        <div className="fixed top-20 right-4 z-50 max-w-md bg-emerald-950 border-2 border-emerald-400 text-white px-4 py-3 rounded-xl shadow-2xl flex items-start space-x-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <strong className="block font-bold text-sm text-emerald-300">¡Notificación al Humano Enviada!</strong>
            {notificationToast}
            <span className="block mt-1 text-emerald-200/90 underline font-medium cursor-pointer">
              Ve a la pestaña "Avisos al Humano" arriba para verla
            </span>
          </div>
        </div>
      )}

      {/* Simulator Container */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-[750px]">
        {/* WhatsApp Top Bar */}
        <div className="bg-[#075e54] text-white px-4 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img
                src="/bollukito.jpg"
                alt="Bollukito"
                className={`w-11 h-11 rounded-full object-cover ring-2 ring-emerald-300 shadow-md ${
                  isLoading ? 'animate-bollukito-happy ring-amber-300 ring-4' : 'animate-bollukito-breathe animate-mascot-glow'
                } transition-all duration-300 cursor-pointer`}
                referrerPolicy="no-referrer"
                title="Bollukito en vivo - ¡Haz clic para saludarlo!"
                onClick={() => sendMessage('¡Hola Bollukito! 🐾')}
              />
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-[#075e54] rounded-full animate-pulse"></span>
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h2 className="font-semibold text-sm sm:text-base leading-tight">
                  {hotelConfig.hotelName} - Bollukito 🐾🛎️
                </h2>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" title="Cuenta Oficial Verificada" />
              </div>
              <p className="text-xs text-emerald-100 flex items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-300 inline-block mr-1.5 animate-pulse"></span>
                {isLoading ? 'Bollukito está escribiendo...' : 'Mascota en línea (IA 24/7)'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-emerald-100">
            <button
              onClick={handleResetChat}
              title="Reiniciar chat"
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors flex items-center text-xs"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Reiniciar</span>
            </button>
            <Phone className="w-4 h-4 opacity-80 cursor-pointer hover:opacity-100" />
            <Video className="w-4 h-4 opacity-80 cursor-pointer hover:opacity-100" />
            <MoreVertical className="w-4 h-4 opacity-80 cursor-pointer hover:opacity-100" />
          </div>
        </div>

        {/* WhatsApp Chat Viewport */}
        <div className="relative flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Chat Messages Body with WhatsApp background texture */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#efeae2] bg-[radial-gradient(#d1c7b7_1px,transparent_1px)] [background-size:16px_16px]">
            {/* Disclaimer banner */}
            <div className="flex justify-center">
              <div className="bg-amber-100/90 border border-amber-300 text-amber-900 text-[11px] px-3 py-1.5 rounded-lg text-center max-w-md shadow-xs">
                🔒 <strong>WhatsApp Business Oficial:</strong> Los mensajes son atendidos por la IA de Bollukito. Al pagar, el recepcionista humano recibe la alerta instantánea.
              </div>
            </div>

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                  msg.sender === 'user'
                    ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-none'
                    : 'bg-white text-slate-900 rounded-tl-none border border-slate-100'
                }`}
              >
                {/* Sender badge if bot */}
                {msg.sender === 'bot' && (
                  <div className="flex items-center space-x-1 text-[11px] font-bold text-[#075e54] mb-1">
                    <span>Bollukito 🐾🛎️</span>
                  </div>
                )}

                {/* Message text */}
                <div className="whitespace-pre-line leading-relaxed text-slate-800">
                  {msg.text}
                </div>

                {/* Reservation Offer Card if generated */}
                {msg.reservationOffer && (
                  <div className="mt-3 p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70 text-xs text-slate-800 space-y-2">
                    <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                      <div className="flex items-center space-x-1.5 font-bold text-emerald-900 text-sm">
                        <Building className="w-4 h-4 text-emerald-700" />
                        <span>Habitación {msg.reservationOffer.roomType}</span>
                      </div>
                      <span className="font-extrabold text-emerald-800 text-base">
                        US$ {msg.reservationOffer.totalPrice}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        <span>In: {msg.reservationOffer.checkIn}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Out: {msg.reservationOffer.checkOut}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{msg.reservationOffer.guests} personas ({msg.reservationOffer.nights} noches)</span>
                      </div>
                      <div className="text-emerald-700 font-medium">
                        Desayuno buffet incluido 🥐
                      </div>
                    </div>

                    {/* Button according to payment status */}
                    {msg.reservationOffer.status === 'paid' ? (
                      <div className="mt-2 py-2 px-3 bg-emerald-600 text-white rounded-lg font-bold flex items-center justify-center space-x-1.5 shadow-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>¡RESERVA PAGADA Y CONFIRMADA! (Ref: {msg.reservationOffer.paymentRef})</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActivePaymentOffer(msg.reservationOffer!)}
                        className="w-full mt-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center justify-center space-x-2 shadow-sm transition-transform active:scale-[0.98]"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Pagar con Mercado Pago / Tarjeta (US$ {msg.reservationOffer.totalPrice})</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Timestamp & read receipt */}
                <div className="flex items-center justify-end space-x-1 text-[10px] text-slate-400 mt-1">
                  <span>{msg.timestamp}</span>
                  {msg.sender === 'user' && <CheckCheck className="w-3.5 h-3.5 text-sky-500" />}
                </div>
              </div>

              {/* Quick replies for this message if any and it is the latest */}
              {msg.quickReplies && msg.quickReplies.length > 0 && msg.id === messages[messages.length - 1].id && (
                <div className="flex flex-wrap gap-1.5 mt-2 max-w-[85%]">
                  {msg.quickReplies.map((reply, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(reply)}
                      disabled={isLoading}
                      className="text-xs bg-white/90 hover:bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-full shadow-2xs transition-colors"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="flex items-start space-x-2">
              <div className="bg-white rounded-2xl rounded-tl-none px-4 py-2.5 shadow-sm border border-slate-100 flex items-center space-x-2">
                <span className="text-xs text-slate-500 font-medium">Bollukito está escribiendo...</span>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Preset quick test buttons */}
        <div className="bg-slate-100 px-4 py-1.5 border-t border-slate-200 flex items-center space-x-2 overflow-x-auto text-xs text-slate-600 shrink-0">
          <span className="font-semibold text-slate-500 shrink-0">Pruebas rápidas:</span>
          <button
            onClick={() => sendMessage('Hola, quiero cotizar para 2 personas para el próximo fin de semana')}
            className="shrink-0 bg-white hover:bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200"
          >
            💑 Habitación Doble finde
          </button>
          <button
            onClick={() => sendMessage('Somos una familia de 3 personas (matrimonio y un hijo), ¿qué habitación tienen?')}
            className="shrink-0 bg-white hover:bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200"
          >
            👨‍👩‍👦 Familia 3 personas
          </button>
          <button
            onClick={() => sendMessage('¿Tienen cochera para guardar el auto y aceptan mascotas?')}
            className="shrink-0 bg-white hover:bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200"
          >
            🚗 Cochera y Pet-Friendly
          </button>
        </div>

        {/* Input Bar */}
        <div className="bg-[#f0f2f5] p-3 border-t border-slate-200 flex items-center space-x-2">
          <input
            type="text"
            id="whatsapp-chat-input"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Escribe un mensaje al WhatsApp de Hotel Bolluk..."
            disabled={isLoading}
            className="flex-1 bg-white px-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#075e54]"
          />
          <button
            id="whatsapp-send-btn"
            type="button"
            onClick={() => sendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            className="bg-[#075e54] hover:bg-[#064d45] disabled:opacity-50 text-white p-2.5 rounded-xl shadow-sm transition-all"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {activePaymentOffer && (
        <PaymentModal
          isOpen={!!activePaymentOffer}
          onClose={() => setActivePaymentOffer(null)}
          offer={activePaymentOffer}
          guestData={guestData}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
