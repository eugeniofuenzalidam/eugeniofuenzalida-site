# Conversión de moneda (USD↔CLP) y verificación de monto

Aplica principalmente a **Apex** (booking en USD, cobro CLP). Smart Choice es 100% CLP — para él, alcanza con comparar montos directamente con tolerancia 1%.

## Tipo de cambio congelado

Al crear preferencia, congelá el rate en el booking:

```ts
const { rate, source } = await getExchangeRateOrDefault(db);
const amountCLP = Math.round(booking.totalAmount * rate);
await bookingRef.update({
  paymentConversion: { exchangeRate: rate, source, frozenAt: admin.firestore.FieldValue.serverTimestamp() },
});
```

Fuentes en orden de preferencia:
1. API del Banco Central (cron diario que escribe a `systemConfig/exchangeRate`).
2. Cache de Firestore (TTL 24h).
3. `FALLBACK_USD_TO_CLP` hardcoded (último recurso, log warning).

## Verificación en webhook

```ts
const bookingTotal = booking.totalAmount;
const bookingCurrency = booking.currency?.toUpperCase() || 'CLP';
const paidAmount = paymentInfo.transaction_amount || 0;
const paidCurrency = paymentInfo.currency_id?.toUpperCase() || 'CLP';

const frozenRate = booking?.paymentConversion?.exchangeRate;
let expectedAmount, tolerancePercent;

if (bookingCurrency === paidCurrency) {
  expectedAmount = bookingTotal;
  tolerancePercent = 0.01;
} else if (bookingCurrency === 'USD' && paidCurrency === 'CLP') {
  const rate = frozenRate || (await getExchangeRateOrDefault(db)).rate;
  expectedAmount = bookingTotal * rate;
  tolerancePercent = frozenRate ? 0.03 : 0.05;
} else if (bookingCurrency === 'CLP' && paidCurrency === 'USD') {
  const rate = frozenRate || (await getExchangeRateOrDefault(db)).rate;
  expectedAmount = bookingTotal / rate;
  tolerancePercent = frozenRate ? 0.03 : 0.05;
} else {
  // par desconocido
  const rate = frozenRate || (await getExchangeRateOrDefault(db)).rate;
  expectedAmount = bookingTotal * rate;
  tolerancePercent = 0.10;
  console.warn('[MP] Unknown currency pair', { bookingCurrency, paidCurrency });
}

const tolerance = Math.max(1, expectedAmount * tolerancePercent);
if (Math.abs(paidAmount - expectedAmount) > tolerance) {
  await initiateAutoRefund(db, paymentInfo, bookingRef, bookingId, 'Amount mismatch');
  return;
}
```

## paymentConversion en Firestore

```ts
{
  bookingCurrency: 'USD',
  bookingAmount: 350.00,
  chargedCurrency: 'CLP',
  chargedAmount: 332500,
  exchangeRate: 950,
  rateSource: 'banco-central',
  frozenAt: <Timestamp>,
}
```

Estos datos hidratan el email de confirmación y la página de booking detail.

## Display

- Email/UI mostrando lo cobrado: `formatCLP(chargedAmount)` → `$332.500` (sin sufijo "CLP" — el usuario lo pidió explícito).
- Email mostrando equivalencia: `$350.00 USD ≈ $332.500` con línea de tipo de cambio `1 USD = $950` debajo.
- En `MercadoPagoCheckout.tsx` (Apex) hay un componente "conversion card" con tres filas: USD, rate, CLP. Es el patrón canónico.

## Cuándo NO congelar

Pagos instantáneos (<1 min entre preferencia y pago): el rate no se mueve materialmente, podés usar live. Pero si hay cualquier latencia (24h hold, payment links), **congelá siempre**.
