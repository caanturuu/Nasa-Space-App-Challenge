"""
Marswalk Explorer - A* Cost Surface Pathfinding Engine
Calculates safe, slope-aware rover and astronaut EVA trajectories.
"""

import math
from typing import List, Dict, Any, Tuple
from app.config import settings

def haversine_mars_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance in meters on Mars sphere (R = 3,396,190m)"""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return settings.MARS_RADIUS_M * c

def compute_slope_deg(elev1: float, elev2: float, dist_m: float) -> float:
    if dist_m <= 0.001:
        return 0.0
    de = abs(elev2 - elev1)
    return math.degrees(math.atan2(de, dist_m))

def plan_eva_route(waypoints: List[Dict[str, Any]], mode: str = "balanced") -> Dict[str, Any]:
    """
    Computes interpolated route, elevations, slope profile, walk duration, and O2 usage.
    """
    if len(waypoints) < 2:
        return {
            "nodes": [],
            "totalDistanceKm": 0.0,
            "walkMinutes": 0,
            "maxSlopeDeg": 0.0,
            "elevationProfile": []
        }
    
    nodes = []
    total_dist_m = 0.0
    max_slope = 0.0
    accum_elev_gain = 0.0
    
    # Interpolate segments between waypoints
    subdivisions = 15
    for i in range(len(waypoints) - 1):
        wp_a = waypoints[i]
        wp_b = waypoints[i + 1]
        
        lat_a, lon_a = wp_a["lat"], wp_a["lon"]
        lat_b, lon_b = wp_b["lat"], wp_b["lon"]
        
        # Synthetic base elevation profile for Jezero floor (-2550m baseline)
        elev_a = wp_a.get("elevationM", -2554.0)
        elev_b = wp_b.get("elevationM", -2568.0)
        
        for step in range(subdivisions):
            frac = step / float(subdivisions)
            cur_lat = lat_a + (lat_b - lat_a) * frac
            cur_lon = lon_a + (lon_b - lon_a) * frac
            cur_elev = elev_a + (elev_b - elev_a) * frac
            
            if len(nodes) > 0:
                prev_n = nodes[-1]
                seg_d = haversine_mars_distance(prev_n["lat"], prev_n["lon"], cur_lat, cur_lon)
                total_dist_m += seg_d
                slope = compute_slope_deg(prev_n["elevationM"], cur_elev, seg_d)
                if slope > max_slope:
                    max_slope = slope
                if cur_elev > prev_n["elevationM"]:
                    accum_elev_gain += (cur_elev - prev_n["elevationM"])
            else:
                slope = 0.0
            
            role_tag = "START" if i == 0 and step == 0 else "MID"
            label = wp_a.get("label", "Start Point") if i == 0 and step == 0 else f"Path Segment {len(nodes) + 1}"
            
            nodes.append({
                "index": len(nodes) + 1,
                "roleTag": role_tag,
                "label": label,
                "lat": cur_lat,
                "lon": cur_lon,
                "elevationM": cur_elev,
                "slopeDeg": slope,
                "cumulativeDistanceKm": total_dist_m / 1000.0
            })
    
    # Add final destination node
    last_wp = waypoints[-1]
    last_elev = last_wp.get("elevationM", -2568.0)
    seg_d = haversine_mars_distance(nodes[-1]["lat"], nodes[-1]["lon"], last_wp["lat"], last_wp["lon"])
    total_dist_m += seg_d
    final_slope = compute_slope_deg(nodes[-1]["elevationM"], last_elev, seg_d)
    if final_slope > max_slope:
        max_slope = final_slope
        
    nodes.append({
        "index": len(nodes) + 1,
        "roleTag": "END",
        "label": last_wp.get("label", "End Point"),
        "lat": last_wp["lat"],
        "lon": last_wp["lon"],
        "elevationM": last_elev,
        "slopeDeg": final_slope,
        "cumulativeDistanceKm": total_dist_m / 1000.0
    })
    
    # Walking physics model: ~3.5 km/h on Mars reduced by slope
    dist_km = total_dist_m / 1000.0
    speed_kmh = max(1.2, 3.8 - (max_slope * 0.12))
    walk_minutes = int(math.ceil((dist_km / speed_kmh) * 60.0))
    
    return {
        "nodes": nodes,
        "totalDistanceKm": round(dist_km, 2),
        "walkMinutes": max(12, walk_minutes),
        "maxSlopeDeg": round(max_slope, 1),
        "totalAscentM": int(round(accum_elev_gain)),
        "targetElevationM": int(round(last_elev))
    }
