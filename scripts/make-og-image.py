#!/usr/bin/env python3
"""Render the social share card to public/og.png.

Run with /usr/bin/python3 (the system Python has matplotlib):

    /usr/bin/python3 scripts/make-og-image.py

The card carries the framing, not the figures. Numbers here would be a
maintenance trap: an image cached by X, Slack and LinkedIn cannot be corrected
once shared, and a stale "300 MW confirmed" on a tracker whose whole argument
is provenance would undercut the point it exists to make.
"""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import Rectangle  # noqa: E402

BG = "#0A0A0A"
PANEL = "#121212"
LINE = "#242424"
CYAN = "#00D4FF"
FG = "#E8E8E8"
DIM = "#8A8A8A"
AMBER = "#E0A030"

MONO = "Menlo"
SANS = "Helvetica"

OUT = Path(__file__).resolve().parent.parent / "public" / "og.png"

# 1200x630 is the size X, LinkedIn and Slack all crop from.
fig = plt.figure(figsize=(12.0, 6.3), dpi=100)
fig.patch.set_facecolor(BG)
ax = fig.add_axes([0, 0, 1, 1])
ax.set_xlim(0, 1200)
ax.set_ylim(0, 630)
ax.axis("off")
ax.set_facecolor(BG)

# Hairline frame, echoing the app's panel borders.
ax.add_patch(
    Rectangle((40, 40), 1120, 550, facecolor=PANEL, edgecolor=LINE, linewidth=1.5)
)
# Accent bar down the left edge.
ax.add_patch(Rectangle((40, 40), 6, 550, facecolor=CYAN, edgecolor="none"))

# matplotlib has no letter-spacing property, so the tracking that the app's
# eyebrow style relies on is spelled out.
ax.text(
    92, 512, "B E P   R E S E A R C H", color=CYAN, fontsize=13,
    fontfamily=MONO, fontweight="bold",
)

ax.text(
    92, 430, "AI Infrastructure Tracker", color=FG, fontsize=54,
    fontfamily=SANS, fontweight="bold",
)

# The thesis. This is the line that has to survive being read in one second.
ax.text(
    92, 352, "Announced capacity is not operating capacity.", color=CYAN,
    fontsize=27, fontfamily=SANS,
)

ax.text(
    92, 292,
    "Open data on global AI compute, power and supply chain.\n"
    "Every claim carries a source and a confidence level.",
    color=DIM, fontsize=19, fontfamily=SANS, linespacing=1.6, va="top",
)

ax.plot([92, 1108], [188, 188], color=LINE, linewidth=1.5)

for x, label, colour in (
    (92, "CONFIRMED", "#3FB950"),
    (300, "ESTIMATED", AMBER),
    (508, "SITING RISK IN MW", CYAN),
    (860, "MIT / CC BY 4.0", DIM),
):
    ax.add_patch(Rectangle((x, 138), 9, 9, facecolor=colour, edgecolor="none"))
    ax.text(x + 22, 137, label, color=DIM, fontsize=13, fontfamily=MONO)

ax.text(
    92, 82, "tracker.bepresearch.com", color=FG, fontsize=19, fontfamily=MONO,
)

OUT.parent.mkdir(parents=True, exist_ok=True)
fig.savefig(OUT, facecolor=BG, dpi=100)
print(f"wrote {OUT} ({OUT.stat().st_size:,} bytes)")
