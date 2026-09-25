// Motion is only needed for the contact panel's spring, but it pulls ~140
// module files from esm.sh. A static `import` would hold back every line of
// this file (pinning, the page-load entrance, the hero peek, video autoplay)
// until they all arrived — several seconds on a cold load — or break the whole
// page if the CDN failed. Instead it loads in the background from the start,
// and the panel falls back to a plain jump if it never arrives.
var motionReady = import("https://esm.sh/motion@11").catch(function () {
  return null;
});

// GitHub Pages (and this project's local "serve" setup) have no server-side
// routing, so a direct hit to /contact has no matching file and falls
// through to 404.html, which stashes the intended path and bounces to "/".
// Restore it here, before anything else runs, so the /contact check further
// down sees the real path the visitor asked for.
(function () {
  var redirectPath = window.sessionStorage.getItem("redirectPath");
  if (redirectPath) {
    window.sessionStorage.removeItem("redirectPath");
    if (redirectPath === "/contact" && window.history.replaceState) {
      window.history.replaceState(null, "", "/contact");
    }
  }
})();

document.addEventListener("DOMContentLoaded", function () {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mm = gsap.matchMedia();

  // The hero's height is computed (not a fixed CSS value) so that exactly
  // 20% of the first card's own device — not just 20% of its section —
  // peeks into view before any scrolling. The device is vertically centered
  // within its section, but the section itself isn't reliably one viewport
  // tall: under the 900px breakpoint it's flex-centered with 60px top/bottom
  // padding, so on a tall/narrow device the section can grow past 100vh to
  // fit that padding. Rather than assume a section height, this measures
  // the section and device as currently laid out and solves for the hero
  // height that makes the device's reveal exactly 20% of its own height.
  // This must run before setupPinnedStack() below, since ScrollTrigger
  // reads sections' offsetTop, which this changes.
  function updateHeroHeight() {
    var hero = document.querySelector(".hero");
    var section = document.querySelector(".cs-pinned");
    var firstDevice = section ? section.querySelector(".cs-device") : null;
    if (!hero || !section || !firstDevice) return;
    var deviceHeight = firstDevice.getBoundingClientRect().height;
    var sectionHeight = section.getBoundingClientRect().height;
    var deviceOffsetWithinSection = (sectionHeight - deviceHeight) / 2;
    var targetVisible = 0.2 * deviceHeight;
    hero.style.height = window.innerHeight - deviceOffsetWithinSection - targetVisible + "px";
  }
  updateHeroHeight();

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
          // A fast flick can outrun the scrub's ~1s smoothing lag, leaving
          // earlier cards' pin/scale state visibly behind the actual scroll
          // position. This snaps the lagging tween to its end value once it
          // detects an abnormally fast scroll, instead of letting it drift.
          fastScrollEnd: true,
          // A big enough scroll jump (a fast trackpad flick) can skip past
          // the point where GSAP would normally clear the pin's transform
          // on unpin, leaving the card stuck translated into view instead
          // of back at its natural (offscreen) position. Clearing it
          // explicitly once the pin is done makes sure it's really gone.
          onLeave: function () {
            gsap.set(section, { clearProps: "transform" });
          },
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
              fastScrollEnd: true,
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
              fastScrollEnd: true,
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

  // Page-load entrance: the headline's fade + rise is a CSS animation (it
  // finishes around 1.0s); the first card follows, overlapping its tail —
  // starting ~0.6s after navigation began, fading in while rising 60px.
  // Driven by GSAP rather than CSS keyframes because the card's transform is
  // already owned by the scroll scale/tilt tween, and GSAP composes y with
  // scale/rotate instead of fighting over the same transform. The delay is
  // measured from navigation start (not from now) so it stays in sync with
  // the headline even when this script loads late.
  var rootEl = document.documentElement;
  if (rootEl.classList.contains("js-enter")) {
    var entranceDevice = document.querySelector(".cs-first .cs-device");
    if (entranceDevice) {
      gsap.fromTo(
        entranceDevice,
        { opacity: 0, y: 60 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: "expo.out",
          delay: Math.max(0, 0.6 - performance.now() / 1000),
          onComplete: function () {
            gsap.set(entranceDevice, { clearProps: "opacity" });
          },
        }
      );
    }
    // gsap has now set the card's inline start state, so the CSS hiding
    // rule is no longer needed (and must not linger past the animation).
    rootEl.classList.remove("js-enter");
  }

  // Resizing changes the first device's rendered height, so the hero needs
  // re-measuring too — and ScrollTrigger needs to re-read positions after.
  var heroResizeTimer;
  window.addEventListener("resize", function () {
    window.clearTimeout(heroResizeTimer);
    heroResizeTimer = window.setTimeout(function () {
      updateHeroHeight();
      ScrollTrigger.refresh();
    }, 150);
  });

  // Card content fades in once every video/image in the card has its first
  // frame (see .js-media in css/style.css). Anything that errors counts as
  // done, so one broken asset can't keep a card blank.
  document.querySelectorAll(".cs-device").forEach(function (device) {
    var media = device.querySelectorAll("video, img");
    var pending = 0;

    function markReady() {
      device.classList.add("is-media-ready");
    }

    function settle() {
      pending -= 1;
      if (pending <= 0) markReady();
    }

    media.forEach(function (el) {
      var isVideo = el.tagName === "VIDEO";
      var ready = isVideo ? el.readyState >= 2 : el.complete;
      if (ready) return;
      pending += 1;
      el.addEventListener(isVideo ? "loadeddata" : "load", settle, { once: true });
      el.addEventListener("error", settle, { once: true });
    });

    if (pending === 0) markReady();
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

    // Per-video override via data-play-delay (ms): a beat of stillness
    // before playback actually starts, instead of firing the instant the
    // card crosses its threshold.
    var playDelay = parseInt(video.dataset.playDelay, 10);
    if (isNaN(playDelay)) playDelay = 0;

    if (!("IntersectionObserver" in window)) {
      video.play();
      return;
    }

    var isInView = false;
    var pendingPlayTimer = null;

    function cancelScheduledPlay() {
      if (pendingPlayTimer) {
        window.clearTimeout(pendingPlayTimer);
        pendingPlayTimer = null;
      }
    }

    function schedulePlay() {
      if (pendingPlayTimer) return;
      pendingPlayTimer = window.setTimeout(function () {
        pendingPlayTimer = null;
        if (isInView) video.play().catch(function () {});
      }, playDelay);
    }

    // A play() call can silently fail (rejected promise) if it fires before
    // the video has buffered enough data — especially for large 4K sources.
    // IntersectionObserver only calls back on threshold *changes*, so if that
    // one attempt fails, nothing else retries it. Retry once the video signals
    // it's actually ready to play, as long as the card is still in view.
    video.addEventListener("canplay", function () {
      if (isInView) schedulePlay();
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          isInView = entry.intersectionRatio >= threshold;
          if (isInView) {
            schedulePlay();
          } else {
            cancelScheduledPlay();
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
  var submitError = document.getElementById("contactFormError");
  var messageField = document.getElementById("contactMessage");
  var submitBtn = document.getElementById("contactSubmitBtn");
  var submitLabel = submitBtn ? submitBtn.querySelector(".contact-form-submit-text") : null;

  var SUBMIT_LABELS = { idle: "Send message", sending: "Sending...", success: "Message sent" };

  // Cross-fades the button's label to the new state's text instead of
  // swapping it instantly: fade the current text out, swap the text and
  // the success/sending classes once it's invisible, then let it fade back
  // in — the checkmark's own width/opacity/scale transition (in CSS) runs
  // at the same time, so it pops in as the "Message sent" label settles.
  function setSubmitState(state, animate) {
    if (!submitBtn || !submitLabel) return;
    var apply = function () {
      submitLabel.textContent = SUBMIT_LABELS[state];
      submitBtn.classList.toggle("is-success", state === "success");
      submitBtn.classList.remove("is-changing");
    };
    if (animate === false) {
      apply();
      return;
    }
    submitBtn.classList.add("is-changing");
    window.setTimeout(apply, 160);
  }

  // Message field grows with its content instead of scrolling internally,
  // so the send button gets pushed down once typed text wraps past the
  // field's CSS min-height (see .contact-form textarea) — that min-height,
  // not this function, is what holds the resting position, so this only
  // ever needs to run in response to actual typing, never on open/close.
  function autoGrowMessage() {
    if (!messageField) return;
    messageField.style.height = "auto";
    messageField.style.height = messageField.scrollHeight + "px";
  }

  // Inline field errors (instead of the browser's native validation bubble),
  // shown below each field's underline — only on submit, never just from
  // typing or tabbing through, and cleared again as soon as the user edits
  // the field.
  var errorFields = [
    { input: document.getElementById("contactName"), error: document.getElementById("contactNameError") },
    { input: document.getElementById("contactEmail"), error: document.getElementById("contactEmailError") },
    { input: document.getElementById("contactMessage"), error: document.getElementById("contactMessageError") },
  ];

  function messageForError(input) {
    if (input.validity.valueMissing) return "Please fill out this field.";
    if (input.validity.typeMismatch) return "Please enter a valid email.";
    return "";
  }

  function hideFieldError(field) {
    field.error.hidden = true;
  }

  function showFieldError(field) {
    field.error.textContent = messageForError(field.input);
    field.error.hidden = false;
  }

  function clearAllErrors() {
    errorFields.forEach(hideFieldError);
  }

  function isAtMaxLength(input) {
    return input.maxLength > -1 && input.value.length >= input.maxLength;
  }

  errorFields.forEach(function (field) {
    field.input.addEventListener("input", function () {
      if (isAtMaxLength(field.input)) {
        field.error.textContent = "You've reached the " + field.input.maxLength + " character limit.";
        field.error.hidden = false;
        return;
      }
      hideFieldError(field);
    });
  });

  if (messageField) {
    messageField.addEventListener("input", autoGrowMessage);
  }

  if (trigger && panel && closeBtn) {
    var isOpen = false;
    var TOP_GAP = 60;
    var SHEET_RADIUS = 24;
    var PILL_RADIUS = 100;
    // Set while reacting to a popstate (browser back/forward) so open/close
    // don't push yet another history entry on top of the one the user just
    // navigated to.
    var suppressHistory = false;
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

    // Springs the panel to a rect with Motion; resolves when it settles.
    // If Motion never loaded, just jump there instead of leaving it stuck.
    function animatePanel(rect) {
      return motionReady.then(function (motion) {
        if (!motion) {
          setPanelRect(rect);
          return;
        }
        return motion.animate(
          panel,
          { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
          SPRING
        ).finished;
      });
    }

    function openPanel() {
      if (isOpen) return;
      isOpen = true;

      if (!suppressHistory && window.location.pathname !== "/contact") {
        window.history.pushState({ contact: true }, "", "/contact");
      }

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
        animatePanel(target);
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
      setSubmitState("idle", false);
      if (submitBtn) submitBtn.disabled = false;
      if (submitError) submitError.hidden = true;
      // Hand sizing back to the CSS min-height floor rather than measuring
      // via scrollHeight — cleared text has nothing to measure anyway, and
      // this keeps the resting position purely CSS-driven and immune to
      // whatever width the field happens to be at when this runs.
      if (messageField) messageField.style.height = "";
      clearAllErrors();
    }

    function closePanel() {
      if (!isOpen) return;
      isOpen = false;

      if (!suppressHistory && window.location.pathname === "/contact") {
        window.history.pushState({ contact: false }, "", "/");
      }

      var rect = trigger.getBoundingClientRect();
      panel.classList.remove("is-open");
      // Lift the background blur the moment dismissal starts, rather than
      // waiting for the shrink spring to finish — the blur's own transition
      // then plays concurrently with the panel animation instead of after it.
      document.body.classList.remove("contact-open");

      if (prefersReducedMotion) {
        panel.style.visibility = "hidden";
        revealTrigger();
        resetForm();
        return;
      }

      setPanelRadii(pillRadii()); // CSS transition takes it from here
      var settled = animatePanel(rect);

      // Bring the button's own label back well before the spring's tail has
      // fully settled — by ~300ms the panel is already visually on top of
      // the button's position, so revealing it here (instead of waiting on
      // the animation's finish) removes the "blank pill" lag without any visual
      // seam, since the panel still covers the button until it's shrunk all
      // the way down.
      window.setTimeout(revealTrigger, 300);

      settled.then(function () {
        panel.style.visibility = "hidden";
        resetForm();
      });
    }

    trigger.addEventListener("click", openPanel);
    closeBtn.addEventListener("click", closePanel);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen) closePanel();
    });

    // Back/forward through history should open or close the panel to match,
    // without pushing another entry on top of the one just navigated to.
    window.addEventListener("popstate", function () {
      suppressHistory = true;
      if (window.location.pathname === "/contact") {
        openPanel();
      } else {
        closePanel();
      }
      suppressHistory = false;
    });

    // A direct hit to /contact (or one restored from the 404.html redirect
    // above) should land with the panel already open.
    if (window.location.pathname === "/contact") {
      openPanel();
    }

    window.addEventListener("resize", function () {
      if (isOpen) setPanelRect(sheetRect());
    });

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();

        var firstInvalid = null;
        errorFields.forEach(function (field) {
          if (field.input.validity.valid) {
            hideFieldError(field);
          } else {
            showFieldError(field);
            if (!firstInvalid) firstInvalid = field.input;
          }
        });
        if (firstInvalid) {
          firstInvalid.focus();
          return;
        }

        if (submitError) submitError.hidden = true;
        if (submitBtn) submitBtn.disabled = true;
        setSubmitState("sending");

        // This site is fully static (no backend of its own), so the actual
        // delivery to an inbox is handled by Web3Forms — it takes the
        // access_key hidden field above, emails the rest of the submitted
        // fields to the address that key is registered to, and returns
        // whether that succeeded.
        fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(Object.fromEntries(new FormData(form))),
        })
          .then(function (response) {
            return response.json().then(function (data) {
              return { ok: response.ok, data: data };
            });
          })
          .then(function (result) {
            if (!result.ok || !result.data.success) throw new Error("Web3Forms submission failed");
            setSubmitState("success");
            // Leave the "Message sent" + checkmark state on screen for a
            // beat before the panel closes, rather than swapping it away
            // the instant it appears.
            window.setTimeout(closePanel, 1600);
          })
          .catch(function () {
            setSubmitState("idle");
            if (submitBtn) submitBtn.disabled = false;
            if (submitError) submitError.hidden = false;
          });
      });
    }
  }
});
