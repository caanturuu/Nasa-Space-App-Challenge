from fastapi import APIRouter
from app.config import settings

router = APIRouter()

@router.get("/terrain/jezero")
async def get_jezero_terrain():
    """
    Returns metadata for Jezero Crater MOLA DEM raster bounds and elevation grid configuration.
    """
    return {
        "rows": 120,
        "cols": 140,
        "bounds": settings.JEZERO_BOUNDS,
        "minM": -2700,
        "maxM": -2200,
        "source": "NASA_TREK_DEM",
        "demService": settings.TREK_DEM_SERVICE
    }
