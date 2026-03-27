// SupaPark Exit Screen — SSE client + QR rendering + state machine
(function () {
  'use strict';

  const screens = {
    idle: document.getElementById('screen-idle'),
    detecting: document.getElementById('screen-detecting'),
    payment: document.getElementById('screen-payment'),
    success: document.getElementById('screen-success'),
    member: document.getElementById('screen-member'),
    error: document.getElementById('screen-error'),
  };

  const els = {
    plate: document.getElementById('plate-display'),
    vehicleType: document.getElementById('vehicle-type-display'),
    fee: document.getElementById('fee-display'),
    duration: document.getElementById('duration-display'),
    qrContainer: document.getElementById('qr-container'),
    timer: document.getElementById('timer-display'),
    successPlate: document.getElementById('success-plate'),
    memberPlate: document.getElementById('member-plate'),
    errorMessage: document.getElementById('error-message'),
  };

  let currentScreen = 'idle';
  let timerInterval = null;

  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
      el.classList.toggle('active', key === name);
    });
    currentScreen = name;
  }

  function formatRupiah(amount) {
    return 'Rp ' + amount.toLocaleString('id-ID');
  }

  function startTimer(seconds) {
    clearInterval(timerInterval);
    let remaining = seconds;

    function update() {
      const min = Math.floor(remaining / 60);
      const sec = remaining % 60;
      els.timer.textContent =
        String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0');

      if (remaining <= 0) {
        clearInterval(timerInterval);
        showScreen('error');
        els.errorMessage.textContent = 'Waktu pembayaran habis';
        setTimeout(() => showScreen('idle'), 5000);
      }
      remaining--;
    }

    update();
    timerInterval = setInterval(update, 1000);
  }

  function renderQR(qrString) {
    els.qrContainer.innerHTML = '';

    if (!qrString) {
      els.qrContainer.innerHTML = '<div class="skeleton-qr"></div>';
      return;
    }

    // Use QRCode.js if available, otherwise show text
    if (typeof QRCode !== 'undefined') {
      new QRCode(els.qrContainer, {
        text: qrString,
        width: 240,
        height: 240,
        colorDark: '#000000',
        colorLight: '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.M,
      });
    } else {
      // Fallback: generate a simple canvas QR using minimal approach
      var p = document.createElement('p');
      p.style.fontSize = '14px';
      p.style.color = '#000';
      p.style.wordBreak = 'break-all';
      p.style.maxWidth = '240px';
      p.textContent = qrString;
      els.qrContainer.appendChild(p);
    }
  }

  function handleEvent(event) {
    switch (event.type) {
      case 'idle':
        clearInterval(timerInterval);
        showScreen('idle');
        break;

      case 'detecting':
        showScreen('detecting');
        break;

      case 'payment':
        els.plate.textContent = formatPlate(event.plate || '');
        els.fee.textContent = formatRupiah(event.fee || 0);
        els.duration.textContent = event.message || '';
        els.qrContainer.innerHTML = '<div class="skeleton-qr"></div>';
        showScreen('payment');
        startTimer(180);
        break;

      case 'qris':
        if (currentScreen === 'payment' || currentScreen === 'detecting') {
          els.plate.textContent = formatPlate(event.plate || '');
          els.fee.textContent = formatRupiah(event.fee || 0);
          renderQR(event.qr_string);
          showScreen('payment');
          if (!timerInterval) startTimer(180);
        }
        break;

      case 'success':
        clearInterval(timerInterval);
        els.successPlate.textContent = formatPlate(event.plate || '');
        showScreen('success');
        setTimeout(() => showScreen('idle'), 8000);
        break;

      case 'member':
        clearInterval(timerInterval);
        els.memberPlate.textContent = formatPlate(event.plate || '');
        showScreen('member');
        setTimeout(() => showScreen('idle'), 8000);
        break;

      case 'error':
        clearInterval(timerInterval);
        els.errorMessage.textContent = event.message || 'Hubungi petugas';
        showScreen('error');
        setTimeout(() => showScreen('idle'), 8000);
        break;
    }
  }

  function formatPlate(plate) {
    // Insert spaces for readability: B1234ABC → B 1234 ABC
    plate = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
    var match = plate.match(/^([A-Z]{1,2})(\d{1,4})([A-Z]{0,3})$/);
    if (match) {
      return match[1] + ' ' + match[2] + ' ' + match[3];
    }
    return plate;
  }

  // Connect to SSE
  function connect() {
    var evtSource = new EventSource('/events');

    evtSource.onmessage = function (e) {
      try {
        var data = JSON.parse(e.data);
        handleEvent(data);
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    evtSource.onerror = function () {
      console.warn('SSE connection lost, reconnecting in 3s...');
      evtSource.close();
      setTimeout(connect, 3000);
    };
  }

  // Initialize
  showScreen('idle');
  connect();
})();
