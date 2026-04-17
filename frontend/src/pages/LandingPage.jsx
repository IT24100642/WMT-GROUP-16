import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCustomerAuth } from "../context/CustomerAuthContext.jsx";
import ReviewsSection from "../components/ReviewsSection.jsx";
import "./LandingPage.css";

export default function LandingPage() {
  const navigate = useNavigate();
  const navRef = useRef(null);
  const { isAuthenticated } = useCustomerAuth();

  useEffect(() => {
    const onScroll = () => {
      if (navRef.current) {
        navRef.current.classList.toggle("scrolled", window.scrollY > 60);
      }
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const reveals = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e, i) => {
          if (e.isIntersecting) {
            setTimeout(() => e.target.classList.add("visible"), i * 80);
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    reveals.forEach((r) => observer.observe(r));
    return () => observer.disconnect();
  }, []);


  return (
    <div className="velour-landing">
      <nav id="navbar" ref={navRef}>
        <span
          className="nav-logo"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          Maison Velour
        </span>
        <ul className="nav-links">
          <li>
            <a href="#gallery">Gallery</a>
          </li>
          <li>
            <a href="#about">About</a>
          </li>
          <li>
            <a href="#testimonials">Reviews</a>
          </li>
          <li>
            <Link to="/restaurant">Restaurant</Link>
          </li>
          <li>
            {isAuthenticated ? (
              <button type="button" className="nav-link-btn" onClick={() => navigate("/account/profile")}>
                My profile
              </button>
            ) : (
              <button type="button" className="nav-link-btn" onClick={() => navigate("/account/login")}>
                Sign in
              </button>
            )}
          </li>
        </ul>
        <div className="nav-ctas">
          {isAuthenticated ? (
            <button
              type="button"
              className="nav-cta nav-cta--secondary nav-cta--profile-mobile-only"
              onClick={() => navigate("/account/profile")}
            >
              My profile
            </button>
          ) : (
            <button type="button" className="nav-cta nav-cta--secondary" onClick={() => navigate("/account/login")}>
              Guest sign in
            </button>
          )}
          <button
            type="button"
            className="nav-cta nav-cta--secondary nav-cta--restaurant-mobile-only"
            onClick={() => navigate("/restaurant")}
          >
            Restaurant
          </button>
          <button type="button" className="nav-cta" onClick={() => navigate("/reservations")}>
            Reserve a Room
          </button>
        </div>
      </nav>

      <section id="hero">
        <div className="hero-bg" aria-hidden />
        <div className="hero-content">
          <span className="hero-tag">Est. 1987 · Luxury Collection</span>
          <h1 className="hero-title">
            Where every stay
            <br />
            becomes a <em>story</em>
          </h1>
          <p className="hero-sub">
            Nestled in the heart of the city, Maison Velour offers an intimate escape — timeless interiors, exceptional
            service, and a warmth that feels like home.
          </p>
          <div className="hero-btns">
            <button type="button" className="btn-primary" onClick={() => navigate("/reservations")}>
              Reserve a Room
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" })}
            >
              Discover More
            </button>
            <button type="button" className="btn-ghost" onClick={() => navigate("/restaurant")}>
              Restaurant
            </button>
          </div>
        </div>
        <div className="hero-scroll">
          <div className="scroll-line" />
          <span>Scroll</span>
        </div>
      </section>

      <section id="restaurant" className="restaurant-section reveal" aria-labelledby="restaurant-heading">
        <div className="restaurant-section__inner">
          <span className="section-label restaurant-section__label">Velour Dining</span>
          <h2 id="restaurant-heading" className="section-title restaurant-section__title">
            The <em>Restaurant</em>
          </h2>
          <div className="divider restaurant-section__divider" />
          <p className="restaurant-section__lead">
            Seasonal tasting menus, a deep cellar, and service that lingers at just the right pace — from sunrise
            espresso to a last glass of wine after midnight.
          </p>
          <p className="restaurant-section__meta">Reservations recommended · Smart elegant attire</p>
          <div className="restaurant-section__ctas">
            <Link to="/restaurant" className="btn-primary restaurant-section__cta">
              Order food
            </Link>
            <button
              type="button"
              className="btn-ghost restaurant-section__cta restaurant-section__cta--ghost"
              onClick={() => document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" })}
            >
              See dining spaces
            </button>
          </div>
        </div>
      </section>

      <section id="gallery">
        <div className="gallery-header reveal">
          <div>
            <span className="section-label">Visual Journey</span>
            <h2 className="section-title">
              Crafted <em>spaces</em>,<br />
              curated moments
            </h2>
          </div>
          <a href="#gallery" className="view-all-link">
            View Full Gallery
          </a>
        </div>
        <div className="gallery-grid reveal">
          <div className="gallery-item">
            <img src="https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900&q=80" alt="Suite interior" />
            <div className="gallery-overlay">
              <span>Presidential Suite</span>
            </div>
          </div>
          <div className="gallery-item">
            <img src="https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=700&q=80" alt="Lobby" />
            <div className="gallery-overlay">
              <span>The Lobby</span>
            </div>
          </div>
          <div className="gallery-item">
            <img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=700&q=80" alt="Restaurant" />
            <div className="gallery-overlay">
              <span>Fine Dining</span>
            </div>
          </div>
          <div className="gallery-item">
            <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=700&q=80" alt="Spa" />
            <div className="gallery-overlay">
              <span>Spa &amp; Wellness</span>
            </div>
          </div>
          <div className="gallery-item">
            <img src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=700&q=80" alt="Pool" />
            <div className="gallery-overlay">
              <span>Infinity Pool</span>
            </div>
          </div>
        </div>
      </section>

      <section id="about">
        <div className="about-img-wrap reveal">
          <img src="https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=900&q=80" alt="Hotel exterior" />
          <div className="about-badge">
            <strong>36</strong>
            <span>
              Years of
              <br />
              Excellence
            </span>
          </div>
        </div>
        <div className="about-text reveal">
          <span className="section-label">Our Story</span>
          <h2 className="section-title">
            A legacy of <em>refined</em>
            <br />
            hospitality
          </h2>
          <div className="divider" />
          <p>
            Maison Velour was founded on a simple belief: that true luxury lies not in opulence, but in the warmth of
            genuine care. Our team of dedicated professionals ensures that every guest is treated as a cherished
            friend.
          </p>
          <p>
            From our thoughtfully designed rooms to our award-winning restaurant, every detail has been considered with
            intention. We blend the charm of heritage architecture with the ease of modern comfort.
          </p>
          <div className="about-stats">
            <div className="stat">
              <strong>120</strong>
              <span>Rooms &amp; Suites</span>
            </div>
            <div className="stat">
              <strong>4.9</strong>
              <span>Guest Rating</span>
            </div>
            <div className="stat">
              <strong>18k+</strong>
              <span>Stays Hosted</span>
            </div>
          </div>
        </div>
      </section>

      <ReviewsSection />

      <footer>
        <div className="footer-logo">Maison Velour</div>
        <div className="footer-links">
          <a href="#gallery">Privacy</a>
          <a href="#about">Terms</a>
          <a href="#testimonials">Contact</a>
          <a href="#about">Careers</a>
        </div>
        <div className="footer-copy">© {new Date().getFullYear()} Maison Velour. All rights reserved.</div>
        <div className="footer-portal">
          <Link to="/staff/login" className="footer-staff-btn">
            Staff login
          </Link>
          <Link to="/admin/login" className="footer-admin-btn">
            Admin Control
          </Link>
        </div>
      </footer>

    </div>
  );
}
