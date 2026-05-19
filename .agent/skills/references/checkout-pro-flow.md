# Checkout Pro — Flujo end-to-end

```
[Frontend]  POST /api/payments/mercadopago/create-preference  (bookingId u orderId)
    │
    ▼
[Cloud Function]  handleCreatePreference
    1. valida bookingId con Zod
    2. lee booking de Firestore  → guard: status === 'pending' & no expirado
    3. createMercadoPagoPreference()      ← MercadoPagoConfig NUEVO
    4. persiste mercadopago.preferenceId, mercadopago.initPoint, paymentMethod='mercadopago'
    5. responde { initPoint, sandboxInitPoint, preferenceId }
    │
    ▼
[Frontend]  window.location.href = initPoint    (NUNCA sandboxInitPoint)
    │
    ▼
[MercadoPago Checkout Pro]   usuario paga
    │
    ├──► [Browser] redirige a back_urls.success/failure/pending
    │       └─► /confirmation/:bookingId muestra estado optimista (NO confirma sin webhook)
    │
    └──► [Webhook]  POST /api/webhooks/mercadopago      (notification_url)
              1. rate limit por IP (30/min)
              2. validateMercadoPagoSignature (HMAC) — non-blocking
              3. extrae type + data.id (V1 ?id=&topic= o V2 ?data.id=&type=)
              4. claim atómico en webhookEvents/mp_<type>_<id>
              5. switch(type):
                   - payment              → handlePaymentNotification
                   - topic_claims_*       → handleClaimNotification
                   - topic_chargebacks_wh → handleChargebackNotification
                   - stop_delivery_op_wh  → handleFraudAlert
              6. payment.get({ id })  ← verificación contra API MP
              7. terminal-state guard (confirmed/cancelled/refunded → skip)
              8. expiration check
              9. amount verification con tolerancia
              10. reserveDatesWithTransaction (Apex) / stock decrement (Smart Choice)
              11. update booking/order → status=confirmed/paid + paymentConversion
              12. sendBookingEmails / notifyPaymentSuccess
              13. eventRef.update({ processed:true })
              14. responde 200/500 según error class
```

## Por qué dos canales (back_url + webhook)

- **back_url** es UI, NO confirma nada. El usuario puede cerrar la ventana antes; el navegador puede perder la conexión. La página de confirmación debe mostrar "estamos verificando tu pago" hasta que el webhook actualice Firestore (con polling o `onSnapshot`).
- **webhook** es source of truth. Es el único que muta estado real (`status`, `datesReserved`, stock).

## Verify-token (Apex)

Apex agrega `&vt=<jwt>` al `back_url` para que la página de confirmación pueda llamar a `/api/payments/mercadopago/verify-payment` sin auth de usuario, pero con anti-tampering. JWT corto (5 min) firmado con secret server-side. Ver `verify-token.ts`. No es estrictamente necesario si la página requiere auth Firebase.
