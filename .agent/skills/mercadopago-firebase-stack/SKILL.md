---
name: mercadopago-firebase-stack
description: Implementar, depurar o auditar integraciones de Mercado Pago Checkout Pro sobre Firebase Cloud Functions con Firestore, siguiendo los patrones reales en producción de Apex Experience (apexandes.com — bookings USD→CLP con Guesty) y Smart Choice (smartchoicetienda.cl — e-commerce CLP). Usar SIEMPRE este skill cuando el usuario mencione MercadoPago, MP, Checkout Pro, preferencia de pago, webhook MP, x-signature, paymentWebhook, IPN, refunds MP, cambiar entre cuentas test/producción, o cuando edite archivos `mercadopago/*.ts`, `paymentWebhook`, `createPaymentPreference`, o pase de Stripe a MP. También aplica a clones de estos stacks (Firebase Functions + Firestore + MP).
---

# Mercado Pago + Firebase Functions Stack

Skill operativo derivado de dos integraciones MP en producción que viven en este repositorio raíz:

- **Apex Experience** (`Apex-Experience/apex-next/`): Next.js 15 SSG + Cloud Functions v2 (TS) + Firestore. Bookings USD totalAmount → cobro CLP. Convive con Stripe. PMS Guesty.
- **Smart Choice** (`SMART CHOICE/`): React 18 + Vite + Cloud Functions v2 (JS) + Firestore. E-commerce 100% CLP, guest checkout, callable functions.

> **NO** se basa en Clínica Prisma (usa otra base de datos, fuera de alcance).

Estos dos stacks resolvieron los problemas reales de MP: race conditions del SDK, firmas HMAC rotas por Cloud Run, idempotencia, montos divergentes por tipo de cambio, sandbox roto, refunds, terminal-state guards, y muchos más. Cuando trabajes sobre cualquiera de los dos —o sobre un proyecto similar— sigue las reglas de abajo y consulta los archivos `references/` para profundizar.

---

## Cómo decidir qué leer

| Si el usuario… | Lee primero |
|---|---|
| pide implementar MP desde cero | `references/checkout-pro-flow.md` + `references/preference-creation.md` |
| edita o depura webhook | `references/webhook-handler.md` + `references/signature-validation.md` |
| reporta firma inválida / `Signature mismatch` | `references/signature-validation.md` |
| reporta orden en `pending` post-pago en sandbox | `references/sandbox-and-credentials.md` |
| pide refund / chargeback | `references/refunds-and-disputes.md` |
| necesita conversión USD→CLP o multi-currency | `references/currency-conversion.md` |
| pide rotar credenciales test ↔ prod | `references/sandbox-and-credentials.md` |

Mantén SKILL.md como mapa; el detalle vive en `references/`.

---

## Reglas de oro (no negociables)

### 1. Crea un `MercadoPagoConfig` NUEVO por cada llamada server-side
El SDK Node muta `this.config.options`. Compartir un singleton entre `Preference`, `Payment`, `PaymentRefund` produce race conditions silenciosas (idempotencyKeys cruzados, headers contaminados). Apex lo documenta como **FIX 45**.

```ts
export function createMercadoPagoClient() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!accessToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN not configured');
  return new MercadoPagoConfig({ accessToken, options: { timeout: 10000 } });
}
```

Smart Choice lo cachea porque sólo tiene 2 funciones; al pasar de 2 a 3+ usos del SDK, **migrá a per-call**.

### 2. Usa `initPoint`, NUNCA `sandboxInitPoint`
`sandboxInitPoint` está roto desde 2022 para Checkout Pro (issue público). Cuando el `MERCADOPAGO_ACCESS_TOKEN` corresponde a credenciales test, `initPoint` auto-rutea a sandbox. Dejá el campo `sandboxInitPoint` en la respuesta sólo para auditoría.

### 3. Verificá monto contra Firestore antes de confirmar
NO confíes en montos del frontend ni en el body del webhook. Cargá el booking/orden de Firestore, calculá el `expectedAmount` y comparalo con `paymentInfo.transaction_amount` con tolerancia:

| Caso | Tolerancia |
|---|---|
| Misma moneda | 1% |
| USD↔CLP con tipo de cambio congelado en booking | 3% |
| Cross-currency sin congelar | 5% |
| Par desconocido | 10% (warning) |

Si el monto NO coincide → `initiateAutoRefund()` y abortar.

### 4. Validá la firma HMAC con manifest exacto y `timingSafeEqual`
Manifest correcto (omitir campos ausentes): `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. **`data.id` SOLO desde query params** (`req.query['data.id']`), nunca desde el body — MP firma usando el query. Cloud Run a veces sobrescribe `x-request-id` y rompe el HMAC: cuando esto pase, **NO** rechaces el webhook; loguea warning y delegá la verificación en `payment.get({ id })` contra la API de MP. Ver `references/signature-validation.md`.

### 5. Idempotencia atómica con Firestore transaction
Reclamá `webhookEvents/mp_<type>_<id>` en una transaction:

```ts
const claim = await db.runTransaction(async tx => {
  const doc = await tx.get(eventRef);
  if (doc.exists && doc.data()?.processed === true) return 'already_processed';
  if (doc.exists && doc.data()?.claimedAt && Date.now() - doc.data().claimedAt.toMillis() < 5*60*1000)
    return 'claimed_by_other';
  tx.set(eventRef, { provider:'mercadopago', type, dataId:id, claimedAt: admin.firestore.Timestamp.now(), processed:false });
  return 'claimed';
});
if (claim !== 'claimed') return res.status(200).json({ received:true, duplicate:true });
```

V1 (`?id=&topic=`) y V2 (`?data.id=&type=`) deben compartir el mismo doc-id (no incluyas `requestId` en la clave).

### 6. Terminal-state guard
Antes de cualquier mutación, leé el booking/order y abortá si está en estado terminal: Apex `confirmed|cancelled|refunded`, Smart Choice `paid|shipped|delivered|cancelled`. Esto previene regresiones por reintentos del webhook.

### 7. Clasificación de errores → status code
- **Transitorios** (network, Firestore ABORTED, ETIMEDOUT, EAI_AGAIN, DEADLINE_EXCEEDED): responder **500** para que MP reintente.
- **Permanentes** (booking inexistente, validación fallida, formato inválido): responder **200** con `error` para que MP no reintente.

### 8. Rate limiting del webhook
30 req/min por IP en memoria con cleanup cada 30 s para evitar memory leak. MP normalmente envía ≤5/min; superar eso es DoS o loop.

### 9. `expires + expiration_date_to` 30 min
Toda preferencia debe expirar. Sin esto, links viejos pueden cobrar dobles.

### 10. `external_reference` = ID interno del booking/orden
Es la única forma confiable de mapear el pago a tu base. NO uses `metadata` para esto (puede no llegar en algunos eventos).

### 11. Display en CLP: sólo `$`, sin sufijo "CLP"
El usuario lo pidió explícito en sesiones previas. `formatPrice()` / `formatCLP()` devuelven `$1.234.567`, no `$1.234.567 CLP`.

### 12. Secrets en gestor — NUNCA en repos ni en docs
- Producción: Firebase Secret Manager (`firebase functions:secrets:set MP_ACCESS_TOKEN`).
- Local: `.env.local` (gitignored).
- Pre-commit hook bloquea patrones `APP_USR-*`. Si lo trippeás, usá gestor de contraseñas y documentá `(ver gestor)`.
- Para setear secrets usá **`printf`**, no `echo` — `echo` agrega `\n` que rompe el token.

---

## Plantilla de creación de preferencia (Checkout Pro)

```ts
const preferenceBody = {
  items: [{
    id: bookingId,                    // o orderId
    title: itemName.substring(0, 256),
    quantity: 1,
    unit_price: Math.round(amountCLP), // SIEMPRE entero CLP
    currency_id: 'CLP',
  }],
  payer: payerEmail ? { email: payerEmail } : undefined,
  back_urls: {
    success: `${baseUrl}/confirmation/${bookingId}?source=mercadopago&status=success`,
    failure: `${baseUrl}/booking?status=failure&bookingId=${bookingId}`,
    pending: `${baseUrl}/confirmation/${bookingId}?source=mercadopago&status=pending`,
  },
  auto_return: 'approved' as const,
  external_reference: bookingId,           // CRÍTICO
  notification_url: `${apiUrl}/api/webhooks/mercadopago`,
  statement_descriptor: 'APEX EXPERIENCE', // ≤22 chars, aparece en estado de cuenta
  expires: true,
  expiration_date_from: new Date().toISOString(),
  expiration_date_to: new Date(Date.now() + 30*60*1000).toISOString(),
  binary_mode: false,                      // permite pendientes (transferencia, etc.)
};

const result = await new Preference(createMercadoPagoClient()).create({
  body: preferenceBody,
  requestOptions: { idempotencyKey: bookingId }, // Smart Choice — previene duplicados en reintentos
});
```

Detalles, validación Zod, persistencia en Firestore: `references/preference-creation.md`.

---

## Estructura recomendada (TS, Apex-style)

```
functions/src/mercadopago/
├── index.ts          # re-exports públicos
├── preference.ts     # createMercadoPagoPreference + handleCreatePreference (POST handler)
├── webhooks.ts       # handleMercadoPagoWebhook (router por type) + handlePaymentNotification
├── signature.ts      # validateMercadoPagoSignature (HMAC-SHA256)
├── verify-token.ts   # JWT corto firmado para back_urls (anti-tampering del confirmation page)
└── __tests__/        # unit tests de signature y montos
```

Para JS callable-style (Smart Choice) ver `references/smart-choice-pattern.md`.

---

## Checklist al cerrar una tarea de MP

Antes de marcar completo verificá (mental o en TaskList):

- [ ] `MercadoPagoConfig` se crea por llamada en código nuevo
- [ ] `initPoint` (no `sandboxInitPoint`) en el redirect del frontend
- [ ] `external_reference` seteado al ID interno
- [ ] `notification_url` apunta al webhook correcto del entorno actual
- [ ] Webhook valida firma + idempotencia + monto + estado terminal
- [ ] Errores transitorios → 500; permanentes → 200
- [ ] Display de montos: sólo `$`, sin sufijo "CLP"
- [ ] Tests: firma válida + inválida + replay (>5 min) + idempotencia
- [ ] Si tocaste credenciales: secret seteado con `printf`, no `echo`
- [ ] Si es Apex: `firebase deploy --only hosting,functions` (ambos juntos por pinTag)
- [ ] Si es Smart Choice: `cd functions && npm install` antes del deploy si tocaste deps

---

## Variables de entorno mínimas

| Variable | Apex | Smart Choice | Notas |
|---|---|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | ✓ | `MP_ACCESS_TOKEN` | `APP_USR-...` (test o prod) |
| `MERCADOPAGO_WEBHOOK_SECRET` | ✓ | `MP_WEBHOOK_SECRET` | HMAC signing — sólo prod |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | ✓ | — | frontend, detectar `TEST-` mode |
| `NEXT_PUBLIC_SITE_URL` / `APP_URL` | ✓ | ✓ | base para `back_urls` |
| `FUNCTIONS_URL` | ✓ | hardcoded | base para `notification_url` |

---

## Referencias rápidas

- Docs MP: https://www.mercadopago.com/developers/en/docs/checkout-pro
- Webhook signing: https://www.mercadopago.com/developers/en/docs/your-integrations/notifications/webhooks
- Issue conocido SDK: https://github.com/mercadopago/sdk-nodejs/discussions/318 (Cloud Run reescribe `x-request-id`)
- Tarjetas test (Chile): `5416 7526 0258 2580` CVV `123` exp `11/30` nombre `APRO` → aprobada; nombre `OTHE` → rechazada.
