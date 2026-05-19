# Validación de firma HMAC

## Manifest exacto

MP firma el string:
```
id:<data.id>;request-id:<x-request-id>;ts:<ts>;
```

**Reglas**:
- `data.id` viene **SOLO del query string** (`req.query['data.id']`). Si no llega por query, **omitir** el segmento `id:` del manifest. NUNCA usar `body.data.id` — produce manifest distinto.
- Omitir cualquier segmento ausente. Mantener el orden y el `;` final.
- `ts` se firma como string (no parseado).

```ts
const dataId = req.query?.['data.id'] || req.query?.data?.id || req.query?.id;
const parts: string[] = [];
if (dataId) parts.push(`id:${dataId}`);
if (req.headers['x-request-id']) parts.push(`request-id:${req.headers['x-request-id']}`);
parts.push(`ts:${ts}`);
const manifest = parts.join(';') + ';';

const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
const isValid = crypto.timingSafeEqual(Buffer.from(expected,'hex'), Buffer.from(receivedHash,'hex'));
```

## Replay attack prevention

```ts
const tsNum = parseInt(timestamp);
const tsMs = tsNum > 1e12 ? tsNum : tsNum * 1000;
if (Date.now() - tsMs > 5*60*1000) return { valid:false, error:'Timestamp too old' };
```

MP envía `ts` en milisegundos según docs oficiales actuales, pero hay clientes legacy que mandan segundos. El check `>1e12` los soporta a ambos.

## Cloud Run reescribe x-request-id (BUG conocido)

Apex documenta: Cloud Run a veces sobrescribe `x-request-id` en transit, rompiendo el HMAC aunque el secret y el timestamp sean correctos. **No hardcodear rechazo** — degradar gracefully:

```ts
const sigResult = validateMercadoPagoSignature(req, webhookSecret);
if (!sigResult.valid) {
  console.warn(`[MP Webhook] Signature failed: ${sigResult.error} — proceeding with API verification`);
  // continuar; payment.get({id}) contra MP API es la verificación real de autenticidad
}
```

La seguridad real está en `paymentInfo = await new MPPayment(client).get({ id })` — sólo MP responde con datos válidos a esa llamada con tu access token. Un atacante no puede falsificar la respuesta de `payment.get()`.

## Smart Choice variante (firma estricta)

Smart Choice **sí** rechaza con 401 si la firma falla, porque su deploy es Cloud Functions clásico (no Cloud Run) y no sufre el bug del header. Si copias ese patrón a Cloud Run, vas a perder webhooks legítimos.

## Debug logging

Cuando la firma falla en producción, loguear (sin exponer el secret):
```ts
console.error('[MP Webhook] Signature mismatch', {
  manifest,
  expectedPrefix: expected.substring(0,16) + '...',
  receivedPrefix: receivedHash.substring(0,16) + '...',
  queryKeys: Object.keys(req.query || {}),
  bodyDataId: req.body?.data?.id,
  dataIdUsed: dataId,
  secretLength: secret.length,
});
```

Pistas comunes:
- `secretLength` 0 → secret vacío en producción.
- `bodyDataId !== dataIdUsed` → estás firmando con body en vez de query.
- `manifest` contiene `id:undefined` → MP no envió data.id por query, omitilo.
