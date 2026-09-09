import { useState } from 'react';
import { CreditCard, CheckCircle2, ShieldCheck, Lock, X, AlertCircle } from 'lucide-react';
import { ReservationOffer } from '../types';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  offer: ReservationOffer;
  guestData: { name: string; doc: string; phone: string };
  onPaymentSuccess: (paymentDetails: {
    paymentRef: string;
    paymentMethod: string;
    guestName: string;
    guestDoc: string;
    guestPhone: string;
  }) => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  offer,
  guestData,
  onPaymentSuccess,
}: PaymentModalProps) {
  const [name, setName] = useState(guestData.name || '');
  const [doc, setDoc] = useState(guestData.doc || '');
  const [phone, setPhone] = useState(guestData.phone || '');
  const [paymentMethod, setPaymentMethod] = useState<'mercadopago' | 'credit_card'>('mercadopago');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePay = () => {
    if (!name.trim()) {
      setError('Por favor indica tu nombre y apellido completo');
      return;
    }
    if (!phone.trim()) {
      setError('Por favor indica tu número de WhatsApp para contacto');
      return;
    }

    setError(null);
    setIsProcessing(true);

    // Simulate processing payment via payment gateway (Mercado Pago / Card)
    setTimeout(() => {
      setIsProcessing(false);
      const paymentRef = `MP-${Math.floor(1000000 + Math.random() * 9000000)}`;
      onPaymentSuccess({
        paymentRef,
        paymentMethod: paymentMethod === 'mercadopago' ? 'Mercado Pago (Débito/Dinero en cuenta)' : 'Tarjeta de Crédito Visa / Mastercard',
        guestName: name,
        guestDoc: doc || '35.120.449',
        guestPhone: phone,
      });
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-6 h-6 text-emerald-200" />
            <div>
              <h3 className="font-bold text-base">Checkout Seguro - Hotel Bolluk</h3>
              <p className="text-xs text-emerald-100 flex items-center">
                <Lock className="w-3 h-3 mr-1" /> Encriptación SSL 256-bit
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Summary Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2">
              <span className="font-semibold text-slate-800">Habitación {offer.roomType}</span>
              <span className="font-bold text-emerald-700 text-base">US$ {offer.totalPrice}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div>
                <span className="block text-slate-400">Check-in:</span>
                <span className="font-medium text-slate-700">{offer.checkIn}</span>
              </div>
              <div>
                <span className="block text-slate-400">Check-out:</span>
                <span className="font-medium text-slate-700">{offer.checkOut}</span>
              </div>
              <div>
                <span className="block text-slate-400">Estadía:</span>
                <span className="font-medium text-slate-700">{offer.nights} {offer.nights === 1 ? 'noche' : 'noches'}</span>
              </div>
              <div>
                <span className="block text-slate-400">Huéspedes:</span>
                <span className="font-medium text-slate-700">{offer.guests} personas</span>
              </div>
            </div>
          </div>

          {/* Guest Form */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Datos del Huésped</h4>
            
            {error && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center">
                <AlertCircle className="w-4 h-4 mr-1.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nombre y Apellido</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Laura Martínez"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">DNI / Pasaporte</label>
                <input
                  type="text"
                  value={doc}
                  onChange={(e) => setDoc(e.target.value)}
                  placeholder="34.567.890"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">WhatsApp de contacto</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+54 9 11 ..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2 pt-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Método de Pago</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('mercadopago')}
                className={`p-3 border rounded-xl flex items-center justify-center space-x-2 text-xs font-medium transition-all ${
                  paymentMethod === 'mercadopago'
                    ? 'border-sky-500 bg-sky-50 text-sky-800 ring-1 ring-sky-500'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="font-bold text-sky-600">Mercado Pago</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('credit_card')}
                className={`p-3 border rounded-xl flex items-center justify-center space-x-2 text-xs font-medium transition-all ${
                  paymentMethod === 'credit_card'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>Tarjeta Crédito/Débito</span>
              </button>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={handlePay}
            disabled={isProcessing}
            className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-60"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Procesando pago seguro...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Confirmar Pago de US$ {offer.totalPrice}</span>
              </>
            )}
          </button>
          <p className="text-[11px] text-center text-slate-400">
            Al pagar, el bot notificará automáticamente a la recepción de Hotel Bolluk para reservar tu habitación.
          </p>
        </div>
      </div>
    </div>
  );
}
