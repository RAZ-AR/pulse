/**
 * GET /staff-mini
 *
 * Staff Scanner Mini App — served as raw HTML.
 * Role: scan QR codes to earn/redeem points for customers.
 * No settings, no analytics, no reward management.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api.ayoo.space"

const HTML = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>ayoo Staff Scanner</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #F5F5F7;
  color: #1A1A1A;
  min-height: 100vh;
  -webkit-tap-highlight-color: transparent;
}
button { cursor: pointer; border: none; outline: none; background: none; }
input  { outline: none; border: none; font-family: inherit; }
</style>
</head>
<body>
<div id="app"></div>
<script>
window.__API_BASE__ = '${API_BASE}';
</script>
<script>
(function() {
'use strict';
var useState  = React.useState;
var useEffect = React.useEffect;
var h         = React.createElement;
var API       = window.__API_BASE__;
var tg        = window.Telegram && window.Telegram.WebApp;
if (tg) tg.ready();

// ── Colors ────────────────────────────────────────────────────────
var C = {
  bg:      '#F5F5F7',
  white:   '#FFFFFF',
  text:    '#1A1A1A',
  hint:    '#888888',
  accent:  '#5B4CF5',
  green:   '#10B981',
  red:     '#EF4444',
  border:  'rgba(0,0,0,0.07)',
  mint:    '#E8F5E9',
  lavender:'#EDE9FF',
  sky:     '#E3F2FD',
};

// ── tRPC client ───────────────────────────────────────────────────
async function trpcQuery(token, proc, input) {
  var url = API + '/api/merchant-mini-trpc/' + proc
    + '?input=' + encodeURIComponent(JSON.stringify({ json: input }));
  var res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  var json = await res.json();
  if (json.error) throw new Error((json.error.json && json.error.json.message) || 'Ошибка');
  return json.result.data.json;
}
async function trpcMutate(token, proc, input) {
  var res = await fetch(API + '/api/merchant-mini-trpc/' + proc, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ json: input }),
  });
  var json = await res.json();
  if (json.error) throw new Error((json.error.json && json.error.json.message) || 'Ошибка');
  return json.result.data.json;
}

// ── Auth ──────────────────────────────────────────────────────────
async function doAuth() {
  var initData = tg && tg.initData;
  if (!initData) throw new Error('Откройте приложение через Telegram');
  var res = await fetch(API + '/api/staff-tg-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: initData }),
  });
  var json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Auth failed');
  return json; // { status, token, staff }
}

// ── UI helpers ────────────────────────────────────────────────────
function Btn(props) {
  var bg = props.disabled ? '#ccc' : (props.color || C.accent);
  return h('button', {
    onClick: props.onClick, disabled: props.disabled,
    style: {
      width: '100%', padding: '15px',
      background: bg, color: '#fff',
      borderRadius: 14, fontSize: 16, fontWeight: 700,
      cursor: props.disabled ? 'not-allowed' : 'pointer',
      opacity: props.disabled ? 0.6 : 1,
    },
  }, props.label);
}

function Card(props) {
  return h('div', {
    style: Object.assign({
      background: props.bg || C.white,
      borderRadius: 20, padding: 16, marginBottom: 12,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }, props.style || {}),
  }, props.children);
}

function ErrBox(props) {
  if (!props.msg) return null;
  return h('div', {
    style: { background: '#FEF2F2', color: C.red, borderRadius: 12, padding: '10px 14px', fontSize: 14, marginBottom: 12 },
  }, '⚠️ ' + props.msg);
}

// ── Splash ────────────────────────────────────────────────────────
function Splash(props) {
  return h('div', {
    style: {
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: 32, gap: 16, textAlign: 'center',
    },
  },
    h('div', { style: { fontSize: 56 } }, props.isError ? '⚠️' : '⏳'),
    h('div', { style: { fontSize: 18, fontWeight: 700 } }, props.msg),
    props.sub && h('div', { style: { fontSize: 14, color: C.hint, maxWidth: 260, lineHeight: 1.5 } }, props.sub)
  );
}

// ── Scanner UI ────────────────────────────────────────────────────
function ScannerApp(props) {
  var token = props.token, staff = props.staff;
  var venue = staff.venue;

  var modeState   = useState('home');  var mode     = modeState[0];     var setMode     = modeState[1];
  var codeState   = useState('');      var code     = codeState[0];      var setCode     = codeState[1];
  var customerSt  = useState(null);    var customer = customerSt[0];     var setCustomer = customerSt[1];
  var amountState = useState('');      var amount   = amountState[0];    var setAmount   = amountState[1];
  var pointsState = useState('');      var points   = pointsState[0];    var setPoints   = pointsState[1];
  var loadingSt   = useState(false);   var loading  = loadingSt[0];      var setLoading  = loadingSt[1];
  var errorState  = useState('');      var error    = errorState[0];     var setError    = errorState[1];
  var resultState = useState(null);    var result   = resultState[0];    var setResult   = resultState[1];
  var venueDataSt = useState(null);    var venueData = venueDataSt[0];   var setVenueData = venueDataSt[1];

  useEffect(function() {
    // Load venue details (pointsPerCurrency, currency)
    trpcQuery(token, 'venue.get', { id: venue.id })
      .then(setVenueData)
      .catch(function() {});
  }, [venue.id]);

  function reset() {
    setMode('home'); setCode(''); setCustomer(null);
    setAmount(''); setPoints(''); setError(''); setResult(null);
  }

  function scanQr() {
    if (!tg || !tg.showScanQrPopup) { setError('Сканер недоступен — введите код вручную'); return; }
    tg.showScanQrPopup({ text: 'QR-код клиента ayoo' }, function(raw) {
      tg.closeScanQrPopup && tg.closeScanQrPopup();
      var m = raw.match(/ayoo:\\/\\/user\\/([A-Z0-9]+)/i) || raw.match(/^([A-Z0-9]{4,12})$/i);
      if (m) resolveCode(m[1]);
      else setError('Не удалось распознать QR-код');
      return true;
    });
  }

  async function resolveCode(ref) {
    setLoading(true); setError('');
    try {
      var data = await trpcQuery(token, 'merchant.resolveCustomer', { referralCode: ref.toUpperCase().trim() });
      setCustomer(data); setMode('customer');
    } catch(e) { setError('Клиент не найден: ' + e.message); }
    finally { setLoading(false); }
  }

  async function awardPoints() {
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true); setError('');
    try {
      var ppc = venueData && venueData.pointsPerCurrency;
      var res = await trpcMutate(token, 'transaction.partnerPurchase', {
        userId: customer.userId, venueId: venue.id,
        amount: parseFloat(amount), currency: (venueData && venueData.currency) || 'RSD',
      });
      setResult({ type: 'earn', points: res.pointsEarned, name: customer.name });
      setMode('result');
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function redeemPoints() {
    var pts = parseInt(points);
    if (!pts || pts <= 0) return;
    setLoading(true); setError('');
    try {
      var res = await trpcMutate(token, 'merchant.redeemPoints', {
        userId: customer.userId, venueId: venue.id, points: pts,
      });
      setResult({ type: 'redeem', points: pts, newBalance: res.newBalance, name: customer.name });
      setMode('result');
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  if (loading) return h('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' },
  }, h('div', { style: { fontSize: 16, color: C.hint } }, 'Загрузка…'));

  // ── Result ──────────────────────────────────────────────
  if (mode === 'result') return h('div', {
    style: { padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', gap: 20 },
  },
    h('div', { style: { fontSize: 80, marginTop: 40 } }, result.type === 'earn' ? '✅' : '💸'),
    h('div', { style: { fontSize: 26, fontWeight: 800, textAlign: 'center' } },
      result.type === 'earn' ? '+' + result.points + ' pts' : '−' + result.points + ' pts'
    ),
    h('div', { style: { fontSize: 17, color: C.hint, textAlign: 'center' } }, result.name),
    result.newBalance !== undefined && h('div', { style: { fontSize: 14, color: C.hint } },
      'Остаток: ' + result.newBalance + ' pts'
    ),
    h('div', { style: { width: '100%', maxWidth: 320, marginTop: 24 } },
      h(Btn, { label: '← Следующий клиент', onClick: reset })
    )
  );

  // ── Home: scan + manual ──────────────────────────────────
  if (mode === 'home') return h('div', { style: { padding: '16px 20px', background: C.bg, minHeight: '100vh' } },
    // Header
    h('div', { style: { marginBottom: 20 } },
      h('div', { style: { fontSize: 22, fontWeight: 800 } }, '📷 ayoo Scanner'),
      h('div', { style: { fontSize: 13, color: C.hint, marginTop: 2 } }, venue.name + ' · ' + staff.merchantName)
    ),

    h(ErrBox, { msg: error }),

    // Big scan button
    h('button', {
      onClick: scanQr,
      style: {
        width: '100%', padding: '32px 20px',
        background: 'linear-gradient(135deg, #5B4CF5, #8B5CF6)',
        color: '#fff', borderRadius: 24, border: 'none', cursor: 'pointer',
        textAlign: 'center', marginBottom: 16,
        boxShadow: '0 6px 20px rgba(91,76,245,0.35)',
      },
    },
      h('div', { style: { fontSize: 56, marginBottom: 12 } }, '⬛'),
      h('div', { style: { fontSize: 20, fontWeight: 800 } }, 'Сканировать QR'),
      h('div', { style: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 } }, 'QR-код из приложения ayoo')
    ),

    // Manual code
    h('div', { style: { fontSize: 13, color: C.hint, textAlign: 'center', marginBottom: 10 } }, 'или введите код вручную'),
    h('div', { style: { display: 'flex', gap: 8 } },
      h('input', {
        value: code,
        onChange: function(e) { setCode(e.target.value.toUpperCase()); },
        placeholder: 'AYOO1', maxLength: 12,
        style: {
          flex: 1, padding: '14px 16px',
          background: C.white, border: '1.5px solid ' + C.border,
          borderRadius: 14, fontSize: 18, fontWeight: 700,
          letterSpacing: 3, textAlign: 'center',
        },
      }),
      h('button', {
        onClick: function() { if (code.trim()) resolveCode(code.trim()); },
        disabled: !code.trim(),
        style: {
          padding: '0 20px', background: C.accent, color: '#fff',
          borderRadius: 14, fontSize: 18, fontWeight: 700,
          opacity: code.trim() ? 1 : 0.4,
        },
      }, '→')
    )
  );

  // ── Customer found ───────────────────────────────────────
  if (mode === 'customer') return h('div', { style: { padding: '16px 20px' } },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 } },
      h('button', { onClick: reset, style: { fontSize: 22 } }, '←'),
      h('div', { style: { fontSize: 20, fontWeight: 800 } }, 'Клиент найден')
    ),
    h(Card, { bg: C.sky },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 14 } },
        h('div', { style: { fontSize: 48 } }, '👤'),
        h('div', null,
          h('div', { style: { fontSize: 20, fontWeight: 800 } }, customer.name),
          h('div', { style: { fontSize: 18, fontWeight: 700, color: C.accent, marginTop: 2 } },
            customer.totalPoints.toLocaleString() + ' pts')
        )
      )
    ),
    h(ErrBox, { msg: error }),
    h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
      h('button', {
        onClick: function() { setError(''); setMode('earn'); },
        style: { padding: '24px 12px', background: C.mint, borderRadius: 20, border: 'none', cursor: 'pointer', textAlign: 'center' },
      },
        h('div', { style: { fontSize: 40, marginBottom: 8 } }, '➕'),
        h('div', { style: { fontWeight: 800, fontSize: 16 } }, 'Начислить'),
        h('div', { style: { fontSize: 12, color: C.hint, marginTop: 4 } }, 'Покупка')
      ),
      h('button', {
        onClick: function() { if (customer.totalPoints > 0) { setError(''); setMode('redeem'); } else setError('У клиента нет баллов'); },
        style: { padding: '24px 12px', background: C.lavender, borderRadius: 20, border: 'none', cursor: 'pointer', textAlign: 'center' },
      },
        h('div', { style: { fontSize: 40, marginBottom: 8 } }, '💸'),
        h('div', { style: { fontWeight: 800, fontSize: 16 } }, 'Списать'),
        h('div', { style: { fontSize: 12, color: C.hint, marginTop: 4 } }, 'Оплата баллами')
      )
    )
  );

  // ── Earn: enter amount ───────────────────────────────────
  if (mode === 'earn') return h('div', { style: { padding: '16px 20px' } },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 } },
      h('button', { onClick: function() { setError(''); setMode('customer'); }, style: { fontSize: 22 } }, '←'),
      h('div', null,
        h('div', { style: { fontSize: 20, fontWeight: 800 } }, 'Начислить баллы'),
        h('div', { style: { fontSize: 13, color: C.hint } }, customer.name)
      )
    ),
    h('div', { style: { fontSize: 13, color: C.hint, marginBottom: 6 } },
      'Сумма покупки, ' + ((venueData && venueData.currency) || 'RSD')),
    h('input', {
      type: 'number', inputMode: 'numeric', value: amount,
      onChange: function(e) { setAmount(e.target.value); }, placeholder: '0',
      style: {
        width: '100%', fontSize: 40, fontWeight: 900, padding: '16px',
        background: C.white, border: '1.5px solid ' + C.border,
        borderRadius: 16, color: C.text, marginBottom: 12,
      },
    }),
    amount && parseFloat(amount) > 0 && venueData && venueData.pointsPerCurrency
      ? h(Card, { bg: C.mint, style: { marginBottom: 16 } },
          h('div', { style: { fontSize: 14, color: C.hint } }, 'Будет начислено'),
          h('div', { style: { fontSize: 32, fontWeight: 900, color: '#2E7D32' } },
            '+' + Math.floor(parseFloat(amount) * venueData.pointsPerCurrency) + ' pts')
        )
      : null,
    h(ErrBox, { msg: error }),
    h(Btn, { label: 'Подтвердить покупку', onClick: awardPoints, disabled: !amount || parseFloat(amount) <= 0 })
  );

  // ── Redeem: enter points ─────────────────────────────────
  if (mode === 'redeem') return h('div', { style: { padding: '16px 20px' } },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 } },
      h('button', { onClick: function() { setError(''); setMode('customer'); }, style: { fontSize: 22 } }, '←'),
      h('div', null,
        h('div', { style: { fontSize: 20, fontWeight: 800 } }, 'Списать баллы'),
        h('div', { style: { fontSize: 13, color: C.hint } }, customer.name + ' — ' + customer.totalPoints.toLocaleString() + ' pts')
      )
    ),
    h('div', { style: { fontSize: 13, color: C.hint, marginBottom: 6 } }, 'Количество баллов'),
    h('input', {
      type: 'number', inputMode: 'numeric', value: points,
      onChange: function(e) { setPoints(e.target.value); }, placeholder: '0',
      style: {
        width: '100%', fontSize: 40, fontWeight: 900, padding: '16px',
        background: C.white, border: '1.5px solid ' + C.border,
        borderRadius: 16, color: C.text, marginBottom: 12,
      },
    }),
    parseInt(points) > customer.totalPoints
      ? h('div', { style: { color: C.red, fontSize: 13, marginBottom: 8 } },
          '⚠️ Превышает баланс (' + customer.totalPoints + ' pts)')
      : null,
    h(ErrBox, { msg: error }),
    h(Btn, {
      label: 'Списать баллы', color: C.red,
      onClick: redeemPoints,
      disabled: !points || parseInt(points) <= 0 || parseInt(points) > customer.totalPoints,
    })
  );

  return null;
}

// ── Root ──────────────────────────────────────────────────────────
function App() {
  var stateS  = useState('loading'); var state  = stateS[0];  var setState  = stateS[1];
  var tokenS  = useState('');        var token  = tokenS[0];  var setToken  = tokenS[1];
  var staffS  = useState(null);      var staff  = staffS[0];  var setStaff  = staffS[1];
  var errorS  = useState('');        var error  = errorS[0];  var setError  = errorS[1];

  useEffect(function() {
    doAuth().then(function(data) {
      if (data.status === 'unregistered') {
        setState('unregistered');
      } else if (data.status === 'revoked') {
        setState('revoked');
      } else if (data.status === 'active') {
        setToken(data.token);
        setStaff(data.staff);
        setState('ready');
      } else {
        setState('error');
        setError('Неизвестный статус: ' + data.status);
      }
    }).catch(function(e) {
      setState('error');
      setError(e.message);
    });
  }, []);

  if (state === 'loading') return h(Splash, { msg: 'Авторизация…' });
  if (state === 'error')   return h(Splash, { msg: 'Ошибка входа', sub: error, isError: true });
  if (state === 'revoked') return h(Splash, { msg: 'Доступ отозван', sub: 'Обратитесь к владельцу заведения.', isError: true });
  if (state === 'unregistered') return h(Splash, {
    msg: 'Вы не зарегистрированы',
    sub: 'Попросите владельца заведения выслать вам ссылку-приглашение.',
    isError: true,
  });
  if (state === 'ready') return h(ScannerApp, { token: token, staff: staff });
  return null;
}

ReactDOM.createRoot(document.getElementById('app')).render(h(App, null));
})();
</script>
</body>
</html>`

export async function GET() {
  return new Response(HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}
