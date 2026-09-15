import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import {
  getAllReservationsWithDetails,
  createReservation,
  updateReservation,
  getReservationById,
  getReservationByCode,
  getReservationWithDetails,
  generateReservationCode,
  getTodayReservations,
  countTodayCheckIns,
  countTodayCheckOuts,
  countPendingReservations,
  countConfirmedReservations,
  countCancelledReservations,
  getReceptionSummary,
  getTodayReceptionReservations,
} from './src/db/reservations.ts';
export {
  getTodayReservations,
  countTodayCheckIns,
  countTodayCheckOuts,
  countPendingReservations,
  countConfirmedReservations,
  countCancelledReservations,
  getReceptionSummary,
  getTodayReceptionReservations,
};
import { getHotels, getHotelById } from './src/db/hotels.ts';
import { getHotelConfigByHotel, updateHotelConfig, createHotelConfig } from './src/db/hotel-config.ts';
import { getCustomersByHotel, getCustomerById, getCustomerByPhone, createCustomer } from './src/db/customers.ts';
import { getRoomTypesByHotel, getRoomTypeById, createRoomType, updateRoomType } from './src/db/room-types.ts';
import { getRoomById, getRoomsByHotel, createRoom, updateRoom, getAvailableRooms, isRoomAvailable, getFirstAvailableRoomByType } from './src/db/rooms.ts';
import {
  getConversationsByHotel,
  updateConversationStatus,
  getConversationByPhone,
  createConversation,
} from './src/db/conversations.ts';
import { getMessagesByConversation, createMessage } from './src/db/messages.ts';
import { parseAvailabilityIntent, handleChatAvailability } from './src/services/chat-availability.ts';
import {
  PaymentService,
  MercadoPagoPaymentService,
  createPaymentPreference,
  type PaymentPreferenceInput,
} from './src/services/payment.service.ts';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ limit: '60mb', extended: true }));

// TypeScript type for frontend reservation response format
interface ReservationRecord {
  id: string;
  bookingId: string;
  guestName: string;
  guestDoc: string;
  guestPhone: string;
  roomType: 'Doble' | 'Triple';
  guests: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalPrice: number;
  currency: string;
  paymentRef: string;
  paymentMethod: string;
  paidAt: string;
  loadedInHotelSystem: boolean;
  loadedAt?: string;
  receptionistNotified: boolean;
}

// Lazy Gemini AI initialization
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// API Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hotel: 'Hotel Bolluk', mascot: 'Bollukito' });
});

// Helper to get Bolluk Hotel
async function getBollukHotel() {
  const hotels = await getHotels();
  return hotels.find((h) => h.name.includes('Bolluk')) || hotels[0] || null;
}

// API Get Hotel Config from PostgreSQL
app.get('/api/hotel-config', async (req, res) => {
  try {
    const hotel = await getBollukHotel();
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel no encontrado en la base de datos' });
    }

    const config = await getHotelConfigByHotel(hotel.id);
    if (!config) {
      return res.status(404).json({ error: 'Configuración no encontrada para el hotel' });
    }

    res.json(config);
  } catch (err: any) {
    console.error('Error fetching hotel config:', err);
    res.status(500).json({ error: 'Error al obtener configuración de hotel en PostgreSQL', details: err?.message });
  }
});

// API Get Reception Summary from PostgreSQL
app.get('/api/reception-summary', async (req, res) => {
  try {
    const hotel = await getBollukHotel();
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel no encontrado en la base de datos' });
    }

    const summary = await getReceptionSummary(hotel.id);
    return res.status(200).json(summary);
  } catch (err: any) {
    console.error('Error fetching reception summary:', err);
    return res.status(500).json({ error: 'Error al obtener resumen de recepción en PostgreSQL', details: err?.message });
  }
});

// API Get Today Reception Reservations from PostgreSQL
app.get('/api/reception-reservations-today', async (req, res) => {
  try {
    const hotel = await getBollukHotel();
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel no encontrado en la base de datos' });
    }

    const reservations = await getTodayReceptionReservations(hotel.id);
    return res.status(200).json(reservations);
  } catch (err: any) {
    console.error('Error fetching today reception reservations:', err);
    return res.status(500).json({
      error: 'Error al obtener reservas del día en PostgreSQL',
      details: err?.message,
    });
  }
});

// API Get Conversations from PostgreSQL
app.get('/api/conversations', async (req, res) => {
  try {
    const hotel = await getBollukHotel();
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel no encontrado en la base de datos' });
    }

    const conversations = await getConversationsByHotel(hotel.id);
    res.json(conversations);
  } catch (err: any) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: 'Error al obtener conversaciones en PostgreSQL', details: err?.message });
  }
});

// API Update Conversation Status in PostgreSQL
app.patch('/api/conversations/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: 'id y status son obligatorios' });
    }
    const updated = await updateConversationStatus(id, status);
    if (!updated) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }
    res.json(updated);
  } catch (err: any) {
    console.error('Error updating conversation status:', err);
    res.status(500).json({ error: 'Error al actualizar status de conversación en PostgreSQL', details: err?.message });
  }
});

app.post('/api/conversations/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: 'id y status son obligatorios' });
    }
    const updated = await updateConversationStatus(id, status);
    if (!updated) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }
    res.json(updated);
  } catch (err: any) {
    console.error('Error updating conversation status:', err);
    res.status(500).json({ error: 'Error al actualizar status de conversación en PostgreSQL', details: err?.message });
  }
});

// API Get Messages by Conversation from PostgreSQL
app.get('/api/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'El id de conversación es obligatorio' });
    }
    const messages = await getMessagesByConversation(id);
    res.json(messages);
  } catch (err: any) {
    console.error('Error fetching messages by conversation:', err);
    res.status(500).json({ error: 'Error al obtener mensajes en PostgreSQL', details: err?.message });
  }
});

// API Create Message in PostgreSQL
app.post('/api/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { senderType, content } = req.body;
    if (!id || !content || !content.trim()) {
      return res.status(400).json({ error: 'conversationId y content son obligatorios' });
    }
    const message = await createMessage({
      conversationId: id,
      senderType: senderType || 'HUMAN',
      content: content.trim(),
    });
    res.status(201).json(message);
  } catch (err: any) {
    console.error('Error creating message in PostgreSQL:', err);
    res.status(500).json({ error: 'Error al guardar mensaje en PostgreSQL', details: err?.message });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const conversationId = (req.query.conversationId || req.query.conversation_id) as string;
    if (!conversationId) {
      return res.status(400).json({ error: 'El parámetro conversationId es obligatorio' });
    }
    const messages = await getMessagesByConversation(conversationId);
    res.json(messages);
  } catch (err: any) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Error al obtener mensajes en PostgreSQL', details: err?.message });
  }
});

// API Get Availability from PostgreSQL
app.get('/api/availability', async (req, res) => {
  try {
    const { checkIn, checkOut, guests } = req.query;

    if (!checkIn || !checkOut || guests === undefined || guests === '') {
      return res.status(400).json({
        error: 'Los parámetros checkIn, checkOut y guests son obligatorios',
      });
    }

    const numGuests = Number(guests);
    if (isNaN(numGuests) || numGuests <= 0 || !Number.isInteger(numGuests)) {
      return res.status(400).json({
        error: 'El parámetro guests debe ser un número entero mayor a 0',
      });
    }

    const checkInDate = new Date(checkIn as string);
    const checkOutDate = new Date(checkOut as string);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return res.status(400).json({
        error: 'Las fechas checkIn o checkOut no son válidas',
      });
    }

    if (checkOutDate <= checkInDate) {
      return res.status(400).json({
        error: 'checkOut debe ser posterior a checkIn',
      });
    }

    const hotel = await getBollukHotel();
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel no encontrado en la base de datos' });
    }

    const availableRooms = await getAvailableRooms(hotel.id, checkInDate, checkOutDate, numGuests);

    const formattedRooms = availableRooms.map((r) => ({
      roomId: r.id,
      roomNumber: r.number,
      roomTypeId: r.roomTypeId,
      roomTypeName: r.roomType?.name || '',
      capacity: r.roomType?.capacity || 0,
      baseRate: Number(r.roomType?.baseRate) || 0,
    }));

    res.json({
      checkIn: String(checkIn),
      checkOut: String(checkOut),
      guests: numGuests,
      availableRooms: formattedRooms,
    });
  } catch (err: any) {
    console.error('Error checking availability:', err);
    res.status(500).json({
      error: 'Error al verificar disponibilidad en PostgreSQL',
      details: err?.message,
    });
  }
});

// ==========================================
// INVENTARIO REAL: ROOM TYPES & ROOMS API
// ==========================================

// GET /api/room-types
app.get('/api/room-types', async (req, res) => {
  try {
    const hotel = await getBollukHotel();
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel no encontrado en la base de datos' });
    }
    const types = await getRoomTypesByHotel(hotel.id);
    res.json(types);
  } catch (err: any) {
    console.error('Error fetching room types:', err);
    res.status(500).json({ error: 'Error al obtener tipos de habitación', details: err?.message });
  }
});

// POST /api/room-types
app.post('/api/room-types', async (req, res) => {
  try {
    const hotel = await getBollukHotel();
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel no encontrado en la base de datos' });
    }
    const { name, description, capacity, baseRate, active } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'El nombre del tipo de habitación es obligatorio' });
    }
    const parsedCapacity = Number(capacity);
    if (isNaN(parsedCapacity) || parsedCapacity < 1) {
      return res.status(400).json({ error: 'La capacidad debe ser un número mayor a 0' });
    }
    const parsedBaseRate = Number(baseRate);
    if (isNaN(parsedBaseRate) || parsedBaseRate < 0) {
      return res.status(400).json({ error: 'La tarifa base debe ser un número igual o mayor a 0' });
    }

    const created = await createRoomType({
      hotelId: hotel.id,
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      capacity: parsedCapacity,
      baseRate: parsedBaseRate.toFixed(2),
      active: active !== undefined ? Boolean(active) : true,
    });

    res.status(201).json(created);
  } catch (err: any) {
    console.error('Error creating room type:', err);
    res.status(500).json({ error: 'Error al crear tipo de habitación', details: err?.message });
  }
});

// PATCH /api/room-types/:id
app.patch('/api/room-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, capacity, baseRate, active } = req.body;

    const existing = await getRoomTypeById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Tipo de habitación no encontrado' });
    }

    const updates: any = {};
    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
      updates.name = String(name).trim();
    }
    if (description !== undefined) {
      updates.description = description ? String(description).trim() : null;
    }
    if (capacity !== undefined) {
      const parsedCapacity = Number(capacity);
      if (isNaN(parsedCapacity) || parsedCapacity < 1) {
        return res.status(400).json({ error: 'La capacidad debe ser mayor a 0' });
      }
      updates.capacity = parsedCapacity;
    }
    if (baseRate !== undefined) {
      const parsedBaseRate = Number(baseRate);
      if (isNaN(parsedBaseRate) || parsedBaseRate < 0) {
        return res.status(400).json({ error: 'La tarifa base debe ser igual o mayor a 0' });
      }
      updates.baseRate = parsedBaseRate.toFixed(2);
    }
    if (active !== undefined) {
      updates.active = Boolean(active);
    }

    const updated = await updateRoomType(id, updates);
    res.json(updated);
  } catch (err: any) {
    console.error('Error updating room type:', err);
    res.status(500).json({ error: 'Error al actualizar tipo de habitación', details: err?.message });
  }
});

// GET /api/rooms
app.get('/api/rooms', async (req, res) => {
  try {
    const hotel = await getBollukHotel();
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel no encontrado en la base de datos' });
    }
    const hotelRooms = await getRoomsByHotel(hotel.id);
    const hotelRoomTypes = await getRoomTypesByHotel(hotel.id);
    const roomTypeMap = new Map(hotelRoomTypes.map((rt) => [rt.id, rt]));

    const enriched = hotelRooms.map((r) => ({
      ...r,
      roomType: roomTypeMap.get(r.roomTypeId) || null,
    }));

    res.json(enriched);
  } catch (err: any) {
    console.error('Error fetching rooms:', err);
    res.status(500).json({ error: 'Error al obtener habitaciones', details: err?.message });
  }
});

// POST /api/rooms
app.post('/api/rooms', async (req, res) => {
  try {
    const hotel = await getBollukHotel();
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel no encontrado en la base de datos' });
    }
    const { number, roomTypeId, status, active } = req.body;
    if (!number || !String(number).trim()) {
      return res.status(400).json({ error: 'El número/nombre de la habitación es obligatorio' });
    }
    if (!roomTypeId) {
      return res.status(400).json({ error: 'El roomTypeId es obligatorio' });
    }

    const roomType = await getRoomTypeById(roomTypeId);
    if (!roomType || roomType.hotelId !== hotel.id) {
      return res.status(400).json({ error: 'El tipo de habitación no es válido para este hotel' });
    }

    const validStatuses = ['AVAILABLE', 'OCCUPIED', 'BLOCKED', 'MAINTENANCE'];
    const roomStatus = status || 'AVAILABLE';
    if (!validStatuses.includes(roomStatus)) {
      return res.status(400).json({
        error: `Estado inválido. Los estados permitidos son: ${validStatuses.join(', ')}`,
      });
    }

    const created = await createRoom({
      hotelId: hotel.id,
      roomTypeId,
      number: String(number).trim(),
      status: roomStatus as any,
      active: active !== undefined ? Boolean(active) : true,
    });

    res.status(201).json(created);
  } catch (err: any) {
    console.error('Error creating room:', err);
    res.status(500).json({ error: 'Error al crear habitación', details: err?.message });
  }
});

// PATCH /api/rooms/:id
app.patch('/api/rooms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { number, roomTypeId, status, active } = req.body;

    const existing = await getRoomById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Habitación no encontrada' });
    }

    const updates: any = {};
    if (number !== undefined) {
      if (!String(number).trim()) return res.status(400).json({ error: 'El número/nombre no puede estar vacío' });
      updates.number = String(number).trim();
    }
    if (roomTypeId !== undefined) {
      const rt = await getRoomTypeById(roomTypeId);
      if (!rt) return res.status(400).json({ error: 'Tipo de habitación inexistente' });
      updates.roomTypeId = roomTypeId;
    }
    if (status !== undefined) {
      const validStatuses = ['AVAILABLE', 'OCCUPIED', 'BLOCKED', 'MAINTENANCE'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: `Estado inválido. Los estados permitidos son: ${validStatuses.join(', ')}`,
        });
      }
      updates.status = status;
    }
    if (active !== undefined) {
      updates.active = Boolean(active);
    }

    const updated = await updateRoom(id, updates);
    res.json(updated);
  } catch (err: any) {
    console.error('Error updating room:', err);
    res.status(500).json({ error: 'Error al actualizar habitación', details: err?.message });
  }
});

// API Update Hotel Config in PostgreSQL (PATCH)
app.patch('/api/hotel-config', async (req, res) => {
  try {
    const hotel = await getBollukHotel();
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel no encontrado en la base de datos' });
    }

    const ALLOWED_FIELDS = [
      'checkInTime',
      'checkOutTime',
      'breakfastInfo',
      'parkingInfo',
      'petPolicy',
      'cancellationPolicy',
      'depositPolicy',
      'services',
    ];

    const bodyKeys = Object.keys(req.body || {});
    const invalidFields = bodyKeys.filter((key) => !ALLOWED_FIELDS.includes(key));
    if (invalidFields.length > 0) {
      return res.status(400).json({
        error: `Campos no permitidos: ${invalidFields.join(', ')}`,
        allowedFields: ALLOWED_FIELDS,
      });
    }

    const updates: Record<string, any> = {};
    for (const field of ALLOWED_FIELDS) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No se enviaron campos válidos para actualizar' });
    }

    const updated = await updateHotelConfig(hotel.id, updates);
    if (!updated) {
      return res.status(404).json({ error: 'Configuración no encontrada para actualizar' });
    }

    res.json(updated);
  } catch (err: any) {
    console.error('Error updating hotel config with PATCH:', err);
    res.status(500).json({ error: 'Error al actualizar configuración de hotel en PostgreSQL', details: err?.message });
  }
});

// API Update Hotel Config in PostgreSQL (PUT)
app.put('/api/hotel-config', async (req, res) => {
  try {
    const hotel = await getBollukHotel();
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel no encontrado en la base de datos' });
    }

    const {
      checkInTime,
      checkOutTime,
      breakfastInfo,
      parkingInfo,
      petPolicy,
      cancellationPolicy,
      depositPolicy,
      services,
    } = req.body;

    const updates: Record<string, any> = {};
    if (checkInTime !== undefined) updates.checkInTime = checkInTime;
    if (checkOutTime !== undefined) updates.checkOutTime = checkOutTime;
    if (breakfastInfo !== undefined) updates.breakfastInfo = breakfastInfo;
    if (parkingInfo !== undefined) updates.parkingInfo = parkingInfo;
    if (petPolicy !== undefined) updates.petPolicy = petPolicy;
    if (cancellationPolicy !== undefined) updates.cancellationPolicy = cancellationPolicy;
    if (depositPolicy !== undefined) updates.depositPolicy = depositPolicy;
    if (services !== undefined) updates.services = services;

    let updated = await updateHotelConfig(hotel.id, updates);
    if (!updated) {
      // If config row didn't exist yet, insert it
      updated = await createHotelConfig({
        hotelId: hotel.id,
        checkInTime: checkInTime || '14:00',
        checkOutTime: checkOutTime || '10:00',
        breakfastInfo: breakfastInfo || 'Desayuno de 07:30 a 10:30',
        parkingInfo: parkingInfo || 'Estacionamiento disponible',
        petPolicy: petPolicy || 'Consultar condiciones',
        cancellationPolicy: cancellationPolicy || 'Política pendiente de configuración final',
        depositPolicy: depositPolicy || 'Seña pendiente de configuración final',
        services: services || 'WiFi',
      });
    }

    res.json(updated);
  } catch (err: any) {
    console.error('Error updating hotel config:', err);
    res.status(500).json({ error: 'Error al actualizar configuración de hotel en PostgreSQL', details: err?.message });
  }
});

// API Get Reservations from PostgreSQL
app.get('/api/reservations', async (req, res) => {
  try {
    const dbReservations = await getAllReservationsWithDetails();
    const formatted: ReservationRecord[] = dbReservations.map((row) => {
      const checkInDate = new Date(row.reservation.checkIn);
      const checkOutDate = new Date(row.reservation.checkOut);
      const diffMs = checkOutDate.getTime() - checkInDate.getTime();
      const nights = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

      const isTriple = row.roomType.name.toLowerCase().includes('triple');
      const roomType: 'Doble' | 'Triple' = isTriple ? 'Triple' : 'Doble';

      return {
        id: row.reservation.id,
        bookingId: row.reservation.reservationCode,
        reservationCode: row.reservation.reservationCode,
        guestName: row.customer.name,
        guestDoc: row.customer.document || 'S/D',
        guestPhone: row.customer.phone || '',
        roomType,
        guests: Number(row.reservation.guests) || 2,
        checkIn: checkInDate.toISOString().split('T')[0],
        checkOut: checkOutDate.toISOString().split('T')[0],
        nights,
        totalPrice: Number(row.reservation.totalAmount) || 0,
        currency: 'US$',
        paymentRef: row.reservation.notes || `REF-${row.reservation.reservationCode}`,
        paymentMethod: row.reservation.source === 'DIRECT' ? 'Directo (PostgreSQL)' : 'Mercado Pago (Tarjeta)',
        paidAt: new Date(row.reservation.createdAt).toISOString(),
        loadedInHotelSystem: row.reservation.reservationStatus === 'CONFIRMED',
        loadedAt: undefined,
        receptionistNotified: true,
        hotelId: row.reservation.hotelId,
        customerId: row.reservation.customerId,
        roomTypeId: row.reservation.roomTypeId,
        roomId: row.reservation.roomId,
        reservationStatus: row.reservation.reservationStatus,
        paymentStatus: row.reservation.paymentStatus,
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching reservations from PostgreSQL:', err);
    res.status(500).json({ error: 'Error al obtener reservas de PostgreSQL' });
  }
});

// API Get Single Reservation
app.get('/api/reservations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let reservation = null;
    if (isValidUUID(id)) {
      reservation = await getReservationById(id);
    }
    if (!reservation) {
      reservation = await getReservationByCode(id);
    }
    if (!reservation) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }
    res.json(reservation);
  } catch (err) {
    console.error('Error fetching single reservation:', err);
    res.status(500).json({ error: 'Error al obtener reserva' });
  }
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUUID(str: unknown): str is string {
  return typeof str === 'string' && UUID_REGEX.test(str);
}

const ALLOWED_RESERVATION_STATUSES = [
  'PENDING',
  'AWAITING_PAYMENT',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'NO_SHOW',
];
const ALLOWED_PAYMENT_STATUSES = ['NOT_REQUIRED', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'];

// API Find or Create Customer
app.post('/api/customers', async (req, res) => {
  try {
    const { hotelId: reqHotelId, name, phone, email, document } = req.body || {};
    if (!name || !phone) {
      return res.status(400).json({ error: 'Nombre y teléfono son requeridos' });
    }

    let hotelId = reqHotelId;
    if (!hotelId) {
      const hotels = await getHotels();
      hotelId = hotels[0]?.id;
    }

    const trimmedPhone = String(phone).trim();
    const trimmedName = String(name).trim();

    let existingCustomer = await getCustomerByPhone(hotelId, trimmedPhone);
    if (!existingCustomer) {
      existingCustomer = await getCustomerByPhone(trimmedPhone);
    }

    if (existingCustomer) {
      return res.json({
        customer: existingCustomer,
        reused: true,
      });
    }

    const newCustomer = await createCustomer({
      hotelId,
      name: trimmedName,
      phone: trimmedPhone,
      email: email ? String(email).trim() : null,
      document: document ? String(document).trim() : null,
    });

    return res.status(201).json({
      customer: newCustomer,
      reused: false,
    });
  } catch (err: any) {
    console.error('Error in POST /api/customers:', err);
    res.status(500).json({ error: 'Error al procesar el cliente', details: err?.message });
  }
});

// API Create Confirmed Reservation in PostgreSQL
app.post('/api/reservations', async (req, res) => {
  try {
    const data = req.body || {};

    // 1. Resolve & Validate hotelId
    let hotelId = data.hotelId;
    if (hotelId !== undefined && hotelId !== null && hotelId !== '') {
      if (!isValidUUID(hotelId)) {
        return res.status(400).json({ error: 'hotelId inválido (debe ser un UUID válido)' });
      }
      const hotel = await getHotelById(hotelId);
      if (!hotel) {
        return res.status(400).json({ error: 'hotelId no existe en la base de datos' });
      }
    } else {
      // Fallback for frontend simulator if hotelId is not explicitly sent
      const hotelsList = await getHotels();
      const defaultHotel = hotelsList.find((h) => h.name === 'Hotel Bolluk') || hotelsList[0];
      if (!defaultHotel) {
        return res.status(500).json({ error: 'No se encontró ningún hotel registrado en la base de datos' });
      }
      hotelId = defaultHotel.id;
    }

    // 2. Resolve & Validate customerId
    let customerId = data.customerId;
    if (customerId !== undefined && customerId !== null && customerId !== '') {
      if (!isValidUUID(customerId)) {
        return res.status(400).json({ error: 'customerId inválido (debe ser un UUID válido)' });
      }
      const customer = await getCustomerById(customerId);
      if (!customer) {
        return res.status(400).json({ error: 'customerId no existe en la base de datos' });
      }
    } else {
      // If customerId is not passed, resolve or create customer from guest data (frontend)
      const guestName = (data.guestName || '').trim();
      const guestPhone = (data.guestPhone || '').trim();
      if (!guestName && !guestPhone) {
        return res.status(400).json({ error: 'customerId es requerido o debe indicarse guestName' });
      }
      let existingCustomer = guestPhone ? await getCustomerByPhone(hotelId, guestPhone) : null;
      if (!existingCustomer && guestName) {
        const customersInHotel = await getCustomersByHotel(hotelId);
        existingCustomer = customersInHotel.find((c) => c.name.toLowerCase() === guestName.toLowerCase()) || null;
      }
      if (!existingCustomer) {
        existingCustomer = await createCustomer({
          hotelId,
          name: guestName || 'Huésped Hotel Bolluk',
          phone: guestPhone || '2230000000',
          document: data.guestDoc || null,
        });
      }
      customerId = existingCustomer.id;
    }

    // 3. Resolve & Validate roomTypeId
    let roomTypeId = data.roomTypeId || data.selectedRoomTypeId;
    if (roomTypeId !== undefined && roomTypeId !== null && roomTypeId !== '') {
      if (!isValidUUID(roomTypeId)) {
        return res.status(400).json({ error: 'roomTypeId inválido (debe ser un UUID válido)' });
      }
      const roomType = await getRoomTypeById(roomTypeId);
      if (!roomType) {
        return res.status(400).json({ error: 'roomTypeId no existe en la base de datos' });
      }
    } else {
      const roomTypesList = await getRoomTypesByHotel(hotelId);
      const requestedName = (data.roomType || 'Doble').toLowerCase();
      const matched = roomTypesList.find((rt) => rt.name.toLowerCase().includes(requestedName)) || roomTypesList[0];
      if (!matched) {
        return res.status(400).json({ error: 'No se encontró un roomType para este hotel' });
      }
      roomTypeId = matched.id;
    }

    // 4. Validate roomId if provided
    let roomId = data.roomId !== undefined ? data.roomId : data.selectedRoomId;
    if (roomId !== undefined && roomId !== null && roomId !== '') {
      if (!isValidUUID(roomId)) {
        return res.status(400).json({ error: 'roomId inválido (debe ser un UUID válido)' });
      }
      const room = await getRoomById(roomId);
      if (!room) {
        return res.status(400).json({ error: 'roomId no existe en la base de datos' });
      }
    } else {
      roomId = null;
    }

    // 5. Validate checkIn and checkOut (checkOut > checkIn)
    const checkInRaw = data.checkIn || data.selectedCheckIn;
    const checkOutRaw = data.checkOut || data.selectedCheckOut;
    if (!checkInRaw) {
      return res.status(400).json({ error: 'checkIn es requerido' });
    }
    if (!checkOutRaw) {
      return res.status(400).json({ error: 'checkOut es requerido' });
    }
    const checkIn = new Date(checkInRaw);
    const checkOut = new Date(checkOutRaw);
    if (isNaN(checkIn.getTime())) {
      return res.status(400).json({ error: 'checkIn debe ser una fecha válida' });
    }
    if (isNaN(checkOut.getTime())) {
      return res.status(400).json({ error: 'checkOut debe ser una fecha válida' });
    }
    if (checkOut.getTime() <= checkIn.getTime()) {
      return res.status(400).json({ error: 'checkOut debe ser posterior a checkIn' });
    }

    // 6. Validate guests > 0
    const guestsRaw = data.guests !== undefined ? data.guests : data.selectedGuests;
    if (guestsRaw === undefined || guestsRaw === null || guestsRaw === '') {
      return res.status(400).json({ error: 'guests es requerido' });
    }
    const guests = Number(guestsRaw);
    if (isNaN(guests) || guests <= 0 || !Number.isInteger(guests)) {
      return res.status(400).json({ error: 'guests debe ser un número entero mayor a 0' });
    }

    // 6.5. Si el request incluye roomId, verificar disponibilidad. Si no incluye roomId pero sí roomTypeId, auto-asignar habitación disponible
    if (roomId) {
      const available = await isRoomAvailable(roomId, checkIn, checkOut, guests);
      if (!available) {
        return res.status(409).json({
          error: 'ROOM_NOT_AVAILABLE',
          message: 'La habitación seleccionada ya no está disponible para esas fechas.',
        });
      }
    } else if (roomTypeId) {
      const availableRoom = await getFirstAvailableRoomByType(
        hotelId,
        roomTypeId,
        checkIn,
        checkOut,
        guests
      );
      if (!availableRoom) {
        return res.status(409).json({
          error: 'ROOM_TYPE_NOT_AVAILABLE',
          message: 'No hay habitaciones disponibles de este tipo para las fechas seleccionadas.',
        });
      }
      roomId = availableRoom.id;
    }

    // 7. Validate totalAmount >= 0 (auto-calculate if not sent)
    let totalAmountRaw = data.totalAmount !== undefined ? data.totalAmount : data.totalPrice;
    if (totalAmountRaw === undefined || totalAmountRaw === null || totalAmountRaw === '') {
      const roomTypeObj = await getRoomTypeById(roomTypeId);
      const diffMs = checkOut.getTime() - checkIn.getTime();
      const nightsCount = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      totalAmountRaw = nightsCount * Number(roomTypeObj?.baseRate || 43000);
    }
    if (totalAmountRaw === undefined || totalAmountRaw === null || totalAmountRaw === '') {
      return res.status(400).json({ error: 'totalAmount es requerido' });
    }
    const totalAmount = Number(totalAmountRaw);
    if (isNaN(totalAmount) || totalAmount < 0) {
      return res.status(400).json({ error: 'totalAmount debe ser mayor o igual a 0' });
    }

    // 8. Validate depositAmount >= 0
    const depositAmountRaw = data.depositAmount !== undefined ? data.depositAmount : 0;
    const depositAmount = Number(depositAmountRaw);
    if (isNaN(depositAmount) || depositAmount < 0) {
      return res.status(400).json({ error: 'depositAmount debe ser mayor o igual a 0' });
    }

    // 9. Validate reservationStatus
    const reservationStatus = (data.reservationStatus || 'PENDING').toUpperCase();
    if (!ALLOWED_RESERVATION_STATUSES.includes(reservationStatus)) {
      return res.status(400).json({
        error: `reservationStatus inválido. Permitidos: ${ALLOWED_RESERVATION_STATUSES.join(', ')}`,
      });
    }

    // 10. Validate paymentStatus
    const paymentStatus = (data.paymentStatus || (data.paymentRef ? 'PAID' : 'NOT_REQUIRED')).toUpperCase();
    if (!ALLOWED_PAYMENT_STATUSES.includes(paymentStatus)) {
      return res.status(400).json({
        error: `paymentStatus inválido. Permitidos: ${ALLOWED_PAYMENT_STATUSES.join(', ')}`,
      });
    }

    // 11. Generate unique reservationCode if not informed (no Math.random())
    let reservationCode = data.reservationCode || data.bookingId;
    if (reservationCode && typeof reservationCode === 'string') {
      reservationCode = reservationCode.trim();
      const existing = await getReservationByCode(reservationCode);
      if (existing) {
        return res.status(400).json({ error: 'El reservationCode ya existe en el sistema' });
      }
    } else {
      reservationCode = generateReservationCode('BOL');
      let attempts = 0;
      while (await getReservationByCode(reservationCode)) {
        reservationCode = generateReservationCode('BOL');
        attempts++;
        if (attempts > 5) break;
      }
    }

    // 12. Create reservation in PostgreSQL
    const created = await createReservation({
      reservationCode,
      hotelId,
      customerId,
      roomTypeId,
      roomId: roomId || undefined,
      checkIn,
      checkOut,
      guests,
      totalAmount: totalAmount.toString(),
      depositAmount: depositAmount.toString(),
      reservationStatus: reservationStatus as any,
      paymentStatus: paymentStatus as any,
      source: data.source || 'DIRECT',
      notes: data.notes || data.paymentRef || null,
    });

    // 13. Fetch details to respond in exact frontend format
    const details = await getReservationWithDetails(created.id);
    const checkInDate = new Date(created.checkIn);
    const checkOutDate = new Date(created.checkOut);
    const diffMs = checkOutDate.getTime() - checkInDate.getTime();
    const nights = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

    const roomTypeName = details?.roomType?.name || (data.roomType || 'Doble');
    const isTriple = roomTypeName.toLowerCase().includes('triple');
    const roomType: 'Doble' | 'Triple' = isTriple ? 'Triple' : 'Doble';

    const formattedResponse: ReservationRecord & Record<string, any> = {
      id: created.id,
      bookingId: created.reservationCode,
      reservationCode: created.reservationCode,
      guestName: details?.customer?.name || data.guestName || 'Huésped Hotel Bolluk',
      guestDoc: details?.customer?.document || data.guestDoc || 'S/D',
      guestPhone: details?.customer?.phone || data.guestPhone || '',
      roomType,
      guests: Number(created.guests) || 2,
      checkIn: checkInDate.toISOString().split('T')[0],
      checkOut: checkOutDate.toISOString().split('T')[0],
      nights,
      totalPrice: Number(created.totalAmount) || 0,
      currency: data.currency || 'US$',
      paymentRef: created.notes || data.paymentRef || `REF-${created.reservationCode}`,
      paymentMethod: data.paymentMethod || (created.source === 'DIRECT' ? 'Directo (PostgreSQL)' : 'Mercado Pago (Tarjeta)'),
      paidAt: created.createdAt ? new Date(created.createdAt).toISOString() : new Date().toISOString(),
      loadedInHotelSystem: created.reservationStatus === 'CONFIRMED',
      loadedAt: undefined,
      receptionistNotified: true,
      hotelId: created.hotelId,
      customerId: created.customerId,
      roomTypeId: created.roomTypeId,
      roomId: created.roomId,
      reservationStatus: created.reservationStatus,
      paymentStatus: created.paymentStatus,
    };

    res.status(201).json(formattedResponse);
  } catch (err: any) {
    console.error('Error creating reservation in PostgreSQL:', err);
    res.status(500).json({ error: 'Error al crear la reserva en PostgreSQL', details: err?.message });
  }
});

// API Update Reservation in PostgreSQL
app.patch('/api/reservations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Cuerpo de petición inválido' });
    }

    // 1. Verify reservation exists (by UUID id or reservationCode)
    let existingReservation = null;
    if (isValidUUID(id)) {
      existingReservation = await getReservationById(id);
    }
    if (!existingReservation) {
      existingReservation = await getReservationByCode(id);
    }
    if (!existingReservation) {
      return res.status(404).json({ error: 'Reserva no encontrada en la base de datos' });
    }

    // 2. Disallow arbitrary fields
    const ALLOWED_PATCH_FIELDS = [
      'notes',
      'reservationStatus',
      'paymentStatus',
      'checkIn',
      'checkOut',
      'guests',
      'totalAmount',
      'totalPrice',
      'depositAmount',
      'roomId',
      'roomTypeId',
      'source',
      'loadedInHotelSystem',
    ];

    const bodyKeys = Object.keys(body);
    if (bodyKeys.length === 0) {
      return res.status(400).json({ error: 'No se enviaron campos para actualizar' });
    }

    for (const key of bodyKeys) {
      if (!ALLOWED_PATCH_FIELDS.includes(key)) {
        return res.status(400).json({ error: `Campo no permitido para actualización: ${key}` });
      }
    }

    const updates: Record<string, any> = {};

    // 3. Validate and handle checkIn / checkOut
    let newCheckIn: Date | null = null;
    let newCheckOut: Date | null = null;

    if (body.checkIn !== undefined) {
      newCheckIn = new Date(body.checkIn);
      if (isNaN(newCheckIn.getTime())) {
        return res.status(400).json({ error: 'checkIn debe ser una fecha válida' });
      }
      updates.checkIn = newCheckIn;
    }

    if (body.checkOut !== undefined) {
      newCheckOut = new Date(body.checkOut);
      if (isNaN(newCheckOut.getTime())) {
        return res.status(400).json({ error: 'checkOut debe ser una fecha válida' });
      }
      updates.checkOut = newCheckOut;
    }

    const finalCheckIn = newCheckIn || new Date(existingReservation.checkIn);
    const finalCheckOut = newCheckOut || new Date(existingReservation.checkOut);
    if (finalCheckOut.getTime() <= finalCheckIn.getTime()) {
      return res.status(400).json({ error: 'checkOut debe ser posterior a checkIn' });
    }

    // 4. Validate guests > 0
    if (body.guests !== undefined) {
      const g = Number(body.guests);
      if (isNaN(g) || g <= 0 || !Number.isInteger(g)) {
        return res.status(400).json({ error: 'guests debe ser un número entero mayor a 0' });
      }
      updates.guests = g;
    }

    // 5. Validate totalAmount >= 0
    const totalAmountRaw = body.totalAmount !== undefined ? body.totalAmount : body.totalPrice;
    if (totalAmountRaw !== undefined) {
      const amt = Number(totalAmountRaw);
      if (isNaN(amt) || amt < 0) {
        return res.status(400).json({ error: 'totalAmount debe ser mayor o igual a 0' });
      }
      updates.totalAmount = amt.toString();
    }

    // 6. Validate depositAmount >= 0
    if (body.depositAmount !== undefined) {
      const dep = Number(body.depositAmount);
      if (isNaN(dep) || dep < 0) {
        return res.status(400).json({ error: 'depositAmount debe ser mayor o igual a 0' });
      }
      updates.depositAmount = dep.toString();
    }

    // 7. Validate reservationStatus
    if (body.reservationStatus !== undefined) {
      const status = String(body.reservationStatus).toUpperCase();
      if (!ALLOWED_RESERVATION_STATUSES.includes(status)) {
        return res.status(400).json({
          error: `reservationStatus inválido. Permitidos: ${ALLOWED_RESERVATION_STATUSES.join(', ')}`,
        });
      }
      updates.reservationStatus = status;
    }

    // 8. Validate paymentStatus
    if (body.paymentStatus !== undefined) {
      const pStatus = String(body.paymentStatus).toUpperCase();
      if (!ALLOWED_PAYMENT_STATUSES.includes(pStatus)) {
        return res.status(400).json({
          error: `paymentStatus inválido. Permitidos: ${ALLOWED_PAYMENT_STATUSES.join(', ')}`,
        });
      }
      updates.paymentStatus = pStatus;
    }

    // 9. Validate roomTypeId if provided
    if (body.roomTypeId !== undefined) {
      if (!isValidUUID(body.roomTypeId)) {
        return res.status(400).json({ error: 'roomTypeId inválido (debe ser un UUID válido)' });
      }
      const roomType = await getRoomTypeById(body.roomTypeId);
      if (!roomType) {
        return res.status(400).json({ error: 'roomTypeId no existe en la base de datos' });
      }
      updates.roomTypeId = body.roomTypeId;
    }

    // 10. Validate roomId if provided
    if (body.roomId !== undefined) {
      if (body.roomId !== null && body.roomId !== '') {
        if (!isValidUUID(body.roomId)) {
          return res.status(400).json({ error: 'roomId inválido (debe ser un UUID válido)' });
        }
        const room = await getRoomById(body.roomId);
        if (!room) {
          return res.status(400).json({ error: 'roomId no existe en la base de datos' });
        }
        updates.roomId = body.roomId;
      } else {
        updates.roomId = null;
      }
    }

    // 11. Validate notes and source
    if (body.notes !== undefined) {
      updates.notes = body.notes !== null ? String(body.notes) : null;
    }
    if (body.source !== undefined) {
      updates.source = String(body.source);
    }

    // 12. Support loadedInHotelSystem frontend toggle
    if (body.loadedInHotelSystem !== undefined) {
      if (typeof body.loadedInHotelSystem !== 'boolean') {
        return res.status(400).json({ error: 'loadedInHotelSystem debe ser un booleano' });
      }
      if (body.loadedInHotelSystem) {
        updates.reservationStatus = 'CONFIRMED';
      } else if (!updates.reservationStatus) {
        updates.reservationStatus = 'PENDING';
      }
    }

    // 13. Perform update in PostgreSQL
    const updated = await updateReservation(existingReservation.id, updates);
    if (!updated) {
      return res.status(500).json({ error: 'No se pudo actualizar la reserva en PostgreSQL' });
    }

    // 14. Return in exact frontend format
    const details = await getReservationWithDetails(updated.id);
    const checkInDate = new Date(updated.checkIn);
    const checkOutDate = new Date(updated.checkOut);
    const diffMs = checkOutDate.getTime() - checkInDate.getTime();
    const nights = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

    const roomTypeName = details?.roomType?.name || 'Doble';
    const isTriple = roomTypeName.toLowerCase().includes('triple');
    const roomType: 'Doble' | 'Triple' = isTriple ? 'Triple' : 'Doble';

    const isLoaded = updated.reservationStatus === 'CONFIRMED';

    const formattedResponse: ReservationRecord & Record<string, any> = {
      id: updated.id,
      bookingId: updated.reservationCode,
      reservationCode: updated.reservationCode,
      guestName: details?.customer?.name || 'Huésped Hotel Bolluk',
      guestDoc: details?.customer?.document || 'S/D',
      guestPhone: details?.customer?.phone || '',
      roomType,
      guests: Number(updated.guests) || 2,
      checkIn: checkInDate.toISOString().split('T')[0],
      checkOut: checkOutDate.toISOString().split('T')[0],
      nights,
      totalPrice: Number(updated.totalAmount) || 0,
      currency: 'US$',
      paymentRef: updated.notes || `REF-${updated.reservationCode}`,
      paymentMethod: updated.source === 'DIRECT' ? 'Directo (PostgreSQL)' : 'Mercado Pago (Tarjeta)',
      paidAt: updated.createdAt ? new Date(updated.createdAt).toISOString() : new Date().toISOString(),
      loadedInHotelSystem: isLoaded,
      loadedAt: isLoaded ? new Date().toISOString() : undefined,
      receptionistNotified: true,
      hotelId: updated.hotelId,
      customerId: updated.customerId,
      roomTypeId: updated.roomTypeId,
      roomId: updated.roomId,
      reservationStatus: updated.reservationStatus,
      paymentStatus: updated.paymentStatus,
      notes: updated.notes,
    };

    res.json(formattedResponse);
  } catch (err: any) {
    console.error('Error updating reservation in PostgreSQL:', err);
    res.status(500).json({ error: 'Error al actualizar reserva en PostgreSQL', details: err?.message });
  }
});

// Feedback URL for Mercado Pago return (Rule 7: sin confirmar ninguna reserva desde estas URLs)
app.get('/payment/feedback', (req, res) => {
  const { status, code } = req.query;
  res.json({
    message: 'Retorno de pasarela de pago recibido.',
    paymentGatewayStatus: status || 'unknown',
    reservationCode: code || null,
    note: 'El estado de la reserva no es modificado por esta URL de retorno.',
  });
});

// API Create Payment Preference for Reservation (Step 9F-2)
app.post('/api/reservations/:id/payment-preference', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    // 10. Buscar la reserva real en PostgreSQL
    let reservation = null;
    if (isValidUUID(id)) {
      reservation = await getReservationById(id);
    }
    if (!reservation) {
      reservation = await getReservationByCode(id);
    }
    if (!reservation) {
      return res.status(404).json({
        error: 'RESERVATION_NOT_FOUND',
        message: 'La reserva no existe en la base de datos.',
      });
    }

    // 10 & 11. Comprobar que reservationStatus = AWAITING_PAYMENT y paymentStatus = PENDING
    if (reservation.reservationStatus !== 'AWAITING_PAYMENT' || reservation.paymentStatus !== 'PENDING') {
      return res.status(400).json({
        error: 'INVALID_RESERVATION_STATUS',
        message: `No se puede generar preferencia de pago. La reserva debe estar en estado AWAITING_PAYMENT y pago PENDING (estado actual: ${reservation.reservationStatus}, pago: ${reservation.paymentStatus}).`,
        reservationStatus: reservation.reservationStatus,
        paymentStatus: reservation.paymentStatus,
      });
    }

    // Determinar depositAmount: si viene en req.body usarlo, sino usar el guardado en la reserva
    let depositAmount = body.depositAmount !== undefined
      ? Number(body.depositAmount)
      : Number(reservation.depositAmount || 0);

    // Regla 5: Si depositAmount <= 0: NO crear preferencia. Devolver error controlado: PAYMENT_NOT_REQUIRED
    if (isNaN(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({
        error: 'PAYMENT_NOT_REQUIRED',
        message: 'No se requiere pago de seña para esta reserva (depositAmount <= 0).',
      });
    }

    // Buscar información del cliente para la preferencia
    const customer = await getCustomerById(reservation.customerId);
    const customerName = customer?.name || 'Huésped Hotel';
    const customerEmail = customer?.email || undefined;

    // Generar preferencia mediante Mercado Pago
    // 12. No marcar paymentStatus = PAID
    // 13. No marcar reservationStatus = CONFIRMED
    const preference = await createPaymentPreference({
      reservationId: reservation.id,
      reservationCode: reservation.reservationCode,
      customerName,
      customerEmail,
      totalAmount: Number(reservation.totalAmount),
      depositAmount,
      description: body.description || `Seña Reserva Hotel Nuevo Horizonte - Código ${reservation.reservationCode}`,
    });

    // 8. Solo devolver desde el servicio / endpoint: preferenceId, checkoutUrl, reservationCode, amount
    res.status(201).json({
      preferenceId: preference.preferenceId,
      checkoutUrl: preference.checkoutUrl,
      sandboxCheckoutUrl: preference.sandboxCheckoutUrl,
      reservationCode: preference.reservationCode,
      amount: preference.amount,
    });
  } catch (err: any) {
    if (err?.code === 'PAYMENT_NOT_REQUIRED') {
      return res.status(400).json({
        error: 'PAYMENT_NOT_REQUIRED',
        message: err.message,
      });
    }
    if (err?.code === 'MERCADOPAGO_PENDING_CONFIGURATION' || err?.code === 'MERCADOPAGO_TOKEN_MISSING') {
      return res.status(503).json({
        error: 'MERCADOPAGO_PENDING_CONFIGURATION',
        status: 'PENDING_CONFIGURATION',
        message: 'La integración con Mercado Pago se encuentra en estado PENDING_CONFIGURATION (MERCADOPAGO_ACCESS_TOKEN no configurado).',
      });
    }
    console.error('Error creating payment preference:', err);
    res.status(500).json({
      error: 'PAYMENT_PREFERENCE_FAILED',
      message: 'Error al generar preferencia de pago con Mercado Pago',
      details: err?.message || err,
    });
  }
});

interface BollukitoChatResult {
  reply: string;
  availableOptions?: any[];
  reservationOffer?: any;
  quickReplies?: string[];
  available?: boolean;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  availableRooms?: any[];
}

async function processBollukitoChat(
  message: string,
  history: any[] = [],
  hotelConfig?: any
): Promise<BollukitoChatResult> {
  // 1. Detect availability intent and connect with real PostgreSQL availability
  const parsedAvailability = parseAvailabilityIntent(message, history);
  if (parsedAvailability.isAvailabilityIntent) {
    const availabilityResult = await handleChatAvailability(parsedAvailability);
    return {
      reply: availabilityResult.reply,
      available: availabilityResult.available,
      checkIn: availabilityResult.checkIn,
      checkOut: availabilityResult.checkOut,
      guests: availabilityResult.guests,
      availableOptions: availabilityResult.availableOptions,
      availableRooms: availabilityResult.availableRooms,
      reservationOffer: availabilityResult.reservationOffer,
      quickReplies: availabilityResult.quickReplies,
    };
  }

  const hotel = hotelConfig || {
    hotelName: 'Hotel Bolluk',
    mascotName: 'Bollukito',
    doubleRoomPrice: 43,
    tripleRoomPrice: 62,
    checkInTime: '14:00',
    checkOutTime: '10:00',
    breakfastHours: '07:30 a 10:30',
    receptionistPhone: '+54 9 11 4055-7788',
  };

  const kbText = Array.isArray(hotel.knowledgeBase) && hotel.knowledgeBase.length > 0
    ? `\nBASE DE CONOCIMIENTO Y RESPUESTAS EDUCADAS POR HOTEL BOLLUK:\n` +
      hotel.knowledgeBase.map((item: any) => `• TEMA/PREGUNTA: ${item.topic}\n  RESPUESTA OFICIAL DEL HOTEL: ${item.answer}`).join('\n') +
      `\nUtiliza siempre estas respuestas oficiales cuando el cliente pregunte sobre estos temas.\n`
    : '';

  // Format conversational context
  const systemPrompt = `Eres Bollukito 🐾🛎️, la mascota oficial y conserje virtual de ${hotel.hotelName}.
Eres un adorable y carismático Bulldog Francés vaquita (blanco con manchas negras), con una elegante gorrita bordó de botones, chalequito con botones dorados y una llave dorada de recepción.

Tu personalidad:
- Hablas en español de forma muy cálida, amable, hospitalaria y amigable (con emojis simpáticos como 🐾, 🛎️, 🛏️, ✨).
- Eres servicial y rápido.
- Tu misión principal es responder dudas de los huéspedes y guiarlos paso a paso para reservar su estadía en ${hotel.hotelName} SIN intervención humana.

Información oficial de ${hotel.hotelName}:
- Habitaciones disponibles:
  * Habitación Doble: US$ ${hotel.doubleRoomPrice}/noche (sommier matrimonial o 2 individuales, baño privado, TV LED, aire acondicionado frío/calor, wifi de alta velocidad, desayuno buffet incluido).
  * Habitación Triple: US$ ${hotel.tripleRoomPrice}/noche (cama matrimonial + cama individual, baño privado, aire acondicionado, frigobar, wifi, desayuno buffet incluido).
- Servicios: Desayuno buffet (${hotel.breakfastHours}), cochera/estacionamiento privado techado gratuito, wifi libre en todo el hotel, ¡somos 100% Pet-Friendly! (a Bollukito le encantan los amiguitos de 4 patas).
- Horarios: Check-in a partir de las ${hotel.checkInTime} hs. Check-out hasta las ${hotel.checkOutTime} hs.
- Forma de pago: Link de pago seguro inmediato (Mercado Pago o Tarjeta de crédito/débito).
${kbText}
Pautas de interacción:
1. Si el cliente saluda o pregunta en general, salúdalo con alegría presentándote como Bollukito y pregúntale para qué fechas o cuántas personas está planeando el viaje.
2. Si el cliente menciona fechas y/o cantidad de personas, calcula la cantidad de noches, recomienda la habitación correcta (Doble para 1-2 personas, Triple para 3 personas), calcula el monto total en US$ y pregúntale amablemente si desea avanzar con la reserva.
3. Si el cliente quiere reservar o te da sus datos, pídele amablemente: Nombre y apellido, DNI/Pasaporte y teléfono.
4. IMPORTANTE: Cuando el cliente ya ha indicado fechas o personas y está listo para reservar, o pide precio final, genera en tu respuesta de forma explícita el desglose para que pueda pagar.

FORMATO DE RESPUESTA:
Debes responder SIEMPRE en formato JSON válido con esta estructura:
{
  "reply": "Tu mensaje conversacional como Bollukito con tono amigable y emojis",
  "reservationOffer": {
    "detected": true o false,
    "roomType": "Doble" o "Triple",
    "guests": numero,
    "checkIn": "YYYY-MM-DD",
    "checkOut": "YYYY-MM-DD",
    "nights": numero,
    "pricePerNight": numero,
    "totalPrice": numero,
    "currency": "US$",
    "readyForPayment": true o false
  },
  "quickReplies": ["Ver fotos de habitaciones", "Consultar fechas", "¿Tienen cochera?", "Quiero reservar"]
}
Si aún no hay fechas o intención de reserva específica, pon "detected": false en reservationOffer.`;

  try {
    const ai = getAIClient();

    if (ai) {
      // Build conversation contents
      const contents = history.map((msg: any) => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: typeof msg.text === 'string' ? msg.text : '' }],
      }));

      contents.push({
        role: 'user',
        parts: [{ text: message }],
      });

      // Try resilient model cascade to bypass temporary 503 demand spikes
      const candidateModels = [
        'gemini-2.5-flash',
        'gemini-3.1-flash-lite',
        'gemini-flash-latest',
        'gemini-3.8-flash',
      ];

      let responseText = '';
      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          });
          if (response.text) {
            responseText = response.text;
            break;
          }
        } catch (modelErr: any) {
          // If model is busy or unavailable (503), try next model in cascade
          console.warn(`Model ${modelName} unavailable (${modelErr?.status || modelErr?.message || '503'}), trying alternative...`);
        }
      }

      if (responseText) {
        try {
          const parsed = JSON.parse(responseText);
          return {
            reply: parsed.reply,
            availableOptions: [],
            reservationOffer: parsed.reservationOffer?.detected ? parsed.reservationOffer : null,
            quickReplies: parsed.quickReplies || [],
          };
        } catch (parseErr) {
          return {
            reply: responseText,
            availableOptions: [],
            reservationOffer: null,
            quickReplies: ['Quiero una Doble', 'Quiero una Triple', '¿Tienen cochera?'],
          };
        }
      }
    }
  } catch (error: any) {
    console.warn('Recovering gracefully with intelligent hotel rules:', error?.message || error);
  }

  // Smart fallback when Gemini API key is missing or offline
  const lowerMsg = message.toLowerCase();
  let reply = '';
  let offer: any = null;
  let quickReplies = ['Habitación Doble', 'Habitación Triple', '¿Tienen cochera?', 'Horarios de Check-in'];

  // Check if any knowledgeBase topic matches the user's question
  if (Array.isArray(hotel.knowledgeBase) && !reply) {
    for (const kbItem of hotel.knowledgeBase) {
      if (!kbItem.topic || !kbItem.answer) continue;
      const topicLower = kbItem.topic.toLowerCase();
      // Match keywords
      const keywords = topicLower
        .replace(/[¿?¡!(),.-]/g, '')
        .split(/\s+/)
        .filter((w: string) => w.length > 3 && !['como', 'para', 'este', 'esta', 'tienen', 'tienes', 'hotel'].includes(w));
      
      const hasMatch = keywords.some((kw: string) => lowerMsg.includes(kw));
      if (hasMatch) {
        reply = `¡Guau! Con gusto te cuento: ${kbItem.answer} 🐾🛎️ ¿Te gustaría consultar disponibilidad de habitaciones o fechas?`;
        quickReplies = ['Consultar Habitación Doble', 'Consultar Habitación Triple', '¿Cómo reservar?'];
        break;
      }
    }
  }

  if (!reply) {
    if (lowerMsg.includes('hola') || lowerMsg.includes('buenas') || lowerMsg.includes('buen dia') || lowerMsg.includes('buenas tardes')) {
      reply = `¡Hola! 🐾🛎️ ¡Guau! Soy **Bollukito**, el anfitrión de cuatro patas de **${hotel.hotelName}**. Qué alegría que nos escribas. Estoy listo para ayudarte a encontrar la habitación perfecta. ¿En qué fechas estás planeando visitarnos y para cuántas personas?`;
      quickReplies = ['Para 2 personas', 'Para 3 personas (familia)', '¿Tienen cochera?'];
    } else if (lowerMsg.includes('cochera') || lowerMsg.includes('estacionamiento') || lowerMsg.includes('auto')) {
      reply = `¡Sí, por supuesto! 🚗✨ En **${hotel.hotelName}** contamos con estacionamiento privado y techado gratuito para todos nuestros huéspedes con vigilancia. ¿Para qué fechas querés venir con tu vehículo?`;
      quickReplies = ['Este fin de semana', 'Ver tarifas', 'Para 2 personas'];
    } else if (lowerMsg.includes('desayuno') || lowerMsg.includes('comida')) {
      reply = `¡Mmm, qué rico! ☕🥐 Nuestro desayuno buffet está incluido en todas las tarifas y se sirve de ${hotel.breakfastHours} hs. Incluye medialunas, café en grano, jugos naturales, frutas y opciones para celíacos. ¿Te gustaría consultar disponibilidad?`;
    } else if (lowerMsg.includes('mascota') || lowerMsg.includes('perro') || lowerMsg.includes('gato') || lowerMsg.includes('pet')) {
      reply = `¡Siii! 🐾❤️ En **${hotel.hotelName}** somos 100% Pet-Friendly. Como yo soy un perrito, ¡acá recibimos a todos los amiguitos peludos con los brazos y las patitas abiertas! No tiene costo adicional. ¿Cuántos vienen?`;
    } else if (lowerMsg.includes('3 personas') || lowerMsg.includes('triple') || lowerMsg.includes('hijo') || lowerMsg.includes('familia')) {
      reply = `¡Genial! 🛏️ Para 3 personas te recomiendo nuestra **Habitación Triple** (cama matrimonial + cama individual, aire acondicionado, baño privado y frigobar). La tarifa base es de US$ ${hotel.tripleRoomPrice} por noche con desayuno incluido. ¿Para qué fecha sería la estadía? 🐾🛎️`;
      offer = null;
      quickReplies = ['Ver fotos', '¿Tienen cochera?', 'Consultar fechas'];
    } else if (lowerMsg.includes('2 personas') || lowerMsg.includes('doble') || lowerMsg.includes('pareja') || lowerMsg.includes('precio') || lowerMsg.includes('tarifa')) {
      reply = `¡Excelente elección! 💑🏨 Para 2 personas tenemos nuestra **Habitación Doble** (sommier matrimonial, baño privado, aire acondicionado y TV). La tarifa base es de US$ ${hotel.doubleRoomPrice} por noche con desayuno buffet incluido. ¿Para qué fecha sería la estadía? 🐾🛎️`;
      offer = null;
      quickReplies = ['Ver fotos', '¿Tienen cochera?', 'Consultar fechas'];
    } else if (lowerMsg.includes('reservar') || lowerMsg.includes('pagar') || lowerMsg.includes('link') || lowerMsg.includes('tarjeta')) {
      reply = `¡Con mucho gusto! 🐾🛎️ Para consultar disponibilidad y preparar tu reserva directa, ¿para qué fechas y cuántas personas estás planeando viajar?`;
      offer = null;
      quickReplies = ['Para 2 personas', 'Para 3 personas', 'Ver habitaciones'];
    } else {
      reply = `¡Entendido! 🐾 Como anfitrión de **${hotel.hotelName}**, puedo darte tarifas de nuestras Habitaciones Dobles (US$ ${hotel.doubleRoomPrice}/n) y Triples (US$ ${hotel.tripleRoomPrice}/n), horarios, fotos y consultar disponibilidad real en el momento. ¿Para qué fecha sería la estadía?`;
      offer = null;
    }
  }

  return {
    reply,
    availableOptions: [],
    reservationOffer: offer,
    quickReplies,
  };
}

// API Chat with Bollukito
app.post('/api/chat', async (req, res) => {
  const { message, history = [], hotelConfig } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Mensaje vacío' });
  }

  const result = await processBollukitoChat(message, history, hotelConfig);
  return res.json(result);
});

// Ensure permanent video persistence across restarts
const videoPaths = [
  path.join(process.cwd(), 'storage', 'bollukito_video.mp4'),
  path.join(process.cwd(), 'public', 'bollukito_video.mp4'),
  path.join(process.cwd(), 'src', 'assets', 'bollukito_video.mp4'),
  path.join(process.cwd(), 'dist', 'bollukito_video.mp4'),
];

// Restore video if any replica is missing
try {
  const existingMaster = videoPaths.find((p) => fs.existsSync(p));
  if (existingMaster) {
    for (const targetPath of videoPaths) {
      if (!fs.existsSync(targetPath)) {
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.copyFileSync(existingMaster, targetPath);
      }
    }
  }
} catch (err) {
  console.warn('Video replication check error:', err);
}

// Check status of saved video
app.get('/api/video-status', (req, res) => {
  const foundPath = videoPaths.find((p) => fs.existsSync(p));
  if (foundPath) {
    const stats = fs.statSync(foundPath);
    return res.json({
      exists: true,
      url: '/bollukito_video.mp4',
      size: stats.size,
      updatedAt: stats.mtime,
    });
  }
  return res.json({ exists: false });
});

// Fast raw binary upload endpoint (no base64 overhead, supports up to 150MB)
app.post('/api/upload-video-binary', express.raw({ type: '*/*', limit: '150mb' }), (req, res) => {
  try {
    const buffer = req.body;
    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'Archivo de video vacío' });
    }

    for (const targetPath of videoPaths) {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(targetPath, buffer);
    }

    console.log(`Video saved successfully (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
    res.json({ success: true, url: '/bollukito_video.mp4', size: buffer.length });
  } catch (error) {
    console.error('Error saving binary video:', error);
    res.status(500).json({ error: 'Error al procesar el archivo de video' });
  }
});

// Upload video file (Base64) for custom animation
app.post('/api/upload-video', (req, res) => {
  try {
    const { videoBase64 } = req.body;
    if (!videoBase64) {
      return res.status(400).json({ error: 'No video provided' });
    }
    const cleanBase64 = videoBase64.replace(/^data:video\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    
    // Save to all redundant persistence locations
    for (const targetPath of videoPaths) {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(targetPath, buffer);
    }

    res.json({ success: true, url: '/bollukito_video.mp4' });
  } catch (error) {
    console.error('Error saving video:', error);
    res.status(500).json({ error: 'Failed to save video file' });
  }
});

// Serve uploaded video reliably in both dev and production
app.get(['/bollukito_video.mp4', '/luma_walking_video.mp4'], (req, res) => {
  const foundPath = videoPaths.find((p) => fs.existsSync(p));
  if (foundPath) {
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    return res.sendFile(foundPath);
  }
  res.status(404).send('Video not found');
});

// Meta WhatsApp Webhook Endpoint (For future live connection)
// WhatsApp Integration Status (Opcional): PENDING_CONFIGURATION si faltan variables
export const getWhatsAppIntegrationStatus = (): 'CONFIGURED' | 'PENDING_CONFIGURATION' => {
  return (process.env.WHATSAPP_ACCESS_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim())
    ? 'CONFIGURED'
    : 'PENDING_CONFIGURATION';
};

export const WHATSAPP_INTEGRATION_STATUS = getWhatsAppIntegrationStatus();

// WhatsApp Cloud API Configuration & Service (Paso 12C - Preparado para el futuro)
export function getWhatsAppConfig() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !accessToken.trim()) {
    const error: any = new Error('WhatsApp se encuentra en estado PENDING_CONFIGURATION (WHATSAPP_ACCESS_TOKEN no configurado)');
    error.code = 'WHATSAPP_PENDING_CONFIGURATION';
    error.status = 'PENDING_CONFIGURATION';
    throw error;
  }

  if (!phoneNumberId || !phoneNumberId.trim()) {
    const error: any = new Error('WhatsApp se encuentra en estado PENDING_CONFIGURATION (WHATSAPP_PHONE_NUMBER_ID no configurado)');
    error.code = 'WHATSAPP_PENDING_CONFIGURATION';
    error.status = 'PENDING_CONFIGURATION';
    throw error;
  }

  return {
    accessToken: accessToken.trim(),
    phoneNumberId: phoneNumberId.trim(),
  };
}

export async function sendWhatsAppTextMessage(phoneNumber: string, text: string) {
  if (!phoneNumber || typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
    throw new Error('phoneNumber is required');
  }
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('text is required');
  }

  // Leer desde variables de entorno con error controlado si faltan
  const config = getWhatsAppConfig();
  void config;

  return {
    phoneNumber,
    text,
  };
}

app.get('/api/whatsapp/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === (process.env.WHATSAPP_VERIFY_TOKEN || 'hotel_bolluk_token')) {
    console.log('WhatsApp Webhook verified successfully!');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

app.post('/api/whatsapp/webhook', async (req, res) => {
  const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const messageText = message?.type === 'text' ? message?.text?.body : (message?.text?.body || undefined);
  const phoneNumber = message?.from;
  const messageId = message?.id;
  void messageId;

  try {
    if (phoneNumber && messageText) {
      const hotel = await getBollukHotel();
      if (hotel) {
        let conversation = await getConversationByPhone(hotel.id, phoneNumber);
        if (!conversation) {
          conversation = await createConversation({
            hotelId: hotel.id,
            phoneNumber,
            channel: 'WHATSAPP',
            status: 'BOT_ACTIVE',
          });
        }

        await createMessage({
          conversationId: conversation.id,
          senderType: 'CUSTOMER',
          content: messageText,
        });

        // 1 & 2. Pasar messageText al motor de chat existente de Bollukito (misma lógica que POST /api/chat)
        // 3. Obtener solamente la respuesta generada por Bollukito en la variable: botReply
        const chatResult = await processBollukitoChat(messageText, []);
        const botReply = chatResult.reply;

        if (botReply) {
          await createMessage({
            conversationId: conversation.id,
            senderType: 'BOT',
            content: botReply,
          });
        }
      }
    }
  } catch (err) {
    console.error('Error processing WhatsApp webhook message:', err);
  }

  res.status(200).json({
    status: 'received',
  });
});

// Start server with Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
