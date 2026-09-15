import dotenv from 'dotenv';
dotenv.config();

import { getHotels } from '../src/db/hotels.ts';
import { createRoomType, getRoomTypeById, getRoomTypesByHotel } from '../src/db/room-types.ts';
import { createPool } from '../src/db/index.ts';

async function run() {
  try {
    console.log('--- Testing RoomType Insert & Read ---');

    // 1. Get existing Hotel Bolluk
    const hotelsList = await getHotels();
    const bollukHotel = hotelsList.find((h) => h.name === 'Hotel Bolluk') || hotelsList[0];

    if (!bollukHotel) {
      throw new Error('No hotel found in database');
    }

    console.log('USING_HOTEL_ID:', bollukHotel.id);

    // 2. Insert one test room type
    const inserted = await createRoomType({
      hotelId: bollukHotel.id,
      name: 'Habitación Doble',
      description: 'Habitación para dos huéspedes',
      capacity: 2,
      baseRate: '43000',
      active: true,
    });

    console.log('ROOM_TYPE_INSERTED:', JSON.stringify(inserted));

    // 3. Read room type by ID from PostgreSQL
    const fetched = await getRoomTypeById(inserted.id);
    console.log('FETCHED_BY_ID:', JSON.stringify(fetched));

    // 4. Verify validations
    const exists = Boolean(fetched && fetched.id === inserted.id);
    const hotelRelationOk = Boolean(fetched && fetched.hotelId === bollukHotel.id);
    const capacityOk = Boolean(fetched && fetched.capacity === 2);
    const baseRateOk = Boolean(fetched && Number(fetched.baseRate) === 43000);
    const activeOk = Boolean(fetched && fetched.active === true);

    console.log('VALIDATION_RESULTS:', {
      exists,
      hotelRelationOk,
      capacityOk,
      baseRateOk,
      activeOk,
    });

    // 5. Query by hotel as well
    const hotelRoomTypes = await getRoomTypesByHotel(bollukHotel.id);
    console.log('TOTAL_ROOM_TYPES_FOR_HOTEL:', hotelRoomTypes.length);

    const pool = createPool();
    await pool.end();
    process.exit(0);
  } catch (err: any) {
    console.error('ERROR_TESTING_ROOM_TYPE:', err);
    process.exit(1);
  }
}

run();
