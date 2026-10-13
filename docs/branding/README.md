# Branding — sample CI directions

Two sample corporate-identity (CI) directions for a shop on Cafe'nMe, applied to the demo shop.
Concept images were generated with Codex image generation; they are **references**, not production artwork
(re-draw the final logo as vector before printing).

Research behind this (Oct 2026):
- **UNO! Coffee** (Rocks PC): "Great Coffee for All", from ฿85, office workers; playful tone, numbered brand
  architecture (UNO → DOS! Matcha "By UNO! Coffee"), menu cap, Passport stamp campaign at year 1.
- **Matcha People** (Ari): premium (from ฿220), white / oak / aluminium, the product carries the brand
  (name carved into the ice cube), calm "space of peace".
- Common pattern of strong café brands: **one repeated signal** (symbol, colour or voice) everywhere.

Both directions are original — they do not reuse any real brand's name, logo or mark.

## A — Playful (`a-playful/`)

| Token | Hex | Use |
|---|---|---|
| tomato | `#E8432E` | primary, sleeves, CTAs (in-app preset uses `#D23A26` for 4.5:1 text contrast) |
| butter | `#FFD449` | secondary, highlights, stickers |
| ink | `#1E1A17` | outlines, text |
| cream | `#FFF6E5` | backgrounds |

- Mark: smiling cup with "pop" rays; chunky rounded wordmark with thick ink outline.
- Type: heavy rounded sans — e.g. **Mitr** or **Kanit 700** (Thai + Latin on Google Fonts).
- Voice: short, loud, fun drink names; exclamation energy. Good for ฿60–90 grab-and-go.
- Known gap: the mascot's face varies between images — lock one version when vectorising.

## B — Calm (`b-calm/`)

| Token | Hex | Use |
|---|---|---|
| rice | `#F7F5EF` | backgrounds |
| matcha | `#5E7A3A` | mark, headings, stamps |
| oak | `#C9A27A` | dividers, accents |
| aluminium | `#A7AAAD` | empty states, outlines |
| ink | `#2B2B28` | text |

- Mark: thin circle + half matcha bowl + one leaf (the `logo-sheet.png` version is canonical).
- Type: light, widely tracked sans for the wordmark; **IBM Plex Sans Thai Looped** or **Noto Sans Thai 300–500** for text.
- Voice: quiet, few words, lots of space. Good for ฿120+ specialty / matcha.

## Asset set (per direction)

| File | Size | Maps to in Cafe'nMe |
|---|---|---|
| `logo-sheet.png` | 1536×1024 | shop logo upload, `logo-mark.png` |
| `cups.png` | 1536×1024 | print only (sleeve, sticker) |
| `stamp-passport.png` | 1536×1024 | LIFF stamp card, `stamp-filled` / `stamp-empty` |
| `line-richmenu.png` | 1536×1024 | LINE rich menu — resize to 2500×1686, add Thai labels in code/LINE OA Manager |
| `menu-board.png` | 1024×1536 | print only |
| `qr-standee.png` | 1024×1536 | print; place the LIFF join QR in the blank square |

Images contain Latin text only (image models garble Thai); add Thai copy in layout.
