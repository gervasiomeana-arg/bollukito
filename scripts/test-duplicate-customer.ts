import dotenv from 'dotenv';
dotenv.config();

import { getHotels } from '../src/db/hotels.ts';
import { getCustomerByPhone, createCustomer, getCustomerById } from '../src/db/customers.ts';
import { createPool } from '../src/db/index.ts';

async function run() {
  try {
    console.log('--- Testing getCustomerByPhone & Duplicate Constraint ---');

    // 1. Get Hotel Bolluk
    const hotelsList = await getHotels();
    const hotel = hotelsList.find((h) => h.name === 'Hotel Bolluk') || hotelsList[0];
    if (!hotel) {
      throw new Error('Hotel Bolluk not found');
    }

    // 2. Test getCustomerByPhone
    const customer = await getCustomerByPhone(hotel.id, '2230000000');
    console.log('CUSTOMER_FOUND:', JSON.stringify(customer));

    const getCustomerOk = customer !== null;
    const correctCustomer = Boolean(
      customer &&
      customer.name === 'Cliente Prueba' &&
      customer.hotelId === hotel.id &&
      customer.phone === '2230000000'
    );

    // 3. Attempt to insert duplicate
    let duplicateRejected = false;
    let duplicateErrorMsg = '';

    try {
      await createCustomer({
        hotelId: hotel.id,
        name: 'Cliente Duplicado',
        phone: '2230000000',
        notes: 'Intento de duplicado',
      });
    } catch (err: any) {
      duplicateRejected = true;
      duplicateErrorMsg = err?.message || String(err);
      console.log('DUPLICATE_REJECTION_CONFIRMED:', duplicateErrorMsg);
    }

    // 4. Verify original customer preserved
    const originalPreservedCheck = customer?.id ? await getCustomerById(customer.id) : null;
    const originalCustomerPreserved = Boolean(
      originalPreservedCheck &&
      originalPreservedCheck.name === 'Cliente Prueba' &&
      originalPreservedCheck.phone === '2230000000' &&
      originalPreservedCheck.hotelId === hotel.id
    );

    console.log('SUMMARY_CHECKS:', {
      getCustomerOk,
      correctCustomer,
      duplicateRejected,
      originalCustomerPreserved,
    });

    const pool = createPool();
    await pool.end();

    if (!getCustomerOk || !correctCustomer || !duplicateRejected || !originalCustomerPreserved) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err: any) {
    console.error('ERROR_TEST:', err);
    process.exit(1);
  }
}

run();
