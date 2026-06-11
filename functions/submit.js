/**
 * Cloudflare Pages Function — handles the quote form POST
 * POST /submit
 *
 * Environment variables to set in Cloudflare Pages dashboard:
 *   RESEND_API_KEY  — get free at resend.com (100 emails/day free)
 *   TO_EMAIL        — e.g. sean@assaoil.com
 *   FROM_EMAIL      — must be a verified domain in Resend
 *                     e.g. quotes@assashipping.com  or  noreply@assaoil.com
 */
export async function onRequestPost(ctx) {
    const { request, env } = ctx;

    // parse JSON body (sent by the form's fetch())
    let body;
    try {
        body = await request.json();
    } catch {
        return json({ success: false, error: 'Invalid request' }, 400);
    }

    const {
        first_name, last_name, company, phone, email,
        shipment_type, origin, destination, weight,
        freight_class, pallets, dimensions, commodity,
        ship_date, accessorials, message,
    } = body;

    // build plain-text email content
    const accs = Array.isArray(accessorials) && accessorials.length
        ? accessorials.map(a => `  • ${a}`).join('\n')
        : '  None requested';

    const text = `
NEW FREIGHT QUOTE REQUEST — ASSA SHIPPING
==========================================

CONTACT
  Name:          ${first_name} ${last_name}
  Company:       ${company}
  Phone:         ${phone}
  Email:         ${email}

SHIPMENT
  Type:          ${shipment_type}
  Origin:        ${origin}
  Destination:   ${destination}
  Weight:        ${weight || 'Not specified'}
  Freight Class: ${freight_class ? 'Class ' + freight_class : 'Not specified'}
  Pallets/Pcs:   ${pallets || 'Not specified'}
  Dimensions:    ${dimensions || 'Not specified'}
  Commodity:     ${commodity || 'Not specified'}
  Ship Date:     ${ship_date || 'ASAP'}

ACCESSORIALS
${accs}

NOTES
  ${message || 'None'}

==========================================
Submitted via ASSA Shipping website
    `.trim();

    const subject = `New Freight Quote — ${first_name} ${last_name} | ${company}`;
    const toEmail  = env.TO_EMAIL   || 'sean@assaoil.com';
    const fromEmail = env.FROM_EMAIL || 'quotes@assashipping.com';

    // ── Send via Resend ────────────────────────────────────────────────────
    if (!env.RESEND_API_KEY) {
        return json({ success: false, error: 'RESEND_API_KEY not configured' }, 500);
    }

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: `ASSA Shipping <${fromEmail}>`,
            to:   [toEmail],
            reply_to: email,         // reply goes straight to the customer
            subject,
            text,
        }),
    });

    if (res.ok) {
        return json({ success: true });
    }

    const err = await res.text();
    console.error('Resend error:', err);
    return json({ success: false, error: 'Email delivery failed' }, 500);
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
    });
}
