import dotenv from 'dotenv';
dotenv.config();

async function testPatch() {
  const BASE_URL = 'http://localhost:3000';

  console.log('--- Step 1: Getting existing reservation from PostgreSQL ---');
  const getResInitial = await fetch(`${BASE_URL}/api/reservations`);
  const initialList = await getResInitial.json();
  if (!Array.isArray(initialList) || initialList.length === 0) {
    throw new Error('No reservations found in database');
  }

  const target = initialList[0];
  console.log('TARGET_RESERVATION_ID:', target.id, target.bookingId);

  console.log('\n--- Step 2: Testing Validations ---');
  // 1. Reservation does not exist
  const resNonExistent = await fetch(`${BASE_URL}/api/reservations/00000000-0000-0000-0000-000000000000`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: 'test' }),
  });
  console.log('VAL_NOT_FOUND:', resNonExistent.status === 404 ? 'REJECTED_404_AS_EXPECTED' : `FAILED_${resNonExistent.status}`);

  // 2. Arbitrary field rejection
  const resArbitrary = await fetch(`${BASE_URL}/api/reservations/${target.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ arbitraryField: 'bad_value', hackerField: 123 }),
  });
  console.log('VAL_ARBITRARY_FIELD:', resArbitrary.status === 400 ? 'REJECTED_400_AS_EXPECTED' : `FAILED_${resArbitrary.status}`);

  // 3. Dates validation: checkOut <= checkIn
  const resBadDates = await fetch(`${BASE_URL}/api/reservations/${target.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checkIn: '2026-12-10', checkOut: '2026-12-05' }),
  });
  console.log('VAL_BAD_DATES:', resBadDates.status === 400 ? 'REJECTED_400_AS_EXPECTED' : `FAILED_${resBadDates.status}`);

  // 4. guests <= 0
  const resBadGuests = await fetch(`${BASE_URL}/api/reservations/${target.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guests: 0 }),
  });
  console.log('VAL_BAD_GUESTS:', resBadGuests.status === 400 ? 'REJECTED_400_AS_EXPECTED' : `FAILED_${resBadGuests.status}`);

  // 5. totalAmount < 0
  const resBadAmount = await fetch(`${BASE_URL}/api/reservations/${target.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ totalAmount: -10 }),
  });
  console.log('VAL_BAD_AMOUNT:', resBadAmount.status === 400 ? 'REJECTED_400_AS_EXPECTED' : `FAILED_${resBadAmount.status}`);

  // 6. depositAmount < 0
  const resBadDeposit = await fetch(`${BASE_URL}/api/reservations/${target.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ depositAmount: -5 }),
  });
  console.log('VAL_BAD_DEPOSIT:', resBadDeposit.status === 400 ? 'REJECTED_400_AS_EXPECTED' : `FAILED_${resBadDeposit.status}`);

  // 7. invalid reservationStatus
  const resBadStatus = await fetch(`${BASE_URL}/api/reservations/${target.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reservationStatus: 'INVALID_STATUS' }),
  });
  console.log('VAL_BAD_STATUS:', resBadStatus.status === 400 ? 'REJECTED_400_AS_EXPECTED' : `FAILED_${resBadStatus.status}`);

  // 8. invalid paymentStatus
  const resBadPayment = await fetch(`${BASE_URL}/api/reservations/${target.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentStatus: 'INVALID_PAYMENT' }),
  });
  console.log('VAL_BAD_PAYMENT:', resBadPayment.status === 400 ? 'REJECTED_400_AS_EXPECTED' : `FAILED_${resBadPayment.status}`);

  // 9. invalid roomId
  const resBadRoom = await fetch(`${BASE_URL}/api/reservations/${target.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: 'not-a-valid-uuid' }),
  });
  console.log('VAL_BAD_ROOM:', resBadRoom.status === 400 ? 'REJECTED_400_AS_EXPECTED' : `FAILED_${resBadRoom.status}`);

  // 10. invalid roomTypeId
  const resBadRoomType = await fetch(`${BASE_URL}/api/reservations/${target.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomTypeId: 'not-a-valid-uuid' }),
  });
  console.log('VAL_BAD_ROOM_TYPE:', resBadRoomType.status === 400 ? 'REJECTED_400_AS_EXPECTED' : `FAILED_${resBadRoomType.status}`);

  const allValidationsPassed = [
    resNonExistent.status === 404,
    resArbitrary.status === 400,
    resBadDates.status === 400,
    resBadGuests.status === 400,
    resBadAmount.status === 400,
    resBadDeposit.status === 400,
    resBadStatus.status === 400,
    resBadPayment.status === 400,
    resBadRoom.status === 400,
    resBadRoomType.status === 400,
  ].every(Boolean);

  console.log('ALL_INPUT_VALIDATIONS_PASSED:', allValidationsPassed);

  console.log('\n--- Step 3: Modifying notes and reservationStatus via PATCH ---');
  const patchPayload = {
    notes: 'Nota actualizada mediante PATCH test',
    reservationStatus: 'CONFIRMED',
  };

  const patchRes = await fetch(`${BASE_URL}/api/reservations/${target.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patchPayload),
  });

  const patchData = await patchRes.json();
  console.log('PATCH_STATUS:', patchRes.status);
  console.log('PATCH_RESPONSE:', JSON.stringify(patchData, null, 2));

  // Verify frontend format preserved
  const hasFrontendFields =
    typeof patchData.id === 'string' &&
    typeof patchData.bookingId === 'string' &&
    typeof patchData.guestName === 'string' &&
    typeof patchData.guestDoc === 'string' &&
    typeof patchData.guestPhone === 'string' &&
    ['Doble', 'Triple'].includes(patchData.roomType) &&
    typeof patchData.guests === 'number' &&
    typeof patchData.checkIn === 'string' &&
    typeof patchData.checkOut === 'string' &&
    typeof patchData.nights === 'number' &&
    typeof patchData.totalPrice === 'number' &&
    typeof patchData.currency === 'string' &&
    typeof patchData.paymentRef === 'string' &&
    typeof patchData.paymentMethod === 'string' &&
    typeof patchData.paidAt === 'string' &&
    typeof patchData.loadedInHotelSystem === 'boolean' &&
    typeof patchData.receptionistNotified === 'boolean';

  console.log('FRONTEND_FORMAT_PRESERVED:', hasFrontendFields);
  console.log('RESERVATION_UPDATED_IN_POSTGRES:', patchData.reservationStatus === 'CONFIRMED' && patchData.paymentRef === 'Nota actualizada mediante PATCH test');

  console.log('\n--- Step 4: Verifying persistence in GET /api/reservations ---');
  const getResAfter = await fetch(`${BASE_URL}/api/reservations`);
  const listAfter = await getResAfter.json();
  const matchedAfter = listAfter.find((r: any) => r.id === target.id);

  console.log('GET_MATCHED_RESERVATION:', JSON.stringify(matchedAfter, null, 2));
  const changePersisted = matchedAfter && matchedAfter.paymentRef === 'Nota actualizada mediante PATCH test' && matchedAfter.loadedInHotelSystem === true;
  console.log('CHANGE_PERSISTED_IN_GET:', Boolean(changePersisted));
}

testPatch().catch(console.error);
