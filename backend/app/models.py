from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, ForeignKey, Text, Enum, Numeric
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

class UserRole(str, enum.Enum):
    administrador = "administrador"
    estoque = "estoque"
    operacional = "operacional"
    consulta = "consulta"
    medico = "medico"
    enfermeira = "enfermeira"
    tecnica_enfermagem = "tecnica_enfermagem"
    vendedor = "vendedor"

class Clinic(Base):
    __tablename__ = "clinics"
    id = Column(Integer, primary_key=True)
    name = Column(String(180), nullable=False)
    cnpj = Column(String(30))
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False, default=1)
    name = Column(String(160), nullable=False)
    email = Column(String(160), unique=True, index=True, nullable=False)
    cargo = Column(String(120))
    phone = Column(String(40))
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.administrador, nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

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

class Attendance(Base):
    __tablename__ = "attendances"
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False, default=1)
    patient_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    attendance_date = Column(Date, nullable=False)
    doctor_notes = Column(Text)
    prescription = Column(Text)
    tech_notes = Column(Text)
    nursing_notes = Column(Text)
    doctor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    tech_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    nursing_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    doctor_updated_at = Column(DateTime, nullable=True)
    tech_updated_at = Column(DateTime, nullable=True)
    nursing_updated_at = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    patient = relationship("Client", foreign_keys=[patient_id])
    doctor_user = relationship("User", foreign_keys=[doctor_user_id])
    tech_user = relationship("User", foreign_keys=[tech_user_id])
    nursing_user = relationship("User", foreign_keys=[nursing_user_id])
    exits = relationship("StockExit", back_populates="attendance")

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
