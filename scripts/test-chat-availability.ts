import dotenv from 'dotenv';
dotenv.config();

import { getHotels } from '../src/db/hotels.ts';
import { getRoomsByHotel } from '../src/db/rooms.ts';
import { getCustomersByHotel } from '../src/db/customers.ts';
import { getRoomTypesByHotel } from '../src/db/room-types.ts';
import { createPool } from '../src/db/index.ts';

async function testChatAvailability() {
  console.log('--- Step 9A: Testing Chat Availability Integration ---');

  const hotels = await getHotels();
  const hotel = hotels.find((h) => h.name === 'Hotel Bolluk') || hotels[0];
  const rooms = await getRoomsByHotel(hotel.id);
  const room101 = rooms.find((r) => r.number === '101') || rooms[0];
  const customers = await getCustomersByHotel(hotel.id);
  const customer = customers[0];
  const roomTypes = await getRoomTypesByHotel(hotel.id);
  const dobleType = roomTypes.find((rt) => rt.name.includes('Doble')) || roomTypes[0];

  // 1. Test Intent Detection & Missing Data
  console.log('\n--- 1. Testing Missing Data Handling ---');
  
  // Test 1a: "¿Tenés habitación doble para el viernes?" (Missing checkOut/nights)
  const res1 = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '¿Tenés habitación doble para el viernes?' }),
  });
  const data1 = await res1.json();
  console.log('1a. "¿Tenés habitación doble para el viernes?":', data1.reply);

  // Test 1b: "¿Tienen disponibilidad?" (Missing dates)
  const res2 = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '¿Tienen disponibilidad?' }),
  });
  const data2 = await res2.json();
  console.log('1b. "¿Tienen disponibilidad?":', data2.reply);

  // Test 1c: "Quiero reservar para mañana" (Missing checkOut/guests)
  const res3 = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Quiero reservar para mañana' }),
  });
  const data3 = await res3.json();
  console.log('1c. "Quiero reservar para mañana":', data3.reply);

  // Test 1d: "del 20 al 22 de diciembre de 2028" (Missing guests)
  const res4 = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Tienen lugar del 20 al 22 de diciembre de 2028?' }),
  });
  const data4 = await res4.json();
  console.log('1d. "Tienen lugar del 20 al 22...":', data4.reply);

  const chatDetectsAvailabilityIntent = Boolean(data1.reply && data2.reply && data3.reply && data4.reply);
  const missingDataHandled =
    data2.reply.includes('¿Para qué fecha sería la estadía?') &&
    data4.reply.includes('¿Para cuántas personas sería la estadía?');

  console.log('CHAT DETECTS AVAILABILITY INTENT:', chatDetectsAvailabilityIntent ? 'SI' : 'NO');
  console.log('MISSING DATA HANDLED:', missingDataHandled ? 'SI' : 'NO');

  // 2. Test Real Available query
  console.log('\n--- 2. Testing Real Availability (Available Dates) ---');
  // Free dates: 2028-06-10 to 2028-06-15, 2 guests
  const resAvailable = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Somos 2 personas del 2028-06-10 al 2028-06-15 para habitacion doble',
    }),
  });
  const dataAvailable = await resAvailable.json();
  console.log('Available query reply:', dataAvailable.reply);
  console.log('Available query availableRooms count:', dataAvailable.availableRooms?.length);
  console.log('Available query availableRooms:', dataAvailable.availableRooms);

  const realAvailabilityUsed =
    dataAvailable.available === true &&
    dataAvailable.reply.includes('Sí, tengo disponibilidad para esas fechas') &&
    Array.isArray(dataAvailable.availableRooms) &&
    dataAvailable.availableRooms.length > 0;

  console.log('REAL AVAILABILITY USED:', realAvailabilityUsed ? 'SI' : 'NO');

  // 3. Test Real Occupied query (Overbooked dates)
  console.log('\n--- 3. Testing Real Availability (Occupied / No Availability) ---');
  // First ensure there is a confirmed reservation occupying room 101 on test dates
  const occupiedCheckIn = '2028-07-01T14:00:00Z';
  const occupiedCheckOut = '2028-07-05T10:00:00Z';

  // Reserve room 101 (only doble room)
  await fetch('http://localhost:3000/api/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hotelId: hotel.id,
      customerId: customer.id,
      roomTypeId: dobleType.id,
      roomId: room101.id,
      checkIn: occupiedCheckIn,
      checkOut: occupiedCheckOut,
      guests: 2,
      totalAmount: 129000,
      reservationStatus: 'CONFIRMED',
      notes: 'Occupied blocker for Step 9A chat test',
    }),
  });

  // Now ask chat for that occupied date range specifically for Habitación Doble
  const resOccupied = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: '¿Tenés habitación doble para 2 personas del 2028-07-02 al 2028-07-04?',
    }),
  });
  const dataOccupied = await resOccupied.json();
  console.log('Occupied query reply:', dataOccupied.reply);
  console.log('Occupied query availableRooms:', dataOccupied.availableRooms);
  console.log('Occupied query reservationOffer:', dataOccupied.reservationOffer);

  const noInventedRooms =
    dataOccupied.available === false &&
    dataOccupied.reply === 'No tengo disponibilidad para esas fechas.' &&
    Array.isArray(dataOccupied.availableRooms) &&
    dataOccupied.availableRooms.length === 0 &&
    dataOccupied.reservationOffer === null;

  console.log('NO INVENTED ROOMS:', noInventedRooms ? 'SI' : 'NO');

  console.log('\n--- SUMMARY ---');
  console.log('CHAT DETECTS AVAILABILITY INTENT:', chatDetectsAvailabilityIntent ? 'SI' : 'NO');
  console.log('MISSING DATA HANDLED:', missingDataHandled ? 'SI' : 'NO');
  console.log('REAL AVAILABILITY USED:', realAvailabilityUsed ? 'SI' : 'NO');
  console.log('NO INVENTED ROOMS:', noInventedRooms ? 'SI' : 'NO');

  const pool = createPool();
  await pool.end();
}

testChatAvailability().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
