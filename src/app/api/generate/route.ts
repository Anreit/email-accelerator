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
  products: Array<{ name: string; image: string | null; price: string | null; url?: string | null }>;
  description: string;
  images: {
    banners?: string[];
    brandLogos?: string[];
    trustIcons?: string[];
    blogImages?: string[];
    lifestyleImages?: string[];
    productImages?: string[];
  } | string[];
};

export async function POST(request: Request) {
  try {
    const { brandData, emailCount, context, beforeImageContext, password } = (await request.json()) as {
      brandData: BrandData;
      emailCount: number;
      context: string;
      beforeImageContext?: string;
      password: string;
    };

    const correctPw = process.env.APP_PASSWORD || "scandiweb2026";
    if (password !== correctPw) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!brandData?.url) {
      return NextResponse.json(
        { error: "Brand data is required" },
        { status: 400 }
      );
    }

    const count = Math.min(Math.max(emailCount || 4, 1), 8);

    const systemPrompt = `You are a senior email developer. Build production-ready HTML email templates.

TECHNICAL REQUIREMENTS:
- Table-based layout, all styles inline, 640px max width
- role="presentation" cellpadding="0" cellspacing="0" border="0" on every table
- Mobile: @media (max-width:640px) with .container, .stack, .mobile-pad, .product-card, .banner-img, .hero-headline, .button classes
- Buttons: table>tr>td pattern (Outlook-safe), never just a styled <a>
- Images: display:block, explicit width, height:auto, border:0
- Spacers: <div style="height:Xpx; line-height:Xpx; font-size:Xpx;">&nbsp;</div>
- Preheader: display:none; max-height:0; overflow:hidden with &zwnj; padding
- Load Google Fonts via <link> in <head> for display font
- ONLY use real image URLs from the scraped data. NEVER make up URLs.
- ONLY use real product names and prices from scraped data. NEVER invent products.

DESIGN REQUIREMENTS:
- 8-12 distinct sections minimum, 300+ lines of HTML
- Overall feel: LIGHT and CLEAN. White is the dominant background color.
- Hero: brand accent color background (NOT dark/black) with white text, or full-width lifestyle image
- Product sections: white background, generous padding
- Product cards: light gray bg (#f3f3f3), border-radius:8px, product image, name, price, CTA link
- Full-width lifestyle/banner images from the site between content sections (0 padding, edge to edge)
- Trust bar: dark bg (#222), 3-column stats in accent color
- Footer: dark bg, company info, unsubscribe

ADAPT TO THE BRAND:
- Beauty/luxury: serif headlines (Georgia), warm body bg (#FDF6F4), soft radius (12px), lifestyle photography
- Sports/active: bold sans-serif (Montserrat/Barlow), uppercase headlines, sharp radius (4px), action photography
- General retail: clean sans-serif, neutral bg (#f3f3f3), medium radius (8px)
- Use TWO font roles: display font for headlines + sans-serif for body text

SECTION ORDER (adapt based on brand, but include most of these):
1. Preheader
2. Logo header
3. Hero (accent color bg + headline + CTA/discount code)
4. Full-width lifestyle banner
5. Product/category headline
6. Product grid (2-3 columns) or category cards
7. Featured product or discovery block
8. Second banner or brand logos row
9. Trust bar (dark, 3-column stats)
10. Why us / USP section (3-column, white bg)
11. Educational/blog content (optional)
12. Footer (dark)`;

    const userPrompt = `Generate ${count} production-ready HTML email templates for this company:

## Brand Data
- **Company:** ${brandData.name}
- **Website:** ${brandData.url}
- **Description:** ${brandData.description || "N/A"}
- **Logo URL:** ${brandData.logo || "No logo found"}
- **Brand colors:** ${brandData.colors.length > 0 ? brandData.colors.join(", ") : "Use professional defaults"}
- **Fonts:** ${brandData.fonts.length > 0 ? brandData.fonts.join(", ") : "Use Arial/Helvetica"}
- **Brand tone:** ${(brandData as Record<string, unknown>).brandTone || "Detect from the site description and colors. Beauty/luxury = serif headlines (Georgia), warm bg (#FDF6F4). Sports/active = bold sans-serif, neutral bg. General retail = clean sans-serif."}
- **Categories:** ${(brandData as Record<string, unknown>).categories ? ((brandData as Record<string, unknown>).categories as string[]).slice(0, 8).join(", ") : "Unknown"}
- **Products found:**
${brandData.products.length > 0 ? brandData.products.map((p) => `  - ${p.name}${p.price ? ` (${p.price})` : ""}${p.image ? ` [img: ${p.image}]` : ""}${"url" in p && p.url ? ` [link: ${p.url}]` : ""}`).join("\n") : "  - No products scraped, generate appropriate content based on the brand"}
- **Banner images (use for full-width sections):** ${!Array.isArray(brandData.images) && brandData.images?.banners ? brandData.images.banners.join(", ") : "None found"}
- **Brand/category logos:** ${!Array.isArray(brandData.images) && brandData.images?.brandLogos ? brandData.images.brandLogos.join(", ") : "None found"}
- **Trust/about icons:** ${!Array.isArray(brandData.images) && brandData.images?.trustIcons ? brandData.images.trustIcons.join(", ") : "None found"}
- **Blog/lifestyle images:** ${!Array.isArray(brandData.images) && brandData.images?.blogImages ? brandData.images.blogImages.join(", ") : "None found"}
- **Other lifestyle images:** ${!Array.isArray(brandData.images) && brandData.images?.lifestyleImages ? brandData.images.lifestyleImages.join(", ") : "None found"}

${context ? `## Additional context from the user:\n${context}\n` : ""}
${beforeImageContext ? `## Before email reference:\n${beforeImageContext}\n` : ""}

## Output format
Return a JSON array with ${count} objects. Each object has:
- "type": email type name (e.g. "Welcome", "Cart Abandon", "Post-Purchase", "Win-Back", "Browse Abandon", "Newsletter", etc.)
- "subject": email subject line
- "html": complete HTML email template (single string, no line breaks in the JSON value)

Choose the ${count} most impactful email types for this type of business.

IMPORTANT: Return ONLY valid JSON — no markdown, no code fences, no explanation. Just the JSON array.`;

    // Use streaming to avoid timeout on long generations
    let fullText = "";
    const stream = await client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 32000,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullText += event.delta.text;
      }
    }

    if (!fullText.trim()) {
      throw new Error("No text in Claude response");
    }

    // Parse JSON from response — handle potential markdown wrapping
    let jsonStr = fullText.trim();
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
