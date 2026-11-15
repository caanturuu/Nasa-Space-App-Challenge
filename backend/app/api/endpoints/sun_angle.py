from fastapi import APIRouter, Query
from app.services.solar_service import fetch_horizons_sun_angles

router = APIRouter()

@router.get("/sun-angle")
async def get_sun_angle(lon: float = Query(default=77.4509), lat: float = Query(default=18.4446)):
    points = await fetch_horizons_sun_angles(lon, lat)
    return {
        "points": points,
        "source": "JPL_HORIZONS",
        "site": {"lon": lon, "lat": lat}
    }
