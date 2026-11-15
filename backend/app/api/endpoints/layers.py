from fastapi import APIRouter
from app.config import settings

router = APIRouter()

@router.get("/layers")
async def get_layer_catalog():
    return {
        "crs": settings.MARS_CRS_CODE,
        "wmtsCrs": settings.MARS_WMTS_CRS,
        "layers": [
            {
                "id": "viking_mdim21",
                "title": "Viking MDIM2.1 Color Mosaic (232m)",
                "mission": "Viking Orbiter",
                "instrument": "VIS",
                "category": "Imagery",
                "productType": "Color Orthomosaic",
                "isBasemap": True,
                "tileUrl": "/api/tiles/viking_mdim21/{z}/{y}/{x}"
            },
            {
                "id": "mola_clrshade",
                "title": "MGS MOLA Color Shaded Relief (463m)",
                "mission": "Mars Global Surveyor",
                "instrument": "MOLA",
                "category": "Topography",
                "productType": "Color Elevation Relief",
                "isBasemap": True,
                "tileUrl": "/api/tiles/mola_clrshade/{z}/{y}/{x}"
            },
            {
                "id": "ctx_global_5m",
                "title": "MRO CTX Global Beta Mosaic (5m)",
                "mission": "Mars Reconnaissance Orbiter",
                "instrument": "CTX",
                "category": "Context",
                "productType": "High-Res Context Imagery",
                "isBasemap": True,
                "tileUrl": "/api/tiles/ctx_global_5m/{z}/{y}/{x}"
            },
            {
                "id": "jezero_trek_ctx_6m",
                "title": "Jezero Crater CTX Mosaic (6m)",
                "mission": "MRO CTX / Mars 2020",
                "instrument": "CTX",
                "category": "Tactical",
                "productType": "Local Landing Site Mosaic",
                "isBasemap": True,
                "tileUrl": "/api/tiles/jezero_trek_ctx_6m/{z}/{y}/{x}"
            }
        ]
    }
