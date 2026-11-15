"""
Marswalk Explorer - JPL Horizons Solar Ephemeris Service
"""

import httpx
import math
from datetime import datetime, timezone
from typing import List, Dict, Any
from app.config import settings

async def fetch_horizons_sun_angles(lon_deg: float, lat_deg: float) -> List[Dict[str, Any]]:
    """
    Fetches real solar azimuth and elevation across 24h sol from NASA JPL Horizons.
    Falls back to analytical Mars solar geometry if offline.
    """
    try:
        now = datetime.now(timezone.utc)
        start_str = now.strftime("%Y-%m-%d 00:00")
        stop_str = now.strftime("%Y-%m-%d 23:59")
        
        # NASA JPL Horizons accepts west-positive coordinates for body 499 (Mars)
        target_site = f"'{-lon_deg:.3f},{lat_deg:.3f},0'"
        
        params = {
            "format": "text",
            "COMMAND": "'10'",
            "EPHEM_TYPE": "OBSERVER",
            "CENTER": f"'coord@499'",
            "SITE_COORD": f"{-lon_deg:.3f},{lat_deg:.3f},0",
            "COORD_TYPE": "GEODETIC",
            "START_TIME": f"'{start_str}'",
            "STOP_TIME": f"'{stop_str}'",
            "STEP_SIZE": "'1 h'",
            "QUANTITIES": "'4'",
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(settings.JPL_HORIZONS_API, params=params)
            if res.status_code == 200 and "$$SOE" in res.text:
                lines = res.text.split("$$SOE")[1].split("$$EOE")[0].strip().split("\n")
                points = []
                for i, line in enumerate(lines):
                    parts = line.strip().split()
                    if len(parts) >= 4:
                        az = float(parts[-2])
                        el = float(parts[-1])
                        points.append({
                            "hour": i,
                            "timeLabel": f"{i:02d}:00",
                            "azimuthDeg": round(az, 1),
                            "elevationDeg": round(el, 1),
                        })
                if len(points) >= 12:
                    return points
    except Exception:
        pass
    
    # Analytical fallback (Jezero Crater 18.44°N, solar declination ~22°)
    points = []
    for h in range(25):
        hour_angle_deg = (h - 12.0) * 15.0
        ha_rad = math.radians(hour_angle_deg)
        lat_rad = math.radians(lat_deg)
        dec_rad = math.radians(22.0)
        
        sin_elev = math.sin(lat_rad) * math.sin(dec_rad) + math.cos(lat_rad) * math.cos(dec_rad) * math.cos(ha_rad)
        elev_deg = math.degrees(math.asin(max(-1.0, min(1.0, sin_elev))))
        
        cos_az = (math.sin(dec_rad) - math.sin(lat_rad) * sin_elev) / max(0.001, math.cos(lat_rad) * math.cos(math.radians(elev_deg)))
        az_deg = math.degrees(math.acos(max(-1.0, min(1.0, cos_az))))
        if hour_angle_deg > 0:
            az_deg = 360.0 - az_deg
            
        points.append({
            "hour": h,
            "timeLabel": f"{h:02d}:00",
            "azimuthDeg": round(az_deg, 1),
            "elevationDeg": round(elev_deg, 1)
        })
    return points
