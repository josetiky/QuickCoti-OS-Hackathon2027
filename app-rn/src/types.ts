// Contratos de datos (mismos que backend/schemas.py y el JSON que produce Hermes)
export type Modules = { sales: boolean; purchases: boolean; inventory: boolean; quotes: boolean; deposits: boolean;
  rentals?: boolean; delivery?: boolean }; // rentas y entregas a domicilio: las detecta el Configurador (v2), el LoRA v1 no las conoce
export type Terminology = { item: string; items: string; stock: string; purchase: string; sale: string };
export type BusinessProfile = {
  schema_version: number; business_name: string; giro: string; modules: Modules; intake_modes: string[];
  terminology: Terminology; payment_methods: string[]; suppliers: string[]; digital_only_sector: boolean;
  units: string[]; missing_info: string[];
  ui?: UIConfig; // lo arma el Agente Configurador después de la entrevista (no lo genera el LoRA)
};

// ─── Agente Configurador (integrado de mipyme-multiagente): prediseño, meta y orden del Inicio ───
export type PredisenoId = 'comercio_inventario' | 'servicios_rapidos' | 'alimentos_mostrador' | 'rentas_eventos';
export type HomeCard = 'meta_ingresos' | 'escaner_recibos' | 'cobro' | 'inventario' | 'cotizar' | 'rentas' | 'entregas' | 'asistente';
export type UIConfig = {
  predisenoId: PredisenoId; ingresoMetaMXN: number; periodicidadMeta: 'semanal' | 'mensual';
  ordenTarjetasHome: HomeCard[]; mensajeBienvenida: string; metaDeclarada: boolean;
};
export const PREDISENOS: Record<PredisenoId, { label: string; emoji: string; accent: string; soft: string }> = {
  comercio_inventario: { label: 'Comercio con inventario', emoji: '🛒', accent: '#059669', soft: '#ECFDF5' },
  servicios_rapidos: { label: 'Servicios y trabajos', emoji: '🛠️', accent: '#2563EB', soft: '#EFF6FF' },
  alimentos_mostrador: { label: 'Alimentos de mostrador', emoji: '☕', accent: '#D97706', soft: '#FFFBEB' },
  rentas_eventos: { label: 'Rentas', emoji: '🔑', accent: '#7C3AED', soft: '#F5F3FF' },
};
export const defaultProfile = (): BusinessProfile => ({
  schema_version: 1, business_name: 'Mi negocio', giro: 'otro',
  modules: { sales: true, purchases: true, inventory: false, quotes: false, deposits: false },
  intake_modes: ['manual'], terminology: { item: 'Producto', items: 'Productos', stock: 'Existencias', purchase: 'Compra', sale: 'Venta' },
  payment_methods: ['efectivo'], suppliers: [], digital_only_sector: false, units: ['pieza'], missing_info: [],
});
export const TIENDITA: BusinessProfile = {
  ...defaultProfile(), business_name: 'Abarrotes Doña Lupe', giro: 'tienda_abarrotes',
  modules: { sales: true, purchases: true, inventory: true, quotes: false, deposits: false },
  intake_modes: ['supplier_ticket_photo', 'handwritten_note_photo', 'manual'],
  terminology: { item: 'Producto', items: 'Productos', stock: 'Existencias', purchase: 'Surtido', sale: 'Venta' },
  payment_methods: ['efectivo', 'tarjeta', 'codi'], suppliers: ['Bimbo', 'Coca-Cola'],
};
export const HERRERO: BusinessProfile = {
  ...defaultProfile(), business_name: 'Herrería Hermanos Ruiz', giro: 'herreria',
  modules: { sales: true, purchases: true, inventory: false, quotes: true, deposits: true },
  intake_modes: ['voice', 'handwritten_note_photo', 'manual'],
  terminology: { item: 'Material', items: 'Materiales', stock: 'Material en taller', purchase: 'Compra de material', sale: 'Trabajo' },
  payment_methods: ['efectivo', 'transferencia'],
};

export type ChatTurn = { role: 'user' | 'assistant'; content: string };
export type Box = { label: string; confidence: number; bbox: [number, number, number, number] }; // x,y,w,h normalizados
export type DocType = 'impreso' | 'manuscrito' | 'desconocido';
export type ReceiptItem = { id: string; name: string; qty: number; unit_cost: number; confidence: number };
export type Structured = {
  status: 'ok' | 'needs_review' | 'unreadable'; supplier: { value: string | null; confidence: number };
  date: { value: string | null; confidence: number }; items: ReceiptItem[]; total: number | null;
  sum_items_matches_total: boolean; missing: string[]; model: string;
};

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'codi' | 'transferencia' | 'efectivo_contingencia';
export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta (SIMULADO)', codi: 'CoDi QR (SIMULADO)', transferencia: 'Transferencia',
  efectivo_contingencia: 'Efectivo por contingencia',
};
export const isDigital = (m: PaymentMethod) => m === 'tarjeta' || m === 'codi' || m === 'transferencia';

export type Product = { id: string; name: string; unitCost: number; price: number | null; stock: number };
export type Purchase = { id: string; date: string; supplier: string; items: ReceiptItem[]; total: number; source: string; aiModel: string | null };
/** Renglón de una venta con varios artículos (productId si viene del inventario). */
export type SaleItem = { name: string; qty: number; price: number; productId?: string };
export type Sale = { id: string; date: string; concept: string; amount: number; method: PaymentMethod; status: 'pagada' | 'fallida'; isSimulated: boolean; reference: string | null; items?: SaleItem[];
  cotizacionId?: string; tipoPago?: 'anticipo' | 'liquidacion' }; // pago de una cotización de Por cobrar
export type Incident = { id: string; start: string; end: string | null; reason: string };
export type LedgerEntry = { index: number; timestamp: string; type: string; payload: Record<string, string>; prevHash: string; hash: string };

export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
export const money = (n: number) => '$' + (n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Rentas y entregas a domicilio ───
export type Rental = { id: string; date: string; client: string; phone: string; items: string; amount: number; deposit: number;
  returnDate: string; status: 'activa' | 'devuelta'; depositReturned: boolean; returnedAt: string | null };
export type DeliveryStatus = 'pendiente' | 'en_camino' | 'entregado' | 'cancelado';
export type Delivery = { id: string; date: string; client: string; phone: string; address: string; concept: string; amount: number; fee: number;
  status: DeliveryStatus; updatedAt: string };
export const DELIVERY_LABEL: Record<DeliveryStatus, string> = { pendiente: '🕐 Pendiente', en_camino: '🛵 En camino', entregado: '✅ Entregado', cancelado: '✖️ Cancelado' };
