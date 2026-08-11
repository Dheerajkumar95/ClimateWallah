import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, LocateFixed, Map as MapIcon, Keyboard, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

const ICON = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41],
});

const inpCls = "w-full bg-white border border-border rounded-lg px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-turquoise";

async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, { headers: { "Accept-Language": "en" } });
    const d = await r.json();
    const a = d.address || {};
    return { city: a.city || a.town || a.village || a.county || "", state: a.state || "", country: a.country || "", pincode: a.postcode || "" };
  } catch { return null; }
}

export function GeoLocationField({ value, onChange, onResolveAddress }) {
  const [mode, setMode] = useState("current");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const set = (lat, lng, source, accuracy) => {
    const v = { lat: Number(lat.toFixed?.(6) ?? lat), lng: Number(lng.toFixed?.(6) ?? lng), accuracy: accuracy ?? null, source, captured_at: new Date().toISOString() };
    onChange(v);
    return v;
  };

  const resolve = async (lat, lng) => {
    const addr = await reverseGeocode(lat, lng);
    if (addr && onResolveAddress) onResolveAddress(addr);
  };

  // init/destroy map when in map mode
  useEffect(() => {
    if (mode !== "map") return;
    if (mapRef.current || !mapEl.current) return;
    const start = value?.lat && value?.lng ? [value.lat, value.lng] : [20.5937, 78.9629];
    const map = L.map(mapEl.current).setView(start, value?.lat ? 13 : 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(map);
    const marker = L.marker(start, { draggable: true, icon: ICON }).addTo(map);
    marker.on("dragend", () => { const p = marker.getLatLng(); set(p.lat, p.lng, "map"); resolve(p.lat, p.lng); });
    map.on("click", (e) => { marker.setLatLng(e.latlng); set(e.latlng.lat, e.latlng.lng, "map"); resolve(e.latlng.lat, e.latlng.lng); });
    mapRef.current = map; markerRef.current = marker;
    setTimeout(() => map.invalidateSize(), 200);
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
  }, [mode]); // eslint-disable-line

  const useCurrent = () => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLoading(false); const { latitude, longitude, accuracy } = pos.coords; set(latitude, longitude, "browser", accuracy); resolve(latitude, longitude); toast.success("Location captured"); },
      (err) => { setLoading(false); toast.error("Location unavailable — pick on map or enter manually"); setMode("map"); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const doSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}&limit=1`, { headers: { "Accept-Language": "en" } });
      const d = await r.json();
      if (!d.length) { toast.error("No results"); return; }
      const lat = parseFloat(d[0].lat), lng = parseFloat(d[0].lon);
      if (mapRef.current) { mapRef.current.setView([lat, lng], 14); markerRef.current.setLatLng([lat, lng]); }
      set(lat, lng, "map"); resolve(lat, lng);
    } catch { toast.error("Search failed"); }
  };

  const manual = (k) => (e) => {
    const num = e.target.value === "" ? "" : Number(e.target.value);
    const other = k === "lat" ? (value?.lng ?? "") : (value?.lat ?? "");
    if (num !== "" && k === "lat" && (num < -90 || num > 90)) { toast.error("Latitude must be between -90 and 90"); return; }
    if (num !== "" && k === "lng" && (num < -180 || num > 180)) { toast.error("Longitude must be between -180 and 180"); return; }
    const lat = k === "lat" ? num : (value?.lat ?? "");
    const lng = k === "lng" ? num : (value?.lng ?? "");
    onChange({ lat: lat === "" ? null : lat, lng: lng === "" ? null : lng, accuracy: null, source: "manual", captured_at: new Date().toISOString() });
  };

  const Tab = ({ id, Icon, label }) => (
    <button type="button" onClick={() => setMode(id)} data-testid={`geo-mode-${id}`}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${mode === id ? "border-turquoise bg-turquoise/10 text-deep-forest-green" : "border-border text-charcoal/60 hover:bg-warm-beige"}`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <div data-testid="geo-location-field">
      <div className="flex flex-wrap gap-2 mb-3">
        <Tab id="current" Icon={LocateFixed} label="Use my location" />
        <Tab id="map" Icon={MapIcon} label="Pick on map" />
        <Tab id="manual" Icon={Keyboard} label="Enter coordinates" />
      </div>

      {mode === "current" && (
        <button type="button" onClick={useCurrent} disabled={loading} data-testid="geo-use-current"
          className="inline-flex items-center gap-2 rounded-lg bg-deep-forest-green text-off-white px-4 py-2.5 text-sm font-medium hover:bg-natural-green transition-colors">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />} Detect my current location
        </button>
      )}

      {mode === "map" && (
        <div>
          <form onSubmit={doSearch} className="flex gap-2 mb-2">
            <input className={inpCls} placeholder="Search an address…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="geo-search" />
            <button type="submit" className="rounded-lg border border-border px-3 hover:bg-warm-beige"><Search className="h-4 w-4" /></button>
          </form>
          <div ref={mapEl} className="h-64 w-full rounded-xl overflow-hidden border border-border" data-testid="geo-map" />
          <p className="text-xs text-charcoal/50 mt-1.5">Click the map or drag the pin to set the exact location.</p>
        </div>
      )}

      {mode === "manual" && (
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs text-charcoal/60 mb-1">Latitude</label><input type="number" step="any" className={inpCls} value={value?.lat ?? ""} onChange={manual("lat")} data-testid="geo-lat" placeholder="-90 to 90" /></div>
          <div><label className="block text-xs text-charcoal/60 mb-1">Longitude</label><input type="number" step="any" className={inpCls} value={value?.lng ?? ""} onChange={manual("lng")} data-testid="geo-lng" placeholder="-180 to 180" /></div>
        </div>
      )}

      {value?.lat != null && value?.lng != null && (
        <div className="mt-3 inline-flex items-center gap-2 text-sm text-charcoal/70 bg-off-white border border-border rounded-lg px-3 py-2" data-testid="geo-value">
          <MapPin className="h-4 w-4 text-turquoise" /> {Number(value.lat).toFixed(5)}, {Number(value.lng).toFixed(5)}
          <span className="text-xs text-charcoal/40">· {value.source}{value.accuracy ? ` · ±${Math.round(value.accuracy)}m` : ""}</span>
        </div>
      )}
    </div>
  );
}
