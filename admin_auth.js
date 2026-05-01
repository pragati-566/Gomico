/**
 * admin_auth.js — GoMico Admin Authentication Guard
 *
 * Usage: call ensureAdminAuth() at the top of every admin page script.
 * If a valid adminToken is already stored, it resolves immediately.
 * Otherwise it renders a login modal over the page.
 *
 * Dev bypass: open the page with ?dev=1 in the URL to skip auth
 * (remove this in production).
 */

// ── Dev bypass ────────────────────────────────────────────────────────────────
const _DEV_BYPASS = new URLSearchParams(window.location.search).get('dev') === '1';

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Ensure the visitor is a logged-in admin.
 * @returns {Promise<string>} resolves with the admin JWT token
 */
async function ensureAdminAuth() {
  // 1. Dev bypass (adds ?dev=1 to URL)
  if (_DEV_BYPASS) {
    console.warn('[Admin Auth] DEV BYPASS active — skipping auth check');
    return 'dev-bypass-token';
  }

  // 2. Already have a valid-looking token?
  const stored = localStorage.getItem('adminToken');
  if (stored) {
    console.log('[Admin Auth] Token found in localStorage ✓');
    return stored;
  }

  // 3. No token — show login modal
  console.log('[Admin Auth] No token found — showing login modal');
  return _showLoginModal();
}

/**
 * Log out the current admin and reload the page.
 */
function adminLogout() {
  localStorage.removeItem('adminToken');
  console.log('[Admin Auth] Logged out');
  window.location.href = 'index.html';
}

// ── Login modal ───────────────────────────────────────────────────────────────

function _showLoginModal() {
  return new Promise((resolve) => {
    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'admin-auth-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(4,17,13,0.92);
      backdrop-filter: blur(10px);
      display: grid; place-items: center;
      z-index: 9999;
      font-family: "DM Sans", sans-serif;
    `;

    // Modal box
    const box = document.createElement('form');
    box.autocomplete = 'off';
    box.style.cssText = `
      background: #0a2019;
      padding: 36px 32px;
      border-radius: 24px;
      border: 1px solid rgba(146,252,5,0.25);
      width: 100%; max-width: 400px;
      color: white;
      box-shadow: 0 30px 80px rgba(0,0,0,0.6);
    `;

    box.innerHTML = `
      <div style="margin-bottom:24px">
        <h2 style="margin:0 0 6px;font-size:24px;font-weight:800;letter-spacing:-0.03em">
          Admin Login
        </h2>
        <p style="margin:0;color:#93b4a9;font-size:14px">
          Enter your administrator credentials to continue.
        </p>
      </div>

      <label style="display:block;margin-bottom:14px">
        <span style="display:block;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#93b4a9;margin-bottom:6px">Username</span>
        <input
          type="text" id="admin-user" name="admin-user"
          placeholder="Enter username"
          required autocomplete="username"
          style="width:100%;padding:12px 14px;border-radius:12px;
                 border:1px solid rgba(255,255,255,0.12);
                 background:rgba(255,255,255,0.05);
                 color:white;font-size:15px;box-sizing:border-box;outline:none;"
        >
      </label>

      <label style="display:block;margin-bottom:24px">
        <span style="display:block;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#93b4a9;margin-bottom:6px">Password</span>
        <input
          type="password" id="admin-pass" name="admin-pass"
          placeholder="••••••••"
          required autocomplete="current-password"
          style="width:100%;padding:12px 14px;border-radius:12px;
                 border:1px solid rgba(255,255,255,0.12);
                 background:rgba(255,255,255,0.05);
                 color:white;font-size:15px;box-sizing:border-box;outline:none;"
        >
      </label>

      <button
        type="submit" id="admin-submit"
        style="width:100%;padding:14px;background:#92fc05;color:#05140f;
               border:none;border-radius:12px;font-weight:800;font-size:16px;
               cursor:pointer;transition:opacity .15s ease;"
      >
        Login
      </button>

      <p id="admin-err"
         style="color:#ff6363;text-align:center;margin:14px 0 0;font-size:14px;
                font-weight:600;display:none;">
      </p>

      <p style="margin:18px 0 0;text-align:center;font-size:13px;color:#4a5d57">
        Admin Access
      </p>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Focus first field
    requestAnimationFrame(() => box.querySelector('#admin-user').focus());

    // Submit handler
    box.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = document.getElementById('admin-user').value.trim();
      const password = document.getElementById('admin-pass').value;
      const errEl    = document.getElementById('admin-err');
      const submitEl = document.getElementById('admin-submit');

      errEl.style.display = 'none';
      submitEl.disabled   = true;
      submitEl.textContent = 'Logging in…';

      try {
        const res  = await fetch('/api/admin/login', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (res.ok && data.token) {
          localStorage.setItem('adminToken', data.token);
          console.log('[Admin Auth] Login successful ✓');
          document.body.removeChild(overlay);
          resolve(data.token);
        } else {
          const msg = data.error || 'Invalid credentials';
          console.warn('[Admin Auth] Login failed:', msg);
          errEl.textContent    = msg;
          errEl.style.display  = 'block';
          submitEl.disabled    = false;
          submitEl.textContent = 'Login';
        }
      } catch (err) {
        console.error('[Admin Auth] Network / server error:', err);
        errEl.textContent   = 'Cannot reach server. Is the backend running?';
        errEl.style.display = 'block';
        submitEl.disabled   = false;
        submitEl.textContent = 'Login';
      }
    });
  });
}

// ── Helper used by admin pages ────────────────────────────────────────────────

/**
 * Call this at the top of each admin page's <script>.
 * Returns the token; also wires the Logout button if one exists.
 */
async function initAdminPage() {
  const token = await ensureAdminAuth();

  // Wire logout buttons
  document.querySelectorAll('[data-admin-logout]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      adminLogout();
    });
  });

  return token;
}
