from pydantic import BaseModel, Field, field_serializer, field_validator
import re
from datetime import date, datetime
from typing import Optional, Any
from .models import (
    ProductType,
    ClientType,
    MovementStatus,
    ExitType,
    BookingStatus,
    PaymentType,
    PaymentMethod,
    AccessLevel,
)
from .datetime_utils import format_datetime_br_iso

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class Login(BaseModel):
    email: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=1, max_length=128)

class ProfileCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    slug: str = Field(min_length=2, max_length=40)
    clinical_slug: Optional[str] = Field(default=None, max_length=40)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        slug = v.strip().lower()
        if not re.match(r"^[a-z][a-z0-9_]{1,39}$", slug):
            raise ValueError("Slug inválido")
        return slug

class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    slug: Optional[str] = Field(default=None, min_length=2, max_length=40)
    clinical_slug: Optional[str] = Field(default=None, max_length=40)
    active: Optional[bool] = None

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        slug = v.strip().lower()
        if not re.match(r"^[a-z][a-z0-9_]{1,39}$", slug):
            raise ValueError("Slug inválido")
        return slug

class UserBase(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    profile_id: int
    active: bool = True

class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not re.match(r"^(?=.*[A-Za-z])(?=.*\d).{8,}$", v):
            raise ValueError("Senha deve conter letras e números (mín. 8 caracteres)")
        return v

class UserUpdate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    profile_id: int
    active: bool = True
    password: Optional[str] = Field(default=None, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        if not re.match(r"^(?=.*[A-Za-z])(?=.*\d).{8,}$", v):
            raise ValueError("Senha deve conter letras e números (mín. 8 caracteres)")
        return v

class UserRead(UserBase):
    id: int
    clinic_id: int
    profile_name: Optional[str] = None
    created_at: Optional[datetime] = None
    class Config: from_attributes = True

    @field_serializer('created_at')
    def serialize_created_at(self, value: datetime | None) -> str | None:
        return format_datetime_br_iso(value)

class ProfileRead(BaseModel):
    id: int
    name: str
    slug: str
    is_system: bool = False
    is_admin: bool = False
    clinical_slug: Optional[str] = None
    active: bool = True
    user_count: Optional[int] = None
    class Config: from_attributes = True

class ProfilePermissionItem(BaseModel):
    menu_key: str
    access_level: AccessLevel

class ProfilePermissionsUpdate(BaseModel):
    permissions: list[ProfilePermissionItem]

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
    address: Optional[str] = None
    city: Optional[str] = None
    responsible_name: Optional[str] = None
    state: Optional[str] = None
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
    total_amount: Optional[float] = None
    payment_method: Optional[PaymentMethod] = None
    payment_notes: Optional[str] = None

class AttendanceSectionUpdate(BaseModel):
    notes: Optional[str] = None
    prescription: Optional[str] = None
    external_prescription: Optional[str] = None

class PaymentRead(BaseModel):
    id: int
    payment_type: PaymentType
    amount: float
    payment_method: PaymentMethod
    paid_at: datetime
    user_id: int
    user_name: Optional[str] = None
    notes: Optional[str] = None

    @field_serializer('paid_at')
    def serialize_paid_at(self, value: datetime) -> str | None:
        return format_datetime_br_iso(value)

class BookingRead(BaseModel):
    id: int
    patient_id: int
    patient_name: Optional[str] = None
    scheduled_date: date
    total_amount: float
    deposit_amount: float
    balance_amount: float
    status: BookingStatus
    attendance_id: Optional[int] = None
    notes: Optional[str] = None
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    payments: list[PaymentRead] = []

    @field_serializer('created_at')
    def serialize_created_at(self, value: datetime | None) -> str | None:
        return format_datetime_br_iso(value)

class BookingCreate(BaseModel):
    patient_id: int
    scheduled_date: date
    total_amount: float
    payment_method: PaymentMethod
    paid_at: Optional[datetime] = None
    notes: Optional[str] = None
    payment_notes: Optional[str] = None

class BookingCheckIn(BaseModel):
    payment_method: PaymentMethod
    paid_at: Optional[datetime] = None
    payment_notes: Optional[str] = None

class VitalSignUpdate(BaseModel):
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    heart_rate: Optional[int] = None
    temperature: Optional[float] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    spo2: Optional[int] = None
    glycemia: Optional[int] = None
    notes: Optional[str] = None

class VitalSignRead(BaseModel):
    id: int
    patient_id: int
    attendance_id: int
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    heart_rate: Optional[int] = None
    temperature: Optional[float] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    spo2: Optional[int] = None
    glycemia: Optional[int] = None
    notes: Optional[str] = None
    recorded_by: int
    recorded_by_name: Optional[str] = None
    recorded_at: datetime
    attendance_date: Optional[date] = None
    bmi: Optional[float] = None

    @field_serializer('recorded_at')
    def serialize_recorded_at(self, value: datetime) -> str | None:
        return format_datetime_br_iso(value)

class BookingSummary(BaseModel):
    id: int
    scheduled_date: date
    total_amount: float
    deposit_amount: float
    balance_amount: float
    status: BookingStatus
    payments: list[PaymentRead] = []

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
    external_prescription: Optional[str] = None
    tech_notes: Optional[str] = None
    nursing_notes: Optional[str] = None
    doctor_user_id: Optional[int] = None
    tech_user_id: Optional[int] = None
    nursing_user_id: Optional[int] = None
    vitals_user_id: Optional[int] = None
    doctor_user_name: Optional[str] = None
    tech_user_name: Optional[str] = None
    nursing_user_name: Optional[str] = None
    vitals_user_name: Optional[str] = None
    doctor_updated_at: Optional[datetime] = None
    tech_updated_at: Optional[datetime] = None
    nursing_updated_at: Optional[datetime] = None
    vitals_recorded_at: Optional[datetime] = None
    workflow_status: Optional[str] = None
    booking: Optional[BookingSummary] = None
    vitals: Optional[VitalSignRead] = None
    exits: list[ExitRead] = []

    @field_serializer('doctor_updated_at', 'tech_updated_at', 'nursing_updated_at', 'vitals_recorded_at')
    def serialize_section_updated_at(self, value: datetime | None) -> str | None:
        return format_datetime_br_iso(value)

class AttendancePendingItem(BaseModel):
    id: int
    item_type: str = "atendimento"
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
    session_id: Optional[int] = None
    session_number: Optional[int] = None
    total_sessions: Optional[int] = None

    @field_serializer('doctor_updated_at')
    def serialize_doctor_updated_at(self, value: datetime | None) -> str | None:
        return format_datetime_br_iso(value)

class TreatmentCreate(BaseModel):
    medications: str
    total_sessions: int
    notes: Optional[str] = None

class TreatmentSessionListItem(BaseModel):
    id: int
    session_number: int
    session_date: Optional[date] = None
    status: str
    signed: bool = False

class TreatmentRead(BaseModel):
    id: int
    attendance_id: int
    patient_id: int
    patient_name: Optional[str] = None
    medications: str
    total_sessions: int
    notes: Optional[str] = None
    doctor_user_id: Optional[int] = None
    doctor_user_name: Optional[str] = None
    active: bool = True
    created_at: Optional[datetime] = None
    sessions_done: int = 0
    sessions: list[TreatmentSessionListItem] = []

    @field_serializer('created_at')
    def serialize_created_at(self, value: datetime | None) -> str | None:
        return format_datetime_br_iso(value)

class TreatmentSessionRead(BaseModel):
    id: int
    treatment_id: int
    session_number: int
    total_sessions: int
    patient_id: int
    patient_name: Optional[str] = None
    patient_phone: Optional[str] = None
    medications: str
    treatment_notes: Optional[str] = None
    doctor_user_name: Optional[str] = None
    session_date: Optional[date] = None
    tech_notes: Optional[str] = None
    tech_user_id: Optional[int] = None
    tech_user_name: Optional[str] = None
    tech_updated_at: Optional[datetime] = None
    nursing_notes: Optional[str] = None
    nursing_user_id: Optional[int] = None
    nursing_user_name: Optional[str] = None
    nursing_updated_at: Optional[datetime] = None
    patient_signature: Optional[str] = None
    signed_at: Optional[datetime] = None
    status: str
    exits: list[ExitRead] = []

    @field_serializer('tech_updated_at', 'nursing_updated_at', 'signed_at')
    def serialize_session_datetimes(self, value: datetime | None) -> str | None:
        return format_datetime_br_iso(value)

class TreatmentSessionSectionUpdate(BaseModel):
    session_date: Optional[date] = None
    notes: Optional[str] = None

class SessionSignatureCreate(BaseModel):
    signature: str

class SignatureLinkRead(BaseModel):
    token: str
    expires_at: datetime

    @field_serializer('expires_at')
    def serialize_expires_at(self, value: datetime) -> str | None:
        return format_datetime_br_iso(value)

class PublicSignExitItem(BaseModel):
    product_name: str
    quantity: int
    unit: Optional[str] = None

class PublicSignPreview(BaseModel):
    clinic_name: str
    session_number: int
    total_sessions: int
    session_date: Optional[date] = None
    ready_to_sign: bool = True

class PublicSignInfo(BaseModel):
    patient_name: str
    session_number: int
    total_sessions: int
    session_date: Optional[date] = None
    medications: str
    comments: Optional[str] = None
    exits: list[PublicSignExitItem] = []

class PublicSignCreate(BaseModel):
    signature: str = Field(min_length=20, max_length=700_000)
    pin: Optional[str] = Field(default=None, max_length=12)

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
