import dotenv from 'dotenv';
dotenv.config();

import { createHotel, getHotelById, getHotels } from '../src/db/hotels.ts';
import { createPool } from '../src/db/index.ts';

async function run() {
  try {
    console.log('--- Testing Hotel Insert & Read ---');
    
    // 1. Insert single test record: name: "Hotel Bolluk"
    const inserted = await createHotel({
      name: 'Hotel Bolluk',
    });

    console.log('HOTEL_INSERTED_DATA:', JSON.stringify(inserted));

    const hasId = Boolean(inserted && inserted.id && typeof inserted.id === 'string' && inserted.id.length > 10);
    console.log('HOTEL_ID_VALID:', hasId);

    // 2. Read that record by id from postgres
    const fetchedById = await getHotelById(inserted.id);
    console.log('FETCHED_BY_ID:', JSON.stringify(fetchedById));

    // 3. Read via getHotels
    const allHotels = await getHotels();
    console.log('TOTAL_HOTELS:', allHotels.length);

    const matches = fetchedById && fetchedById.id === inserted.id && fetchedById.name === 'Hotel Bolluk';
    console.log('READ_VERIFIED:', matches);

    // Exit cleanly
    const pool = createPool();
    await pool.end();
    process.exit(0);
  } catch (err: any) {
    console.error('ERROR_DURING_TEST:', err);
    process.exit(1);
  }
}

run();
