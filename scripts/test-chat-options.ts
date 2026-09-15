import dotenv from 'dotenv';
dotenv.config();

import { getHotels } from '../src/db/hotels.ts';
import { getRoomsByHotel } from '../src/db/rooms.ts';
import { getCustomersByHotel } from '../src/db/customers.ts';
import { getRoomTypesByHotel } from '../src/db/room-types.ts';
import { createPool } from '../src/db/index.ts';

async function testChatOptions() {
  console.log('--- Step 9B: Testing Structured availableOptions in /api/chat ---');

  const hotels = await getHotels();
  const hotel = hotels.find((h) => h.name === 'Hotel Bolluk') || hotels[0];
  const allDbRooms = await getRoomsByHotel(hotel.id);
  const allDbRoomTypes = await getRoomTypesByHotel(hotel.id);
  const customers = await getCustomersByHotel(hotel.id);
  const customer = customers[0];

  const dobleType = allDbRoomTypes.find((rt) => rt.name.includes('Doble')) || allDbRoomTypes[0];

  // Test A: Dates with availability
  console.log('\n--- Test A: Dates with Availability ---');
  // Free dates: 2029-01-10 to 2029-01-15, 2 guests
  const resAvailable = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: '¿Tienen disponibilidad para 2 personas del 2029-01-10 al 2029-01-15?',
    }),
  });

  const dataAvailable = await resAvailable.json();
  console.log('Response status:', resAvailable.status);
  console.log('Reply text:', dataAvailable.reply);
  console.log('availableOptions count:', dataAvailable.availableOptions?.length);
  console.log('availableOptions:', JSON.stringify(dataAvailable.availableOptions, null, 2));

  const availableOptionsAdded = Array.isArray(dataAvailable.availableOptions) && dataAvailable.availableOptions.length > 0;

  // Test C: Verify that roomId and roomTypeId correspond to PostgreSQL
  let realPostgresDataReturned = true;
  for (const opt of dataAvailable.availableOptions || []) {
    const matchingRoom = allDbRooms.find((r) => r.id === opt.roomId && r.number === opt.roomNumber);
    const matchingType = allDbRoomTypes.find((rt) => rt.id === opt.roomTypeId);
    if (!matchingRoom || !matchingType) {
      console.error('Mismatch with PostgreSQL for option:', opt);
      realPostgresDataReturned = false;
    }
  }

  // Test Max 3 Options
  const max3OptionsWorks = dataAvailable.availableOptions.length <= 3 && dataAvailable.availableOptions.length > 0;

  // Test B: Dates without availability
  console.log('\n--- Test B: Dates without Availability ---');
  // Overlap dates with an active reservation
  const occupiedCheckIn = '2029-02-01T14:00:00Z';
  const occupiedCheckOut = '2029-02-05T10:00:00Z';

  // Reserve all rooms that match Doble (room 101)
  const room101 = allDbRooms.find((r) => r.number === '101');
  if (room101) {
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
        notes: 'Occupied blocker for Step 9B',
      }),
    });
  }

  const resOccupied = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: '¿Tienen habitación doble para 2 personas del 2029-02-02 al 2029-02-04?',
    }),
  });

  const dataOccupied = await resOccupied.json();
  console.log('Occupied reply:', dataOccupied.reply);
  console.log('Occupied availableOptions:', dataOccupied.availableOptions);

  const noAvailabilityReturnsEmptyArray =
    Array.isArray(dataOccupied.availableOptions) &&
    dataOccupied.availableOptions.length === 0 &&
    dataOccupied.reply === 'No tengo disponibilidad para esas fechas.';

  // Test General Chat Preserved
  console.log('\n--- Test: Chat Format Preserved ---');
  const resGeneral = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Hola Bollukito, ¿a qué hora es el desayuno?',
    }),
  });
  const dataGeneral = await resGeneral.json();
  console.log('General chat response reply exists:', typeof dataGeneral.reply === 'string');
  console.log('General chat availableOptions:', dataGeneral.availableOptions);

  const chatFormatPreserved =
    typeof dataGeneral.reply === 'string' &&
    Array.isArray(dataGeneral.availableOptions) &&
    typeof dataAvailable.reply === 'string';

  console.log('\n--- FINAL VERIFICATION RESULTS ---');
  console.log('AVAILABLE OPTIONS ADDED:', availableOptionsAdded ? 'SI' : 'NO');
  console.log('REAL POSTGRES DATA RETURNED:', realPostgresDataReturned ? 'SI' : 'NO');
  console.log('MAX 3 OPTIONS WORKS:', max3OptionsWorks ? 'SI' : 'NO');
  console.log('NO AVAILABILITY RETURNS EMPTY ARRAY:', noAvailabilityReturnsEmptyArray ? 'SI' : 'NO');
  console.log('CHAT FORMAT PRESERVED:', chatFormatPreserved ? 'SI' : 'NO');

  const pool = createPool();
  await pool.end();
}

testChatOptions().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
