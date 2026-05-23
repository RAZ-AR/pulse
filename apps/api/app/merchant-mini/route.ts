/**
 * GET /merchant-mini
 *
 * Telegram Merchant Mini App — served as raw HTML, bypassing Next.js layout.
 * Screens: registration flow → pending | main app (Home / Rewards / Scan / Profile).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api.ayoo.space"

const BASE_STYLES = `
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
`

/* eslint-disable @next/next/no-sync-scripts */
const APP_SCRIPT = `
(function() {
'use strict';
var useState = React.useState;
var useEffect = React.useEffect;
var useRef = React.useRef;
var h = React.createElement;
var API = window.__API_BASE__;
var tg = window.Telegram && window.Telegram.WebApp;

// ── Colors ────────────────────────────────────────────────────────
var C = {
  bg:       '#F5F5F7',
  white:    '#FFFFFF',
  text:     '#1A1A1A',
  hint:     '#888888',
  accent:   '#5B4CF5',
  green:    '#10B981',
  red:      '#EF4444',
  border:   'rgba(0,0,0,0.07)',
  cream:    '#FFF8E1',
  mint:     '#E8F5E9',
  sky:      '#E3F2FD',
  lavender: '#EDE9FF',
};

// ── tRPC client — superjson wire format ───────────────────────────
// Input: { json: actualInput }, Output: result.data.json
async function trpcQuery(token, proc, input) {
  var url = API + '/api/merchant-mini-trpc/' + proc
    + '?input=' + encodeURIComponent(JSON.stringify({ json: input }));
  var res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  var json = await res.json();
  if (json.error) throw new Error((json.error.json && json.error.json.message) || 'Error');
  return json.result.data.json;
}
async function trpcMutate(token, proc, input) {
  var res = await fetch(API + '/api/merchant-mini-trpc/' + proc, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ json: input }),
  });
  var json = await res.json();
  if (json.error) throw new Error((json.error.json && json.error.json.message) || 'Error');
  return json.result.data.json;
}

// ── Auth ──────────────────────────────────────────────────────────
async function doAuth() {
  var initData = tg && tg.initData;
  if (!initData) throw new Error('Откройте приложение через Telegram');
  var res = await fetch(API + '/api/merchant-tg-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: initData }),
  });
  var json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Auth failed');
  return json; // { status: 'unregistered' | 'pending' | 'active', ... }
}

// ── UI Primitives ─────────────────────────────────────────────────

function Btn(props) {
  var label = props.label, onClick = props.onClick, disabled = props.disabled,
      color = props.color, small = props.small, outline = props.outline;
  var bg = outline ? 'transparent' : (disabled ? '#ccc' : (color || C.accent));
  var fc = outline ? (color || C.accent) : '#fff';
  return h('button', {
    onClick: onClick,
    disabled: disabled,
    style: {
      width: small ? 'auto' : '100%',
      padding: small ? '10px 20px' : '15px',
      background: bg,
      color: fc,
      border: outline ? ('2px solid ' + (color || C.accent)) : 'none',
      borderRadius: 14,
      fontSize: small ? 14 : 16,
      fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      transition: 'opacity .15s',
    },
  }, label);
}

function Card(props) {
  return h('div', {
    style: Object.assign({
      background: props.bg || C.white,
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }, props.style || {}),
  }, props.children);
}

function TxtInput(props) {
  return h('input', {
    value: props.value,
    placeholder: props.placeholder,
    type: props.type || 'text',
    inputMode: props.inputMode,
    maxLength: props.maxLength,
    onChange: function(e) { props.onChange(e.target.value); },
    style: Object.assign({
      width: '100%', padding: '14px 16px',
      background: C.white,
      border: '1.5px solid ' + C.border,
      borderRadius: 14,
      fontSize: 16, color: C.text,
    }, props.style || {}),
  });
}

function ErrBox(props) {
  if (!props.msg) return null;
  return h('div', {
    style: {
      background: '#FEF2F2', color: C.red,
      borderRadius: 12, padding: '10px 14px',
      fontSize: 14, marginBottom: 12,
    },
  }, '⚠️ ' + props.msg);
}

// ── Splash ────────────────────────────────────────────────────────
function Splash(props) {
  return h('div', {
    style: {
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: 32, gap: 16, textAlign: 'center',
      background: C.bg,
    },
  },
    h('div', { style: { fontSize: 56 } }, props.isError ? '⚠️' : '✨'),
    h('div', { style: { fontSize: 18, fontWeight: 700 } }, props.msg),
    props.sub && h('div', { style: { fontSize: 14, color: C.hint, maxWidth: 260, lineHeight: 1.5 } }, props.sub)
  );
}

// ── Pending screen ────────────────────────────────────────────────
function PendingScreen() {
  return h('div', {
    style: {
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: 32, gap: 12, textAlign: 'center',
      background: C.bg,
    },
  },
    h('div', { style: { fontSize: 64 } }, '⏳'),
    h('div', { style: { fontSize: 24, fontWeight: 800 } }, 'Заявка на проверке'),
    h('div', { style: { fontSize: 15, color: C.hint, maxWidth: 280, lineHeight: 1.6, marginTop: 4 } },
      'Проверим данные и активируем аккаунт в течение 24 часов. Вы получите уведомление в боте.'),
    h('div', { style: { marginTop: 16, padding: '12px 20px', background: C.lavender, borderRadius: 14 } },
      h('div', { style: { fontSize: 13, color: C.accent, fontWeight: 600 } }, 'Вопросы? @ayoo_support'))
  );
}

// ── Registration flow ─────────────────────────────────────────────
var CATEGORIES = [
  { label: '☕ Кафе', value: 'CAFE' },
  { label: '🍽 Ресторан', value: 'RESTAURANT' },
  { label: '🍺 Бар', value: 'RESTAURANT' },
  { label: '🛍 Магазин', value: 'RETAIL' },
  { label: '💈 Сервис', value: 'SERVICE' },
  { label: '📦 Другое', value: 'OTHER' },
];
var CITIES = ['Белград', 'Нови-Сад', 'Ниш', 'Суботица', 'Крагуевац'];
var RATES = [
  { label: '⭐ Стандарт', sub: '8 pts / 1000 RSD', value: 0.008 },
  { label: '💎 Премиум', sub: '12 pts / 1000 RSD', value: 0.012 },
];

function RegisterScreen(props) {
  var onSuccess = props.onSuccess;
  var stepState = useState(0); var step = stepState[0]; var setStep = stepState[1];
  var formState = useState({ name: '', category: '', city: '', address: '', phone: '', email: '', taxId: '', rate: 0.008 });
  var form = formState[0]; var setForm = formState[1];
  var customCityState = useState(''); var customCity = customCityState[0]; var setCustomCity = customCityState[1];
  var showCustomCityState = useState(false); var showCustomCity = showCustomCityState[0]; var setShowCustomCity = showCustomCityState[1];
  var customRateState = useState(''); var customRate = customRateState[0]; var setCustomRate = customRateState[1];
  var showCustomRateState = useState(false); var showCustomRate = showCustomRateState[0]; var setShowCustomRate = showCustomRateState[1];
  var loadingState = useState(false); var loading = loadingState[0]; var setLoading = loadingState[1];
  var errorState = useState(''); var error = errorState[0]; var setError = errorState[1];

  function set(key, val) { setForm(function(f) { var n = Object.assign({}, f); n[key] = val; return n; }); }

  var btnStyle = {
    padding: '14px 16px', background: C.white,
    borderRadius: 14, border: '1.5px solid ' + C.border,
    fontSize: 16, textAlign: 'left', cursor: 'pointer',
    display: 'block', width: '100%',
  };

  // Step 0: name
  function step0() {
    return h('div', { style: { padding: '0 20px' } },
      h('div', { style: { fontSize: 22, fontWeight: 800, marginBottom: 6 } }, 'Название заведения'),
      h('div', { style: { fontSize: 14, color: C.hint, marginBottom: 20 } }, 'Шаг 1 из 8'),
      h(TxtInput, { value: form.name, onChange: function(v) { set('name', v); }, placeholder: 'Например: Кафе Белград' }),
      h('div', { style: { height: 16 } }),
      h(Btn, { label: 'Далее →', disabled: !form.name.trim(), onClick: function() { if (form.name.trim()) setStep(1); } })
    );
  }

  // Step 1: category
  function step1() {
    return h('div', { style: { padding: '0 20px' } },
      h('div', { style: { fontSize: 22, fontWeight: 800, marginBottom: 6 } }, 'Тип заведения'),
      h('div', { style: { fontSize: 14, color: C.hint, marginBottom: 20 } }, 'Шаг 2 из 8'),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } },
        CATEGORIES.map(function(c) {
          return h('button', {
            key: c.label,
            onClick: function() { set('category', c.value); setStep(2); },
            style: {
              padding: '16px 10px', background: C.white,
              borderRadius: 14, border: '1.5px solid ' + C.border,
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
            },
          }, c.label);
        })
      )
    );
  }

  // Step 2: city
  function step2() {
    if (showCustomCity) return h('div', { style: { padding: '0 20px' } },
      h('div', { style: { fontSize: 22, fontWeight: 800, marginBottom: 6 } }, 'Ваш город'),
      h('div', { style: { fontSize: 14, color: C.hint, marginBottom: 20 } }, 'Шаг 3 из 8'),
      h(TxtInput, { value: customCity, onChange: setCustomCity, placeholder: 'Название города' }),
      h('div', { style: { height: 16 } }),
      h(Btn, { label: 'Далее →', disabled: !customCity.trim(), onClick: function() { if (customCity.trim()) { set('city', customCity.trim()); setStep(3); } } })
    );
    return h('div', { style: { padding: '0 20px' } },
      h('div', { style: { fontSize: 22, fontWeight: 800, marginBottom: 6 } }, 'Город'),
      h('div', { style: { fontSize: 14, color: C.hint, marginBottom: 16 } }, 'Шаг 3 из 8'),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        CITIES.map(function(c) {
          return h('button', {
            key: c, onClick: function() { set('city', c); setStep(3); },
            style: btnStyle,
          }, c);
        }).concat([
          h('button', {
            key: 'other', onClick: function() { setShowCustomCity(true); },
            style: Object.assign({}, btnStyle, { color: C.accent }),
          }, '✏️ Другой город'),
        ])
      )
    );
  }

  // Step 3: address
  function step3() {
    return h('div', { style: { padding: '0 20px' } },
      h('div', { style: { fontSize: 22, fontWeight: 800, marginBottom: 6 } }, 'Адрес'),
      h('div', { style: { fontSize: 14, color: C.hint, marginBottom: 4 } }, 'Шаг 4 из 8'),
      h('div', { style: { fontSize: 13, color: C.hint, marginBottom: 16 } }, 'Например: ул. Кнеза Михаила 12'),
      h(TxtInput, { value: form.address, onChange: function(v) { set('address', v); }, placeholder: 'Улица и номер' }),
      h('div', { style: { height: 16 } }),
      h(Btn, { label: 'Далее →', disabled: !form.address.trim(), onClick: function() { if (form.address.trim()) setStep(4); } })
    );
  }

  // Step 4: phone
  function step4() {
    return h('div', { style: { padding: '0 20px' } },
      h('div', { style: { fontSize: 22, fontWeight: 800, marginBottom: 6 } }, 'Телефон'),
      h('div', { style: { fontSize: 14, color: C.hint, marginBottom: 20 } }, 'Шаг 5 из 8'),
      h(TxtInput, { value: form.phone, onChange: function(v) { set('phone', v); }, placeholder: '+381 63 123456', type: 'tel' }),
      h('div', { style: { height: 16 } }),
      h(Btn, { label: 'Далее →', disabled: !form.phone.trim(), onClick: function() { if (form.phone.trim()) setStep(5); } })
    );
  }

  // Step 5: email
  function step5() {
    return h('div', { style: { padding: '0 20px' } },
      h('div', { style: { fontSize: 22, fontWeight: 800, marginBottom: 6 } }, 'Email'),
      h('div', { style: { fontSize: 14, color: C.hint, marginBottom: 20 } }, 'Шаг 6 из 8'),
      h(TxtInput, { value: form.email, onChange: function(v) { set('email', v); }, placeholder: 'cafe@example.rs', type: 'email' }),
      h('div', { style: { height: 16 } }),
      h(Btn, { label: 'Далее →', disabled: !form.email.includes('@'), onClick: function() { if (form.email.includes('@')) setStep(6); } })
    );
  }

  // Step 6: tax id (optional)
  function step6() {
    return h('div', { style: { padding: '0 20px' } },
      h('div', { style: { fontSize: 22, fontWeight: 800, marginBottom: 6 } }, 'ПИБ (PIB)'),
      h('div', { style: { fontSize: 14, color: C.hint, marginBottom: 4 } }, 'Шаг 7 из 8'),
      h('div', { style: { fontSize: 13, color: C.hint, marginBottom: 16 } }, 'Налоговый номер — для распознавания чеков (необязательно)'),
      h(TxtInput, { value: form.taxId, onChange: function(v) { set('taxId', v); }, placeholder: '123456789', inputMode: 'numeric', maxLength: 13 }),
      h('div', { style: { height: 16 } }),
      h('div', { style: { display: 'flex', gap: 10 } },
        h(Btn, { label: 'Пропустить', outline: true, small: true, onClick: function() { set('taxId', ''); setStep(7); } }),
        h(Btn, { label: 'Далее →', small: true, onClick: function() { setStep(7); } })
      )
    );
  }

  // Step 7: rate
  function step7() {
    if (showCustomRate) return h('div', { style: { padding: '0 20px' } },
      h('div', { style: { fontSize: 22, fontWeight: 800, marginBottom: 6 } }, 'Своя ставка'),
      h('div', { style: { fontSize: 13, color: C.hint, marginBottom: 16 } }, 'Баллов за 1000 RSD (от 1 до 100)'),
      h(TxtInput, { value: customRate, onChange: setCustomRate, placeholder: '10', inputMode: 'numeric' }),
      h('div', { style: { height: 16 } }),
      h(Btn, {
        label: 'Далее →',
        disabled: !customRate || isNaN(parseInt(customRate)) || parseInt(customRate) < 1 || parseInt(customRate) > 100,
        onClick: function() {
          var pts = parseInt(customRate);
          if (pts >= 1 && pts <= 100) { set('rate', pts / 1000); setStep(8); }
        },
      })
    );
    return h('div', { style: { padding: '0 20px' } },
      h('div', { style: { fontSize: 22, fontWeight: 800, marginBottom: 6 } }, 'Ставка баллов'),
      h('div', { style: { fontSize: 14, color: C.hint, marginBottom: 4 } }, 'Шаг 8 из 8'),
      h('div', { style: { fontSize: 13, color: C.hint, marginBottom: 16 } }, 'Сколько баллов клиент получает за 1000 RSD'),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
        RATES.map(function(r) {
          return h('button', {
            key: r.label,
            onClick: function() { set('rate', r.value); setStep(8); },
            style: Object.assign({}, btnStyle, { padding: 16 }),
          },
            h('div', { style: { fontSize: 16, fontWeight: 700 } }, r.label),
            h('div', { style: { fontSize: 13, color: C.hint, marginTop: 2 } }, r.sub)
          );
        }).concat([
          h('button', {
            key: 'custom',
            onClick: function() { setShowCustomRate(true); },
            style: Object.assign({}, btnStyle, { padding: 16 }),
          },
            h('div', { style: { fontSize: 16, fontWeight: 700, color: C.accent } }, '✏️ Своя ставка'),
            h('div', { style: { fontSize: 13, color: C.hint, marginTop: 2 } }, 'Введите число баллов за 1000 RSD')
          ),
        ])
      )
    );
  }

  // Step 8: confirmation
  function step8() {
    var rows = [
      ['🏪 Заведение', form.name],
      ['📍 Город', form.city],
      ['🗺 Адрес', form.address],
      ['📞 Телефон', form.phone],
      ['📧 Email', form.email],
      ['🪪 ПИБ', form.taxId || 'не указан'],
      ['⭐ Ставка', Math.round(form.rate * 1000) + ' pts / 1000 RSD'],
    ];
    return h('div', { style: { padding: '0 20px' } },
      h('div', { style: { fontSize: 22, fontWeight: 800, marginBottom: 16 } }, 'Проверьте данные'),
      h(Card, { bg: C.cream },
        rows.map(function(row) {
          return h('div', {
            key: row[0],
            style: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' },
          },
            h('div', { style: { fontSize: 13, color: C.hint, flexShrink: 0 } }, row[0]),
            h('div', { style: { fontSize: 13, fontWeight: 600, textAlign: 'right', marginLeft: 8 } }, row[1])
          );
        })
      ),
      h(ErrBox, { msg: error }),
      h(Btn, { label: loading ? 'Отправка…' : '✅ Подтвердить заявку', disabled: loading, onClick: submitRegister }),
      h('div', { style: { height: 8 } }),
      h(Btn, { label: '← Изменить', outline: true, small: true, onClick: function() { setError(''); setStep(0); } })
    );
  }

  async function submitRegister() {
    setLoading(true); setError('');
    try {
      var res = await fetch(API + '/api/merchant-tg-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: tg && tg.initData,
          name: form.name.trim(),
          category: form.category,
          city: form.city,
          address: form.address.trim(),
          phone: form.phone.trim(),
          email: form.email.trim().toLowerCase(),
          taxId: form.taxId.trim(),
          rate: form.rate,
        }),
      });
      var json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Ошибка сервера');
      onSuccess();
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  var stepFns = [step0, step1, step2, step3, step4, step5, step6, step7, step8];
  var currentFn = stepFns[step];

  return h('div', { style: { background: C.bg, minHeight: '100vh' } },
    // progress header
    h('div', { style: { padding: '16px 20px 8px', display: 'flex', alignItems: 'center', gap: 12 } },
      step > 0 && h('button', {
        onClick: function() { setStep(function(s) { return s - 1; }); },
        style: { fontSize: 22, color: C.text, padding: '0 4px', cursor: 'pointer', background: 'none', border: 'none' },
      }, '←'),
      h('div', { style: { flex: 1 } },
        h('div', { style: { fontSize: 12, color: C.hint, marginBottom: 4 } }, 'ayoo Partner — Регистрация'),
        h('div', { style: { height: 4, background: C.border, borderRadius: 2 } },
          h('div', { style: { height: 4, background: C.accent, borderRadius: 2, width: (((step + 1) / 9) * 100) + '%', transition: 'width .3s' } })
        )
      )
    ),
    h('div', { style: { height: 20 } }),
    currentFn && currentFn()
  );
}

// ── Home Tab ──────────────────────────────────────────────────────
function HomeTab(props) {
  var token = props.token, merchant = props.merchant, venue = props.venue, onScanStart = props.onScanStart;
  var dataState = useState(null); var data = dataState[0]; var setData = dataState[1];
  var loadingState = useState(true); var loading = loadingState[0]; var setLoading = loadingState[1];

  useEffect(function() {
    trpcQuery(token, 'merchant.miniDashboard', { venueId: venue.id })
      .then(setData)
      .catch(function() {})
      .finally(function() { setLoading(false); });
  }, [venue.id]);

  return h('div', { style: { padding: '20px 16px' } },
    // Greeting
    h('div', { style: { marginBottom: 20 } },
      h('div', { style: { fontSize: 24, fontWeight: 800 } }, '👋 ' + merchant.name),
      h('div', { style: { fontSize: 14, color: C.hint, marginTop: 2 } }, venue.name)
    ),

    // Stats
    loading
      ? h('div', { style: { textAlign: 'center', color: C.hint, padding: 24 } }, '...')
      : data && h('div', null,
          h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 } },
            h(Card, { bg: C.sky, style: { marginBottom: 0 } },
              h('div', { style: { fontSize: 12, color: '#1565C0', marginBottom: 4 } }, 'Транзакций сегодня'),
              h('div', { style: { fontSize: 36, fontWeight: 900, color: '#1565C0' } }, data.today.transactions)
            ),
            h(Card, { bg: C.mint, style: { marginBottom: 0 } },
              h('div', { style: { fontSize: 12, color: '#1B5E20', marginBottom: 4 } }, 'Баллов выдано'),
              h('div', { style: { fontSize: 36, fontWeight: 900, color: '#2E7D32' } }, data.today.pointsIssued)
            )
          ),
          data.activeRewards && data.activeRewards.length > 0 &&
            h(Card, { bg: C.lavender },
              h('div', { style: { fontSize: 12, color: '#4527A0', marginBottom: 4 } }, 'Активные акции'),
              h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8 } },
                h('div', { style: { fontSize: 28, fontWeight: 800, color: C.accent } }, data.activeRewards.length),
                h('div', { style: { fontSize: 13, color: '#4527A0' } }, data.activeRewards.map(function(r) { return r.title; }).join(' · '))
              )
            )
        ),

    // Quick scan CTA
    h('div', { style: { marginTop: 4 } },
      h('button', {
        onClick: onScanStart,
        style: {
          width: '100%', padding: '20px',
          background: 'linear-gradient(135deg, #5B4CF5, #8B5CF6)',
          color: '#fff', borderRadius: 20, border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(91,76,245,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        },
      },
        h('span', { style: { fontSize: 24 } }, '📷'),
        h('span', { style: { fontSize: 18, fontWeight: 700 } }, 'Сканировать клиента')
      )
    ),

    // Rate info
    h('div', { style: { marginTop: 14, padding: '12px 16px', background: C.cream, borderRadius: 14 } },
      h('div', { style: { fontSize: 12, color: C.hint } }, 'Ставка начисления'),
      h('div', { style: { fontSize: 15, fontWeight: 700, marginTop: 2 } },
        venue.pointsPerCurrency
          ? Math.round(venue.pointsPerCurrency * 1000) + ' pts за 1000 ' + (venue.currency || 'RSD')
          : 'Не установлена'
      )
    )
  );
}

// ── Rewards Tab ───────────────────────────────────────────────────
function RewardsTab(props) {
  var token = props.token, venue = props.venue;
  var rewardsState = useState([]); var rewards = rewardsState[0]; var setRewards = rewardsState[1];
  var loadingState = useState(true); var loading = loadingState[0]; var setLoading = loadingState[1];
  var addingState = useState(false); var adding = addingState[0]; var setAdding = addingState[1];
  var formState = useState({ title: '', description: '', pointsCost: '' });
  var form = formState[0]; var setForm = formState[1];
  var savingState = useState(false); var saving = savingState[0]; var setSaving = savingState[1];
  var errorState = useState(''); var error = errorState[0]; var setError = errorState[1];

  function loadRewards() {
    setLoading(true);
    trpcQuery(token, 'merchant.listRewards', { venueId: venue.id })
      .then(setRewards)
      .catch(function() {})
      .finally(function() { setLoading(false); });
  }
  useEffect(function() { loadRewards(); }, [venue.id]);

  async function toggleReward(id, current) {
    try {
      await trpcMutate(token, 'merchant.updateReward', { rewardId: id, isActive: !current });
      loadRewards();
    } catch(e) {}
  }

  async function createReward() {
    if (!form.title.trim() || !form.pointsCost) return;
    setSaving(true); setError('');
    try {
      await trpcMutate(token, 'merchant.createReward', {
        venueId: venue.id,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        pointsCost: parseInt(form.pointsCost),
      });
      setForm({ title: '', description: '', pointsCost: '' });
      setAdding(false);
      loadRewards();
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  }

  if (adding) return h('div', { style: { padding: '0 16px' } },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 } },
      h('button', { onClick: function() { setAdding(false); setError(''); }, style: { fontSize: 22, cursor: 'pointer' } }, '←'),
      h('div', { style: { fontSize: 20, fontWeight: 800 } }, 'Новая акция')
    ),
    h('div', { style: { marginBottom: 10 } },
      h('div', { style: { fontSize: 13, color: C.hint, marginBottom: 6 } }, 'Название'),
      h(TxtInput, { value: form.title, onChange: function(v) { setForm(function(f) { return Object.assign({}, f, { title: v }); }); }, placeholder: 'Кофе в подарок' })
    ),
    h('div', { style: { marginBottom: 10 } },
      h('div', { style: { fontSize: 13, color: C.hint, marginBottom: 6 } }, 'Описание (необязательно)'),
      h(TxtInput, { value: form.description, onChange: function(v) { setForm(function(f) { return Object.assign({}, f, { description: v }); }); }, placeholder: 'При покупке от 500 RSD' })
    ),
    h('div', { style: { marginBottom: 20 } },
      h('div', { style: { fontSize: 13, color: C.hint, marginBottom: 6 } }, 'Стоимость в баллах'),
      h(TxtInput, { value: form.pointsCost, onChange: function(v) { setForm(function(f) { return Object.assign({}, f, { pointsCost: v }); }); }, placeholder: '1000', inputMode: 'numeric' })
    ),
    h(ErrBox, { msg: error }),
    h(Btn, { label: saving ? 'Сохранение…' : 'Создать акцию', disabled: saving || !form.title.trim() || !form.pointsCost, onClick: createReward })
  );

  return h('div', { style: { padding: '0 16px' } },
    h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 } },
      h('div', { style: { fontSize: 20, fontWeight: 800 } }, 'Акции'),
      h('button', {
        onClick: function() { setAdding(true); },
        style: {
          background: C.accent, color: '#fff', borderRadius: 99, border: 'none',
          width: 36, height: 36, fontSize: 22, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        },
      }, '+')
    ),
    loading
      ? h('div', { style: { textAlign: 'center', color: C.hint, padding: 24 } }, '...')
      : rewards.length === 0
        ? h(Card, { bg: C.cream },
            h('div', { style: { textAlign: 'center', padding: '20px 0' } },
              h('div', { style: { fontSize: 40, marginBottom: 10 } }, '🎁'),
              h('div', { style: { fontWeight: 700 } }, 'Нет акций'),
              h('div', { style: { fontSize: 13, color: C.hint, marginTop: 4 } }, 'Создайте первую акцию для клиентов')
            )
          )
        : rewards.map(function(r) {
            return h(Card, { key: r.id },
              h('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 } },
                h('div', { style: { flex: 1 } },
                  h('div', { style: { fontWeight: 700, fontSize: 16 } }, r.title),
                  r.description && h('div', { style: { fontSize: 13, color: C.hint, marginTop: 2 } }, r.description),
                  h('div', { style: { fontSize: 13, color: C.accent, fontWeight: 600, marginTop: 4 } },
                    r.pointsCost.toLocaleString() + ' pts · ' + r.redeemedCount + ' использований')
                ),
                h('button', {
                  onClick: function() { toggleReward(r.id, r.isActive); },
                  style: {
                    padding: '6px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', flexShrink: 0,
                    background: r.isActive ? C.green : C.hint, color: '#fff',
                    fontSize: 12, fontWeight: 700,
                  },
                }, r.isActive ? 'Вкл' : 'Откл')
              )
            );
          })
  );
}

// ── Scan Tab ──────────────────────────────────────────────────────
function ScanTab(props) {
  var token = props.token, venue = props.venue;
  var modeState = useState('home'); var mode = modeState[0]; var setMode = modeState[1];
  var codeState = useState(''); var code = codeState[0]; var setCode = codeState[1];
  var customerState = useState(null); var customer = customerState[0]; var setCustomer = customerState[1];
  var amountState = useState(''); var amount = amountState[0]; var setAmount = amountState[1];
  var pointsState = useState(''); var points = pointsState[0]; var setPoints = pointsState[1];
  var loadingState = useState(false); var loading = loadingState[0]; var setLoading = loadingState[1];
  var errorState = useState(''); var error = errorState[0]; var setError = errorState[1];
  var resultState = useState(null); var result = resultState[0]; var setResult = resultState[1];

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
      var res = await trpcMutate(token, 'transaction.partnerPurchase', {
        userId: customer.userId, venueId: venue.id,
        amount: parseFloat(amount), currency: venue.currency || 'RSD',
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

  if (loading) return h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' } },
    h('div', { style: { fontSize: 16, color: C.hint } }, 'Загрузка…')
  );

  // Home: scan button + manual input
  if (mode === 'home') return h('div', { style: { padding: '0 16px' } },
    h('div', { style: { fontSize: 20, fontWeight: 800, marginBottom: 20 } }, 'Скан клиента'),
    h(ErrBox, { msg: error }),
    h('button', {
      onClick: scanQr,
      style: {
        width: '100%', padding: '28px 20px',
        background: '#1A1A1A', color: '#fff',
        borderRadius: 20, border: 'none', cursor: 'pointer', marginBottom: 16,
        textAlign: 'center',
      },
    },
      h('div', { style: { fontSize: 48, marginBottom: 10 } }, '📷'),
      h('div', { style: { fontSize: 18, fontWeight: 700 } }, 'Сканировать QR'),
      h('div', { style: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 } }, 'QR-код из приложения ayoo')
    ),
    h('div', { style: { fontSize: 13, color: C.hint, textAlign: 'center', marginBottom: 12 } }, 'или введите код вручную'),
    h('div', { style: { display: 'flex', gap: 8 } },
      h(TxtInput, {
        value: code, onChange: function(v) { setCode(v.toUpperCase()); },
        placeholder: 'AYOO1', maxLength: 12,
        style: { letterSpacing: 3, fontWeight: 700, fontSize: 18, textAlign: 'center' },
      }),
      h('button', {
        onClick: function() { if (code.trim()) resolveCode(code.trim()); },
        disabled: !code.trim(),
        style: {
          padding: '0 20px', background: C.accent, color: '#fff', borderRadius: 14,
          border: 'none', fontWeight: 700, fontSize: 18,
          cursor: code.trim() ? 'pointer' : 'not-allowed',
          opacity: code.trim() ? 1 : 0.5,
        },
      }, '→')
    )
  );

  // Customer card
  if (mode === 'customer') return h('div', { style: { padding: '0 16px' } },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 } },
      h('button', { onClick: reset, style: { fontSize: 22, cursor: 'pointer' } }, '←'),
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
        style: { padding: '20px 12px', background: C.mint, borderRadius: 18, border: 'none', cursor: 'pointer', textAlign: 'center' },
      },
        h('div', { style: { fontSize: 36, marginBottom: 8 } }, '➕'),
        h('div', { style: { fontWeight: 700, fontSize: 15 } }, 'Начислить'),
        h('div', { style: { fontSize: 12, color: C.hint, marginTop: 4 } }, 'Покупка')
      ),
      h('button', {
        onClick: function() { if (customer.totalPoints > 0) { setError(''); setMode('redeem'); } else setError('У клиента нет баллов'); },
        style: { padding: '20px 12px', background: C.lavender, borderRadius: 18, border: 'none', cursor: 'pointer', textAlign: 'center' },
      },
        h('div', { style: { fontSize: 36, marginBottom: 8 } }, '💸'),
        h('div', { style: { fontWeight: 700, fontSize: 15 } }, 'Списать'),
        h('div', { style: { fontSize: 12, color: C.hint, marginTop: 4 } }, 'Оплата баллами')
      )
    )
  );

  // Earn: enter amount
  if (mode === 'earn') return h('div', { style: { padding: '0 16px' } },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 } },
      h('button', { onClick: function() { setError(''); setMode('customer'); }, style: { fontSize: 22, cursor: 'pointer' } }, '←'),
      h('div', null,
        h('div', { style: { fontSize: 20, fontWeight: 800 } }, 'Начислить баллы'),
        h('div', { style: { fontSize: 13, color: C.hint } }, customer.name)
      )
    ),
    h('div', { style: { fontSize: 13, color: C.hint, marginBottom: 6 } }, 'Сумма покупки, ' + (venue.currency || 'RSD')),
    h('input', {
      type: 'number', inputMode: 'numeric', value: amount,
      onChange: function(e) { setAmount(e.target.value); }, placeholder: '0',
      style: {
        width: '100%', fontSize: 40, fontWeight: 900, padding: '16px',
        background: C.white, border: '1.5px solid ' + C.border,
        borderRadius: 16, color: C.text, marginBottom: 12,
      },
    }),
    amount && parseFloat(amount) > 0 && venue.pointsPerCurrency
      ? h(Card, { bg: C.mint, style: { marginBottom: 16 } },
          h('div', { style: { fontSize: 14, color: C.hint } }, 'Будет начислено'),
          h('div', { style: { fontSize: 32, fontWeight: 900, color: '#2E7D32' } },
            '+' + Math.floor(parseFloat(amount) * venue.pointsPerCurrency) + ' pts')
        )
      : null,
    h(ErrBox, { msg: error }),
    h(Btn, { label: 'Подтвердить покупку', onClick: awardPoints, disabled: !amount || parseFloat(amount) <= 0 })
  );

  // Redeem: enter points
  if (mode === 'redeem') return h('div', { style: { padding: '0 16px' } },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 } },
      h('button', { onClick: function() { setError(''); setMode('customer'); }, style: { fontSize: 22, cursor: 'pointer' } }, '←'),
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
      ? h('div', { style: { color: C.red, fontSize: 13, marginBottom: 8 } }, '⚠️ Превышает баланс (' + customer.totalPoints + ' pts)')
      : null,
    h(ErrBox, { msg: error }),
    h(Btn, { label: 'Подтвердить списание', color: '#7C3AED', onClick: redeemPoints,
      disabled: !points || parseInt(points) <= 0 || parseInt(points) > customer.totalPoints })
  );

  // Result
  if (mode === 'result' && result) return h('div', {
    style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', padding: '0 24px', textAlign: 'center' },
  },
    h('div', { style: { fontSize: 72, marginBottom: 16 } }, result.type === 'earn' ? '✅' : '💜'),
    h('div', { style: { fontSize: 24, fontWeight: 800, marginBottom: 8 } }, result.type === 'earn' ? 'Баллы начислены!' : 'Баллы списаны!'),
    h('div', { style: { fontSize: 44, fontWeight: 900, color: result.type === 'earn' ? C.green : '#7C3AED', marginBottom: 8 } },
      (result.type === 'earn' ? '+' : '-') + result.points + ' pts'),
    h('div', { style: { fontSize: 15, color: C.hint, marginBottom: 24 } }, result.name),
    result.newBalance != null && h('div', { style: { fontSize: 14, color: C.hint, marginBottom: 20 } }, 'Новый баланс: ' + result.newBalance.toLocaleString() + ' pts'),
    h(Btn, { label: 'Следующий клиент', onClick: reset })
  );

  return null;
}

// ── Profile Tab ───────────────────────────────────────────────────
function ProfileTab(props) {
  var merchant = props.merchant, venue = props.venue;
  return h('div', { style: { padding: '0 16px' } },
    h('div', { style: { fontSize: 20, fontWeight: 800, marginBottom: 16 } }, 'Профиль'),
    h(Card, { bg: C.lavender },
      h('div', { style: { fontSize: 36, marginBottom: 8 } }, '🏪'),
      h('div', { style: { fontSize: 20, fontWeight: 800 } }, merchant.name),
      h('div', {
        style: { display: 'inline-block', marginTop: 8, padding: '4px 12px', background: C.green, color: '#fff', borderRadius: 99, fontSize: 12, fontWeight: 700 },
      }, 'Активный партнёр')
    ),
    h(Card, null,
      h('div', { style: { fontWeight: 700, marginBottom: 12 } }, 'Заведение'),
      [
        ['📍 Название', venue.name],
        ['⭐ Ставка', venue.pointsPerCurrency ? Math.round(venue.pointsPerCurrency * 1000) + ' pts / 1000 ' + (venue.currency || 'RSD') : 'Не установлена'],
        ['💱 Валюта', venue.currency || 'RSD'],
      ].map(function(row) {
        return h('div', {
          key: row[0],
          style: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid ' + C.border },
        },
          h('div', { style: { fontSize: 14, color: C.hint } }, row[0]),
          h('div', { style: { fontSize: 14, fontWeight: 600 } }, row[1])
        );
      })
    ),
    h('div', { style: { padding: '14px 16px', background: C.cream, borderRadius: 14, textAlign: 'center' } },
      h('div', { style: { fontSize: 13, color: C.hint } }, 'Поддержка'),
      h('div', { style: { fontSize: 15, fontWeight: 700, color: C.accent, marginTop: 4 } }, '@ayoo_support')
    )
  );
}

// ── Venue picker (multiple venues) ────────────────────────────────
function VenuePicker(props) {
  var merchant = props.merchant, onSelect = props.onSelect;
  return h('div', { style: { padding: '20px 16px', background: C.bg, minHeight: '100vh' } },
    h('div', { style: { fontSize: 24, fontWeight: 800, marginBottom: 4 } }, merchant.name),
    h('div', { style: { fontSize: 14, color: C.hint, marginBottom: 20 } }, 'Выберите заведение'),
    merchant.venues.map(function(v) {
      return h(Card, { key: v.id, style: { cursor: 'pointer' } },
        h('button', {
          onClick: function() { onSelect(v); },
          style: { width: '100%', background: 'none', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' },
        },
          h('div', null,
            h('div', { style: { fontWeight: 700, fontSize: 16 } }, v.name),
            v.pointsPerCurrency && h('div', { style: { fontSize: 13, color: C.hint, marginTop: 2 } },
              Math.round(v.pointsPerCurrency * 1000) + ' pts / 1000 ' + (v.currency || 'RSD'))
          ),
          h('div', { style: { fontSize: 22, color: C.hint } }, '›')
        )
      );
    })
  );
}

// ── Main app with dock ────────────────────────────────────────────
var DOCK = [
  { id: 'home',    icon: '🏠', label: 'Главная' },
  { id: 'rewards', icon: '⭐', label: 'Акции' },
  { id: 'scan',    icon: '📷', label: 'Скан' },
  { id: 'profile', icon: '👤', label: 'Профиль' },
];

function MainApp(props) {
  var token = props.token, merchant = props.merchant, venue = props.venue;
  var tabState = useState('home'); var tab = tabState[0]; var setTab = tabState[1];

  var content = tab === 'home'
    ? h(HomeTab, { token: token, merchant: merchant, venue: venue, onScanStart: function() { setTab('scan'); } })
    : tab === 'rewards'
    ? h(RewardsTab, { token: token, venue: venue })
    : tab === 'scan'
    ? h(ScanTab, { token: token, venue: venue })
    : h(ProfileTab, { merchant: merchant, venue: venue });

  return h('div', { style: { background: C.bg, minHeight: '100vh', paddingBottom: 72 } },
    h('div', { style: { paddingTop: 16 } }, content),
    h('div', {
      style: {
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 64, background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid ' + C.border,
        display: 'flex', alignItems: 'stretch',
      },
    },
      DOCK.map(function(t) {
        return h('button', {
          key: t.id,
          onClick: function() { setTab(t.id); },
          style: {
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 2,
            background: 'none', border: 'none', cursor: 'pointer',
            color: tab === t.id ? C.accent : C.hint,
          },
        },
          h('div', { style: { fontSize: 22 } }, t.icon),
          h('div', { style: { fontSize: 10, fontWeight: tab === t.id ? 700 : 400 } }, t.label)
        );
      })
    )
  );
}

// ── Root ──────────────────────────────────────────────────────────
function App() {
  var stateS = useState('loading'); var state = stateS[0]; var setState = stateS[1];
  var authState = useState(null); var authData = authState[0]; var setAuthData = authState[1];
  var venueState = useState(null); var venue = venueState[0]; var setVenue = venueState[1];
  var errState = useState(''); var errMsg = errState[0]; var setErrMsg = errState[1];

  useEffect(function() {
    tg && tg.ready && tg.ready();
    tg && tg.expand && tg.expand();
    doAuth().then(function(data) {
      if (data.status === 'unregistered') {
        setState('register');
      } else if (data.status === 'pending') {
        setState('pending');
      } else if (data.status === 'active') {
        setAuthData(data);
        if (data.merchant.venues.length === 1) {
          setVenue(data.merchant.venues[0]);
          setState('main');
        } else if (data.merchant.venues.length === 0) {
          setErrMsg('Нет активных заведений. Обратитесь в поддержку ayoo.');
          setState('error');
        } else {
          setState('venue');
        }
      } else {
        setErrMsg(data.error || 'Неизвестная ошибка');
        setState('error');
      }
    }).catch(function(e) { setErrMsg(e.message); setState('error'); });
  }, []);

  if (state === 'loading')  return h(Splash, { msg: 'Загрузка ayoo Partner…' });
  if (state === 'error')    return h(Splash, { msg: errMsg, isError: true });
  if (state === 'pending')  return h(PendingScreen, null);
  if (state === 'register') return h(RegisterScreen, { onSuccess: function() { setState('pending'); } });
  if (state === 'venue')    return h(VenuePicker, {
    merchant: authData.merchant,
    onSelect: function(v) { setVenue(v); setState('main'); },
  });
  if (state === 'main')     return h(MainApp, { token: authData.token, merchant: authData.merchant, venue: venue });
  return null;
}

var root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h(App, null));

})();
`

export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>ayoo Partner</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div id="root"></div>
  <script>window.__API_BASE__ = "${API_BASE}";</script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin="anonymous"></script>
  <script>${APP_SCRIPT}</script>
</body>
</html>`

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  })
}
