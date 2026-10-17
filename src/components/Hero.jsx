import React, { useEffect, useMemo, useState } from "react";
import { useMyContext } from "../Context/MyContext";

const EMPTY_ITEMS = [];

const FOCUS_HIGHLIGHTS = [
  "Youth unity and peaceful coexistence",
  "Skills, learning and self-reliance",
  "Community participation and development",
  "Leadership and responsibility",
  "Working together for Jenta Adamu Ward",
  "Build the Youth, Build the Nation",
];

const Hero = () => {
  const {
    publishedGallery = EMPTY_ITEMS,
    publishedDocumentaries,
    documentaries = EMPTY_ITEMS,
    cycProfile,
  } = useMyContext();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [failedImages, setFailedImages] = useState([]);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [headerOffset, setHeaderOffset] = useState(180);

  const title = cycProfile?.title || "Central Youth Council";
  const subtitle = "Jenta Adamu Ward · Jos North";
  const slogan = cycProfile?.slogan || "Build the Youth, Build the Nation";
  const logoUrl = cycProfile?.logoUrl || "/images/cyclogo.png";

  const slides = useMemo(() => {
    const isPublicPhoto = (item) => {
      const url = item.mediaUrl || item.imageUrl;
      if (item.status !== "published" || !url || failedImages.includes(url)) {
        return false;
      }
      const type = String(item.mediaType || "").toLowerCase();
      return (
        type === "photo" ||
        type === "image" ||
        (!type && Boolean(item.imageUrl))
      );
    };

    const galleryPhotos = publishedGallery.filter(isPublicPhoto);
    const legacyPhotos = (publishedDocumentaries || documentaries).filter(
      (item) => isPublicPhoto(item) && item.category === "photo-highlights"
    );
    const candidates = galleryPhotos.length ? galleryPhotos : legacyPhotos;
    const seen = new Set();

    return candidates
      .map((item) => ({
        id: item.id || item.mediaUrl || item.imageUrl,
        url: item.mediaUrl || item.imageUrl,
      }))
      .filter((item) => {
        if (!item.url || failedImages.includes(item.url) || seen.has(item.url)) {
          return false;
        }
        seen.add(item.url);
        return true;
      });
  }, [publishedGallery, publishedDocumentaries, documentaries, failedImages]);

  const activeIndex = slides.length ? currentIndex % slides.length : 0;
  const motionPaused = isPaused || reducedMotion;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return undefined;

    const measureHeader = () =>
      setHeaderOffset(Math.ceil(header.getBoundingClientRect().height) + 20);

    measureHeader();
    window.addEventListener("resize", measureHeader);
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measureHeader)
        : null;
    observer?.observe(header);

    return () => {
      window.removeEventListener("resize", measureHeader);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (slides.length < 2 || motionPaused) return undefined;

    const interval = window.setInterval(() => {
      setCurrentIndex((previous) => (previous + 1) % slides.length);
    }, 7000);

    return () => window.clearInterval(interval);
  }, [slides.length, motionPaused]);

  const handleImageError = (url) => {
    setFailedImages((previous) =>
      previous.includes(url) ? previous : [...previous, url]
    );
  };

  const scrollToSection = (event, id) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();

    const header = document.querySelector("header");
    const offset = (header?.getBoundingClientRect().height || 120) + 12;

    window.scrollTo({
      top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset),
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  const renderAnimatedLetters = (text, baseDelay = 0) => {
    let letterIndex = 0;
    return String(text).split(" ").map((word, wordIndex) => (
      <React.Fragment key={`${word}-${wordIndex}`}>
        {wordIndex > 0 && " "}
        <span className="inline-block whitespace-nowrap">
          {Array.from(word).map((letter, index) => {
            const delay = baseDelay + letterIndex++ * 0.035;
            return (
              <span
                key={`${letter}-${index}`}
                className="cyc-hero-letter inline-block"
                style={{ animationDelay: `${delay}s` }}
              >
                {letter}
              </span>
            );
          })}
        </span>
      </React.Fragment>
    ));
  };

  return (
    <section
      id="home"
      aria-labelledby="cyc-hero-title"
      className="cyc-hero relative isolate flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#034324] text-center"
      style={{ paddingTop: headerOffset }}
    >
      <style>{`
        @keyframes cycHeroLogoReveal {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes cycHeroLetterBounce {
          0% { opacity: 0; transform: translateY(-36px); }
          60% { opacity: 1; transform: translateY(5px); }
          80% { transform: translateY(-3px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes cycHeroTicker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .cyc-hero { min-height: 100svh; }
        .cyc-hero .cyc-hero-logo {
          animation: cycHeroLogoReveal 0.8s ease-out both;
        }
        .cyc-hero .cyc-hero-letter {
          animation: cycHeroLetterBounce 0.65s ease-out both;
        }
        .cyc-hero .cyc-ticker-track {
          display: flex;
          width: max-content;
          animation: cycHeroTicker 48s linear infinite;
        }
        .cyc-hero .cyc-ticker-window:hover .cyc-ticker-track {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .cyc-hero .cyc-hero-logo,
          .cyc-hero .cyc-hero-letter,
          .cyc-hero .cyc-ticker-track {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
          .cyc-hero .cyc-slide { transition: none !important; }
        }
      `}</style>

      {/* Background photos are decorative; the council name is in the heading. */}
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-br from-[#065F2F] via-[#034324] to-[#011F13]" />

        {slides.length ? (
          slides.map((slide, index) => (
            <img
              key={slide.url}
              src={slide.url}
              alt=""
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
              onError={() => handleImageError(slide.url)}
              className={`cyc-slide absolute inset-0 h-full w-full object-cover object-[center_top] transition-opacity duration-[1500ms] sm:object-center ${
                index === activeIndex ? "opacity-100" : "opacity-0"
              }`}
            />
          ))
        ) : (
          !fallbackFailed && (
            <img
              src="/images/cyc-hero.jpg"
              alt=""
              onError={() => setFallbackFailed(true)}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          )
        )}

        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#012C1A]/55 via-transparent to-[#012C1A]/90" />
      </div>

      {/* This content stays visible after the entrance animation. */}
      <div className="relative z-10 mx-auto w-full max-w-5xl px-5 pb-44 pt-6 sm:px-8 md:pb-40 md:pt-10">
        <img
          src={logoUrl}
          alt="Plateau State Youth Council emblem"
          width="112"
          height="112"
          className="cyc-hero-logo mx-auto mb-6 h-20 w-20 object-contain drop-shadow-lg md:h-28 md:w-28"
        />

        <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#BFE8A8] sm:text-sm">
          Youth · Community · Progress
        </p>

        <h1
          id="cyc-hero-title"
          className="mb-4 text-3xl font-extrabold uppercase leading-tight tracking-wide text-white drop-shadow-lg sm:text-5xl lg:text-6xl"
        >
          <span className="sr-only">{title}</span>
          <span aria-hidden="true">{renderAnimatedLetters(title, 0.2)}</span>
        </h1>

        <p className="mb-4 text-lg font-bold text-[#F2B705] drop-shadow-lg sm:text-2xl">
          {subtitle}
        </p>

        <p className="mb-4 text-base font-semibold italic text-white sm:text-xl">
          {slogan}
        </p>

        <p className="mx-auto mb-8 max-w-2xl text-sm leading-relaxed text-white/90 sm:text-base md:text-lg">
          Uniting young people, supporting their potential, and working together
          for the growth of Jenta Adamu Ward.
        </p>

        <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <a
            href="#about"
            onClick={(event) => scrollToSection(event, "about")}
            className="rounded-full bg-[#F2B705] px-8 py-3 font-bold text-[#034324] shadow-lg transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            About the Council
          </a>
          <a
            href="#projects"
            onClick={(event) => scrollToSection(event, "projects")}
            className="rounded-full border border-white/70 bg-white/5 px-8 py-3 font-bold text-white transition hover:bg-white hover:text-[#065F2F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Explore Our Projects
          </a>
        </div>

        {slides.length > 1 && (
          <div className="mt-7 flex justify-center gap-2" aria-label="Background photos">
            {slides.map((slide, index) => (
              <button
                key={slide.url}
                type="button"
                aria-label={`Show background photo ${index + 1}`}
                aria-pressed={index === activeIndex}
                onClick={() => {
                  setCurrentIndex(index);
                  setIsPaused(true);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                <span className={`block h-2.5 rounded-full transition-all ${
                  index === activeIndex ? "w-6 bg-[#F2B705]" : "w-2.5 bg-white/60"
                }`} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-5 md:pb-7">
        <div className="mx-auto mb-2 flex max-w-6xl justify-end">
          <button
            type="button"
            onClick={() => setIsPaused((previous) => !previous)}
            disabled={reducedMotion}
            aria-pressed={motionPaused}
            aria-label={motionPaused ? "Resume slideshow and ticker" : "Pause slideshow and ticker"}
            className="rounded-full border border-white/30 bg-[#012C1A]/80 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#065F2F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:cursor-default"
          >
            {reducedMotion ? "Motion reduced" : isPaused ? "Resume motion" : "Pause motion"}
          </button>
        </div>

        <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-[#9ED46D]/40 bg-white/95 shadow-2xl backdrop-blur-md">
          <div className="flex items-center">
            <div className="shrink-0 bg-[#065F2F] px-4 py-4 text-left md:px-6">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#C4E9A9] md:text-xs">
                CYC
              </p>
              <p className="text-xs font-bold text-white md:text-sm">Our Focus</p>
            </div>

            <div className="cyc-ticker-window relative min-w-0 flex-1 overflow-hidden py-4">
              <p className="sr-only">{FOCUS_HIGHLIGHTS.join(". ")}</p>
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-white to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-white to-transparent" />

              <div
                className="cyc-ticker-track text-sm font-semibold text-[#065F2F] md:text-base"
                aria-hidden="true"
                style={{ animationPlayState: motionPaused ? "paused" : "running" }}
              >
                {[0, 1].map((copy) => (
                  <div key={copy} className="flex shrink-0 items-center gap-6 whitespace-nowrap pr-6">
                    {FOCUS_HIGHLIGHTS.map((highlight) => (
                      <span key={highlight} className="inline-flex items-center gap-6">
                        <span>{highlight}</span>
                        <span className="text-[#0B7A3E]">✦</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
