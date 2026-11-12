"""Usage: python3 scripts/gear_art.py > /tmp/gear-art.html

Generate original CAD-style line drawings of generic DJ gear as inline SVG.

Strokes use currentColor so CSS can tint them with the site's theme.
No brand names or logos; layouts are generic, not copies of any one product.
"""
import math

def f(v):
    return f"{v:.1f}".rstrip('0').rstrip('.')

class S:
    def __init__(self, w, h):
        self.w, self.h, self.parts = w, h, []
    def add(self, s): self.parts.append(s)
    def rect(self, x, y, w, h, r=0, cls=''):
        self.add(f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}"' + (f' rx="{f(r)}"' if r else '') + (f' class="{cls}"' if cls else '') + '/>')
    def circle(self, cx, cy, r, cls=''):
        self.add(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}"' + (f' class="{cls}"' if cls else '') + '/>')
    def line(self, x1, y1, x2, y2, cls=''):
        self.add(f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}"' + (f' class="{cls}"' if cls else '') + '/>')
    def path(self, d, cls=''):
        self.add(f'<path d="{d}"' + (f' class="{cls}"' if cls else '') + '/>')
    def text(self, x, y, t, anchor='middle', rot=0):
        tr = f' transform="rotate({rot} {f(x)} {f(y)})"' if rot else ''
        self.add(f'<text x="{f(x)}" y="{f(y)}" text-anchor="{anchor}"{tr}>{t}</text>')
    # CAD helpers
    def dim_h(self, x1, x2, y, label, ext_from=None):
        if ext_from is not None:
            self.line(x1, ext_from, x1, y + 6, 'thin')
            self.line(x2, ext_from, x2, y + 6, 'thin')
        self.line(x1, y, x2, y, 'thin')
        for x, d in ((x1, 1), (x2, -1)):
            self.path(f'M{f(x)} {f(y)} l{f(10*d)} -4 M{f(x)} {f(y)} l{f(10*d)} 4', 'thin')
        self.text((x1 + x2) / 2, y - 7, label)
    def dim_v(self, y1, y2, x, label, ext_from=None):
        if ext_from is not None:
            self.line(ext_from, y1, x - 6, y1, 'thin')
            self.line(ext_from, y2, x - 6, y2, 'thin')
        self.line(x, y1, x, y2, 'thin')
        for y, d in ((y1, 1), (y2, -1)):
            self.path(f'M{f(x)} {f(y)} l-4 {f(10*d)} M{f(x)} {f(y)} l4 {f(10*d)}', 'thin')
        self.text(x - 8, (y1 + y2) / 2, label, rot=-90)
    def centermark(self, cx, cy, r):
        self.line(cx - r, cy, cx + r, cy, 'center')
        self.line(cx, cy - r, cx, cy + r, 'center')
    def knob(self, cx, cy, r=9):
        self.circle(cx, cy, r)
        self.line(cx, cy, cx, cy - r + 2)
    def fader(self, x, y, length, vertical=True, cap=(16, 8)):
        if vertical:
            self.rect(x - 2, y, 4, length, 2, 'thin')
            self.rect(x - cap[0] / 2, y + length * 0.55, cap[0], cap[1], 1.5)
            for i in range(0, 11):
                self.line(x + 6, y + i * length / 10, x + 10, y + i * length / 10, 'thin')
        else:
            self.rect(x, y - 2, length, 4, 2, 'thin')
            self.rect(x + length / 2 - cap[1] / 2, y - cap[0] / 2, cap[1], cap[0], 1.5)
    def svg(self, cls):
        return (f'<svg class="{cls}" viewBox="0 0 {self.w} {self.h}" xmlns="http://www.w3.org/2000/svg" '
                f'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" focusable="false">'
                + ''.join(self.parts) + '</svg>')


def jog(s, cx, cy, r):
    s.circle(cx, cy, r + 10)          # outer ring / platter edge
    s.circle(cx, cy, r)
    s.circle(cx, cy, r * 0.72)        # touch surface
    s.circle(cx, cy, r * 0.30)        # center display
    s.circle(cx, cy, r * 0.12)
    for a in range(0, 360, 15):        # knurled edge ticks
        t = math.radians(a)
        s.line(cx + math.cos(t) * r, cy + math.sin(t) * r, cx + math.cos(t) * (r + 10), cy + math.sin(t) * (r + 10), 'thin')
    s.centermark(cx, cy, r + 28)


def all_in_one():
    s = S(900, 560)
    X, Y, W, H = 50, 70, 800, 420
    s.rect(X, Y, W, H, 18)
    s.rect(X + 8, Y + 8, W - 16, H - 16, 12, 'thin')
    # center screen + mixer
    mx, mw = X + W / 2 - 110, 220
    s.rect(mx, Y + 22, mw, 92, 6)
    s.rect(mx + 8, Y + 30, mw - 16, 76, 3, 'thin')
    for i in range(5):
        s.line(mx + 18, Y + 44 + i * 12, mx + mw - 18 - (i % 2) * 40, Y + 44 + i * 12, 'thin')
    s.line(mx, Y + 126, mx, Y + H - 20, 'thin')
    s.line(mx + mw, Y + 126, mx + mw, Y + H - 20, 'thin')
    for ch, cx in enumerate((mx + 62, mx + mw - 62)):
        for row in range(4):
            s.knob(cx, Y + 148 + row * 40, 11 if row else 13)
        s.fader(cx, Y + 316, 70)
    for row in range(4):
        s.knob(mx + mw / 2, Y + 160 + row * 40, 8)
    s.fader(mx + mw / 2 - 45, Y + H - 34, 90, vertical=False)
    # decks
    for side, cx in ((-1, X + 175), (1, X + W - 175)):
        jog(s, cx, Y + 190, 104)
        # pads 2x4
        px = cx - 92
        for r in range(2):
            for c in range(4):
                s.rect(px + c * 47, Y + 330 + r * 38, 38, 30, 4)
        # transport buttons
        bx = cx - 150 if side < 0 else cx + 112
        s.circle(bx + 18, Y + 338, 15)
        s.path(f'M{f(bx+13)} {f(Y+330)} l12 8 l-12 8 z', 'thin')
        s.circle(bx + 18, Y + 378, 15)
        # pitch fader on the outer edge
        s.fader(X + 40 if side < 0 else X + W - 40, Y + 70, 200)
        # browse knob
        s.knob(cx + (64 if side < 0 else -64), Y + 52, 12)
    # dimensions
    s.dim_h(X, X + W, Y - 34, '800 mm', ext_from=Y - 8)
    s.dim_v(Y, Y + H, X - 26, '420', ext_from=X - 6)
    s.text(X + W, Y + H + 40, 'ALL-IN-ONE DJ SYSTEM · TOP VIEW', anchor='end')
    return s.svg('gear-art-piece gear-art-console')


def turntable():
    s = S(620, 560)
    X, Y, W, H = 40, 70, 520, 400
    s.rect(X, Y, W, H, 14)
    s.rect(X + 10, Y + 10, W - 20, H - 20, 8, 'thin')
    cx, cy, R = X + 205, Y + 205, 165
    s.circle(cx, cy, R + 6)                       # platter rim
    for i in range(0, 360, 6):                    # strobe dots
        t = math.radians(i)
        s.circle(cx + math.cos(t) * (R + 1), cy + math.sin(t) * (R + 1), 1.2, 'thin')
    s.circle(cx, cy, R - 6)                       # record
    for rr in range(int(R - 18), 64, -10):        # grooves
        s.circle(cx, cy, rr, 'thin')
    s.circle(cx, cy, 52)                          # label
    s.circle(cx, cy, 4)                           # spindle
    s.centermark(cx, cy, R + 34)
    # tonearm
    px, py = X + W - 78, Y + 72
    s.circle(px, py, 30)
    s.circle(px, py, 14)
    s.rect(px - 16, py - 74, 32, 30, 6)           # counterweight
    s.line(px, py - 44, px, py - 30)
    # arm: straight tube down the right side, angled toward the record
    hx_, hy_ = cx + 92, cy + 98                     # stylus point over the grooves
    bend = (px - 6, py + 150)
    s.path(f'M{f(px-4)} {f(py+14)} L{f(bend[0]-4)} {f(bend[1])} L{f(hx_+16)} {f(hy_-10)}')
    s.path(f'M{f(px+4)} {f(py+14)} L{f(bend[0]+4)} {f(bend[1]+4)} L{f(hx_+22)} {f(hy_-3)}')
    # headshell: small angled plate with finger lift
    s.path(f'M{f(hx_+12)} {f(hy_-16)} L{f(hx_+30)} {f(hy_+4)} L{f(hx_+8)} {f(hy_+24)} L{f(hx_-10)} {f(hy_+4)} Z')
    s.line(hx_+30, hy_+4, hx_+46, hy_+12)
    s.circle(hx_ + 6, hy_ + 6, 2.5)
    s.circle(px + 46, py + 18, 9)                 # anti-skate dial
    s.rect(px + 38, py + 70, 16, 70, 4, 'thin')   # arm rest
    # pitch fader + buttons
    s.fader(X + W - 46, Y + 230, 130)
    s.rect(X + 22, Y + H - 62, 70, 40, 6)          # start/stop
    s.text(X + 57, Y + H - 36, 'START')
    s.rect(X + 104, Y + H - 56, 34, 28, 5)
    s.rect(X + 146, Y + H - 56, 34, 28, 5)
    s.circle(X + 34, Y + 34, 10)                  # target light
    s.dim_h(X, X + W, Y - 34, '450 mm', ext_from=Y - 8)
    s.text(X + W, Y + H + 40, 'DIRECT-DRIVE TURNTABLE · TOP VIEW', anchor='end')
    return s.svg('gear-art-piece gear-art-turntable')


def speaker_stack():
    s = S(440, 960)
    # top cabinet
    X, Y, W, H = 110, 60, 220, 360
    s.path(f'M{X+10} {Y} H{X+W-10} Q{X+W} {Y} {X+W} {Y+10} V{Y+H-10} Q{X+W} {Y+H} {X+W-10} {Y+H} H{X+10} Q{X} {Y+H} {X} {Y+H-10} V{Y+10} Q{X} {Y} {X+10} {Y} Z')
    s.rect(X + 10, Y + 10, W - 20, H - 20, 6, 'thin')
    # horn
    hx, hy = X + W / 2, Y + 70
    s.path(f'M{f(hx-80)} {f(hy-36)} H{f(hx+80)} L{f(hx+24)} {f(hy+30)} H{f(hx-24)} Z')
    s.path(f'M{f(hx-62)} {f(hy-26)} H{f(hx+62)} L{f(hx+16)} {f(hy+22)} H{f(hx-16)} Z', 'thin')
    s.circle(hx, hy + 2, 8, 'thin')
    # woofer
    wy = Y + 240
    for rr, c in ((92, ''), (84, 'thin'), (70, ''), (40, 'thin'), (26, ''), (12, 'thin')):
        s.circle(hx, wy, rr, c)
    for a in range(0, 360, 45):
        t = math.radians(a + 22.5)
        s.circle(hx + math.cos(t) * 88, wy + math.sin(t) * 88, 2.5, 'thin')
    s.centermark(hx, wy, 112)
    # pole
    s.rect(hx - 9, Y + H, 18, 150, 3)
    s.line(hx - 3, Y + H + 10, hx - 3, Y + H + 140, 'thin')
    # sub
    SX, SY, SW, SH = 60, Y + H + 150, 320, 330
    s.rect(SX, SY, SW, SH, 10)
    s.rect(SX + 10, SY + 10, SW - 20, SH - 20, 6, 'thin')
    s.circle(hx, SY + 16 + 6, 12)                 # pole socket
    sy = SY + SH / 2 + 10
    for rr, c in ((130, ''), (120, 'thin'), (100, ''), (56, 'thin'), (36, ''), (16, 'thin')):
        s.circle(hx, sy, rr, c)
    s.centermark(hx, sy, 150)
    s.rect(SX + 20, SY + SH - 30, 50, 12, 6, 'thin')      # port
    s.rect(SX + SW - 70, SY + SH - 30, 50, 12, 6, 'thin')
    # dimensions
    s.dim_v(Y, SY + SH, X - 70 + 40, '1.9 m', ext_from=X - 8)
    s.text(SX + SW, SY + SH + 40, 'PA TOP + SUB · FRONT', anchor='end')
    return s.svg('gear-art-piece gear-art-speakers')


if __name__ == '__main__':
    # Prints the <div class="gear-art"> block; paste it into the #gear section of index.html.
    print('<div class="gear-art" aria-hidden="true">\n'
          + all_in_one() + '\n' + turntable() + '\n' + speaker_stack() + '\n</div>')
