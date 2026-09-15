import dotenv from 'dotenv';
dotenv.config();

import { getHotels } from '../src/db/hotels.ts';
import { getCustomersByHotel } from '../src/db/customers.ts';
import { getRoomTypesByHotel } from '../src/db/room-types.ts';
import { getRoomsByHotel } from '../src/db/rooms.ts';
import {
  createReservation,
  getReservationById,
  getReservationByCode,
  getReservationWithDetails,
  generateReservationCode,
} from '../src/db/reservations.ts';
import { createPool } from '../src/db/index.ts';

async function run() {
  try {
    console.log('--- Testing Reservation Insert & Read ---');

    // 1. Get Hotel Bolluk
    const hotelsList = await getHotels();
    const hotel = hotelsList.find((h) => h.name === 'Hotel Bolluk') || hotelsList[0];
    if (!hotel) {
      throw new Error('Hotel Bolluk not found in database');
    }
    console.log('HOTEL_FOUND:', hotel.id, hotel.name);

    // 2. Get Cliente Prueba
    const customersList = await getCustomersByHotel(hotel.id);
    const customer = customersList.find((c) => c.name === 'Cliente Prueba') || customersList[0];
    if (!customer) {
      throw new Error('Cliente Prueba not found in database');
    }
    console.log('CUSTOMER_FOUND:', customer.id, customer.name);

    // 3. Get Habitación Doble
    const roomTypesList = await getRoomTypesByHotel(hotel.id);
    const roomType = roomTypesList.find((rt) => rt.name === 'Habitación Doble') || roomTypesList[0];
    if (!roomType) {
      throw new Error('Habitación Doble room type not found in database');
    }
    console.log('ROOM_TYPE_FOUND:', roomType.id, roomType.name);

    // 4. Get Habitación 101
    const roomsList = await getRoomsByHotel(hotel.id);
    const room = roomsList.find((r) => r.number === '101') || roomsList[0];
    if (!room) {
      throw new Error('Habitación 101 room not found in database');
    }
    console.log('ROOM_FOUND:', room.id, room.number);

    // 5. Generate unique legible reservationCode
    const reservationCode = generateReservationCode('BOL');
    console.log('GENERATED_CODE:', reservationCode);

    // 6. Insert single test reservation
    const checkInDate = new Date('2026-10-15T14:00:00Z');
    const checkOutDate = new Date('2026-10-17T10:00:00Z');

    const inserted = await createReservation({
      reservationCode,
      hotelId: hotel.id,
      customerId: customer.id,
      roomTypeId: roomType.id,
      roomId: room.id,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      guests: 2,
      totalAmount: '86000',
      depositAmount: '0',
      reservationStatus: 'PENDING',
      paymentStatus: 'NOT_REQUIRED',
      source: 'DIRECT',
      notes: 'Reserva de prueba PostgreSQL',
    });
    console.log('RESERVATION_INSERTED:', JSON.stringify(inserted, null, 2));

    // 7. Read reservation from PostgreSQL
    const fetchedById = await getReservationById(inserted.id);
    const fetchedByCode = await getReservationByCode(reservationCode);
    const details = await getReservationWithDetails(inserted.id);

    console.log('FETCHED_BY_ID:', JSON.stringify(fetchedById, null, 2));
    console.log('FETCHED_WITH_DETAILS:', JSON.stringify(details, null, 2));

    // 8. Detailed verifications
    const reservationExists = Boolean(fetchedById && fetchedById.id === inserted.id);
    const codeMatch = Boolean(
      fetchedByCode &&
      fetchedByCode.reservationCode === reservationCode &&
      fetchedByCode.id === inserted.id
    );
    const hotelRelationOk = Boolean(
      details &&
      details.reservation.hotelId === hotel.id &&
      details.hotel.id === hotel.id &&
      details.hotel.name === 'Hotel Bolluk'
    );
    const customerRelationOk = Boolean(
      details &&
      details.reservation.customerId === customer.id &&
      details.customer.id === customer.id &&
      details.customer.name === 'Cliente Prueba'
    );
    const roomTypeRelationOk = Boolean(
      details &&
      details.reservation.roomTypeId === roomType.id &&
      details.roomType.id === roomType.id &&
      details.roomType.name === 'Habitación Doble'
    );
    const roomRelationOk = Boolean(
      details &&
      details.reservation.roomId === room.id &&
      details.room !== null &&
      details.room.id === room.id &&
      details.room.number === '101'
    );
    const guestsOk = Boolean(fetchedById && fetchedById.guests === 2);
    const statusOk = Boolean(
      fetchedById &&
      fetchedById.reservationStatus === 'PENDING' &&
      fetchedById.paymentStatus === 'NOT_REQUIRED'
    );

    console.log('VERIFICATION_SUMMARY:', {
      reservationExists,
      codeMatch,
      hotelRelationOk,
      customerRelationOk,
      roomTypeRelationOk,
      roomRelationOk,
      guestsOk,
      statusOk,
    });

    const pool = createPool();
    await pool.end();
    process.exit(0);
  } catch (err: any) {
    console.error('ERROR_TESTING_RESERVATION:', err);
    process.exit(1);
  }
}

run();
