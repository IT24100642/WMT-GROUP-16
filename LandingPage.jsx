import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import '../landing.css'

export default function LandingPage() {
    const navigate = useNavigate()
    const navRef = useRef(null)

    // Navbar scroll effect
    useEffect(() => {
        const onScroll = () => {
            if (navRef.current) {
                navRef.current.classList.toggle('scrolled', window.scrollY > 60)
            }
        }
        window.addEventListener('scroll', onScroll)
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    // Reveal on scroll
    useEffect(() => {
        const reveals = document.querySelectorAll('.reveal')
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((e, i) => {
                if (e.isIntersecting) {
                    setTimeout(() => e.target.classList.add('visible'), i * 80)
                    observer.unobserve(e.target)
                }
            })
        }, { threshold: 0.12 })
        reveals.forEach(r => observer.observe(r))
        return () => observer.disconnect()
    }, [])

    // Review modal logic
    useEffect(() => {
        // Add Review modal
        const overlay = document.getElementById('modalOverlay')
        const openBtn = document.getElementById('openModal')
        const closeBtn = document.getElementById('closeModal')
        const submitBtn = document.getElementById('submitReview')

        const openModal = () => overlay?.classList.add('open')
        const closeModal = () => overlay?.classList.remove('open')

        openBtn?.addEventListener('click', openModal)
        closeBtn?.addEventListener('click', closeModal)
        overlay?.addEventListener('click', e => { if (e.target === overlay) closeModal() })

        // Edit modal
        const editOverlay = document.getElementById('editModalOverlay')
        const closeEditBtn = document.getElementById('closeEditModal')
        const cancelEditBtn = document.getElementById('cancelEditModal')
        const saveEditBtn = document.getElementById('saveEditReview')
        let currentEditCard = null

        const closeEdit = () => { editOverlay?.classList.remove('open'); currentEditCard = null }
        closeEditBtn?.addEventListener('click', closeEdit)
        cancelEditBtn?.addEventListener('click', closeEdit)
        editOverlay?.addEventListener('click', e => { if (e.target === editOverlay) closeEdit() })

        function attachUserActions(card) {
            card.querySelector('.btn-review-action.edit')?.addEventListener('click', () => {
                currentEditCard = card
                const txt = card.querySelector('.review-text').textContent.replace(/^"|"$/g, '')
                const stars = card.querySelector('.stars').textContent.split('').filter(c => c === '★').length
                document.getElementById('editReviewText').value = txt
                const radio = document.querySelector(`input[name="editStars"][value="${stars}"]`)
                if (radio) radio.checked = true
                editOverlay?.classList.add('open')
            })
            card.querySelector('.btn-review-action.delete')?.addEventListener('click', () => {
                card.style.transition = 'opacity .3s, transform .3s'
                card.style.opacity = '0'; card.style.transform = 'scale(.95)'
                setTimeout(() => card.remove(), 300)
            })
        }

        saveEditBtn?.addEventListener('click', () => {
            if (!currentEditCard) return
            const newText = document.getElementById('editReviewText').value.trim()
            const newRating = document.querySelector('input[name="editStars"]:checked')?.value
            if (!newText) { alert('Please write your review.'); return }
            if (!newRating) { alert('Please select a star rating.'); return }
            const newStars = '★'.repeat(+newRating) + '☆'.repeat(5 - +newRating)
            currentEditCard.querySelector('.stars').textContent = newStars
            currentEditCard.querySelector('.review-text').textContent = `"${newText}"`
            currentEditCard.style.outline = '1px solid #8b6f5e'
            setTimeout(() => { currentEditCard.style.outline = 'none' }, 600)
            closeEdit()
        })

        submitBtn?.addEventListener('click', () => {
            const name = document.getElementById('firstName').value.trim()
            const text = document.getElementById('reviewText').value.trim()
            const rating = document.querySelector('input[name="stars"]:checked')?.value || 5
            if (!name || !text) { alert('Please enter your name and review.'); return }
            const stars = '★'.repeat(+rating) + '☆'.repeat(5 - +rating)
            const card = document.createElement('div')
            card.className = 'review-card reveal visible'
            card.setAttribute('data-user-review', 'true')
            card.innerHTML = `
        <div class="review-actions">
          <button class="btn-review-action edit">✎ Edit</button>
          <button class="btn-review-action delete">✕ Delete</button>
        </div>
        <div class="stars">${stars}</div>
        <p class="review-text">"${text}"</p>
        <div class="reviewer">
          <div class="reviewer-avatar">${name[0].toUpperCase()}</div>
          <div class="reviewer-info">
            <strong>${name}</strong>
            <span>Just now</span>
          </div>
        </div>`
            attachUserActions(card)
            document.getElementById('reviewsGrid')?.appendChild(card)
            overlay?.classList.remove('open')
            card.scrollIntoView({ behavior: 'smooth', block: 'center' })
            // reset
            document.getElementById('firstName').value = ''
            document.getElementById('reviewText').value = ''
            const checked = document.querySelector('input[name="stars"]:checked')
            if (checked) checked.checked = false
        })

        return () => {
            openBtn?.removeEventListener('click', openModal)
            closeBtn?.removeEventListener('click', closeModal)
        }
    }, [])

    return (
        <>
            {/* NAV */}
            <nav id="navbar" ref={navRef}>
                <span className="nav-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Maison Velour</span>
                <ul className="nav-links">
                    <li><a href="#gallery">Gallery</a></li>
                    <li><a href="#about">About</a></li>
                    <li><a href="#testimonials">Reviews</a></li>
                    <li><button type="button" className="nav-link-btn" onClick={() => navigate('/reservations')}>Reservations</button></li>
                </ul>
                <button type="button" className="nav-cta" onClick={() => navigate('/reservations')}>Reserve a Room</button>
            </nav>

            {/* HERO */}
            <section id="hero">
                <div className="hero-bg"></div>
                <div className="hero-content">
                    <span className="hero-tag">Est. 1987 · Luxury Collection</span>
                    <h1 className="hero-title">Where every stay<br />becomes a <em>story</em></h1>
                    <p className="hero-sub">Nestled in the heart of the city, Maison Velour offers an intimate escape — timeless interiors, exceptional service, and a warmth that feels like home.</p>
                    <div className="hero-btns">
                        <button type="button" className="btn-primary" onClick={() => navigate('/reservations')}>Reserve a Room</button>
                        <button type="button" className="btn-ghost" onClick={() => document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' })}>Discover More</button>
                    </div>
                </div>
                <div className="hero-scroll">
                    <div className="scroll-line"></div>
                    <span>Scroll</span>
                </div>
            </section>

            {/* GALLERY */}
            <section id="gallery">
                <div className="gallery-header reveal">
                    <div>
                        <span className="section-label">Visual Journey</span>
                        <h2 className="section-title">Crafted <em>spaces</em>,<br />curated moments</h2>
                    </div>
                    <a href="#gallery" className="view-all-link">View Full Gallery</a>
                </div>
                <div className="gallery-grid reveal">
                    <div className="gallery-item">
                        <img src="https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900&q=80" alt="Suite interior" />
                        <div className="gallery-overlay"><span>Presidential Suite</span></div>
                    </div>
                    <div className="gallery-item">
                        <img src="https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=700&q=80" alt="Lobby" />
                        <div className="gallery-overlay"><span>The Lobby</span></div>
                    </div>
                    <div className="gallery-item">
                        <img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=700&q=80" alt="Restaurant" />
                        <div className="gallery-overlay"><span>Fine Dining</span></div>
                    </div>
                    <div className="gallery-item">
                        <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=700&q=80" alt="Spa" />
                        <div className="gallery-overlay"><span>Spa &amp; Wellness</span></div>
                    </div>
                    <div className="gallery-item">
                        <img src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=700&q=80" alt="Pool" />
                        <div className="gallery-overlay"><span>Infinity Pool</span></div>
                    </div>
                </div>
            </section>

            {/* ABOUT */}
            <section id="about">
                <div className="about-img-wrap reveal">
                    <img src="https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=900&q=80" alt="Hotel exterior" />
                    <div className="about-badge">
                        <strong>36</strong>
                        <span>Years of<br />Excellence</span>
                    </div>
                </div>
                <div className="about-text reveal">
                    <span className="section-label">Our Story</span>
                    <h2 className="section-title">A legacy of <em>refined</em><br />hospitality</h2>
                    <div className="divider"></div>
                    <p>Maison Velour was founded on a simple belief: that true luxury lies not in opulence, but in the warmth of genuine care. Our team of dedicated professionals ensures that every guest is treated as a cherished friend.</p>
                    <p>From our thoughtfully designed rooms to our award-winning restaurant, every detail has been considered with intention. We blend the charm of heritage architecture with the ease of modern comfort.</p>
                    <div className="about-stats">
                        <div className="stat"><strong>120</strong><span>Rooms &amp; Suites</span></div>
                        <div className="stat"><strong>4.9</strong><span>Guest Rating</span></div>
                        <div className="stat"><strong>18k+</strong><span>Stays Hosted</span></div>
                    </div>
                </div>
            </section>

            {/* TESTIMONIALS */}
            <section id="testimonials">
                <div className="reveal">
                    <span className="section-label">Guest Voices</span>
                    <h2 className="section-title" style={{ color: 'var(--cream)' }}>Stories from <em>our guests</em></h2>
                    <div className="divider"></div>
                </div>
                <div className="testimonials-grid" id="reviewsGrid">
                    <div className="review-card reveal">
                        <div className="stars">★★★★★</div>
                        <p className="review-text">"An experience that transcended every expectation. The room was a sanctuary, the staff remembered our names by day two. We've already planned our return."</p>
                        <div className="reviewer">
                            <div className="reviewer-avatar">S</div>
                            <div className="reviewer-info"><strong>Sophie Laurent</strong><span>Paris, France</span></div>
                        </div>
                    </div>
                    <div className="review-card reveal">
                        <div className="stars">★★★★★</div>
                        <p className="review-text">"The balance of old-world elegance and quiet modernity is something rare. Breakfast on the terrace was the highlight of our entire trip."</p>
                        <div className="reviewer">
                            <div className="reviewer-avatar">J</div>
                            <div className="reviewer-info"><strong>James Whitmore</strong><span>London, UK</span></div>
                        </div>
                    </div>
                    <div className="review-card reveal">
                        <div className="stars">★★★★☆</div>
                        <p className="review-text">"Thoughtful in every detail — from the hand-pressed linen to the carefully curated minibar. It felt personal, not corporate. Exactly what we needed."</p>
                        <div className="reviewer">
                            <div className="reviewer-avatar">A</div>
                            <div className="reviewer-info"><strong>Aisha Ndiaye</strong><span>Dakar, Senegal</span></div>
                        </div>
                    </div>
                </div>
                <div className="add-review-wrap reveal">
                    <button type="button" className="btn-add-review" id="openModal">+ Share Your Experience</button>
                    <span className="add-review-note">Your review helps future guests discover the magic</span>
                </div>
            </section>

            {/* FOOTER */}
            <footer>
                <div className="footer-logo">Maison Velour</div>
                <div className="footer-links">
                    <a href="#gallery">Privacy</a>
                    <a href="#about">Terms</a>
                    <a href="#testimonials">Contact</a>
                    <a href="#about">Careers</a>
                </div>
                <div className="footer-copy">© 2026 Maison Velour. All rights reserved.</div>
            </footer>

            {/* ADD REVIEW MODAL */}
            <div className="modal-overlay" id="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
                <div className="modal">
                    <button type="button" className="modal-close" id="closeModal" aria-label="Close">×</button>
                    <h3 id="modalTitle">Share your stay</h3>
                    <p>We'd love to hear about your experience at Maison Velour</p>
                    <div className="form-row">
                        <div className="form-group"><label htmlFor="firstName">First Name</label><input type="text" placeholder="Sophie" id="firstName" /></div>
                        <div className="form-group"><label htmlFor="lastName">Last Name</label><input type="text" placeholder="Laurent" id="lastName" /></div>
                    </div>
                    <div className="form-row">
                        <div className="form-group"><label htmlFor="location">Location</label><input type="text" placeholder="Paris, France" id="location" /></div>
                        <div className="form-group">
                            <label>Rating</label>
                            <div className="star-rating" id="starRating">
                                <input type="radio" name="stars" id="s5" value="5" /><label htmlFor="s5">★</label>
                                <input type="radio" name="stars" id="s4" value="4" /><label htmlFor="s4">★</label>
                                <input type="radio" name="stars" id="s3" value="3" /><label htmlFor="s3">★</label>
                                <input type="radio" name="stars" id="s2" value="2" /><label htmlFor="s2">★</label>
                                <input type="radio" name="stars" id="s1" value="1" /><label htmlFor="s1">★</label>
                            </div>
                        </div>
                    </div>
                    <div className="form-group"><label htmlFor="reviewText">Your Review</label><textarea id="reviewText" placeholder="Tell us about your experience…"></textarea></div>
                    <button type="button" className="btn-submit" id="submitReview">Submit Review</button>
                </div>
            </div>

            {/* EDIT REVIEW MODAL */}
            <div className="edit-modal-overlay" id="editModalOverlay" role="dialog" aria-modal="true">
                <div className="edit-modal">
                    <button type="button" className="edit-modal-close" id="closeEditModal" aria-label="Close">×</button>
                    <h3>Edit your review</h3>
                    <p>Update your star rating or rewrite your experience</p>
                    <div className="form-group">
                        <label>Rating</label>
                        <div className="edit-star-rating" id="editStarRating">
                            <input type="radio" name="editStars" id="es5" value="5" /><label htmlFor="es5">★</label>
                            <input type="radio" name="editStars" id="es4" value="4" /><label htmlFor="es4">★</label>
                            <input type="radio" name="editStars" id="es3" value="3" /><label htmlFor="es3">★</label>
                            <input type="radio" name="editStars" id="es2" value="2" /><label htmlFor="es2">★</label>
                            <input type="radio" name="editStars" id="es1" value="1" /><label htmlFor="es1">★</label>
                        </div>
                    </div>
                    <div className="form-group"><label htmlFor="editReviewText">Your Review</label><textarea id="editReviewText" placeholder="Rewrite your experience…"></textarea></div>
                    <div className="edit-modal-actions">
                        <button type="button" className="btn-cancel-edit" id="cancelEditModal">Cancel</button>
                        <button type="button" className="btn-save-edit" id="saveEditReview">Save Changes</button>
                    </div>
                </div>
            </div>
        </>
    )
}
