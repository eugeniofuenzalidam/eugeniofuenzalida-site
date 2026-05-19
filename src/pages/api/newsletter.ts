import type { APIRoute } from "astro";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

export const GET: APIRoute = () => {
  return new Response(
    JSON.stringify({ message: "Newsletter API — use POST to subscribe." }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const email = body.email;

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await addDoc(collection(db, "newsletter"), {
      email,
      subscribedAt: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Suscripción registrada correctamente.",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Newsletter subscription error:", error);
    return new Response(
      JSON.stringify({ error: "Could not process subscription." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
