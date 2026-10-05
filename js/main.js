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
        document.body.classList.add('modal-open');
        openCard = card;
    }

    function closePopup() {
        if (!openCard) return;
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
