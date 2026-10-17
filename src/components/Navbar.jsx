import { useEffect, useRef, useState } from "react";
import { BsList, BsX } from "react-icons/bs";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useMyContext } from "../Context/MyContext";

const SECTION_IDS = [
  "home", "about", "exco", "projects", "news", "gallery", "contact", "inbox",
];

const isVisibleSection = (element) =>
  element.getClientRects().length > 0 &&
  window.getComputedStyle(element).visibility !== "hidden";

const resolveSection = (path) => {
  // Prefer the visible inner section if a wrapper repeats the same ID.
  let matches = Array.from(document.querySelectorAll(`[id="${path}"]`));
  if (!matches.length) {
    matches = Array.from(document.querySelectorAll("[id]")).filter(
      (element) => element.id.toLowerCase() === path
    );
  }
  if (!matches.length) {
    matches = Array.from(document.querySelectorAll(`[name="${path}"]`));
  }
  return matches.filter(isVisibleSection).sort((a, b) => {
    if (a.contains(b)) return 1;
    if (b.contains(a)) return -1;
    return Number(b.tagName === "SECTION") - Number(a.tagName === "SECTION");
  })[0] || null;
};

const getScrollContainer = (element) => {
  let parent = element.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const overflow = window.getComputedStyle(parent).overflowY;
    if (/(auto|scroll|overlay)/.test(overflow) && parent.scrollHeight > parent.clientHeight + 1) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return window;
};

const readSectionHash = () => {
  try {
    const value = decodeURIComponent(window.location.hash.slice(1)).toLowerCase();
    return SECTION_IDS.includes(value) ? value : null;
  } catch {
    return null;
  }
};

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [pinnedDropdown, setPinnedDropdown] = useState(null);
  const [activeMobileDropdown, setActiveMobileDropdown] = useState(null);
  const [activeNavItem, setActiveNavItem] = useState("home");

  const closeTimeout = useRef(null);
  const [pendingSection, setPendingSection] = useState(null);
  const requestNumberRef = useRef(0);
  const navigationLockRef = useRef(null);
  const headerRef = useRef(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  const [signUpName, setSignUpName] = useState("");
  const [signUpPhone, setSignUpPhone] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");

  // These compatibility aliases are provided by the updated CYC context.
  const {
    currentUser,
    signInNewDawnUser,
    signUpNewDawnUser,
    logoutNewDawnUser,
  } = useMyContext();

  const navItems = [
    { link: "Home", path: "home" },
    {
      link: "About",
      path: "about",
      children: [
        { link: "About the Council", path: "about" },
        { link: "Our Executives", path: "exco" },
        { link: "Our Projects", path: "projects" },
      ],
    },
    { link: "EXCO", path: "exco" },
    { link: "Projects", path: "projects" },
    { link: "News", path: "news" },
    { link: "Gallery", path: "gallery" },
    {
      link: "Contact",
      path: "contact",
      children: [
        { link: "Contact Us", path: "contact" },
        ...(currentUser ? [{ link: "Inbox", path: "inbox" }] : []),
      ],
    },
  ];

  useEffect(() => {
    let frame = null;
    const updateActiveSection = () => {
      frame = null;
      setIsSticky(window.scrollY > 40);
      const headerBottom = Math.max(0, headerRef.current?.getBoundingClientRect().bottom || 0);
      const sections = SECTION_IDS.map((path) => {
        const element = resolveSection(path);
        return element ? { path, element, top: element.getBoundingClientRect().top } : null;
      }).filter(Boolean).sort((a, b) => a.top - b.top);
      if (!sections.length) return;

      const lock = navigationLockRef.current;
      if (lock && performance.now() < lock.until && resolveSection(lock.path)) {
        setActiveNavItem(lock.path);
        return;
      }
      navigationLockRef.current = null;
      let active = sections[0].path;
      for (const section of sections) {
        const scroller = getScrollContainer(section.element);
        const containerTop = scroller === window ? 0 : scroller.getBoundingClientRect().top + scroller.clientTop;
        if (section.top <= Math.max(headerBottom, containerTop) + 24) active = section.path;
      }
      const last = sections[sections.length - 1];
      const scroller = getScrollContainer(last.element);
      const scrollTop = scroller === window ? window.scrollY : scroller.scrollTop;
      const maximum = scroller === window
        ? Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
        : Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      if (maximum > 0 && scrollTop >= maximum - 3) active = last.path;
      setActiveNavItem(active);
    };
    const scheduleUpdate = () => {
      if (frame === null) frame = window.requestAnimationFrame(updateActiveSection);
    };
    const unlock = () => { navigationLockRef.current = null; scheduleUpdate(); };
    const handleNavigationKey = (event) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) unlock();
    };
    document.addEventListener("scroll", scheduleUpdate, { capture: true, passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("wheel", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });
    document.addEventListener("keydown", handleNavigationKey);
    const mutationObserver = new MutationObserver(scheduleUpdate);
    mutationObserver.observe(document.body, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ["id", "name", "hidden"],
    });
    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(scheduleUpdate) : null;
    resizeObserver?.observe(document.body);
    if (headerRef.current) resizeObserver?.observe(headerRef.current);
    scheduleUpdate();
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      document.removeEventListener("scroll", scheduleUpdate, true);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("wheel", unlock);
      window.removeEventListener("touchstart", unlock);
      document.removeEventListener("keydown", handleNavigationKey);
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    const navigateFromHash = () => {
      const path = readSectionHash();
      if (!path) return;
      setIsMenuOpen(false);
      setActiveDropdown(null);
      setPinnedDropdown(null);
      setActiveMobileDropdown(null);
      setPendingSection({ path, history: false, focus: false, request: ++requestNumberRef.current });
    };
    navigateFromHash();
    window.addEventListener("hashchange", navigateFromHash);
    window.addEventListener("popstate", navigateFromHash);
    return () => {
      window.removeEventListener("hashchange", navigateFromHash);
      window.removeEventListener("popstate", navigateFromHash);
    };
  }, []);

  useEffect(() => {
    // This effect runs after React removes the mobile menu from the DOM.
    if (!pendingSection || isMenuOpen) return undefined;
    let cancelled = false;
    let firstFrame = null;
    let secondFrame = null;
    let observer = null;
    let timeout = null;

    const tryNavigation = () => {
      if (cancelled) return false;
      const target = resolveSection(pendingSection.path);
      if (!target) return false;
      observer?.disconnect();
      window.clearTimeout(timeout);
      const headerBottom = Math.max(0, headerRef.current?.getBoundingClientRect().bottom || 0);
      const scroller = getScrollContainer(target);
      let top;
      let maximum;
      if (scroller === window) {
        top = target.getBoundingClientRect().top + window.scrollY - headerBottom - 12;
        maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      } else {
        const containerTop = scroller.getBoundingClientRect().top + scroller.clientTop;
        const overlap = Math.max(0, headerBottom - containerTop);
        top = target.getBoundingClientRect().top - containerTop + scroller.scrollTop - overlap - 12;
        maximum = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      }
      if (pendingSection.path === "home") top = 0;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      navigationLockRef.current = { path: pendingSection.path, until: performance.now() + 1600 };
      scroller.scrollTo({ top: Math.max(0, Math.min(top, maximum)), behavior: reducedMotion ? "auto" : "smooth" });
      setActiveNavItem(pendingSection.path);

      if (pendingSection.history) {
        const url = new URL(window.location.href);
        url.hash = pendingSection.path;
        if (pendingSection.path !== "gallery") url.searchParams.delete("gallery");
        if (url.href !== window.location.href) window.history.pushState(window.history.state, "", url);
      }
      if (pendingSection.focus) {
        const hadTabIndex = target.hasAttribute("tabindex");
        if (!hadTabIndex) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
        if (!hadTabIndex) target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
      }
      setPendingSection(null);
      return true;
    };

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (cancelled || tryNavigation()) return;
        // Allow a section rendered shortly after the click to become available.
        observer = new MutationObserver(tryNavigation);
        observer.observe(document.body, {
          childList: true, subtree: true, attributes: true,
          attributeFilter: ["id", "name", "hidden", "class"],
        });
        timeout = window.setTimeout(() => {
          if (cancelled || tryNavigation()) return;
          observer?.disconnect();
          console.warn(`CYC navigation: no visible section with id="${pendingSection.path}". Check that its component is mounted once in App.jsx.`);
          if (pendingSection.history) toast.info("This section is not available on this page yet.");
          setPendingSection(null);
        }, 1800);
      });
    });
    return () => {
      cancelled = true;
      if (firstFrame !== null) window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(timeout);
      observer?.disconnect();
    };
  }, [pendingSection, isMenuOpen]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;

      setIsMenuOpen(false);
      setActiveMobileDropdown(null);
      setActiveDropdown(null);
      setPinnedDropdown(null);
      setShowSignInModal(false);
      setShowSignUpModal(false);
      setShowPassword(false);
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(closeTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (!showSignInModal && !showSignUpModal) return undefined;

    const previousFocus = document.activeElement;
    const dialog = document.getElementById(
      showSignInModal ? "cyc-signin-dialog" : "cyc-signup-dialog"
    );

    if (!dialog) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const selector = 'button:not([disabled]), input:not([disabled]), a[href]';

    dialog.querySelector("input")?.focus();

    const trapFocus = (event) => {
      if (event.key !== "Tab") return;

      const elements = Array.from(dialog.querySelectorAll(selector));
      const first = elements[0];
      const last = elements[elements.length - 1];

      if (!first) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", trapFocus);

    return () => {
      document.body.style.overflow = previousOverflow;
      dialog.removeEventListener("keydown", trapFocus);

      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [showSignInModal, showSignUpModal]);

  useEffect(() => {
    const closeOutside = (event) => {
      if (headerRef.current?.contains(event.target)) return;
      setIsMenuOpen(false);
      setActiveMobileDropdown(null);
      setActiveDropdown(null);
      setPinnedDropdown(null);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  const displayName =
    currentUser?.displayName || currentUser?.email?.split("@")[0] || "User";

  const closeMobileMenu = () => {
    setIsMenuOpen(false);
    setActiveMobileDropdown(null);
  };

  const handleScrollAdjust = (event, itemOrPath) => {
    // Preserve normal browser behavior for modified clicks and new tabs.
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
      (typeof event.button === "number" && event.button !== 0)) return;
    const item = typeof itemOrPath === "string" ? { path: itemOrPath } : itemOrPath;
    if (!item?.path || !SECTION_IDS.includes(item.path)) return;
    event.preventDefault();
    clearTimeout(closeTimeout.current);
    setIsMenuOpen(false);
    setActiveDropdown(null);
    setPinnedDropdown(null);
    setActiveMobileDropdown(null);
    setPendingSection({ path: item.path, history: true, focus: true, request: ++requestNumberRef.current });
  };

  // A submenu may point to another main section. Highlight the actual section.
  const isItemActive = (item) => activeNavItem === item.path;

  const openDropdownFor = (name) => {
    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current);
      closeTimeout.current = null;
    }

    setActiveDropdown(name);
  };

  const scheduleCloseDropdown = (name) => {
    if (pinnedDropdown === name) return;

    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current);
    }

    closeTimeout.current = setTimeout(() => {
      setActiveDropdown((prev) => (prev === name ? null : prev));
      closeTimeout.current = null;
    }, 180);
  };

  const toggleDesktopDropdown = (name) => {
    if (pinnedDropdown === name) {
      setPinnedDropdown(null);
      setActiveDropdown(null);
    } else {
      setPinnedDropdown(name);
      setActiveDropdown(name);
    }
  };

  const toggleMobileDropdown = (name) => {
    setActiveMobileDropdown((prev) => (prev === name ? null : name));
  };

  const openSignIn = () => {
    if (isSubmitting) return;

    setShowPassword(false);
    setShowSignInModal(true);
    setShowSignUpModal(false);
    closeMobileMenu();
  };

  const openSignUp = () => {
    if (isSubmitting) return;

    setShowPassword(false);
    setShowSignUpModal(true);
    setShowSignInModal(false);
    closeMobileMenu();
  };

  const closeAuthModals = () => {
    setShowSignInModal(false);
    setShowSignUpModal(false);
    setShowPassword(false);
  };

  const authErrorMessage = (error, fallback) => {
    switch (error?.code) {
      case "auth/invalid-email":
        return "Please enter a valid email address.";

      case "auth/invalid-credential":
      case "auth/invalid-login-credentials":
      case "auth/user-not-found":
      case "auth/wrong-password":
        return "Your email or password is incorrect. Please try again.";

      case "auth/email-already-in-use":
        return "An account already uses this email. Please sign in.";

      case "auth/weak-password":
        return "Please use a stronger password with at least six characters.";

      case "auth/too-many-requests":
        return "Too many attempts. Please wait a moment and try again.";

      case "auth/network-request-failed":
        return "Please check your internet connection and try again.";

      case "auth/user-disabled":
        return "This account is unavailable. Please contact the council.";

      default:
        return fallback;
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      await signInNewDawnUser({
        email: signInEmail.trim(),
        password: signInPassword,
      });

      toast.success("Signed in successfully");
      setSignInEmail("");
      setSignInPassword("");
      closeAuthModals();
    } catch (error) {
      console.error("CYC sign-in error:", error);

      toast.error(
        authErrorMessage(
          error,
          "We couldn't sign you in. Please try again."
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!signUpName.trim()) {
      toast.error("Please enter your full name.");
      return;
    }

    setIsSubmitting(true);

    try {
      await signUpNewDawnUser({
        name: signUpName.trim(),
        phone: signUpPhone.trim(),
        email: signUpEmail.trim(),
        password: signUpPassword,
        role: "viewer",
      });

      toast.success("Account created successfully");
      setSignUpName("");
      setSignUpPhone("");
      setSignUpEmail("");
      setSignUpPassword("");
      closeAuthModals();
    } catch (error) {
      console.error("CYC sign-up error:", error);

      toast.error(
        authErrorMessage(
          error,
          "We couldn't create your account. Please try again."
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      await logoutNewDawnUser();
      toast.info("Logged out successfully");
      closeMobileMenu();
    } catch (error) {
      console.error("CYC logout error:", error);
      toast.error("We couldn't log you out. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ToastContainer />

      <header
        ref={headerRef}
        className="fixed top-0 left-0 w-full z-50 transition-all duration-300"
      >
        <div
          className={`w-full transition-all duration-300 ${
            isSticky ? "shadow-lg" : "shadow-sm"
          }`}
        >
          <div className="w-full bg-[#065F2F] text-white text-xs md:text-sm shadow-sm">
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-2 py-2 px-4">
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                <span className="font-bold tracking-wide uppercase text-[#F2B705]">
                  Central Youth Council
                </span>

                <span className="font-semibold">
                  Jenta Adamu Ward · Jos North
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {currentUser ? (
                  <>
                    <span className="inline-flex items-center gap-2 bg-white/15 border border-white/20 text-white px-3 py-1 rounded-full text-[11px] md:text-xs font-semibold">
                      <span className="h-2 w-2 rounded-full bg-[#22C55E] inline-block" />
                      Logged in
                    </span>

                    <span className="bg-white/10 px-3 py-1 rounded-full text-[11px] md:text-xs font-medium max-w-[220px] truncate">
                      {displayName}
                    </span>

                    <button
                      onClick={handleLogout}
                      disabled={isSubmitting}
                      className="bg-red-500 text-white text-xs font-semibold tracking-wide px-4 py-1 rounded-sm uppercase hover:bg-red-600 transition"
                      type="button"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <span className="bg-white/10 px-3 py-1 rounded-full text-[11px] md:text-xs font-medium">
                      Not logged in
                    </span>

                    <button
                      onClick={openSignIn}
                      className="bg-[#F2B705] text-[#065F2F] text-xs font-bold tracking-wide px-4 py-1 rounded-sm uppercase hover:bg-white transition"
                      type="button"
                    >
                      Login / Register
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="w-full bg-white border-b border-[#C9F5DC]">
            <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
              <a
                href="#home"
                onClick={(e) => handleScrollAdjust(e, "home")}
                className="flex items-center gap-3 min-w-0"
              >
                <img
                  src="/images/cyclogo.png"
                  alt="Plateau State Youth Council emblem"
                  className="h-12 w-12 md:h-16 md:w-16 shrink-0 object-contain"
                  width="64"
                  height="64"
                />

                <div className="min-w-0 leading-tight">
                  <h1 className="text-xs sm:text-sm xl:text-lg font-extrabold uppercase text-[#065F2F] tracking-wide">
                    Central Youth Council
                  </h1>

                  <p className="text-[10px] sm:text-xs text-[#0B7A3E] font-semibold">
                    Jenta Adamu Ward · Jos North
                  </p>
                </div>
              </a>

              <nav
                className="hidden lg:flex items-center justify-end flex-1 gap-4 xl:gap-6 text-xs xl:text-sm font-bold text-[#065F2F] relative"
                aria-label="Primary"
              >
                {navItems.map((item) => {
                  const hasChildren =
                    Array.isArray(item.children) && item.children.length > 0;

                  const active = isItemActive(item);

                  if (!hasChildren) {
                    return (
                      <a
                        key={item.link}
                        href={`#${item.path}`}
                        aria-current={activeNavItem === item.path ? "location" : undefined}
                        onClick={(e) => handleScrollAdjust(e, item)}
                        className={`cursor-pointer uppercase tracking-wide transition ${
                          active
                            ? "text-[#F2B705]"
                            : "text-[#065F2F] hover:text-[#F2B705]"
                        }`}
                      >
                        {item.link}
                      </a>
                    );
                  }

                  return (
                    <div
                      key={item.link}
                      className="relative"
                      onMouseEnter={() => openDropdownFor(item.link)}
                      onMouseLeave={() => scheduleCloseDropdown(item.link)}
                    >
                      <div className="flex items-center gap-1">
                        <a
                          href={`#${item.path}`}
                          aria-current={activeNavItem === item.path ? "location" : undefined}
                          onClick={(e) => handleScrollAdjust(e, item)}
                          className={`cursor-pointer uppercase tracking-wide transition ${
                            active || activeDropdown === item.link
                              ? "text-[#F2B705]"
                              : "text-[#065F2F] hover:text-[#F2B705]"
                          }`}
                        >
                          {item.link}
                        </a>

                        <button
                          type="button"
                          aria-label={`Toggle ${item.link} submenu`}
                          aria-haspopup="true"
                          aria-expanded={activeDropdown === item.link}
                          onClick={() => toggleDesktopDropdown(item.link)}
                          className={`transition ${
                            active || activeDropdown === item.link
                              ? "text-[#F2B705]"
                              : "text-[#0B7A3E] hover:text-[#F2B705]"
                          }`}
                        >
                          <svg
                            className={`w-3 h-3 transition-transform ${
                              activeDropdown === item.link ? "rotate-180" : ""
                            }`}
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>

                      <div
                        aria-label={`${item.link} submenu`}
                        className={[
                          "absolute right-0 mt-3 w-64 bg-white border border-[#C9F5DC] shadow-xl rounded-xl overflow-hidden z-50",
                          activeDropdown === item.link ? "block" : "hidden",
                        ].join(" ")}
                        onMouseEnter={() => openDropdownFor(item.link)}
                        onMouseLeave={() => scheduleCloseDropdown(item.link)}
                      >
                        <ul className="flex flex-col">
                          {item.children.map((child) => (
                            <li key={child.link}>
                              <a
                                href={`#${child.path}`}
                                aria-current={activeNavItem === child.path ? "location" : undefined}
                                onClick={(e) => handleScrollAdjust(e, child)}
                                className={`block px-5 py-3 text-sm font-semibold cursor-pointer transition ${
                                  activeNavItem === child.path
                                    ? "bg-[#F2B705] text-[#065F2F]"
                                    : "text-slate-700 hover:bg-[#F2B705] hover:text-[#065F2F]"
                                }`}
                              >
                                {child.link}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </nav>

              <button
                className="lg:hidden text-[#065F2F] text-3xl hover:text-[#F2B705] transition"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}
                aria-expanded={isMenuOpen}
                aria-controls="cyc-mobile-menu"
                type="button"
              >
                {isMenuOpen ? <BsX /> : <BsList />}
              </button>
            </div>

            {isMenuOpen && (
              <div
                id="cyc-mobile-menu"
                className="lg:hidden absolute top-full left-0 w-full max-h-[65vh] overflow-y-auto bg-white shadow-lg z-50 border-t border-[#C9F5DC]"
              >
                <nav
                  aria-label="Mobile navigation"
                  className="flex flex-col py-3 px-4 text-sm font-bold text-[#065F2F]"
                >
                  <div className="mb-3 rounded-lg bg-[#E9FFF3] border border-[#C9F5DC] px-3 py-2">
                    <p className="text-xs font-extrabold uppercase tracking-wide text-[#065F2F]">
                      Central Youth Council
                    </p>

                    <p className="text-xs text-[#0B7A3E] font-bold italic">
                      Jenta Adamu Ward · Jos North
                    </p>
                  </div>

                  {navItems.map((item) => {
                    const hasChildren =
                      Array.isArray(item.children) && item.children.length > 0;

                    const active = isItemActive(item);

                    if (!hasChildren) {
                      return (
                        <a
                          key={item.link}
                          href={`#${item.path}`}
                          aria-current={activeNavItem === item.path ? "location" : undefined}
                          onClick={(e) => handleScrollAdjust(e, item)}
                          className={`py-3 border-b border-[#E9FFF3] uppercase cursor-pointer transition ${
                            active
                              ? "text-[#F2B705]"
                              : "text-[#065F2F] hover:text-[#F2B705]"
                          }`}
                        >
                          {item.link}
                        </a>
                      );
                    }

                    return (
                      <div
                        key={item.link}
                        className="border-b border-[#E9FFF3]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={`#${item.path}`}
                            aria-current={activeNavItem === item.path ? "location" : undefined}
                            onClick={(e) => handleScrollAdjust(e, item)}
                            className={`flex-1 py-3 uppercase cursor-pointer transition ${
                              active || activeMobileDropdown === item.link
                                ? "text-[#F2B705]"
                                : "text-[#065F2F] hover:text-[#F2B705]"
                            }`}
                          >
                            {item.link}
                          </a>

                          <button
                            type="button"
                            onClick={() => toggleMobileDropdown(item.link)}
                            className={`py-3 px-2 transition ${
                              active || activeMobileDropdown === item.link
                                ? "text-[#F2B705]"
                                : "text-[#0B7A3E] hover:text-[#F2B705]"
                            }`}
                            aria-label={`Toggle ${item.link} submenu`}
                            aria-expanded={activeMobileDropdown === item.link}
                          >
                            <svg
                              className={`w-3 h-3 transition-transform ${
                                activeMobileDropdown === item.link
                                  ? "rotate-180"
                                  : ""
                              }`}
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path
                                fillRule="evenodd"
                                d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>

                        {activeMobileDropdown === item.link && (
                          <div className="pl-4 pb-3 bg-[#E9FFF3] rounded-lg mb-2">
                            {item.children.map((child) => (
                              <a
                                key={child.link}
                                href={`#${child.path}`}
                                aria-current={activeNavItem === child.path ? "location" : undefined}
                                onClick={(e) => handleScrollAdjust(e, child)}
                                className={`block py-2 text-sm cursor-pointer transition ${
                                  activeNavItem === child.path
                                    ? "text-[#F2B705] font-bold"
                                    : "text-slate-700 hover:text-[#F2B705]"
                                }`}
                              >
                                {child.link}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="mt-3 mb-2">
                    {currentUser ? (
                      <div className="flex items-center gap-2 text-xs text-[#065F2F] bg-[#E9FFF3] border border-[#C9F5DC] rounded-lg px-3 py-2">
                        <span className="h-2 w-2 rounded-full bg-[#0B7A3E] inline-block" />
                        <span className="font-semibold">Logged in:</span>
                        <span className="truncate">{displayName}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        Not logged in
                      </div>
                    )}
                  </div>

                  {currentUser && (
                    <button
                      onClick={handleLogout}
                      disabled={isSubmitting}
                      className="mt-2 w-full bg-red-500 text-white py-2 rounded text-xs font-semibold uppercase hover:bg-red-600 transition"
                      type="button"
                    >
                      Logout
                    </button>
                  )}
                </nav>
              </div>
            )}
          </div>
        </div>
      </header>

      {showSignInModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-4">
          <div
            id="cyc-signin-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cyc-signin-title"
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto"
          >
            <button
              onClick={closeAuthModals}
              aria-label="Close account dialog"
              className="absolute top-4 right-4 text-red-600 font-bold text-xl"
              type="button"
            >
              ×
            </button>

            <h2
              id="cyc-signin-title"
              className="text-3xl font-extrabold text-[#065F2F] text-center mb-2"
            >
              Sign In
            </h2>

            <p className="text-gray-500 text-center mb-6">
              Access your CYC Jenta Adamu Ward account
            </p>

            <form onSubmit={handleSignIn}>
              <label
                htmlFor="signin-email"
                className="block text-sm font-bold text-gray-700 mb-2"
              >
                Email Address
              </label>

              <input
                id="signin-email"
                type="email"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                placeholder="Enter email"
                required
              />

              <label
                htmlFor="signin-password"
                className="block text-sm font-bold text-gray-700 mb-2"
              >
                Password
              </label>

              <div className="relative mb-5">
                <input
                  id="signin-password"
                  type={showPassword ? "text" : "password"}
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg pr-12 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-xl text-gray-500"
                >
                  {showPassword ? <AiFillEyeInvisible /> : <AiFillEye />}
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#065F2F] text-white py-3 rounded-lg font-bold hover:bg-[#0B7A3E] transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Signing in…" : "Sign In"}
              </button>
            </form>

            <p className="text-center text-sm text-gray-600 mt-5">
              Don&apos;t have an account?{" "}
              <button
                onClick={openSignUp}
                className="text-[#065F2F] font-bold hover:text-[#F2B705] transition"
                type="button"
              >
                Sign Up
              </button>
            </p>
          </div>
        </div>
      )}

      {showSignUpModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-4">
          <div
            id="cyc-signup-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cyc-signup-title"
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative max-h-[95vh] overflow-y-auto"
          >
            <button
              onClick={closeAuthModals}
              aria-label="Close account dialog"
              className="absolute top-4 right-4 text-red-600 font-bold text-xl"
              type="button"
            >
              ×
            </button>

            <h2
              id="cyc-signup-title"
              className="text-3xl font-extrabold text-[#065F2F] text-center mb-2"
            >
              Sign Up
            </h2>

            <p className="text-gray-500 text-center mb-6">
              Create your CYC Jenta Adamu Ward account
            </p>

            <form onSubmit={handleSignUp}>
              <label
                htmlFor="signup-name"
                className="block text-sm font-bold text-gray-700 mb-2"
              >
                Full Name
              </label>

              <input
                id="signup-name"
                type="text"
                value={signUpName}
                onChange={(e) => setSignUpName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                placeholder="Enter full name"
                required
              />

              <label
                htmlFor="signup-phone"
                className="block text-sm font-bold text-gray-700 mb-2"
              >
                Phone Number
              </label>

              <input
                id="signup-phone"
                type="tel"
                value={signUpPhone}
                onChange={(e) => setSignUpPhone(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                placeholder="Enter phone number"
              />

              <label
                htmlFor="signup-email"
                className="block text-sm font-bold text-gray-700 mb-2"
              >
                Email Address
              </label>

              <input
                id="signup-email"
                type="email"
                value={signUpEmail}
                onChange={(e) => setSignUpEmail(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                placeholder="Enter email"
                required
              />

              <label
                htmlFor="signup-password"
                className="block text-sm font-bold text-gray-700 mb-2"
              >
                Password
              </label>

              <div className="relative mb-5">
                <input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg pr-12 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                  placeholder="Create password"
                  minLength={6}
                  autoComplete="new-password"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-xl text-gray-500"
                >
                  {showPassword ? <AiFillEyeInvisible /> : <AiFillEye />}
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#065F2F] text-white py-3 rounded-lg font-bold hover:bg-[#0B7A3E] transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Creating account…" : "Create Account"}
              </button>
            </form>

            <p className="text-center text-sm text-gray-600 mt-5">
              Already have an account?{" "}
              <button
                onClick={openSignIn}
                className="text-[#065F2F] font-bold hover:text-[#F2B705] transition"
                type="button"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
