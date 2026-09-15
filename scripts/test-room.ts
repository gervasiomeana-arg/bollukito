import dotenv from 'dotenv';
dotenv.config();

import { getHotels } from '../src/db/hotels.ts';
import { getRoomTypesByHotel } from '../src/db/room-types.ts';
import { createRoom, getRoomById, getRoomsByHotel, getRoomsByRoomType } from '../src/db/rooms.ts';
import { createPool } from '../src/db/index.ts';

async function run() {
  try {
    console.log('--- Testing Room Insert & Read ---');

    // 1. Get Hotel Bolluk
    const hotelsList = await getHotels();
    const hotel = hotelsList.find((h) => h.name === 'Hotel Bolluk') || hotelsList[0];
    if (!hotel) {
      throw new Error('Hotel Bolluk not found');
    }
    console.log('HOTEL_ID:', hotel.id);

    // 2. Get Habitación Doble
    const roomTypes = await getRoomTypesByHotel(hotel.id);
    const roomType = roomTypes.find((rt) => rt.name === 'Habitación Doble') || roomTypes[0];
    if (!roomType) {
      throw new Error('Habitación Doble room type not found');
    }
    console.log('ROOM_TYPE_ID:', roomType.id);

    // 3. Insert single test room
    const inserted = await createRoom({
      hotelId: hotel.id,
      roomTypeId: roomType.id,
      number: '101',
      status: 'AVAILABLE',
      active: true,
    });
    console.log('ROOM_INSERTED:', JSON.stringify(inserted));

    // 4. Read room from PostgreSQL
    const fetched = await getRoomById(inserted.id);
    console.log('FETCHED_BY_ID:', JSON.stringify(fetched));

    // 5. Verifications
    const exists = Boolean(fetched && fetched.id === inserted.id);
    const hotelRelationOk = Boolean(fetched && fetched.hotelId === hotel.id);
    const roomTypeRelationOk = Boolean(fetched && fetched.roomTypeId === roomType.id);
    const numberOk = Boolean(fetched && fetched.number === '101');
    const statusOk = Boolean(fetched && fetched.status === 'AVAILABLE');
    const activeOk = Boolean(fetched && fetched.active === true);

    console.log('VALIDATION_RESULTS:', {
      exists,
      hotelRelationOk,
      roomTypeRelationOk,
      numberOk,
      statusOk,
      activeOk,
    });

    const hotelRooms = await getRoomsByHotel(hotel.id);
    const typeRooms = await getRoomsByRoomType(roomType.id);
    console.log('TOTAL_ROOMS_HOTEL:', hotelRooms.length);
    console.log('TOTAL_ROOMS_TYPE:', typeRooms.length);

    const pool = createPool();
    await pool.end();
    process.exit(0);
  } catch (err: any) {
    console.error('ERROR_TESTING_ROOM:', err);
    process.exit(1);
  }
}

run();
