// SupaPark Entry Screen — SSE client + state machine
(function () {
  'use strict';

  const screens = {
    idle: document.getElementById('screen-idle'),
    scanning: document.getElementById('screen-scanning'),
    entry_success: document.getElementById('screen-entry-success'),
    entry_member: document.getElementById('screen-entry-member'),
    error: document.getElementById('screen-error'),
  };

  const els = {
    entryPlate: document.getElementById('entry-plate'),
    entryVehicleType: document.getElementById('entry-vehicle-type'),
    entryTime: document.getElementById('entry-time'),
    entryTariff: document.getElementById('entry-tariff'),
    entrySlots: document.getElementById('entry-slots'),
    tariffItem: document.getElementById('tariff-item'),
    slotsItem: document.getElementById('slots-item'),
    memberPlate: document.getElementById('member-plate'),
    memberVehicleType: document.getElementById('member-vehicle-type'),
    memberTime: document.getElementById('member-time'),
    memberSlots: document.getElementById('member-slots'),
    memberSlotsItem: document.getElementById('member-slots-item'),
    errorMessage: document.getElementById('error-message'),
  };

  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
      el.classList.toggle('active', key === name);
    });
  }

  function formatPlate(plate) {
    plate = (plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    var match = plate.match(/^([A-Z]{1,2})(\d{1,4})([A-Z]{0,3})$/);
    if (match) return match[1] + ' ' + match[2] + ' ' + match[3];
    return plate;
  }

  function formatTime(isoStr) {
    var d = isoStr ? new Date(isoStr) : new Date();
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function formatVehicleType(vt) {
    return vt === 'motorcycle' ? 'Motor' : 'Mobil';
  }

  function handleEvent(event) {
    switch (event.type) {
      case 'idle':
        showScreen('idle');
        break;

      case 'scanning':
        showScreen('scanning');
        break;

      case 'entry_success':
        els.entryPlate.textContent = formatPlate(event.plate || '');
        els.entryVehicleType.textContent = formatVehicleType(event.vehicle_type);
        els.entryTime.textContent = formatTime(event.entry_time);

        // Tariff info — hide if not available (offline)
        if (event.tariff_info) {
          els.entryTariff.textContent = event.tariff_info;
          els.tariffItem.style.display = '';
        } else {
          els.tariffItem.style.display = 'none';
        }

        // Slots — hide if not available (offline)
        if (event.slots_available != null) {
          els.entrySlots.textContent = event.slots_available + ' slot';
          els.slotsItem.style.display = '';
        } else {
          els.slotsItem.style.display = 'none';
        }

        showScreen('entry_success');
        setTimeout(() => showScreen('idle'), 3000);
        break;

      case 'entry_member':
        els.memberPlate.textContent = formatPlate(event.plate || '');
        els.memberVehicleType.textContent = formatVehicleType(event.vehicle_type);
        els.memberTime.textContent = formatTime(event.entry_time);

        if (event.slots_available != null) {
          els.memberSlots.textContent = event.slots_available + ' slot';
          els.memberSlotsItem.style.display = '';
        } else {
          els.memberSlotsItem.style.display = 'none';
        }

        showScreen('entry_member');
        setTimeout(() => showScreen('idle'), 3000);
        break;

      case 'error':
        els.errorMessage.textContent = event.message || 'Hubungi petugas';
        showScreen('error');
        setTimeout(() => showScreen('idle'), 5000);
        break;
    }
  }

  function connect() {
    var evtSource = new EventSource('/events');

    evtSource.onmessage = function (e) {
      try {
        handleEvent(JSON.parse(e.data));
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    evtSource.onerror = function () {
      console.warn('SSE disconnected, reconnecting in 3s...');
      evtSource.close();
      setTimeout(connect, 3000);
    };
  }

  showScreen('idle');
  connect();
})();
