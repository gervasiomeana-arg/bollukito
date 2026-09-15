/**
 * Test Step 9F-1:
 * Validates PaymentService, MercadoPagoPaymentService, and createPaymentPreference
 */
import {
  MercadoPagoPaymentService,
  createPaymentPreference,
} from '../src/services/payment.service.ts';

async function testStep9F1() {
  console.log('Testing Step 9F-1: PaymentService & MercadoPagoPaymentService...');

  // 1. Structure and instantiation
  const service = new MercadoPagoPaymentService();
  if (typeof service.createPaymentPreference !== 'function') {
    throw new Error('createPaymentPreference is not a function on MercadoPagoPaymentService');
  }

  // 2. Test Deposit Amount > 0
  console.log('\n--- TEST: depositAmount > 0 creates preference with amountToCharge = depositAmount ---');
  const resultWithDeposit = await createPaymentPreference({
    reservationId: 'res-uuid-1234',
    reservationCode: 'BOL-202609-XYZ123',
    customerName: 'Juan Pérez',
    customerEmail: 'juan@example.com',
    totalAmount: 50000,
    depositAmount: 15000,
    description: 'Seña de estadía para 2 personas',
  });

  console.log('Result with deposit:', resultWithDeposit);
  if (!resultWithDeposit) {
    throw new Error('Expected resultWithDeposit to be defined when depositAmount > 0');
  }
  if (resultWithDeposit.amountToCharge !== 15000) {
    throw new Error(`Expected amountToCharge 15000, got ${resultWithDeposit.amountToCharge}`);
  }
  if (resultWithDeposit.requiresPayment !== true) {
    throw new Error('Expected requiresPayment to be true');
  }

  // 3. Test Deposit Amount = 0 -> DO NOT create payment preference (returns null)
  console.log('\n--- TEST: depositAmount = 0 does NOT create payment preference ---');
  const resultZeroDeposit = await createPaymentPreference({
    reservationId: 'res-uuid-1234',
    reservationCode: 'BOL-202609-XYZ123',
    customerName: 'Juan Pérez',
    totalAmount: 50000,
    depositAmount: 0,
  });

  console.log('Result with deposit 0:', resultZeroDeposit);
  if (resultZeroDeposit !== null) {
    throw new Error(`Expected null when depositAmount is 0, but got: ${JSON.stringify(resultZeroDeposit)}`);
  }

  // 4. Test missing optional fields (customerEmail, description are optional)
  console.log('\n--- TEST: Optional fields handled properly ---');
  const resultMinimal = await createPaymentPreference({
    reservationId: 'res-uuid-5678',
    reservationCode: 'BOL-202609-ABC789',
    customerName: 'María García',
    totalAmount: 40000,
    depositAmount: 10000,
  });
  if (!resultMinimal || resultMinimal.amountToCharge !== 10000) {
    throw new Error('Failed minimal optional fields test');
  }

  // 5. Test validation failures
  console.log('\n--- TEST: Validations for required fields ---');
  let threw = false;
  try {
    await createPaymentPreference({
      reservationId: '',
      reservationCode: 'BOL-202609-ABC789',
      customerName: 'María',
      totalAmount: 40000,
      depositAmount: 10000,
    });
  } catch (err: any) {
    threw = true;
    console.log('Successfully caught missing reservationId:', err.message);
  }
  if (!threw) throw new Error('Expected error for empty reservationId');

  // 6. Test token handling (no hardcoded tokens)
  console.log('\n--- TEST: No hardcoded tokens, respects env var ---');
  const customService = new MercadoPagoPaymentService('test_env_token_val');
  if (customService.getAccessToken() !== 'test_env_token_val') {
    throw new Error('Custom token handling failed');
  }
  const defaultService = new MercadoPagoPaymentService();
  // By default without env var, getAccessToken should be undefined, not some hardcoded string
  console.log('Default service token (should be undefined without env var):', defaultService.getAccessToken());
  if (defaultService.getAccessToken() !== undefined && defaultService.getAccessToken() !== process.env.MERCADOPAGO_ACCESS_TOKEN) {
    throw new Error('Found unexpected token in default service');
  }

  console.log('\nALL STEP 9F-1 TESTS PASSED SUCCESSFULLY!');
}

testStep9F1().catch((err) => {
  console.error('Test Step 9F-1 failed:', err);
  process.exit(1);
});
