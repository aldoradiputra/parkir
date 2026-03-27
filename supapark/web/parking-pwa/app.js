// SupaPark Parking PWA — Plate linking, session view, prepay
(function () {
  'use strict';

  // Determine API base from the page URL (cloud serves this PWA)
  var API_BASE = window.location.origin + '/api/v1';

  var screens = {
    link: document.getElementById('screen-link'),
    session: document.getElementById('screen-session'),
    pay: document.getElementById('screen-pay'),
  };

  var state = {
    plate: '',
    phone: '',
    session: null,
    paymentPollInterval: null,
  };

  function showScreen(name) {
    Object.entries(screens).forEach(function (entry) {
      entry[1].classList.toggle('active', entry[0] === name);
    });
  }

  function showToast(msg, duration) {
    var toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(function () { toast.classList.add('hidden'); }, duration || 3000);
  }

  function formatRupiah(n) {
    return 'Rp ' + (n || 0).toLocaleString('id-ID');
  }

  function normalizePlate(plate) {
    return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function formatPlate(plate) {
    plate = normalizePlate(plate);
    var m = plate.match(/^([A-Z]{1,2})(\d{1,4})([A-Z]{0,3})$/);
    if (m) return m[1] + ' ' + m[2] + ' ' + m[3];
    return plate;
  }

  // API helpers
  function api(method, path, body) {
    var opts = {
      method: method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    return fetch(API_BASE + path, opts).then(function (r) {
      return r.json().then(function (data) {
        return { ok: r.ok, status: r.status, data: data };
      });
    });
  }

  // Link form
  document.getElementById('link-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var plate = document.getElementById('input-plate').value.trim();
    var phone = document.getElementById('input-phone').value.trim();

    if (!plate || !phone) {
      showToast('Lengkapi plat nomor dan nomor HP');
      return;
    }

    var btn = document.getElementById('btn-link');
    btn.disabled = true;
    btn.textContent = 'Menghubungkan...';

    api('POST', '/vehicles/link', { plate: plate, phone: phone })
      .then(function (res) {
        var result = document.getElementById('link-result');
        result.classList.remove('hidden', 'success', 'error');

        if (res.ok) {
          state.plate = normalizePlate(plate);
          state.phone = phone;
          result.classList.add('success');
          result.textContent = 'Berhasil! Plat ' + formatPlate(plate) + ' terhubung dengan ' + phone;
        } else {
          result.classList.add('error');
          result.textContent = res.data.message || 'Gagal menghubungkan';
        }
      })
      .catch(function () {
        showToast('Koneksi gagal, coba lagi');
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = 'Hubungkan';
      });
  });

  // Check session
  document.getElementById('btn-check-session').addEventListener('click', function () {
    var plate = document.getElementById('input-plate').value.trim();
    if (!plate) {
      showToast('Masukkan plat nomor terlebih dahulu');
      return;
    }

    var norm = normalizePlate(plate);
    api('GET', '/vehicles/' + encodeURIComponent(norm) + '/session')
      .then(function (res) {
        if (!res.ok) {
          showToast(res.data.message || 'Tidak ada sesi parkir aktif');
          return;
        }

        state.plate = norm;
        state.session = res.data;
        renderSession(res.data);
        showScreen('session');
      })
      .catch(function () {
        showToast('Koneksi gagal');
      });
  });

  function renderSession(s) {
    document.getElementById('session-plate').textContent = formatPlate(s.plate || state.plate);
    document.getElementById('session-entry').textContent = new Date(s.entry_time).toLocaleString('id-ID');

    if (s.duration_minutes) {
      var h = Math.floor(s.duration_minutes / 60);
      var m = s.duration_minutes % 60;
      document.getElementById('session-duration').textContent =
        (h > 0 ? h + ' jam ' : '') + m + ' menit';
    } else {
      // Calculate from entry time
      var mins = Math.floor((Date.now() - new Date(s.entry_time).getTime()) / 60000);
      var hh = Math.floor(mins / 60);
      var mm = mins % 60;
      document.getElementById('session-duration').textContent =
        (hh > 0 ? hh + ' jam ' : '') + mm + ' menit';
    }

    document.getElementById('session-fee').textContent = formatRupiah(s.tariff_amount);

    var statusMap = {
      active: 'Aktif',
      completed: 'Selesai',
      paid: 'Lunas',
      pending: 'Belum Bayar',
    };
    document.getElementById('session-status').textContent =
      statusMap[s.payment_status] || statusMap[s.session_status] || s.session_status;
  }

  // Prepay
  document.getElementById('btn-prepay').addEventListener('click', function () {
    if (!state.session) return;

    var amount = state.session.tariff_amount || 0;
    if (amount <= 0) {
      showToast('Tidak ada biaya yang perlu dibayar');
      return;
    }

    document.getElementById('pay-amount').textContent = formatRupiah(amount);
    document.getElementById('pay-qr-container').innerHTML = '<div class="skeleton-qr"></div>';
    document.getElementById('pay-status').textContent = 'Membuat QR pembayaran...';
    showScreen('pay');

    api('POST', '/vehicles/' + encodeURIComponent(state.plate) + '/prepay', {
      session_id: state.session.id,
      payment_method: 'qris',
      amount: amount,
    })
      .then(function (res) {
        if (!res.ok) {
          document.getElementById('pay-status').textContent = res.data.message || 'Gagal membuat QR';
          return;
        }

        renderPaymentQR(res.data.qr_string);
        document.getElementById('pay-status').textContent = 'Menunggu pembayaran...';
        startPaymentPoll(state.session.id);
      })
      .catch(function () {
        document.getElementById('pay-status').textContent = 'Koneksi gagal';
      });
  });

  function renderPaymentQR(qrString) {
    var container = document.getElementById('pay-qr-container');
    container.innerHTML = '';

    if (typeof QRCode !== 'undefined') {
      new QRCode(container, {
        text: qrString,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#FFFFFF',
      });
    } else {
      var p = document.createElement('p');
      p.style.cssText = 'font-size:12px;color:#000;word-break:break-all;max-width:200px';
      p.textContent = qrString;
      container.appendChild(p);
    }
  }

  function startPaymentPoll(sessionId) {
    clearInterval(state.paymentPollInterval);

    state.paymentPollInterval = setInterval(function () {
      api('GET', '/vehicles/' + encodeURIComponent(state.plate) + '/session')
        .then(function (res) {
          if (res.ok && res.data.payment_status === 'paid') {
            clearInterval(state.paymentPollInterval);
            document.getElementById('pay-status').textContent = 'Pembayaran berhasil!';
            document.getElementById('pay-status').style.color = '#22C55E';
            showToast('Pembayaran berhasil! Silakan menuju pintu keluar.');
            setTimeout(function () { showScreen('link'); }, 5000);
          }
        });
    }, 3000);
  }

  // Navigation
  document.getElementById('btn-back-link').addEventListener('click', function () {
    showScreen('link');
  });
  document.getElementById('btn-back-session').addEventListener('click', function () {
    clearInterval(state.paymentPollInterval);
    showScreen('session');
  });

  // Init
  showScreen('link');
})();
