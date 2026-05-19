# Sandbox, credenciales y rotación test ↔ prod

## Por qué `TEST-` no sirve para Checkout Pro

Checkout Pro requiere **cuentas test reales** (seller + buyer) creadas desde el panel de MP, NO los tokens `TEST-` que ofrece la doc para Bricks/Payments API. Usar `TEST-...` con Checkout Pro produce 401 o redirect a login real.

Pasos:

1. Panel MP → Tu integración → **Cuentas de prueba** → crear seller test + buyer test.
2. Cargá saldo en la cuenta del comprador (botón "Cargar dinero" en cuenta test). Sin saldo, los pagos fallan.
3. Copiá el access token del **seller test** (formato `APP_USR-...`, no `TEST-...`).
4. Setealo: `printf "APP_USR-..." | firebase functions:secrets:set MP_ACCESS_TOKEN`.
5. Frontend usa `initPoint` (NUNCA `sandboxInitPoint`). MP auto-rutea a sandbox.

## Tarjetas de prueba (Chile)

| Marca      | Número                | CVV | Exp   | Nombre titular | Resultado          |
| ---------- | --------------------- | --- | ----- | -------------- | ------------------ |
| Mastercard | `5416 7526 0258 2580` | 123 | 11/30 | `APRO`         | Aprobada           |
| Mastercard | `5416 7526 0258 2580` | 123 | 11/30 | `OTHE`         | Rechazada genérica |
| Visa       | `4509 9535 6623 3704` | 123 | 11/30 | `CONT`         | Pendiente          |

Cuenta comprador test típica de Smart Choice: `TESTUSER3051386622348666230 / wZEJrgKdff` (rotada periódicamente).

## Webhook en sandbox

El webhook **no firma correctamente** si tenés `MP_WEBHOOK_SECRET` de producción y estás usando token de test. La firma HMAC falla → en Apex queda warning + verificación API; en Smart Choice rechaza con 401 → órdenes quedan en `pending`. Es esperado en test.

Workaround para test integral del webhook:

- Crear un secret de webhook en la app test del panel MP.
- Setearlo en `MP_WEBHOOK_SECRET` cuando estés en modo test.
- Recordá rotar al de producción al pasar a prod.

## Rotación rápida (Smart Choice — comandos reales)

```bash
# → Producción
printf "APP_USR-6096797717572099-031111-...-452973632" | firebase functions:secrets:set MP_ACCESS_TOKEN
firebase deploy --only functions

# → Test/Sandbox
printf "APP_USR-6760108421807140-031111-...-3259263747" | firebase functions:secrets:set MP_ACCESS_TOKEN
firebase deploy --only functions
```

**`printf`, no `echo`** — `echo` agrega `\n` y rompe el token (firma "Invalid token format" o 401 en login MP).

Después de cada rotación: ventana incógnito + flujo end-to-end (orden → preferencia → pago test → webhook → email).

## Public keys frontend

| Modo              | NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY                                             |
| ----------------- | ------------------------------------------------------------------------------ |
| Apex prod         | `APP_USR-ef5bddc6-2d5c-471f-9131-f6641d791170` (placeholder; verificar gestor) |
| Smart Choice prod | `APP_USR-ef5bddc6-2d5c-471f-9131-f6641d791170`                                 |
| Smart Choice test | `APP_USR-bf8b7463-170e-47fb-87ae-fa155ef9c632`                                 |

Detección de modo en el cliente:

```ts
const isTestMode =
  process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.startsWith("TEST-") ?? false;
```

(Sólo banner UI; la lógica server-side decide siempre por el access token.)

## Secret leak — protocolo

Si por error commiteaste un `APP_USR-...`:

1. Rotá inmediatamente: panel MP → Credenciales → Generar nueva.
2. Setealo en Secret Manager con el nuevo valor.
3. `git filter-repo --replace-text /tmp/replacements.txt --force` para limpiar historial.
4. Force-push al remote.
5. Pre-commit hook (`.githooks/pre-commit` en Apex) cubre `APP_USR-*` — verificar que está activo.
