// Motion layer: scroll reveals, hero intro/parallax/glow, scroll progress.
// Everything here is decorative. With prefers-reduced-motion (or no JS) the
// page renders fully static; content is never hidden unless this file runs.
(() => {
    if (window.__nervaMotion) return; // never initialise twice
    window.__nervaMotion = true;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches || !('IntersectionObserver' in window)) return;
    const root = document.documentElement;
    root.classList.add('motion-ready');

    // ---------- Scroll reveals ----------
    const REVEAL = [
        '.heading-2', '.about-photo', '.about-copy > *', '.embed-item', '.mix-filters',
        '.video-card', '.photo-item', '.map-container', '.places-group',
        '.gear-section .card', '.rates-intro', '.rates-table-wrap', '.booking-actions',
        'footer .flex-col-center > *'
    ].join(',');
    // Headings start fully clipped (zero visible area), so watch their parent instead.
    const proxyFor = new Map();
    let batch = 0;
    let batchTimer = null;
    const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const els = proxyFor.get(entry.target) || [entry.target];
            proxyFor.delete(entry.target);
            io.unobserve(entry.target);
            els.forEach(el => {
            // Stagger items that arrive together, capped so nothing feels slow.
            el.style.setProperty('--reveal-delay', `${Math.min(batch++ * 70, 420)}ms`);
            el.classList.add('is-visible');
            });
        });
        clearTimeout(batchTimer);
        batchTimer = setTimeout(() => { batch = 0; }, 120);
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    const prime = el => {
        if (el.classList.contains('reveal')) return;
        el.classList.add('reveal');
        // Already on screen at load: show immediately (no flash of hidden content).
        const r = el.getBoundingClientRect();
        if (r.top < innerHeight * 0.92 && r.bottom > 0 && performance.now() < 1500) {
            el.classList.add('is-visible');
            return;
        }
        if (el.classList.contains('heading-2') && el.parentElement) {
            const host = el.parentElement;
            if (!proxyFor.has(host)) { proxyFor.set(host, []); io.observe(host); }
            proxyFor.get(host).push(el);
            return;
        }
        io.observe(el);
    };
    const scan = scope => {
        if (scope.matches?.(REVEAL)) prime(scope);
        scope.querySelectorAll?.(REVEAL).forEach(prime);
    };
    const start = () => {
        scan(document);
        // Mixes, gallery tiles and filters are added later by main.js.
        new MutationObserver(records => records.forEach(r => r.addedNodes.forEach(n => n.nodeType === 1 && scan(n))))
            .observe(document.body, { childList: true, subtree: true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

    // ---------- Hero: parallax, content fade, pointer glow ----------
    const hero = document.getElementById('hero-section');
    const header = document.getElementById('site-header');
    const progress = document.createElement('div');
    progress.className = 'scroll-progress';
    progress.setAttribute('aria-hidden', 'true');
    header?.append(progress);

    let ticking = false;
    const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            ticking = false;
            const y = scrollY;
            const max = root.scrollHeight - innerHeight;
            progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
            // Items at the very bottom can't scroll past the reveal line; show them at the end.
            if (max > 0 && y >= max - 4) {
                document.querySelectorAll('.reveal:not(.is-visible)').forEach(el => el.classList.add('is-visible'));
            }
            if (!hero) return;
            const h = hero.offsetHeight;
            if (y > h) return;
            const t = y / h;
            hero.style.setProperty('--hero-shift', `${(y * 0.3).toFixed(1)}px`);
            hero.style.setProperty('--hero-fade', (1 - Math.min(1, t * 2.4)).toFixed(3));
        });
    };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    onScroll();

    if (hero && window.matchMedia('(pointer: fine)').matches) {
        const glow = document.createElement('div');
        glow.className = 'hero-glow';
        glow.setAttribute('aria-hidden', 'true');
        hero.append(glow);
        let raf = 0;
        hero.addEventListener('pointermove', e => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const r = hero.getBoundingClientRect();
                glow.style.setProperty('--mx', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`);
                glow.style.setProperty('--my', `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`);
                glow.classList.add('is-on');
            });
        });
        hero.addEventListener('pointerleave', () => glow.classList.remove('is-on'));
    }

    // ---------- Hero logo collapses into the header ----------
    let logoMorphStarted = false;
    const initLogoMorph = () => {
        if (logoMorphStarted) return;
        logoMorphStarted = true;
        const logo = document.getElementById('logo');
        const slot = document.querySelector('.site-brand svg');
        if (!logo || !slot || !header) return;
        root.classList.add('logo-morph');
        let base = null, target = null, travel = 1;
        const measure = () => {
            logo.style.transform = '';
            const r = logo.getBoundingClientRect();
            const t = slot.getBoundingClientRect();
            base = { x: r.left, y: r.top + scrollY, w: r.width };
            target = { x: t.left, y: t.top, w: t.width };
            // Collapse over about half the hero, finishing while the hero still backs the header.
            const heroH = hero ? hero.offsetHeight : innerHeight;
            travel = Math.max(200, Math.min(heroH * 0.55, heroH - 90));
            update();
        };
        // Ease-out: the logo leads the scroll so it never hangs over the tagline.
        const ease = t => 1 - Math.pow(1 - t, 3);
        const update = () => {
            if (!base || !root.classList.contains('logo-morph')) return;
            const p = Math.min(1, Math.max(0, scrollY / travel));
            const e = ease(p);
            const naturalY = base.y - scrollY;            // where the logo sits right now
            const startY = base.y;                         // where it sat at the top of the page
            const x = base.x + (target.x - base.x) * e;
            const y = startY + (target.y - startY) * e;
            const scale = 1 + (target.w / base.w - 1) * e;
            logo.style.transform = `translate3d(${(x - base.x).toFixed(2)}px, ${(y - naturalY).toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
            header.classList.toggle('brand-docked', p >= 1);
        };
        let queued = false;
        addEventListener('scroll', () => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => { queued = false; update(); });
        }, { passive: true });
        addEventListener('resize', measure, { passive: true });
        measure();
        // Re-measure once the intro animation and web fonts have settled.
        setTimeout(measure, 1200);
        document.fonts?.ready.then(measure);
    };
    // Deferred scripts run before DOMContentLoaded; main.js adds the header logo in that event.
    if (document.readyState === 'complete') initLogoMorph();
    else document.addEventListener('DOMContentLoaded', () => setTimeout(initLogoMorph, 0));

    // If the user turns reduced motion on mid-visit, drop everything.
    reduce.addEventListener?.('change', e => {
        if (e.matches) {
            root.classList.remove('motion-ready', 'logo-morph');
            removeEventListener('scroll', onScroll);
            const logo = document.getElementById('logo');
            if (logo) logo.style.transform = '';
        }
    });
})();
