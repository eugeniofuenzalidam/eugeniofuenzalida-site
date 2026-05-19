# Webhook handler — anatomía completa

## Esqueleto

```ts
export async function handleMercadoPagoWebhook(req, res) {
  // 0. Rate limit por IP (30/min in-memory con cleanup periódico)
  if (!checkMpWebhookRateLimit(clientIP))
    return res.status(429).send("Too many requests");

  // 1. Early reject si no hay payment id
  const earlyId = req.query["data.id"] || req.query.id || req.body?.data?.id;
  if (!earlyId && !req.query.topic)
    return res.status(400).send("Missing payment ID");

  try {
    // 2. Validar firma (non-blocking en Cloud Run)
    if (process.env.MERCADOPAGO_WEBHOOK_SECRET) {
      const sig = validateMercadoPagoSignature(
        req,
        process.env.MERCADOPAGO_WEBHOOK_SECRET,
      );
      if (!sig.valid)
        console.warn("[MP] Signature failed, proceeding:", sig.error);
    }

    // 3. Normalizar V1 / V2
    const type = req.body?.type || req.query.type || req.query.topic;
    const id = req.body?.data?.id
      ? String(req.body.data.id)
      : req.query["data.id"] || req.query.id;
    if (!type || !id)
      return res.status(400).json({ error: "Invalid webhook format" });

    // 4. Idempotencia atómica
    const eventRef = db.collection("webhookEvents").doc(`mp_${type}_${id}`);
    const claim = await db.runTransaction(async (tx) => {
      /* ver SKILL.md */
    });
    if (claim !== "claimed")
      return res.status(200).json({ received: true, duplicate: true });

    // 5. Routing
    switch (type) {
      case "payment":
        await handlePaymentNotification(db, id, req.body?.action || "");
        break;
      case "topic_claims_integration_wh":
        await handleClaimNotification(db, id, "");
        break;
      case "topic_chargebacks_wh":
        await handleChargebackNotification(db, id, "");
        break;
      case "stop_delivery_op_wh":
        await handleFraudAlert(db, id, "");
        break;
      default:
        console.log("[MP] Unhandled type", type);
    }

    // 6. Marcar procesado
    await eventRef.update({
      processed: true,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(200).json({ received: true });
  } catch (err) {
    classifyAndRespond(err, res); // transient → 500, permanent → 200
  }
}
```

## handlePaymentNotification — secuencia obligatoria

1. `payment.get({ id })` — fuente de verdad del estado.
2. Resolver `bookingId = paymentInfo.external_reference || paymentInfo.metadata?.bookingId`.
3. Cargar booking; si no existe y `status==='approved'` → `initiateAutoRefund(reason:'Booking not found')`.
4. Terminal-state guard: si booking ya está `confirmed|cancelled|refunded` → skip.
5. Expiration check: si `booking.expiresAt < now` y pago aprobado → auto-refund.
6. Mapear `paymentInfo.status` → `paymentStatus + bookingStatus`:

   | MP status                     | paymentStatus | bookingStatus | Acción extra                        |
   | ----------------------------- | ------------- | ------------- | ----------------------------------- |
   | approved                      | succeeded     | confirmed     | reservar fechas + sync Guesty       |
   | rejected/cancelled            | failed        | (sin cambio)  | permitir reintentar                 |
   | refunded                      | refunded      | refunded      | release availability + notify admin |
   | charged_back                  | disputed      | disputed      | notify admin, NO liberar            |
   | in_mediation                  | in_mediation  | disputed      | notify admin                        |
   | pending/in_process/authorized | pending       | (sin cambio)  | esperar                             |

7. Amount verification (ver `currency-conversion.md`). Mismatch → auto-refund.
8. Si `approved` y `!booking.datesReserved`: `reserveDatesWithTransaction()` (Apex) o `decrementStock()` (Smart Choice). Si falla → auto-refund con motivo.
9. Crear/actualizar `payments/mp_<paymentId>` con conversion data.
10. Update booking: `status`, `datesReserved`, `paymentConversion`, `confirmedAt`.
11. Side effects: emails (Resend), WhatsApp (Evolution API), Guesty sync. Cada uno en try/catch independiente — un fallo en email NO debe bloquear el webhook.

## Clasificación de errores

```ts
const transientPatterns = [
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ECONNRESET",
  "EPIPE",
  "EAI_AGAIN",
  "DEADLINE_EXCEEDED",
  "UNAVAILABLE",
  "RESOURCE_EXHAUSTED",
  "INTERNAL",
  "socket hang up",
  "network",
  "timeout",
  "firestore",
  "ABORTED",
];
const isTransient = transientPatterns.some(
  (p) =>
    errMsg.toUpperCase().includes(p.toUpperCase()) ||
    errCode.toString().toUpperCase().includes(p.toUpperCase()),
);
res
  .status(isTransient ? 500 : 200)
  .json({ received: true, error: errMsg, retryable: isTransient });
```

MP reintenta agresivamente. Devolver 500 a errores permanentes (booking no existe, monto inválido) genera tormenta de retries inútiles. Devolver 200 a errores transitorios pierde el evento.

## Sanitización de logs (CWE-117)

Antes de loguear `type`/`id`/`action`, reemplazar caracteres no `[\w.-]` por `_`. Evita log injection si el atacante manda `type` con newlines/escape codes.

## Cleanup del rate-limiter map

```ts
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of mpWebhookRateLimit.entries())
    if (now > v.resetAt) mpWebhookRateLimit.delete(k);
}, 30000);
```

Sin esto, el Map crece infinitamente con IPs únicas → memory leak en función de larga vida.
