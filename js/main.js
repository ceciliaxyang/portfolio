document.addEventListener("DOMContentLoaded", function () {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mm = gsap.matchMedia();

  // Desktop / motion-ok: pinned stack, each card shrinking + tilting as the next covers it.
  mm.add("(min-width: 901px)", function () {
    if (prefersReducedMotion) return;

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
      var tilt = tiltAngles[index % tiltAngles.length];

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

      if (device) {
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
      }
    });
  });
});
