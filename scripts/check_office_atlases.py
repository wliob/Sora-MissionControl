#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, cast

from PIL import Image

warnings.filterwarnings(
    'ignore',
    message='Image.Image.getdata is deprecated and will be removed in Pillow 14 \(2027-10-15\)\. Use get_flattened_data instead\.',
    category=DeprecationWarning,
)

ATLAS_DIR = Path('public/assets/atlases')
STATIC_ATLASES = ['agents', 'furniture-0', 'furniture-1', 'fx']
AGENTS = ['cloud', 'biscuit', 'korra', 'lelouch', 'tifa']
ANIM_TYPES = ['idle', 'walk', 'work', 'cheer']
CHROMA_MAX_R = 5
CHROMA_MIN_G = 250
CHROMA_MAX_B = 5
CHROMA_MIN_A = 240

Pixel = tuple[int, int, int, int]


@dataclass
class FrameIssue:
    atlas_name: str
    frame_name: str
    problem: str


def iter_atlas_names() -> Iterable[str]:
    yield from STATIC_ATLASES
    for agent in AGENTS:
        for anim_type in ANIM_TYPES:
            yield f'{agent}_{anim_type}'


def is_opaque_chroma(pixel: Pixel) -> bool:
    r, g, b, a = pixel
    return r <= CHROMA_MAX_R and g >= CHROMA_MIN_G and b <= CHROMA_MAX_B and a >= CHROMA_MIN_A


def rgba_pixels(image: Image.Image) -> list[Pixel]:
    return [cast(Pixel, pixel) for pixel in image.getdata()]


def load_atlas_payload(atlas_dir: Path, atlas_name: str) -> tuple[dict, Path, Path]:
    json_path = atlas_dir / f'{atlas_name}.json'
    data = json.loads(json_path.read_text())
    image_name = (data.get('meta') or {}).get('image') or f'{atlas_name}.webp'
    image_path = atlas_dir / image_name
    return data, json_path, image_path


def max_frame_bounds(data: dict) -> tuple[int, int]:
    frames = list((data.get('frames') or {}).values())
    max_x = max(frame['frame']['x'] + frame['frame']['w'] for frame in frames)
    max_y = max(frame['frame']['y'] + frame['frame']['h'] for frame in frames)
    return int(max_x), int(max_y)


def repair_atlas_image_and_json(atlas_dir: Path, atlas_name: str) -> tuple[int, tuple[int, int], tuple[int, int]]:
    data, json_path, image_path = load_atlas_payload(atlas_dir, atlas_name)
    image = Image.open(image_path).convert('RGBA')
    original_size = image.size
    target_w, target_h = max_frame_bounds(data)
    target_w = max(target_w, image.width)
    target_h = max(target_h, image.height)

    if image.size != (target_w, target_h):
        padded = Image.new('RGBA', (target_w, target_h), (0, 0, 0, 0))
        padded.paste(image, (0, 0))
        image = padded

    pixels = rgba_pixels(image)
    replaced = 0
    rewritten: list[Pixel] = []
    for pixel in pixels:
        if is_opaque_chroma(pixel):
            rewritten.append((pixel[0], pixel[1], pixel[2], 0))
            replaced += 1
        else:
            rewritten.append(pixel)

    changed_size = image.size != original_size
    if replaced > 0 or changed_size:
        image.putdata(rewritten)
        image.save(image_path, format='WEBP', lossless=True, method=6)

    meta = data.setdefault('meta', {})
    meta_size = meta.setdefault('size', {})
    if meta_size.get('w') != image.width or meta_size.get('h') != image.height:
        meta_size['w'] = image.width
        meta_size['h'] = image.height
        json_path.write_text(json.dumps(data, indent=2) + '\n')

    return replaced, original_size, image.size


def inspect_atlas(atlas_dir: Path, atlas_name: str) -> tuple[list[FrameIssue], int, int]:
    json_path = atlas_dir / f'{atlas_name}.json'
    if not json_path.exists():
        return [FrameIssue(atlas_name, '*', f'missing atlas json: {json_path}')], 0, 0

    data, _json_path, image_path = load_atlas_payload(atlas_dir, atlas_name)
    meta = data.get('meta') or {}
    if not image_path.exists():
        return [FrameIssue(atlas_name, '*', f'missing atlas image: {image_path}')], 0, 0

    image = Image.open(image_path).convert('RGBA')
    issues: list[FrameIssue] = []
    total_chroma_pixels = 0

    if tuple(image.size) != (meta.get('size', {}).get('w'), meta.get('size', {}).get('h')):
        issues.append(
            FrameIssue(
                atlas_name,
                '*',
                f'meta.size {meta.get("size")} does not match image size {image.size}',
            )
        )

    for frame_name, frame_def in (data.get('frames') or {}).items():
        frame = frame_def.get('frame') or {}
        x = int(frame.get('x', -1))
        y = int(frame.get('y', -1))
        w = int(frame.get('w', -1))
        h = int(frame.get('h', -1))
        if x < 0 or y < 0 or w <= 0 or h <= 0:
            issues.append(FrameIssue(atlas_name, frame_name, f'invalid frame rect {frame}'))
            continue
        if x + w > image.width or y + h > image.height:
            issues.append(
                FrameIssue(
                    atlas_name,
                    frame_name,
                    f'frame rect {frame} exceeds image bounds {image.size}',
                )
            )
            continue
        crop = image.crop((x, y, x + w, y + h))
        chroma_pixels = sum(1 for pixel in rgba_pixels(crop) if is_opaque_chroma(pixel))
        total_chroma_pixels += chroma_pixels
        if chroma_pixels > 0:
            issues.append(
                FrameIssue(
                    atlas_name,
                    frame_name,
                    f'{chroma_pixels} opaque chroma pixels remain in frame rect',
                )
            )

    return issues, total_chroma_pixels, len(data.get('frames') or {})


def main() -> int:
    parser = argparse.ArgumentParser(
        description='Check Mission Control office atlases for chroma-key corruption and invalid frame bounds.',
    )
    parser.add_argument('--atlas-dir', default=str(ATLAS_DIR))
    parser.add_argument(
        '--rewrite-chroma',
        action='store_true',
        help='Convert opaque chroma-key green pixels to transparent alpha and pad atlas images to fit declared frame bounds.',
    )
    args = parser.parse_args()

    atlas_dir = Path(args.atlas_dir)
    if not atlas_dir.exists():
        print(f'ERROR: atlas dir not found: {atlas_dir}', file=sys.stderr)
        return 2

    rewritten_total = 0
    if args.rewrite_chroma:
        print(f'Repairing opaque chroma pixels and atlas bounds in {atlas_dir}...')
        touched = 0
        for atlas_name in iter_atlas_names():
            replaced, before_size, after_size = repair_atlas_image_and_json(atlas_dir, atlas_name)
            if replaced > 0 or before_size != after_size:
                touched += 1
                rewritten_total += replaced
                size_note = '' if before_size == after_size else f' size {before_size} -> {after_size}'
                print(f'  fixed {atlas_name:<16} {replaced:>8} pixels{size_note}')
        print(f'Rewrite summary: {rewritten_total} pixels sanitized across {touched} atlas image(s).')

    all_issues: list[FrameIssue] = []
    total_chroma_pixels = 0
    total_frames = 0
    for atlas_name in iter_atlas_names():
        issues, chroma_pixels, frame_count = inspect_atlas(atlas_dir, atlas_name)
        all_issues.extend(issues)
        total_chroma_pixels += chroma_pixels
        total_frames += frame_count

    if all_issues:
        print('OFFICE ATLAS CHECK FAILED')
        print(f'Atlas dir: {atlas_dir}')
        print(f'Frames scanned: {total_frames}')
        print(f'Opaque chroma pixels found: {total_chroma_pixels}')
        for issue in all_issues:
            print(f'- {issue.atlas_name}:{issue.frame_name} -> {issue.problem}')
        return 1

    print('OFFICE ATLAS CHECK PASSED')
    print(f'Atlas dir: {atlas_dir}')
    print(f'Frames scanned: {total_frames}')
    print(f'Opaque chroma pixels found: {total_chroma_pixels}')
    if args.rewrite_chroma:
        print(f'Pixels sanitized in this run: {rewritten_total}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
