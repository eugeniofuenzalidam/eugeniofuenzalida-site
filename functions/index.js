const {
  onCall,
  HttpsError,
  onRequest,
} = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { google } = require("googleapis");
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const { MercadoPagoConfig, Preference } = require("mercadopago");

admin.initializeApp();

const CALENDAR_ID = "eugeniofuenzalida@gmail.com";
const TIMEZONE = "America/Santiago";

function getAuth() {
  const keyPath = path.join(__dirname, "service-account.json");

  if (!fs.existsSync(keyPath)) {
    logger.error("service-account.json not found at", keyPath);
    return null;
  }

  try {
    const credentials = JSON.parse(fs.readFileSync(keyPath, "utf8"));

    if (credentials.client_email && credentials.private_key) {
      return new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key.replace(/\\n/g, "\n"),
        ["https://www.googleapis.com/auth/calendar"],
      );
    }
  } catch (e) {
    logger.error("Error reading service-account.json:", e.message);
  }

  return null;
}

exports.getBusySlots = onCall({ cors: true }, async (request) => {
  const { timeMin, timeMax } = request.data;

  if (!timeMin || !timeMax) {
    throw new HttpsError(
      "invalid-argument",
      "timeMin and timeMax are required",
    );
  }

  const auth = getAuth();
  if (!auth) {
    throw new HttpsError(
      "failed-precondition",
      "Calendar credentials not configured. Add service-account.json to functions/",
    );
  }

  try {
    const calendar = google.calendar({ version: "v3", auth });
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: CALENDAR_ID }],
        timeZone: TIMEZONE,
      },
    });

    const busy = response.data.calendars[CALENDAR_ID]?.busy || [];
    return { busy };
  } catch (error) {
    logger.error("Error fetching busy slots:", error.message || error);
    throw new HttpsError("internal", "Error fetching calendar availability");
  }
});

exports.createBooking = onCall({ cors: true }, async (request) => {
  const { service, date, hour, name, email, phone } = request.data;

  if (!service || !date || hour === undefined) {
    throw new HttpsError(
      "invalid-argument",
      "service, date, and hour are required",
    );
  }

  const auth = getAuth();
  if (!auth) {
    throw new HttpsError(
      "failed-precondition",
      "Calendar credentials not configured",
    );
  }

  const startDate = new Date(
    `${date}T${String(hour).padStart(2, "0")}:00:00-04:00`,
  );
  const endDate = new Date(
    `${date}T${String(hour + 1).padStart(2, "0")}:00:00-04:00`,
  );

  try {
    const calendar = google.calendar({ version: "v3", auth });

    const description = [
      `Servicio: ${service}`,
      name ? `Cliente: ${name}` : "",
      email ? `Email: ${email}` : "",
      phone ? `Telefono: ${phone}` : "",
      "",
      "Agendado via eugeniofuenzalidaps.web.app",
    ]
      .filter(Boolean)
      .join("\n");

    const event = {
      summary: `Cita: ${service}`,
      description,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: TIMEZONE,
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: TIMEZONE,
      },
    };

    if (email) {
      event.attendees = [{ email }];
    }

    const response = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: event,
    });

    logger.info("Booking created:", response.data.id);

    return {
      success: true,
      eventId: response.data.id,
      htmlLink: response.data.htmlLink,
    };
  } catch (error) {
    logger.error("Error creating booking:", error.message || error);
    throw new HttpsError(
      "internal",
      "Error creating calendar event: " + (error.message || "unknown"),
    );
  }
});

// Mercado Pago Integration
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
});

exports.createPreference = onCall({ cors: true }, async (request) => {
  const { service, amount } = request.data;

  if (!service || !amount) {
    throw new HttpsError("invalid-argument", "service and amount are required");
  }

  const preference = new Preference(mpClient);

  try {
    const body = {
      items: [
        {
          id: service,
          title: `Cita: ${service}`,
          unit_price: Number(amount),
          quantity: 1,
          currency_id: "CLP",
        },
      ],
      back_urls: {
        success: "https://eugeniofuenzalidaps.web.app/v1?status=success",
        failure: "https://eugeniofuenzalidaps.web.app/v1?status=failure",
        pending: "https://eugeniofuenzalidaps.web.app/v1?status=pending",
      },
      auto_return: "approved",
      notification_url:
        "https://us-central1-eugeniofuenzalidaps.cloudfunctions.net/webhookMercadoPago",
    };

    const response = await preference.create({ body });

    return {
      id: response.id,
      init_point: response.init_point,
    };
  } catch (error) {
    logger.error("Error creating MP preference:", error);
    throw new HttpsError("internal", "Error creating payment preference");
  }
});

exports.webhookMercadoPago = onRequest({ cors: true }, async (req, res) => {
  const { action, data } = req.body;

  if (action === "payment" || action === "payment.created") {
    const paymentId = data.id || req.query["data.id"];
    logger.info("Payment notification received:", paymentId);
  }

  res.status(200).send("OK");
});
