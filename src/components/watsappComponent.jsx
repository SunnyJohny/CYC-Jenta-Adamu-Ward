import React from "react";
import { FaWhatsapp } from "react-icons/fa";

const WHATSAPP_NUMBER = "2347025718287";
const WHATSAPP_MESSAGE =
  "Hello CYC Jenta Adamu Ward team, I would like to make an enquiry.";

const WhatsAppIcon = ({ messageCount = 1 }) => {
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    WHATSAPP_MESSAGE
  )}`;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="relative">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#087A3D] text-white w-14 h-14 flex items-center justify-center rounded-full shadow-xl hover:bg-[#12A85C] transition-transform transform hover:scale-105"
          aria-label="Chat with CYC Jenta Adamu Ward on WhatsApp"
        >
          <FaWhatsapp className="text-2xl" />
        </a>

        {/* Notification Badge */}
        {messageCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#F2B705] text-[#087A3D] text-xs font-extrabold h-5 w-5 rounded-full flex items-center justify-center shadow-md">
            {messageCount}
          </span>
        )}
      </div>
    </div>
  );
};

export default WhatsAppIcon;