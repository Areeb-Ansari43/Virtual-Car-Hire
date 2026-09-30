/**
 * Virtual Car Hire - Smart Hover Link Preview System
 * Provides floating preview cards for internal links on desktop while keeping
 * normal anchor crawlability for SEO and normal tap behavior on mobile/touch devices.
 */

(function () {
  'use strict';

  // Preview Metadata Database
  const LINK_PREVIEWS = {
    '/': {
      title: 'Virtual Car Hire — Home',
      description: 'London\'s premier PCO car rental specialist providing TfL-licensed hybrid and electric vehicles with insurance and servicing included.',
      image: '/assets/social/virtual-car-hire-preview-v2.jpg?v=2',
      badge: 'PCO Specialist',
      cta: 'Explore Home'
    },
    '/our-fleet': {
      title: 'Our PCO Fleet',
      description: 'Browse our full range of TfL-approved hybrid, executive, EV, and 7–8 seater PCO vehicles ready for immediate hire.',
      image: '/assets/social/virtual-car-hire-preview-v2.jpg?v=2',
      badge: '100+ Vehicles',
      cta: 'View Fleet'
    },
    '/how-it-works': {
      title: 'How PCO Hire Works',
      description: 'Simple 4-step rental process: choose your vehicle, upload documents, sign online, and collect your PCO car same-day.',
      image: '/assets/social/virtual-car-hire-preview-v2.jpg?v=2',
      badge: '4 Simple Steps',
      cta: 'See Process'
    },
    '/support': {
      title: 'Driver Support & Maintenance',
      description: 'Comprehensive driver assistance including scheduled servicing, MOT, tyre replacement, and roadside emergency support.',
      image: '/assets/social/virtual-car-hire-preview-v2.jpg?v=2',
      badge: 'Inclusive Care',
      cta: 'Get Support'
    },
    '/areas-we-cover': {
      title: 'Areas We Cover',
      description: 'Serving PCO drivers across Greater London, Hounslow, West London, Heathrow, Luton, and surrounding Home Counties.',
      image: '/assets/social/virtual-car-hire-preview-v2.jpg?v=2',
      badge: 'London & Luton',
      cta: 'View Coverage'
    },
    '/about-us': {
      title: 'About Virtual Car Hire',
      description: 'Established in 2014, Virtual Car Hire (FA-IBI LTD) has supported over 5,000 PCO drivers across London and Luton.',
      image: '/assets/social/virtual-car-hire-preview-v2.jpg?v=2',
      badge: '10+ Years Trust',
      cta: 'Our Story'
    },
    '/contact-us': {
      title: 'Contact Virtual Car Hire',
      description: 'Get in touch with our West London team for vehicle availability, PCO onboarding, or general driver enquiries.',
      image: '/assets/social/virtual-car-hire-preview-v2.jpg?v=2',
      badge: 'West London HQ',
      cta: 'Contact Us'
    },
    '/pco-car-hire-luton': {
      title: 'Luton PCO Car Hire',
      description: 'Dedicated PCO vehicle hire serving Luton, Bedfordshire, and London Luton Airport drivers with full TfL compliance.',
      image: '/assets/social/virtual-car-hire-preview-v2.jpg?v=2',
      badge: 'Luton Service',
      cta: 'Explore Luton Hire'
    },

    // Vehicle Pages
    '/cars/tesla-model-3': {
      title: 'Tesla Model 3 — PCO Hire',
      description: 'Fully electric saloon with long range and zero emissions. Ideal for Uber Green, Bolt, and Executive rides in London.',
      image: 'https://media.base44.com/images/public/6a1f346b7b17a237b494bdf9/f8bc04bf7_generated_7408a636.png',
      badge: 'Full Electric · £260/wk',
      cta: 'View Tesla Specs'
    },
    '/cars/mercedes-eqe': {
      title: 'Mercedes EQE — PCO Hire',
      description: 'Luxury executive full electric saloon. Perfect for Uber Exec, Lux, and high-earning private hire contracts.',
      image: '/assets/cars/mercedes-eqe-black.png',
      badge: 'Electric Exec · £440/wk',
      cta: 'View EQE Specs'
    },
    '/cars/mercedes-eqs': {
      title: 'Mercedes EQS — PCO Hire',
      description: 'Flagship electric luxury saloon delivering maximum passenger comfort, unmatched range, and premium status.',
      image: '/assets/cars/mercedes-eqs-black.png',
      badge: 'Flagship EV · £500/wk',
      cta: 'View EQS Specs'
    },
    '/cars/mercedes-e300': {
      title: 'Mercedes E300 — PCO Hire',
      description: 'Plug-in hybrid executive saloon combining impressive fuel efficiency with premium Mercedes-Benz luxury.',
      image: '/assets/cars/mercedes-e300-grey.png',
      badge: 'Plug-In Hybrid · £280/wk',
      cta: 'View E300 Specs'
    },
    '/cars/mercedes-e220': {
      title: 'Mercedes E220 — PCO Hire',
      description: 'Refined executive diesel saloon engineered for long-distance comfort, efficiency, and reliability on Uber Exec.',
      image: '/assets/cars/mercedes-e220-silver.png',
      badge: 'Executive Diesel · £270/wk',
      cta: 'View E220 Specs'
    },
    '/cars/mercedes-v-class': {
      title: 'Mercedes V-Class — PCO Hire',
      description: 'Ultra-luxury 7-seat MPV designed for high-end airport transfers, VIP chauffeur work, and Uber XL/Exec.',
      image: '/assets/cars/mercedes-v-class-black.png',
      badge: '7-Seat Luxury · £450/wk',
      cta: 'View V-Class Specs'
    },
    '/cars/mercedes-vito': {
      title: 'Mercedes Vito Tourer — PCO Hire',
      description: 'Spacious 8-seater private hire van with huge luggage space for group transfers and London airport runs.',
      image: '/assets/cars/mercedes-vito-grey.webp',
      badge: '8-Seat MPV · £370/wk',
      cta: 'View Vito Specs'
    },
    '/cars/toyota-corolla-estate': {
      title: 'Toyota Corolla Estate — PCO Hire',
      description: 'The ultimate workhorse for London PCO drivers. Ultra-reliable hybrid technology with huge estate boot space.',
      image: 'https://media.base44.com/images/public/6a1f346b7b17a237b494bdf9/07c38dfd7_generated_59d7c3d3.png',
      badge: 'Popular Hybrid · £210/wk',
      cta: 'View Corolla Specs'
    },
    '/cars/toyota-auris-estate': {
      title: 'Toyota Auris Estate — PCO Hire',
      description: 'Proven hybrid performance and excellent economy. A budget-friendly, high-capacity PCO rental choice.',
      image: '/assets/cars/toyota-auris-estate.webp',
      badge: 'Hybrid Estate · £210/wk',
      cta: 'View Auris Specs'
    },
    '/cars/toyota-prius': {
      title: 'Toyota Prius — PCO Hire',
      description: 'London\'s legendary PCO hybrid. Exceptional fuel efficiency and seamless city maneuverability.',
      image: '/assets/cars/toyota-prius.webp',
      badge: 'Classic Hybrid · £200/wk',
      cta: 'View Prius Specs'
    },
    '/cars/jaguar-i-pace': {
      title: 'Jaguar I-Pace — PCO Hire',
      description: 'All-electric performance SUV with premium all-wheel drive, spacious cabin, and luxury driver features.',
      image: '/assets/cars/jaguar-i-pace-grey.png',
      badge: 'Electric SUV · £270/wk',
      cta: 'View I-Pace Specs'
    },
    '/cars/hyundai-ioniq': {
      title: 'Hyundai IONIQ — PCO Hire',
      description: 'Economical plug-in hybrid hatchback with low running costs, ideal for Uber Comfort and everyday city driving.',
      image: '/assets/cars/hyundai-ioniq-v2.jpg',
      badge: 'Plug-In Hybrid · £210/wk',
      cta: 'View IONIQ Specs'
    },
    '/cars/hyundai-santa-fe': {
      title: 'Hyundai Santa Fe — PCO Hire',
      description: 'Commanding 7-seater hybrid SUV offering luxury seating, high visibility, and versatile luggage capability.',
      image: '/assets/cars/hyundai-santa-fe.webp',
      badge: '7-Seat Hybrid SUV · £330/wk',
      cta: 'View Santa Fe Specs'
    },
    '/cars/mg5-ev': {
      title: 'MG5 EV Estate — PCO Hire',
      description: 'Affordable, fully electric estate car with zero emissions, generous boot space, and low weekly rental rates.',
      image: '/assets/cars/mg5-ev.webp',
      badge: 'Full Electric Estate · £200/wk',
      cta: 'View MG5 Specs'
    },
    '/cars/mg-s9-phev-suv': {
      title: 'MG S9 PHEV SUV — PCO Hire',
      description: 'Modern luxury plug-in hybrid SUV featuring high tech, quiet electric mode, and spacious 5-seater comfort.',
      image: '/assets/cars/mg-s9-phev-suv.webp',
      badge: 'Plug-In Hybrid SUV · £280/wk',
      cta: 'View MG S9 Specs'
    },
    '/cars/ford-tourneo-custom': {
      title: 'Ford Tourneo Custom — PCO Hire',
      description: 'Full electric 8-seater MPV built for large family airport bookings and high-capacity London private hire.',
      image: '/assets/cars/ford-tourneo-custom.webp',
      badge: 'Electric 8-Seater · £410/wk',
      cta: 'View Tourneo Specs'
    }
  };

  // Normalize URL paths to match metadata keys
  function normalizePath(href) {
    if (!href) return '';
    try {
      const url = new URL(href, window.location.origin);
      let path = url.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
      if (path.length > 1 && path.endsWith('/')) {
        path = path.slice(0, -1);
      }
      return path;
    } catch (e) {
      return '';
    }
  }

  // Create Card Element once
  let previewCardEl = null;
  let activeLinkEl = null;
  let hideTimer = null;
  let showTimer = null;

  function createPreviewCard() {
    if (previewCardEl) return;

    previewCardEl = document.createElement('div');
    previewCardEl.className = 'vch-link-preview-card';
    previewCardEl.setAttribute('role', 'tooltip');
    previewCardEl.setAttribute('aria-hidden', 'true');

    previewCardEl.innerHTML = `
      <div class="vch-preview-inner">
        <div class="vch-preview-media">
          <img class="vch-preview-img" src="" alt="" loading="lazy">
          <span class="vch-preview-badge"></span>
        </div>
        <div class="vch-preview-content">
          <h4 class="vch-preview-title"></h4>
          <p class="vch-preview-desc"></p>
          <div class="vch-preview-cta"><span class="vch-cta-text"></span> <i class="fa-solid fa-arrow-right"></i></div>
        </div>
      </div>
    `;

    document.body.appendChild(previewCardEl);

    // Keep card visible when mouse moves over the card itself
    previewCardEl.addEventListener('mouseenter', () => {
      clearTimeout(hideTimer);
    });

    previewCardEl.addEventListener('mouseleave', () => {
      scheduleHide();
    });

    // Make clicking anywhere on the card navigate to the link URL
    previewCardEl.addEventListener('click', (e) => {
      if (activeLinkEl && activeLinkEl.href) {
        window.location.href = activeLinkEl.href;
      }
    });
  }

  function positionCard(linkEl) {
    if (!previewCardEl || !linkEl) return;

    const rect = linkEl.getBoundingClientRect();
    const cardWidth = 300;
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    let left = rect.left + scrollX + (rect.width / 2) - (cardWidth / 2);
    let top = rect.bottom + scrollY + 8;

    // Boundary check for horizontal viewport
    const viewportWidth = window.innerWidth;
    if (left + cardWidth > viewportWidth - 16) {
      left = viewportWidth - cardWidth - 16;
    }
    if (left < 16) {
      left = 16;
    }

    // Place above if card overflows screen bottom
    const cardHeight = 260; // Estimated height
    if (rect.bottom + cardHeight + 16 > window.innerHeight && rect.top - cardHeight > 0) {
      top = rect.top + scrollY - cardHeight - 8;
    }

    previewCardEl.style.left = `${left}px`;
    previewCardEl.style.top = `${top}px`;
  }

  function showPreview(linkEl, data) {
    clearTimeout(hideTimer);
    clearTimeout(showTimer);

    showTimer = setTimeout(() => {
      createPreviewCard();
      activeLinkEl = linkEl;

      const img = previewCardEl.querySelector('.vch-preview-img');
      const badge = previewCardEl.querySelector('.vch-preview-badge');
      const title = previewCardEl.querySelector('.vch-preview-title');
      const desc = previewCardEl.querySelector('.vch-preview-desc');
      const cta = previewCardEl.querySelector('.vch-cta-text');

      img.src = data.image;
      img.alt = data.title;
      badge.textContent = data.badge || 'Virtual Car Hire';
      title.textContent = data.title;
      desc.textContent = data.description;
      cta.textContent = data.cta || 'View Details';

      positionCard(linkEl);
      previewCardEl.classList.add('vch-preview-visible');
      previewCardEl.setAttribute('aria-hidden', 'false');
    }, 120); // Subtle 120ms delay before triggering
  }

  function scheduleHide() {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (previewCardEl) {
        previewCardEl.classList.remove('vch-preview-visible');
        previewCardEl.setAttribute('aria-hidden', 'true');
      }
      activeLinkEl = null;
    }, 200); // 200ms grace period to move cursor onto the card
  }

  function attachLinkPreviews() {
    // Only activate on devices with fine pointer (mouse/trackpad), skip touch-only devices
    if (window.matchMedia('(pointer: coarse)').matches) {
      return;
    }

    const links = document.querySelectorAll('a[href]');

    links.forEach((link) => {
      const path = normalizePath(link.getAttribute('href'));
      const previewData = LINK_PREVIEWS[path];

      if (previewData) {
        link.classList.add('vch-preview-link');

        link.addEventListener('mouseenter', () => {
          showPreview(link, previewData);
        });

        link.addEventListener('mouseleave', () => {
          scheduleHide();
        });

        link.addEventListener('focus', () => {
          showPreview(link, previewData);
        });

        link.addEventListener('blur', () => {
          scheduleHide();
        });
      }
    });
  }

  // Hide popup on Esc key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      scheduleHide();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachLinkPreviews);
  } else {
    attachLinkPreviews();
  }
})();
