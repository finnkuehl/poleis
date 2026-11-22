"""borderTower - a tall, slim round watchtower of limestone ashlar on a rocky plinth: arched
door, arrow slits, a corbelled crenellated top with a signal fire, and a big flag.
The tallest and slimmest silhouette of all buildings.
Accent (owner colour): base rim band, the flag, the long banner on the wall, the shield over
the door."""
import sys

sys.dont_write_bytecode = True
import os  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import iso  # noqa: E402
import lib_civic as lc  # noqa: E402
from iso import f  # noqa: E402
from lib_civic import STONE, rect  # noqa: E402
import math  # noqa: E402

POS = (-3, -5)
R_PL, Z_PL = 22, 6        # plinth radius and height
R0, R1 = 16.5, 13.0       # shaft radius at the foot and under the parapet
Z_SH = 80                 # top of the shaft
R_PAR = 17.2              # parapet (corbelled out)
Z_PAR = 91                # parapet walk level
Z_MER = 97.5              # merlon tops


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
    door = (f'<path d="M-5.2,{zd} L-5.2,{zd + 13} Q-5.2,{zd + 19.5} 0,{zd + 19.5} Q5.2,{zd + 19.5} 5.2,{zd + 13} L5.2,{zd}Z" fill="#efe8d8"/>'
            f'<path d="M-5.2,{zd} L-5.2,{zd + 13} Q-5.2,{zd + 19.5} 0,{zd + 19.5}" fill="none" stroke="#fffaf0" stroke-width="0.6"/>'
            f'<path d="M-3.6,{zd} L-3.6,{zd + 12.6} Q-3.6,{zd + 17.4} 0,{zd + 17.4} Q3.6,{zd + 17.4} 3.6,{zd + 12.6} L3.6,{zd}Z" fill="#7e5030"/>'
            f'<path d="M-3.6,{zd} L-3.6,{zd + 12.6} Q-3.6,{zd + 17.4} 0,{zd + 17.4} L0,{zd}Z" fill="#9b673d"/>'
            + rect(-0.25, zd, 0.5, 17.2, "#4f301b") + rect(-3.6, zd + 4, 7.2, 1, "#3b3a3a", 0.75) + rect(-3.6, zd + 11, 7.2, 1, "#3b3a3a", 0.75)
            + f'<circle cx="1.5" cy="{zd + 8}" r="0.7" fill="{iso.BRONZE["lit"]}"/>'
            f'<path d="M-3.6,{zd + 12.6} Q-3.6,{zd + 17.4} 0,{zd + 17.4} Q3.6,{zd + 17.4} 3.6,{zd + 12.6} L3.6,{zd + 10.6} Q3.6,{zd + 15.4} 0,{zd + 15.4} Q-3.6,{zd + 15.4} -3.6,{zd + 10.6}Z" fill="#2a1a0e" opacity="0.4"/>')
    c.add(c.on(c.m_bface(bq - 0.5), f'<g transform="translate(3.5 0)">{door}</g>'))

    def slit(m, x, z):
        return c.on(m, rect(x - 1.7, z - 1, 3.4, 9.5, "#efe8d8") + rect(x - 0.75, z, 1.5, 7.5, "#1c1611") + rect(x - 0.75, z + 6.5, 1.5, 1, "#000", 0.5))

    c.add(slit(c.m_bface(R0 - 3), 3.5, 62))
    c.add(c.on(c.m_aface(R0 - 1.4), rect(-1.7, 30, 3.4, 9.5, "#b3ab9b") + rect(-0.75, 31, 1.5, 7.5, "#17120d"))
          + c.on(c.m_aface(R0 - 2.6), rect(-1.7, 57, 3.4, 9.5, "#aaa293") + rect(-0.75, 58, 1.5, 7.5, "#17120d")))
    lc.shield_b(c, R0 - 2, 3.6, zd + 27.5, r=5)
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


def build():
    c = iso.Canvas("borderTower")
    pa, pb = POS
    iso.base(c, seed=53, tufts=95, flowers=18, avoid=lambda a, b: (a - pa) ** 2 + (b - pb) ** 2 < (R_PL + 3) ** 2 or (-6 < a - pa < 12 and 0 < b - pb < 46))
    iso.rocks(c, [(-44, -30, 4.2, 3), (-37, -38, 2.6, 4), (30, -44, 3.4, 9)])
    iso.olive_tree(c, 38, -36, size=0.7, seed=12)
    with c.at(pa, pb):
        iso.flagstones(c, [(4, R_PL + 9, 8, 5.4, 6), (2, R_PL + 16.5, 7, 5.2, -8), (4.5, R_PL + 24, 7.5, 5.2, 10), (2.5, R_PL + 31.5, 6.5, 5, -4)])
        tower(c)
        tufts = [((R_PL * math.cos(t) * 1.02, R_PL * math.sin(t) * 1.02), (R_PL * math.cos(t + 0.3) * 1.02, R_PL * math.sin(t + 0.3) * 1.02))
                 for t in (-0.6, -0.3, 0.0, 0.3, 0.6, 1.95, 2.2)]
        iso.base_tufts(c, tufts, n=14, seed=6, hmax=4)
    horos(c, -40, 34)
    horos(c, 30, 40)
    iso.rocks(c, [(50, 14, 3.4, 21), (56, 6, 2.2, 22), (-24, 50, 2.4, 23), (45, 21, 1.8, 24)])
    lc.sack(c, 22, 14, k=0.9)
    lc.crate(c, 28, 8, 3.6, 5.5)
    return c.on(m, rect(x - 1.7, z - 1, 3.4, 9.5, "#efe8d8") + rect(x - 0.75, z, 1.5, 7.5, "#1c1611") + rect(x - 0.75, z + 6.5, 1.5, 1, "#000", 0.5))

    c.add(slit(c.m_bface(R0 - 3), 3.5, 62))
    c.add(c.on(c.m_aface(R0 - 1.4), rect(-1.7, 30, 3.4, 9.5, "#b3ab9b") + rect(-0.75, 31, 1.5, 7.5, "#17120d"))
          + c.on(c.m_aface(R0 - 2.6), rect(-1.7, 57, 3.4, 9.5, "#aaa293") + rect(-0.75, 58, 1.5, 7.5, "#17120d")))
    lc.shield_b(c, R0 - 2, 3.6, zd + 27.5, r=5)
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


def build():
    c = iso.Canvas("borderTower")
    pa, pb = POS
    iso.base(c, seed=53, tufts=95, flowers=18, avoid=lambda a, b: (a - pa) ** 2 + (b - pb) ** 2 < (R_PL + 3) ** 2 or (-6 < a - pa < 12 and 0 < b - pb < 46))
    iso.rocks(c, [(-44, -30, 4.2, 3), (-37, -38, 2.6, 4), (30, -44, 3.4, 9)])
    iso.olive_tree(c, 38, -36, size=0.7, seed=12)
    with c.at(pa, pb):
        iso.flagstones(c, [(4, R_PL + 9, 8, 5.4, 6), (2, R_PL + 16.5, 7, 5.2, -8), (4.5, R_PL + 24, 7.5, 5.2, 10), (2.5, R_PL + 31.5, 6.5, 5, -4)])
        tower(c)
        tufts = [((R_PL * math.cos(t) * 1.02, R_PL * math.sin(t) * 1.02), (R_PL * math.cos(t + 0.3) * 1.02, R_PL * math.sin(t + 0.3) * 1.02))
                 for t in (-0.6, -0.3, 0.0, 0.3, 0.6, 1.95, 2.2)]
        iso.base_tufts(c, tufts, n=14, seed=6, hmax=4)
    horos(c, -40, 34)
    horos(c, 30, 40)
    iso.rocks(c, [(50, 14, 3.4, 21), (56, 6, 2.2, 22), (-24, 50, 2.4, 23), (45, 21, 1.8, 24)])
    lc.sack(c, 22, 14, k=0.9)
    lc.crate(c, 28, 8, 3.6, 5.5)
    # spears leaning against the tower wall
    for i, col in enumerate(("#8a5a34", "#a8744a")):
        w = math.radians(98 + i * 9)
        ta, tb = pa + 15.4 * math.cos(w), pb + 15.4 * math.sin(w)
        p, q = c.P(ta - 5 - i, tb + 11, 0), c.P(ta, tb, 31)
        c.add(f'<path d="M{f(p[0])},{f(p[1])} L{f(q[0])},{f(q[1])}" stroke="{col}" stroke-width="0.9" stroke-linecap="round"/>'
              f'<path d="M{f(q[0] - 0.9)},{f(q[1] + 0.4)} L{f(q[0] + 0.5)},{f(q[1] - 4.6)} L{f(q[0] + 1.1)},{f(q[1] + 0.3)}Z" fill="#c9cbc8"/>')
    return c.on(m, rect(x - 1.7, z - 1, 3.4, 9.5, "#efe8d8") + rect(x - 0.75, z, 1.5, 7.5, "#1c1611") + rect(x - 0.75, z + 6.5, 1.5, 1, "#000", 0.5))

    c.add(slit(c.m_bface(R0 - 3), 3.5, 62))
    c.add(c.on(c.m_aface(R0 - 1.4), rect(-1.7, 30, 3.4, 9.5, "#b3ab9b") + rect(-0.75, 31, 1.5, 7.5, "#17120d"))
          + c.on(c.m_aface(R0 - 2.6), rect(-1.7, 57, 3.4, 9.5, "#aaa293") + rect(-0.75, 58, 1.5, 7.5, "#17120d")))
    lc.shield_b(c, R0 - 2, 3.6, zd + 27.5, r=5)
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


def build():
    c = iso.Canvas("borderTower")
    pa, pb = POS
    iso.base(c, seed=53, tufts=95, flowers=18, avoid=lambda a, b: (a - pa) ** 2 + (b - pb) ** 2 < (R_PL + 3) ** 2 or (-6 < a - pa < 12 and 0 < b - pb < 46))
    iso.rocks(c, [(-44, -30, 4.2, 3), (-37, -38, 2.6, 4), (30, -44, 3.4, 9)])
    iso.olive_tree(c, 38, -36, size=0.7, seed=12)
    with c.at(pa, pb):
        iso.flagstones(c, [(4, R_PL + 9, 8, 5.4, 6), (2, R_PL + 16.5, 7, 5.2, -8), (4.5, R_PL + 24, 7.5, 5.2, 10), (2.5, R_PL + 31.5, 6.5, 5, -4)])
        tower(c)
        tufts = [((R_PL * math.cos(t) * 1.02, R_PL * math.sin(t) * 1.02), (R_PL * math.cos(t + 0.3) * 1.02, R_PL * math.sin(t + 0.3) * 1.02))
                 for t in (-0.6, -0.3, 0.0, 0.3, 0.6, 1.95, 2.2)]
        iso.base_tufts(c, tufts, n=14, seed=6, hmax=4)
    horos(c, -40, 34)
    horos(c, 30, 40)
    iso.rocks(c, [(50, 14, 3.4, 21), (56, 6, 2.2, 22), (-24, 50, 2.4, 23), (45, 21, 1.8, 24)])
    lc.sack(c, 22, 14, k=0.9)
    lc.crate(c, 28, 8, 3.6, 5.5)
    # spears leaning against the plinth
    for i, (a, col) in enumerate(((-19, "#8a5a34"), (-22.5, "#a8744a"))):
        p, q = c.P(a - 3, pb + R_PL + 3 - i, 0), c.P(a + 2, pb + R_PL - 6, 30)
        c.add(f'<path d="M{f(p[0])},{f(p[1])} L{f(q[0])},{f(q[1])}" stroke="{col}" stroke-width="0.9" stroke-linecap="round"/>'
              f'<path d="M{f(q[0] - 0.9)},{f(q[1] + 0.4)} L{f(q[0] + 0.5)},{f(q[1] - 4.6)} L{f(q[0] + 1.1)},{f(q[1] + 0.3)}Z" fill="#c9cbc8"/>')
    return c


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "..", "public", "assets", "buildings")
    print("\n".join(build().write(out)))
