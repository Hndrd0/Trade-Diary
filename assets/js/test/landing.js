/* landing.js – Green Journal landing page (Redesign 2025) */

// ── DARK MODE TOGGLE ──────────────────────────────────────────────────────────
// The redesign is always-dark, but we keep the toggle wired for the checkbox
// so existing PHP/cookie logic is undisturbed.
const toggle = document.getElementById("toggle");
if (toggle) {
  // Always ensure dark class is present (dark-only design)
  document.documentElement.classList.add("dark");
  toggle.checked = true;

  toggle.addEventListener("change", function () {
    // Keep dark always on; toggle is cosmetic / future use
    document.documentElement.classList.add("dark");
    localStorage.setItem("darkMode", "true");
  });
}

// ── MOBILE MENU ───────────────────────────────────────────────────────────────
const mobileMenuButton = document.getElementById("mobile-menu-button");
const mobileMenu = document.getElementById("mobile-menu");
if (mobileMenuButton && mobileMenu) {
  mobileMenuButton.addEventListener("click", function () {
    const hidden =
      mobileMenu.style.display === "none" || mobileMenu.style.display === "";
    mobileMenu.style.display = hidden ? "block" : "none";
  });
}

// ── FAQ ACCORDION ─────────────────────────────────────────────────────────────
document.querySelectorAll(".faq-q").forEach((btn) => {
  btn.addEventListener("click", () => {
    const item = btn.closest(".faq-item");
    const isOpen = item.classList.contains("open");
    document
      .querySelectorAll(".faq-item")
      .forEach((i) => i.classList.remove("open"));
    if (!isOpen) item.classList.add("open");
  });
});

// Legacy class-based FAQ (keep for backward compat if pages still use .faq-toggle)
document.querySelectorAll(".faq-toggle").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const faqItem = toggle.closest(".bg-white, .bg-dark-800, .faq-item");
    if (!faqItem) return;
    const answer = faqItem.querySelector(".faq-answer, .faq-a");
    if (!answer) return;
    answer.classList.toggle("active");
    toggle.classList.toggle("active");
    document.querySelectorAll(".faq-answer, .faq-a").forEach((other) => {
      if (other !== answer && other.classList.contains("active")) {
        other.classList.remove("active");
        const otherToggle = other.closest(".faq-item, .bg-white, .bg-dark-800");
        if (otherToggle) {
          const t = otherToggle.querySelector(".faq-toggle");
          if (t) t.classList.remove("active");
        }
      }
    });
  });
});

// ── SMOOTH SCROLL ─────────────────────────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    const targetId = this.getAttribute("href");
    if (targetId === "#") return;
    const targetEl = document.querySelector(targetId);
    if (targetEl) {
      e.preventDefault();
      targetEl.scrollIntoView({ behavior: "smooth" });
      if (mobileMenu) mobileMenu.style.display = "none";
    }
  });
});

// ── INTERSECTION OBSERVER – fade in cards ────────────────────────────────────
const fadeObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.style.opacity = "1";
        e.target.style.transform = "translateY(0)";
      }
    });
  },
  { threshold: 0.1 },
);

document
  .querySelectorAll(
    ".feature-card, .testi-card, .price-card, .step, .stat-item",
  )
  .forEach((el) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(24px)";
    el.style.transition = "opacity 0.5s ease, transform 0.5s ease";
    fadeObserver.observe(el);
  });

// ── PAYMENT ───────────────────────────────────────────────────────────────────
// Fireworks
const fireworksLayer = document.getElementById("td-fireworks");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const fireworkColors = ["#fbbf24", "#fb7185", "#818cf8", "#34d399", "#38bdf8"];

function launchFirework(x = null, y = null) {
  if (!fireworksLayer || reduceMotion.matches) return;

  const burst = document.createElement("span");
  burst.className = "td-firework";
  burst.style.setProperty(
    "--x",
    x === null ? `${18 + Math.random() * 64}%` : `${x}%`,
  );
  burst.style.setProperty(
    "--y",
    y === null ? `${14 + Math.random() * 42}%` : `${y}%`,
  );
  burst.style.setProperty(
    "--firework-color",
    fireworkColors[Math.floor(Math.random() * fireworkColors.length)],
  );

  fireworksLayer.appendChild(burst);
  setTimeout(() => burst.remove(), 1000);
}

if (fireworksLayer && !reduceMotion.matches) {
  launchFirework(78, 22);
  setTimeout(() => launchFirework(28, 30), 450);

  setInterval(() => {
    if (!document.hidden) launchFirework();
  }, 2400);

  const anniversaryPlan = document.getElementById("anniversary-plan");
  if (anniversaryPlan) {
    const anniversaryObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        launchFirework(50, 18);
        setTimeout(() => launchFirework(68, 26), 240);
        setTimeout(() => launchFirework(35, 24), 480);
        anniversaryObserver.disconnect();
      },
      { threshold: 0.45 },
    );
    anniversaryObserver.observe(anniversaryPlan);
  }
}

function makePayment(postUrl, period, btnId, email = null) {
  const isLoggedIn = document.cookie.includes("user_session");
  if (!isLoggedIn && !email && typeof isReferred !== "undefined" && isReferred) {
    const modal = document.getElementById("email-modal");
    const proceedBtn = document.getElementById("proceed-to-pay-btn");

    if (modal && proceedBtn) {
      modal.classList.add("active");
      document.body.style.overflow = "hidden";

      proceedBtn.onclick = function () {
        const emailInput = document.getElementById("checkout-email");
        const errorMsg = document.getElementById("email-error");
        const userEmail = emailInput ? emailInput.value.trim() : "";

        if (!userEmail || !/^\S+@\S+\.\S+$/.test(userEmail)) {
          if (errorMsg) errorMsg.style.display = "block";
          return;
        }

        if (errorMsg) errorMsg.style.display = "none";
        closeEmailModal();
        makePayment(postUrl, period, btnId, userEmail);
      };
      return;
    }
  }

  if (btnId) $(btnId).attr("disabled", true);
  let amount = period === "monthly" ? 29900 : 99900;

  if (btnId) $(btnId).attr("disabled", false);
  startPayment(null, amount, period, email);
}

function closeEmailModal() {
  const modal = document.getElementById("email-modal");
  if (!modal) return;
  modal.classList.remove("active");
  document.body.style.overflow = "";
}

function startPayment(order_id, amount, period, email = null) {
  let failedHandled = false;
  var options = {
    key: "rzp_live_T596ejLr7FUmu1",
    amount: amount,
    currency: "INR",
    name: "Green Journal",
    description: "Subscription",
    image: base_url + "assets/images/green_journal_logo_simple.jpg",
    prefill: {
      email: email,
    },
    theme: { color: "#4f46e5" },
    handler: function (sres) {
      if (typeof fbq !== "undefined") {
        fbq("track", "Purchase", { value: amount / 100, currency: "INR" });
      }
      saveTransaction("success", sres, amount, period);
    },
  };
  if (order_id) {
    options.order_id = order_id;
  }
  var rzp = new Razorpay(options);
  rzp.open();

  rzp.on("payment.failed", function (res) {
    if (failedHandled) return;
    failedHandled = true;
    saveTransaction(
      "failed",
      {
        razorpay_payment_id: res.error.metadata.payment_id,
        razorpay_order_id: res.error.metadata.order_id,
        error_description: res.error.description,
      },
      amount,
      period,
    );
  });
}
