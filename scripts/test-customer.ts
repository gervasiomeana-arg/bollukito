import dotenv from 'dotenv';
dotenv.config();

import { getHotels } from '../src/db/hotels.ts';
import { createCustomer, getCustomerById, getCustomerByPhone } from '../src/db/customers.ts';
import { createPool } from '../src/db/index.ts';

async function run() {
  try {
    console.log('--- Testing Customer Insert & Read ---');

    // 1. Get Hotel Bolluk
    const hotelsList = await getHotels();
    const hotel = hotelsList.find((h) => h.name === 'Hotel Bolluk') || hotelsList[0];
    if (!hotel) {
      throw new Error('Hotel Bolluk not found');
    }
    console.log('HOTEL_ID:', hotel.id);

    // 2. Insert single test customer
    const inserted = await createCustomer({
      hotelId: hotel.id,
      name: 'Cliente Prueba',
      phone: '2230000000',
      email: null,
      document: null,
      notes: 'Cliente de prueba para validación PostgreSQL',
    });
    console.log('CUSTOMER_INSERTED:', JSON.stringify(inserted));

    // 3. Read customer from PostgreSQL
    const fetched = await getCustomerById(inserted.id);
    console.log('FETCHED_BY_ID:', JSON.stringify(fetched));

    // Also test by phone
    const fetchedByPhone = await getCustomerByPhone(hotel.id, '2230000000');
    console.log('FETCHED_BY_PHONE:', JSON.stringify(fetchedByPhone));

    // 4. Verifications
    const exists = Boolean(fetched && fetched.id === inserted.id);
    const nameOk = Boolean(fetched && fetched.name === 'Cliente Prueba');
    const phoneOk = Boolean(fetched && fetched.phone === '2230000000');
    const hotelRelationOk = Boolean(fetched && fetched.hotelId === hotel.id);

    console.log('VALIDATION_RESULTS:', {
      exists,
      nameOk,
      phoneOk,
      hotelRelationOk,
    });

    const pool = createPool();
    await pool.end();
    process.exit(0);
  } catch (err: any) {
    console.error('ERROR_TESTING_CUSTOMER:', err);
    process.exit(1);
  }
}

run();
