import { createFileRoute } from "@tanstack/react-router";
import { parseScaleExport } from "@/lib/scale";

export const Route = createFileRoute("/api/scale-webhook")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(
          JSON.stringify({
            status: "active",
            message: "Endpoint de Webhook do Scale Tracking está funcionando perfeitamente.",
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      },
      POST: async ({ request }) => {
        try {
          const bodyText = await request.text();
          const items = parseScaleExport(bodyText);

          return new Response(
            JSON.stringify({
              success: true,
              receivedItems: items.length,
              items,
              timestamp: new Date().toISOString(),
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (err) {
          console.error("Erro no processamento do webhook Scale:", err);
          return new Response(
            JSON.stringify({ success: false, error: String(err) }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      },
    },
  },
});
