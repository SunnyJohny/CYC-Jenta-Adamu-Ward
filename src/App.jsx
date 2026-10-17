import React from "react";
import "./App.css";

import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import AboutUs from "./components/About";
import Exco from "./components/Exco";
import News from "./components/News";
import Gallery from "./components/Gallery";
import Contact from "./components/Contact";
import Inbox from "./components/Inbox";
import Footer from "./components/Footer";
import WhatsAppIcon from "./components/watsappComponent";

function App() {
  return (
    <>
      <Navbar />

      <main>
        <Hero />

        {/* AboutUs also contains the Projects section. */}
        <AboutUs />

        <Exco />
        <News />
        <Gallery />
        <Contact />
        <Inbox />
      </main>

      <WhatsAppIcon />
      <Footer />
    </>
  );
}

export default App;