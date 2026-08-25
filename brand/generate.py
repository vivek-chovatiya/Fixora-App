"""
Derives every rendering of the Fixora mark from one master file.

`fixora-logo-master.png` beside this script is the artwork. Everything the app
and the launcher use is generated from it, so the in-app logo, the launcher icon
and the adaptive icon cannot drift apart — and re-running this after the master
is replaced is the whole update procedure.

    python brand/generate.py        (from the repository root)

Outputs
    src/assets/brand/fixora-mark[@2x|@3x].png   what BrandMark renders
    android/.../mipmap-*/ic_launcher.png        launcher icon, API 24-25
    android/.../mipmap-*/ic_launcher_round.png  round variant, API 24-25
    android/.../mipmap-*/ic_launcher_foreground.png  adaptive foreground

Requires Pillow. It is a local authoring tool, not an app dependency, so it is
deliberately absent from package.json.
"""

import pathlib

from PIL import Image, ImageDraw

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
MASTER = HERE / "fixora-logo-master.png"

# Corner radius as a share of the tile's edge, matched to the master artwork.
RADIUS = 0.235

# The master is drawn on white. Anything this pale is surround, not artwork.
SURROUND_MIN = 235

# Supersample for the masks, so 48px corners are not staircases.
SS = 4


def _tile() -> Image.Image:
    """
    The master cropped to its blue tile, with the white surround discarded.

    Cropped to the artwork rather than flood-filled from the edges: filling
    leaves a pale halo where the tile was antialiased against white, and that
    halo is exactly what shows as a grey rim on a dark home screen.
    """
    im = Image.open(MASTER).convert("RGB")
    width, height = im.size
    px = im.load()

    left, top, right, bottom = width, height, 0, 0
    for y in range(height):
        for x in range(width):
            r, g, b = px[x, y]
            # Tile pixels are saturated; surround and glyph are both near-white.
            if not (r >= SURROUND_MIN and g >= SURROUND_MIN and b >= SURROUND_MIN):
                left, top = min(left, x), min(top, y)
                right, bottom = max(right, x), max(bottom, y)

    return im.crop((left, top, right + 1, bottom + 1)).convert("RGBA")


def _masked(source: Image.Image, size: int, shape: str) -> Image.Image:
    """The tile at `size`, cut to a rounded square or a circle."""
    art = source.resize((size * SS, size * SS), Image.LANCZOS)

    mask = Image.new("L", art.size, 0)
    draw = ImageDraw.Draw(mask)
    edge = art.size[0]

    if shape == "circle":
        draw.ellipse([0, 0, edge - 1, edge - 1], fill=255)
    else:
        draw.rounded_rectangle([0, 0, edge - 1, edge - 1], radius=edge * RADIUS, fill=255)

    art.putalpha(mask)
    return art.resize((size, size), Image.LANCZOS)


def _glyph(source: Image.Image, size: int) -> Image.Image:
    """
    The white house-and-wrench alone, on transparency.

    Alpha comes from the darkest channel rather than a threshold: the tile is
    saturated blue, so its smallest channel sits near zero, while the glyph is
    white and its smallest channel is near full. Reading that continuously keeps
    the antialiased edge smooth instead of stepping it.
    """
    art = source.resize((size * SS, size * SS), Image.LANCZOS).convert("RGB")
    red, green, blue = art.split()
    alpha = Image.new("L", art.size)
    alpha.putdata(
        [
            min(255, round(min(r, g, b) * 255 / 250))
            for r, g, b in zip(red.getdata(), green.getdata(), blue.getdata())
        ]
    )

    white = Image.new("RGBA", art.size, (255, 255, 255, 0))
    white.putalpha(alpha)
    return white.resize((size, size), Image.LANCZOS)


def _foreground(source: Image.Image, size: int) -> Image.Image:
    """
    Adaptive-icon foreground: the glyph, inset into the 72-of-108 safe zone.

    Anything outside that centre square may be cropped by a launcher's mask, so
    a glyph drawn to the full bleed would lose its roof on a circular icon.
    """
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    safe = round(size * (72 / 108))
    canvas.alpha_composite(_glyph(source, safe), ((size - safe) // 2,) * 2)
    return canvas


def main() -> None:
    source = _tile()
    print(f"master tile: {source.size[0]}x{source.size[1]}")

    brand = ROOT / "src" / "assets" / "brand"
    brand.mkdir(parents=True, exist_ok=True)
    for suffix, px in (("", 128), ("@2x", 256), ("@3x", 384)):
        _masked(source, px, "rounded").save(brand / f"fixora-mark{suffix}.png")

    res = ROOT / "android" / "app" / "src" / "main" / "res"
    legacy = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    adaptive = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}

    for density, px in legacy.items():
        folder = res / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)

        _masked(source, px, "rounded").save(folder / "ic_launcher.png")
        _masked(source, px, "circle").save(folder / "ic_launcher_round.png")
        _foreground(source, adaptive[density]).save(folder / "ic_launcher_foreground.png")

    print("brand assets regenerated from the master")


if __name__ == "__main__":
    main()
