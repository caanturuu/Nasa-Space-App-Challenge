from fastapi import APIRouter
from app.api.endpoints import conditions, layers, routes, sun_angle, terrain, tiles

api_router = APIRouter()

api_router.include_router(conditions.router, tags=["Conditions"])
api_router.include_router(layers.router, tags=["Layers"])
api_router.include_router(routes.router, tags=["Routing"])
api_router.include_router(sun_angle.router, tags=["Solar Ephemeris"])
api_router.include_router(terrain.router, tags=["Terrain"])
api_router.include_router(tiles.router, tags=["Tiles"])
