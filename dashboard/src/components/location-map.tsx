"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const amberIcon = new L.DivIcon({
  className: "custom-marker",
  html: '<div style="width:20px;height:20px;background:#F5A623;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

interface LocationMapProps {
  latitude: number;
  longitude: number;
  name: string;
}

export default function LocationMap({ latitude, longitude, name }: LocationMapProps) {
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={15}
      style={{ width: "100%", height: "100%" }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[latitude, longitude]} icon={amberIcon}>
        <Popup>{name}</Popup>
      </Marker>
    </MapContainer>
  );
}
