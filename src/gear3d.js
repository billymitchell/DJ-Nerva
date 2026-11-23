// 3D CAD-style gear showcase for the #gear section.
// Source file: bundle with `npm run build:gear3d` -> gear3d.min.js (Three.js is tree-shaken in).
// Generic, logo-free models: all-in-one DJ system, 2-deck controller, direct-drive turntable,
// PA top + sub, split-headband headphones, dynamic handheld mic, USB stick.
import {
    Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, BoxGeometry, CylinderGeometry, TorusGeometry,
    SphereGeometry, BufferGeometry, CatmullRomCurve3, Vector3, Vector2, EdgesGeometry, WireframeGeometry,
    LineSegments, Line, LineLoop, LineBasicMaterial, MeshLambertMaterial, AmbientLight, DirectionalLight,
    Color, GridHelper, Raycaster, Box3, MathUtils
} from 'three';

const section = document.getElementById('gear');
const stage = section?.querySelector('.gear-stage');
const canvas = stage?.querySelector('canvas');
const labelLayer = stage?.querySelector('.gear-labels');
if (section && stage && canvas && labelLayer) init();

function init() {
    let renderer;
    try {
        renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
        return; // no WebGL: the flat SVG drawings stay
    }
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    renderer.setClearColor(0x000000, 0);

    // ---------- Theme colours ----------
    const css = getComputedStyle(document.documentElement);
    const hex = (name, fallback) => {
        const v = css.getPropertyValue(name).trim();
        return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
    };
    const lineColor = new Color(hex('--link-color', '#9fd0f4'));
    const hotColor = new Color('#f3f0e8');            // Paper
    const fillColor = new Color(hex('--ink', '#0b0a12')).lerp(new Color(hex('--tint-card', '#2a2a3a')), 0.16);

    const scene = new Scene();
    scene.add(new AmbientLight(0xffffff, 1.4));
    const key = new DirectionalLight(0xffffff, 1.1);
    key.position.set(-6, 12, 9);
    scene.add(key);

    const fillMaterial = new MeshLambertMaterial({
        color: fillColor, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
    });

    // ---------- Model helpers ----------
    // Every solid part = dark fill (hides back lines) + crisp feature edges, like a hidden-line CAD render.
    const objects = [];
    function makeObject(id, label) {
        const group = new Group();
        const lines = new LineBasicMaterial({ color: lineColor.clone(), transparent: true, opacity: 0.9 });
        const obj = { id, label, group, lines, fills: [], hover: 0, appear: reduceMotion ? 1 : 0 };
        objects.push(obj);
        return obj;
    }
    function solid(obj, geometry, { p = [0, 0, 0], r = [0, 0, 0], parent = obj.group, wire = false, threshold = 18 } = {}) {
        const holder = new Group();
        holder.position.set(...p);
        holder.rotation.set(...r);
        const mesh = new Mesh(geometry, fillMaterial);
        mesh.userData.obj = obj;
        obj.fills.push(mesh);
        holder.add(mesh);
        const edges = wire ? new WireframeGeometry(geometry) : new EdgesGeometry(geometry, threshold);
        holder.add(new LineSegments(edges, obj.lines));
        parent.add(holder);
        return holder;
    }
    function ring(obj, radius, { p = [0, 0, 0], r = [0, 0, 0], parent = obj.group, segments = 64 } = {}) {
        const pts = [];
        for (let i = 0; i < segments; i++) {
            const a = (i / segments) * Math.PI * 2;
            pts.push(new Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
        }
        const loop = new LineLoop(new BufferGeometry().setFromPoints(pts), obj.lines);
        loop.position.set(...p);
        loop.rotation.set(...r);
        parent.add(loop);
        return loop;
    }
    const box = (w, h, d) => new BoxGeometry(w, h, d);
    const cyl = (rt, rb, h, s = 40, open = false) => new CylinderGeometry(rt, rb, h, s, 1, open);
    const FRONT = [Math.PI / 2, 0, 0]; // cylinder axis -> +z (facing the viewer)

    // ---------- Models ----------
    function jog(obj, x, y, z, r) {
        solid(obj, cyl(r, r, 0.12), { p: [x, y, z] });
        solid(obj, cyl(r * 0.7, r * 0.7, 0.06), { p: [x, y + 0.09, z] });
        solid(obj, cyl(r * 0.26, r * 0.26, 0.05), { p: [x, y + 0.13, z] });
        ring(obj, r * 0.86, { p: [x, y + 0.065, z] });
    }
    function pads(obj, cx, z, y, cols = 4, w = 0.36, gap = 0.42) {
        for (let row = 0; row < 2; row++) {
            for (let c = 0; c < cols; c++) {
                solid(obj, box(w, 0.06, w * 0.82), { p: [cx + (c - (cols - 1) / 2) * gap, y, z + row * 0.4] });
            }
        }
    }
    function fader(obj, x, y, z, length, along = 'z') {
        const slot = along === 'z' ? box(0.07, 0.04, length) : box(length, 0.04, 0.07);
        solid(obj, slot, { p: [x, y, z] });
        const cap = along === 'z' ? box(0.3, 0.12, 0.15) : box(0.15, 0.12, 0.3);
        solid(obj, cap, { p: [x + (along === 'x' ? 0.1 : 0), y + 0.07, z + (along === 'z' ? -length * 0.15 : 0)] });
    }

    function allInOne() {
        const o = makeObject('xdj', 'All-in-one DJ system');
        solid(o, box(7.2, 0.5, 4.2), { p: [0, 0.25, 0] });
        const top = 0.56;
        [-2.35, 2.35].forEach(x => { jog(o, x, top, 0.25, 1.12); pads(o, x, 1.45, top, 4); });
        solid(o, box(2.1, 0.08, 1.15), { p: [0, top + 0.12, -1.35], r: [-0.28, 0, 0] });
        for (const x of [-0.55, 0, 0.55]) for (const z of [-0.45, -0.05, 0.35]) solid(o, cyl(0.12, 0.12, 0.12, 16), { p: [x, top, z] });
        fader(o, -0.45, top, 1.3, 0.9);
        fader(o, 0.45, top, 1.3, 0.9);
        fader(o, 0, top, 1.88, 0.9, 'x');
        fader(o, -3.38, top, 0.2, 1.7);
        fader(o, 3.38, top, 0.2, 1.7);
        return o;
    }
    function controller() {
        const o = makeObject('flx4', '2-deck controller');
        solid(o, box(5.3, 0.36, 2.9), { p: [0, 0.18, 0] });
        const top = 0.4;
        [-1.65, 1.65].forEach(x => { jog(o, x, top, -0.1, 0.82); pads(o, x, 0.85, top, 4, 0.26, 0.31); });
        for (const x of [-0.32, 0.32]) for (const z of [-0.95, -0.55, -0.15]) solid(o, cyl(0.1, 0.1, 0.1, 16), { p: [x, top, z] });
        fader(o, -0.3, top, 0.55, 0.7);
        fader(o, 0.3, top, 0.55, 0.7);
        fader(o, 0, top, 1.15, 0.7, 'x');
        return o;
    }
    let platter = null;
    function turntable() {
        const o = makeObject('turntable', 'Direct-drive turntable ×2');
        solid(o, box(4.5, 1.0, 3.5), { p: [0, 0.5, 0] });
        for (const [x, z] of [[-1.9, -1.4], [1.9, -1.4], [-1.9, 1.4], [1.9, 1.4]]) solid(o, cyl(0.26, 0.3, 0.14, 20), { p: [x, -0.07, z] });
        platter = new Group();
        platter.position.set(-0.45, 1.0, 0.05);
        o.group.add(platter);
        solid(o, cyl(1.56, 1.56, 0.16, 72), { p: [0, 0.08, 0], parent: platter });
        solid(o, cyl(1.5, 1.5, 0.02, 72), { p: [0, 0.17, 0], parent: platter });
        solid(o, cyl(0.44, 0.44, 0.024, 40), { p: [0, 0.183, 0], parent: platter });
        solid(o, cyl(0.035, 0.035, 0.26, 8), { p: [0, 0.27, 0], parent: platter });
        for (const r of [0.62, 0.8, 0.98, 1.16, 1.34]) ring(o, r, { p: [0, 0.185, 0], parent: platter });
        // a marker on the label so the spin reads
        solid(o, box(0.3, 0.01, 0.05), { p: [0.2, 0.198, 0], parent: platter });
        // tonearm
        const pivot = [1.55, 1.0, -1.05];
        solid(o, cyl(0.34, 0.38, 0.18, 28), { p: [pivot[0], 1.09, pivot[2]] });
        solid(o, cyl(0.13, 0.13, 0.38, 16), { p: [pivot[0], 1.36, pivot[2]] });
        solid(o, cyl(0.17, 0.17, 0.36, 24), { p: [pivot[0], 1.5, pivot[2] - 0.5], r: FRONT });
        const armPts = [new Vector3(pivot[0], 1.5, pivot[2] - 0.3), new Vector3(pivot[0], 1.5, pivot[2]),
            new Vector3(pivot[0] - 0.05, 1.48, 0.25), new Vector3(0.95, 1.44, 0.95)];
        const arm = new CatmullRomCurve3(armPts);
        o.group.add(new Line(new BufferGeometry().setFromPoints(arm.getPoints(40)), o.lines));
        const arm2 = new CatmullRomCurve3(armPts.map(v => v.clone().add(new Vector3(0.05, 0, 0))));
        o.group.add(new Line(new BufferGeometry().setFromPoints(arm2.getPoints(40)), o.lines));
        solid(o, box(0.2, 0.06, 0.44), { p: [0.9, 1.4, 1.12], r: [0, 0.55, 0] });
        // controls
        fader(o, 1.85, 1.02, 0.65, 1.3);
        solid(o, box(0.58, 0.06, 0.42), { p: [-1.75, 1.03, 1.38] });
        solid(o, box(0.3, 0.05, 0.24), { p: [-1.1, 1.03, 1.45] });
        solid(o, box(0.3, 0.05, 0.24), { p: [-0.7, 1.03, 1.45] });
        return o;
    }
    function speakers() {
        const o = makeObject('pa', 'PA top + subwoofer');
        solid(o, box(2.4, 2.4, 2.4), { p: [0, 1.2, 0] });
        solid(o, cyl(1.0, 1.0, 0.08, 56), { p: [0, 1.25, 1.22], r: FRONT });
        solid(o, cyl(0.32, 0.92, 0.3, 56, true), { p: [0, 1.25, 1.06], r: FRONT });
        solid(o, cyl(0.3, 0.3, 0.06, 32), { p: [0, 1.25, 1.0], r: FRONT });
        solid(o, box(0.7, 0.16, 0.06), { p: [-0.6, 0.25, 1.21] });
        solid(o, box(0.7, 0.16, 0.06), { p: [0.6, 0.25, 1.21] });
        solid(o, cyl(0.07, 0.07, 1.6, 14), { p: [0, 3.2, 0] });
        solid(o, box(1.5, 2.5, 1.4), { p: [0, 5.2, 0] });
        solid(o, cyl(0.58, 0.58, 0.06, 48), { p: [0, 4.75, 0.71], r: FRONT });
        solid(o, cyl(0.2, 0.52, 0.2, 48, true), { p: [0, 4.75, 0.62], r: FRONT });
        solid(o, cyl(0.5, 0.14, 0.38, 4, true), { p: [0, 5.95, 0.53], r: [Math.PI / 2, Math.PI / 4, 0] });
        return o;
    }
    function headphones() {
        const o = makeObject('hd25', 'Split-band headphones');
        const R = 1.2;
        // split headband: two arcs that splay apart at the crown
        for (const tilt of [-0.26, 0.26]) solid(o, new TorusGeometry(R, 0.05, 8, 56, Math.PI), { p: [0, 0, 0], r: [tilt, 0, 0] });
        for (const s of [-1, 1]) {
            const x = s * R;
            solid(o, box(0.14, 0.34, 0.5), { p: [x, -0.12, 0] });                  // yoke
            solid(o, cyl(0.5, 0.5, 0.36, 40), { p: [x + s * 0.06, -0.62, 0], r: [0, 0, Math.PI / 2] }); // cup
            solid(o, cyl(0.36, 0.36, 0.04, 32), { p: [x + s * 0.25, -0.62, 0], r: [0, 0, Math.PI / 2] }); // cap
            solid(o, new TorusGeometry(0.38, 0.12, 10, 36), { p: [x - s * 0.17, -0.62, 0], r: [0, Math.PI / 2, 0] }); // cushion
        }
        // coiled cable from the left cup
        const pts = [];
        for (let i = 0; i <= 420; i++) {
            const t = i / 420;
            const start = new Vector3(-R - 0.05, -1.05, 0);
            if (t < 0.12) { pts.push(start.clone().add(new Vector3(0, -t * 3, 0))); continue; }
            const k = (t - 0.12) / 0.88;
            const a = k * Math.PI * 2 * 16;
            pts.push(new Vector3(-R - 0.05 + Math.cos(a) * 0.1 + k * 0.6, -1.41 - k * 1.3, Math.sin(a) * 0.1 + k * 0.5));
        }
        o.group.add(new Line(new BufferGeometry().setFromPoints(pts), o.lines));
        return o;
    }
    function microphone() {
        const o = makeObject('mic', 'Dynamic handheld mic');
        const body = new Group();
        body.rotation.set(0, 0, -1.25); // lying across, grille to the right
        o.group.add(body);
        solid(o, cyl(0.33, 0.22, 2.2, 32), { p: [0, -0.4, 0], parent: body });
        for (const y of [-1.1, -0.2, 0.45]) ring(o, MathUtils.lerp(0.22, 0.33, (y + 1.5) / 2.2), { p: [0, y, 0], parent: body, segments: 40 });
        solid(o, cyl(0.37, 0.35, 0.16, 36), { p: [0, 0.78, 0], parent: body });
        solid(o, new SphereGeometry(0.485, 28, 18), { p: [0, 1.2, 0], parent: body });
        // ball grille as a wire mesh
        const grille = new LineSegments(new WireframeGeometry(new SphereGeometry(0.5, 14, 9)), o.lines);
        grille.position.set(0, 1.2, 0);
        body.add(grille);
        solid(o, cyl(0.21, 0.21, 0.08, 24), { p: [0, -1.54, 0], parent: body });
        return o;
    }
    function usb() {
        const o = makeObject('usb', 'USB stick');
        solid(o, box(1.7, 0.18, 0.62), { p: [0.2, 0.09, 0] });
        solid(o, box(0.58, 0.1, 0.42), { p: [-0.94, 0.09, 0] });
        solid(o, box(0.12, 0.02, 0.09), { p: [-1.02, 0.15, -0.09] });
        solid(o, box(0.12, 0.02, 0.09), { p: [-1.02, 0.15, 0.09] });
        ring(o, 0.11, { p: [0.85, 0.185, 0], segments: 24 });
        solid(o, box(0.8, 0.02, 0.3), { p: [0.05, 0.185, 0] });
        return o;
    }

    const models = {
        pa: speakers(), turntable: turntable(), xdj: allInOne(), flx4: controller(),
        hd25: headphones(), mic: microphone(), usb: usb()
    };
    const world = new Group();
    scene.add(world);
    objects.forEach(o => world.add(o.group));

    // Blueprint floor
    const grid = new GridHelper(40, 40, lineColor, lineColor);
    grid.material.transparent = true;
    grid.material.opacity = 0.08;
    world.add(grid);

    // ---------- Layouts ----------
    // wide: a two-row "exploded" spread; narrow: a lazy-susan carousel that turns slowly.
    // [x, y, z, scale, yaw] — back row: big gear; front row: the small kit, placed in the gaps.
    const WIDE = {
        pa: [-10.4, 0, -2.2, 0.6, 0.3], turntable: [-5.0, 0, -1.6, 0.95, 0.22], xdj: [1.4, 0, -1.9, 0.86, -0.1],
        flx4: [8.3, 0, -1.4, 0.92, -0.28], hd25: [-1.4, 0.62, 3.6, 0.9, 0.25, -1.32], mic: [-7.3, 0.42, 3.6, 0.95, 0.15],
        usb: [4.8, 0, 3.7, 1.25, -0.45]
    };
    const ORDER = ['xdj', 'turntable', 'pa', 'hd25', 'flx4', 'mic', 'usb'];
    let narrow = false;
    let carousel = 0, carouselTarget = 0;
    const CAROUSEL_R = 6.2;
    function applyLayout() {
        narrow = stage.clientWidth < 760;
        objects.forEach(o => {
            o.group.rotation.set(0, 0, 0);
            if (!narrow) {
                const [x, y, z, s, ry, rx = 0] = WIDE[o.id];
                o.base = { x, y, z, s, ry, rx };
            } else {
                const i = ORDER.indexOf(o.id);
                const a = (i / ORDER.length) * Math.PI * 2;
                const s = { pa: 0.5, turntable: 0.85, xdj: 0.7, flx4: 0.85, hd25: 1.1, mic: 1.1, usb: 1.6 }[o.id];
                const y = { hd25: 1.3, mic: 0.5 }[o.id] || 0;
                o.base = { x: Math.sin(a) * CAROUSEL_R, y, z: Math.cos(a) * CAROUSEL_R, s, ry: a, angle: a };
            }
        });
        resize();
    }

    // ---------- Camera ----------
    const camera = new PerspectiveCamera(28, 2, 0.1, 200);
    const lookAt = new Vector3();
    function resize() {
        const w = stage.clientWidth, h = stage.clientHeight;
        if (!w || !h) return;
        renderer.setPixelRatio(Math.min(devicePixelRatio, narrow ? 1.75 : 2));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        if (narrow) {
            camera.fov = 34;
            camera.position.set(0, 7.5, 17);
            lookAt.set(0, 1.2, 3);
        } else {
            // fit the ~23-unit-wide spread to the stage width
            camera.fov = 26;
            const halfW = 11.0;
            const dist = halfW / Math.tan(MathUtils.degToRad(camera.fov / 2)) / camera.aspect;
            camera.position.set(0, dist * 0.36, dist + 1.2);
            lookAt.set(0, 1.25, 1.0);
        }
        camera.updateProjectionMatrix();
        requestRender();
    }

    // ---------- Labels (CAD callouts) ----------
    objects.forEach(o => {
        const el = document.createElement('div');
        el.className = 'gear-label';
        el.innerHTML = `<span class="gear-label-tick"></span>${o.label}`;
        labelLayer.append(el);
        o.labelEl = el;
        // label anchor: front-bottom centre of the model (measured before layout)
        // Back-row labels sit above their model, front-row labels below, so rows never collide.
        const b = new Box3().setFromObject(o.group);
        o.above = ['pa', 'turntable', 'xdj', 'flx4'].includes(o.id);
        o.anchorTop = new Vector3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2);
        o.anchorBottom = new Vector3((b.min.x + b.max.x) / 2, b.min.y, b.max.z);
    });
    const tmp = new Vector3();
    function placeLabels() {
        const w = stage.clientWidth, h = stage.clientHeight;
        objects.forEach(o => {
            const above = o.above && !narrow;
            tmp.copy(above ? o.anchorTop : o.anchorBottom);
            o.group.localToWorld(tmp);
            tmp.project(camera);
            const x = (tmp.x * 0.5 + 0.5) * w, y = (-tmp.y * 0.5 + 0.5) * h;
            let vis = 1;
            if (narrow) {
                // only the models facing the viewer get a label
                const facing = Math.cos(o.base.angle + carousel);
                vis = MathUtils.clamp((facing - 0.8) * 6, 0, 1);
            }
            vis *= o.appear;
            o.labelEl.classList.toggle('is-above', above);
            o.labelEl.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, ${above ? '-100%' : '0'})`;
            o.labelEl.style.opacity = vis.toFixed(2);
            o.labelEl.classList.toggle('is-hot', o.hover > 0.5);
        });
    }

    // ---------- Interaction ----------
    const pointer = new Vector2(), tilt = new Vector2(), tiltTarget = new Vector2();
    const raycaster = new Raycaster();
    let hovered = null, cardHovered = null;
    const fills = () => objects.flatMap(o => o.fills);
    stage.addEventListener('pointermove', e => {
        const r = stage.getBoundingClientRect();
        pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        tiltTarget.set(pointer.x, pointer.y);
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(fills(), false)[0];
        hovered = hit ? hit.object.userData.obj : null;
        stage.style.cursor = hovered ? 'pointer' : '';
        syncCards();
        requestRender();
    });
    stage.addEventListener('pointerleave', () => { hovered = null; tiltTarget.set(0, 0); syncCards(); requestRender(); });
    stage.addEventListener('click', () => {
        const card = hovered && section.querySelector(`.card[data-gear="${hovered.id}"]`);
        card?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    });

    // Cards <-> models
    section.querySelectorAll('.card[data-gear]').forEach(card => {
        const enter = () => {
            cardHovered = objects.find(o => o.id === card.dataset.gear) || null;
            if (narrow && cardHovered) carouselTarget = -cardHovered.base.angle; // spin it to the front
            requestRender();
        };
        const leave = () => { cardHovered = null; requestRender(); };
        card.addEventListener('pointerenter', enter);
        card.addEventListener('pointerleave', leave);
        card.addEventListener('focusin', enter);
        card.addEventListener('focusout', leave);
        card.addEventListener('click', enter);
    });
    function syncCards() {
        section.querySelectorAll('.card[data-gear]').forEach(card => {
            card.classList.toggle('is-linked', !!hovered && card.dataset.gear === hovered.id);
        });
    }

    // ---------- Render loop (runs only while visible) ----------
    let visible = false, running = false, needsRender = true, last = performance.now(), appearStart = 0;
    function requestRender() {
        needsRender = true;
        if (!running && visible) { running = true; requestAnimationFrame(frame); }
    }
    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        let animating = false;

        if (!reduceMotion) {
            if (appearStart) {
                objects.forEach((o, i) => {
                    const t = MathUtils.clamp((now - appearStart - i * 110) / 900, 0, 1);
                    o.appear = 1 - Math.pow(1 - t, 3);
                    if (t < 1) animating = true;
                });
            }
            tilt.lerp(tiltTarget, 1 - Math.pow(0.002, dt));
            if (tilt.distanceTo(tiltTarget) > 0.001) animating = true;
            if (platter) { platter.rotation.y -= dt * (33.3 / 60) * Math.PI * 2 * 0.25; animating = true; }
            if (narrow) {
                if (!cardHovered && !hovered) carouselTarget -= dt * 0.18;
                carousel += (carouselTarget - carousel) * (1 - Math.pow(0.02, dt));
                animating = true;
            }
        }

        const focus = hovered || cardHovered;
        objects.forEach(o => {
            const target = o === focus ? 1 : 0;
            o.hover += (target - o.hover) * (reduceMotion ? 1 : 1 - Math.pow(0.0005, dt));
            if (Math.abs(target - o.hover) > 0.002) animating = true;
            const b = o.base;
            const lift = o.hover * 0.35 + (1 - o.appear) * -1.2;
            if (narrow) {
                const a = b.angle + carousel;
                o.group.position.set(Math.sin(a) * CAROUSEL_R, b.y + lift, Math.cos(a) * CAROUSEL_R);
                o.group.rotation.y = a * 0.35;
            } else {
                o.group.position.set(b.x, b.y + lift, b.z);
                o.group.rotation.set(b.rx || 0, b.ry, 0, 'YXZ');
            }
            o.group.scale.setScalar(b.s * (1 + o.hover * 0.06));
            o.lines.color.copy(lineColor).lerp(o === focus ? hotColor : lineColor, o.hover);
            const dim = focus && o !== focus ? 0.35 : 0.9;
            o.lines.opacity = (dim + o.hover * 0.1) * o.appear;
        });
        // Wide layout: slow idle sway plus a gentle tilt toward the pointer.
        world.rotation.x = narrow ? 0 : -tilt.y * 0.04;
        world.rotation.y = narrow ? 0 : (reduceMotion ? 0 : Math.sin(now / 9000) * 0.06) + tilt.x * 0.08;
        camera.lookAt(lookAt);
        renderer.render(scene, camera);
        placeLabels();
        needsRender = false;

        if (visible && (animating || needsRender)) requestAnimationFrame(frame);
        else running = false;
    }

    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
            if (!appearStart) appearStart = performance.now();
            last = performance.now();
            requestRender();
        }
    }, { rootMargin: '100px 0px' }).observe(stage);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) requestRender(); });
    new ResizeObserver(() => {
        const was = narrow;
        if ((stage.clientWidth < 760) !== was) applyLayout(); else resize();
    }).observe(stage);

    applyLayout();
    section.classList.add('has-3d');
    stage.classList.add('is-ready');
}
