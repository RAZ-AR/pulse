/**
 * GET /merchant-mini
 *
 * Serves the Telegram Merchant Mini App as a plain HTML response,
 * bypassing Next.js layout/rendering entirely.
 * Scripts load synchronously in order: TG SDK → React → ReactDOM → App.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api.ayoo.space"

const BASE_STYLES = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
       background: var(--tg-theme-bg-color, #fff);
       color: var(--tg-theme-text-color, #111);
       min-height: 100vh; }
button { cursor: pointer; border: none; outline: none; }
input  { outline: none; border: none; }
`

const APP_SCRIPT = `
(function() {
const { useState, useEffect, useCallback, useRef } = React;
const API = window.__API_BASE__;
const tg = window.Telegram?.WebApp;

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  bg:       'var(--tg-theme-bg-color,#fff)',
  bgSec:    'var(--tg-theme-secondary-bg-color,#f4f4f5)',
  text:     'var(--tg-theme-text-color,#111)',
  hint:     'var(--tg-theme-hint-color,#888)',
  accent:   'var(--tg-theme-button-color,#0f1115)',
  btnText:  'var(--tg-theme-button-text-color,#fff)',
  danger:   '#dc2626',
  green:    '#059669',
  border:   'rgba(0,0,0,0.08)',
};

// ── Tiny tRPC client ──────────────────────────────────────────────────────────
async function trpcQuery(token, proc, input) {
  const url = API + '/api/merchant-mini-trpc/' + proc
    + '?input=' + encodeURIComponent(JSON.stringify(input));
  const res = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token },
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? JSON.stringify(json.error));
  return json.result.data;
}
async function trpcMutate(token, proc, input) {
  const res = await fetch(API + '/api/merchant-mini-trpc/' + proc, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? JSON.stringify(json.error));
  return json.result.data;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function telegramAuth() {
  const initData = tg?.initData;
  if (!initData) throw new Error('Откройте приложение через Telegram');
  const res = await fetch(API + '/api/merchant-tg-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Auth failed');
  return json; // { token, merchant: { id, name, venues } }
}

// ── Components ────────────────────────────────────────────────────────────────

function Btn({ label, onClick, color, disabled, small }) {
  return React.createElement('button', {
    onClick,
    disabled,
    style: {
      width: small ? 'auto' : '100%',
      padding: small ? '10px 20px' : '15px',
      background: disabled ? C.hint : (color || C.accent),
      color: C.btnText,
      borderRadius: 14,
      fontSize: small ? 14 : 16,
      fontWeight: 700,
      opacity: disabled ? 0.6 : 1,
      transition: 'opacity .15s',
    },
  }, label);
}

function Card({ children, style }) {
  return React.createElement('div', {
    style: {
      background: C.bgSec,
      borderRadius: 18,
      padding: '16px',
      marginBottom: 12,
      ...style,
    },
  }, children);
}

function AmountInput({ value, onChange, currency }) {
  return React.createElement('div', { style: { position: 'relative', marginBottom: 16 } },
    React.createElement('input', {
      type: 'number',
      inputMode: 'numeric',
      value,
      onChange: e => onChange(e.target.value),
      placeholder: '0',
      style: {
        width: '100%',
        fontSize: 32,
        fontWeight: 800,
        padding: '14px 70px 14px 16px',
        background: C.bgSec,
        borderRadius: 14,
        color: C.text,
      },
    }),
    React.createElement('span', {
      style: {
        position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
        fontSize: 16, fontWeight: 700, color: C.hint,
      },
    }, currency || 'RSD')
  );
}

// ── Screens ───────────────────────────────────────────────────────────────────

function Splash({ msg, isError }) {
  return React.createElement('div', {
    style: {
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: 24, gap: 16, textAlign: 'center',
    },
  },
    React.createElement('div', { style: { fontSize: 52 } }, isError ? '⚠️' : '⏳'),
    React.createElement('div', {
      style: { fontSize: 16, color: isError ? C.danger : C.hint, lineHeight: 1.5 },
    }, msg)
  );
}

function VenueScreen({ merchant, onSelect }) {
  const venues = merchant.venues;
  return React.createElement('div', { style: { padding: 20 } },
    React.createElement('div', { style: { marginBottom: 20 } },
      React.createElement('div', { style: { fontSize: 22, fontWeight: 800, marginBottom: 4 } },
        '🏪 ' + merchant.name),
      React.createElement('div', { style: { fontSize: 14, color: C.hint } },
        'Выберите заведение')
    ),
    venues.length === 0
      ? React.createElement(Card, null,
          React.createElement('div', { style: { color: C.hint, textAlign: 'center', fontSize: 14 } },
            'Нет активных заведений. Обратитесь в поддержку ayoo.'))
      : venues.map(v =>
          React.createElement(Card, { key: v.id, style: { cursor: 'pointer' } },
            React.createElement('button', {
              onClick: () => onSelect(v),
              style: {
                width: '100%', background: 'none', textAlign: 'left',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              },
            },
              React.createElement('div', null,
                React.createElement('div', { style: { fontWeight: 700, fontSize: 16 } }, v.name),
                React.createElement('div', { style: { fontSize: 13, color: C.hint, marginTop: 2 } },
                  v.pointsPerCurrency
                    ? '1 ' + (v.currency || 'RSD') + ' = ' + v.pointsPerCurrency + ' pts'
                    : 'Ставка не установлена')
              ),
              React.createElement('div', { style: { fontSize: 22 } }, '›')
            )
          )
        )
  );
}

function ActionScreen({ token, merchant, venue, onBack }) {
  const [mode, setMode] = useState('home');
  const [manualCode, setManualCode] = useState('');
  const [customer, setCustomer] = useState(null);
  const [amount, setAmount] = useState('');
  const [points, setPoints] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  function reset() {
    setMode('home');
    setManualCode('');
    setCustomer(null); setAmount(''); setPoints('');
    setError(''); setResult(null);
  }

  function scanQr() {
    if (tg?.showScanQrPopup) {
      tg.showScanQrPopup({ text: 'Отсканируйте QR-код клиента ayoo' }, raw => {
        tg.closeScanQrPopup?.();
        const match = raw.match(/ayoo:\\/\\/user\\/([A-Z0-9]+)/i) || raw.match(/^([A-Z0-9]{4,12})$/i);
        if (match) resolveCode(match[1]);
        else { setError('Неверный QR-код ayoo'); setMode('home'); }
        return true;
      });
    } else {
      setError('Сканер QR недоступен — введите код вручную');
    }
  }

  async function resolveCode(referralCode) {
    setError(''); setLoading(true);
    try {
      const data = await trpcQuery(token, 'merchant.resolveCustomer',
        { referralCode: referralCode.toUpperCase() });
      setCustomer(data);
      setMode('choose-action');
    } catch (e) {
      setError(e.message);
      setMode('home');
    } finally { setLoading(false); }
  }

  async function awardPoints() {
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true); setError('');
    try {
      const res = await trpcMutate(token, 'transaction.partnerPurchase', {
        userId: customer.userId,
        venueId: venue.id,
        amount: parseFloat(amount),
        currency: venue.currency || 'RSD',
      });
      setResult({ type: 'earn', points: res.pointsEarned, newBalance: null, name: customer.name });
      setMode('result');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function redeemPoints() {
    const pts = parseInt(points);
    if (!pts || pts <= 0) return;
    if (pts > customer.totalPoints) { setError('Недостаточно баллов'); return; }
    setLoading(true); setError('');
    try {
      const res = await trpcMutate(token, 'merchant.redeemPoints', {
        userId: customer.userId,
        venueId: venue.id,
        points: pts,
      });
      setResult({ type: 'redeem', points: pts, newBalance: res.newBalance, name: customer.name });
      setMode('result');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  if (loading) return React.createElement(Splash, { msg: 'Загрузка…' });

  const Header = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px 8px', marginBottom: 4 },
  },
    React.createElement('button', {
      onClick: mode === 'home' ? onBack : reset,
      style: { background: 'none', fontSize: 22, color: C.accent, padding: '2px 6px' },
    }, '‹'),
    React.createElement('div', null,
      React.createElement('div', { style: { fontWeight: 800, fontSize: 16 } }, venue.name),
      React.createElement('div', { style: { fontSize: 12, color: C.hint } }, merchant.name)
    )
  );

  if (mode === 'home') return React.createElement('div', { style: { padding: '0 0 32px' } },
    Header,
    React.createElement('div', { style: { padding: '0 20px' } },
      error && React.createElement('div', {
        style: { background: '#fee2e2', color: C.danger, borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: 13 },
      }, error),
      React.createElement(Btn, { label: '📷 Сканировать QR клиента', onClick: scanQr }),
      React.createElement('div', { style: { textAlign: 'center', color: C.hint, fontSize: 13, margin: '12px 0' } }, 'или введите код вручную'),
      React.createElement('div', { style: { display: 'flex', gap: 8 } },
        React.createElement('input', {
          value: manualCode,
          onChange: e => setManualCode(e.target.value.toUpperCase()),
          placeholder: 'AYOO1',
          maxLength: 12,
          style: {
            flex: 1, padding: '14px', background: C.bgSec, borderRadius: 14,
            fontSize: 18, fontWeight: 700, letterSpacing: 4, color: C.text, textAlign: 'center',
          },
        }),
        React.createElement(Btn, {
          label: '→', onClick: () => manualCode.trim() && resolveCode(manualCode.trim()),
          small: true, disabled: !manualCode.trim(),
        })
      )
    )
  );

  if (mode === 'choose-action') return React.createElement('div', { style: { padding: '0 0 32px' } },
    Header,
    React.createElement('div', { style: { padding: '0 20px' } },
      React.createElement(Card, null,
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
          React.createElement('div', { style: { fontSize: 40 } }, '👤'),
          React.createElement('div', null,
            React.createElement('div', { style: { fontWeight: 800, fontSize: 18 } }, customer.name),
            React.createElement('div', { style: { fontSize: 15, color: C.accent, fontWeight: 700, marginTop: 2 } },
              customer.totalPoints.toLocaleString() + ' pts')
          )
        )
      ),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 } },
        React.createElement('button', {
          onClick: () => setMode('confirm-earn'),
          style: { background: C.bgSec, borderRadius: 18, padding: '20px 12px', textAlign: 'center', border: '2px solid transparent' },
        },
          React.createElement('div', { style: { fontSize: 36, marginBottom: 8 } }, '➕'),
          React.createElement('div', { style: { fontWeight: 700, fontSize: 15 } }, 'Начислить'),
          React.createElement('div', { style: { fontSize: 12, color: C.hint, marginTop: 4 } }, 'Клиент сделал покупку')
        ),
        React.createElement('button', {
          onClick: () => customer.totalPoints > 0 ? setMode('confirm-redeem') : setError('У клиента нет баллов'),
          style: { background: C.bgSec, borderRadius: 18, padding: '20px 12px', textAlign: 'center', border: '2px solid transparent' },
        },
          React.createElement('div', { style: { fontSize: 36, marginBottom: 8 } }, '💸'),
          React.createElement('div', { style: { fontWeight: 700, fontSize: 15 } }, 'Списать'),
          React.createElement('div', { style: { fontSize: 12, color: C.hint, marginTop: 4 } }, 'Клиент платит баллами')
        )
      ),
      error && React.createElement('div', {
        style: { background: '#fee2e2', color: C.danger, borderRadius: 12, padding: '10px 14px', marginTop: 12, fontSize: 13 },
      }, error)
    )
  );

  if (mode === 'confirm-earn') return React.createElement('div', { style: { padding: '0 0 32px' } },
    Header,
    React.createElement('div', { style: { padding: '0 20px' } },
      React.createElement('div', { style: { fontWeight: 700, fontSize: 16, marginBottom: 4 } }, '➕ Начислить баллы'),
      React.createElement('div', { style: { fontSize: 13, color: C.hint, marginBottom: 16 } },
        'Сумма покупки — ' + customer.name),
      React.createElement(AmountInput, { value: amount, onChange: setAmount, currency: venue.currency || 'RSD' }),
      amount && parseFloat(amount) > 0 && venue.pointsPerCurrency &&
        React.createElement(Card, null,
          React.createElement('div', { style: { fontSize: 14, color: C.hint } }, 'Будет начислено'),
          React.createElement('div', { style: { fontSize: 28, fontWeight: 800, color: C.green } },
            '+' + Math.floor(parseFloat(amount) * venue.pointsPerCurrency) + ' pts')
        ),
      error && React.createElement('div', {
        style: { background: '#fee2e2', color: C.danger, borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: 13 },
      }, error),
      React.createElement(Btn, {
        label: 'Подтвердить покупку', onClick: awardPoints,
        disabled: !amount || parseFloat(amount) <= 0,
      })
    )
  );

  if (mode === 'confirm-redeem') return React.createElement('div', { style: { padding: '0 0 32px' } },
    Header,
    React.createElement('div', { style: { padding: '0 20px' } },
      React.createElement('div', { style: { fontWeight: 700, fontSize: 16, marginBottom: 4 } }, '💸 Списать баллы'),
      React.createElement('div', { style: { fontSize: 13, color: C.hint, marginBottom: 16 } },
        customer.name + ' — ' + customer.totalPoints.toLocaleString() + ' pts'),
      React.createElement('div', { style: { position: 'relative', marginBottom: 16 } },
        React.createElement('input', {
          type: 'number', inputMode: 'numeric', value: points,
          onChange: e => setPoints(e.target.value), placeholder: '0',
          style: { width: '100%', fontSize: 32, fontWeight: 800, padding: '14px 70px 14px 16px', background: C.bgSec, borderRadius: 14, color: C.text },
        }),
        React.createElement('span', {
          style: { position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: C.hint },
        }, 'pts')
      ),
      parseInt(points) > customer.totalPoints &&
        React.createElement('div', { style: { color: C.danger, fontSize: 13, marginBottom: 12 } },
          '⚠️ Превышает баланс ' + customer.totalPoints + ' pts'),
      error && React.createElement('div', {
        style: { background: '#fee2e2', color: C.danger, borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: 13 },
      }, error),
      React.createElement(Btn, {
        label: 'Подтвердить списание', onClick: redeemPoints, color: '#7c3aed',
        disabled: !points || parseInt(points) <= 0 || parseInt(points) > customer.totalPoints,
      })
    )
  );

  if (mode === 'result' && result) return React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '0 24px', textAlign: 'center' },
  },
    React.createElement('div', { style: { fontSize: 72, marginBottom: 16 } }, result.type === 'earn' ? '✅' : '💜'),
    React.createElement('div', { style: { fontSize: 24, fontWeight: 800, marginBottom: 8 } },
      result.type === 'earn' ? 'Баллы начислены!' : 'Баллы списаны!'),
    React.createElement('div', { style: { fontSize: 44, fontWeight: 900, color: result.type === 'earn' ? C.green : '#7c3aed', marginBottom: 8 } },
      (result.type === 'earn' ? '+' : '-') + result.points + ' pts'),
    React.createElement('div', { style: { fontSize: 15, color: C.hint, marginBottom: 32 } }, result.name),
    result.newBalance !== null &&
      React.createElement('div', { style: { fontSize: 14, color: C.hint, marginBottom: 20 } },
        'Новый баланс: ' + result.newBalance.toLocaleString() + ' pts'),
    React.createElement(Btn, { label: 'Следующий клиент', onClick: reset })
  );

  return null;
}

function App() {
  const [state, setState] = useState('loading');
  const [auth, setAuth] = useState(null);
  const [venue, setVenue] = useState(null);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    tg?.ready();
    tg?.expand();
    telegramAuth()
      .then(data => {
        setAuth(data);
        if (data.merchant.venues.length === 1) {
          setVenue(data.merchant.venues[0]);
          setState('action');
        } else {
          setState('venue');
        }
      })
      .catch(e => { setErrMsg(e.message); setState('error'); });
  }, []);

  if (state === 'loading') return React.createElement(Splash, { msg: 'Авторизация…' });
  if (state === 'error')   return React.createElement(Splash, { msg: errMsg, isError: true });
  if (state === 'venue')   return React.createElement(VenueScreen, {
    merchant: auth.merchant,
    onSelect: v => { setVenue(v); setState('action'); },
  });
  if (state === 'action')  return React.createElement(ActionScreen, {
    token: auth.token, merchant: auth.merchant, venue,
    onBack: () => { setVenue(null); setState(auth.merchant.venues.length === 1 ? 'venue' : 'venue'); },
  });
  return null;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));

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
