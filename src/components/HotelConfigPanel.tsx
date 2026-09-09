import { useState, type FormEvent } from 'react';
import {
  Building,
  Save,
  CheckCircle2,
  Code2,
  Sparkles,
  Plus,
  Trash2,
  HelpCircle,
  BookOpen,
  Bot,
  Zap,
} from 'lucide-react';
import { HotelConfig, HotelKnowledgeItem } from '../types';

interface HotelConfigPanelProps {
  config: HotelConfig;
  onSaveConfig: (newConfig: HotelConfig) => void;
}

export function HotelConfigPanel({ config, onSaveConfig }: HotelConfigPanelProps) {
  const [formData, setFormData] = useState<HotelConfig>({ ...config });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeMascotAnim, setActiveMascotAnim] = useState<'breathe' | 'happy' | 'wiggle'>('breathe');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSaveConfig(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleAddKnowledgeItem = () => {
    const newItem: HotelKnowledgeItem = {
      id: `kb-${Date.now()}`,
      topic: '',
      answer: '',
    };
    setFormData({
      ...formData,
      knowledgeBase: [newItem, ...(formData.knowledgeBase || [])],
    });
  };

  const handleUpdateKnowledgeItem = (id: string, field: 'topic' | 'answer', value: string) => {
    setFormData({
      ...formData,
      knowledgeBase: (formData.knowledgeBase || []).map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    });
  };

  const handleDeleteKnowledgeItem = (id: string) => {
    setFormData({
      ...formData,
      knowledgeBase: (formData.knowledgeBase || []).filter((item) => item.id !== id),
    });
  };

  const handleAddPreset = (topic: string, answer: string) => {
    const newItem: HotelKnowledgeItem = {
      id: `kb-${Date.now()}`,
      topic,
      answer,
    };
    setFormData({
      ...formData,
      knowledgeBase: [newItem, ...(formData.knowledgeBase || [])],
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Mascot Motion Showcase Card */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-2xl p-6 text-white border border-emerald-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center space-x-5">
          <div className="relative shrink-0">
            <img
              src="/bollukito.jpg"
              alt="Bollukito Animado"
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover ring-4 ring-emerald-400/80 shadow-2xl ${
                activeMascotAnim === 'happy'
                  ? 'animate-bollukito-happy'
                  : activeMascotAnim === 'wiggle'
                  ? 'animate-bollukito-wiggle'
                  : 'animate-bollukito-breathe animate-mascot-glow'
              }`}
              referrerPolicy="no-referrer"
            />
            <span className="absolute -bottom-2 -right-2 bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow">
              Animado
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1" /> Mascota en Movimiento
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Bollukito 🐾🛎️ en Vivo
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              Tu perrito bulldog francés ahora tiene animaciones fluidas y orgánicas (respiración suave, movimientos felices al escribir y saltitos al confirmar reservas).
            </p>
          </div>
        </div>

        {/* Animation Toggles */}
        <div className="flex items-center bg-slate-800/80 p-1.5 rounded-xl border border-slate-700 shrink-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveMascotAnim('breathe')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeMascotAnim === 'breathe'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Suave (Idle)
          </button>
          <button
            type="button"
            onClick={() => setActiveMascotAnim('happy')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeMascotAnim === 'happy'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            ¡Feliz! 🐶
          </button>
          <button
            type="button"
            onClick={() => setActiveMascotAnim('wiggle')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeMascotAnim === 'wiggle'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Mover Orejas
          </button>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-lg flex items-center">
              <Building className="w-5 h-5 mr-2 text-emerald-600" />
              Configuración General de {formData.hotelName}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Tarifas, datos de recepción y parámetros que utiliza la IA de Bollukito.
            </p>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-sm transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Cambios</span>
          </button>
        </div>

        {savedSuccess && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600 shrink-0" />
            <span>¡Configuración y Base de Conocimiento actualizadas! Bollukito ya aprendió todas las respuestas.</span>
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* Hotel & Mascot Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Hotel</label>
              <input
                type="text"
                value={formData.hotelName}
                onChange={(e) => setFormData({ ...formData, hotelName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                WhatsApp del Recepcionista Humano (Donde llegan los avisos)
              </label>
              <input
                type="text"
                value={formData.receptionistPhone}
                onChange={(e) => setFormData({ ...formData, receptionistPhone: e.target.value })}
                placeholder="+54 9 11 4055-7788"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="border-t border-slate-200 pt-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Tarifas por Noche (Venta Directa sin intermediarios)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-slate-900 text-sm">Habitación Doble (2 personas)</span>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                    10 unidades
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-slate-500">US$</span>
                  <input
                    type="number"
                    value={formData.doubleRoomPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, doubleRoomPrice: Number(e.target.value) })
                    }
                    className="w-28 px-3 py-1.5 text-sm font-bold border border-slate-300 rounded-lg bg-white"
                  />
                  <span className="text-xs text-slate-500">/ noche</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-slate-900 text-sm">Habitación Triple (3 personas)</span>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                    10 unidades
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-slate-500">US$</span>
                  <input
                    type="number"
                    value={formData.tripleRoomPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, tripleRoomPrice: Number(e.target.value) })
                    }
                    className="w-28 px-3 py-1.5 text-sm font-bold border border-slate-300 rounded-lg bg-white"
                  />
                  <span className="text-xs text-slate-500">/ noche</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hotel Policies & Details */}
          <div className="border-t border-slate-200 pt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Horario de Check-in</label>
              <input
                type="text"
                value={formData.checkInTime}
                onChange={(e) => setFormData({ ...formData, checkInTime: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Horario de Check-out</label>
              <input
                type="text"
                value={formData.checkOutTime}
                onChange={(e) => setFormData({ ...formData, checkOutTime: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Horario Desayuno Buffet</label>
              <input
                type="text"
                value={formData.breakfastHours}
                onChange={(e) => setFormData({ ...formData, breakfastHours: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Dirección del Hotel</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        {/* Knowledge Base / Entrenar a Bollukito Section */}
        <div className="border-t border-slate-200 bg-slate-50/70 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center">
                  <Bot className="w-3.5 h-3.5 mr-1" /> Memoria de IA
                </span>
                <span className="text-xs text-slate-500">
                  {formData.knowledgeBase?.length || 0} temas aprendidos
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-1">
                Base de Conocimiento y Entrenamiento de Bollukito
              </h3>
              <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                <strong>¿Podemos enseñarle todas las opciones que se le ocurran a los clientes?</strong> ¡Sí, totalmente! Escribe aquí cualquier pregunta frecuente o información especial de Hotel Bolluk. Bollukito leerá estos datos en tiempo real antes de responder cada mensaje en WhatsApp.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddKnowledgeItem}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Enseñar Nuevo Tema</span>
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-700 flex items-center">
              <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
              Sugerencias rápidas para agregar a la memoria de Bollukito:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  handleAddPreset(
                    '¿Tienen piscina / pileta climatizada?',
                    'Nuestra piscina climatizada se encuentra en el primer piso, abierta todos los días de 09:00 a 21:00 hs con toallas de piscina provistas sin cargo.'
                  )
                }
                className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-purple-50 hover:text-purple-700 border border-slate-200 rounded-lg transition-colors"
              >
                + Pileta / Piscina
              </button>
              <button
                type="button"
                onClick={() =>
                  handleAddPreset(
                    '¿Hacen factura A para empresas?',
                    '¡Sí, por supuesto! Emitimos Factura A y B. Puedes solicitarla indicando tu CUIT al momento de la reserva o en recepción.'
                  )
                }
                className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-purple-50 hover:text-purple-700 border border-slate-200 rounded-lg transition-colors"
              >
                + Facturación A / Empresas
              </button>
              <button
                type="button"
                onClick={() =>
                  handleAddPreset(
                    '¿Cómo es la política de cancelación de reservas?',
                    'Las cancelaciones realizadas con más de 72 horas de anticipación al check-in tienen reintegro del 100% o reprogramación de fechas sin penalidad.'
                  )
                }
                className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-purple-50 hover:text-purple-700 border border-slate-200 rounded-lg transition-colors"
              >
                + Políticas de Cancelación
              </button>
              <button
                type="button"
                onClick={() =>
                  handleAddPreset(
                    '¿Tienen servicio a la habitación (Room Service)?',
                    'Disponemos de cafetería y minutas para disfrutar en la habitación de 11:00 a 23:00 hs.'
                  )
                }
                className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-purple-50 hover:text-purple-700 border border-slate-200 rounded-lg transition-colors"
              >
                + Room Service / Minutas
              </button>
            </div>
          </div>

          {/* Knowledge Items List */}
          <div className="space-y-3">
            {formData.knowledgeBase && formData.knowledgeBase.length > 0 ? (
              formData.knowledgeBase.map((item, idx) => (
                <div
                  key={item.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-purple-300 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          placeholder="Ej: ¿Cobran cargo por mascota? o ¿Tienen cuna para bebés?"
                          value={item.topic}
                          onChange={(e) =>
                            handleUpdateKnowledgeItem(item.id, 'topic', e.target.value)
                          }
                          className="w-full font-bold text-sm text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-purple-500 focus:outline-none px-1 py-0.5"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteKnowledgeItem(item.id)}
                      className="text-slate-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                      title="Eliminar tema"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Respuesta oficial que dará Bollukito en WhatsApp:
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Escribe la respuesta exacta que debe dar Bollukito cuando le pregunten por esto..."
                      value={item.answer}
                      onChange={(e) =>
                        handleUpdateKnowledgeItem(item.id, 'answer', e.target.value)
                      }
                      className="w-full text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:ring-1 focus:ring-purple-500 focus:outline-none leading-relaxed"
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center p-8 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400 text-xs">
                No hay temas cargados. Haz clic en <strong>+ Enseñar Nuevo Tema</strong> para educar a Bollukito.
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Guide: How to connect to real WhatsApp Cloud API */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800 space-y-4 shadow-sm">
        <div className="flex items-center space-x-2">
          <Code2 className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-base text-white">
            Paso para conectar a WhatsApp Business Real (Meta Cloud API)
          </h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
          El bot que desarrollamos aquí ya cuenta con la lógica completa para procesar reservas, responder dudas y generar links de pago. Cuando decidas llevarlo al número de WhatsApp oficial del hotel:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-1.5">
            <span className="text-xs font-bold text-emerald-400">1. Cuenta de Desarrollador</span>
            <p className="text-xs text-slate-300">
              Creas una cuenta en <strong>developers.facebook.com</strong> y vinculas el número de teléfono que usará Hotel Bolluk.
            </p>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-1.5">
            <span className="text-xs font-bold text-emerald-400">2. Configurar el Webhook</span>
            <p className="text-xs text-slate-300">
              En la sección de WhatsApp de Meta, colocas la URL de tu servidor:
              <code className="block mt-1 p-1 bg-slate-950 rounded text-[11px] text-emerald-300">
                /api/whatsapp/webhook
              </code>
            </p>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-1.5">
            <span className="text-xs font-bold text-emerald-400">3. ¡Bollukito en vivo!</span>
            <p className="text-xs text-slate-300">
              Cualquier huésped que escriba a ese número hablará con Bollukito, y cuando pague, recibirás la ficha en tu teléfono personal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
