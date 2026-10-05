"""Rebuild data/gn_divisions.geojson from the original shapefile.
Usage:  pip install pyshp pyproj shapely
        python tools/convert_gnd.py
Reprojects WGS 84 / UTM 44N (EPSG:32644) to WGS 84 (EPSG:4326), simplifies by 8 m,
keeps only the fields the web map uses, and rounds coordinates to 5 decimals.
"""
import json, shapefile
from shapely.geometry import shape, mapping
from shapely.validation import make_valid
from shapely.ops import transform, unary_union
from pyproj import Transformer

SRC, OUT = "data/source/GND/gnd", "data/gn_divisions.geojson"
t = Transformer.from_crs("EPSG:32644", "EPSG:4326", always_xy=True)
rnd = lambda c: [round(c[0], 5), round(c[1], 5)] if isinstance(c[0], (int, float)) else [rnd(x) for x in c]

feats = []
for sr in shapefile.Reader(SRC, encoding="utf-8").shapeRecords():
    p = sr.record.as_dict()
    g = shape(sr.shape.__geo_interface__)
    g = make_valid(g) if not g.is_valid else g
    g = transform(t.transform, g.simplify(8, preserve_topology=True))
    if g.geom_type == "GeometryCollection":
        g = unary_union([x for x in g.geoms if x.geom_type in ("Polygon", "MultiPolygon")])
    geo = json.loads(json.dumps(mapping(g)))
    geo["coordinates"] = rnd(geo["coordinates"])
    feats.append({"type": "Feature",
                  "properties": {"pcode": p["ADM4_PCODE"], "gn": p["ADM4_EN"], "ds": p["ADM3_EN"], "district": p["ADM2_EN"]},
                  "geometry": geo})
json.dump({"type": "FeatureCollection", "name": "gn_divisions", "features": feats}, open(OUT, "w"), separators=(",", ":"))
print(len(feats), "divisions written to", OUT)
