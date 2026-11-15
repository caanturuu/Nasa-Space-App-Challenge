from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional, Any
from app.services.routing_engine import plan_eva_route

router = APIRouter()

class WaypointItem(BaseModel):
    lat: float
    lon: float
    label: Optional[str] = None
    elevationM: Optional[float] = None
    roleTag: Optional[str] = None

class PlanRouteRequest(BaseModel):
    waypoints: List[WaypointItem]
    mode: Optional[str] = "balanced"
    maxSlopeDeg: Optional[float] = 20.0

@router.post("/routes/plan")
async def plan_route(request: PlanRouteRequest):
    wps_dict = [wp.model_dump() for wp in request.waypoints]
    result = plan_eva_route(wps_dict, request.mode or "balanced")
    return result
