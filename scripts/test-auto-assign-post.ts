import dotenv from 'dotenv';
dotenv.config();

import { getHotels } from '../src/db/hotels.ts';
import { getRoomsByHotel } from '../src/db/rooms.ts';
import { getCustomersByHotel } from '../src/db/customers.ts';
import { getRoomTypesByHotel } from '../src/db/room-types.ts';
import { getReservationsByHotel } from '../src/db/reservations.ts';
import { createPool } from '../src/db/index.ts';

async function runTest() {
  try {
    console.log('--- Step 8C-3B: Testing auto-assign room by roomTypeId in POST /api/reservations ---');

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
    const dobleType = roomTypes.find((rt) => rt.name.includes('Doble')) || roomTypes[0];

    // Case 1: roomId NOT provided, roomTypeId provided, available dates
    // Dates: 2027-09-01 to 2027-09-04
    console.log('Case 1: Creating reservation without roomId (auto-assign)...');
    const autoAssignPayload = {
      hotelId: hotel.id,
      customerId: customer.id,
      roomTypeId: dobleType.id,
      // NO roomId
      checkIn: '2027-09-01T14:00:00Z',
      checkOut: '2027-09-04T10:00:00Z',
      guests: 2,
      totalAmount: 129000,
      notes: 'Test auto-assign roomTypeId',
    };

    const res1 = await fetch('http://localhost:3000/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(autoAssignPayload),
    });

    const data1 = await res1.json();
    console.log('CASE_1_STATUS:', res1.status);
    console.log('CASE_1_DATA:', data1);

    const autoAssignConnectedToPost = (res1.status === 200 || res1.status === 201) && Boolean(data1.id);
    const roomIdSaved = Boolean(data1.roomId) && typeof data1.roomId === 'string';

    // Case 2: roomId NOT provided, roomTypeId provided, overlapping dates (no rooms available)
    // The previous reservation took 2027-09-01 to 2027-09-04 on room 101 (only room for doble).
    console.log('Case 2: Creating reservation without roomId on occupied dates (should return 409)...');
    const occupiedPayload = {
      hotelId: hotel.id,
      customerId: customer.id,
      roomTypeId: dobleType.id,
      // NO roomId
      checkIn: '2027-09-02T14:00:00Z',
      checkOut: '2027-09-05T10:00:00Z',
      guests: 2,
      totalAmount: 129000,
      notes: 'Test auto-assign occupied',
    };

    const res2 = await fetch('http://localhost:3000/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(occupiedPayload),
    });

    const data2 = await res2.json();
    console.log('CASE_2_STATUS:', res2.status);
    console.log('CASE_2_DATA:', data2);

    const noAvailabilityReturns409 =
      res2.status === 409 &&
      data2.error === 'ROOM_TYPE_NOT_AVAILABLE' &&
      data2.message === 'No hay habitaciones disponibles de este tipo para las fechas seleccionadas.';

    // Case 3: roomId IS provided flow preserved
    console.log('Case 3: Testing preserved flow when roomId is provided...');
    // A: with room 101 on overlapping dates -> 409 ROOM_NOT_AVAILABLE
    const res3 = await fetch('http://localhost:3000/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...occupiedPayload,
        roomId: room101.id,
      }),
    });
    const data3 = await res3.json();
    console.log('CASE_3_STATUS:', res3.status);
    console.log('CASE_3_DATA:', data3);

    const existingRoomIdFlowPreserved =
      res3.status === 409 &&
      data3.error === 'ROOM_NOT_AVAILABLE';

    console.log('--- FINAL RESULTS ---');
    console.log('AUTO ASSIGN CONNECTED TO POST:', autoAssignConnectedToPost ? 'SI' : 'NO');
    console.log('ROOM ID SAVED:', roomIdSaved ? 'SI' : 'NO');
    console.log('NO AVAILABILITY RETURNS 409:', noAvailabilityReturns409 ? 'SI' : 'NO');
    console.log('EXISTING ROOM ID FLOW PRESERVED:', existingRoomIdFlowPreserved ? 'SI' : 'NO');

    const pool = createPool();
    await pool.end();
    process.exit(0);
  } catch (err: any) {
    console.error('ERROR_TESTING:', err);
    process.exit(1);
  }
}

runTest();
