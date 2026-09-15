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
  UserCheck,
} from 'lucide-react';
import { ChatMessage, ReservationOffer, HotelConfig, AvailableOption, PendingConfirmation } from '../types';
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
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string | null>(null);
  const [selectedCheckIn, setSelectedCheckIn] = useState<string | null>(null);
  const [selectedCheckOut, setSelectedCheckOut] = useState<string | null>(null);
  const [selectedGuests, setSelectedGuests] = useState<number>(2);
  const [selectedRoomTypeName, setSelectedRoomTypeName] = useState<string>('');
  const [selectedRoomNumber, setSelectedRoomNumber] = useState<string>('');

  const [currentQueryCheckIn, setCurrentQueryCheckIn] = useState<string | null>(null);
  const [currentQueryCheckOut, setCurrentQueryCheckOut] = useState<string | null>(null);
  const [currentQueryGuests, setCurrentQueryGuests] = useState<number>(2);

  const [identifiedCustomer, setIdentifiedCustomer] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [awaitingGuestData, setAwaitingGuestData] = useState<boolean>(false);
  const [guestInputName, setGuestInputName] = useState<string>('');
  const [guestInputPhone, setGuestInputPhone] = useState<string>('');

  const [latestReservationId, setLatestReservationId] = useState<string | null>(null);
  const [latestReservationStatus, setLatestReservationStatus] = useState<string | null>(null);
  const [latestPaymentStatus, setLatestPaymentStatus] = useState<string | null>(null);

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

    // If waiting for guest contact data, intercept name and phone
    if (awaitingGuestData && !identifiedCustomer) {
      const digitsMatch = text.match(/(?:\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}|\d{7,14}/);
      if (digitsMatch) {
        const phone = digitsMatch[0].replace(/[^\d+]/g, '');
        const namePart = text.replace(digitsMatch[0], '').replace(/[,\-–:]/g, ' ').replace(/\s+/g, ' ').trim();
        const finalName = namePart.length >= 2 ? namePart : (guestInputName || 'Huésped Hotel Bolluk');
        await handleConfirmGuestData(finalName, phone);
        return;
      }
    }

    // Step 9E: Check if user typed CONFIRMAR DATOS or MODIFICAR
    const upperText = text.trim().toUpperCase();
    const lastPendingConfMsg = [...messages].reverse().find((m) => m.pendingConfirmation && !m.pendingConfirmation.actionTaken);
    if (lastPendingConfMsg?.pendingConfirmation) {
      if (upperText === 'CONFIRMAR DATOS') {
        await handleConfirmReservationData(lastPendingConfMsg.pendingConfirmation);
        return;
      }
      if (upperText === 'MODIFICAR') {
        handleModifyReservationData(lastPendingConfMsg.pendingConfirmation);
        return;
      }
    }

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

      if (data.checkIn) setCurrentQueryCheckIn(data.checkIn);
      if (data.checkOut) setCurrentQueryCheckOut(data.checkOut);
      if (data.guests) setCurrentQueryGuests(data.guests);

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
        availableOptions: Array.isArray(data.availableOptions) && data.availableOptions.length > 0
          ? data.availableOptions.slice(0, 3)
          : undefined,
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

  const handleConfirmReservationData = async (conf: PendingConfirmation) => {
    setIsLoading(true);
    try {
      // 3. Si el usuario elige CONFIRMAR DATOS:
      // actualizar la reserva mediante PATCH /api/reservations/:id
      // cambiando solamente: reservationStatus: AWAITING_PAYMENT, paymentStatus: PENDING
      const patchRes = await fetch(`/api/reservations/${conf.reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationStatus: 'AWAITING_PAYMENT',
          paymentStatus: 'PENDING',
        }),
      });

      const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (!patchRes.ok) {
        throw new Error('Error al actualizar reserva');
      }

      setLatestReservationStatus('AWAITING_PAYMENT');
      setLatestPaymentStatus('PENDING');

      setMessages((prev) =>
        prev.map((m) => {
          if (m.pendingConfirmation?.reservationId === conf.reservationId) {
            return {
              ...m,
              pendingConfirmation: {
                ...m.pendingConfirmation,
                actionTaken: 'confirmed',
                reservationStatus: 'AWAITING_PAYMENT',
                paymentStatus: 'PENDING',
              },
            };
          }
          return m;
        })
      );

      // 7. Después de actualizar correctamente, mostrar:
      // "Perfecto. Tu reserva quedó pendiente de pago."
      // 8. Mostrar claramente: Estado: Pendiente de pago
      // 4. NO marcarla como CONFIRMED.
      // 5. NO simular pago.
      // 6. NO mostrar mensajes como: pago aprobado, reserva confirmada, pago recibido.
      const confirmMsg: ChatMessage = {
        id: `bot-confirm-${Date.now()}`,
        sender: 'bot',
        text: `Perfecto. Tu reserva quedó pendiente de pago.\n\n` +
          `📋 **Estado de la Reserva**:\n` +
          `• Código: ${conf.reservationCode}\n` +
          `• Habitación: ${conf.roomTypeName} ${conf.roomNumber ? `(Hab. ${conf.roomNumber})` : ''}\n` +
          `• Estado: Pendiente de pago`,
        timestamp: botTime,
      };

      setMessages((prev) => [...prev, confirmMsg]);
    } catch (err) {
      console.error('Error confirming reservation data:', err);
      const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: 'No pude actualizar la reserva. Intentemos nuevamente.',
          timestamp: botTime,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModifyReservationData = (conf: PendingConfirmation) => {
    // 9. Si el usuario elige MODIFICAR: no cambiar el estado de la reserva. Mantenerla en PENDING.
    setMessages((prev) =>
      prev.map((m) => {
        if (m.pendingConfirmation?.reservationId === conf.reservationId) {
          return {
            ...m,
            pendingConfirmation: {
              ...m.pendingConfirmation,
              actionTaken: 'modified',
            },
          };
        }
        return m;
      })
    );

    const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const modMsg: ChatMessage = {
      id: `bot-mod-${Date.now()}`,
      sender: 'bot',
      text: `Entendido. Tu reserva (${conf.reservationCode}) se mantiene en estado **Pendiente**.\n\n¿Qué datos te gustaría modificar?`,
      timestamp: botTime,
    };
    setMessages((prev) => [...prev, modMsg]);
  };

  const createPendingReservation = async (
    customer: { id: string; name: string; phone: string },
    roomSelection?: {
      roomId: string;
      roomTypeId: string;
      checkIn: string;
      checkOut: string;
      guests: number;
      roomTypeName: string;
      roomNumber: string;
    }
  ) => {
    setIsLoading(true);
    const roomId = roomSelection?.roomId || selectedRoomId;
    const roomTypeId = roomSelection?.roomTypeId || selectedRoomTypeId;
    const checkIn = roomSelection?.checkIn || selectedCheckIn || '2026-09-20';
    const checkOut = roomSelection?.checkOut || selectedCheckOut || '2026-09-22';
    const guests = roomSelection?.guests || selectedGuests || 2;
    const roomTypeName = roomSelection?.roomTypeName || selectedRoomTypeName || 'Habitación';
    const roomNumber = roomSelection?.roomNumber || selectedRoomNumber || '';

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          selectedRoomTypeId: roomTypeId,
          selectedRoomId: roomId,
          selectedCheckIn: checkIn,
          selectedCheckOut: checkOut,
          selectedGuests: guests,
          reservationStatus: 'PENDING',
          paymentStatus: 'NOT_REQUIRED',
          source: 'CHAT',
        }),
      });

      const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (!res.ok) {
        // 8. Si ocurre un error al crear la reserva: no perder la selección del usuario
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-err-${Date.now()}`,
            sender: 'bot',
            text: 'No pude completar la reserva. Intentemos nuevamente.',
            timestamp: botTime,
          },
        ]);
        return;
      }

      const resData = await res.json();
      setAwaitingGuestData(false);

      setLatestReservationId(resData.id);
      setLatestReservationStatus('PENDING');
      setLatestPaymentStatus('NOT_REQUIRED');

      const totalAmountVal = resData.totalPrice || resData.totalAmount;
      const formattedTotal = totalAmountVal ? `$${Number(totalAmountVal).toLocaleString('es-AR')}` : '';

      // Step 9E: Resumen de confirmación con:
      // código de reserva, habitación, check-in, check-out, huéspedes, total si existe, estado actual
      const summaryText = `Perfecto, preparé tu reserva.\n\n` +
        `📋 **Resumen de Confirmación**:\n` +
        `• Código de reserva: ${resData.bookingId || resData.reservationCode}\n` +
        `• Habitación: ${roomTypeName} ${roomNumber ? `(Hab. ${roomNumber})` : ''}\n` +
        `• Check-in: ${resData.checkIn || checkIn}\n` +
        `• Check-out: ${resData.checkOut || checkOut}\n` +
        `• Huéspedes: ${resData.guests || guests}\n` +
        (formattedTotal ? `• Total: ${formattedTotal}\n` : '') +
        `• Estado: Pendiente\n\n` +
        `Por favor, confirma tus datos para continuar:`;

      const pendingConfirmation: PendingConfirmation = {
        reservationId: resData.id,
        reservationCode: resData.bookingId || resData.reservationCode,
        roomTypeName,
        roomNumber,
        checkIn: resData.checkIn || checkIn,
        checkOut: resData.checkOut || checkOut,
        guests: Number(resData.guests || guests),
        totalAmount: totalAmountVal ? Number(totalAmountVal) : undefined,
        reservationStatus: 'PENDING',
        paymentStatus: 'NOT_REQUIRED',
      };

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-pending-summary-${Date.now()}`,
          sender: 'bot',
          text: summaryText,
          timestamp: botTime,
          pendingConfirmation,
        },
      ]);
    } catch (err) {
      console.error('Error creating pending reservation:', err);
      const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: 'No pude completar la reserva. Intentemos nuevamente.',
          timestamp: botTime,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmGuestData = async (name: string, phone: string) => {
    if (!name.trim() || !phone.trim() || isLoading) return;

    setIsLoading(true);
    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: `${name.trim()} - Tel: ${phone.trim()}`,
      timestamp: userTime,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      // 3. Con nombre + teléfono: buscar cliente existente o crearlo
      const custRes = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
        }),
      });

      if (!custRes.ok) {
        throw new Error('Error al procesar cliente');
      }

      const { customer } = await custRes.json();
      setIdentifiedCustomer(customer);

      // 4. Luego crear una reserva real usando: POST /api/reservations
      await createPendingReservation(customer);
    } catch (err) {
      console.error('Error handling guest data:', err);
      const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: 'No pude completar la reserva. Intentemos nuevamente.',
          timestamp: botTime,
        },
      ]);
      setIsLoading(false);
    }
  };

  const handleSelectOption = (option: AvailableOption) => {
    const checkInVal = currentQueryCheckIn || '2026-09-20';
    const checkOutVal = currentQueryCheckOut || '2026-09-22';
    const guestsVal = currentQueryGuests || 2;

    // 1. Guardar en el estado del chat
    setSelectedRoomId(option.roomId);
    setSelectedRoomTypeId(option.roomTypeId);
    setSelectedCheckIn(checkInVal);
    setSelectedCheckOut(checkOutVal);
    setSelectedGuests(guestsVal);
    setSelectedRoomTypeName(option.roomTypeName);
    setSelectedRoomNumber(option.roomNumber);

    const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 2. Si todavía no existe un cliente identificado, pedir únicamente nombre y teléfono
    if (!identifiedCustomer) {
      setAwaitingGuestData(true);
      const promptMsg: ChatMessage = {
        id: `bot-prompt-${Date.now()}`,
        sender: 'bot',
        text: `Elegiste ${option.roomTypeName} - Hab. ${option.roomNumber}.\n\nPara preparar tu reserva, por favor indícame tu **nombre** y **teléfono**.`,
        timestamp: botTime,
      };
      setMessages((prev) => [...prev, promptMsg]);
    } else {
      createPendingReservation(identifiedCustomer, {
        roomId: option.roomId,
        roomTypeId: option.roomTypeId,
        checkIn: checkInVal,
        checkOut: checkOutVal,
        guests: guestsVal,
        roomTypeName: option.roomTypeName,
        roomNumber: option.roomNumber,
      });
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
        {/* Chat Selection State Inspector (Step 9C) */}
        <span
          className="hidden"
          data-testid="selected-room-state"
          data-room-id={selectedRoomId || ''}
          data-room-type-id={selectedRoomTypeId || ''}
        />
        {/* WhatsApp Top Bar */}
        <div className="bg-[#075e54] text-white px-4 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img
                src="/bollukito_avatar.jpg?v=5"
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

                {/* Available Options Cards (Step 9C) */}
                {msg.availableOptions && msg.availableOptions.length > 0 && (
                  <div className="mt-3 space-y-2.5 w-full max-w-full">
                    {msg.availableOptions.slice(0, 3).map((option) => {
                      const isSelected = selectedRoomId === option.roomId;
                      const formattedRate = Number(option.baseRate).toLocaleString('es-AR');
                      return (
                        <div
                          key={option.roomId}
                          data-testid={`available-option-${option.roomNumber}`}
                          className={`w-full box-border p-3.5 rounded-xl border text-xs transition-all ${
                            isSelected
                              ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400/40 shadow-xs'
                              : 'bg-slate-50/90 border-slate-200 hover:border-emerald-300 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-slate-900 text-sm leading-tight truncate">
                                {option.roomTypeName}
                              </div>
                              <div className="text-slate-600 font-semibold text-xs mt-0.5">
                                Hab. {option.roomNumber}
                              </div>
                              <div className="text-slate-500 text-xs mt-1">
                                Hasta {option.capacity} {option.capacity === 1 ? 'huésped' : 'huéspedes'}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-extrabold text-emerald-800 text-sm whitespace-nowrap">
                                ${formattedRate}
                              </div>
                              <div className="text-[11px] text-slate-500 whitespace-nowrap">
                                por noche
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            data-testid={`select-room-${option.roomNumber}`}
                            onClick={() => handleSelectOption(option)}
                            className={`w-full mt-3 py-2 px-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all shadow-2xs flex items-center justify-center space-x-1.5 ${
                              isSelected
                                ? 'bg-emerald-700 text-white'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.99]'
                            }`}
                          >
                            <span>{isSelected ? '✓ ELEGIDO' : 'ELEGIR'}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Step 9E: Resumen de confirmación con acciones CONFIRMAR DATOS / MODIFICAR */}
                {msg.pendingConfirmation && (
                  <div
                    data-testid="confirmation-card"
                    className="mt-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/90 text-xs space-y-2.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="font-bold text-slate-800 text-sm">Resumen de Confirmación</div>
                      <span
                        data-testid="confirmation-status-badge"
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                          msg.pendingConfirmation.actionTaken === 'confirmed'
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-blue-100 text-blue-800 border-blue-200'
                        }`}
                      >
                        {msg.pendingConfirmation.actionTaken === 'confirmed'
                          ? 'Pendiente de pago'
                          : 'Pendiente'}
                      </span>
                    </div>

                    <div className="space-y-1 text-slate-700 leading-snug">
                      <div>
                        <span className="font-semibold text-slate-900">Código de reserva:</span>{' '}
                        <span data-testid="conf-code">{msg.pendingConfirmation.reservationCode}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Habitación:</span>{' '}
                        {msg.pendingConfirmation.roomTypeName}{' '}
                        {msg.pendingConfirmation.roomNumber ? `(Hab. ${msg.pendingConfirmation.roomNumber})` : ''}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Check-in:</span>{' '}
                        {msg.pendingConfirmation.checkIn}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Check-out:</span>{' '}
                        {msg.pendingConfirmation.checkOut}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Huéspedes:</span>{' '}
                        {msg.pendingConfirmation.guests}
                      </div>
                      {msg.pendingConfirmation.totalAmount !== undefined && (
                        <div>
                          <span className="font-semibold text-slate-900">Total:</span>{' '}
                          ${Number(msg.pendingConfirmation.totalAmount).toLocaleString('es-AR')}
                        </div>
                      )}
                      <div>
                        <span className="font-semibold text-slate-900">Estado actual:</span>{' '}
                        <span data-testid="conf-status-text">
                          {msg.pendingConfirmation.actionTaken === 'confirmed'
                            ? 'Pendiente de pago'
                            : 'Pendiente'}
                        </span>
                      </div>
                    </div>

                    {!msg.pendingConfirmation.actionTaken && (
                      <div className="pt-2 flex flex-col sm:flex-row gap-2 border-t border-slate-200">
                        <button
                          type="button"
                          data-testid="btn-confirm-data"
                          onClick={() => handleConfirmReservationData(msg.pendingConfirmation!)}
                          disabled={isLoading}
                          className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs uppercase tracking-wide transition-colors shadow-xs text-center"
                        >
                          CONFIRMAR DATOS
                        </button>
                        <button
                          type="button"
                          data-testid="btn-modify-data"
                          onClick={() => handleModifyReservationData(msg.pendingConfirmation!)}
                          disabled={isLoading}
                          className="flex-1 py-2 px-3 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-800 font-semibold rounded-lg text-xs uppercase tracking-wide transition-colors text-center"
                        >
                          MODIFICAR
                        </button>
                      </div>
                    )}
                  </div>
                )}

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

          {/* Customer Input Card if awaiting guest data */}
          {awaitingGuestData && !identifiedCustomer && (
            <div className="flex flex-col items-start">
              <div className="bg-white rounded-2xl rounded-tl-none p-4 shadow-sm border border-emerald-200 max-w-[85%] sm:max-w-[75%] space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-emerald-900 border-b border-emerald-100 pb-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>Datos de contacto del huésped</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Nombre completo</label>
                    <input
                      type="text"
                      id="guest-name-input"
                      placeholder="Ej: Juan Pérez"
                      value={guestInputName}
                      onChange={(e) => setGuestInputName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Teléfono de contacto</label>
                    <input
                      type="tel"
                      id="guest-phone-input"
                      placeholder="Ej: +54 9 11 5544-3322"
                      value={guestInputPhone}
                      onChange={(e) => setGuestInputPhone(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  id="btn-confirm-guest"
                  onClick={() => handleConfirmGuestData(guestInputName, guestInputPhone)}
                  disabled={!guestInputName.trim() || !guestInputPhone.trim() || isLoading}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg font-bold text-xs shadow-xs transition-colors"
                >
                  Continuar con la Reserva
                </button>
              </div>
            </div>
          )}

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

        {/* Hidden test span to verify state */}
        <span
          className="hidden"
          data-testid="selected-room-state"
          data-room-id={selectedRoomId || ''}
          data-room-type-id={selectedRoomTypeId || ''}
          data-check-in={selectedCheckIn || ''}
          data-check-out={selectedCheckOut || ''}
          data-guests={selectedGuests?.toString() || ''}
          data-customer-id={identifiedCustomer?.id || ''}
          data-latest-reservation-id={latestReservationId || ''}
          data-latest-reservation-status={latestReservationStatus || ''}
          data-latest-payment-status={latestPaymentStatus || ''}
        />

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
