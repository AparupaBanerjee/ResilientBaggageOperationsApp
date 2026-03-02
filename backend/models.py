from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class BagStatus(str, Enum):
    check_in = "check_in"
    in_transit = "in_transit"
    loaded = "loaded"
    delivered = "delivered"


class FlightStatus(str, Enum):
    scheduled = "scheduled"
    boarding = "boarding"
    departed = "departed"
    cancelled = "cancelled"


class Bag(BaseModel):
    bag_id: str
    flight_id: str
    passenger_name: str
    status: BagStatus = BagStatus.check_in
    destination_belt: Optional[str] = None
    weight_kg: float
    last_updated: str
    sync_pending: bool = False
    source: Optional[str] = None


class BagCreate(BaseModel):
    flight_id: str
    passenger_name: str
    weight_kg: float = Field(ge=0.5, le=50.0)
    status: BagStatus = BagStatus.check_in


class BagStatusUpdate(BaseModel):
    status: BagStatus


class Flight(BaseModel):
    flight_id: str
    destination: str
    departure_time: str
    gate: str
    belt: str
    status: FlightStatus = FlightStatus.scheduled


class FlightCreate(BaseModel):
    flight_id: str
    destination: str
    departure_time: str
    gate: str
    belt: str
    status: FlightStatus = FlightStatus.scheduled


class RoutingRule(BaseModel):
    flight_id: str
    belt: str
    priority: int = 1
    active: bool = True


class HealthResponse(BaseModel):
    status: str
    online: bool
    edge_doc_count: int
    main_doc_count: int
    counts_in_sync: bool
    pending_sync_count: int
