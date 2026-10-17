import { useRef, useState } from "react";
import {
  FaPhoneAlt,
  FaEnvelope,
  FaWhatsapp,
  FaFacebookF,
  FaInstagram,
  FaYoutube,
} from "react-icons/fa";
import { GoLocation } from "react-icons/go";
import { MdOutlinePublic } from "react-icons/md";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { toast } from "react-toastify";
import { db } from "../firebase";
import {
  CYC_COLLECTION,
  CYC_ID,
  useMyContext,
} from "../Context/MyContext";

const INPUT_CLASS =
  "w-full p-3 border border-[#C9F5DC] rounded-lg mb-5 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]";

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

const Contact = () => {
  const { cycProfile = {} } = useMyContext();
  const form = useRef(null);
  const sendingRef = useRef(false);
  const [sending, setSending] = useState(false);

  const phone = "07025718287";
  const whatsappUrl = `https://wa.me/2347025718287?text=${encodeURIComponent(
    "Hello CYC Jenta Adamu Ward team, I would like to make an enquiry."
  )}`;
  const email = String(cycProfile.email || "").trim();
  const website = websiteUrl(cycProfile.website);
  const location =
    cycProfile.address ||
    cycProfile.location ||
    "Jenta Adamu Ward, Jos North, Plateau State, Nigeria";

  const socialLinks = [
    { name: "Facebook", Icon: FaFacebookF, url: websiteUrl(cycProfile.facebookUrl) },
    { name: "Instagram", Icon: FaInstagram, url: websiteUrl(cycProfile.instagramUrl) },
    { name: "YouTube", Icon: FaYoutube, url: websiteUrl(cycProfile.youtubeUrl) },
  ].filter((item) => item.url);

  const sendMessageToFirestore = async (event) => {
    event.preventDefault();
    if (sendingRef.current) return;

    const submittedForm = event.currentTarget;
    const formData = new FormData(submittedForm);
    const read = (name) => String(formData.get(name) || "").trim();

    const fields = {
      fullName: read("user_name"),
      email: read("user_email"),
      phoneNumber: read("phone_number"),
      subject: read("subject"),
      message: read("message"),
    };

    if (Object.values(fields).some((value) => !value)) {
      toast.error("Please complete all the fields before sending.");
      return;
    }

    if (fields.message.length > 10000) {
      toast.error("Please keep your message within 10,000 characters.");
      return;
    }

    sendingRef.current = true;
    setSending(true);

    try {
      await addDoc(collection(db, CYC_COLLECTION, CYC_ID, "inbox"), {
        ...fields,
        status: "unread",
        source: "website-contact-form",
        createdAt: serverTimestamp(),
      });

      toast.success("Your message has been sent to the council. Thank you!");
      submittedForm.reset();
    } catch (error) {
      console.error("CYC contact message:", error);
      toast.error(
        "We couldn't send your message. Please try again or contact us on WhatsApp."
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <section id="contact" className="scroll-mt-40 py-20 bg-[#E9FFF3]">
      <div className="container mx-auto px-4 md:px-10">
        <div className="mb-12 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#F2B705] mb-3">
            Contact & Enquiries
          </p>

          <h2 className="text-4xl md:text-5xl font-extrabold text-[#065F2F] mb-5">
            Get in Touch
          </h2>

          <p className="text-gray-600 max-w-3xl mx-auto leading-relaxed text-lg">
            Have an enquiry, an idea for the community, or an interest in
            supporting our activities? Get in touch with CYC Jenta Adamu Ward
            about youth programmes, partnerships and community projects.
          </p>

          <div className="w-24 h-1 bg-[#F2B705] mx-auto mt-6 rounded-full" />
        </div>

        <div className="grid gap-8 lg:grid-cols-2 items-stretch">
          <form
            ref={form}
            onSubmit={sendMessageToFirestore}
            aria-busy={sending}
            className="min-w-0 p-6 md:p-8 border border-[#C9F5DC] bg-white shadow-xl rounded-2xl"
          >
            <h3 className="text-2xl font-extrabold text-[#065F2F] mb-6">
              Send a Message
            </h3>

            <fieldset disabled={sending}>
              <label htmlFor="contact-name" className="block text-sm font-bold mb-2 text-gray-700">
                Full Name
              </label>
              <input
                id="contact-name"
                type="text"
                name="user_name"
                autoComplete="name"
                maxLength={150}
                className={INPUT_CLASS}
                required
              />

              <label htmlFor="contact-email" className="block text-sm font-bold mb-2 text-gray-700">
                Email Address
              </label>
              <input
                id="contact-email"
                type="email"
                name="user_email"
                autoComplete="email"
                maxLength={254}
                className={INPUT_CLASS}
                required
              />

              <label htmlFor="contact-phone" className="block text-sm font-bold mb-2 text-gray-700">
                Phone Number
              </label>
              <input
                id="contact-phone"
                type="tel"
                name="phone_number"
                autoComplete="tel"
                placeholder="Example: 08012345678"
                maxLength={30}
                className={INPUT_CLASS}
                required
              />

              <label htmlFor="contact-subject" className="block text-sm font-bold mb-2 text-gray-700">
                Subject
              </label>
              <input
                id="contact-subject"
                type="text"
                name="subject"
                maxLength={200}
                className={INPUT_CLASS}
                required
              />

              <label htmlFor="contact-message" className="block text-sm font-bold mb-2 text-gray-700">
                Message
              </label>
              <textarea
                id="contact-message"
                name="message"
                rows={6}
                maxLength={10000}
                className={INPUT_CLASS}
                required
              />

              <button
                type="submit"
                disabled={sending}
                className="w-full bg-[#065F2F] text-white py-3 rounded-lg font-bold hover:bg-[#0B7A3E] transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sending ? "Sending..." : "Send Message"}
              </button>
            </fieldset>
          </form>

          <div className="min-w-0 bg-[#065F2F] text-white p-8 rounded-2xl shadow-xl">
            <h3 className="text-3xl font-extrabold mb-4">
              Contact Information
            </h3>

            <div className="space-y-6">
              <div className="flex items-start">
                <FaPhoneAlt className="shrink-0 text-[#F2B705] mr-4 mt-1" />
                <div>
                  <p className="font-bold">Phone</p>
                  <a href="tel:+2347025718287" className="text-white/80 hover:text-[#F2B705] transition">
                    {phone}
                  </a>
                </div>
              </div>

              {email && (
                <div className="flex items-start">
                  <FaEnvelope className="shrink-0 text-[#F2B705] mr-4 mt-1" />
                  <div className="min-w-0">
                    <p className="font-bold">Email</p>
                    <a href={`mailto:${email}`} className="break-words text-white/80 hover:text-[#F2B705] transition">
                      {email}
                    </a>
                  </div>
                </div>
              )}

              <div className="flex items-start">
                <GoLocation className="shrink-0 text-[#F2B705] mr-4 mt-1" />
                <div>
                  <p className="font-bold">Location</p>
                  <p className="text-white/80">{location}</p>
                </div>
              </div>

              {website && (
                <div className="flex items-start">
                  <MdOutlinePublic className="shrink-0 text-[#F2B705] mr-4 mt-1" />
                  <div className="min-w-0">
                    <p className="font-bold">Website</p>
                    <a href={website} target="_blank" rel="noopener noreferrer" className="break-words text-white/80 hover:text-[#F2B705] transition">
                      {website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  </div>
                </div>
              )}

              <div className="flex items-start">
                <FaWhatsapp className="shrink-0 text-[#F2B705] mr-4 mt-1" />
                <div>
                  <p className="font-bold">WhatsApp</p>
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-[#F2B705] transition">
                    Chat with the Council
                  </a>
                </div>
              </div>
            </div>

            {socialLinks.length > 0 && (
              <div className="mt-10 pt-6 border-t border-white/20">
                <p className="font-bold mb-4">Follow Us</p>
                <div className="flex gap-4">
                  {socialLinks.map(({ name, Icon, url }) => (
                    <a key={name} href={url} target="_blank" rel="noopener noreferrer" aria-label={`CYC on ${name}`} className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full hover:bg-[#F2B705] hover:text-[#065F2F] transition">
                      <Icon />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
