from fastapi import APIRouter, Response, HTTPException
import httpx

router = APIRouter()

TILE_UPSTREAMS = {
    "viking_mdim21": "https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default028mm/1.0.0/{z}/{y}/{x}.jpg",
    "mola_clrshade": "https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default028mm/1.0.0/{z}/{y}/{x}.png",
    "ctx_global_5m": "https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/{z}/{y}/{x}",
    "jezero_trek_ctx_6m": "https://trek.nasa.gov/tiles/Mars/EQ/Jezero_CTX_mosaic_6m/1.0.0/default028mm/1.0.0/{z}/{y}/{x}.png"
}

# In-memory LRU tile cache
tile_cache = {}

@router.get("/tiles/{layer_id}/{z}/{y}/{x}")
async def get_tile(layer_id: str, z: int, y: int, x: int):
    cache_key = f"{layer_id}:{z}:{y}:{x}"
    if cache_key in tile_cache:
        cached_bytes, ctype = tile_cache[cache_key]
        return Response(content=cached_bytes, media_type=ctype)
        
    template = TILE_UPSTREAMS.get(layer_id)
    if not template:
        raise HTTPException(status_code=404, detail="Layer tile template not found")
        
    url = template.replace("{z}", str(z)).replace("{y}", str(y)).replace("{x}", str(x))
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(url)
            if res.status_code == 200:
                ctype = res.headers.get("content-type", "image/png")
                # Keep cache bounded to 500 entries
                if len(tile_cache) > 500:
                    tile_cache.pop(next(iter(tile_cache)))
                tile_cache[cache_key] = (res.content, ctype)
                return Response(content=res.content, media_type=ctype)
            else:
                raise HTTPException(status_code=res.status_code, detail="Upstream tile fetch error")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
