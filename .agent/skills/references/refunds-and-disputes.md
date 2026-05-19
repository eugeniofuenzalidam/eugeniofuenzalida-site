# Refunds, chargebacks y mediaciones

## PaymentRefund SDK

```ts
import { MercadoPagoConfig, PaymentRefund } from "mercadopago";

async function handleMercadoPagoRefund(paymentId: string, amount?: number) {
  const mpConfig = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
  });
  const refundClient = new PaymentRefund(mpConfig);
  const refund = await refundClient.create({
    payment_id: paymentId,
    body: amount ? { amount } : {}, // sin body = refund total
  });
  if (!refund.id) throw new Error("MP_EMPTY_RESPONSE");
  return refund;
}
```

**Crear `MercadoPagoConfig` propio** acá también — el SDK muta options entre clientes.

## Auto-refund triggers

Apex dispara `initiateAutoRefund()` automáticamente en webhook cuando:

- Booking no existe (`Booking not found`).
- Booking expirado al momento del cobro (`Booking expired before payment was processed`).
- Monto cobrado distinto del esperado (`Amount mismatch`).
- Falla la reserva atómica de fechas (`Dates no longer available`).

```ts
async function initiateAutoRefund(
  db,
  paymentInfo,
  bookingRef,
  bookingId,
  reason,
) {
  const refund = await new PaymentRefund(createMercadoPagoClient()).create({
    payment_id: paymentInfo.id,
    body: {},
  });
  await db.collection("refunds").doc(`mp_${refund.id}`).set({
    paymentId: paymentInfo.id,
    bookingId,
    amount: paymentInfo.transaction_amount,
    currency: paymentInfo.currency_id,
    reason,
    provider: "mercadopago",
    status: "created",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await bookingRef.update({ status: "refunded", refundReason: reason });
  // notificar admin (Resend) para investigación
}
```

## Refund manual desde admin

Endpoint `/api/admin/refunds` con auth de admin → llama al mismo `handleMercadoPagoRefund`. Razón obligatoria.

Importante: NO permitir refund parcial sin que el flujo downstream (Guesty, stock) lo soporte. Smart Choice marca `cancelled` y deja TODO de "restaurar stock".

## Webhook events de refund

MP envía `type: 'payment'` con `action: 'payment.updated'` y `paymentInfo.status: 'refunded'`. El handler genérico ya lo cubre — NO hace falta endpoint extra.

## Chargebacks (`topic_chargebacks_wh`)

```ts
async function handleChargebackNotification(db, chargebackId, action) {
  // buscar payment afectado vía external_reference / dispute API
  // marcar booking.status = 'disputed', shouldNotifyAdmin = true
  // NO liberar disponibilidad — el usuario sigue ocupando la reserva hasta resolver
}
```

Mediation (`in_mediation`) es similar pero el dinero todavía no se devolvió.

## Idempotencia de refunds

Documentar en `refunds/mp_<refundId>` y verificar antes de crear otro. Si el mismo webhook re-llega, el claim atómico lo bloquea.

## Casos edge

- **Refund creado pero webhook nunca llega**: cron job que reconcilia `payments` con MP API cada 6h.
- **Refund parcial seguido de total**: MP lo permite si el monto disponible cubre. No asumas que `refunded` = full refund — chequea `paymentInfo.transaction_amount_refunded`.
- **Refund de pago en `in_process`**: MP rechaza. Esperar a `approved` o `cancelled`.
