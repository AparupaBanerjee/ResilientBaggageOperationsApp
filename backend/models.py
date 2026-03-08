import re
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from enum import Enum


class BagStatus(str, Enum):
    check_in   = "check_in"
    in_transit = "in_transit"
    loaded     = "loaded"
    delivered  = "delivered"
    offloaded  = "offloaded"
    on_hold    = "on_hold"
    rerouted   = "rerouted"


class PassengerStatus(str, Enum):
    checked_in = "checked_in"
    boarded    = "boarded"
    no_show    = "no_show"


class FlightStatus(str, Enum):
    scheduled = "scheduled"
    boarding  = "boarding"
    delayed   = "delayed"
    departed  = "departed"
    arrived   = "arrived"
    cancelled = "cancelled"


class Bag(BaseModel):
    bag_id:           str
    flight_id:        str
    passenger_name:   str
    status:           BagStatus = BagStatus.check_in
    destination_belt: Optional[str] = None
    weight_kg:        float
    last_updated:     str
    sync_pending:     bool = False
    source:           Optional[str] = None


class BagCreate(BaseModel):
    flight_id:      str
    passenger_name: str
    weight_kg:      float = Field(ge=0.5, le=70.0)
    status:         BagStatus = BagStatus.check_in

    @field_validator("flight_id")
    @classmethod
    def validate_flight_id(cls, v: str) -> str:
        v = v.strip().upper()
        if not re.fullmatch(r"[A-Z]{2}\d{3,4}", v):
            raise ValueError("Flight ID must be 2 letters + 3–4 digits (e.g. SK101)")
        return v

    @field_validator("passenger_name")
    @classmethod
    def validate_passenger_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2 or len(v) > 100:
            raise ValueError("Passenger name must be 2–100 characters")
        if re.search(r"[<>\"'`;\\]", v):
            raise ValueError("Passenger name contains invalid characters")
        return v


class BagStatusUpdate(BaseModel):
    status: BagStatus


class FlightStatusUpdate(BaseModel):
    status: FlightStatus


class Flight(BaseModel):
    flight_id:      str
    origin:         Optional[str] = "ARN"
    destination:    str
    flight_type:    str = "outbound"   # "outbound" | "inbound"
    departure_time: str
    arrival_time:   Optional[str] = None
    gate:           str
    belt:           str
    status:         FlightStatus = FlightStatus.scheduled


class FlightCreate(BaseModel):
    flight_id:      str
    origin:         Optional[str] = "ARN"
    destination:    str
    flight_type:    str = "outbound"   # "outbound" | "inbound"
    departure_time: str
    arrival_time:   Optional[str] = None
    gate:           str
    belt:           str
    status:         FlightStatus = FlightStatus.scheduled


class RoutingRule(BaseModel):
    flight_id: str
    belt:      str
    priority:  int = 1
    active:    bool = True


class HealthResponse(BaseModel):
    status:             str
    online:             bool
    edge_doc_count:     int
    main_doc_count:     int
    edge_bag_count:     int = 0
    main_bag_count:     int = 0
    counts_in_sync:     bool
    pending_sync_count: int
    throughput_per_min: int = 0
