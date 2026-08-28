#!/usr/bin/env python3
"""
Vectorize brand/CHU_Blida.png into clean, theme-ready SVGs.

The source logo is flat-colour artwork, so tracing per colour layer with
marching squares gives a faithful vector result without a tracing binary.

Outputs into chublidatheme/omod/src/main/webapp/resources/images/:
  chu-blida-logo.svg      full bilingual lockup (login, wide header)
  chu-blida-wordmark.svg  Latin wordmark only (compact header)
  chu-blida-mark.svg      "C" monogram (app rail, favicon, narrow viewports)
  favicon.svg             monogram on a white rounded ground

Run: python tools/vectorize-logo.py
"""
import os
import numpy as np
from PIL import Image
from skimage import measure

SRC = "brand/CHU_Blida.png"
OUT = "chublidatheme/omod/src/main/webapp/resources/images"

# Brand colours measured from the source artwork.
PALETTE = {
    "deep":  "#0057F1",   # wordmark "BLIDA" + Arabic line
    "mid":   "#4286FF",   # wordmark "CHU" + outer arc of the monogram
    "light": "#76AEFF",   # lower arc of the monogram
    "green": "#3DD8AA",   # inner arc of the monogram
}
# Paint order: darkest last so overlaps resolve the way the raster reads.
ORDER = ["green", "light", "mid", "deep"]

# Regions of interest, measured from the 960x216 source.
CROPS = {
    "logo":     (0, 0, 960, 216),
    "wordmark": (0, 0, 960, 139),
    "mark":     (0, 10, 140, 130),
}

TOLERANCE = 0.75   # polygon simplification, in source pixels
MIN_AREA = 6.0     # drop tracing noise


def hex_to_rgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=int)


def quantize(img):
    """Map every sufficiently opaque pixel to its nearest brand colour."""
    rgb = np.asarray(img)[..., :3].astype(int)
    alpha = np.asarray(img)[..., 3]
    names = list(PALETTE)
    dist = np.stack(
        [np.abs(rgb - hex_to_rgb(PALETTE[n])).sum(axis=2) for n in names],
        axis=0,
    )
    idx = dist.argmin(axis=0)
    opaque = alpha > 128
    return {n: (idx == i) & opaque for i, n in enumerate(names)}


def polygon_area(pts):
    x, y = pts[:, 0], pts[:, 1]
    return 0.5 * abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))


def trace(mask):
    """Marching-squares trace of a binary mask -> list of simplified rings."""
    # Pad so shapes touching the edge still close cleanly.
    padded = np.pad(mask.astype(float), 1, mode="constant")
    rings = []
    for contour in measure.find_contours(padded, 0.5):
        simplified = measure.approximate_polygon(contour, tolerance=TOLERANCE)
        if len(simplified) < 3:
            continue
        # find_contours yields (row, col); SVG wants (x, y). Undo the pad.
        pts = np.column_stack([simplified[:, 1] - 1, simplified[:, 0] - 1])
        if polygon_area(pts) < MIN_AREA:
            continue
        rings.append(pts)
    return rings


def rings_to_path(rings, dx=0.0, dy=0.0):
    parts = []
    for pts in rings:
        segs = [f"M{pts[0][0] - dx:.2f} {pts[0][1] - dy:.2f}"]
        segs += [f"L{x - dx:.2f} {y - dy:.2f}" for x, y in pts[1:]]
        segs.append("Z")
        parts.append("".join(segs))
    return "".join(parts)


def build_svg(layers, box, title, current_color=False):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    body = []
    for name in ORDER:
        mask = layers.get(name)
        if mask is None:
            continue
        window = mask[y0:y1, x0:x1]
        if not window.any():
            continue
        rings = trace(window)
        if not rings:
            continue
        fill = "currentColor" if current_color else PALETTE[name]
        body.append(
            f'  <path fill="{fill}" fill-rule="evenodd" '
            f'd="{rings_to_path(rings)}"/>'
        )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
        f'role="img" aria-label="{title}">\n'
        f"  <title>{title}</title>\n" + "\n".join(body) + "\n</svg>\n"
    )


def main():
    os.makedirs(OUT, exist_ok=True)
    layers = quantize(Image.open(SRC).convert("RGBA"))

    files = {
        "chu-blida-logo.svg": (
            CROPS["logo"], "CHU Blida — Centre Hospitalo-Universitaire de Blida"),
        "chu-blida-wordmark.svg": (CROPS["wordmark"], "CHU Blida"),
        "chu-blida-mark.svg": (CROPS["mark"], "CHU Blida"),
    }
    for filename, (box, title) in files.items():
        svg = build_svg(layers, box, title)
        path = os.path.join(OUT, filename)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(svg)
        print(f"{filename:26} {len(svg):7,d} bytes")

    # Favicon: the monogram centred on a white rounded ground, so the blue
    # mark stays legible against a dark browser chrome.
    x0, y0, x1, y1 = CROPS["mark"]
    inner = build_svg(layers, CROPS["mark"], "CHU Blida")
    inner_body = inner.split(">\n", 2)[2].rsplit("</svg>", 1)[0]
    mw, mh = x1 - x0, y1 - y0
    scale = 44.0 / max(mw, mh)
    tx, ty = (64 - mw * scale) / 2, (64 - mh * scale) / 2
    favicon = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" '
        'role="img" aria-label="CHU Blida">\n'
        "  <title>CHU Blida</title>\n"
        '  <rect width="64" height="64" rx="13" fill="#FFFFFF"/>\n'
        f'  <g transform="translate({tx:.2f} {ty:.2f}) scale({scale:.4f})">\n'
        f"{inner_body}"
        "  </g>\n</svg>\n"
    )
    with open(os.path.join(OUT, "favicon.svg"), "w", encoding="utf-8") as fh:
        fh.write(favicon)
    print(f"{'favicon.svg':26} {len(favicon):7,d} bytes")


if __name__ == "__main__":
    main()
