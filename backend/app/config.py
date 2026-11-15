"""
Marswalk Explorer - Backend Configuration
Coordinates, NASA JPL API endpoints, and caching TTL parameters.
"""

from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Marswalk Explorer Backend"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]
    
    # Mars Geodetic Reference: IAU_2015:49900 (Sphere Radius 3,396,190m)
    MARS_RADIUS_M: float = 3396190.0
    MARS_CRS_CODE: str = "IAU_2015:49900"
    MARS_WMTS_CRS: str = "urn:ogc:def:crs:EPSG::104905"
    
    # Jezero Crater Bounding Box
    JEZERO_LAT: float = 18.4446
    JEZERO_LON: float = 77.4509
    JEZERO_BOUNDS: dict = {
        "lonMin": 77.30,
        "lonMax": 77.60,
        "latMin": 18.32,
        "latMax": 18.56,
    }
    
    # NASA Upstream Feeds
    REMS_WEATHER_FEED: str = "https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json"
    JPL_HORIZONS_API: str = "https://ssd.jpl.nasa.gov/api/horizons.api"
    TREK_RASTER_CATALOG: str = "https://trek.nasa.gov/tiles/Mars/rasters/eq/list.json"
    TREK_DEM_SERVICE: str = "https://trek.nasa.gov/mars/trekarcgis/rest/services/mola128_mola64_merge_90Nto90S_SimpleC_clon0/ImageServer"

settings = Settings()
