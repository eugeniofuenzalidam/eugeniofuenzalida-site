# Pattern Smart Choice (callable functions, JS)

Variante minimalista para e-commerce CLP-only sin Stripe ni multi-currency. Útil si arrancás un proyecto nuevo donde MP es el único gateway.

## Diferencias clave vs Apex

| Aspecto                  | Apex                         | Smart Choice                    |
| ------------------------ | ---------------------------- | ------------------------------- |
| Lenguaje                 | TypeScript                   | JavaScript                      |
| Funciones                | onRequest (Express-like)     | onCall + onRequest              |
| Auth checkout            | guest OK vía POST            | guest OK vía Callable (no auth) |
| MercadoPagoConfig        | per-call (FIX 45)            | cacheado (sólo 2 funciones)     |
| Verificación firma       | non-blocking (Cloud Run bug) | estricta (rechaza 401)          |
| Refund auto              | sí (auto-refund)             | TODO Fase 2                     |
| Multi-currency           | sí                           | no                              |
| Notificaciones post-pago | Resend + Guesty + Stripe     | Resend + Evolution WhatsApp     |

## createPaymentPreference (callable)

```js
exports.createPaymentPreference = onCall(
  { secrets: [mpAccessToken] },
  async (request) => {
    const token = mpAccessToken.value();
    if (!token || token === "PLACEHOLDER") {
      throw new HttpsError("unavailable", "Sistema de pago no configurado");
    }
    const { orderId } = request.data;
    if (!orderId) throw new HttpsError("invalid-argument", "orderId requerido");

    const orderSnap = await db.collection("orders").doc(orderId).get();
    if (!orderSnap.exists)
      throw new HttpsError("not-found", "Orden no encontrada");
    const order = orderSnap.data();
    if (order.status !== "pending")
      throw new HttpsError("failed-precondition", "Orden ya procesada");

    const mpItems = order.items.map((i) => ({
      id: i.productId,
      title: i.name.substring(0, 256),
      quantity: i.quantity,
      unit_price: Math.round(i.price),
      currency_id: "CLP",
      ...(i.image ? { picture_url: i.image } : {}),
    }));
    if (order.shippingCost > 0) {
      mpItems.push({
        id: "shipping",
        title: "Costo de despacho",
        quantity: 1,
        unit_price: Math.round(order.shippingCost),
        currency_id: "CLP",
      });
    }
    const mpTotal = mpItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    if (mpTotal !== order.total)
      throw new HttpsError("internal", "Error de consistencia en el total");

    const client = new MercadoPagoConfig({
      accessToken: token,
      options: { timeout: 10000 },
    });
    const result = await new Preference(client).create({
      body: {
        items: mpItems,
        payer: {
          name: order.customerName,
          email: order.customerEmail,
          ...(order.customerPhone
            ? {
                phone: {
                  area_code: "56",
                  number: order.customerPhone.replace(/\D/g, "").slice(-9),
                },
              }
            : {}),
        },
        back_urls: {
          success: `${APP_URL}/checkout/confirmacion`,
          failure: `${APP_URL}/checkout/error`,
          pending: `${APP_URL}/checkout/pendiente`,
        },
        auto_return: "approved",
        statement_descriptor: "SMARTCHOICE",
        notification_url: `https://us-central1-${PROJECT_ID}.cloudfunctions.net/paymentWebhook`,
        external_reference: orderId,
        expires: true,
        expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
      requestOptions: { idempotencyKey: orderId },
    });

    await db.collection("orders").doc(orderId).update({
      mpPreferenceId: result.id,
      updatedAt: new Date().toISOString(),
    });

    return {
      preferenceId: result.id,
      initPoint: result.init_point,
      sandboxInitPoint: result.sandbox_init_point,
    };
  },
);
```

## paymentWebhook (onRequest)

```js
exports.paymentWebhook = onRequest(
  {
    secrets: [
      mpAccessToken,
      mpWebhookSecret,
      resendApiKey,
      evolutionApiKey,
      evolutionApiUrl,
    ],
  },
  async (req, res) => {
    if (req.method !== "POST")
      return res.status(405).send("Method Not Allowed");

    if (!validateWebhookSignature(req, mpWebhookSecret.value())) {
      return res.status(401).send("Invalid signature");
    }

    res.status(200).send("OK"); // responder rápido, procesar después

    const { type, data } = req.body;
    if (type !== "payment" || !data?.id) return;

    const paymentId = String(data.id);
    const client = new MercadoPagoConfig({
      accessToken: mpAccessToken.value(),
    });
    const payment = await new Payment(client).get({ id: paymentId });

    const { status, external_reference: orderId } = payment;
    if (!orderId) return;

    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return;

    const TERMINAL = ["paid", "shipped", "delivered", "cancelled"];
    if (TERMINAL.includes(orderSnap.data().status)) return;

    const update = {
      mpPaymentStatus: status,
      updatedAt: new Date().toISOString(),
    };
    if (status === "approved") {
      update.status = "paid";
      update.paymentId = paymentId;
    } else if (status === "refunded" || status === "charged_back") {
      update.status = "cancelled";
    }

    await orderRef.update(update);
    if (status === "approved")
      await notifyPaymentSuccess(orderId, { ...orderSnap.data(), ...update });
  },
);
```

## Detalles importantes

- **Responder 200 inmediato** después de validar firma y procesar luego. MP timeoutea a los 22 s; si tu lógica downstream (emails, WhatsApp) demora, el webhook reintenta innecesariamente.
- **Idempotencia**: este patrón confía en el terminal-state guard. Es suficiente para e-commerce simple. Si tenés side-effects no idempotentes (pagos a proveedores, etc.), agregá el patrón de `webhookEvents` de Apex.
- **Guard PLACEHOLDER** en secrets: permite deploy con credenciales vacías (ej. ambiente staging recién creado) sin que la función falle.
- **`encodeURIComponent` en path params** de Evolution API y similares — la instancia "Maria Jose" tiene espacio.

## Cuando upgrade-ar a Apex pattern

Migrá a `webhookEvents` + per-call config + auto-refund cuando:

- Aparezca un segundo gateway (Stripe, etc.).
- Hagas multi-currency.
- Tengas más de 2 helpers que usen MP SDK.
- Necesites trazabilidad de cada evento (auditoría/PCI).
