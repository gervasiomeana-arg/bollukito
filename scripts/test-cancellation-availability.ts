import dotenv from 'dotenv';
dotenv.config();

import { getHotels } from '../src/db/hotels.ts';
import { getRoomsByHotel, isRoomAvailable } from '../src/db/rooms.ts';
import { getCustomersByHotel } from '../src/db/customers.ts';
import { getRoomTypesByHotel } from '../src/db/room-types.ts';
import { createPool } from '../src/db/index.ts';

async function runTest() {
  try {
    console.log('--- Step 8C-4: Testing Reservation Cancellation & Room Availability ---');

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

    // Pick unique dates for test: 2027-11-10 to 2027-11-13
    const checkIn = '2027-11-10T14:00:00Z';
    const checkOut = '2027-11-13T10:00:00Z';
    const guests = 2;

    // Step A: Create active reservation for Habitación 101 (CONFIRMED)
    console.log('Step A: Creating active reservation for room 101...');
    const createRes = await fetch('http://localhost:3000/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hotelId: hotel.id,
        customerId: customer.id,
        roomTypeId: dobleType.id,
        roomId: room101.id,
        checkIn,
        checkOut,
        guests,
        totalAmount: 129000,
        reservationStatus: 'CONFIRMED',
        notes: 'Test Step 8C-4 Active to Cancelled',
      }),
    });

    const reservation = await createRes.json();
    console.log('Created reservation ID:', reservation.id, 'Status:', reservation.reservationStatus);

    // Step B: Consult availability for same dates -> room 101 must be NOT available
    console.log('Step B: Checking availability while reservation is CONFIRMED...');
    const availableWhileActive = await isRoomAvailable(room101.id, checkIn, checkOut, guests);
    console.log('Available while active:', availableWhileActive, '(expected: false)');
    const activeReservationBlocksRoom = availableWhileActive === false;

    // Step C: Update reservation to CANCELLED via existing PATCH /api/reservations/:id
    console.log('Step C: Updating reservation to CANCELLED using PATCH...');
    const patchRes = await fetch(`http://localhost:3000/api/reservations/${reservation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservationStatus: 'CANCELLED',
      }),
    });

    const patchData = await patchRes.json();
    console.log('PATCH response status:', patchRes.status);
    console.log('PATCH response reservationStatus:', patchData.reservationStatus);
    const patchFlowPreserved = patchRes.status === 200 && patchData.reservationStatus === 'CANCELLED';

    // Step D: Consult availability again for same dates -> room 101 must be available
    console.log('Step D: Checking availability after CANCELLED...');
    const availableAfterCancelled = await isRoomAvailable(room101.id, checkIn, checkOut, guests);
    console.log('Available after CANCELLED:', availableAfterCancelled, '(expected: true)');
    const cancelledReservationReleasesRoom = availableAfterCancelled === true;

    // Step E: Verify COMPLETED does not block
    console.log('Step E: Testing COMPLETED status...');
    await fetch(`http://localhost:3000/api/reservations/${reservation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationStatus: 'COMPLETED' }),
    });
    const availableCompleted = await isRoomAvailable(room101.id, checkIn, checkOut, guests);
    const completedDoesNotBlock = availableCompleted === true;
    console.log('Available when COMPLETED:', availableCompleted, '(expected: true)');

    // Step F: Verify NO_SHOW does not block
    console.log('Step F: Testing NO_SHOW status...');
    await fetch(`http://localhost:3000/api/reservations/${reservation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationStatus: 'NO_SHOW' }),
    });
    const availableNoShow = await isRoomAvailable(room101.id, checkIn, checkOut, guests);
    const noShowDoesNotBlock = availableNoShow === true;
    console.log('Available when NO_SHOW:', availableNoShow, '(expected: true)');

    console.log('--- FINAL RESULTS ---');
    console.log('ACTIVE RESERVATION BLOCKS ROOM:', activeReservationBlocksRoom ? 'SI' : 'NO');
    console.log('CANCELLED RESERVATION RELEASES ROOM:', cancelledReservationReleasesRoom ? 'SI' : 'NO');
    console.log('COMPLETED DOES NOT BLOCK:', completedDoesNotBlock ? 'SI' : 'NO');
    console.log('NO_SHOW DOES NOT BLOCK:', noShowDoesNotBlock ? 'SI' : 'NO');
    console.log('PATCH FLOW PRESERVED:', patchFlowPreserved ? 'SI' : 'NO');

    const pool = createPool();
    await pool.end();
    process.exit(0);
  } catch (err: any) {
    console.error('ERROR_TESTING:', err);
    process.exit(1);
  }
}

runTest();
