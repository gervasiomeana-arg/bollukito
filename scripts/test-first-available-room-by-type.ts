import dotenv from 'dotenv';
dotenv.config();

import { getHotels } from '../src/db/hotels.ts';
import { getRoomTypesByHotel } from '../src/db/room-types.ts';
import { getFirstAvailableRoomByType } from '../src/db/rooms.ts';
import { getReservationsByHotel } from '../src/db/reservations.ts';
import { createPool } from '../src/db/index.ts';

async function runTest() {
  try {
    console.log('--- Step 8C-3A: Testing getFirstAvailableRoomByType ---');

    const hotels = await getHotels();
    const hotel = hotels.find((h) => h.name === 'Hotel Bolluk') || hotels[0];
    if (!hotel) throw new Error('Hotel not found');

    const roomTypes = await getRoomTypesByHotel(hotel.id);
    const dobleType = roomTypes.find((rt) => rt.name.includes('Doble')) || roomTypes[0];
    if (!dobleType) throw new Error('Room type Doble not found');

    console.log('HOTEL:', hotel.name, hotel.id);
    console.log('ROOM_TYPE:', dobleType.name, dobleType.id);

    // Test A: Dates with availability
    const freeCheckIn = '2027-08-01T14:00:00Z';
    const freeCheckOut = '2027-08-04T10:00:00Z';
    const availableRoom = await getFirstAvailableRoomByType(
      hotel.id,
      dobleType.id,
      freeCheckIn,
      freeCheckOut,
      2
    );

    console.log('TEST_A_AVAILABLE_ROOM:', availableRoom);
    const availableTypeReturnsRoom =
      Boolean(availableRoom) &&
      availableRoom?.roomTypeId === dobleType.id &&
      typeof availableRoom?.number === 'string';

    // Test B: Dates without availability (using occupied dates of existing reservation)
    const allReservations = await getReservationsByHotel(hotel.id);
    const existingRes = allReservations.find(
      (r) => r.roomTypeId === dobleType.id && ['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED'].includes(r.reservationStatus)
    );
    if (!existingRes) throw new Error('No existing active reservation found for test');

    const unavailableRoom = await getFirstAvailableRoomByType(
      hotel.id,
      dobleType.id,
      existingRes.checkIn,
      existingRes.checkOut,
      2
    );

    console.log('TEST_B_UNAVAILABLE_ROOM:', unavailableRoom);
    const unavailableTypeReturnsNull = unavailableRoom === null;

    console.log('--- RESULTS ---');
    console.log('FUNCTION CREATED:', typeof getFirstAvailableRoomByType === 'function' ? 'SI' : 'NO');
    console.log('AVAILABLE TYPE RETURNS ROOM:', availableTypeReturnsRoom ? 'SI' : 'NO');
    console.log('UNAVAILABLE TYPE RETURNS NULL:', unavailableTypeReturnsNull ? 'SI' : 'NO');

    const pool = createPool();
    await pool.end();
    process.exit(0);
  } catch (err: any) {
    console.error('ERROR_TESTING:', err);
    process.exit(1);
  }
}

runTest();
