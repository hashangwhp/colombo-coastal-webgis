/* Community-Based Web GIS: coastal cultural landmarks & place attachment
   Colombo Metropolitan Area, Sri Lanka. Plain HTML/CSS/JS + Leaflet + Turf. */
(function () {
  "use strict";
  var CFG = window.APP_CONFIG;
  var CATS = ["Recreational", "Religious", "Historical", "Livelihood"];
  var FREQS = ["Daily", "Weekly", "Monthly", "Rarely"];
  var CAT_COLOR = { Recreational: "#14a39a", Religious: "#7a5aa8", Historical: "#b0802a", Livelihood: "#5b8c2f" };
  var RAMP = ["#e3f1ee", "#a9d6cf", "#62b3b0", "#26878f", "#0e4a56"];

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  /* ---------- map & basemaps ---------- */
  var map = L.map("map", { center: CFG.MAP_CENTER, zoom: CFG.MAP_ZOOM, zoomControl: true });
  // Key-free basemaps that also work from GitHub Pages.
  var esriRef = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}", { maxNativeZoom: 16, maxZoom: 19 });
  var bases = {
    light: L.layerGroup([
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", { maxNativeZoom: 16, maxZoom: 19, attribution: "Tiles © Esri" }),
      esriRef
    ]),
    osm: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }),
    sat: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Tiles © Esri" })
  };
  var currentBase = bases.light.addTo(map);
  document.querySelectorAll("input[name=base]").forEach(function (r) {
    r.addEventListener("change", function () {
      map.removeLayer(currentBase);
      currentBase = bases[r.value].addTo(map);
      if (currentBase.bringToBack) currentBase.bringToBack();
    });
  });

  /* ---------- state ---------- */
  var gnData = null, officialData = null, seedData = null;
  var responses = [];            // normalised, validated survey rows
  var filters = { cats: new Set(CATS), freqs: new Set(FREQS), minRating: 1 };
  var gnLayer = null, officialLayer = L.layerGroup(), seedLayer = L.layerGroup(),
      liveLayer = L.layerGroup(), heatLayer = null;
  var choroMode = "none";
  var gnStats = {};              // pcode -> {n, sum}

  /* ---------- load static layers ---------- */
  function getJSON(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(url + " → HTTP " + r.status);
      return r.json();
    });
  }

  Promise.all([
    getJSON("gn_divisions.geojson"),
    getJSON("official_sites.geojson"),
    getJSON("community_entries.geojson")
  ]).then(function (res) {
    gnData = res[0]; officialData = res[1]; seedData = res[2];
    buildGN(); buildOfficial(); buildSeed();
    buildFilterUI();
    applyLayerToggles();
    loadResponses();
    setInterval(loadResponses, CFG.REFRESH_MS);
  }).catch(function (e) {
    setStatus(location.protocol === "file:" ? "Open this site through a web server (or GitHub Pages), not by double-clicking the file" : "Could not load map data", true);
    console.error(e);
  });

  /* ---------- GN divisions ---------- */
  function buildGN() {
    gnLayer = L.geoJSON(gnData, {
      style: gnStyle,
      onEachFeature: function (f, layer) {
        var p = f.properties;
        layer.bindTooltip(esc(p.gn) + " (" + esc(p.ds) + ")", { sticky: true });
        layer.on("click", function (e) {
          if (picking) return;
          var s = gnStats[p.pcode] || { n: 0, sum: 0 };
          L.popup().setLatLng(e.latlng).setContent(
            '<div class="pop"><h3>' + esc(p.gn) + '</h3><dl>' +
            '<dt>DS division</dt><dd>' + esc(p.ds) + '</dd>' +
            '<dt>District</dt><dd>' + esc(p.district) + '</dd>' +
            '<dt>Responses</dt><dd>' + s.n + '</dd>' +
            '<dt>Mean rating</dt><dd>' + (s.n ? (s.sum / s.n).toFixed(2) : "–") + '</dd></dl></div>'
          ).openOn(map);
        });
      }
    });
  }
  function gnStyle(f) {
    var base = { weight: 0.8, color: "#5f8b92", opacity: 0.8, fillOpacity: 0, fillColor: "#fff" };
    if (choroMode === "none") return base;
    var s = gnStats[f.properties.pcode];
    var v, max;
    if (choroMode === "count") { v = s ? s.n : 0; max = Math.max.apply(null, [1].concat(Object.keys(gnStats).map(function (k) { return gnStats[k].n; }))); }
    else { v = s && s.n ? s.sum / s.n : 0; max = 5; }
    if (!v) { base.fillOpacity = 0.04; base.fillColor = "#cfe3e1"; return base; }
    var idx = Math.min(RAMP.length - 1, Math.floor((v / max) * RAMP.length - 1e-9));
    if (choroMode === "mean") idx = Math.max(0, Math.min(4, Math.round(v) - 1));
    base.fillColor = RAMP[idx]; base.fillOpacity = 0.7;
    return base;
  }

  /* ---------- official sites (blue markers) ---------- */
  function buildOfficial() {
    officialData.features.forEach(function (f) {
      var c = f.geometry.coordinates, p = f.properties;
      L.marker([c[1], c[0]], {
        icon: L.divIcon({ className: "", html: '<div class="official-pin"></div>', iconSize: [22, 22], iconAnchor: [11, 22], popupAnchor: [0, -22] }),
        title: p.name, keyboard: true
      }).bindPopup('<div class="pop"><h3>' + esc(p.name) + '</h3><dl><dt>Type</dt><dd>Gazetted heritage site</dd><dt>Category</dt><dd>' + esc(p.category) + '</dd></dl></div>')
        .addTo(officialLayer);
    });
  }

  /* ---------- community-nominated (orange circles) ---------- */
  function buildSeed() {
    seedData.features.forEach(function (f) {
      var c = f.geometry.coordinates, p = f.properties;
      L.circleMarker([c[1], c[0]], { radius: 9, color: "#fff", weight: 2, fillColor: "#e4802a", fillOpacity: 0.85 })
        .bindPopup('<div class="pop"><h3>' + esc(p.name) + '</h3><dl><dt>Type</dt><dd>Community-nominated place</dd><dt>Category</dt><dd>' + esc(p.category) + '</dd></dl></div>')
        .addTo(seedLayer);
    });
  }

  /* ---------- live responses ---------- */
  function setStatus(t, err) { var s = $("status"); s.textContent = t; s.classList.toggle("err", !!err); }

  function pick(row, names) {
    var keys = Object.keys(row);
    for (var i = 0; i < names.length; i++) {
      for (var k = 0; k < keys.length; k++) {
        if (keys[k].toLowerCase().replace(/\s+/g, " ").trim().indexOf(names[i]) === 0) return row[keys[k]];
      }
    }
    return undefined;
  }
  function titleCase(s) { s = String(s || "").trim(); return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }

  function normalise(rows) {
    var b = CFG.VALID_BOUNDS, out = [], skipped = 0;
    rows.forEach(function (r, i) {
      var lat = parseFloat(pick(r, ["latitude", "lat"]));
      var lng = parseFloat(pick(r, ["longitude", "long", "lng"]));
      if (!(lat >= b[0] && lat <= b[2] && lng >= b[1] && lng <= b[3])) { skipped++; return; }
      var cat = titleCase(pick(r, ["landmark category", "category"]));
      var rating = parseInt(pick(r, ["place attachment", "attachment", "rating"]), 10);
      out.push({
        id: i + 1,
        time: pick(r, ["timestamp"]) || "",
        lat: lat, lng: lng,
        category: CATS.indexOf(cat) >= 0 ? cat : "Recreational",
        frequency: titleCase(pick(r, ["frequency"])) || "Rarely",
        reason: String(pick(r, ["primary reason", "reason"]) || "").slice(0, 500),
        rating: rating >= 1 && rating <= 5 ? rating : 3,
        gn: null, ds: null, nearest: null, nearestM: null
      });
    });
    if (skipped) console.warn(skipped + " response(s) skipped (missing or out-of-area coordinates)");
    return out;
  }

  function enrich(list) {
    list.forEach(function (r) {
      var pt = turf.point([r.lng, r.lat]);
      for (var i = 0; i < gnData.features.length; i++) {
        var f = gnData.features[i];
        if (turf.booleanPointInPolygon(pt, f)) { r.gn = f.properties.gn; r.ds = f.properties.ds; r.pcode = f.properties.pcode; break; }
      }
      var best = Infinity, name = null;
      officialData.features.forEach(function (o) {
        var d = turf.distance(pt, o, { units: "kilometers" });
        if (d < best) { best = d; name = o.properties.name; }
      });
      r.nearest = name; r.nearestM = best * 1000;
    });
  }

  function loadResponses() {
    var demo = /[?&]demo=1/.test(location.search);
    var url = demo ? "sample_responses.json" : CFG.RESPONSES_URL;
    if (!url) { setStatus("No responses URL configured", true); return; }
    getJSON(url).then(function (json) {
      var rows = Array.isArray(json) ? json : (json.data || json.rows || json.responses || []);
      responses = normalise(rows);
      enrich(responses);
      render();
      var t = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setStatus((demo ? "Demo data · " : "") + responses.length + " survey response" + (responses.length === 1 ? "" : "s") + " · updated " + t);
    }).catch(function (e) {
      console.error(e);
      setStatus("Live responses unavailable (retrying)", true);
      render();
    });
  }

  function filtered() {
    return responses.filter(function (r) {
      return filters.cats.has(r.category) && filters.freqs.has(r.frequency) && r.rating >= filters.minRating;
    });
  }

  function render() {
    var list = filtered();
    liveLayer.clearLayers();
    list.forEach(function (r) {
      var m = L.circleMarker([r.lat, r.lng], { radius: 5 + r.rating * 2, color: "#fff", weight: 1.5, fillColor: CAT_COLOR[r.category], fillOpacity: 0.85 });
      m.bindPopup(
        '<div class="pop"><h3><span class="tag" style="background:' + CAT_COLOR[r.category] + '">' + esc(r.category) + '</span></h3><dl>' +
        '<dt>Attachment</dt><dd>' + r.rating + ' / 5</dd>' +
        '<dt>Visits</dt><dd>' + esc(r.frequency) + '</dd>' +
        '<dt>Reason</dt><dd>' + (esc(r.reason) || "–") + '</dd>' +
        '<dt>Division</dt><dd>' + esc(r.gn || "outside study divisions") + '</dd>' +
        '<dt>Nearest gazetted site</dt><dd>' + esc(r.nearest) + ' (' + (r.nearestM / 1000).toFixed(1) + ' km)</dd></dl></div>'
      );
      liveLayer.addLayer(m);
    });

    if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
    heatLayer = L.heatLayer(list.map(function (r) { return [r.lat, r.lng, r.rating / 5]; }), { radius: 28, blur: 22, maxZoom: 14 });
    if ($("lyr-heat").checked) heatLayer.addTo(map);

    gnStats = {};
    list.forEach(function (r) {
      if (!r.pcode) return;
      var s = gnStats[r.pcode] || (gnStats[r.pcode] = { n: 0, sum: 0 });
      s.n++; s.sum += r.rating;
    });
    if (gnLayer) gnLayer.setStyle(gnStyle);
    renderInsights(list);
    renderLegend();
  }

  /* ---------- insights ---------- */
  function bars(el, labels, counts, colorFn) {
    var max = Math.max.apply(null, [1].concat(counts));
    el.innerHTML = labels.map(function (l, i) {
      return '<div class="bar"><span>' + esc(l) + '</span><div class="track"><div class="fill" style="width:' + (counts[i] / max * 100) + '%;background:' + colorFn(l) + '"></div></div><span class="n">' + counts[i] + '</span></div>';
    }).join("");
  }
  function renderInsights(list) {
    $("k-count").textContent = list.length;
    $("k-mean").textContent = list.length ? (list.reduce(function (a, r) { return a + r.rating; }, 0) / list.length).toFixed(2) : "–";
    $("k-dist").textContent = list.length ? (list.reduce(function (a, r) { return a + r.nearestM; }, 0) / list.length / 1000).toFixed(1) + " km" : "–";
    bars($("chart-cat"), CATS, CATS.map(function (c) { return list.filter(function (r) { return r.category === c; }).length; }), function (c) { return CAT_COLOR[c]; });
    bars($("chart-freq"), FREQS, FREQS.map(function (c) { return list.filter(function (r) { return r.frequency === c; }).length; }), function () { return "#1c7c8a"; });

    var top = Object.keys(gnStats).map(function (k) { return { k: k, s: gnStats[k] }; })
      .sort(function (a, b) { return b.s.n - a.s.n; }).slice(0, 5);
    var ol = $("top-gn");
    if (!top.length) { ol.innerHTML = '<li class="empty">No responses fall inside the study divisions yet.</li>'; return; }
    ol.innerHTML = top.map(function (t) {
      var f = gnData.features.filter(function (x) { return x.properties.pcode === t.k; })[0].properties;
      return '<li><button type="button" data-pcode="' + esc(t.k) + '">' + esc(f.gn) + '</button> <small>' + esc(f.ds) + ' · ' + t.s.n + ' · mean ' + (t.s.sum / t.s.n).toFixed(1) + '</small></li>';
    }).join("");
    ol.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        gnLayer.eachLayer(function (l) { if (l.feature.properties.pcode === b.dataset.pcode) map.fitBounds(l.getBounds(), { maxZoom: 15 }); });
        document.getElementById("panel").classList.remove("open");
      });
    });
  }

  $("btn-csv").addEventListener("click", function () {
    var list = filtered();
    var head = ["timestamp", "latitude", "longitude", "category", "frequency", "rating", "reason", "gn_division", "ds_division", "nearest_gazetted_site", "distance_m"];
    var q = function (v) { v = String(v == null ? "" : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    var rows = list.map(function (r) { return [r.time, r.lat, r.lng, r.category, r.frequency, r.rating, r.reason, r.gn, r.ds, r.nearest, Math.round(r.nearestM)].map(q).join(","); });
    var blob = new Blob(["\ufeff" + head.join(",") + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "survey_responses_filtered.csv"; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  /* ---------- legend ---------- */
  function renderLegend() {
    var h = '<h3>Legend</h3>' +
      '<div class="row"><span class="sw sw-official"></span> Gazetted heritage site</div>' +
      '<div class="row"><span class="sw sw-seed"></span> Community-nominated place</div>' +
      CATS.map(function (c) { return '<div class="row"><span class="sw" style="border-radius:50%;background:' + CAT_COLOR[c] + '"></span> Survey response: ' + c + '</div>'; }).join("") +
      '<div class="row">Circle size grows with attachment rating (1–5)</div>';
    if (choroMode !== "none") {
      var max = choroMode === "mean" ? "5" : String(Math.max.apply(null, [1].concat(Object.keys(gnStats).map(function (k) { return gnStats[k].n; }))));
      h += '<h3 style="margin-top:10px">' + (choroMode === "mean" ? "Mean attachment rating" : "Responses per division") + '</h3><div class="ramp">' +
        RAMP.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join("") + '</div><div class="ramp-lbl"><span>' + (choroMode === "mean" ? "1" : "1") + '</span><span>' + max + '</span></div>';
    }
    $("legend").innerHTML = h;
  }

  /* ---------- layer toggles ---------- */
  function toggle(layer, on) { if (!layer) return; if (on) layer.addTo(map); else map.removeLayer(layer); }
  function applyLayerToggles() {
    toggle(gnLayer, $("lyr-gn").checked);
    toggle(officialLayer, $("lyr-official").checked);
    toggle(seedLayer, $("lyr-seed").checked);
    toggle(liveLayer, $("lyr-live").checked);
    if (gnLayer) gnLayer.bringToBack();
    renderLegend();
  }
  ["lyr-gn", "lyr-official", "lyr-seed", "lyr-live"].forEach(function (id) { $(id).addEventListener("change", applyLayerToggles); });
  $("lyr-heat").addEventListener("change", function () { if (heatLayer) toggle(heatLayer, this.checked); });
  document.querySelectorAll("input[name=choro]").forEach(function (r) {
    r.addEventListener("change", function () { choroMode = r.value; if (gnLayer) gnLayer.setStyle(gnStyle); renderLegend(); });
  });

  /* ---------- filters ---------- */
  function buildFilterUI() {
    function group(el, items, set, colorFn) {
      el.innerHTML = items.map(function (v) {
        return '<label class="check"><input type="checkbox" value="' + v + '" checked>' + (colorFn ? '<span class="sw" style="border-radius:50%;background:' + colorFn(v) + '"></span>' : "") + v + '</label>';
      }).join("");
      el.querySelectorAll("input").forEach(function (cb) {
        cb.addEventListener("change", function () { if (cb.checked) set.add(cb.value); else set.delete(cb.value); render(); });
      });
    }
    group($("f-category"), CATS, filters.cats, function (c) { return CAT_COLOR[c]; });
    group($("f-frequency"), FREQS, filters.freqs);
  }
  $("f-rating").addEventListener("input", function () { filters.minRating = +this.value; $("f-rating-out").textContent = this.value; render(); });
  $("btn-reset").addEventListener("click", function () {
    filters.cats = new Set(CATS); filters.freqs = new Set(FREQS); filters.minRating = 1;
    $("f-rating").value = 1; $("f-rating-out").textContent = 1;
    document.querySelectorAll("#f-category input,#f-frequency input").forEach(function (c) { c.checked = true; });
    render();
  });

  /* ---------- tabs & mobile panel ---------- */
  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (x) { x.classList.toggle("is-active", x === t); x.setAttribute("aria-selected", x === t); });
      document.querySelectorAll(".tabpane").forEach(function (p) { p.classList.toggle("is-active", p.id === "tab-" + t.dataset.tab); });
    });
  });
  $("btn-panel").addEventListener("click", function () {
    var open = $("panel").classList.toggle("open");
    this.setAttribute("aria-expanded", open);
  });

  /* ---------- add a place (pin → prefilled Google Form) ---------- */
  var picking = false, pin = null, picked = null;
  function setPicking(on) {
    picking = on;
    $("pin-card").hidden = !on;
    $("map").classList.toggle("picking", on);
    if (on) { $("panel").classList.remove("open"); map.closePopup(); }
    else if (pin) { map.removeLayer(pin); pin = null; picked = null; $("pin-submit").disabled = true; $("pin-coords").textContent = "No location chosen yet"; }
  }
  function setPicked(ll) {
    picked = ll;
    $("pin-coords").textContent = "Latitude " + ll.lat.toFixed(6) + ", Longitude " + ll.lng.toFixed(6);
    $("pin-submit").disabled = false;
  }
  $("btn-add").addEventListener("click", function () { setPicking(!picking); });
  $("pin-cancel").addEventListener("click", function () { setPicking(false); });
  map.on("click", function (e) {
    if (!picking) return;
    if (!pin) {
      pin = L.marker(e.latlng, { draggable: true }).addTo(map);
      pin.on("dragend", function () { setPicked(pin.getLatLng()); });
    } else pin.setLatLng(e.latlng);
    setPicked(e.latlng);
  });
  $("pin-submit").addEventListener("click", function () {
    if (!picked) return;
    var url = CFG.FORM_URL, ids = CFG.FORM_ENTRY_IDS || {};
    if (ids.lat && ids.lng) {
      url += (url.indexOf("?") < 0 ? "?" : "&") + "usp=pp_url&" + encodeURIComponent(ids.lat) + "=" + picked.lat.toFixed(6) + "&" + encodeURIComponent(ids.lng) + "=" + picked.lng.toFixed(6);
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(picked.lat.toFixed(6) + ", " + picked.lng.toFixed(6)).catch(function () {});
    }
    window.open(url, "_blank", "noopener");
    $("pin-coords").textContent += (ids.lat && ids.lng) ? "" : " (copied; paste into the form)";
  });
})();
