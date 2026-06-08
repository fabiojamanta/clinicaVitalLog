from pydantic import BaseModel, field_serializer
from datetime import date, datetime
from typing import Optional, Any
from .models import ProductType, ClientType, UserRole, MovementStatus, ExitType
from .datetime_utils import format_datetime_br_iso

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class Login(BaseModel):
    email: str
    password: str

class UserBase(BaseModel):
    name: str
    email: str
    role: UserRole = UserRole.operacional
    active: bool = True

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    name: str
    email: str
    role: UserRole = UserRole.operacional
    active: bool = True
    password: Optional[str] = None

class UserRead(UserBase):
    id: int
    clinic_id: int
    created_at: Optional[datetime] = None
    class Config: from_attributes = True

    @field_serializer('created_at')
    def serialize_created_at(self, value: datetime | None) -> str | None:
        return format_datetime_br_iso(value)

class SupplierBase(BaseModel):
    name: str
    document: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    active: bool = True
class SupplierCreate(SupplierBase): pass
class SupplierRead(SupplierBase):
    id: int
    class Config: from_attributes = True

class ClientBase(BaseModel):
    name: str
    client_type: ClientType
    document: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    active: bool = True
class ClientCreate(ClientBase): pass
class ClientRead(ClientBase):
    id: int
    class Config: from_attributes = True

class ProductBase(BaseModel):
    name: str
    product_type: ProductType
    supplier_id: Optional[int] = None
    barcode: Optional[str] = None
    minimum_stock: int = 0
    expiration_alert_days: int = 30
    unit: Optional[str] = "un"
    cost_price: Optional[float] = None
    notes: Optional[str] = None
    active: bool = True
class ProductCreate(ProductBase): pass
class ProductRead(ProductBase):
    id: int
    total_stock: Optional[int] = 0
    supplier_name: Optional[str] = None
    class Config: from_attributes = True

class LotCreate(BaseModel):
    product_id: int
    supplier_id: int
    lot_number: str
    expiration_date: date
    current_stock: int = 0
    quantity_in_use: int = 0
    blocked: bool = False
    active: bool = True
class LotRead(LotCreate):
    id: int
    product_name: Optional[str] = None
    supplier_name: Optional[str] = None
    expired: Optional[bool] = False
    near_expiration: Optional[bool] = False
    class Config: from_attributes = True

class EntryCreate(BaseModel):
    product_id: int
    lot_number: str
    expiration_date: date
    entry_date: date
    quantity: int
    notes: Optional[str] = None
class EntryRead(EntryCreate):
    id: int
    entry_code: str
    user_id: int
    status: MovementStatus = MovementStatus.ativa
    cancel_reason: Optional[str] = None
    supplier_id: Optional[int] = None
    lot_id: Optional[int] = None
    product_name: Optional[str] = None
    supplier_name: Optional[str] = None
    lot_current_stock: Optional[int] = None
    class Config: from_attributes = True

class CancelEntry(BaseModel):
    cancel_reason: str

class EntryLookupRead(BaseModel):
    entry_code: str
    product_id: int
    product_name: str
    lot_id: int
    lot_number: str
    expiration_date: date
    quantity: int
    lot_current_stock: int
    expired: bool = False

class ExitCreate(BaseModel):
    product_id: int
    lot_id: int
    client_id: int
    exit_date: date
    quantity: int
    exit_type: ExitType = ExitType.consumo
    reason: Optional[str] = None
    notes: Optional[str] = None
    attendance_id: Optional[int] = None
class ExitRead(ExitCreate):
    id: int
    user_id: int
    status: MovementStatus
    cancel_reason: Optional[str] = None
    product_name: Optional[str] = None
    lot_number: Optional[str] = None
    client_name: Optional[str] = None
    user_name: Optional[str] = None
    class Config: from_attributes = True

class CancelExit(BaseModel):
    cancel_reason: str

class AttendanceCreate(BaseModel):
    patient_id: int
    attendance_date: date

class AttendanceSectionUpdate(BaseModel):
    notes: Optional[str] = None
    prescription: Optional[str] = None

class AttendanceDispenseCreate(BaseModel):
    product_id: int
    lot_id: int
    quantity: int
    reason: Optional[str] = None
    notes: Optional[str] = None

class AttendanceListItem(BaseModel):
    id: int
    patient_id: int
    patient_name: Optional[str] = None
    attendance_date: date
    created_at: Optional[datetime] = None

    @field_serializer('created_at')
    def serialize_created_at(self, value: datetime | None) -> str | None:
        return format_datetime_br_iso(value)

class AttendanceRead(BaseModel):
    id: int
    patient_id: int
    patient_name: Optional[str] = None
    attendance_date: date
    doctor_notes: Optional[str] = None
    prescription: Optional[str] = None
    tech_notes: Optional[str] = None
    nursing_notes: Optional[str] = None
    doctor_user_id: Optional[int] = None
    tech_user_id: Optional[int] = None
    nursing_user_id: Optional[int] = None
    doctor_user_name: Optional[str] = None
    tech_user_name: Optional[str] = None
    nursing_user_name: Optional[str] = None
    doctor_updated_at: Optional[datetime] = None
    tech_updated_at: Optional[datetime] = None
    nursing_updated_at: Optional[datetime] = None
    exits: list[ExitRead] = []

    @field_serializer('doctor_updated_at', 'tech_updated_at', 'nursing_updated_at')
    def serialize_section_updated_at(self, value: datetime | None) -> str | None:
        return format_datetime_br_iso(value)

class AttendancePendingItem(BaseModel):
    id: int
    patient_id: int
    patient_name: Optional[str] = None
    attendance_date: date
    pending_for: str
    pending_action: str
    workflow_status: str
    prescription: Optional[str] = None
    doctor_user_name: Optional[str] = None
    doctor_updated_at: Optional[datetime] = None
    has_dispensed: bool = False

    @field_serializer('doctor_updated_at')
    def serialize_doctor_updated_at(self, value: datetime | None) -> str | None:
        return format_datetime_br_iso(value)

class AuditRead(BaseModel):
    id: int
    user_id: Optional[int]
    user_name: Optional[str] = None
    action: str
    entity: str
    entity_id: Optional[int]
    before_data: Optional[str]
    after_data: Optional[str]
    created_at: datetime
    class Config: from_attributes = True

    @field_serializer('created_at')
    def serialize_created_at(self, value: datetime) -> str:
        return format_datetime_br_iso(value) or ''
