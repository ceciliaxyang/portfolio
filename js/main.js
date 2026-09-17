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
          isInView = entry.intersectionRatio >= IN_VIEW_THRESHOLD;
          if (isInView) {
            video.play().catch(function () {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: [0, 0.25, 0.5, 0.6, 0.75, 0.99, 1] }
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

  if (trigger && panel && closeBtn) {
    var isOpen = false;
    var SPRING = { type: "spring", stiffness: 260, damping: 28, mass: 1 };

    function fullScreenRect() {
      return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight, borderRadius: 0 };
    }

    function setPanelRect(rect, radius) {
      panel.style.top = rect.top + "px";
      panel.style.left = rect.left + "px";
      panel.style.width = rect.width + "px";
      panel.style.height = rect.height + "px";
      panel.style.borderRadius = radius + "px";
    }

    function openPanel() {
      if (isOpen) return;
      isOpen = true;

      var rect = trigger.getBoundingClientRect();
      document.body.classList.add("contact-open");

      if (prefersReducedMotion) {
        var full = fullScreenRect();
        setPanelRect(full, full.borderRadius);
        panel.style.visibility = "visible";
        panel.classList.add("is-open");
        trigger.style.visibility = "hidden";
        return;
      }

      // Start the panel exactly over the button, then spring it to full-screen.
      setPanelRect(rect, 999);
      panel.style.visibility = "visible";
      trigger.style.visibility = "hidden";
      panel.classList.add("is-open");

      animate(
        panel,
        { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight, borderRadius: 0 },
        SPRING
      );
    }

    function closePanel() {
      if (!isOpen) return;
      isOpen = false;

      var rect = trigger.getBoundingClientRect();
      panel.classList.remove("is-open");

      if (prefersReducedMotion) {
        panel.style.visibility = "hidden";
        trigger.style.visibility = "visible";
        document.body.classList.remove("contact-open");
        return;
      }

      var controls = animate(
        panel,
        { top: rect.top, left: rect.left, width: rect.width, height: rect.height, borderRadius: 999 },
        SPRING
      );

      controls.finished.then(function () {
        panel.style.visibility = "hidden";
        trigger.style.visibility = "visible";
        document.body.classList.remove("contact-open");
      });
    }

    trigger.addEventListener("click", openPanel);
    closeBtn.addEventListener("click", closePanel);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen) closePanel();
    });

    window.addEventListener("resize", function () {
      if (isOpen) {
        var full = fullScreenRect();
        setPanelRect(full, full.borderRadius);
      }
    });

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var data = new FormData(form);
        var name = data.get("name") || "";
        var email = data.get("email") || "";
        var message = data.get("message") || "";
        var body = "From: " + name + " (" + email + ")\n\n" + message;
        window.location.href =
          "mailto:hello@example.com?subject=" +
          encodeURIComponent("Portfolio contact") +
          "&body=" +
          encodeURIComponent(body);
      });
    }
  }
});
