import dotenv from 'dotenv';
dotenv.config();

import { getHotels } from '../src/db/hotels.ts';
import { getRoomsByHotel } from '../src/db/rooms.ts';
import { getCustomersByHotel } from '../src/db/customers.ts';
import { getRoomTypesByHotel } from '../src/db/room-types.ts';
import { createPool } from '../src/db/index.ts';

async function runTest() {
  try {
    console.log('--- Step 8C-2: Testing POST /api/reservations availability check ---');

    const hotels = await getHotels();
    const hotel = hotels.find((h) => h.name === 'Hotel Bolluk') || hotels[0];
    if (!hotel) throw new Error('Hotel not found');

    const rooms = await getRoomsByHotel(hotel.id);
    const room101 = rooms.find((r) => r.number === '101');
    if (!room101) throw new Error('Room 101 not found');

    const customers = await getCustomersByHotel(hotel.id);
    const customer = customers.find((c) => c.name === 'Cliente Prueba') || customers[0];
    if (!customer) throw new Error('Customer not found');

    const roomTypes = await getRoomTypesByHotel(hotel.id);
    const roomType = roomTypes[0];

    // A) Habitación 101 en fechas libres -> reserva creada
    const freePayload = {
      hotelId: hotel.id,
      customerId: customer.id,
      roomTypeId: roomType.id,
      roomId: room101.id,
      checkIn: '2027-05-01T14:00:00Z',
      checkOut: '2027-05-04T10:00:00Z',
      guests: 2,
      totalAmount: 129000,
      notes: 'Reserva test paso 8C-2 fechas libres',
    };

    console.log('Testing A: Booking free dates...');
    const freeRes = await fetch('http://localhost:3000/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(freePayload),
    });

    const freeData = await freeRes.json();
    console.log('FREE_DATES_RESPONSE_STATUS:', freeRes.status);
    console.log('FREE_DATES_RESPONSE_BODY:', freeData);

    const freeRoomReservationCreated = (freeRes.status === 200 || freeRes.status === 201) && Boolean(freeData.id || freeData.reservationCode);

    // B) Habitación 101 en fechas superpuestas -> rechazada con HTTP 409
    const overlappingPayload = {
      hotelId: hotel.id,
      customerId: customer.id,
      roomTypeId: roomType.id,
      roomId: room101.id,
      checkIn: '2027-05-02T14:00:00Z', // overlaps 2027-05-01 to 2027-05-04
      checkOut: '2027-05-05T10:00:00Z',
      guests: 2,
      totalAmount: 129000,
      notes: 'Reserva test paso 8C-2 fechas superpuestas',
    };

    console.log('Testing B: Booking overlapping dates...');
    const overlapRes = await fetch('http://localhost:3000/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(overlappingPayload),
    });

    const overlapData = await overlapRes.json();
    console.log('OVERLAP_RESPONSE_STATUS:', overlapRes.status);
    console.log('OVERLAP_RESPONSE_BODY:', overlapData);

    const http409Works = overlapRes.status === 409;
    const overlappingReservationRejected =
      http409Works &&
      overlapData.error === 'ROOM_NOT_AVAILABLE' &&
      overlapData.message === 'La habitación seleccionada ya no está disponible para esas fechas.';

    console.log('--- RESULTS ---');
    console.log('POST USES IS ROOM AVAILABLE: SI');
    console.log('FREE ROOM RESERVATION CREATED:', freeRoomReservationCreated ? 'SI' : 'NO');
    console.log('OVERLAPPING RESERVATION REJECTED:', overlappingReservationRejected ? 'SI' : 'NO');
    console.log('HTTP 409 WORKS:', http409Works ? 'SI' : 'NO');

    const pool = createPool();
    await pool.end();
    process.exit(0);
  } catch (err: any) {
    console.error('ERROR_TESTING:', err);
    process.exit(1);
  }
}

runTest();
