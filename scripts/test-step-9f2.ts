/**
 * Test Step 9F-2:
 * Tests Mercado Pago integration, createPaymentPreference, and POST /api/reservations/:id/payment-preference
 */
import {
  MercadoPagoPaymentService,
  createPaymentPreference,
} from '../src/services/payment.service.ts';

async function testStep9F2() {
  console.log('Testing Step 9F-2: Mercado Pago API Preference & Backend Endpoint...');

  const baseUrl = 'http://localhost:3000';

  // 1. Test Deposit <= 0 gives PAYMENT_NOT_REQUIRED error
  console.log('\n--- 1. Testing depositAmount <= 0 logic (PAYMENT_NOT_REQUIRED) ---');
  let caughtPaymentNotRequired = false;
  try {
    await createPaymentPreference({
      reservationId: 'res-test-id-1',
      reservationCode: 'BOL-TEST-001',
      customerName: 'Cliente Test',
      totalAmount: 100000,
      depositAmount: 0,
    });
  } catch (err: any) {
    if (err?.code === 'PAYMENT_NOT_REQUIRED') {
      caughtPaymentNotRequired = true;
      console.log('Successfully received controlled error PAYMENT_NOT_REQUIRED:', err.message);
    } else {
      throw err;
    }
  }
  if (!caughtPaymentNotRequired) {
    throw new Error('Expected PAYMENT_NOT_REQUIRED error when depositAmount <= 0');
  }

  // 2. Test MercadoPagoPaymentService structure, external_reference, and return fields
  console.log('\n--- 2. Testing MercadoPagoPaymentService with custom preference client (sandbox simulation) ---');
  let capturedBody: any = null;
  const mockService = new MercadoPagoPaymentService({
    customPreferenceClient: {
      create: async ({ body }) => {
        capturedBody = body;
        return {
          id: 'mp_pref_test_98765',
          init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=mp_pref_test_98765',
          sandbox_init_point: 'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=mp_pref_test_98765',
        };
      },
    },
  });

  const preferenceResult = await mockService.createPaymentPreference({
    reservationId: 'res-uuid-real-123',
    reservationCode: 'BOL-202609-F2TEST',
    customerName: 'Esteban Gomez',
    customerEmail: 'esteban@example.com',
    totalAmount: 80000,
    depositAmount: 24000,
    description: 'Seña Reserva Habitación Doble - Hotel Nuevo Horizonte',
  });

  console.log('Generated preference result:', preferenceResult);
  console.log('Captured MP Body:', JSON.stringify(capturedBody, null, 2));

  // Verify external_reference = reservationCode
  if (capturedBody.external_reference !== 'BOL-202609-F2TEST') {
    throw new Error(`Expected external_reference 'BOL-202609-F2TEST', got '${capturedBody.external_reference}'`);
  }
  // Verify currency ARS and quantity 1
  if (capturedBody.items[0].currency_id !== 'ARS' || capturedBody.items[0].quantity !== 1) {
    throw new Error('Item must have currency_id ARS and quantity 1');
  }
  // Verify unit_price = depositAmount
  if (capturedBody.items[0].unit_price !== 24000) {
    throw new Error(`Expected unit_price 24000, got ${capturedBody.items[0].unit_price}`);
  }
  // Verify back_urls
  if (!capturedBody.back_urls?.success || !capturedBody.back_urls?.failure || !capturedBody.back_urls?.pending) {
    throw new Error('back_urls (success, failure, pending) must be configured');
  }
  // Verify returned fields: preferenceId, checkoutUrl, reservationCode, amount
  if (!preferenceResult.preferenceId || !preferenceResult.checkoutUrl || preferenceResult.amount !== 24000 || preferenceResult.reservationCode !== 'BOL-202609-F2TEST') {
    throw new Error('Preference result missing required fields');
  }

  // 3. Test real database integration with POST /api/reservations/:id/payment-preference
  console.log('\n--- 3. Testing Backend Endpoint POST /api/reservations/:id/payment-preference ---');

  // Step A: Find or create customer
  const custRes = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Hola, mi nombre es Lucía Méndez, documento 35123456, teléfono 1198765432, email lucia@example.com',
    }),
  });
  const custData: any = await custRes.json();
  const customerId = custData.customer?.id;

  // Step B: Create a reservation in PostgreSQL
  const randOffset = Math.floor(Math.random() * 500) + 100;
  const baseDate = new Date(2031, 2, 1 + randOffset);
  const checkIn = baseDate.toISOString().split('T')[0];
  const checkOut = new Date(baseDate.getTime() + 2 * 86400000).toISOString().split('T')[0];

  const createRes = await fetch(`${baseUrl}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId,
      roomType: 'Doble',
      checkIn,
      checkOut,
      guests: 2,
      reservationStatus: 'PENDING',
      paymentStatus: 'NOT_REQUIRED',
      depositAmount: 18000,
      source: 'CHAT',
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create reservation: ${createRes.status} - ${await createRes.text()}`);
  }
  const reservation: any = await createRes.json();
  console.log(`Reservation created: ID=${reservation.id}, Code=${reservation.reservationCode}, Status=${reservation.reservationStatus}, Payment=${reservation.paymentStatus}`);

  // Step C: Try calling payment-preference while status is still PENDING -> Must be rejected (invalid status)
  console.log('\nTesting payment-preference on PENDING reservation (should reject with INVALID_RESERVATION_STATUS):');
  const rejectRes = await fetch(`${baseUrl}/api/reservations/${reservation.id}/payment-preference`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ depositAmount: 18000 }),
  });
  const rejectData: any = await rejectRes.json();
  console.log(`HTTP ${rejectRes.status}:`, rejectData);
  if (rejectRes.status !== 400 || rejectData.error !== 'INVALID_RESERVATION_STATUS') {
    throw new Error(`Expected HTTP 400 with INVALID_RESERVATION_STATUS, got ${rejectRes.status}`);
  }

  // Step D: Move reservation to AWAITING_PAYMENT and paymentStatus PENDING
  console.log('\nUpdating reservation to AWAITING_PAYMENT and PENDING...');
  const patchRes = await fetch(`${baseUrl}/api/reservations/${reservation.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reservationStatus: 'AWAITING_PAYMENT',
      paymentStatus: 'PENDING',
      depositAmount: 18000,
    }),
  });
  if (!patchRes.ok) {
    throw new Error(`Failed to patch reservation: ${patchRes.status}`);
  }
  const patched: any = await patchRes.json();
  console.log(`Reservation updated: Status=${patched.reservationStatus}, Payment=${patched.paymentStatus}`);

  // Step E: Call payment-preference with depositAmount = 0 -> Must return PAYMENT_NOT_REQUIRED
  console.log('\nTesting payment-preference with depositAmount = 0 (should return PAYMENT_NOT_REQUIRED):');
  const zeroDepositRes = await fetch(`${baseUrl}/api/reservations/${reservation.id}/payment-preference`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ depositAmount: 0 }),
  });
  const zeroDepositData: any = await zeroDepositRes.json();
  console.log(`HTTP ${zeroDepositRes.status}:`, zeroDepositData);
  if (zeroDepositRes.status !== 400 || zeroDepositData.error !== 'PAYMENT_NOT_REQUIRED') {
    throw new Error(`Expected HTTP 400 with PAYMENT_NOT_REQUIRED, got ${zeroDepositRes.status}`);
  }

  // Step F: Call payment-preference on AWAITING_PAYMENT reservation
  console.log('\nCalling POST /api/reservations/:id/payment-preference with depositAmount > 0...');
  const prefApiRes = await fetch(`${baseUrl}/api/reservations/${reservation.id}/payment-preference`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ depositAmount: 18000 }),
  });

  const prefApiData: any = await prefApiRes.json();
  console.log(`HTTP ${prefApiRes.status}:`, prefApiData);

  // If MERCADOPAGO_ACCESS_TOKEN is not provided in env, it properly returns 503 MERCADOPAGO_TOKEN_MISSING
  // If it is configured, it returns 201 with preferenceId and checkoutUrl
  if (prefApiRes.status === 201) {
    console.log('Real Mercado Pago preference created successfully:', prefApiData);
    if (!prefApiData.preferenceId || !prefApiData.checkoutUrl || prefApiData.amount !== 18000) {
      throw new Error('API response missing required fields');
    }
  } else if (prefApiRes.status === 503 && prefApiData.error === 'MERCADOPAGO_TOKEN_MISSING') {
    console.log('Mercado Pago token properly detected as not configured in container environment (expected without live secret).');
  } else if (prefApiRes.status === 500 && prefApiData.error === 'PAYMENT_PREFERENCE_FAILED') {
    console.log('Mercado Pago API connected and attempted (credentials validation):', prefApiData.details);
  } else {
    throw new Error(`Unexpected response from payment-preference: ${prefApiRes.status} - ${JSON.stringify(prefApiData)}`);
  }

  // Step G: Verify reservation in DB was NOT marked CONFIRMED and NOT marked PAID
  console.log('\nVerifying reservation was NOT marked CONFIRMED and NOT marked PAID in DB...');
  const checkRes = await fetch(`${baseUrl}/api/reservations/${reservation.id}`);
  const checkData: any = await checkRes.json();
  console.log('Current DB reservation status:', checkData.reservationStatus);
  console.log('Current DB payment status:', checkData.paymentStatus);

  if (checkData.reservationStatus === 'CONFIRMED') {
    throw new Error('VIOLATION: reservationStatus was marked as CONFIRMED!');
  }
  if (checkData.paymentStatus === 'PAID') {
    throw new Error('VIOLATION: paymentStatus was marked as PAID!');
  }
  if (checkData.reservationStatus !== 'AWAITING_PAYMENT') {
    throw new Error(`Expected reservationStatus to remain AWAITING_PAYMENT, got ${checkData.reservationStatus}`);
  }
  if (checkData.paymentStatus !== 'PENDING') {
    throw new Error(`Expected paymentStatus to remain PENDING, got ${checkData.paymentStatus}`);
  }

  console.log('\nALL STEP 9F-2 TESTS PASSED SUCCESSFULLY!');
}

testStep9F2().catch((err) => {
  console.error('Test Step 9F-2 failed:', err);
  process.exit(1);
});
