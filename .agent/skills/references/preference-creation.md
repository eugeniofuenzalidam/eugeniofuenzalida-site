# Creación de preferencia — detalles

## Validación con Zod (Apex)

```ts
const createPreferenceSchema = z
  .object({
    bookingId: z.string().min(1).max(256),
  })
  .strict();

const parsed = createPreferenceSchema.safeParse(req.body);
if (!parsed.success)
  return res
    .status(400)
    .json({ success: false, error: "Invalid request data" });
```

NO devolver el detalle del Zod error al cliente — leak de schema interno.

## Items: precio entero CLP

MP rechaza decimales en CLP. Siempre `Math.round(amount)`. Si tu booking está en USD:

```ts
const rate = booking.exchangeRate?.usdToClp || FALLBACK_USD_TO_CLP;
const amountCLP = Math.round(booking.totalAmount * rate);
```

Congelá el `rate` en el booking al momento de crear preferencia para que el webhook compare contra el mismo número (Apex usa `paymentConversion.exchangeRate`).

## Items multi-línea (Smart Choice)

```js
const mpItems = order.items.map((i) => ({
  id: i.productId,
  title: i.name.substring(0, 256), // MP corta a 256
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
// Sanity check
const mpTotal = mpItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
if (mpTotal !== order.total)
  throw new HttpsError("internal", "Error de consistencia en el total");
```

Esa última aserción atrapa bugs de pricing antes de que MP cobre un monto distinto al esperado.

## payer

```ts
payer: payerEmail ? { email: payerEmail } : undefined;
```

Smart Choice agrega phone con normalización chilena:

```js
phone: { area_code: '56', number: order.customerPhone.replace(/\D/g,'').slice(-9) }
```

NO incluyas `name` con caracteres acentuados sin sanitizar — MP a veces los rechaza.

## back_urls

Deben ser HTTPS en producción y deben coincidir EXACTAMENTE con el dominio de la app (MP valida). En dev local, usá ngrok o similar — `localhost` no funciona.

```
success / failure / pending
```

`auto_return: 'approved'` redirige automáticamente sólo en aprobado; los demás casos quedan en la página intermedia de MP hasta que el usuario haga click.

## notification_url

URL pública de tu webhook. Apex usa Cloud Run (`api-XXX-uc.a.run.app`), Smart Choice usa Cloud Functions clásico (`us-central1-PROJECT.cloudfunctions.net/paymentWebhook`). Configurá también el webhook en el panel de MP (**Pagos** topic mínimo, agregar **Alertas de fraude** y **Chargebacks** si tu negocio los maneja).

## idempotencyKey

```js
{
  requestOptions: {
    idempotencyKey: orderId;
  }
}
```

Si tu cliente reintenta `createPaymentPreference` para la misma orden, MP devuelve la misma preferencia en lugar de crear una segunda. Smart Choice lo usa; Apex aún no — agregalo.

## Persistir en Firestore

```ts
await bookingRef.update({
  "mercadopago.preferenceId": result.id,
  "mercadopago.createdAt": admin.firestore.FieldValue.serverTimestamp(),
  "mercadopago.initPoint": result.initPoint,
  paymentMethod: "mercadopago",
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});
```

Smart Choice:

```js
await db
  .collection("orders")
  .doc(orderId)
  .update({ mpPreferenceId: result.id, updatedAt: new Date().toISOString() });
```
