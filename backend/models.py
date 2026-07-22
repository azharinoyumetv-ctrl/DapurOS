"""Geraina POS by DagangOS - Backend Models."""
from datetime import datetime, timezone
from typing import List, Optional, Any, Annotated, Literal
import uuid
from pydantic import BaseModel, EmailStr, Field, BeforeValidator, ConfigDict


def _to_str(v: Any) -> str:
    return str(v) if v is not None else v


PyObjectId = Annotated[str, BeforeValidator(_to_str)]


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Auth & Store ----------
class StoreCreate(BaseModel):
    name: str
    owner_email: EmailStr
    owner_password: str = Field(min_length=6)


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    store_name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    role: str
    store_id: str
    store_name: str
    trial_ends_at: Optional[str] = None
    plan: str = "trial"


# ---------- Products ----------
class RecipeItem(BaseModel):
    ingredient_id: str
    quantity: float

class ProductBase(BaseModel):
    name: str
    sku: Optional[str] = None
    price: float = Field(ge=0)
    cost: float = Field(default=0, ge=0)
    stock: int = Field(default=0, ge=0)
    category: Optional[str] = "Umum"
    unit: Optional[str] = "pcs"
    image_url: Optional[str] = None
    description: Optional[str] = None
    active: bool = True
    recipe: Optional[List[RecipeItem]] = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    price: Optional[float] = None
    cost: Optional[float] = None
    stock: Optional[int] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None
    recipe: Optional[List[RecipeItem]] = None


class Product(ProductBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)
    updated_at: str = Field(default_factory=utcnow_iso)


# ---------- POS / Orders ----------
class OrderLineItem(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int = Field(ge=1)
    subtotal: float
    note: Optional[str] = None
    modifiers: Optional[dict] = None


class OrderCreate(BaseModel):
    items: List[OrderLineItem]
    payment_method: str  # cash | qris | ewallet
    ewallet_channel: Optional[str] = None  # ID_OVO | ID_DANA | ID_SHOPEEPAY | ID_LINKAJA
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    discount: float = 0
    tax_percent: float = 0
    cash_received: Optional[float] = None
    note: Optional[str] = None
    session_id: Optional[str] = None
    dining_option: Optional[str] = "Dine-In"


class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    cashier_id: str
    cashier_email: str
    order_no: str
    items: List[OrderLineItem]
    subtotal: float
    discount: float = 0
    tax_percent: float = 0
    tax_amount: float = 0
    total: float
    payment_method: str
    payment_status: str = "pending"  # pending | paid | failed | voided
    ewallet_channel: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    cash_received: Optional[float] = None
    change: Optional[float] = None
    note: Optional[str] = None
    xendit_id: Optional[str] = None
    xendit_qr_string: Optional[str] = None
    xendit_checkout_url: Optional[str] = None
    xendit_reference_id: Optional[str] = None
    xendit_raw: Optional[dict] = None
    session_id: Optional[str] = None
    dining_option: Optional[str] = "Dine-In"
    service_charge: float = 0.0
    tax_pb1: float = 0.0
    created_at: str = Field(default_factory=utcnow_iso)
    updated_at: str = Field(default_factory=utcnow_iso)


# ---------- Bulk import ----------
class BulkImportResult(BaseModel):
    inserted: int
    updated: int
    skipped: int
    errors: List[str] = []


# ---------- Expanded Modules Models ----------

class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None

class Category(CategoryBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)
    updated_at: str = Field(default_factory=utcnow_iso)

class BrandBase(BaseModel):
    name: str
    description: Optional[str] = None

class Brand(BrandBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)
    updated_at: str = Field(default_factory=utcnow_iso)

class UnitBase(BaseModel):
    name: str
    short_name: str

class Unit(UnitBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)
    updated_at: str = Field(default_factory=utcnow_iso)

class StockAdjustmentCreate(BaseModel):
    product_name: str
    sku: Optional[str] = None
    adjustment_qty: int
    type: str  # add | sub
    reason: str
    created_by: str

class StockAdjustment(StockAdjustmentCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)

class StockTransferItem(BaseModel):
    name: str
    qty: int

class StockTransferCreate(BaseModel):
    from_branch: str
    to_branch: str
    items: List[StockTransferItem]
    status: str = "Shipped"

class StockTransfer(StockTransferCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)

class SupplierBase(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None

class Supplier(SupplierBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)
    updated_at: str = Field(default_factory=utcnow_iso)

class PurchaseOrderCreate(BaseModel):
    po_no: str
    supplier_id: str
    supplier_name: str
    total: float
    status: str = "Ordered"

class PurchaseOrder(PurchaseOrderCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)

class GoodsReceivingCreate(BaseModel):
    po_no: str
    gr_no: str
    received_by: str
    received_at: str = Field(default_factory=utcnow_iso)

class GoodsReceiving(GoodsReceivingCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str

class SupplierInvoiceCreate(BaseModel):
    invoice_no: str
    po_no: str
    amount: float
    status: str = "Unpaid"
    due_date: str

class SupplierInvoice(SupplierInvoiceCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)

class SupplierInvoiceUpdate(BaseModel):
    """Partial update -- used to mark an invoice paid without re-submitting the full record."""
    status: Optional[str] = None

class CustomerBase(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    membership_tier: Optional[str] = "Bronze"
    loyalty_points: int = 0
    notes: Optional[str] = None

class Customer(CustomerBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)

class MembershipBase(BaseModel):
    name: str
    min_points: int
    discount_percent: float
    description: Optional[str] = None

class Membership(MembershipBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str

class LoyaltyRules(BaseModel):
    conversion_rate: int = 10000
    point_value: int = 100
    min_redeem_points: int = 50

class DebtReceivableCreate(BaseModel):
    customer_name: str
    phone: Optional[str] = None
    order_no: str
    amount: float
    paid_amount: float = 0
    due_date: str
    status: str = "Unpaid"  # Unpaid | Partial | Paid

class DebtReceivable(DebtReceivableCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str

class DebtReceivableUpdate(BaseModel):
    """Partial update -- used to record a payment/settlement against an existing
    receivable without re-submitting the full record."""
    paid_amount: Optional[float] = None
    status: Optional[str] = None

class DebtPayableCreate(BaseModel):
    supplier_name: str
    invoice_no: str
    amount: float
    paid_amount: float = 0
    due_date: str
    status: str = "Unpaid"

class DebtPayable(DebtPayableCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str

class DebtPayableUpdate(BaseModel):
    paid_amount: Optional[float] = None
    status: Optional[str] = None

class StaffBase(BaseModel):
    name: str
    email: EmailStr
    role: Literal["Owner", "Manager", "Cashier", "Warehouse"]
    phone: Optional[str] = None
    status: str = "Aktif"

class Staff(StaffBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)

class AttendanceCreate(BaseModel):
    staff_name: str
    clock_in: str
    clock_out: Optional[str] = None
    status: str = "Hadir"

class Attendance(AttendanceCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str

class BranchBase(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None

class Branch(BranchBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)


# ---------- Devices (real, plan-capped device/seat registration) ----------
# Replaces the previous LicenseDevices.jsx page, which showed hardcoded mock rows with no
# backend behind them -- not acceptable for a live production app. `device_id` is a
# client-generated UUID persisted in the browser's localStorage (not the Mongo `id`), so the
# same browser re-registering updates its existing row instead of consuming another seat.
class DeviceCreate(BaseModel):
    device_id: str
    name: str
    user_agent: Optional[str] = None

class Device(DeviceCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    status: str = "Aktif"
    created_at: str = Field(default_factory=utcnow_iso)
    last_seen_at: Optional[str] = None


# ---------- Ingredients (DapurOS BOM) ----------
class IngredientBase(BaseModel):
    name: str
    stock: float = Field(default=0.0, ge=0)
    safety_stock: float = Field(default=0.0, ge=0)
    unit: str  # g, ml, pcs, kg, etc.

class IngredientCreate(IngredientBase):
    pass

class IngredientUpdate(BaseModel):
    name: Optional[str] = None
    stock: Optional[float] = None
    safety_stock: Optional[float] = None
    unit: Optional[str] = None

class Ingredient(IngredientBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)
    updated_at: str = Field(default_factory=utcnow_iso)


# ---------- Spoilage Log (Modul Pencatatan Bahan Terbuang) ----------
SPOILAGE_REASONS = [
    "Kedaluwarsa (Expired)",
    "Tumpah / Rusak Fisik (Spilled)",
    "Kesalahan Pembuatan (Prep Error)",
]

# Peta alias agar nilai lama berbahasa Inggris tetap diterima
SPOILAGE_REASON_ALIASES = {
    "expired": "Kedaluwarsa (Expired)",
    "spilled": "Tumpah / Rusak Fisik (Spilled)",
    "prep error": "Kesalahan Pembuatan (Prep Error)",
    "prep_error": "Kesalahan Pembuatan (Prep Error)",
}


class SpoilageCreate(BaseModel):
    quantity_lost: float = Field(gt=0)
    reason: str
    notes: Optional[str] = None


class SpoilageLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    ingredient_id: str
    ingredient_name: str
    unit: str
    quantity_lost: float
    reason: str
    notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: str = Field(default_factory=utcnow_iso)


# ---------- Floors & Tables (DapurOS F&B) ----------
class FloorBase(BaseModel):
    name: str
    level: int = 1

class FloorCreate(FloorBase):
    pass

class FloorUpdate(BaseModel):
    name: Optional[str] = None
    level: Optional[int] = None

class Floor(FloorBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)
    updated_at: str = Field(default_factory=utcnow_iso)


class TableBase(BaseModel):
    floor_id: str
    label: str
    capacity: int = 4
    status: str = "Vacant" # Vacant | Seated | Dining | Billing
    x_coordinate: float = 0.0
    y_coordinate: float = 0.0
    width: float = 24.0
    height: float = 20.0
    shape: str = "rectangle" # circle | rectangle

class TableCreate(TableBase):
    pass

class TableUpdate(BaseModel):
    floor_id: Optional[str] = None
    label: Optional[str] = None
    capacity: Optional[int] = None
    status: Optional[str] = None
    x_coordinate: Optional[float] = None
    y_coordinate: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    shape: Optional[str] = None

class Table(TableBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)
    updated_at: str = Field(default_factory=utcnow_iso)


class OrderSessionCreate(BaseModel):
    table_id: str

class OrderSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    table_id: str
    store_id: str
    opened_at: str = Field(default_factory=utcnow_iso)
    closed_at: Optional[str] = None
    status: str = "Active" # Active | Paid


class KdsItem(BaseModel):
    name: str
    qty: int
    notes: Optional[str] = None
    status: str = "Pending" # Pending | Cooking | Ready | Served

# ---------- Expenses (Laporan Laba Rugi & Arus Kas) ----------
class ExpenseCreate(BaseModel):
    category: str  # e.g. "Sewa", "Gaji", "Listrik", "Bahan Baku", "Lainnya"
    description: Optional[str] = None
    amount: float = Field(gt=0)
    expense_date: str  # ISO date the expense was incurred (not necessarily today)

class Expense(ExpenseCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    created_by: Optional[str] = None
    created_at: str = Field(default_factory=utcnow_iso)


class KdsTicket(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    table_label: str
    station: str # Kitchen | Bar
    time_elapsed: str = "0 mnt lalu"
    items: List[KdsItem]
    store_id: str
    created_at: str = Field(default_factory=utcnow_iso)
    updated_at: str = Field(default_factory=utcnow_iso)
