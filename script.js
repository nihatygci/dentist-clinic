/* ==========================================================================
   AURA DENTAL — Interaction & Animation Layer (v5 — content/feature cleanup)
   Vanilla JavaScript — no frameworks, no dependencies.

   Changelog vs. v4:
   - Removed the newsletter signup module. A small clinic without an
     active content/newsletter operation shouldn't promise one on its
     own site — cutting the feature (not just hiding it) also removes an
     entire form, its validation logic, and its CSS.

   Changelog vs. v3:
   - Wired up the [data-treatment] attribute that every treatment card
     already carried but that nothing ever read: clicking "Keşfet" now
     preselects the matching option in the appointment form's dropdown
     instead of always landing on a generic, empty form.

   Changelog vs. v2:
   - Removed the custom cursor, hero parallax, and floating-decorative-
     elements modules. None of them were load-bearing for the experience,
     and each carried an ongoing per-frame or per-pointermove cost — cut
     in favor of a lighter, faster page. Interactions that remain are all
     either event-driven (click, blur, drag) or run once on scroll via a
     single rAF-throttled handler.
   - Scroll progress simplified from an SVG arc back to a plain width-based
     bar — same visual job, far less code, no path-length math.
   - Dropped backdrop-filter blur from the lightbox and the clinic-space
     photo captions; both now use a solid, slightly more opaque background
     instead. The sticky header and mobile CTA bar keep their (single,
     cheap) blur since it's load-bearing there for legibility over moving
     content.
   - All JS-injected UI (back-to-top, lightbox, ripple, testimonial
     controls, form errors) uses real CSS classes defined in styles.css
     instead of inline-style blocks — cleaner separation of concerns.
   - Testimonial slider track ships in CSS as flex/overflow-hidden already,
     so JS only ever sets `transform` — no runtime layout restructuring.

   Structure:
   1.  Utilities
   2.  Global State & Config
   3.  Sticky Navbar + Background Transition
   4.  Scroll Progress
   5.  Mobile Navigation
   6.  Smooth Scrolling
   7.  Treatment Card → Form Preselect
   8.  Active Navigation Highlighting
   9.  Scroll-Reveal Animations (IntersectionObserver)
   10. Number Counters
   11. FAQ Accordion
   12. Testimonial Slider
   13. Before / After Comparison Slider
   14. Gallery Lightbox
   15. Back-to-Top Button
   16. Sticky Mobile CTA
   17. Button Ripple Effect
   18. Form Validation (appointment)
   19. Lazy-Load Enhancement
   20. Init
   ========================================================================== */

(function () {
  'use strict';

  /* ========================================================================
     1. UTILITIES
     ==================================================================== */

  const prefersReducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;



  function debounce(fn, wait = 150) {
    let timeoutId;
    return function debounced(...args) {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function rafThrottle(fn) {
    let scheduled = false;
    return function throttled(...args) {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        fn.apply(this, args);
        scheduled = false;
      });
    };
  }

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  function trapFocus(container) {
    const focusableSelector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

    function handleKeydown(e) {
      if (e.key !== 'Tab') return;
      const focusable = Array.from(container.querySelectorAll(focusableSelector));
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    container.addEventListener('keydown', handleKeydown);
    return () => container.removeEventListener('keydown', handleKeydown);
  }

  /* ========================================================================
     2. GLOBAL STATE & CONFIG
     ==================================================================== */

  const CONFIG = {
    headerScrollThreshold: 24,
    backToTopThreshold: 0.6,
    mobileCtaRevealSelector: '.hero',
    revealRootMargin: '0px 0px -10% 0px',
    testimonialAutoplayMs: 6500
  };

  const reduceMotion = prefersReducedMotion();

  /* ========================================================================
     3. STICKY NAVBAR + BACKGROUND TRANSITION
     ==================================================================== */

  function initNavbar() {
    const header = document.querySelector('[data-header]');
    if (!header) return;

    const updateOnScroll = rafThrottle(() => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      header.setAttribute(
        'data-scrolled',
        scrollTop > CONFIG.headerScrollThreshold ? 'true' : 'false'
      );
    });

    window.addEventListener('scroll', updateOnScroll, { passive: true });
    updateOnScroll();
  }

  /* ========================================================================
     4. SCROLL PROGRESS
     A simple, cheap width-based progress bar — no SVG path math, no
     per-frame geometry work. One element, one style property updated
     on scroll.
     ==================================================================== */

  function initScrollProgress() {
    const bar = document.createElement('div');
    bar.className = 'js-scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    const updateOnScroll = rafThrottle(() => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight =
        document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const progress = docHeight > 0 ? clamp((scrollTop / docHeight) * 100, 0, 100) : 0;
      bar.style.inlineSize = progress + '%';
    });

    window.addEventListener('scroll', updateOnScroll, { passive: true });
    updateOnScroll();
  }

  /* ========================================================================
     5. MOBILE NAVIGATION
     ==================================================================== */

  function initMobileNav() {
    const toggle = document.querySelector('[data-nav-toggle]');
    const menu = document.querySelector('[data-nav-menu]');
    if (!toggle || !menu) return;

    const label = toggle.querySelector('.site-nav__toggle-label');
    let releaseFocusTrap = null;

    function openMenu() {
      menu.setAttribute('data-open', 'true');
      toggle.setAttribute('aria-expanded', 'true');
      if (label) label.textContent = 'Kapat';
      document.body.style.overflow = 'hidden';
      releaseFocusTrap = trapFocus(menu);
      const firstLink = menu.querySelector('.site-nav__link');
      if (firstLink) firstLink.focus();
    }

    function closeMenu({ restoreFocus = true } = {}) {
      menu.setAttribute('data-open', 'false');
      toggle.setAttribute('aria-expanded', 'false');
      if (label) label.textContent = 'Menü';
      document.body.style.overflow = '';
      if (releaseFocusTrap) {
        releaseFocusTrap();
        releaseFocusTrap = null;
      }
      if (restoreFocus) toggle.focus();
    }

    toggle.addEventListener('click', () => {
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      isOpen ? closeMenu({ restoreFocus: false }) : openMenu();
    });

    menu.addEventListener('click', (e) => {
      if (e.target.closest('.site-nav__link')) {
        closeMenu({ restoreFocus: false });
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        closeMenu();
      }
    });

    window.addEventListener(
      'resize',
      debounce(() => {
        if (window.innerWidth > 960 && toggle.getAttribute('aria-expanded') === 'true') {
          closeMenu({ restoreFocus: false });
        }
      }, 150),
      { passive: true }
    );
  }

  /* ========================================================================
     6. SMOOTH SCROLLING
     ==================================================================== */

  function initSmoothScroll() {
    const header = document.querySelector('[data-header]');

    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;

      const targetId = link.getAttribute('href');
      if (!targetId || targetId === '#') return;

      const target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();

      const headerOffset = header ? header.offsetHeight : 0;
      const targetPosition =
        target.getBoundingClientRect().top + window.scrollY - headerOffset - 16;

      window.scrollTo({
        top: targetPosition,
        behavior: reduceMotion ? 'auto' : 'smooth'
      });

      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
      }
      target.focus({ preventScroll: true });
    });
  }

  /* ========================================================================
     7. TREATMENT CARD → FORM PRESELECT
     Every treatment card already carries a [data-treatment] value that
     matches one of the appointment form's <option> values exactly — it
     just wasn't wired up before. Clicking "Keşfet" now scrolls to the
     form (via the smooth-scroll module above) AND preselects the
     matching treatment, instead of always landing on a blank, generic
     form regardless of which card was clicked.
     ==================================================================== */

  function initTreatmentPreselect() {
    const select = document.getElementById('treatment-interest');
    if (!select) return;

    document.addEventListener('click', (e) => {
      const link = e.target.closest('.treatment-card__link');
      if (!link) return;

      const card = link.closest('[data-treatment]');
      const treatment = card?.getAttribute('data-treatment');
      if (!treatment) return;

      const optionExists = Array.from(select.options).some((opt) => opt.value === treatment);
      if (optionExists) {
        select.value = treatment;
      }
    });
  }

  /* ========================================================================
     8. ACTIVE NAVIGATION HIGHLIGHTING
     ==================================================================== */

  function initActiveNavHighlighting() {
    const navLinks = Array.from(document.querySelectorAll('.site-nav__link'));
    if (!navLinks.length) return;

    const linkMap = navLinks
      .map((link) => {
        const id = link.getAttribute('href');
        const section = id ? document.querySelector(id) : null;
        return section ? { link, section } : null;
      })
      .filter(Boolean);

    if (!linkMap.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const match = linkMap.find((item) => item.section === entry.target);
          if (!match) return;

          if (entry.isIntersecting) {
            linkMap.forEach(({ link }) => link.removeAttribute('aria-current'));
            match.link.setAttribute('aria-current', 'true');
          }
        });
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: 0 }
    );

    linkMap.forEach(({ section }) => observer.observe(section));
  }

  /* ========================================================================
     9. SCROLL-REVEAL ANIMATIONS
     ==================================================================== */

  function initScrollReveal() {
    const revealSelector = [
      '.hero__content',
      '.treatment-card',
      '.before-after-card',
      '.team-card',
      '.clinic-space__item',
      '.testimonial-card',
      '.process__step'
    ].join(', ');

    const revealTargets = Array.from(document.querySelectorAll(revealSelector));

    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealTargets.forEach((el) => el.classList.add('is-visible'));
    } else {
      const observer = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              obs.unobserve(entry.target);
            }
          });
        },
        { rootMargin: CONFIG.revealRootMargin, threshold: 0.15 }
      );

      revealTargets.forEach((el) => observer.observe(el));
    }

    // Whole-section entrance, keyed off the existing data-animate hook.
    const sections = Array.from(document.querySelectorAll('[data-animate]'));
    if (!sections.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      sections.forEach((el) => el.classList.add('section-in-view'));
      return;
    }

    const sectionObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('section-in-view');
            obs.unobserve(entry.target);
          }
        });
      },
      { rootMargin: CONFIG.revealRootMargin, threshold: 0.1 }
    );
    sections.forEach((el) => sectionObserver.observe(el));
  }

  /* ========================================================================
     10. NUMBER COUNTERS
     ==================================================================== */

  function initCounters() {
    const counters = Array.from(document.querySelectorAll('[data-count-to]'));
    if (!counters.length) return;

    function animateCounter(el) {
      const target = parseFloat(el.getAttribute('data-count-to'));
      if (Number.isNaN(target)) return;

      const originalText = el.textContent.trim();
      const suffixMatch = originalText.match(/[^\d,.\s]+$/);
      const suffix = suffixMatch ? suffixMatch[0] : '';
      const usesThousandsSeparator = /\d,\d/.test(originalText);

      if (reduceMotion) {
        el.textContent =
          (usesThousandsSeparator ? target.toLocaleString('en-US') : String(target)) + suffix;
        return;
      }

      const duration = 1600;
      let startTime = null;

      function step(timestamp) {
        if (startTime === null) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = clamp(elapsed / duration, 0, 1);
        const eased = easeOutCubic(progress);
        const currentValue = Math.round(target * eased);

        el.textContent =
          (usesThousandsSeparator ? currentValue.toLocaleString('en-US') : String(currentValue)) +
          suffix;

        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      }

      window.requestAnimationFrame(step);
    }

    if (!('IntersectionObserver' in window)) {
      counters.forEach(animateCounter);
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );

    counters.forEach((el) => observer.observe(el));
  }

  /* ========================================================================
     11. FAQ ACCORDION
     ==================================================================== */

  function initFaqAccordion() {
    const faqItems = Array.from(document.querySelectorAll('.faq-item'));
    if (!faqItems.length) return;

    faqItems.forEach((item) => {
      const summary = item.querySelector('.faq-item__question');
      const answer = item.querySelector('.faq-item__answer');
      if (!summary || !answer) return;

      summary.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = item.hasAttribute('open');

        if (isOpen) {
          closeItem(item, answer);
        } else {
          faqItems.forEach((sibling) => {
            if (sibling !== item && sibling.hasAttribute('open')) {
              closeItem(sibling, sibling.querySelector('.faq-item__answer'));
            }
          });
          openItem(item, answer);
        }
      });
    });

    function openItem(item, answer) {
      item.setAttribute('open', '');
      summaryAria(item, true);

      if (reduceMotion) return;

      const targetHeight = answer.scrollHeight;
      answer.style.overflow = 'hidden';
      answer.animate(
        [
          { height: '0px', opacity: 0 },
          { height: targetHeight + 'px', opacity: 1 }
        ],
        { duration: 320, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
      ).onfinish = () => {
        answer.style.overflow = '';
      };
    }

    function closeItem(item, answer) {
      summaryAria(item, false);

      if (reduceMotion) {
        item.removeAttribute('open');
        return;
      }

      const startHeight = answer.scrollHeight;
      answer.style.overflow = 'hidden';
      const anim = answer.animate(
        [
          { height: startHeight + 'px', opacity: 1 },
          { height: '0px', opacity: 0 }
        ],
        { duration: 260, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' }
      );
      anim.onfinish = () => {
        item.removeAttribute('open');
        answer.style.overflow = '';
      };
    }

    function summaryAria(item, expanded) {
      const summary = item.querySelector('.faq-item__question');
      if (summary) summary.setAttribute('aria-expanded', String(expanded));
    }
  }

  /* ========================================================================
     12. TESTIMONIAL SLIDER
     The track ships in CSS as `display: flex` inside an `overflow: hidden`
     viewport, so JS only ever needs to move it with `transform` — no
     runtime restructuring, no layout jump before this script runs.
     ==================================================================== */

  function initTestimonialSlider() {
    const track = document.querySelector('[data-testimonial-track]');
    if (!track) return;

    const slides = Array.from(track.children);
    if (slides.length <= 1) return;

    const section = track.closest('section');
    let currentIndex = 0;
    let autoplayId = null;
    let isPointerDown = false;
    let pointerStartX = 0;
    let baseTranslatePercent = 0;
    let dragDeltaPercent = 0;

    track.style.transition = reduceMotion ? 'none' : 'transform 500ms cubic-bezier(0.16, 1, 0.3, 1)';

    const controls = document.createElement('div');
    controls.className = 'js-testimonial-controls';

    const prevButton = createArrowButton('Önceki yorum', '←');
    const nextButton = createArrowButton('Sonraki yorum', '→');

    const dotsWrapper = document.createElement('div');
    dotsWrapper.className = 'js-testimonial-dots';
    dotsWrapper.setAttribute('role', 'tablist');
    dotsWrapper.setAttribute('aria-label', 'Yorum navigasyonu');

    const dots = slides.map((_, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'js-testimonial-dot';
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', `${index + 1}. yorumu göster`);
      dot.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      dot.addEventListener('click', () => goToSlide(index, { userInitiated: true }));
      dotsWrapper.appendChild(dot);
      return dot;
    });

    controls.append(prevButton, dotsWrapper, nextButton);
    section?.querySelector('.container')?.appendChild(controls);

    function createArrowButton(label, glyph) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'js-testimonial-arrow';
      btn.setAttribute('aria-label', label);
      btn.textContent = glyph;
      return btn;
    }

    function goToSlide(index, { userInitiated = false } = {}) {
      currentIndex = (index + slides.length) % slides.length;
      track.style.transform = `translate3d(-${currentIndex * 100}%, 0, 0)`;
      dots.forEach((dot, i) =>
        dot.setAttribute('aria-selected', i === currentIndex ? 'true' : 'false')
      );

      if (userInitiated) restartAutoplay();
    }

    function startAutoplay() {
      if (reduceMotion) return;
      autoplayId = window.setInterval(() => goToSlide(currentIndex + 1), CONFIG.testimonialAutoplayMs);
    }

    function stopAutoplay() {
      if (autoplayId) window.clearInterval(autoplayId);
      autoplayId = null;
    }

    function restartAutoplay() {
      stopAutoplay();
      startAutoplay();
    }

    prevButton.addEventListener('click', () => goToSlide(currentIndex - 1, { userInitiated: true }));
    nextButton.addEventListener('click', () => goToSlide(currentIndex + 1, { userInitiated: true }));

    track.addEventListener('mouseenter', stopAutoplay);
    track.addEventListener('mouseleave', startAutoplay);
    track.addEventListener('focusin', stopAutoplay);
    track.addEventListener('focusout', startAutoplay);

    // Touch / pointer swipe support, expressed in percentage terms so it
    // stays correct across resizes without recalculating pixel widths.
    track.addEventListener(
      'pointerdown',
      (e) => {
        isPointerDown = true;
        pointerStartX = e.clientX;
        baseTranslatePercent = -currentIndex * 100;
        track.style.transition = 'none';
        stopAutoplay();
      },
      { passive: true }
    );

    track.addEventListener(
      'pointermove',
      (e) => {
        if (!isPointerDown) return;
        const deltaPx = e.clientX - pointerStartX;
        dragDeltaPercent = (deltaPx / track.clientWidth) * 100;
        track.style.transform = `translate3d(${baseTranslatePercent + dragDeltaPercent}%, 0, 0)`;
      },
      { passive: true }
    );

    ['pointerup', 'pointercancel', 'pointerleave'].forEach((evt) => {
      track.addEventListener(evt, () => {
        if (!isPointerDown) return;
        isPointerDown = false;
        track.style.transition = reduceMotion ? 'none' : 'transform 500ms cubic-bezier(0.16, 1, 0.3, 1)';

        if (dragDeltaPercent > 15) {
          goToSlide(currentIndex - 1, { userInitiated: true });
        } else if (dragDeltaPercent < -15) {
          goToSlide(currentIndex + 1, { userInitiated: true });
        } else {
          goToSlide(currentIndex, { userInitiated: true });
        }
        dragDeltaPercent = 0;
      });
    });

    goToSlide(0);
    startAutoplay();
  }

  /* ========================================================================
     13. BEFORE / AFTER COMPARISON SLIDER
     ==================================================================== */

  function initBeforeAfterSliders() {
    const cards = Array.from(document.querySelectorAll('[data-before-after]'));
    if (!cards.length) return;

    cards.forEach((card) => {
      const media = card.querySelector('.before-after-card__media');
      const afterImage = card.querySelector('.before-after-card__image--after');
      const handle = card.querySelector('.before-after-card__slider');
      if (!media || !afterImage || !handle) return;

      let isDragging = false;

      function setPosition(percentage) {
        const clamped = clamp(percentage, 0, 100);
        afterImage.style.clipPath = `inset(0 0 0 ${clamped}%)`;
        handle.style.insetInlineStart = `${clamped}%`;
        handle.setAttribute('aria-valuenow', String(Math.round(clamped)));
      }

      function positionFromPointer(clientX) {
        const rect = media.getBoundingClientRect();
        const percentage = ((clientX - rect.left) / rect.width) * 100;
        setPosition(percentage);
      }

      handle.addEventListener('pointerdown', (e) => {
        isDragging = true;
        handle.setPointerCapture(e.pointerId);
      });

      handle.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        positionFromPointer(e.clientX);
      });

      ['pointerup', 'pointercancel'].forEach((evt) => {
        handle.addEventListener(evt, () => {
          isDragging = false;
        });
      });

      media.addEventListener('click', (e) => {
        if (e.target === handle) return;
        positionFromPointer(e.clientX);
      });

      handle.addEventListener('keydown', (e) => {
        const current = parseFloat(handle.getAttribute('aria-valuenow')) || 50;
        const step = 5;

        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          setPosition(current - step);
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          setPosition(current + step);
        } else if (e.key === 'Home') {
          e.preventDefault();
          setPosition(0);
        } else if (e.key === 'End') {
          e.preventDefault();
          setPosition(100);
        }
      });

      setPosition(50);
    });
  }

  /* ========================================================================
     14. GALLERY LIGHTBOX
     ==================================================================== */

  function initGalleryLightbox() {
    const groups = {
      'smile-gallery': Array.from(document.querySelectorAll('.before-after-card__image--after')),
      'clinic-space': Array.from(document.querySelectorAll('.clinic-space__item img'))
    };

    const allEntries = [];
    Object.entries(groups).forEach(([groupName, images]) => {
      images.forEach((img) => allEntries.push({ groupName, img }));
    });

    if (!allEntries.length) return;

    const overlay = document.createElement('div');
    overlay.className = 'js-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Görsel görüntüleyici');

    const figure = document.createElement('figure');
    figure.className = 'js-lightbox__figure';

    const lightboxImage = document.createElement('img');
    lightboxImage.className = 'js-lightbox__image';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'js-lightbox__close';
    closeBtn.setAttribute('aria-label', 'Görseli kapat');
    closeBtn.textContent = '✕';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'js-lightbox__nav js-lightbox__nav--prev';
    prevBtn.setAttribute('aria-label', 'Önceki görsel');
    prevBtn.textContent = '←';

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'js-lightbox__nav js-lightbox__nav--next';
    nextBtn.setAttribute('aria-label', 'Sonraki görsel');
    nextBtn.textContent = '→';

    figure.append(lightboxImage, closeBtn, prevBtn, nextBtn);
    overlay.appendChild(figure);
    document.body.appendChild(overlay);

    let activeGroup = [];
    let activeIndex = 0;
    let releaseFocusTrap = null;
    let lastFocusedElement = null;

    function openLightbox(groupName, startIndex) {
      activeGroup = allEntries.filter((entry) => entry.groupName === groupName);
      activeIndex = activeGroup.findIndex((entry) => entry.img === allEntries[startIndex].img);
      if (activeIndex < 0) activeIndex = 0;

      lastFocusedElement = document.activeElement;
      renderActiveImage();

      overlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';

      releaseFocusTrap = trapFocus(overlay);
      closeBtn.focus();

      document.addEventListener('keydown', handleKeydown);
    }

    function closeLightbox() {
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeydown);
      if (releaseFocusTrap) releaseFocusTrap();
      if (lastFocusedElement) lastFocusedElement.focus();
    }

    function renderActiveImage() {
      const entry = activeGroup[activeIndex];
      lightboxImage.src = entry.img.currentSrc || entry.img.src;
      lightboxImage.alt = entry.img.alt || '';
      const multiImage = activeGroup.length > 1;
      prevBtn.style.display = multiImage ? 'block' : 'none';
      nextBtn.style.display = multiImage ? 'block' : 'none';
    }

    function showPrev() {
      activeIndex = (activeIndex - 1 + activeGroup.length) % activeGroup.length;
      renderActiveImage();
    }

    function showNext() {
      activeIndex = (activeIndex + 1) % activeGroup.length;
      renderActiveImage();
    }

    function handleKeydown(e) {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') showPrev();
      if (e.key === 'ArrowRight') showNext();
    }

    closeBtn.addEventListener('click', closeLightbox);
    prevBtn.addEventListener('click', showPrev);
    nextBtn.addEventListener('click', showNext);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeLightbox();
    });

    allEntries.forEach((entry, index) => {
      entry.img.setAttribute('tabindex', '0');
      entry.img.setAttribute('role', 'button');
      entry.img.setAttribute('aria-label', `Görseli büyüt: ${entry.img.alt || 'galeri fotoğrafı'}`);

      const trigger = (e) => {
        // Smile-gallery images sit inside a before/after card whose parent
        // also listens for clicks to reposition the compare handle —
        // without this, opening the lightbox would also jump the slider.
        e.stopPropagation();
        openLightbox(entry.groupName, index);
      };
      entry.img.addEventListener('click', trigger);
      entry.img.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          trigger(e);
        }
      });
    });
  }

  /* ========================================================================
     15. BACK-TO-TOP BUTTON
     ==================================================================== */

  function initBackToTop() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'js-back-to-top';
    button.setAttribute('aria-label', 'Yukarı çık');
    button.textContent = '↑';
    document.body.appendChild(button);

    const showThreshold = () => window.innerHeight * CONFIG.backToTopThreshold;

    const toggleVisibility = rafThrottle(() => {
      button.classList.toggle('is-visible', window.scrollY > showThreshold());
    });

    window.addEventListener('scroll', toggleVisibility, { passive: true });
    toggleVisibility();

    button.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ========================================================================
     16. STICKY MOBILE CTA
     Appears once the visitor has scrolled past the hero — matches the
     conversion pattern from the design blueprint. Mobile-only via CSS
     (hidden entirely above 600px), so this module is inert on desktop.
     ==================================================================== */

  function initMobileCta() {
    const revealAfter = document.querySelector(CONFIG.mobileCtaRevealSelector);
    if (!revealAfter) return;

    const bar = document.createElement('div');
    bar.className = 'js-mobile-cta';

    const link = document.createElement('a');
    link.className = 'btn btn--primary';
    link.href = '#appointment';
    link.textContent = 'Randevu Al';

    bar.appendChild(link);
    document.body.appendChild(bar);

    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show the bar once the hero has scrolled mostly out of view.
        bar.classList.toggle('is-visible', !entry.isIntersecting);
      },
      { threshold: 0.15 }
    );

    observer.observe(revealAfter);
  }

  /* ========================================================================
     17. BUTTON RIPPLE EFFECT
     ==================================================================== */

  function initButtonRipple() {
    if (reduceMotion) return;

    document.addEventListener(
      'click',
      (e) => {
        const button = e.target.closest('.btn');
        if (!button) return;

        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 1.6;
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        const ripple = document.createElement('span');
        ripple.className = 'js-ripple';
        ripple.style.insetInlineStart = `${x}px`;
        ripple.style.insetBlockStart = `${y}px`;
        ripple.style.inlineSize = `${size}px`;
        ripple.style.blockSize = `${size}px`;

        const computedPosition = window.getComputedStyle(button).position;
        if (computedPosition === 'static') {
          button.style.position = 'relative';
        }

        button.appendChild(ripple);

        const animation = ripple.animate(
          [
            { transform: 'scale(0)', opacity: 0.35 },
            { transform: 'scale(1)', opacity: 0 }
          ],
          { duration: 600, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
        );

        animation.onfinish = () => ripple.remove();
      },
      { passive: true }
    );
  }

  /* ========================================================================
     18. FORM VALIDATION
     ==================================================================== */

  function initAppointmentForm() {
    const form = document.getElementById('contact');
    if (!form || form.tagName !== 'FORM') return;

    const validators = {
      'full-name': (value) => value.trim().length >= 2 || 'Lütfen adınızı ve soyadınızı girin.',
      email: (value) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || 'Lütfen geçerli bir e-posta adresi girin.',
      phone: (value) =>
        /^[+\d][\d\s()-]{6,}$/.test(value.trim()) || 'Lütfen geçerli bir telefon numarası girin.'
    };

    function getOrCreateErrorEl(field) {
      const row = field.closest('.appointment-form__row');
      let errorEl = row.querySelector('.js-field-error');
      if (!errorEl) {
        errorEl = document.createElement('p');
        errorEl.className = 'js-field-error';
        errorEl.setAttribute('role', 'alert');
        errorEl.id = (field.id || '') + '-error';
        row.appendChild(errorEl);
        field.setAttribute('aria-describedby', errorEl.id);
      }
      return errorEl;
    }

    function validateField(field) {
      const validator = validators[field.name];
      if (!validator) return true;

      const result = validator(field.value);
      const errorEl = getOrCreateErrorEl(field);

      if (result === true) {
        field.removeAttribute('aria-invalid');
        errorEl.textContent = '';
        return true;
      }

      field.setAttribute('aria-invalid', 'true');
      errorEl.textContent = result;
      return false;
    }

    Object.keys(validators).forEach((name) => {
      const field = form.elements.namedItem(name);
      if (field) field.addEventListener('blur', () => validateField(field));
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      let isValid = true;
      let firstInvalidField = null;

      Object.keys(validators).forEach((name) => {
        const field = form.elements.namedItem(name);
        if (!field) return;
        const fieldValid = validateField(field);
        if (!fieldValid) {
          isValid = false;
          if (!firstInvalidField) firstInvalidField = field;
        }
      });

      if (!isValid) {
        firstInvalidField.focus();
        return;
      }

      showFormSuccess(form);
    });

    function showFormSuccess(formEl) {
      const successMessage = document.createElement('div');
      successMessage.setAttribute('role', 'status');
      successMessage.className = 'appointment-form__success';
      successMessage.textContent =
        "Teşekkürler — randevu talebiniz alındı. Bir iş günü içinde sizinle iletişime geçeceğiz.";
      formEl.replaceChildren(successMessage);
    }
  }

  /* ========================================================================
     19. LAZY-LOAD ENHANCEMENT
     ==================================================================== */

  function initLazyLoadEnhancement() {
    const images = Array.from(document.querySelectorAll('img[loading="lazy"]'));

    images.forEach((img) => {
      if (img.complete) return;

      if (!reduceMotion) {
        img.style.opacity = '0';
        img.style.transition = 'opacity 500ms ease';
      }

      img.addEventListener(
        'load',
        () => {
          if (!reduceMotion) img.style.opacity = '1';
        },
        { once: true }
      );
    });

    const mapFrame = document.querySelector('.appointment__map-frame[data-map-src]');
    if (mapFrame && 'IntersectionObserver' in window) {
      const mapObserver = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              mapFrame.src = mapFrame.getAttribute('data-map-src');
              obs.disconnect();
            }
          });
        },
        { rootMargin: '200px' }
      );
      mapObserver.observe(mapFrame);
    } else if (mapFrame) {
      mapFrame.src = mapFrame.getAttribute('data-map-src');
    }
  }

  /* ========================================================================
     20. INIT
     ==================================================================== */

  function init() {
    initNavbar();
    initScrollProgress();
    initMobileNav();
    initSmoothScroll();
    initTreatmentPreselect();
    initActiveNavHighlighting();
    initScrollReveal();
    initCounters();
    initFaqAccordion();
    initTestimonialSlider();
    initBeforeAfterSliders();
    initGalleryLightbox();
    initBackToTop();
    initMobileCta();
    initButtonRipple();
    initAppointmentForm();
    initLazyLoadEnhancement();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
