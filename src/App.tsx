import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { WhatsAppSimulator } from './components/WhatsAppSimulator';
import { ReceptionistDashboard } from './components/ReceptionistDashboard';
import { HotelConfigPanel } from './components/HotelConfigPanel';
import { FixedBollukitoAssistant } from './components/FixedBollukitoAssistant';
import { ConfirmedReservation, HotelConfig } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'reception' | 'config'>('chat');
  const [reservations, setReservations] = useState<ConfirmedReservation[]>([]);
  const [hotelConfig, setHotelConfig] = useState<HotelConfig>({
    hotelName: 'Hotel Bolluk',
    mascotName: 'Bollukito',
    mascotRole: 'Conserje Virtual y Anfitrión 🐾🛎️',
    receptionistPhone: '+54 9 11 4055-7788',
    doubleRoomPrice: 43,
    tripleRoomPrice: 62,
    checkInTime: '14:00',
    checkOutTime: '10:00',
    breakfastHours: '07:30 a 10:30',
    address: 'Av. Costanera 1420, Hotel Bolluk',
    parkingAvailable: true,
    petFriendly: true,
    wifiName: 'HotelBolluk_Huespedes',
    knowledgeBase: [
      {
        id: 'kb-1',
        topic: '¿Aceptan mascotas y cobran suplemento? (Pet-Friendly)',
        answer: '¡Somos 100% Pet-Friendly sin ningún cargo extra! A Bollukito le encanta recibir a sus amiguitos peludos. Proveemos recipientes para agua y camitas bajo petición.',
      },
      {
        id: 'kb-2',
        topic: '¿Cómo es la cochera o estacionamiento?',
        answer: 'Contamos con estacionamiento cubierto y cerrado con portón automático y cámaras de seguridad dentro del predio del Hotel Bolluk. Es 100% gratuito para todos nuestros huéspedes.',
      },
      {
        id: 'kb-3',
        topic: '¿Tienen opciones para celíacos (sin TACC) o veganos en el desayuno?',
        answer: '¡Sí! Nuestro desayuno buffet incluye panificados y galletas cerradas sin TACC, mermeladas aptas y leches vegetales (de almendra/soja). Por favor avísanos al hacer check-in para tener todo listo.',
      },
      {
        id: 'kb-4',
        topic: '¿A qué distancia están del centro y de la playa?',
        answer: 'Estamos en Av. Costanera 1420, a solo 2 cuadras de la playa y a 5 minutos a pie de los mejores restaurantes y centro comercial de la ciudad.',
      },
      {
        id: 'kb-5',
        topic: '¿Tienen cunas para bebés o niños pequeños?',
        answer: 'Sí, disponemos de practicunas/cunas gratuitas para bebés de hasta 2 años en todas las habitaciones bajo petición previa.',
      },
      {
        id: 'kb-6',
        topic: '¿Se puede hacer Early Check-in o Late Check-out?',
        answer: 'El horario habitual es check-in a las 14:00 y check-out a las 10:00. Si llegas antes o sales después, custodiamos tu equipaje sin costo para que disfrutes tu día. El ingreso anticipado a la habitación depende de la disponibilidad.',
      },
    ],
  });

  // Fetch initial reservations from server
  useEffect(() => {
    fetch('/api/reservations')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setReservations(data);
        }
      })
      .catch((err) => console.error('Error loading reservations:', err));
  }, []);

  const handleNewReservation = (newRes: ConfirmedReservation) => {
    setReservations((prev) => [newRes, ...prev]);
  };

  const handleToggleLoadedInSystem = async (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    // Optimistic update
    setReservations((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              loadedInHotelSystem: nextStatus,
              loadedAt: nextStatus ? new Date().toISOString() : undefined,
            }
          : r
      )
    );

    try {
      await fetch(`/api/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loadedInHotelSystem: nextStatus }),
      });
    } catch (e) {
      console.error('Failed to update loaded status:', e);
    }
  };

  const pendingCount = reservations.filter((r) => !r.loadedInHotelSystem).length;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingCount={pendingCount}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'chat' && (
          <WhatsAppSimulator
            hotelConfig={hotelConfig}
            onNewConfirmedReservation={handleNewReservation}
          />
        )}

        {activeTab === 'reception' && (
          <ReceptionistDashboard
            reservations={reservations}
            hotelConfig={hotelConfig}
            onToggleLoadedInSystem={handleToggleLoadedInSystem}
          />
        )}

        {activeTab === 'config' && (
          <HotelConfigPanel
            config={hotelConfig}
            onSaveConfig={setHotelConfig}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-4 px-6 text-center text-xs text-slate-400">
        <p>
          <strong>Hotel Bolluk</strong> • Sistema Inteligente de Reservas Directas WhatsApp con <strong>Bollukito 🐾🛎️</strong> • Sin comisiones a intermediarios
        </p>
      </footer>

      {/* Bollukito 3D Asistente Virtual fijo a la derecha de la pantalla */}
      <FixedBollukitoAssistant
        hotelName={hotelConfig.hotelName}
        phoneNumber="223 518 9254"
      />
    </div>
  );
}
