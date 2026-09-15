import { eq, desc, and, or, gte, lte, sql, ne, count, inArray } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { db } from './index.ts';
import { reservations, hotels, customers, roomTypes, rooms } from './schema.ts';

export type Reservation = typeof reservations.$inferSelect;
export type NewReservation = typeof reservations.$inferInsert;

export function generateReservationCode(prefix: string = 'BOL'): string {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const randomSuffix = randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${yearMonth}-${randomSuffix}`;
}

export async function createReservation(data: NewReservation): Promise<Reservation> {
  const [created] = await db.insert(reservations).values(data).returning();
  return created;
}

export async function getReservationById(id: string): Promise<Reservation | null> {
  const [found] = await db.select().from(reservations).where(eq(reservations.id, id));
  return found || null;
}

export async function getReservationByCode(code: string): Promise<Reservation | null> {
  const [found] = await db.select().from(reservations).where(eq(reservations.reservationCode, code));
  return found || null;
}

export async function getReservationsByHotel(hotelId: string): Promise<Reservation[]> {
  return db
    .select()
    .from(reservations)
    .where(eq(reservations.hotelId, hotelId))
    .orderBy(desc(reservations.createdAt));
}

export async function getReservationWithDetails(id: string) {
  const [found] = await db
    .select({
      reservation: reservations,
      hotel: hotels,
      customer: customers,
      roomType: roomTypes,
      room: rooms,
    })
    .from(reservations)
    .innerJoin(hotels, eq(reservations.hotelId, hotels.id))
    .innerJoin(customers, eq(reservations.customerId, customers.id))
    .innerJoin(roomTypes, eq(reservations.roomTypeId, roomTypes.id))
    .leftJoin(rooms, eq(reservations.roomId, rooms.id))
    .where(eq(reservations.id, id));

  return found || null;
}

export async function getAllReservationsWithDetails(hotelId?: string) {
  const baseQuery = db
    .select({
      reservation: reservations,
      hotel: hotels,
      customer: customers,
      roomType: roomTypes,
      room: rooms,
    })
    .from(reservations)
    .innerJoin(hotels, eq(reservations.hotelId, hotels.id))
    .innerJoin(customers, eq(reservations.customerId, customers.id))
    .innerJoin(roomTypes, eq(reservations.roomTypeId, roomTypes.id))
    .leftJoin(rooms, eq(reservations.roomId, rooms.id))
    .orderBy(desc(reservations.createdAt));

  if (hotelId) {
    return baseQuery.where(eq(reservations.hotelId, hotelId));
  }
  return baseQuery;
}

export async function updateReservation(
  id: string,
  data: Partial<Omit<NewReservation, 'id' | 'createdAt'>>
): Promise<Reservation | null> {
  const [updated] = await db
    .update(reservations)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(reservations.id, id))
    .returning();

  return updated || null;
}

export async function getTodayReservations(hotelId: string): Promise<Reservation[]> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return db
    .select()
    .from(reservations)
    .where(
      and(
        eq(reservations.hotelId, hotelId),
        or(
          and(
            gte(reservations.checkIn, startOfDay),
            lte(reservations.checkIn, endOfDay)
          ),
          and(
            gte(reservations.checkOut, startOfDay),
            lte(reservations.checkOut, endOfDay)
          ),
          sql`DATE(${reservations.checkIn}) = CURRENT_DATE`,
          sql`DATE(${reservations.checkOut}) = CURRENT_DATE`
        )
      )
    )
    .orderBy(desc(reservations.checkIn));
}

export async function countTodayCheckIns(hotelId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const result = await db
    .select({ total: count() })
    .from(reservations)
    .where(
      and(
        eq(reservations.hotelId, hotelId),
        ne(reservations.reservationStatus, 'CANCELLED'),
        or(
          and(
            gte(reservations.checkIn, startOfDay),
            lte(reservations.checkIn, endOfDay)
          ),
          sql`DATE(${reservations.checkIn}) = CURRENT_DATE`
        )
      )
    );

  return Number(result[0]?.total || 0);
}

export async function countTodayCheckOuts(hotelId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const result = await db
    .select({ total: count() })
    .from(reservations)
    .where(
      and(
        eq(reservations.hotelId, hotelId),
        ne(reservations.reservationStatus, 'CANCELLED'),
        or(
          and(
            gte(reservations.checkOut, startOfDay),
            lte(reservations.checkOut, endOfDay)
          ),
          sql`DATE(${reservations.checkOut}) = CURRENT_DATE`
        )
      )
    );

  return Number(result[0]?.total || 0);
}

export async function countPendingReservations(hotelId: string): Promise<number> {
  const result = await db
    .select({ total: count() })
    .from(reservations)
    .where(
      and(
        eq(reservations.hotelId, hotelId),
        inArray(reservations.reservationStatus, ['PENDING', 'AWAITING_PAYMENT'])
      )
    );

  return Number(result[0]?.total || 0);
}

export async function countConfirmedReservations(hotelId: string): Promise<number> {
  const result = await db
    .select({ total: count() })
    .from(reservations)
    .where(
      and(
        eq(reservations.hotelId, hotelId),
        eq(reservations.reservationStatus, 'CONFIRMED')
      )
    );

  return Number(result[0]?.total || 0);
}

export async function countCancelledReservations(hotelId: string): Promise<number> {
  const result = await db
    .select({ total: count() })
    .from(reservations)
    .where(
      and(
        eq(reservations.hotelId, hotelId),
        eq(reservations.reservationStatus, 'CANCELLED')
      )
    );

  return Number(result[0]?.total || 0);
}

export interface ReceptionSummary {
  checkInsToday: number;
  checkOutsToday: number;
  pendingReservations: number;
  confirmedReservations: number;
  cancelledReservations: number;
}

export async function getReceptionSummary(hotelId: string): Promise<ReceptionSummary> {
  const [
    checkInsToday,
    checkOutsToday,
    pendingReservations,
    confirmedReservations,
    cancelledReservations,
  ] = await Promise.all([
    countTodayCheckIns(hotelId),
    countTodayCheckOuts(hotelId),
    countPendingReservations(hotelId),
    countConfirmedReservations(hotelId),
    countCancelledReservations(hotelId),
  ]);

  return {
    checkInsToday,
    checkOutsToday,
    pendingReservations,
    confirmedReservations,
    cancelledReservations,
  };
}

export async function getTodayReceptionReservations(hotelId: string): Promise<Reservation[]> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const conditions = [
    ne(reservations.reservationStatus, 'CANCELLED'),
    or(
      and(
        gte(reservations.checkIn, startOfDay),
        lte(reservations.checkIn, endOfDay)
      ),
      and(
        gte(reservations.checkOut, startOfDay),
        lte(reservations.checkOut, endOfDay)
      ),
      sql`DATE(${reservations.checkIn}) = CURRENT_DATE`,
      sql`DATE(${reservations.checkOut}) = CURRENT_DATE`
    ),
  ];

  if (hotelId) {
    conditions.push(eq(reservations.hotelId, hotelId));
  }

  return db
    .select()
    .from(reservations)
    .where(and(...conditions))
    .orderBy(desc(reservations.checkIn));
}


