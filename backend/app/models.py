from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, ForeignKey, Text, Enum, Numeric, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .database import Base

class ProductType(str, enum.Enum):
    insumos = "insumos"
    homeopaticos = "homeopaticos"
    injetaveis = "injetaveis"
    vo = "V.O."

class ClientType(str, enum.Enum):
    paciente = "paciente"
    medico = "medico"
    setor_interno = "setor_interno"
    funcionario = "funcionario"
    outro = "outro"

class MovementStatus(str, enum.Enum):
    ativa = "ativa"
    cancelada = "cancelada"

class ExitType(str, enum.Enum):
    consumo = "consumo"
    baixa_vencido = "baixa_vencido"

class AccessLevel(str, enum.Enum):
    hidden = "hidden"
    read = "read"
    write = "write"

class BookingStatus(str, enum.Enum):
    agendado = "agendado"
    presente = "presente"
    cancelado = "cancelado"

class PaymentType(str, enum.Enum):
    entrada = "entrada"
    saldo = "saldo"

class PaymentMethod(str, enum.Enum):
    pix = "pix"
    dinheiro = "dinheiro"
    cartao = "cartao"
    transferencia = "transferencia"

class Clinic(Base):
    __tablename__ = "clinics"
    id = Column(Integer, primary_key=True)
    name = Column(String(180), nullable=False)
    cnpj = Column(String(30))
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

class Profile(Base):
    __tablename__ = "profiles"
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False, default=1)
    name = Column(String(120), nullable=False)
    slug = Column(String(80), nullable=False, index=True)
    is_system = Column(Boolean, default=False, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    clinical_slug = Column(String(40), nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    permissions = relationship("ProfilePermission", back_populates="profile", cascade="all, delete-orphan")
    users = relationship("User", back_populates="profile")

class MenuItemRecord(Base):
    __tablename__ = "menu_items"
    menu_key = Column(String(60), primary_key=True)
    label = Column(String(120), nullable=False)
    route_paths = Column(Text, nullable=False)
    nav_group = Column(String(40), nullable=True)
    sort_order = Column(Integer, default=0)
    active = Column(Boolean, default=True)

class ProfilePermission(Base):
    __tablename__ = "profile_permissions"
    id = Column(Integer, primary_key=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False)
    menu_key = Column(String(60), ForeignKey("menu_items.menu_key"), nullable=False)
    access_level = Column(Enum(AccessLevel), default=AccessLevel.hidden, nullable=False)
    profile = relationship("Profile", back_populates="permissions")
    menu_item = relationship("MenuItemRecord")

class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("clinic_id", "email", name="uq_users_clinic_email"),)
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False, default=1)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False)
    name = Column(String(160), nullable=False)
    email = Column(String(160), index=True, nullable=False)
    phone = Column(String(40))
    password_hash = Column(String(255), nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    profile = relationship("Profile", back_populates="users")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False, default=1)
    name = Column(String(180), nullable=False)
    document = Column(String(40))
    phone = Column(String(40))
    email = Column(String(160))
    address = Column(String(255))
    notes = Column(Text)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

class Client(Base):
    __tablename__ = "clients"
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False, default=1)
    name = Column(String(180), nullable=False)
    client_type = Column(Enum(ClientType), nullable=False)
    document = Column(String(40))
    phone = Column(String(40))
    email = Column(String(160))
    address = Column(String(255))
    city = Column(String(120))
    responsible_name = Column(String(180))
    state = Column(String(2))
    notes = Column(Text)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False, default=1)
    name = Column(String(180), nullable=False)
    product_type = Column(Enum(ProductType), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    barcode = Column(String(80), nullable=True)
    minimum_stock = Column(Integer, nullable=False, default=0)
    expiration_alert_days = Column(Integer, nullable=False, default=30)
    unit = Column(String(30), default="un")
    cost_price = Column(Numeric(12,2), nullable=True)  # preparado para fase futura
    notes = Column(Text)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    supplier = relationship("Supplier")

class Lot(Base):
    __tablename__ = "lots"
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False, default=1)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    lot_number = Column(String(120), nullable=False)
    expiration_date = Column(Date, nullable=False)
    current_stock = Column(Integer, nullable=False, default=0)
    quantity_in_use = Column(Integer, nullable=False, default=0)
    blocked = Column(Boolean, default=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    product = relationship("Product")
    supplier = relationship("Supplier")

class StockEntry(Base):
    __tablename__ = "stock_entries"
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False, default=1)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    lot_id = Column(Integer, ForeignKey("lots.id"), nullable=False)
    entry_date = Column(Date, nullable=False)
    quantity = Column(Integer, nullable=False)
    notes = Column(Text)
    entry_code = Column(String(32), nullable=True, index=True)
    status = Column(Enum(MovementStatus), default=MovementStatus.ativa, nullable=False)
    cancel_reason = Column(Text)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    product = relationship("Product")
    supplier = relationship("Supplier")
    lot = relationship("Lot")
    user = relationship("User")

class StockExit(Base):
    __tablename__ = "stock_exits"
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False, default=1)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    lot_id = Column(Integer, ForeignKey("lots.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    attendance_id = Column(Integer, ForeignKey("attendances.id"), nullable=True)
    treatment_session_id = Column(Integer, ForeignKey("treatment_sessions.id"), nullable=True)
    exit_date = Column(Date, nullable=False)
    quantity = Column(Integer, nullable=False)
    reason = Column(String(255))
    notes = Column(Text)
    exit_type = Column(Enum(ExitType), default=ExitType.consumo, nullable=False)
    status = Column(Enum(MovementStatus), default=MovementStatus.ativa, nullable=False)
    cancel_reason = Column(Text)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    product = relationship("Product")
    lot = relationship("Lot")
    client = relationship("Client")
    user = relationship("User")
    attendance = relationship("Attendance", back_populates="exits")
    treatment_session = relationship("TreatmentSession", back_populates="exits")

class ConsultationBooking(Base):
    __tablename__ = "consultation_bookings"
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False, default=1)
    patient_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    scheduled_date = Column(Date, nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    deposit_amount = Column(Numeric(12, 2), nullable=False)
    balance_amount = Column(Numeric(12, 2), nullable=False)
    status = Column(Enum(BookingStatus), default=BookingStatus.agendado, nullable=False)
    attendance_id = Column(Integer, ForeignKey("attendances.id"), nullable=True)
    notes = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    patient = relationship("Client", foreign_keys=[patient_id])
    attendance = relationship("Attendance", foreign_keys=[attendance_id])
    created_by_user = relationship("User", foreign_keys=[created_by])
    payments = relationship("Payment", back_populates="booking")

class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False, default=1)
    booking_id = Column(Integer, ForeignKey("consultation_bookings.id"), nullable=False)
    payment_type = Column(Enum(PaymentType), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(Enum(PaymentMethod), nullable=False)
    paid_at = Column(DateTime, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    booking = relationship("ConsultationBooking", back_populates="payments")
    user = relationship("User")

class Attendance(Base):
    __tablename__ = "attendances"
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False, default=1)
    patient_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    booking_id = Column(Integer, ForeignKey("consultation_bookings.id"), nullable=True)
    attendance_date = Column(Date, nullable=False)
    doctor_notes = Column(Text)
    prescription = Column(Text)
    external_prescription = Column(Text)
    tech_notes = Column(Text)
    nursing_notes = Column(Text)
    doctor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    tech_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    nursing_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    vitals_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    doctor_updated_at = Column(DateTime, nullable=True)
    tech_updated_at = Column(DateTime, nullable=True)
    nursing_updated_at = Column(DateTime, nullable=True)
    vitals_recorded_at = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    patient = relationship("Client", foreign_keys=[patient_id])
    booking = relationship("ConsultationBooking", foreign_keys=[booking_id])
    doctor_user = relationship("User", foreign_keys=[doctor_user_id])
    tech_user = relationship("User", foreign_keys=[tech_user_id])
    nursing_user = relationship("User", foreign_keys=[nursing_user_id])
    vitals_user = relationship("User", foreign_keys=[vitals_user_id])
    exits = relationship("StockExit", back_populates="attendance")
    vital_signs = relationship("VitalSign", back_populates="attendance", uselist=False)

class VitalSign(Base):
    __tablename__ = "vital_signs"
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False, default=1)
    patient_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    attendance_id = Column(Integer, ForeignKey("attendances.id"), nullable=False, unique=True)
    systolic_bp = Column(Integer, nullable=True)
    diastolic_bp = Column(Integer, nullable=True)
    heart_rate = Column(Integer, nullable=True)
    temperature = Column(Numeric(4, 1), nullable=True)
    weight = Column(Numeric(6, 2), nullable=True)
    height = Column(Numeric(5, 1), nullable=True)
    spo2 = Column(Integer, nullable=True)
    glycemia = Column(Integer, nullable=True)
    notes = Column(Text)
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    recorded_at = Column(DateTime, nullable=False)
    patient = relationship("Client", foreign_keys=[patient_id])
    attendance = relationship("Attendance", back_populates="vital_signs")
    recorder = relationship("User", foreign_keys=[recorded_by])

class Treatment(Base):
    __tablename__ = "treatments"
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False, default=1)
    attendance_id = Column(Integer, ForeignKey("attendances.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    medications = Column(Text, nullable=False)
    total_sessions = Column(Integer, nullable=False)
    notes = Column(Text)
    doctor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    attendance = relationship("Attendance")
    patient = relationship("Client", foreign_keys=[patient_id])
    doctor_user = relationship("User", foreign_keys=[doctor_user_id])
    sessions = relationship(
        "TreatmentSession",
        back_populates="treatment",
        order_by="TreatmentSession.session_number",
    )

class TreatmentSession(Base):
    __tablename__ = "treatment_sessions"
    id = Column(Integer, primary_key=True)
    treatment_id = Column(Integer, ForeignKey("treatments.id"), nullable=False)
    session_number = Column(Integer, nullable=False)
    session_date = Column(Date, nullable=True)
    tech_notes = Column(Text)
    tech_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    tech_updated_at = Column(DateTime, nullable=True)
    nursing_notes = Column(Text)
    nursing_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    nursing_updated_at = Column(DateTime, nullable=True)
    patient_signature = Column(Text, nullable=True)
    signed_at = Column(DateTime, nullable=True)
    signature_token = Column(String(80), nullable=True, index=True)
    signature_token_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    treatment = relationship("Treatment", back_populates="sessions")
    tech_user = relationship("User", foreign_keys=[tech_user_id])
    nursing_user = relationship("User", foreign_keys=[nursing_user_id])
    exits = relationship("StockExit", back_populates="treatment_session")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False, default=1)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(50), nullable=False)
    entity = Column(String(80), nullable=False)
    entity_id = Column(Integer, nullable=True)
    before_data = Column(Text)
    after_data = Column(Text)
    ip_address = Column(String(60))
    created_at = Column(DateTime, server_default=func.now())
    user = relationship("User")
