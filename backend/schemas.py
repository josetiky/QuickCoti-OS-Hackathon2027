"""Contratos de datos compartidos con la app iOS (mantener sincronizado con BusinessProfile.swift / ReceiptModels.swift)."""
from typing import List, Optional, Literal, Dict
from pydantic import BaseModel, Field


class Modules(BaseModel):
    sales: bool = True
    purchases: bool = True
    inventory: bool = False
    quotes: bool = False
    deposits: bool = False


class Terminology(BaseModel):
    item: str = "Producto"
    items: str = "Productos"
    stock: str = "Existencias"
    purchase: str = "Compra"
    sale: str = "Venta"


class BusinessProfile(BaseModel):
    schema_version: int = 1
    business_name: str = "Mi negocio"
    giro: str = "otro"
    modules: Modules = Field(default_factory=Modules)
    intake_modes: List[str] = Field(default_factory=lambda: ["manual"])
    terminology: Terminology = Field(default_factory=Terminology)
    payment_methods: List[str] = Field(default_factory=lambda: ["efectivo"])
    suppliers: List[str] = Field(default_factory=list)
    digital_only_sector: bool = False
    units: List[str] = Field(default_factory=lambda: ["pieza"])
    missing_info: List[str] = Field(default_factory=list)


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class InterviewRequest(BaseModel):
    history: List[ChatTurn]


class InterviewResponse(BaseModel):
    done: bool
    next_question: Optional[str] = None
    profile: Optional[BusinessProfile] = None
    model: str
    error: Optional[str] = None


class Box(BaseModel):
    label: str            # proveedor | fecha | renglon | total | folio | nota_impresa | nota_manuscrita
    confidence: float
    bbox: List[float]     # [x, y, w, h] normalizados 0..1, origen arriba-izquierda


class DetectResponse(BaseModel):
    status: Literal["ok", "unreadable"]
    doc_type: Literal["impreso", "manuscrito", "desconocido"]
    boxes: List[Box]
    message: Optional[str] = None
    model: str


class Field_(BaseModel):
    value: Optional[str] = None
    confidence: float = 0.0


class ReceiptItem(BaseModel):
    name: str
    qty: float
    unit_cost: float
    confidence: float = 0.5


class StructureRequest(BaseModel):
    doc_type: str = "desconocido"
    zones: Dict[str, List[str]]   # {"proveedor": ["BIMBO"], "renglon": ["6 PAN BCO GDE 42.00", ...], ...}
    known_products: List[str] = Field(default_factory=list)


class StructureResponse(BaseModel):
    status: Literal["ok", "needs_review", "unreadable"]
    supplier: Field_
    date: Field_
    items: List[ReceiptItem]
    total: Optional[float] = None
    sum_items_matches_total: bool = False
    missing: List[str] = Field(default_factory=list)
    model: str


class AssistantRequest(BaseModel):
    query: str
    profile: Optional[BusinessProfile] = None
    business_snapshot: Optional[Dict] = None   # ventas/compras/inventario resumidos que manda la app


class AssistantResponse(BaseModel):
    answer: str
    needs_confirmation: bool = False
    out_of_scope: bool = False
    sources: List[str] = Field(default_factory=list)
    model: str


class CoDiRequest(BaseModel):
    sale_id: str
    amount: float
    description: str
