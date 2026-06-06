const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const {
  FaCamera, FaVolumeUp, FaMicrophone, FaWhatsapp, FaDatabase, FaBrain,
  FaRegClock, FaStore, FaBoxOpen, FaArrowRight, FaUniversity, FaShoppingCart,
  FaChartLine, FaUserCheck, FaEyeSlash, FaBolt, FaLayerGroup, FaServer,
  FaRupeeSign, FaCheck, FaMobileAlt, FaRobot
} = require("react-icons/fa");

// ---------- palette (Paytm-flavored) ----------
const NAVY   = "002E6E";   // Paytm deep blue (dominant)
const DARK   = "041C40";   // near-black navy for title/close
const CYAN   = "00BAF2";   // Paytm cyan accent
const SKY    = "CFEFFb".toUpperCase();
const ICE    = "EAF4FB";   // light panel
const SLATE  = "5B6B82";   // muted text
const INK    = "16233A";   // body ink
const SAFFRON= "FF8A3D";   // warm kirana accent
const GREEN  = "16B981";
const RED     = "E5484D";
const WHITE  = "FFFFFF";
const LINEC  = "DDE6F0";

const HFONT = "Georgia";
const BFONT = "Calibri";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.3 x 7.5
pres.author = "Yaad";
pres.title = "Yaad — kirana reorder infrastructure";
const W = 13.3, H = 7.5;

// ---------- icon cache ----------
const iconCache = {};
async function icon(Comp, color = "#FFFFFF", size = 256) {
  const key = Comp.name + color + size;
  if (iconCache[key]) return iconCache[key];
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Comp, { color, size: String(size) })
  );
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const d = "image/png;base64," + png.toString("base64");
  iconCache[key] = d;
  return d;
}
const mkShadow = () => ({ type: "outer", color: "0A1B33", blur: 9, offset: 3, angle: 90, opacity: 0.16 });

function footer(slide, n) {
  slide.addText("YAAD", { x: 0.55, y: H - 0.42, w: 2, h: 0.3, fontFace: HFONT, fontSize: 9, color: SLATE, bold: true, charSpacing: 3 });
  slide.addText(`${n} / 8`, { x: W - 1.4, y: H - 0.42, w: 0.85, h: 0.3, fontFace: BFONT, fontSize: 9, color: SLATE, align: "right" });
}

(async () => {
  // ============================================================ SLIDE 1 — TITLE
  let s = pres.addSlide();
  s.background = { color: DARK };
  // faint geometry
  s.addShape(pres.shapes.OVAL, { x: 9.6, y: -2.2, w: 6.5, h: 6.5, fill: { color: NAVY, transparency: 35 }, line: { type: "none" } });
  s.addShape(pres.shapes.OVAL, { x: 11.3, y: 3.6, w: 4.5, h: 4.5, fill: { color: CYAN, transparency: 80 }, line: { type: "none" } });

  s.addText("याद", { x: 0.85, y: 1.15, w: 6, h: 1.4, fontFace: HFONT, fontSize: 60, color: CYAN, bold: true });
  s.addText("Yaad", { x: 0.9, y: 2.45, w: 9, h: 1.2, fontFace: HFONT, fontSize: 64, color: WHITE, bold: true });
  s.addText("The reorder layer for India's 13 million kirana stores.", {
    x: 0.92, y: 3.75, w: 9.5, h: 0.6, fontFace: BFONT, fontSize: 21, color: SKY,
  });
  s.addText("Snap one photo at checkout → a Hindi voice note brings the customer back when they run out.", {
    x: 0.92, y: 4.45, w: 10.2, h: 0.6, fontFace: BFONT, fontSize: 15, color: "AEC4DE", italic: true,
  });

  // stack chips
  const chips = ["Paytm Inference · Vision", "Sarvam 30B", "Bulbul V3 TTS", "WhatsApp Cloud API"];
  let cx = 0.92;
  chips.forEach((c) => {
    const wch = 0.22 + c.length * 0.105;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: 5.55, w: wch, h: 0.5, fill: { color: NAVY }, line: { color: CYAN, width: 1 }, rectRadius: 0.1 });
    s.addText(c, { x: cx, y: 5.55, w: wch, h: 0.5, align: "center", valign: "middle", fontFace: BFONT, fontSize: 11.5, color: WHITE });
    cx += wch + 0.22;
  });
  s.addText("Hackathon prototype · Built end-to-end on Paytm + Sarvam", { x: 0.92, y: 6.55, w: 10, h: 0.4, fontFace: BFONT, fontSize: 12, color: SLATE });

  // ============================================================ SLIDE 2 — PROBLEM
  s = pres.addSlide();
  s.background = { color: WHITE };
  s.addText("The largest retail network on earth has no memory", {
    x: 0.55, y: 0.4, w: 12.2, h: 1.05, fontFace: HFONT, fontSize: 30, color: NAVY, bold: true,
  });
  s.addText("Every kirana transaction today destroys its own data.", { x: 0.57, y: 1.62, w: 12, h: 0.4, fontFace: BFONT, fontSize: 16, color: SLATE, italic: true });

  // flow of "today"
  const flow = [
    [FaStore, "Customer buys", "Eggs + bread, ₹200"],
    [FaVolumeUp, "Soundbox fires", "“Do sau rupaye prapt”"],
    [FaArrowRight, "Customer leaves", "No record kept"],
    [FaEyeSlash, "Data vanishes", "Zero memory of who / what"],
  ];
  let fx = 0.6;
  const fw = 2.85, gap = 0.33;
  for (let i = 0; i < flow.length; i++) {
    const [Ic, t, d] = flow[i];
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: fx, y: 2.05, w: fw, h: 1.7, fill: { color: ICE }, line: { color: LINEC, width: 1 }, rectRadius: 0.08, shadow: mkShadow() });
    s.addShape(pres.shapes.OVAL, { x: fx + 0.28, y: 2.32, w: 0.62, h: 0.62, fill: { color: i === 3 ? RED : NAVY }, line: { type: "none" } });
    s.addImage({ data: await icon(Ic, "#FFFFFF", 256), x: fx + 0.42, y: 2.46, w: 0.34, h: 0.34 });
    s.addText(t, { x: fx + 0.28, y: 3.0, w: fw - 0.5, h: 0.35, fontFace: BFONT, fontSize: 14.5, bold: true, color: INK });
    s.addText(d, { x: fx + 0.28, y: 3.34, w: fw - 0.5, h: 0.35, fontFace: BFONT, fontSize: 11.5, color: SLATE });
    if (i < flow.length - 1) {
      s.addImage({ data: await icon(FaArrowRight, "#9AB0CC", 128), x: fx + fw + 0.02, y: 2.78, w: 0.28, h: 0.28 });
    }
    fx += fw + gap;
  }

  // consequence stats
  const stats = [
    ["13M+", "kirana stores, almost none with a CRM"],
    ["0", "rows of customer purchase history exist"],
    ["~90%", "of Indian retail is still this informal"],
  ];
  let sx = 0.6;
  const sw = 3.93;
  for (const [big, lab] of stats) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: sx, y: 4.25, w: sw, h: 1.7, fill: { color: NAVY }, line: { type: "none" }, rectRadius: 0.08 });
    s.addText(big, { x: sx + 0.3, y: 4.45, w: sw - 0.6, h: 0.85, fontFace: HFONT, fontSize: 40, bold: true, color: CYAN });
    s.addText(lab, { x: sx + 0.3, y: 5.32, w: sw - 0.6, h: 0.5, fontFace: BFONT, fontSize: 13, color: "D7E6F5" });
    sx += sw + 0.36;
  }
  s.addText("No history means no reorder reminders, no inventory insight, and no credit — the shopkeeper is invisible to the formal economy.", {
    x: 0.6, y: 6.15, w: 12.1, h: 0.6, fontFace: BFONT, fontSize: 13.5, color: SLATE, italic: true,
  });
  footer(s, 2);

  // ============================================================ SLIDE 3 — INSIGHT / WHY NOW
  s = pres.addSlide();
  s.background = { color: WHITE };
  s.addText("The insight: sell the reorder, not the “we miss you”", {
    x: 0.55, y: 0.4, w: 12.2, h: 1.05, fontFace: HFONT, fontSize: 29, color: NAVY, bold: true,
  });
  s.addText("Retention timed to consumption — not to silence — is a service the customer actually wants.", {
    x: 0.57, y: 1.62, w: 12.2, h: 0.4, fontFace: BFONT, fontSize: 16, color: SLATE, italic: true });

  // before / after columns
  const colW = 5.95;
  // Old
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 2.05, w: colW, h: 3.0, fill: { color: ICE }, line: { color: LINEC, width: 1 }, rectRadius: 0.08 });
  s.addText("Old idea — at-risk / time-based", { x: 0.9, y: 2.25, w: colW - 0.6, h: 0.4, fontFace: BFONT, fontSize: 15, bold: true, color: RED });
  s.addText([
    { text: "Trigger:  days since last visit", options: { breakLine: true, bullet: true } },
    { text: "Message:  “We miss you, come back”", options: { breakLine: true, bullet: true } },
    { text: "Feels like:  marketing pressure", options: { breakLine: true, bullet: true } },
    { text: "Customer may have no reason to return", options: { bullet: true } },
  ], { x: 0.95, y: 2.75, w: colW - 0.65, h: 2.1, fontFace: BFONT, fontSize: 14.5, color: INK, paraSpaceAfter: 10 });

  // New
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6 + colW + 0.4, y: 2.05, w: colW, h: 3.0, fill: { color: NAVY }, line: { type: "none" }, rectRadius: 0.08, shadow: mkShadow() });
  s.addText("Yaad — consumption-cycle based", { x: 0.9 + colW + 0.4, y: 2.25, w: colW - 0.6, h: 0.4, fontFace: BFONT, fontSize: 15, bold: true, color: CYAN });
  s.addText([
    { text: "Trigger:  the item is about to run out", options: { breakLine: true, bullet: true } },
    { text: "Message:  “Aapke ande khatam ho gaye honge”", options: { breakLine: true, bullet: true } },
    { text: "Feels like:  a helpful service", options: { breakLine: true, bullet: true } },
    { text: "Customer genuinely needs the item", options: { bullet: true } },
  ], { x: 0.95 + colW + 0.4, y: 2.75, w: colW - 0.65, h: 2.1, fontFace: BFONT, fontSize: 14.5, color: "EAF4FB", paraSpaceAfter: 10 });

  // why now band
  s.addText("Why now", { x: 0.6, y: 5.35, w: 3, h: 0.4, fontFace: HFONT, fontSize: 16, bold: true, color: NAVY });
  const why = [
    [FaVolumeUp, "Soundbox is everywhere", "20M+ merchants already glance at the phone at every payment."],
    [FaBrain, "Vision models got good", "One photo of products is now reliably parsed into line items."],
    [FaShoppingCart, "Quick-commerce rails exist", "A reorder can deeplink straight into fulfilment."],
  ];
  let wx = 0.6; const ww = 3.93;
  for (const [Ic, t, d] of why) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: wx, y: 5.8, w: ww, h: 1.25, fill: { color: WHITE }, line: { color: LINEC, width: 1 }, rectRadius: 0.07 });
    s.addShape(pres.shapes.OVAL, { x: wx + 0.22, y: 6.02, w: 0.5, h: 0.5, fill: { color: SAFFRON }, line: { type: "none" } });
    s.addImage({ data: await icon(Ic, "#FFFFFF", 256), x: wx + 0.33, y: 6.13, w: 0.28, h: 0.28 });
    s.addText(t, { x: wx + 0.85, y: 5.95, w: ww - 1.0, h: 0.32, fontFace: BFONT, fontSize: 13, bold: true, color: INK });
    s.addText(d, { x: wx + 0.85, y: 6.27, w: ww - 1.0, h: 0.7, fontFace: BFONT, fontSize: 10.8, color: SLATE });
    wx += ww + 0.36;
  }
  footer(s, 3);

  // ============================================================ SLIDE 4 — SOLUTION / FLOW
  s = pres.addSlide();
  s.background = { color: WHITE };
  s.addText("The solution: one extra tap on a payment you already take", {
    x: 0.55, y: 0.4, w: 12.4, h: 1.05, fontFace: HFONT, fontSize: 28, color: NAVY, bold: true,
  });
  s.addText("The soundbox is the trigger. The payment becomes the camera. No bill, no typing, no literacy needed.", {
    x: 0.57, y: 1.58, w: 12.3, h: 0.4, fontFace: BFONT, fontSize: 15.5, color: SLATE, italic: true });

  const steps = [
    [FaVolumeUp, "1", "Payment lands", "Customer pays via Paytm QR; soundbox confirms ₹200."],
    [FaMobileAlt, "2", "Tap the alert", "Merchant phone buzzes: “₹200 received — log items”."],
    [FaCamera, "3", "Snap the counter", "One photo of the products being handed over."],
    [FaBrain, "4", "Items detected", "Vision returns: eggs (14d), bread (5d) → logged to that payment."],
    [FaMicrophone, "5", "Voice note fires", "On day 13 a warm Hindi reminder reaches the customer."],
  ];
  const n = steps.length;
  const cw2 = (W - 1.2 - (n - 1) * 0.3) / n;
  let x4 = 0.6;
  for (let i = 0; i < n; i++) {
    const [Ic, num, t, d] = steps[i];
    const top = 2.25;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x4, y: top, w: cw2, h: 3.05, fill: { color: i === 4 ? NAVY : ICE }, line: { color: i === 4 ? NAVY : LINEC, width: 1 }, rectRadius: 0.08, shadow: i === 4 ? mkShadow() : undefined });
    s.addText(num, { x: x4 + 0.18, y: top + 0.12, w: 0.8, h: 0.6, fontFace: HFONT, fontSize: 30, bold: true, color: i === 4 ? CYAN : "C3D4E8" });
    s.addShape(pres.shapes.OVAL, { x: x4 + cw2 / 2 - 0.45, y: top + 0.78, w: 0.9, h: 0.9, fill: { color: i === 4 ? CYAN : NAVY }, line: { type: "none" } });
    s.addImage({ data: await icon(Ic, "#FFFFFF", 256), x: x4 + cw2 / 2 - 0.25, y: top + 0.98, w: 0.5, h: 0.5 });
    s.addText(t, { x: x4 + 0.16, y: top + 1.82, w: cw2 - 0.32, h: 0.4, align: "center", fontFace: BFONT, fontSize: 14.5, bold: true, color: i === 4 ? WHITE : INK });
    s.addText(d, { x: x4 + 0.18, y: top + 2.2, w: cw2 - 0.36, h: 0.8, align: "center", fontFace: BFONT, fontSize: 10.6, color: i === 4 ? "D7E6F5" : SLATE });
    if (i < n - 1) s.addImage({ data: await icon(FaArrowRight, "#9AB0CC", 128), x: x4 + cw2 + 0.02, y: top + 1.05, w: 0.26, h: 0.26 });
    x4 += cw2 + 0.3;
  }

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.65, w: 12.1, h: 1.15, fill: { color: ICE }, line: { color: CYAN, width: 1.25 }, rectRadius: 0.08 });
  s.addText([
    { text: "Merchant behaviour changes by exactly one tap.  ", options: { bold: true, color: NAVY } },
    { text: "Same motion they already make when the soundbox rings — now it leaves a permanent, structured record.", options: { color: INK } },
  ], { x: 0.95, y: 5.65, w: 11.4, h: 1.15, valign: "middle", fontFace: BFONT, fontSize: 15 });
  footer(s, 4);

  // ============================================================ SLIDE 5 — ARCHITECTURE
  s = pres.addSlide();
  s.background = { color: DARK };
  s.addText("Architecture", { x: 0.55, y: 0.35, w: 8, h: 0.7, fontFace: HFONT, fontSize: 28, color: WHITE, bold: true });
  s.addText("Two flows over one Supabase data layer — 100% on Paytm + Sarvam.", {
    x: 0.57, y: 1.08, w: 12, h: 0.4, fontFace: BFONT, fontSize: 14, color: SKY, italic: true });

  // helper for arch node
  async function node(x, y, w, h, Ic, title, sub, tag, fill, accent) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: accent, width: 1.25 }, rectRadius: 0.07, shadow: mkShadow() });
    s.addShape(pres.shapes.OVAL, { x: x + 0.18, y: y + 0.2, w: 0.55, h: 0.55, fill: { color: accent }, line: { type: "none" } });
    s.addImage({ data: await icon(Ic, "#04173A", 256), x: x + 0.31, y: y + 0.33, w: 0.3, h: 0.3 });
    s.addText(title, { x: x + 0.82, y: y + 0.17, w: w - 0.92, h: 0.34, fontFace: BFONT, fontSize: 12.5, bold: true, color: WHITE });
    s.addText(sub, { x: x + 0.82, y: y + 0.49, w: w - 0.92, h: 0.3, fontFace: BFONT, fontSize: 9.5, color: "AEC4DE" });
    if (tag) s.addText(tag, { x: x + 0.16, y: y + h - 0.34, w: w - 0.3, h: 0.26, fontFace: BFONT, fontSize: 8.5, italic: true, color: accent });
  }
  function arrow(x, y, w) {
    s.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color: CYAN, width: 1.75, endArrowType: "triangle" } });
  }
  function varrow(x, y, h) {
    s.addShape(pres.shapes.LINE, { x, y, w: 0, h, line: { color: CYAN, width: 1.75, endArrowType: "triangle" } });
  }

  const nW = 2.62, nH = 1.0, GAPN = 0.55, STEP = nW + GAPN;
  const X0 = 0.6;
  const colX = (i) => X0 + i * STEP;
  // FLOW 1 label
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: X0, y: 1.62, w: 2.55, h: 0.34, fill: { color: NAVY }, line: { color: CYAN, width: 1 }, rectRadius: 0.05 });
  s.addText("FLOW 1 · BILLING (real-time)", { x: X0, y: 1.62, w: 2.55, h: 0.34, align: "center", valign: "middle", fontFace: BFONT, fontSize: 10, bold: true, color: WHITE });

  const row1y = 2.1;
  const f1 = [
    [FaCamera, "Merchant app", "snap products + pay ctx", "React + Vite", CYAN],
    [FaBrain, "Vision detect", "image → items JSON", "Paytm Inference · Sonnet 4.6", CYAN],
    [FaServer, "FastAPI /billing", "validate → reorder clock", "Python backend", CYAN],
    [FaDatabase, "Supabase", "customers · items · txns", "Postgres + Storage", SAFFRON],
  ];
  for (let i = 0; i < f1.length; i++) {
    const [Ic, t, sub, tag, ac] = f1[i];
    await node(colX(i), row1y, nW, nH, Ic, t, sub, tag, "0B2A55", ac);
    if (i < f1.length - 1) arrow(colX(i) + nW + 0.04, row1y + nH / 2, GAPN - 0.08);
  }

  // central data layer
  const dlY = 3.5;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: X0, y: dlY, w: colX(3) + nW - X0, h: 0.74, fill: { color: "0B2A55" }, line: { color: SAFFRON, width: 1.5 }, rectRadius: 0.06 });
  s.addImage({ data: await icon(FaLayerGroup, "#FF8A3D", 256), x: 0.85, y: dlY + 0.2, w: 0.34, h: 0.34 });
  s.addText([
    { text: "STRUCTURED DATA LEDGER   ", options: { bold: true, color: SAFFRON } },
    { text: "every payment now carries line items, a customer, and a reorder clock — the asset everything else is built on.", options: { color: "D7E6F5" } },
  ], { x: 1.35, y: dlY, w: colX(3) + nW - 1.35 - 0.2, h: 0.74, valign: "middle", fontFace: BFONT, fontSize: 12.5 });

  // connect flow1 -> ledger and ledger -> flow2
  varrow(colX(3) + nW / 2, row1y + nH + 0.02, dlY - (row1y + nH) - 0.04);
  varrow(colX(0) + nW / 2, dlY + 0.74 + 0.02, 0.55);

  // FLOW 2 label
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: X0, y: 4.95, w: 2.95, h: 0.34, fill: { color: NAVY }, line: { color: CYAN, width: 1 }, rectRadius: 0.05 });
  s.addText("FLOW 2 · REMINDER (daily cron)", { x: X0, y: 4.95, w: 2.95, h: 0.34, align: "center", valign: "middle", fontFace: BFONT, fontSize: 10, bold: true, color: WHITE });

  const row2y = 5.42;
  const f2 = [
    [FaRegClock, "Scheduler", "items past reorder_due", "APScheduler", CYAN],
    [FaRobot, "Message gen", "warm Hindi reminder", "Sarvam 30B", CYAN],
    [FaMicrophone, "Voice synth", "text → natural audio", "Bulbul V3 TTS", CYAN],
    [FaWhatsapp, "Delivery", "voice note to customer", "WhatsApp Cloud API", GREEN],
  ];
  for (let i = 0; i < f2.length; i++) {
    const [Ic, t, sub, tag, ac] = f2[i];
    await node(colX(i), row2y, nW, nH, Ic, t, sub, tag, "0B2A55", ac);
    if (i < f2.length - 1) arrow(colX(i) + nW + 0.04, row2y + nH / 2, GAPN - 0.08);
  }

  s.addText("Demo note: soundbox + WhatsApp send are mocked in-UI; vision, message and TTS calls are live.", {
    x: 0.55, y: 6.62, w: 12.2, h: 0.3, fontFace: BFONT, fontSize: 10.5, color: SLATE, italic: true });
  footer(s, 5);

  // ============================================================ SLIDE 6 — DATA LAYER VALUE
  s = pres.addSlide();
  s.background = { color: WHITE };
  s.addText("The reminder is the wedge. The data is the company.", {
    x: 0.55, y: 0.45, w: 12.4, h: 0.9, fontFace: HFONT, fontSize: 29, color: NAVY, bold: true });
  s.addText("Each photo writes one row to India's first informal-retail transaction ledger.", {
    x: 0.57, y: 1.33, w: 12.3, h: 0.45, fontFace: BFONT, fontSize: 16, color: SLATE, italic: true });

  // before / after receipt
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 2.05, w: 5.9, h: 1.5, fill: { color: ICE }, line: { color: LINEC, width: 1 }, rectRadius: 0.08 });
  s.addText("TODAY", { x: 0.9, y: 2.25, w: 3, h: 0.32, fontFace: BFONT, fontSize: 11.5, bold: true, color: SLATE, charSpacing: 2 });
  s.addText("₹200 received  ·  23 May, 3:14 PM", { x: 0.9, y: 2.68, w: 5.3, h: 0.55, fontFace: BFONT, fontSize: 18, bold: true, color: INK, valign: "middle" });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.8, y: 2.05, w: 5.9, h: 1.5, fill: { color: NAVY }, line: { type: "none" }, rectRadius: 0.08, shadow: mkShadow() });
  s.addText("WITH YAAD", { x: 7.1, y: 2.25, w: 3, h: 0.32, fontFace: BFONT, fontSize: 11.5, bold: true, color: CYAN, charSpacing: 2 });
  s.addText("₹200  ·  Eggs (12), Bread (1), Milk (1L)", { x: 7.1, y: 2.68, w: 5.3, h: 0.55, fontFace: BFONT, fontSize: 16, bold: true, color: WHITE, valign: "middle" });

  // three unlocks
  const unlocks = [
    [FaUniversity, "Credit underwriting", "Verified, itemised revenue becomes proof banks can lend against."],
    [FaChartLine, "Inventory intelligence", "Category velocity: what sells, what's slow, what to restock."],
    [FaUserCheck, "Customer graph", "Per-customer purchase history — the CRM kiranas never had."],
  ];
  let ux = 0.6; const uw = 3.93;
  for (const [Ic, t, d] of unlocks) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: ux, y: 3.8, w: uw, h: 2.5, fill: { color: WHITE }, line: { color: LINEC, width: 1 }, rectRadius: 0.08, shadow: mkShadow() });
    s.addShape(pres.shapes.OVAL, { x: ux + 0.3, y: 4.05, w: 0.66, h: 0.66, fill: { color: SAFFRON }, line: { type: "none" } });
    s.addImage({ data: await icon(Ic, "#FFFFFF", 256), x: ux + 0.46, y: 4.21, w: 0.34, h: 0.34 });
    s.addText(t, { x: ux + 0.3, y: 4.88, w: uw - 0.6, h: 0.4, fontFace: BFONT, fontSize: 16, bold: true, color: NAVY });
    s.addText(d, { x: ux + 0.3, y: 5.32, w: uw - 0.6, h: 0.85, fontFace: BFONT, fontSize: 12.5, color: SLATE });
    ux += uw + 0.36;
  }
  s.addText("The voice-note reorder is just the first product built on top of this layer.", {
    x: 0.6, y: 6.55, w: 12.1, h: 0.4, fontFace: BFONT, fontSize: 14, bold: true, color: INK });
  footer(s, 6);

  // ============================================================ SLIDE 7 — ECOSYSTEM / PAYTM WEDGE
  s = pres.addSlide();
  s.background = { color: WHITE };
  s.addText("Why this is infrastructure, not an app", {
    x: 0.55, y: 0.45, w: 12.2, h: 0.9, fontFace: HFONT, fontSize: 30, color: NAVY, bold: true });
  s.addText("Structure the informal market once, and an entire ecosystem snaps on top — Paytm is positioned to own all of it.",
    { x: 0.57, y: 1.33, w: 12.3, h: 0.45, fontFace: BFONT, fontSize: 15.5, color: SLATE, italic: true });

  const obW = 3.15, obH = 1.45;
  const Lx = 0.6, Rx = W - 0.6 - obW;          // left / right column x
  const rowsY = [2.15, 3.83, 5.51];
  const cNodeCx = 6.65, cNodeCy = 4.55;
  const orbit = [
    // [icon, title, desc, colX, rowIndex]
    [FaRupeeSign, "Payments lift", "More relevant reorders → more QR transactions on Paytm.", Lx, 0],
    [FaChartLine, "Merchant SaaS", "Dashboards, inventory & customer CRM as a subscription.", Lx, 1],
    [FaWhatsapp, "Engagement", "Voice-note channel for offers, festivals, restock nudges.", Lx, 2],
    [FaShoppingCart, "Quick commerce", "Reorder deeplinks into Paytm-powered fulfilment.", Rx, 0],
    [FaUniversity, "Merchant lending", "Itemised revenue underwrites working-capital loans.", Rx, 1],
    [FaBoxOpen, "Supply / FMCG", "Aggregated demand data sold back to brands & distributors.", Rx, 2],
  ];
  // connectors first
  for (const [, , , ox, ri] of orbit) {
    const cardCy = rowsY[ri] + obH / 2;
    const innerX = ox === Lx ? ox + obW : ox;
    s.addShape(pres.shapes.LINE, { x: Math.min(cNodeCx, innerX), y: cardCy, w: Math.abs(cNodeCx - innerX), h: cNodeCy - cardCy, line: { color: "C3D4E8", width: 1.25 } });
  }
  // center node
  s.addShape(pres.shapes.OVAL, { x: cNodeCx - 1.1, y: cNodeCy - 1.1, w: 2.2, h: 2.2, fill: { color: NAVY }, line: { color: CYAN, width: 2 }, shadow: mkShadow() });
  s.addText("Yaad\ndata layer", { x: cNodeCx - 1.1, y: cNodeCy - 1.1, w: 2.2, h: 2.2, align: "center", valign: "middle", fontFace: HFONT, fontSize: 16, bold: true, color: WHITE });

  for (const [Ic, t, d, ox, ri] of orbit) {
    const oy = rowsY[ri];
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: ox, y: oy, w: obW, h: obH, fill: { color: ICE }, line: { color: LINEC, width: 1 }, rectRadius: 0.08, shadow: mkShadow() });
    s.addShape(pres.shapes.OVAL, { x: ox + 0.2, y: oy + 0.22, w: 0.5, h: 0.5, fill: { color: SAFFRON }, line: { type: "none" } });
    s.addImage({ data: await icon(Ic, "#FFFFFF", 256), x: ox + 0.31, y: oy + 0.33, w: 0.28, h: 0.28 });
    s.addText(t, { x: ox + 0.82, y: oy + 0.22, w: obW - 0.97, h: 0.4, fontFace: BFONT, fontSize: 13.5, bold: true, color: NAVY });
    s.addText(d, { x: ox + 0.22, y: oy + 0.78, w: obW - 0.42, h: 0.6, fontFace: BFONT, fontSize: 10.2, color: SLATE });
  }
  footer(s, 7);

  // ============================================================ SLIDE 8 — CLOSE / DEMO / ASK
  s = pres.addSlide();
  s.background = { color: DARK };
  s.addShape(pres.shapes.OVAL, { x: -2.2, y: 4.2, w: 6, h: 6, fill: { color: NAVY, transparency: 40 }, line: { type: "none" } });
  s.addShape(pres.shapes.OVAL, { x: 10.5, y: -2.4, w: 5.5, h: 5.5, fill: { color: CYAN, transparency: 82 }, line: { type: "none" } });

  s.addText("Yaad", { x: 0.85, y: 0.7, w: 8, h: 1.0, fontFace: HFONT, fontSize: 46, bold: true, color: WHITE });
  s.addText("Turn 13 million invisible stores into a structured, addressable network — starting with a voice note.",
    { x: 0.88, y: 1.7, w: 11.4, h: 0.8, fontFace: BFONT, fontSize: 18, color: SKY });

  // what's built for the demo
  s.addText("What the prototype shows", { x: 0.88, y: 2.75, w: 8, h: 0.4, fontFace: HFONT, fontSize: 16, bold: true, color: CYAN });
  const demo = [
    [FaCamera, "Photo → items", "Live vision call via Paytm Inference"],
    [FaRobot, "Items → Hindi message", "Live Sarvam 30B generation"],
    [FaMicrophone, "Message → voice note", "Live Bulbul V3 audio in a WhatsApp-style bubble"],
    [FaChartLine, "At-risk dashboard", "Reorder timeline per customer"],
  ];
  let dx = 0.88; const dw = 2.66;
  for (const [Ic, t, d] of demo) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: dx, y: 3.25, w: dw, h: 1.7, fill: { color: "0B2A55" }, line: { color: CYAN, width: 1 }, rectRadius: 0.08 });
    s.addShape(pres.shapes.OVAL, { x: dx + 0.22, y: 3.47, w: 0.55, h: 0.55, fill: { color: CYAN }, line: { type: "none" } });
    s.addImage({ data: await icon(Ic, "#04173A", 256), x: dx + 0.35, y: 3.6, w: 0.3, h: 0.3 });
    s.addText(t, { x: dx + 0.22, y: 4.1, w: dw - 0.4, h: 0.4, fontFace: BFONT, fontSize: 13.5, bold: true, color: WHITE });
    s.addText(d, { x: dx + 0.22, y: 4.48, w: dw - 0.4, h: 0.5, fontFace: BFONT, fontSize: 10.5, color: "AEC4DE" });
    dx += dw + 0.3;
  }

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.88, y: 5.35, w: 11.55, h: 1.15, fill: { color: NAVY }, line: { color: SAFFRON, width: 1.25 }, rectRadius: 0.08 });
  s.addText([
    { text: "Built 100% on Paytm Inference + Sarvam.   ", options: { bold: true, color: SAFFRON } },
    { text: "No third-party AI. The reminder is v1 — the structured ledger underneath is the platform.", options: { color: "EAF4FB" } },
  ], { x: 1.2, y: 5.35, w: 10.9, h: 1.15, valign: "middle", fontFace: BFONT, fontSize: 15 });
  s.addText("याद — when the customer runs out, the store remembers.", { x: 0.88, y: 6.7, w: 11, h: 0.4, fontFace: HFONT, fontSize: 13, italic: true, color: SLATE });

  await pres.writeFile({ fileName: "/sessions/vibrant-intelligent-mendel/mnt/outputs/Yaad.pptx" });
  console.log("written");
})();
