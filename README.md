# Community-Based Web GIS: Coastal Cultural Landmarks and Place Attachment
### Colombo Metropolitan Area, Sri Lanka

An interactive web map built with plain HTML, CSS and JavaScript (Leaflet + Turf.js). Residents add places through a Google Form; the map reads the form's response sheet through a Google Apps Script web app and redraws automatically every 60 seconds.

## Folder structure

```
index.html              page structure: map, panel, legend, add-a-place card
css/style.css           colours, layout, mobile bottom-sheet panel
js/config.js            the only file you need to edit (form URL, JSON URL, entry IDs)
js/app.js               layers, filters, analysis, live updates, form hand-off
data/
  gn_divisions.geojson      347 Grama Niladhari divisions (WGS 84, simplified)
  official_sites.geojson    7 gazetted heritage sites  (blue markers)
  community_entries.geojson 7 community-nominated places (orange circles)
  sample_responses.json     fake rows for testing (open the site with ?demo=1)
  source/GND/               original shapefile (UTM 44N) for reproducibility
apps-script/Code.gs     script that turns the response sheet into JSON
tools/convert_gnd.py    rebuilds gn_divisions.geojson from the shapefile
```

## Run locally

Browsers block `fetch()` on `file://`, so serve the folder:

```
python -m http.server 8000
```

then open http://localhost:8000 (add `?demo=1` to see sample responses).

## Publish on GitHub Pages

1. Create a repository and push this folder's contents to the `main` branch.
2. Repository **Settings → Pages → Build and deployment**: Source "Deploy from a branch", branch `main`, folder `/ (root)`.
3. After a minute the site is live at `https://<username>.github.io/<repository>/`.

## How the live data flow works

```
Participant → Google Form → linked Google Sheet → Apps Script (/exec JSON) → fetch() in app.js → map
```

Form fields read by the map (matched by header text, so the order does not matter):
`Latitude`, `Longitude`, `Landmark Category` (Recreational / Religious / Historical / Livelihood), `Frequency of Visit` (Daily / Weekly / Monthly / Rarely), `Primary Reason for Attachment`, `Place Attachment Rating` (1-5).

Setup steps are in the header of `apps-script/Code.gs`. The web app must be deployed with access set to **Anyone**, otherwise the public map cannot read it.

### Pre-filling coordinates from the map (optional)
"Add a place" lets a visitor drop a pin, then opens the form. To have Latitude and Longitude filled in automatically, open the form → ⋮ → **Get pre-filled link**, type any value into the Latitude and Longitude boxes, click Get link, and copy the two `entry.xxxxxxxxxx` numbers into `FORM_ENTRY_IDS` in `js/config.js`. Without them the coordinates are copied to the clipboard for pasting.

## What the map does
- Layers: GN divisions, gazetted sites, community-nominated places, live survey responses, attachment heatmap; light / OSM / satellite basemaps.
- Colour GN divisions by number of responses or mean attachment rating (point-in-polygon with Turf.js).
- Filters by category, visit frequency and minimum rating.
- Insights: counts, mean rating, mean distance from each response to the nearest gazetted site, charts, top divisions, CSV export of filtered rows.
- Responses outside the study bounding box (`VALID_BOUNDS`) are ignored as typos.

## Data notes
- `gn_divisions.geojson`: fields `pcode`, `gn`, `ds`, `district` taken from `ADM4_PCODE`, `ADM4_EN`, `ADM3_EN`, `ADM2_EN`; boundary validity date 2022. It covers Colombo, Gampaha and Kalutara coastal divisions plus a few edge divisions.
- Check these coordinates before publishing: "Panadura Estuary Beach Front" (6.7120, 79.8820) is about 2 km out at sea, probably a longitude typo (Panadura's coast is nearer 79.90); "Negombo Beach Park & Estuary" falls about 150 m offshore.
- Privacy: the form collects no names or e-mails. Every sheet column is published by the script, so do not add personal questions. Free-text reasons are shown publicly in popups.

## Credits
Basemaps © OpenStreetMap contributors, Esri. Libraries: Leaflet 1.9.4, Leaflet.heat, Turf.js 6.5.0 (loaded from cdnjs).
