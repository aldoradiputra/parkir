// SupaPark Onboarding — Form + Map logic

(function () {
  'use strict';

  var API_BASE = window.location.origin;

  // ========== Step 1: Lead Form ==========
  var leadForm = document.getElementById('lead-form');
  if (leadForm) {
    leadForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = document.getElementById('submit-btn');
      var errorMsg = document.getElementById('error-msg');
      btn.disabled = true;
      btn.querySelector('.btn-text').style.display = 'none';
      btn.querySelector('.btn-loading').style.display = 'inline';
      errorMsg.style.display = 'none';

      var data = {
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        facility_name: document.getElementById('facility_name').value.trim()
      };

      fetch(API_BASE + '/api/v1/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (resp) {
          if (!resp.ok) throw new Error('Gagal mendaftar. Coba lagi.');
          return resp.json();
        })
        .then(function (lead) {
          leadForm.style.display = 'none';
          var successScreen = document.getElementById('success-screen');
          successScreen.style.display = 'block';
          document.getElementById('success-name').textContent = data.name;
          document.getElementById('step2-link').href = 'step2.html?id=' + lead.id;
          var footerText = document.querySelector('.footer-text');
          if (footerText) footerText.style.display = 'none';
        })
        .catch(function (err) {
          errorMsg.textContent = err.message;
          errorMsg.style.display = 'block';
          btn.disabled = false;
          btn.querySelector('.btn-text').style.display = 'inline';
          btn.querySelector('.btn-loading').style.display = 'none';
        });
    });
  }

  // ========== Step 2: Onboarding + Map ==========
  var onboardForm = document.getElementById('onboard-form');
  if (onboardForm && typeof L !== 'undefined') {
    var leadId = new URLSearchParams(window.location.search).get('id');
    var marker = null;

    // Initialize map centered on Indonesia
    var map = L.map('map').setView([-2.5, 118.0], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Amber marker icon
    var amberIcon = L.divIcon({
      className: 'custom-marker',
      html: '<div style="width:24px;height:24px;background:#F5A623;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    var blueIcon = L.divIcon({
      className: 'custom-marker',
      html: '<div style="width:18px;height:18px;background:#4A90D9;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    // Load existing SupaPark locations
    fetch(API_BASE + '/api/v1/locations/public')
      .then(function (r) { return r.json(); })
      .then(function (locations) {
        if (!Array.isArray(locations)) return;
        locations.forEach(function (loc) {
          if (loc.latitude && loc.longitude) {
            L.marker([loc.latitude, loc.longitude], { icon: blueIcon })
              .addTo(map)
              .bindPopup('<b>' + loc.name + '</b><br><small>Lokasi SupaPark aktif</small>');
          }
        });
      })
      .catch(function () { /* ignore if no locations */ });

    // Click to place pin
    map.on('click', function (e) {
      var lat = e.latlng.lat;
      var lng = e.latlng.lng;

      if (marker) {
        marker.setLatLng(e.latlng);
      } else {
        marker = L.marker(e.latlng, { icon: amberIcon, draggable: true }).addTo(map);
        marker.on('dragend', function () {
          var pos = marker.getLatLng();
          updateCoords(pos.lat, pos.lng);
          reverseGeocode(pos.lat, pos.lng);
        });
      }

      updateCoords(lat, lng);
      reverseGeocode(lat, lng);
    });

    function updateCoords(lat, lng) {
      document.getElementById('latitude').value = lat.toFixed(6);
      document.getElementById('longitude').value = lng.toFixed(6);
    }

    function reverseGeocode(lat, lng) {
      var hint = document.getElementById('map-address');
      hint.textContent = 'Mencari alamat...';

      fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lng + '&format=json&accept-language=id')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.display_name) {
            hint.textContent = data.display_name;
            var addressInput = document.getElementById('address');
            if (!addressInput.value) {
              addressInput.value = data.display_name;
            }
          } else {
            hint.textContent = lat.toFixed(4) + ', ' + lng.toFixed(4);
          }
        })
        .catch(function () {
          hint.textContent = lat.toFixed(4) + ', ' + lng.toFixed(4);
        });
    }

    // Submit onboarding
    onboardForm.addEventListener('submit', function (e) {
      e.preventDefault();

      if (!leadId) {
        var errorMsg = document.getElementById('error-msg');
        errorMsg.textContent = 'ID lead tidak ditemukan. Silakan daftar terlebih dahulu.';
        errorMsg.style.display = 'block';
        return;
      }

      var btn = document.getElementById('submit-btn');
      var errorMsg = document.getElementById('error-msg');
      btn.disabled = true;
      btn.querySelector('.btn-text').style.display = 'none';
      btn.querySelector('.btn-loading').style.display = 'inline';
      errorMsg.style.display = 'none';

      var lat = document.getElementById('latitude').value;
      var lng = document.getElementById('longitude').value;

      var data = {
        city: document.getElementById('city').value.trim() || null,
        address: document.getElementById('address').value.trim() || null,
        latitude: lat ? parseFloat(lat) : null,
        longitude: lng ? parseFloat(lng) : null,
        entry_lanes: parseInt(document.getElementById('entry_lanes').value) || null,
        exit_lanes: parseInt(document.getElementById('exit_lanes').value) || null,
        current_system: document.getElementById('current_system').value || null,
        daily_volume: parseInt(document.getElementById('daily_volume').value) || null,
        preferred_date: document.getElementById('preferred_date').value || null
      };

      fetch(API_BASE + '/api/v1/leads/' + leadId + '/onboard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (resp) {
          if (!resp.ok) throw new Error('Gagal mengirim. Coba lagi.');
          return resp.json();
        })
        .then(function () {
          onboardForm.style.display = 'none';
          document.getElementById('success-screen').style.display = 'block';
        })
        .catch(function (err) {
          errorMsg.textContent = err.message;
          errorMsg.style.display = 'block';
          btn.disabled = false;
          btn.querySelector('.btn-text').style.display = 'inline';
          btn.querySelector('.btn-loading').style.display = 'none';
        });
    });
  }
})();
