import { animate } from "https://esm.sh/motion@11";

document.addEventListener("DOMContentLoaded", function () {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mm = gsap.matchMedia();

  function setupPinnedStack(useTilt) {
    var releaseEl = document.querySelector(".contact");
    var lastCard = document.querySelector(".cs-card.cs-scroll");
    var pinnedSections = gsap.utils.toArray(".cs-pinned");

    if (!releaseEl || !lastCard || !pinnedSections.length) return;

    var releasePoint = releaseEl.offsetTop - window.innerHeight;
    var tiltAngles = [-6, 5, -5, 6, -4];

    pinnedSections.forEach(function (section, index, sections) {
      var device = section.querySelector(".cs-device");
      var nextSection = sections[index + 1] || lastCard;
      var delta = nextSection.offsetTop - section.offsetTop;

      gsap.to(section, {
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: releasePoint,
          pin: true,
          pinSpacing: false,
          scrub: 1,
        },
      });

      if (!device) return;

      if (useTilt) {
        var tilt = tiltAngles[index % tiltAngles.length];
        gsap.fromTo(
          device,
          { scale: 1, rotate: 0 },
          {
            scale: 0.5,
            rotate: tilt,
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top top",
              end: "top+=" + delta + " top",
              scrub: 1,
            },
          }
        );
      } else {
        // Mobile: a gentler scale only, no rotation and no fade — cards stay fully opaque.
        gsap.fromTo(
          device,
          { scale: 1 },
          {
            scale: 0.88,
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top top",
              end: "top+=" + delta + " top",
              scrub: 1,
            },
          }
        );
      }
    });
  }

  // Desktop / motion-ok: pinned stack, each card shrinking + tilting as the next covers it.
  mm.add("(min-width: 901px)", function () {
    if (prefersReducedMotion) return;
    setupPinnedStack(true);
  });

  // Mobile / motion-ok: same pinned stack, gentler fade + scale instead of tilt.
  mm.add("(max-width: 900px)", function () {
    if (prefersReducedMotion) return;
    setupPinnedStack(false);
  });

  // Card videos: only start playing once the card is substantially on screen.
  // (Cards can be taller than the viewport on shorter screens, so we don't
  // require 100% visibility — that could be impossible to satisfy.)
  var cardVideos = document.querySelectorAll(".cs-device video");
  var IN_VIEW_THRESHOLD = 0.6;

  cardVideos.forEach(function (video) {
    var card = video.closest(".cs-device");
    if (!card) return;

    // Per-video override via data-in-view-threshold, e.g. for a full-bleed
    // background video where even a sliver on screen is enough to justify
    // starting it, instead of waiting for the shared default.
    var threshold = parseFloat(video.dataset.inViewThreshold);
    if (isNaN(threshold)) threshold = IN_VIEW_THRESHOLD;

    if (!("IntersectionObserver" in window)) {
      video.play();
      return;
    }

    var isInView = false;

    // A play() call can silently fail (rejected promise) if it fires before
    // the video has buffered enough data — especially for large 4K sources.
    // IntersectionObserver only calls back on threshold *changes*, so if that
    // one attempt fails, nothing else retries it. Retry once the video signals
    // it's actually ready to play, as long as the card is still in view.
    video.addEventListener("canplay", function () {
      if (isInView) video.play().catch(function () {});
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          isInView = entry.intersectionRatio >= threshold;
          if (isInView) {
            video.play().catch(function () {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: [0, 0.1, 0.15, 0.2, 0.25, 0.5, 0.6, 0.75, 0.99, 1] }
    );
    observer.observe(card);
  });

  // Contact "expandable screen": the trigger button morphs into a full-page
  // panel. Geometry is tweened with Motion (motion.dev — the standalone,
  // React-free successor to Framer Motion; same spring engine) instead of a
  // CSS transition, so it gets real spring physics rather than a fixed-
  // duration ease curve.
  var trigger = document.getElementById("contactTrigger");
  var panel = document.getElementById("contactPanel");
  var closeBtn = document.getElementById("contactPanelClose");
  var form = document.getElementById("contactForm");
  var successMessage = document.getElementById("contactFormSuccess");

  if (trigger && panel && closeBtn) {
    var isOpen = false;
    var TOP_GAP = 60;
    var SHEET_RADIUS = 24;
    var PILL_RADIUS = 100;
    var SPRING = { type: "spring", stiffness: 260, damping: 28, mass: 1 };

    // Position/size (top/left/width/height) is tweened by Motion for real
    // spring physics. Corner radii are set as plain style writes instead and
    // animated by the CSS transition on .contact-panel — Motion 11.18.2
    // silently fails to animate border-top-left-radius / border-top-right-
    // radius from a non-zero starting value (confirmed in isolation), which
    // was the actual cause of the "square, then snaps round" artifact.
    function sheetRect() {
      return { top: TOP_GAP, left: 0, width: window.innerWidth, height: window.innerHeight - TOP_GAP };
    }

    function setPanelRect(rect) {
      panel.style.top = rect.top + "px";
      panel.style.left = rect.left + "px";
      panel.style.width = rect.width + "px";
      panel.style.height = rect.height + "px";
    }

    function setPanelRadii(radii) {
      panel.style.borderTopLeftRadius = radii.tl + "px";
      panel.style.borderTopRightRadius = radii.tr + "px";
      panel.style.borderBottomLeftRadius = radii.bl + "px";
      panel.style.borderBottomRightRadius = radii.br + "px";
    }

    function pillRadii() {
      return { tl: PILL_RADIUS, tr: PILL_RADIUS, bl: PILL_RADIUS, br: PILL_RADIUS };
    }

    function sheetRadii() {
      return { tl: SHEET_RADIUS, tr: SHEET_RADIUS, bl: 0, br: 0 };
    }

    function openPanel() {
      if (isOpen) return;
      isOpen = true;

      var rect = trigger.getBoundingClientRect();
      document.body.classList.add("contact-open");

      if (prefersReducedMotion) {
        setPanelRect(sheetRect());
        setPanelRadii(sheetRadii());
        panel.style.visibility = "visible";
        panel.classList.add("is-open");
        hideTrigger();
        return;
      }

      // Start the panel exactly over the button, then spring it to the sheet.
      setPanelRect(rect);
      setPanelRadii(pillRadii());
      panel.style.visibility = "visible";
      hideTrigger();
      panel.classList.add("is-open");

      requestAnimationFrame(function () {
        panel.getBoundingClientRect(); // commit the start frame above first
        var target = sheetRect();
        setPanelRadii(sheetRadii()); // CSS transition takes it from here
        animate(panel, { top: target.top, left: target.left, width: target.width, height: target.height }, SPRING);
      });
    }

    function hideTrigger() {
      trigger.style.visibility = "hidden";
      trigger.style.opacity = "0";
    }

    function revealTrigger() {
      trigger.style.visibility = "visible";
      requestAnimationFrame(function () {
        trigger.style.opacity = "1";
      });
    }

    function resetForm() {
      if (!form) return;
      form.hidden = false;
      form.reset();
      if (successMessage) successMessage.hidden = true;
    }

    function closePanel() {
      if (!isOpen) return;
      isOpen = false;

      var rect = trigger.getBoundingClientRect();
      panel.classList.remove("is-open");

      if (prefersReducedMotion) {
        panel.style.visibility = "hidden";
        revealTrigger();
        document.body.classList.remove("contact-open");
        resetForm();
        return;
      }

      setPanelRadii(pillRadii()); // CSS transition takes it from here
      var controls = animate(
        panel,
        { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        SPRING
      );

      // Bring the button's own label back well before the spring's tail has
      // fully settled — by ~300ms the panel is already visually on top of
      // the button's position, so revealing it here (instead of waiting on
      // controls.finished) removes the "blank pill" lag without any visual
      // seam, since the panel still covers the button until it's shrunk all
      // the way down.
      window.setTimeout(revealTrigger, 300);

      controls.finished.then(function () {
        panel.style.visibility = "hidden";
        document.body.classList.remove("contact-open");
        resetForm();
      });
    }

    trigger.addEventListener("click", openPanel);
    closeBtn.addEventListener("click", closePanel);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen) closePanel();
    });

    window.addEventListener("resize", function () {
      if (isOpen) setPanelRect(sheetRect());
    });

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        // No backend yet — just confirm receipt and auto-dismiss. Wiring up
        // where this actually gets sent is a later step.
        form.hidden = true;
        if (successMessage) successMessage.hidden = false;
        window.setTimeout(closePanel, 1500);
      });
    }
  }
});
