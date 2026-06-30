# Sora Portrait — Style Guide Entry
## Phase C: Sora Identity · Korra Design Doc — KH/Nomura Edition (v3)

---

### Overview
Sora's conductor portrait is the human-readable face of the Sora-MissionControl guild-master agent. It appears on Team cards, detail pages, chat headers, and focused Office moments — everywhere the user needs to recognize Sora at a glance. The portrait is **secondary** to the conductor station (Office primary), but serves as the consistent identity marker across all other UI surfaces.

### Aesthetic
- **Style**: Kingdom Hearts editorial art — Tetsuya Nomura character design aesthetic, sharp clean anime lines, dark sleek tailored look, dramatic cinematic lighting, professional anime character art
- **Tone**: Stoic, commanding but serene. A conductor mid-performance — confident authority without aggression
- **Palette**: Dark charcoal-black base with warm platinum (#f0e8d8) rim-light accents. Silver/platinum hair highlights. Muted warm skin tones with amber undertones.
- **Treatment**: Sharp angular linework with painterly soft shading. Dramatic upper-left cinematic rim lighting casting warm highlights. Dark gradient background. Clean, professional editorial character art — not game sprite, not UI chrome.
- **Expression**: Calm, intense, authoritative. Stoic eyes — serene but focused. Hand raised with a thin conductor's baton.

### Key Kingdom Hearts / Nomura Style Traits
- Sharp, angular facial features — defined jawline, narrow intense eyes
- Silver-platinum swept hair with dark undertones (signature Nomura hair design)
- Sleek modern-tailored dark charcoal-black conductor tailcoat with sharp lapels
- High collar evoking Organization XIII coats fused with orchestral formalwear
- Silver insignia pin on lapel
- Dramatic cinematic rim lighting from upper-left light source
- Warm platinum (#f0e8d8) highlight pools on face and shoulder
- Painterly soft shading over clean crisp anime linework
- Professional editorial character art flat — head-and-shoulders to mid-torso framing

### Forbidden Elements
- Fantasy tavern settings, ornate RPG frames, medieval motifs
- Cartoon mascots, chibi chaos, emoji chatter
- XP bars, loot sparkles, guild banners that read as "gaming"
- Aggressive, cold, or aloof expressions
- Persona 5 UI-art flat tones, vector-like editorial chrome, game-menu aesthetics

### Allowed Elements
- Insignia (silver pin on lapel)
- Conductor baton / station cues
- Warm office/amber light pools
- Dark gradient background (not fantasy)
- Role titles and subtle banners (UI overlay, not in portrait source)
- KH-inspired sleek tailoring and silver hair accents

---

### Asset Specifications

| Asset | Dimensions | Format | Size | Usage |
|-------|-----------|--------|------|-------|
| `sora.webp` | 350×350px circle | WebP, RGBA | ~14 KB | **Primary portrait**. Full-res source for all surfaces. Transparent background, circular mask baked in. |
| `sora@2x.webp` | 700×700px circle | WebP, RGBA | ~34 KB | **Retina 2x**. High-DPI displays. Same circular mask. |
| `sora-48.webp` | 48×48px circle | WebP, RGBA | ~1 KB | **Team surface portrait**. Larger than lead cards (40px) to denote guild-master status. |
| `sora-40.webp` | 40×40px circle | WebP, RGBA | ~1 KB | **Chat/Detail portrait**. Same size as standard lead cards. |
| `sora-24.webp` | 24×24px circle | WebP, RGBA | ~0.5 KB | **Office conductor station tab**. Small, in tab header context. |

---

### UI Integration Rules

#### Portrait Ring (Border)
- **Default**: 1.5px solid warm platinum (`#f0e8d8`) ring around the circular portrait
- **Active/Online**: Same 1.5px ring with subtle outer glow — `box-shadow: 0 0 6px 1px var(--agent-sora)` (warm platinum glow)
- **Inactive/Offline**: Ring at 50% opacity, no glow
- The ring is applied by the UI container, NOT baked into the portrait asset. The portrait asset has a transparent background with a hard circular mask edge.

#### Sizing Hierarchy
- **Sora (guild-master)**: 48×48px on Team surface — 8px larger than lead cards to denote authority
- **Lead cards**: 40×40px standard
- **Tab header**: 24×24px (Office context)
- Use the appropriate pre-sized asset for each surface to avoid browser downscaling artifacts.

#### Color Token
- Reference: `var(--agent-sora)` → warm platinum (#f0e8d8)
- All Sora identity elements (ring, glow, accent lines) use this token

---

### Design Decisions

1. **Circular mask baked in**: Portraits are delivered as circular WebP with alpha transparency. The UI adds the ring/border, keeping assets portable and overridable.
2. **350px base resolution**: Chosen to balance file size (~14KB, well within the 20-40KB target) against sufficient detail for Retina downscaling. The 700px @2x variant handles high-DPI displays.
3. **Multiple surface sizes**: Pre-generated at exact pixel dimensions (48, 40, 24) to avoid runtime scaling artifacts. Each is a crisp, anti-aliased circle at its target size.
4. **No baked glow**: The portrait itself has no glow effect — this is applied dynamically by the UI based on Sora's online/active status, keeping the static asset stateless.
5. **Kingdom Hearts × conductor fusion (v3)**: The design shifted from Persona 5 UI-art aesthetic (v2) to Nomura's Kingdom Hearts editorial character art style. The conductor motif (baton, tailored tailcoat, score-adjacent lighting) grounds it in Sora's guild-master role. The KH influence brings sharp angular linework, a dark sleek palette, dramatic cinematic rim lighting, and silver-platinum hair accents — professional anime character art rather than game-menu UI art.

---

### Source File
- `sora-source.png`: 1024×1024px RGB source image (~1.2 MB) — the full generated portrait before circular masking. Used for regeneration or edits.
- Generated via FAL.ai FLUX 2 Klein 9B with a detailed Kingdom Hearts / Nomura × conductor prompt.

---

### Variant Notes
- **Station (Office primary)**: This portrait is NOT the Office primary — the conductor station UI (separate asset) takes precedence in Office. This portrait is used everywhere else.
- **Team cards**: Use `sora-48.webp` with the active-glow ring when Sora is online.
- **Chat headers**: Use `sora-40.webp` inline, paired with Sora's name and role title ("Guild Master · Conductor").
- **Detail pages**: Use `sora@2x.webp` for crisp rendering on high-DPI detail views.

---

*Generated: Phase C v3, Sora-MissionControl · Korra Design System · KH/Nomura Edition*
