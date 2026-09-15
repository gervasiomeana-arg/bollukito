import { eq, and, gte, lt, gt, inArray, notInArray, isNotNull } from 'drizzle-orm';
import { db } from './index.ts';
import { rooms, roomTypes, reservations } from './schema.ts';

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type RoomType = typeof roomTypes.$inferSelect;

export interface AvailableRoom extends Room {
  roomType: RoomType;
}

export async function createRoom(data: NewRoom): Promise<Room> {
  const [created] = await db.insert(rooms).values(data).returning();
  return created;
}

export async function getRoomById(id: string): Promise<Room | null> {
  const [found] = await db.select().from(rooms).where(eq(rooms.id, id));
  return found || null;
}

export async function getRoomsByHotel(hotelId: string): Promise<Room[]> {
  return db.select().from(rooms).where(eq(rooms.hotelId, hotelId));
}

export async function getRoomsByRoomType(roomTypeId: string): Promise<Room[]> {
  return db.select().from(rooms).where(eq(rooms.roomTypeId, roomTypeId));
}

export async function getAvailableRooms(
  hotelId: string,
  checkIn: Date | string,
  checkOut: Date | string,
  guests: number
): Promise<AvailableRoom[]> {
  const reqCheckIn = checkIn instanceof Date ? checkIn : new Date(checkIn);
  const reqCheckOut = checkOut instanceof Date ? checkOut : new Date(checkOut);

  if (isNaN(reqCheckIn.getTime()) || isNaN(reqCheckOut.getTime())) {
    throw new Error('Fechas de checkIn y checkOut inválidas');
  }

  // 6. checkOut debe ser posterior a checkIn
  if (reqCheckOut <= reqCheckIn) {
    throw new Error('checkOut debe ser posterior a checkIn');
  }

  const requestedGuests = Number(guests);
  if (isNaN(requestedGuests) || requestedGuests < 1) {
    throw new Error('La cantidad de huéspedes debe ser mayor a 0');
  }

  // 4 & 5. Habitaciones con reservas superpuestas
  // Regla: existing.checkIn < requested.checkOut AND existing.checkOut > requested.checkIn
  // Solo estados: PENDING, AWAITING_PAYMENT, CONFIRMED
  const occupiedReservations = await db
    .select({ roomId: reservations.roomId })
    .from(reservations)
    .where(
      and(
        eq(reservations.hotelId, hotelId),
        inArray(reservations.reservationStatus, ['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED']),
        isNotNull(reservations.roomId),
        lt(reservations.checkIn, reqCheckOut),
        gt(reservations.checkOut, reqCheckIn)
      )
    );

  const occupiedRoomIds = new Set(
    occupiedReservations
      .map((r) => r.roomId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
  );

  // 1, 2, 3. Habitaciones activas del hotel, sin BLOCKED/MAINTENANCE, y capacidad >= guests
  const candidateRooms = await db
    .select({
      room: rooms,
      roomType: roomTypes,
    })
    .from(rooms)
    .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
    .where(
      and(
        eq(rooms.hotelId, hotelId),
        eq(rooms.active, true),
        notInArray(rooms.status, ['BLOCKED', 'MAINTENANCE']),
        gte(roomTypes.capacity, requestedGuests)
      )
    );

  // Filtrar las habitaciones que tienen reserva solapada
  const available = candidateRooms
    .filter((entry) => !occupiedRoomIds.has(entry.room.id))
    .map((entry) => ({
      ...entry.room,
      roomType: entry.roomType,
    }));

  return available;
}

export async function isRoomAvailable(
  roomId: string,
  checkIn: Date | string,
  checkOut: Date | string,
  guests: number
): Promise<boolean> {
  const reqCheckIn = checkIn instanceof Date ? checkIn : new Date(checkIn);
  const reqCheckOut = checkOut instanceof Date ? checkOut : new Date(checkOut);

  if (isNaN(reqCheckIn.getTime()) || isNaN(reqCheckOut.getTime()) || reqCheckOut <= reqCheckIn) {
    return false;
  }

  const requestedGuests = Number(guests);
  if (isNaN(requestedGuests) || requestedGuests < 1) {
    return false;
  }

  // 1. Verificar que la habitación exista y obtener roomType
  const [roomData] = await db
    .select({
      room: rooms,
      roomType: roomTypes,
    })
    .from(rooms)
    .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
    .where(eq(rooms.id, roomId));

  if (!roomData || !roomData.room) {
    return false;
  }

  // 2. Verificar que esté activa
  if (!roomData.room.active) {
    return false;
  }

  // 3. Rechazar si status es BLOCKED o MAINTENANCE
  if (roomData.room.status === 'BLOCKED' || roomData.room.status === 'MAINTENANCE') {
    return false;
  }

  // 4. Verificar que la capacidad de su room_type sea >= guests
  if (!roomData.roomType || roomData.roomType.capacity < requestedGuests) {
    return false;
  }

  // 5 & 6. Buscar reservas superpuestas para esa habitación
  // existing.checkIn < requested.checkOut AND existing.checkOut > requested.checkIn
  // Solo status: PENDING, AWAITING_PAYMENT, CONFIRMED
  const [overlapping] = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(
      and(
        eq(reservations.roomId, roomId),
        inArray(reservations.reservationStatus, ['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED']),
        lt(reservations.checkIn, reqCheckOut),
        gt(reservations.checkOut, reqCheckIn)
      )
    )
    .limit(1);

  if (overlapping) {
    return false;
  }

  return true;
}

export async function getFirstAvailableRoomByType(
  hotelId: string,
  roomTypeId: string,
  checkIn: Date | string,
  checkOut: Date | string,
  guests: number
): Promise<AvailableRoom | null> {
  const availableRooms = await getAvailableRooms(hotelId, checkIn, checkOut, guests);

  const matchedRooms = availableRooms
    .filter((room) => room.roomTypeId === roomTypeId)
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));

  return matchedRooms[0] || null;
}

export async function updateRoom(
  id: string,
  data: Partial<Omit<NewRoom, 'id' | 'createdAt'>>
): Promise<Room | null> {
  const [updated] = await db
    .update(rooms)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(rooms.id, id))
    .returning();
  return updated || null;
}

