import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ACCESS_APPLICATION_LIST_ID = "G27EI76318920F6oSK4JYYohig";

const inputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(50),
  music: z.string().trim().max(2048).optional().nullable(),
  source: z.string().trim().max(120).optional().nullable(),
});

export const submitAccessApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: boolean; error: string | null }> => {
    const baseUrl = process.env.SENDY_BASE_URL;
    const apiKey = process.env.SENDY_API_KEY;

    if (!baseUrl || !apiKey) {
      return { ok: false, error: "Sendy is not configured yet." };
    }

    try {
      const url = baseUrl.replace(/\/+$/, "") + "/subscribe";
      const form = new URLSearchParams({
        api_key: apiKey,
        list: ACCESS_APPLICATION_LIST_ID,
        boolean: "true",
        name: data.name,
        email: data.email.toLowerCase(),
        Name: data.name,
        Email: data.email.toLowerCase(),
        Phone: data.phone,
        Music: data.music || "",
        Source: data.source || "apply-access",
      });

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      const text = (await response.text()).trim();

      if (response.ok && (text === "1" || text.toLowerCase() === "true" || /already subscribed/i.test(text))) {
        return { ok: true, error: null };
      }

      return { ok: false, error: text || `Sendy returned status ${response.status}.` };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Sendy request failed.",
      };
    }
  });
