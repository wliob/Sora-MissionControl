#!/usr/bin/env python3
"""
Generate pixel art assets for Phase B: Office Immersive Screen.
V2 — Fixed PIL draw handle + alpha_composite ordering.
"""

from PIL import Image, ImageDraw
import os
import json

PROJECT = "/home/wliob/llm-brain/Projects/Active/Sora-MissionControl"
ASSETS_SRC = f"{PROJECT}/src/office/assets"
ATLAS_PUB = f"{PROJECT}/public/assets/atlases"

AGENTS_DIR = f"{ASSETS_SRC}/agents"
FURN_DIR = f"{ASSETS_SRC}/atlas/furniture-1"
FX_DIR = f"{ASSETS_SRC}/fx"

os.makedirs(AGENTS_DIR, exist_ok=True)
os.makedirs(FURN_DIR, exist_ok=True)
os.makedirs(FX_DIR, exist_ok=True)

# ── Color Palette ──────────────────────────────────────────────────────────
TRANSPARENT = (0, 0, 0, 0)
VOID_0 = (0, 0, 0, 255)
VOID_1 = (4, 7, 12, 255)
VOID_2 = (8, 12, 20, 255)
CRT_AMBER = (255, 176, 0, 255)
CRT_GREEN = (0, 255, 65, 255)
CRT_CYAN = (0, 212, 255, 255)
CRT_RED = (255, 68, 68, 255)
GUILD_AMBER = (212, 148, 58, 255)
WARM_PLATINUM = (240, 232, 216, 255)

RAIN_SKY = (88, 166, 255, 255)
RAIN_DARK = (0, 140, 220, 255)

# Cavapoo (Zuko) colors
DOG_BODY = (185, 125, 70, 255)
DOG_BODY_LIGHT = (210, 155, 100, 255)
DOG_BODY_DARK = (145, 90, 45, 255)
DOG_EAR = (125, 75, 40, 255)
DOG_NOSE = (45, 28, 18, 255)
DOG_EYE = (20, 15, 10, 255)
DOG_EYE_HL = (255, 255, 255, 200)
DOG_PAW = (205, 165, 125, 255)
DOG_COLLAR = (88, 166, 255, 255)

FLOOR_BASE = (18, 22, 32, 255)
FLOOR_GRID = (28, 33, 46, 255)

DESK_SURF = (52, 57, 68, 255)
DESK_EDGE = (36, 41, 52, 255)
CHAIR_BASE = (45, 50, 60, 255)
CHAIR_SEAT = (58, 63, 76, 255)
MONITOR_FRAME = (30, 35, 45, 255)
MONITOR_SCREEN = (12, 16, 26, 255)


def put_px(img, x, y, color):
    """Put a single RGBA pixel safely."""
    w, h = img.size
    if 0 <= x < w and 0 <= y < h:
        img.putpixel((x, y), color)


def draw_circle_filled(img, cx, cy, rx, ry, color):
    """Fill an ellipse, pixel by pixel."""
    for dx in range(-rx, rx + 1):
        for dy in range(-ry, ry + 1):
            if rx > 0 and ry > 0 and (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1.0:
                put_px(img, cx + dx, cy + dy, color)


def draw_diamond(img, cx, cy, rx, ry, color):
    """Fill an isometric diamond using Manhattan metric."""
    for dx in range(-rx, rx + 1):
        for dy in range(-ry, ry + 1):
            if abs(dx) / rx + abs(dy) / ry <= 1.0:
                put_px(img, cx + dx, cy + dy, color)


# ── Rain Agent Sprites ─────────────────────────────────────────────────────

def create_dog_base(w=64, h=64, bag=True):
    """Create pixel art Cavapoo dog (isometric standing pose)."""
    img = Image.new('RGBA', (w, h), TRANSPARENT)

    cx, cy = w // 2, 36  # body center

    # ── Ground shadow ──
    for dx in range(-12, 13):
        for dy in range(-5, 6):
            if dx * dx / 144.0 + dy * dy / 25.0 <= 1.0:
                put_px(img, w // 2 + dx, h - 8 + dy, (0, 0, 0, 35))

    # ── Back legs ──
    for leg_x in [cx - 6, cx + 6]:
        for ly in range(2, 12):
            for lx in range(-2, 3):
                color = DOG_BODY_DARK if ly < 6 else DOG_PAW
                put_px(img, leg_x + lx, cy + ly, color)

    # ── Body (oval) ──
    for dx in range(-15, 16):
        for dy in range(-11, 12):
            if dx * dx / 225.0 + dy * dy / 121.0 <= 1.0:
                shade = 0.85 + 0.15 * (1 - abs(dx) / 15.0)
                r = max(0, min(255, int(DOG_BODY[0] * shade)))
                g = max(0, min(255, int(DOG_BODY[1] * shade)))
                b = max(0, min(255, int(DOG_BODY[2] * shade)))
                put_px(img, cx + dx, cy + dy, (r, g, b, 255))

    # ── Front legs ──
    for leg_x in [cx - 5, cx + 5]:
        for ly in range(2, 13):
            for lx in range(-2, 3):
                color = DOG_BODY if ly < 6 else DOG_BODY_LIGHT
                put_px(img, leg_x + lx, cy + ly - 6, color)
        # Paws
        for px in range(-3, 4):
            put_px(img, leg_x + px, cy + 7, DOG_PAW)
            put_px(img, leg_x + px - 1, cy + 8, DOG_BODY_DARK)

    # ── Head ──
    hx, hy = cx + 2, cy - 16
    for dx in range(-9, 10):
        for dy in range(-9, 10):
            if dx * dx / 81.0 + dy * dy / 81.0 <= 1.0:
                shade = 0.9 + 0.1 * (1 - abs(dy) / 9.0)
                r = max(0, min(255, int(DOG_BODY_LIGHT[0] * shade)))
                g = max(0, min(255, int(DOG_BODY_LIGHT[1] * shade)))
                b = max(0, min(255, int(DOG_BODY_LIGHT[2] * shade)))
                put_px(img, hx + dx, hy + dy, (r, g, b, 255))

    # ── Floppy ears ──
    for side in [-1, 1]:
        ex = hx + side * 8
        ey = hy + 2
        for dx in range(-3, 4):
            for dy in range(2, 15):
                if abs(dx) <= 2:
                    put_px(img, ex + dx, ey + dy, DOG_EAR)

    # ── Face details ──
    # Eyes
    for side in [-1, 1]:
        ex = hx + side * 4
        ey = hy - 1
        for dx in range(-1, 2):
            for dy in range(-1, 2):
                put_px(img, ex + dx, ey + dy, DOG_EYE)
        put_px(img, ex, ey - 1, DOG_EYE_HL)

    # Nose
    for dx in range(-2, 3):
        for dy in range(2):
            put_px(img, hx + dx, hy + 3 + dy, DOG_NOSE)

    # Mouth
    for dx in range(-1, 2):
        put_px(img, hx + dx, hy + 6, (60, 35, 25, 255))

    # ── Collar ──
    for dx in range(-7, 8):
        put_px(img, hx + dx, hy + 9, DOG_COLLAR)
        if abs(dx) <= 6:
            put_px(img, hx + dx, hy + 10, DOG_COLLAR)

    # ── Curly tail ──
    tx, ty = cx - 14, cy - 4
    for tdx, tdy in [(-1, 0), (-2, -1), (-2, -2), (-1, -3), (0, -3), (1, -3), (0, -4)]:
        put_px(img, tx + tdx, ty + tdy, DOG_BODY_LIGHT)

    # ── Messenger bag ──
    if bag:
        bx, by = cx + 8, cy - 5
        # Bag body
        for dx in range(-3, 7):
            for dy in range(-1, 7):
                if dx >= -1:
                    color = RAIN_SKY if dy < 3 else RAIN_DARK
                    put_px(img, bx + dx, by + dy, color)
        # Strap
        for sx in range(-10, -3):
            put_px(img, bx + sx, by, RAIN_DARK)
        # Buckle
        put_px(img, bx + 2, by + 3, GUILD_AMBER)
        # Envelope icon
        put_px(img, bx + 2, by + 1, WARM_PLATINUM)
        put_px(img, bx + 1, by + 2, WARM_PLATINUM)
        put_px(img, bx + 3, by + 2, WARM_PLATINUM)

    return img


def create_floor_tile(w=64, h=64):
    """Isometric floor tile with Rain's sky blue accent."""
    img = Image.new('RGBA', (w, h), TRANSPARENT)
    cx, cy = w // 2, h // 2 + 8

    # Diamond floor
    for dx in range(-28, 29):
        for dy in range(-14, 15):
            if abs(dx) / 28.0 + abs(dy) / 14.0 <= 1.0:
                shade = 0.8 + 0.2 * (1 - (abs(dx) / 28.0 + abs(dy) / 14.0))
                r = int(FLOOR_BASE[0] * shade)
                g = int(FLOOR_BASE[1] * shade)
                b = int(FLOOR_BASE[2] * shade)
                put_px(img, cx + dx, cy + dy, (r, g, b, 255))

    # Grid lines
    for dx in range(-26, 27):
        for dy in range(-12, 13):
            if abs(dx) / 28.0 + abs(dy) / 14.0 <= 1.0:
                if (dx + dy * 2) % 12 == 0:
                    px, py = cx + dx, cy + dy
                    pix = img.getpixel((px, py))
                    if pix[3] > 0:
                        put_px(img, px, py, (pix[0] + 6, pix[1] + 7, pix[2] + 10, pix[3]))

    # Sky blue center accent
    for dx in range(-3, 4):
        for dy in range(-2, 3):
            put_px(img, cx + dx, cy + dy, (RAIN_SKY[0], RAIN_SKY[1], RAIN_SKY[2], 160))

    return img


def create_idle_sheet(w=64, h=64, frames=2):
    """Idle breathing animation spritesheet."""
    total_w = w * frames
    img = Image.new('RGBA', (total_w, h), TRANSPARENT)

    for f in range(frames):
        dog = create_dog_base(w, h)
        if f == 1:
            # Slight breathing: shift body up 1px
            shifted = Image.new('RGBA', (w, h), TRANSPARENT)
            for y in range(1, h):
                for x in range(w):
                    pix = dog.getpixel((x, y))
                    if pix[3] > 0:
                        shifted.putpixel((x, y - 1), pix)
            dog = shifted
        img.paste(dog, (f * w, 0))

    return img


def create_walk_sheet(w=64, h=64, frames=4):
    """Walking animation spritesheet."""
    total_w = w * frames
    img = Image.new('RGBA', (total_w, h), TRANSPARENT)

    for f in range(frames):
        dog = create_dog_base(w, h)

        # Lean based on frame
        if f == 0 or f == 2:
            lean = -1 if f == 0 else 1
            shifted = Image.new('RGBA', (w, h), TRANSPARENT)
            for y in range(h):
                for x in range(w):
                    sx = x - lean
                    if 0 <= sx < w:
                        pix = dog.getpixel((sx, y))
                        if pix[3] > 0:
                            shifted.putpixel((x, y), pix)
            dog = shifted

        # Bob up/down
        if f == 1:
            shifted = Image.new('RGBA', (w, h), TRANSPARENT)
            for y in range(1, h):
                for x in range(w):
                    pix = dog.getpixel((x, y))
                    if pix[3] > 0:
                        shifted.putpixel((x, y - 2), pix)
            dog = shifted
        elif f == 3:
            shifted = Image.new('RGBA', (w, h), TRANSPARENT)
            for y in range(2, h):
                for x in range(w):
                    pix = dog.getpixel((x, y))
                    if pix[3] > 0:
                        shifted.putpixel((x, y - 1), pix)
            dog = shifted

        img.paste(dog, (f * w, 0))

    return img


def create_work_sheet(w=64, h=64, frames=2):
    """Working/focused animation spritesheet."""
    total_w = w * frames
    img = Image.new('RGBA', (total_w, h), TRANSPARENT)

    for f in range(frames):
        dog = create_dog_base(w, h)

        # Work indicators — concentration
        fx_y = 15
        if f == 0:
            for dx in range(-2, 3):
                put_px(dog, w // 2 - 10 + dx, fx_y, (88, 166, 255, 120))
                put_px(dog, w // 2 + 8 + dx, fx_y, (88, 166, 255, 120))
            # Data mote
            put_px(dog, w // 2 + 13, 28, (0, 212, 255, 180))
            put_px(dog, w // 2 + 15, 26, (0, 212, 255, 100))
        else:
            for dx in range(-1, 3):
                put_px(dog, w // 2 - 9 + dx, fx_y + 1, (88, 166, 255, 100))
                put_px(dog, w // 2 + 9 + dx, fx_y + 1, (88, 166, 255, 100))
            put_px(dog, w // 2 + 12, 29, (0, 212, 255, 180))

        img.paste(dog, (f * w, 0))

    return img


def create_cheer_sheet(w=64, h=64, frames=2):
    """Celebration animation spritesheet."""
    total_w = w * frames
    img = Image.new('RGBA', (total_w, h), TRANSPARENT)

    sparkle_colors = [(0, 212, 255), (212, 148, 58), (0, 255, 65), (240, 232, 216)]
    sparkle_positions = [
        [(28, 8), (40, 4), (52, 10), (27, 16), (54, 19)],
        [(30, 5), (42, 7), (50, 12), (25, 18), (53, 16)],
    ]

    for f in range(frames):
        dog = create_dog_base(w, h)

        for sx, sy in sparkle_positions[f]:
            color = sparkle_colors[(sx + sy) % 4]
            # Cross sparkle
            put_px(dog, sx, sy, color + (220,))
            put_px(dog, sx + 1, sy, color + (150,))
            put_px(dog, sx - 1, sy, color + (150,))
            put_px(dog, sx, sy - 1, color + (150,))
            put_px(dog, sx, sy + 1, color + (150,))

        img.paste(dog, (f * w, 0))

    return img


# ── Conductor Station Furniture ────────────────────────────────────────────

def create_conductor_desk(w=128, h=96):
    """Isometric elevated desk with warm platinum accent."""
    img = Image.new('RGBA', (w, h), TRANSPARENT)
    cx, cy = w // 2, 28

    # Elevated platform shadow
    for dx in range(-52, 53):
        for dy in range(-26, 27):
            if abs(dx) / 52.0 + abs(dy) / 26.0 <= 1.0:
                if abs(dx) / 48.0 + abs(dy) / 24.0 > 1.0:
                    put_px(img, cx + dx, cy + dy + 4, (0, 0, 0, 50))

    # Desk top (diamond)
    for dx in range(-48, 49):
        for dy in range(-24, 25):
            if abs(dx) / 48.0 + abs(dy) / 24.0 <= 1.0:
                shade = 0.7 + 0.3 * (1 - (abs(dx) / 48.0 + abs(dy) / 24.0))
                r = int(DESK_SURF[0] * shade)
                g = int(DESK_SURF[1] * shade)
                b = int(DESK_SURF[2] * shade)
                put_px(img, cx + dx, cy + dy, (r, g, b, 255))

    # Warm platinum edge highlight
    for dx in range(-46, 47):
        dist_to_edge = 24 * (1 - abs(dx) / 48.0)
        dy = int(dist_to_edge)
        if dy >= 0:
            # Top edge
            put_px(img, cx + dx, cy - dy, (240, 232, 216, 80))
            # Bottom edge
            put_px(img, cx + dx, cy + dy, (240, 232, 216, 80))

    # Guild amber corner accents
    for corner in [(-46, 0), (46, 0), (0, -22), (0, 22)]:
        cx2, cy2 = cx + corner[0], cy + corner[1]
        for dx in range(-2, 3):
            for dy in range(-2, 3):
                if abs(dx) + abs(dy) <= 2:
                    put_px(img, cx2 + dx, cy2 + dy, (212, 148, 58, 140))

    return img


def create_conductor_chair(w=64, h=96):
    """Isometric chair with warm platinum backrest accent."""
    img = Image.new('RGBA', (w, h), TRANSPARENT)
    cx, cy = w // 2, 32

    # Seat
    for dx in range(-18, 19):
        for dy in range(-9, 10):
            if abs(dx) / 18.0 + abs(dy) / 9.0 <= 1.0:
                shade = 0.8
                r = int(CHAIR_SEAT[0] * shade)
                g = int(CHAIR_SEAT[1] * shade)
                b = int(CHAIR_SEAT[2] * shade)
                put_px(img, cx + dx, cy + dy, (r, g, b, 255))

    # Backrest
    for dx in range(-14, 15):
        for dy in range(-24, -3):
            if abs(dx) / 14.0 + abs(dy + 13) / 24.0 <= 1.2:
                shade = 0.85
                r = int(CHAIR_BASE[0] * shade)
                g = int(CHAIR_BASE[1] * shade)
                b = int(CHAIR_BASE[2] * shade)
                put_px(img, cx + dx, cy + dy, (r, g, b, 255))

    # Platinum accent stripes on backrest
    for bx in range(-11, 12, 4):
        put_px(img, cx + bx, cy - 18, (240, 232, 216, 130))
        put_px(img, cx + bx, cy - 10, (240, 232, 216, 100))

    # Armrests
    for side in [-1, 1]:
        ax = cx + side * 16
        ay = cy - 2
        for dx in range(-3, 4):
            for dy in range(-2, 3):
                put_px(img, ax + dx, ay + dy, (38, 43, 54, 220))

    return img


def create_conductor_monitor(w=96, h=80):
    """Dual monitor setup for conductor station."""
    img = Image.new('RGBA', (w, h), TRANSPARENT)

    mw, mh = 30, 42

    for mon_idx, (mx_center, my_center) in enumerate([(18, 22), (60, 22)]):
        # Monitor body
        for dx in range(-mw // 2, mw // 2 + 1):
            for dy in range(-mh // 2, mh // 2 + 1):
                dist = abs(dx) / (mw / 2.0) + abs(dy) / (mh / 2.0)
                if dist <= 1.0:
                    inner = dist < 0.82
                    if inner:
                        put_px(img, mx_center + dx, my_center + dy, (10, 14, 26, 255))
                        # Screen content
                        if abs(dy) < mh // 4:
                            put_px(img, mx_center + dx, my_center + dy,
                                   (15, 20, 35, 255) if mon_idx == 0 else (10, 25, 20, 255))
                    else:
                        put_px(img, mx_center + dx, my_center + dy, (32, 37, 48, 255))

        # Monitor glow
        if mon_idx == 0:  # Left: warm platinum
            glow_color = (240, 232, 216, 80)
        else:  # Right: guild amber
            glow_color = (212, 148, 58, 70)
        for gx in range(-5, 6):
            for gy in range(-3, 4):
                if abs(gx) + abs(gy) < 6:
                    put_px(img, mx_center + gx, my_center + gy - mh // 2 + 5, glow_color)

    # Stand
    stand_y = 44
    for sx in range(4, w - 4):
        put_px(img, sx, stand_y, (36, 41, 52, 255))
        put_px(img, sx, stand_y + 1, (36, 41, 52, 255))
    # Base
    for sx in range(0, w):
        put_px(img, sx, stand_y + 3, (30, 35, 45, 200))

    return img


def create_guild_banner(w=96, h=64):
    """Subtle guild banner/backdrop."""
    img = Image.new('RGBA', (w, h), TRANSPARENT)

    # Dark panel background
    for x in range(2, w - 2):
        for y in range(2, h - 2):
            shade = 0.9 + 0.1 * (y / h)
            r = int(8 * shade)
            g = int(12 * shade)
            b = int(20 * shade)
            put_px(img, x, y, (r, g, b, 180))

    # Platinum border
    for x in range(w):
        put_px(img, x, 0, (240, 232, 216, 70))
        put_px(img, x, h - 1, (240, 232, 216, 70))
    for y in range(h):
        put_px(img, 0, y, (240, 232, 216, 70))
        put_px(img, w - 1, y, (240, 232, 216, 70))

    # Guild crest (simplified hex node)
    cx, cy = w // 2, h // 2
    for dx in range(-12, 13):
        for dy in range(-8, 9):
            if abs(dx) / 12.0 + abs(dy) / 8.0 <= 1.0:
                put_px(img, cx + dx, cy + dy, (212, 148, 58, 60))

    # Horizontal circuit traces
    for lx in range(8, w - 8, 10):
        put_px(img, lx, h // 2, (0, 212, 255, 35))
    for ly in range(8, h - 8, 10):
        put_px(img, w // 2, ly, (0, 212, 255, 30))

    return img


# ── Ambient Lighting ───────────────────────────────────────────────────────

def create_light_pool(w=128, h=128):
    """Soft radial gradient light pool overlay."""
    img = Image.new('RGBA', (w, h), TRANSPARENT)
    cx, cy = w // 2, h // 2

    for dx in range(-64, 64):
        for dy in range(-64, 64):
            dist = (dx * dx + dy * dy) ** 0.5
            if dist < 62:
                intensity = max(0.0, 1.0 - dist / 62.0)
                # Non-linear falloff for softer edge
                alpha = int(intensity * intensity * 45)
                r = int(212 * intensity)
                g = int(148 * intensity)
                b = int(58 * intensity)
                put_px(img, cx + dx, cy + dy, (r, g, b, alpha))

    return img


def create_crt_scanline(w=4, h=4):
    """2px repeating CRT scanline tile."""
    img = Image.new('RGBA', (w, h), TRANSPARENT)

    for x in range(w):
        put_px(img, x, 0, (0, 0, 0, 4))
        put_px(img, x, 1, (0, 0, 0, 2))

    return img


# ── MAIN ────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    print("🖌️  Pixel Art Generation — Phase B Office Assets (v2)")
    print("=" * 60)

    # 1. Rain Agent Sprites
    print("\n📁 Rain Agent Sprites")
    sprites = {
        'rain_base.png': create_dog_base(64, 64),
        'rain_block.png': create_floor_tile(64, 64),
        'rain_idle.png': create_idle_sheet(64, 64, 2),
        'rain_walk.png': create_walk_sheet(64, 64, 4),
        'rain_work.png': create_work_sheet(64, 64, 2),
        'rain_cheer.png': create_cheer_sheet(64, 64, 2),
    }
    for name, sprite in sprites.items():
        path = f"{AGENTS_DIR}/{name}"
        sprite.save(path)
        px_count = sum(1 for p in sprite.getdata() if p[3] > 0)  # type: ignore
        print(f"  ✅ {name} ({sprite.size[0]}×{sprite.size[1]}, {px_count} visible px)")

    # 2. Conductor Station
    print("\n📁 Conductor Station Props")
    props = {
        'conductor_desk.png': create_conductor_desk(128, 96),
        'conductor_chair.png': create_conductor_chair(64, 96),
        'conductor_monitor.png': create_conductor_monitor(96, 80),
        'guild_banner.png': create_guild_banner(96, 64),
    }
    for name, prop in props.items():
        path = f"{FURN_DIR}/{name}"
        prop.save(path)
        px_count = sum(1 for p in prop.getdata() if p[3] > 0)  # type: ignore
        print(f"  ✅ {name} ({prop.size[0]}×{prop.size[1]}, {px_count} visible px)")

    # 3. Ambient Lighting
    print("\n📁 Ambient Lighting / FX")
    fx = {
        'light_pool.png': create_light_pool(128, 128),
        'crt_scanline.png': create_crt_scanline(4, 4),
    }
    for name, asset in fx.items():
        path = f"{FX_DIR}/{name}"
        asset.save(path)
        px_count = sum(1 for p in asset.getdata() if p[3] > 0)  # type: ignore
        print(f"  ✅ {name} ({asset.size[0]}×{asset.size[1]}, {px_count} visible px)")

    print("\n" + "=" * 60)
    print("🎉 Done! All assets generated.")
