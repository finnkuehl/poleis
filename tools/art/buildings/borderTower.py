"""borderTower - a tall, slim round watchtower of limestone ashlar on a rocky plinth, standing
directly on the map (grounded, docs/ART.md; the game paints a trodden-earth yard around it): an
arched door up two steps, arrow slits, a corbelled crenellated top with a signal fire and a big
flag; at its foot a stack of firewood for the beacon, spears leaning on the plinth, a water jar,
a sack and a crate, and a marble boundary stone (horos).
The tallest and slimmest silhouette of all buildings.
Accent (owner colour): the flag, the long banner on the wall, the shield over the door."""
import sys

sys.dont_write_bytecode = True
import math  # noqa: E402
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_civic as lc  # noqa: E402
from iso import WOOD, f  # noqa: E402
from lib_civic import STONE, rect  # noqa: E402

# world units; keep everything inside iso.GROUND_R = 58. Human scale: door 16 x 9, person ~14.
POS = (0, -6)
R_PL, Z_PL = 21, 6        # plinth radius and height (footprint 42)
R0, R1 = 16.5, 13.0       # shaft radius at the foot (33 across) and under the parapet
Z_SH = 74                 # top of the shaft (three and a half storeys)
R_PAR = 17.2              # parapet (corbelled out)
Z_PAR = 85                # parapet walk level
Z_MER = 91.5              # merlon tops (the wonder stays the tallest piece)


def tower(c):
    ring = [i * math.pi / 8 for i in range(16)]
    iso.cast_shadow(c, [(R_PL * math.cos(t), R_PL * math.sin(t)) for t in ring],
                    [(R_PAR * math.cos(t), R_PAR * math.sin(t), Z_MER) for t in ring], opacity=0.46)
    x, y = c.P(0, 0, 0)
    c.add(f'<ellipse cx="{f(x + 3)}" cy="{f(y + 1.2)}" rx="{f(R_PL * 1.414 + 3)}" ry="{f(R_PL * 0.707 + 2)}" fill="#24381a" opacity="0.4" filter="{c.blur(1.6)}"/>')
    # plinth: two rough rings
    lc.round_tower(c, R_PL, R_PL - 1, 0, Z_PL / 2, courses=1, seed=11, name="pl0", blocks=9)
    xt, yt = c.P(0, 0, Z_PL / 2)
    c.add(f'<ellipse cx="{f(xt)}" cy="{f(yt)}" rx="{f((R_PL - 1) * 1.414)}" ry="{f((R_PL - 1) * 0.707)}" fill="{STONE["top"]}"/>')
    lc.round_tower(c, R_PL - 2.6, R_PL - 3.4, Z_PL / 2, Z_PL, courses=1, seed=12, name="pl1", blocks=8)
    xt, yt = c.P(0, 0, Z_PL)
    c.add(f'<ellipse cx="{f(xt)}" cy="{f(yt)}" rx="{f((R_PL - 3.4) * 1.414)}" ry="{f((R_PL - 3.4) * 0.707)}" fill="{STONE["top"]}"/>'
          f'<ellipse cx="{f(xt + 2)}" cy="{f(yt + 0.8)}" rx="{f(R0 * 1.414 + 2.5)}" ry="{f(R0 * 0.707 + 1.4)}" fill="#4b4436" opacity="0.4" filter="{c.blur(1)}"/>')
    # steps to the door (toward +b)
    for k in range(2):
        iso.box(c, -2, 9, R_PL - 6, R_PL + 1.5 + 3 * (1 - k), 0, (k + 1) * Z_PL / 2 - 0.2, STONE["top"], STONE["lit"], STONE["right"], edge=STONE["hi"])

    lc.round_tower(c, R0, R1, Z_PL, Z_SH, courses=16, seed=5, name="shaft")
    # shadow of the corbelled top on the shaft
    for dz, op in ((9, 0.14), (5, 0.16), (2, 0.2)):
        lc.ring_band(c, R1 + 0.25, Z_SH - dz, Z_SH, "#3d352a", op)

    # door, shield, arrow slits and banner on the +b side (flat on the tangent plane)
    bq = R0 - 0.9
    zd = Z_PL
    # arched plank door at human scale: opening 9 wide, 16 high (frame 12 x 18)
    zs, zt, zo = zd + 11.5, zd + 16, zd + 18.2
    door = (f'<path d="M-6,{zd} L-6,{zs} Q-6,{zo} 0,{zo} Q6,{zo} 6,{zs} L6,{zd}Z" fill="#efe8d8"/>'
            f'<path d="M-6,{zd} L-6,{zs} Q-6,{zo} 0,{zo}" fill="none" stroke="#fffaf0" stroke-width="0.6"/>'
            f'<path d="M-4.5,{zd} L-4.5,{zs} Q-4.5,{zt} 0,{zt} Q4.5,{zt} 4.5,{zs} L4.5,{zd}Z" fill="#7e5030"/>'
            f'<path d="M-4.5,{zd} L-4.5,{zs} Q-4.5,{zt} 0,{zt} L0,{zd}Z" fill="#9b673d"/>'
            + rect(-0.25, zd, 0.5, 15.8, "#4f301b") + rect(-4.5, zd + 3.6, 9, 1, "#3b3a3a", 0.75) + rect(-4.5, zd + 10, 9, 1, "#3b3a3a", 0.75)
            + f'<circle cx="1.8" cy="{zd + 7.5}" r="0.7" fill="{iso.BRONZE["lit"]}"/>'
            f'<path d="M-4.5,{zs} Q-4.5,{zt} 0,{zt} Q4.5,{zt} 4.5,{zs} L4.5,{zs - 2} Q4.5,{zt - 2} 0,{zt - 2} Q-4.5,{zt - 2} -4.5,{zs - 2}Z" fill="#2a1a0e" opacity="0.4"/>')
    c.add(c.on(c.m_bface(bq - 0.5), f'<g transform="translate(3.5 0)">{door}</g>'))

    def slit(m, x, z):
        return c.on(m, rect(x - 1.7, z - 1, 3.4, 9.5, "#efe8d8") + rect(x - 0.75, z, 1.5, 7.5, "#1c1611") + rect(x - 0.75, z + 6.5, 1.5, 1, "#000", 0.5))

    c.add(slit(c.m_bface(R0 - 3), 3.5, 59))
    c.add(c.on(c.m_aface(R0 - 1.4), rect(-1.7, 30, 3.4, 9.5, "#b3ab9b") + rect(-0.75, 31, 1.5, 7.5, "#17120d"))
          + c.on(c.m_aface(R0 - 2.6), rect(-1.7, 52, 3.4, 9.5, "#aaa293") + rect(-0.75, 53, 1.5, 7.5, "#17120d")))
    lc.shield_b(c, R0 - 2, 3.6, zd + 25.5, r=4.6)
    # long banner hanging from an iron bar under the parapet
    bb = R1 + 0.1
    c.add(c.on(c.m_bface(bb), rect(-2.6, 56.4, 12.8, 0.9, "#3b3a3a")))
    iso.drape_b(c, bb, -1.4, 9, 56.4, 21)
    c.add(c.on(c.m_bface(bb), f'<circle cx="3.8" cy="46" r="2.2" fill="none" stroke="{iso.GOLD["lit"]}" stroke-width="0.8"/>'
               + rect(-1.4, 40.2, 10.4, 0.6, iso.GOLD["lit"], 0.9)))

    # corbelled parapet
    for i in range(14):                                   # corbel stones under the ring
        th = math.pi * (i + 0.5) / 14
        px, py = c.P(0, 0, Z_SH - 3.2)
        rr = (R1 + 1.6) * 1.414
        cx_, cy_ = px + rr * math.cos(th), py + rr / 2 * math.sin(th)
        lit = -math.cos(th)
        c.add(rect(cx_ - 1.2, cy_ - 0.5, 2.4, 4.2, "#d8ceb9" if lit > 0.3 else ("#b9b09f" if lit > -0.3 else "#8a8478")))
    iso.cylinder(c, R_PAR, Z_SH, Z_PAR, lc.TOWER_SIDE, name="par")
    lc.ring_band(c, R_PAR, Z_SH, Z_SH + 1.2, "#3d352a", 0.3)
    c.add(f'<path d="{iso.ring_front_arc(c, R_PAR, Z_SH + 5.4)}" fill="none" stroke="{STONE["joint"]}" stroke-width="0.5" opacity="0.5"/>')
    px, py = c.P(0, 0, Z_SH)
    joints = []
    for k, (za, zb) in enumerate(((Z_SH, Z_SH + 5.4), (Z_SH + 5.4, Z_PAR))):
        for i in range(8):
            th = math.pi * (i + 0.5 * (k + 0.5)) / 8
            if 0.1 < th < math.pi - 0.1:
                jx, jy = px + R_PAR * 1.414 * math.cos(th), py + R_PAR * 0.707 * math.sin(th)
                joints.append(f"M{f(jx)},{f(jy - (za - Z_SH) * iso.ZS)} L{f(jx)},{f(jy - (zb - Z_SH) * iso.ZS)}")
    c.add(f'<path d="{" ".join(joints)}" fill="none" stroke="{STONE["joint"]}" stroke-width="0.5" opacity="0.5"/>')
    px, py = c.P(0, 0, Z_PAR)
    ro, ri = R_PAR * 1.414, (R_PAR - 3.6) * 1.414
    c.add(f'<ellipse cx="{f(px)}" cy="{f(py)}" rx="{f(ro)}" ry="{f(ro / 2)}" fill="{STONE["top"]}"/>')
    lc.round_merlons(c, R_PAR, R_PAR - 3.6, Z_PAR, Z_MER, 10, "back")
    walk = c.lin("walk", px - ri, 0, px + ri, 0, [(0, "#7f786b"), (0.5, "#a39b8c"), (1, "#c2b9a8")])
    c.add(f'<ellipse cx="{f(px)}" cy="{f(py + 1.6)}" rx="{f(ri)}" ry="{f(ri / 2)}" fill="{walk}"/>'
          f'<path d="M{f(px - ri)},{f(py + 1.6)} A{f(ri)},{f(ri / 2)} 0 0 1 {f(px + ri)},{f(py + 1.6)} L{f(px + ri)},{f(py)} A{f(ri)},{f(ri / 2)} 0 0 0 {f(px - ri)},{f(py)}Z" fill="#6f695e"/>')
    # signal fire and flag on the platform
    iso.brazier(c, -4.5, 1.5, Z_PAR - 1.5, k=1.25)
    lc.flag(c, 4.5, -3.5, Z_PAR - 1.5, 33, w=27, h=15.5, wave=2.8, pole=1.7)
    lc.round_merlons(c, R_PAR, R_PAR - 3.6, Z_PAR, Z_MER, 10, "front")
    c.add(f'<path d="{iso.ring_front_arc(c, R_PAR, Z_PAR, 0.3)}" fill="none" stroke="#fffaf0" stroke-width="0.6" opacity="0.7"/>')


def horos(c, a, b, h=9.0):
    """A boundary stone: small marble stele with a red painted band."""
    M = iso.MARBLE
    iso.blob_shadow(c, a + 3.5, b, 3, 0.32)
    iso.box(c, a - 2, a + 2, b - 1.5, b + 1.5, 0, h, M["top"], M["left"], M["right"], edge="#fff")
    c.add(c.on(c.m_bface(b + 1.5), rect(a - 2, h - 3.2, 4, 1.1, "#a8432f")) + c.on(c.m_aface(a + 2), rect(-b - 1.5, h - 3.2, 3, 1.1, "#7d2f20")))


def log_pile(c, a0, a1, b0, b1, h=8.0, seed=3):
    """Firewood for the beacon: a stack of logs lying along b, their round end grain on the lit
    (+b) face, the side of the last log row on the shaded (+a) face."""
    W = WOOD
    rnd = __import__("random").Random(seed)
    iso.cast_shadow(c, [(a0, b0), (a1, b0), (a1, b1), (a0, b1)], [(a0, b0, h), (a1, b0, h), (a1, b1, h), (a0, b1, h)], opacity=0.38, sd=1.2)
    iso.contact_ao(c, a0, a1, b0, b1, width=2.2, opacity=0.35)
    top = c.lin("logtop", 0, 0, 1, 0, [(0, W["lit"]), (1, W["base"])], bbox=True)
    stripes = "".join(rect(a0 + i * (a1 - a0) / 4 - 0.25, b0, 0.5, b1 - b0, W["deep"], 0.5) for i in range(1, 4))
    c.add(c.on(c.m_ground(h), rect(a0, b0, a1 - a0, b1 - b0, top) + stripes))
    side = "".join(rect(-b1, z - 0.3, b1 - b0, 0.6, W["deep"], 0.6) for z in (h / 3, 2 * h / 3))
    c.add(c.on(c.m_aface(a1), rect(-b1, 0, b1 - b0, h, W["base"]) + rect(-b1, 0, b1 - b0, h, W["deep"], 0.35) + side + rect(-b1, h - 0.6, b1 - b0, 0.6, W["lit"])))
    ends = [rect(a0, 0, a1 - a0, h, W["deep"])]
    rows = 3
    rr = h / rows / 2
    for k in range(rows):
        n = int((a1 - a0) / (2 * rr))
        off = (a1 - a0 - n * 2 * rr) / 2 + (rr * 0.5 if k % 2 else 0)
        for i in range(n - (1 if k % 2 else 0)):
            cx, cz = a0 + off + rr + i * 2 * rr, rr + k * 2 * rr
            r_ = rr * rnd.uniform(0.86, 0.98)
            ends.append(f'<circle cx="{f(cx)}" cy="{f(cz)}" r="{f(r_)}" fill="#d9b07a"/>'
                        f'<circle cx="{f(cx)}" cy="{f(cz)}" r="{f(r_ * 0.55)}" fill="none" stroke="#a7784a" stroke-width="0.35"/>'
                        f'<path d="M{f(cx - r_)},{f(cz)} A{f(r_)},{f(r_)} 0 0 0 {f(cx + r_)},{f(cz)}" fill="none" stroke="{W["dark"]}" stroke-width="0.45" opacity="0.7"/>')
    c.add(c.on(c.m_bface(b1), "".join(ends)))


def spears(c, pa, pb):
    """Two spears leaning on the plinth (about 1.5 x a man's height)."""
    for i, (a, col) in enumerate(((-16, "#8a5a34"), (-19, "#a8744a"))):
        p, q = c.P(pa + a - 3, pb + R_PL + 3.5 - i, 0), c.P(pa + a + 1.5, pb + R_PL - 4, 21)
        c.add(f'<ellipse cx="{f(p[0] + 0.8)}" cy="{f(p[1] + 0.3)}" rx="1.6" ry="0.6" fill="{iso.INK}" opacity="0.35"/>'
              f'<path d="M{f(p[0])},{f(p[1])} L{f(q[0])},{f(q[1])}" stroke="{col}" stroke-width="0.9" stroke-linecap="round"/>'
              f'<path d="M{f(q[0] - 0.9)},{f(q[1] + 0.4)} L{f(q[0] + 0.5)},{f(q[1] - 4.6)} L{f(q[0] + 1.1)},{f(q[1] + 0.3)}Z" fill="#c9cbc8"/>')


def build():
    c = iso.Canvas("borderTower")
    iso.ground(c)
    pa, pb = POS
    iso.ground_ao(c, [(pa + R_PL * math.cos(t), pb + R_PL * math.sin(t)) for t in [i * math.pi / 6 for i in range(12)]], grow=7, opacity=0.16)
    with c.at(pa, pb):
        tower(c)
        tufts = [((R_PL * math.cos(t) * 1.02, R_PL * math.sin(t) * 1.02), (R_PL * math.cos(t + 0.3) * 1.02, R_PL * math.sin(t + 0.3) * 1.02))
                 for t in (-0.6, -0.2, 0.3, 0.7, 2.0)]
        iso.foot_tufts(c, tufts, n=9, seed=6, hmax=4, kind="dry", stones=3)
    log_pile(c, -37, -28, 2, 13)
    spears(c, pa, pb)
    iso.amphora(c, pa + 22, pb + 16, k=0.85, shaded=False)
    lc.sack(c, pa + 27, pb + 9, k=0.9)
    lc.crate(c, pa + 30, pb + 1, 3.6, 5.5)
    horos(c, -26, 30)
    iso.pebbles(c, [(30, 30, 1.1, 1), (-22, 40, 1.0, 2)])
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
