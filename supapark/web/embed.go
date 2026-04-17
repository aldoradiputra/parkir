package web

import "embed"

//go:embed exit-screen
var ExitScreenFS embed.FS

//go:embed entry-screen
var EntryScreenFS embed.FS

//go:embed parking-pwa
var ParkingPWAFS embed.FS
