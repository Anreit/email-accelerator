import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export const maxDuration = 120; // Allow up to 2 min on Vercel

type BrandData = {
  url: string;
  name: string;
  logo: string | null;
  colors: string[];
  fonts: string[];
  products: Array<{ name: string; image: string | null; price: string | null }>;
  description: string;
  images: string[];
};

export async function POST(request: Request) {
  try {
    const { brandData, emailCount, context } = (await request.json()) as {
      brandData: BrandData;
      emailCount: number;
      context: string;
    };

    if (!brandData?.url) {
      return NextResponse.json(
        { error: "Brand data is required" },
        { status: 400 }
      );
    }

    const count = Math.min(Math.max(emailCount || 4, 1), 8);

    const systemPrompt = `You are an expert email marketing developer. You generate production-ready HTML email templates.

## Rules for HTML emails:
- Use TABLE-BASED layout (not divs) for email client compatibility
- ALL styles must be INLINE — no external stylesheets, no <style> blocks except for @media queries
- 640px max container width
- Mobile responsive: add @media (max-width: 640px) breakpoints with .container { width: 100% !important; } and .stack { display: block !important; width: 100% !important; }
- Use the client's brand colors, logo, and fonts with safe fallbacks (Arial, Helvetica, sans-serif)
- Hotlink product images directly from the client's website (already scraped)
- Include proper email DOCTYPE and HTML structure
- Include preheader text
- Every email needs: header with logo, hero section, main content, CTA button, footer with unsubscribe

## Structure reference (table-based email):
\`\`\`html
<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Email Title</title>
  <style>
    @media only screen and (max-width: 640px) {
      .container { width: 100% !important; }
      .stack { display: block !important; width: 100% !important; }
      .mobile-pad { padding-left: 20px !important; padding-right: 20px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f3f3f3;">
  <!-- Preheader -->
  <div style="display:none; max-height:0; overflow:hidden;">Preheader text here</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3f3f3;">
    <tr><td align="center" style="padding:20px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" class="container" style="width:640px; max-width:640px; margin:0 auto; background-color:#ffffff;">
        <!-- Header with logo -->
        <!-- Hero section -->
        <!-- Content -->
        <!-- CTA -->
        <!-- Footer -->
      </table>
    </td></tr>
  </table>
</body>
</html>
\`\`\`

## Important:
- Make emails feel REAL and professional — like a top e-commerce brand would send
- Use actual product names and images from the scraped data
- Create compelling copy, not generic placeholder text
- Each email should be a COMPLETE, ready-to-send template
- CTA buttons should use table-based button pattern for email client support`;

    const userPrompt = `Generate ${count} production-ready HTML email templates for this company:

## Brand Data
- **Company:** ${brandData.name}
- **Website:** ${brandData.url}
- **Description:** ${brandData.description || "N/A"}
- **Logo URL:** ${brandData.logo || "No logo found"}
- **Brand colors:** ${brandData.colors.length > 0 ? brandData.colors.join(", ") : "Use professional defaults"}
- **Fonts:** ${brandData.fonts.length > 0 ? brandData.fonts.join(", ") : "Use Arial/Helvetica"}
- **Products found:**
${brandData.products.length > 0 ? brandData.products.map((p) => `  - ${p.name}${p.price ? ` (${p.price})` : ""}${p.image ? ` [img: ${p.image}]` : ""}`).join("\n") : "  - No products scraped, generate appropriate content based on the brand"}
- **Images found:** ${brandData.images.slice(0, 6).join(", ") || "None"}

${context ? `## Additional context from the user:\n${context}\n` : ""}

## Output format
Return a JSON array with ${count} objects. Each object has:
- "type": email type name (e.g. "Welcome", "Cart Abandon", "Post-Purchase", "Win-Back", "Browse Abandon", "Newsletter", etc.)
- "subject": email subject line
- "html": complete HTML email template (single string, no line breaks in the JSON value)

Choose the ${count} most impactful email types for this type of business.

IMPORTANT: Return ONLY valid JSON — no markdown, no code fences, no explanation. Just the JSON array.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    // Extract text from response
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text in Claude response");
    }

    // Parse JSON from response — handle potential markdown wrapping
    let jsonStr = textBlock.text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    }

    const emails = JSON.parse(jsonStr);

    return NextResponse.json({ emails });
  } catch (err: unknown) {
    console.error("Generation error:", err);
    const message =
      err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
