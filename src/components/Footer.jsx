import React from "react";
import {
  FaYoutube,
  FaWhatsapp,
  FaFacebook,
  FaInstagram,
  FaTiktok,
} from "react-icons/fa";
import { useMyContext } from "../Context/MyContext";

const quickLinks = [
  { link: "Home", path: "home" },
  { link: "About the Council", path: "about" },
  { link: "Our Executives", path: "exco" },
  { link: "Projects & Activities", path: "projects" },
  { link: "News", path: "news" },
  { link: "Gallery", path: "gallery" },
  { link: "Contact", path: "contact" },
];

const websiteUrl = (value) => {
  if (typeof value !== "string" || !value.trim() || value.trim() === "#") {
    return "";
  }

  try {
    const text = value.trim();
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return ["http:", "https:"].includes(url.protocol) && url.hostname.includes(".")
      ? url.href
      : "";
  } catch {
    return "";
  }
};

const handleScrollAdjust = (event, path) => {
  if (
    event.defaultPrevented || event.metaKey || event.ctrlKey ||
    event.shiftKey || event.altKey || event.button !== 0
  ) {
    return;
  }

  const target = Array.from(document.querySelectorAll(`[id="${path}"]`))
    .filter((element) => element.getClientRects().length > 0)
    .sort((a, b) => a.contains(b) ? 1 : b.contains(a) ? -1 : 0)[0];

  if (!target) return;
  event.preventDefault();

  let scroller = target.parentElement;
  while (scroller && scroller !== document.body && scroller !== document.documentElement) {
    if (
      /(auto|scroll|overlay)/.test(window.getComputedStyle(scroller).overflowY) &&
      scroller.scrollHeight > scroller.clientHeight + 1
    ) {
      break;
    }
    scroller = scroller.parentElement;
  }
  if (!scroller || scroller === document.body || scroller === document.documentElement) {
    scroller = window;
  }

  const headerBottom = Math.max(
    0,
    document.querySelector("header")?.getBoundingClientRect().bottom || 0
  );
  const containerTop = scroller === window
    ? 0
    : scroller.getBoundingClientRect().top + scroller.clientTop;
  const scrollTop = scroller === window ? window.scrollY : scroller.scrollTop;
  const top = path === "home" ? 0 : Math.max(
    0,
    target.getBoundingClientRect().top - containerTop + scrollTop -
      Math.max(0, headerBottom - containerTop) - 12
  );

  scroller.scrollTo({
    top,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });

  const url = new URL(window.location.href);
  url.hash = path;
  if (path !== "gallery") url.searchParams.delete("gallery");
  if (url.href !== window.location.href) {
    window.history.pushState(window.history.state, "", url);
  }

  const hadTabIndex = target.hasAttribute("tabindex");
  if (!hadTabIndex) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  if (!hadTabIndex) {
    target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
  }
};

const Footer = () => {
  const { cycProfile = {} } = useMyContext();
  const email = String(cycProfile.email || "").trim();
  const website = websiteUrl(cycProfile.website);
  const location =
    cycProfile.address ||
    cycProfile.location ||
    "Jenta Adamu Ward, Jos North, Plateau State, Nigeria";
  const whatsappUrl = `https://wa.me/2347025718287?text=${encodeURIComponent(
    "Hello CYC Jenta Adamu Ward team, I would like to make an enquiry."
  )}`;

  const socialMediaLinks = [
    { name: "WhatsApp", Icon: FaWhatsapp, url: whatsappUrl },
    { name: "Facebook", Icon: FaFacebook, url: websiteUrl(cycProfile.facebookUrl) },
    { name: "Instagram", Icon: FaInstagram, url: websiteUrl(cycProfile.instagramUrl) },
    { name: "YouTube", Icon: FaYoutube, url: websiteUrl(cycProfile.youtubeUrl) },
    { name: "TikTok", Icon: FaTiktok, url: websiteUrl(cycProfile.tiktokUrl) },
  ].filter((item) => item.url);

  return (
    <footer className="bg-[#065F2F] text-white pt-14 pb-6 px-4">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-2">
            <a href="#home" onClick={(event) => handleScrollAdjust(event, "home")} className="flex items-center gap-3 mb-5">
              <img src="/images/cyclogo.png" alt="Plateau State Youth Council emblem" className="h-14 w-14 shrink-0 object-contain" />
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold uppercase">
                  Central Youth Council
                </h2>
                <p className="text-sm font-semibold text-white/80">
                  Jenta Adamu Ward · Jos North
                </p>
                <p className="text-[#F2B705] text-sm italic font-semibold mt-1">
                  {cycProfile.slogan || "Build the Youth, Build the Nation"}
                </p>
              </div>
            </a>

            <p className="text-white/80 leading-relaxed mb-5 max-w-xl">
              Bringing young people together through unity, learning, leadership
              and service for the development of Jenta Adamu Ward.
            </p>

            <div className="space-y-2 text-white/80 break-words">
              <p>
                Phone: <a href="tel:+2347025718287" className="hover:text-[#F2B705] transition">07025718287</a>
              </p>
              {email && <p>Email: <a href={`mailto:${email}`} className="hover:text-[#F2B705] transition">{email}</a></p>}
              <p>Location: {location}</p>
              {website && (
                <p>
                  Website: <a href={website} target="_blank" rel="noopener noreferrer" className="hover:text-[#F2B705] transition">
                    {website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                </p>
              )}
            </div>
          </div>

          <nav aria-label="Footer navigation">
            <h2 className="text-xl font-bold mb-4 text-[#F2B705]">
              Quick Links
            </h2>
            <ul className="space-y-2">
              {quickLinks.map(({ link, path }) => (
                <li key={path}>
                  <a href={`#${path}`} onClick={(event) => handleScrollAdjust(event, path)} className="text-white/75 hover:text-[#F2B705] transition">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-xl font-bold mb-4 text-[#F2B705]">
              Connect with Us
            </h2>
            <p className="text-white/75 leading-relaxed mb-5">
              Ask about our activities, share your ideas or get involved in
              building a stronger community.
            </p>
            <div className="flex flex-wrap gap-3">
              {socialMediaLinks.map(({ name, Icon, url }) => (
                <a key={name} href={url} target="_blank" rel="noopener noreferrer" aria-label={`CYC on ${name}`} title={name} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#F2B705] hover:text-[#065F2F] transition text-xl">
                  <Icon />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-[#C9F5DC]/40 pt-5 text-center">
          <p className="text-sm text-white/80">
            &copy; {new Date().getFullYear()} Central Youth Council, Jenta Adamu Ward.
            All rights reserved.
          </p>
          <p className="text-xs italic text-white/60 mt-2">
            Website developed by Jay Cloud Digital.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
