/**
 * PaymentService Layer (Paso 9F-1 & Paso 9F-2)
 *
 * Real Mercado Pago API integration for generating payment preferences.
 * Uses MERCADOPAGO_ACCESS_TOKEN from environment variables (no hardcoded tokens).
 * Links external_reference = reservationCode.
 * Does not confirm reservations or mark as PAID.
 */
import { MercadoPagoConfig, Preference } from 'mercadopago';

export interface PaymentPreferenceInput {
  reservationId: string;
  reservationCode: string;
  customerName: string;
  customerEmail?: string;
  totalAmount: number;
  depositAmount: number;
  description?: string;
}

export interface PaymentPreferenceResult {
  preferenceId: string;
  checkoutUrl: string;
  reservationCode: string;
  amount: number;
  sandboxCheckoutUrl?: string;
  externalReference?: string;
}

export const getMercadoPagoIntegrationStatus = (): 'CONFIGURED' | 'PENDING_CONFIGURATION' => {
  return process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() ? 'CONFIGURED' : 'PENDING_CONFIGURATION';
};

export const MERCADOPAGO_INTEGRATION_STATUS = getMercadoPagoIntegrationStatus();

export interface PaymentService {
  createPaymentPreference(
    reservation: PaymentPreferenceInput
  ): Promise<PaymentPreferenceResult>;
}

export interface MercadoPagoPaymentServiceOptions {
  accessToken?: string;
  customPreferenceClient?: {
    create: (args: { body: any }) => Promise<any>;
  };
}

export class MercadoPagoPaymentService implements PaymentService {
  private accessToken?: string;
  private customPreferenceClient?: {
    create: (args: { body: any }) => Promise<any>;
  };

  constructor(options?: string | MercadoPagoPaymentServiceOptions) {
    if (typeof options === 'string') {
      this.accessToken = options;
    } else if (options && typeof options === 'object') {
      this.accessToken = options.accessToken;
      this.customPreferenceClient = options.customPreferenceClient;
    }
  }

  /**
   * Helper to retrieve access token (lazy / on-demand from env or instance)
   */
  public getAccessToken(): string | undefined {
    return this.accessToken || process.env.MERCADOPAGO_ACCESS_TOKEN;
  }

  /**
   * createPaymentPreference(reservation)
   *
   * Validations & Rules:
   * - reservationId, reservationCode, customerName required.
   * - depositAmount > 0 required. If depositAmount <= 0, throws controlled PAYMENT_NOT_REQUIRED error.
   * - currency = ARS, quantity = 1, amount = depositAmount.
   * - external_reference = reservationCode.
   * - back_urls configured with APP_URL (success, failure, pending).
   * - returns { preferenceId, checkoutUrl, reservationCode, amount }.
   */
  async createPaymentPreference(
    reservation: PaymentPreferenceInput
  ): Promise<PaymentPreferenceResult> {
    if (!reservation || typeof reservation !== 'object') {
      throw new Error('Datos de reserva inválidos para generar preferencia de pago');
    }

    const {
      reservationId,
      reservationCode,
      customerName,
      customerEmail,
      totalAmount,
      depositAmount,
      description,
    } = reservation;

    if (!reservationId || typeof reservationId !== 'string' || !reservationId.trim()) {
      throw new Error('reservationId es requerido para generar preferencia de pago');
    }

    if (!reservationCode || typeof reservationCode !== 'string' || !reservationCode.trim()) {
      throw new Error('reservationCode es requerido para generar preferencia de pago');
    }

    if (!customerName || typeof customerName !== 'string' || !customerName.trim()) {
      throw new Error('customerName es requerido para generar preferencia de pago');
    }

    if (totalAmount === undefined || totalAmount === null || isNaN(Number(totalAmount)) || Number(totalAmount) < 0) {
      throw new Error('totalAmount inválido para generar preferencia de pago');
    }

    if (depositAmount === undefined || depositAmount === null || isNaN(Number(depositAmount))) {
      throw new Error('depositAmount inválido para generar preferencia de pago');
    }

    const numericDeposit = Number(depositAmount);

    // Rule 5: Si depositAmount <= 0: NO crear preferencia. Devolver error controlado: PAYMENT_NOT_REQUIRED
    if (numericDeposit <= 0) {
      const err: any = new Error('No se requiere pago de seña para esta reserva');
      err.code = 'PAYMENT_NOT_REQUIRED';
      throw err;
    }

    const amount = numericDeposit;

    // Rule 7: URLs de retorno usando APP_URL
    const rawAppUrl = process.env.APP_URL || 'http://localhost:3000';
    const appUrl = rawAppUrl.replace(/\/+$/, '');

    const backUrls = {
      success: `${appUrl}/payment/feedback?status=success&code=${encodeURIComponent(reservationCode)}`,
      failure: `${appUrl}/payment/feedback?status=failure&code=${encodeURIComponent(reservationCode)}`,
      pending: `${appUrl}/payment/feedback?status=pending&code=${encodeURIComponent(reservationCode)}`,
    };

    // Preference payload conforming to Mercado Pago API specifications
    const preferenceBody = {
      items: [
        {
          id: reservationId,
          title: description || `Seña Reserva Hotel Nuevo Horizonte - Código ${reservationCode}`,
          description: description || `Seña de estadía (Huésped: ${customerName})`,
          quantity: 1,
          unit_price: amount,
          currency_id: 'ARS',
        },
      ],
      external_reference: reservationCode,
      back_urls: backUrls,
      auto_return: 'approved',
      payer: {
        name: customerName,
        email: customerEmail && customerEmail.includes('@') ? customerEmail : undefined,
      },
      statement_descriptor: 'HOTEL NUEVO HORIZONTE',
    };

    // If a custom client was injected (e.g. for testing or mocking)
    if (this.customPreferenceClient) {
      const resp = await this.customPreferenceClient.create({ body: preferenceBody });
      return {
        preferenceId: resp.id || `pref_${reservationCode}`,
        checkoutUrl: resp.init_point || resp.sandbox_init_point || `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${resp.id || reservationCode}`,
        sandboxCheckoutUrl: resp.sandbox_init_point,
        reservationCode,
        amount,
        externalReference: reservationCode,
      };
    }

    // Rule 2: Usar variable de entorno MERCADOPAGO_ACCESS_TOKEN. No hardcodear credenciales.
    const token = this.getAccessToken();
    if (!token) {
      const err: any = new Error('Mercado Pago se encuentra en estado PENDING_CONFIGURATION (MERCADOPAGO_ACCESS_TOKEN no configurado)');
      err.code = 'MERCADOPAGO_PENDING_CONFIGURATION';
      err.status = 'PENDING_CONFIGURATION';
      throw err;
    }

    // Rule 1: Integrar la API real de Mercado Pago
    const mpClient = new MercadoPagoConfig({
      accessToken: token,
      options: { timeout: 10000 },
    });
    const preferenceClient = new Preference(mpClient);

    const response = await preferenceClient.create({ body: preferenceBody });

    const checkoutUrl = response.init_point || response.sandbox_init_point || '';
    const preferenceId = response.id || '';

    // Rule 8: Solo devolver desde el servicio: preferenceId, checkoutUrl, reservationCode, amount
    return {
      preferenceId,
      checkoutUrl,
      sandboxCheckoutUrl: response.sandbox_init_point,
      reservationCode,
      amount,
      externalReference: reservationCode,
    };
  }
}

// Global default service instance
export const mercadoPagoPaymentService = new MercadoPagoPaymentService();

/**
 * Exported function createPaymentPreference(reservation)
 */
export async function createPaymentPreference(
  reservation: PaymentPreferenceInput
): Promise<PaymentPreferenceResult> {
  return mercadoPagoPaymentService.createPaymentPreference(reservation);
}
