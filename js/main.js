/* ============================================================
   ROSHAN MOHAN — PORTFOLIO SCRIPTS
   ============================================================ */

(function () {
    'use strict';

    /* ---- Mobile Nav Toggle ---- */
    var burger = document.getElementById('headerBurger');
    var nav = document.getElementById('headerNav');
    if (burger && nav) {
        burger.addEventListener('click', function () {
            var isOpen = nav.classList.toggle('open');
            burger.setAttribute('aria-expanded', isOpen);
        });

        nav.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () {
                nav.classList.remove('open');
                burger.setAttribute('aria-expanded', 'false');
            });
        });
    }

    /* ---- Scroll Reveal (IntersectionObserver with stagger) ---- */
    var reveals = document.querySelectorAll('.reveal');
    if (reveals.length) {
        var revealObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    var siblings = entry.target.parentElement.querySelectorAll('.reveal');
                    var index = Array.from(siblings).indexOf(entry.target);
                    entry.target.style.transitionDelay = (index * 0.08) + 's';
                    entry.target.classList.add('visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.12,
            rootMargin: '0px 0px -30px 0px'
        });

        reveals.forEach(function (el) { revealObserver.observe(el); });
    }

    /* ---- Hero "boundary" ----
       An engineering-drawing arc whose radius is the headline (the headline's
       dash-dot underline is the radius line, see .hero__title::after). The first
       time the visitor scrolls, the boundary is pushed out by one inch (96 CSS px)
       and stays there until the page is reloaded. */
    var hero = document.querySelector('.hero');
    var heroTitle = document.querySelector('.hero__title');
    var boundary = document.querySelector('.hero__boundary');
    if (hero && heroTitle && boundary) {
        var SVG_NS = 'http://www.w3.org/2000/svg';
        var INCH = 96;
        var geo = null;      // centre, base radius and hero height, from the headline
        var stretch = 0;     // 0 → INCH once the boundary has been pushed

        function shape(tag, cls) {
            var node = document.createElementNS(SVG_NS, tag);
            node.setAttribute('class', cls);
            boundary.appendChild(node);
            return node;
        }

        var ghostArc = shape('path', 'boundary__ghost');
        var arc = shape('path', 'boundary__arc');
        var markH = shape('line', 'boundary__mark');
        var markV = shape('line', 'boundary__mark');

        function setLine(node, x1, y1, x2, y2) {
            node.setAttribute('x1', x1); node.setAttribute('y1', y1);
            node.setAttribute('x2', x2); node.setAttribute('y2', y2);
        }

        // Arc of radius r around (cx, cy), running from the top of the hero to the bottom
        function arcPath(cx, cy, r, height) {
            function point(y) {
                var dy = Math.max(-r, Math.min(r, y - cy));
                return (cx + Math.sqrt(r * r - dy * dy)) + ' ' + (cy + dy);
            }
            return 'M' + point(-2) + ' A' + r + ' ' + r + ' 0 0 1 ' + point(height + 2);
        }

        // Centre = start of the headline's underline, radius = the headline's text width.
        // The scroll tilt animation is paused while measuring so it doesn't skew the result.
        function measure() {
            var animation = heroTitle.style.animation;
            heroTitle.style.animation = 'none';
            var heroBox = hero.getBoundingClientRect();
            var range = document.createRange();
            range.selectNodeContents(heroTitle.firstChild);   // the headline text only
            var rects = Array.from(range.getClientRects());
            var titleBottom = heroTitle.getBoundingClientRect().bottom;
            heroTitle.style.animation = animation;
            if (!rects.length) return;

            var left = Math.min.apply(null, rects.map(function (r) { return r.left; }));
            var right = Math.max.apply(null, rects.map(function (r) { return r.right; }));
            geo = {
                cx: left - heroBox.left,
                cy: titleBottom - heroBox.top + 9.5,   // centre of the underline (bottom: -10px, 1px tall)
                r: right - left,
                height: heroBox.height
            };
            heroTitle.style.setProperty('--underline-width', geo.r + 'px');
        }

        function draw() {
            if (!geo) return;
            var cx = geo.cx, cy = geo.cy, r0 = geo.r, r = r0 + stretch;
            var pushed = stretch / INCH;   // 0 → 1

            setLine(markH, cx - 10, cy, cx + 10, cy);
            setLine(markV, cx, cy - 10, cx, cy + 10);
            arc.setAttribute('d', arcPath(cx, cy, r, geo.height));
            ghostArc.setAttribute('d', arcPath(cx, cy, r0, geo.height));
            ghostArc.style.opacity = pushed;

            // Dimension arrow between the old and the new boundary (.hero__dim)
            heroTitle.style.setProperty('--boundary-stretch', stretch + 'px');
            heroTitle.style.setProperty('--boundary-pushed', stretch > 10 ? pushed : 0);
        }

        function pushBoundary() {
            window.removeEventListener('scroll', onScroll);
            boundary.classList.add('is-pushed');
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                stretch = INCH;
                draw();
                return;
            }
            var start = null, duration = 1200;
            function step(t) {
                if (start === null) start = t;
                var p = Math.min((t - start) / duration, 1);
                stretch = INCH * (1 - Math.pow(1 - p, 3));   // ease-out
                draw();
                if (p < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        }

        function onScroll() {
            if (window.scrollY > 20) pushBoundary();
        }

        function layout() { measure(); draw(); }

        (document.fonts ? document.fonts.ready : Promise.resolve()).then(layout);
        window.addEventListener('resize', layout);
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    /* ---- Hide images that haven't been added to assets/ yet ---- */
    document.querySelectorAll('img').forEach(function (img) {
        if (img.complete && img.naturalWidth === 0) {
            img.hidden = true;
        } else {
            img.addEventListener('error', function () { img.hidden = true; });
        }
    });

    /* ---- Project Popups ---- */
    var openCard = null;

    function openPopup(card) {
        if (openCard) return;
        card.style.transitionDelay = '';
        card.classList.add('expanded');
        card.scrollTop = 0;
        card.querySelectorAll('video[data-autoplay]').forEach(function (v) {
            v.play().catch(function () {});
        });
        document.body.classList.add('modal-open');
        openCard = card;
    }

    function closePopup() {
        if (!openCard) return;
        openCard.querySelectorAll('video').forEach(function (v) { v.pause(); });
        openCard.classList.remove('expanded');
        document.body.classList.remove('modal-open');
        openCard.focus();
        openCard = null;
    }

    document.querySelectorAll('.work-card').forEach(function (card) {
        card.addEventListener('click', function () { openPopup(card); });

        card.addEventListener('keydown', function (e) {
            if (!openCard && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                openPopup(card);
            }
        });

        card.querySelector('.close-btn').addEventListener('click', function (e) {
            e.stopPropagation();
            closePopup();
        });
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closePopup();
    });

})();
