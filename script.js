const form = document.querySelector("#bookingForm");
const setup = document.querySelector("#setup");
const hours = document.querySelector("#hours");
const players = document.querySelector("#players");
const total = document.querySelector("#total");
const dateInput = document.querySelector("#date");
const timeInput = document.querySelector("#time");
const bookingList = document.querySelector("#bookingList");
const toast = document.querySelector("#toast");

const storageKey = "hotbox-bookings";
let firestore = null;
let firebaseReady = false;
let firebaseCollectionName = "bookings";

async function setupFirebase() {
  try {
    const { firebaseConfig, firebaseCollection } = await import("./firebase-config.js");

    const hasConfig = Object.values(firebaseConfig).every(Boolean);

    if (!hasConfig) {
      return;
    }

    const [firebaseApp, firestoreModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js")
    ]);

    const app = firebaseApp.initializeApp(firebaseConfig);
    firestore = {
      db: firestoreModule.getFirestore(app),
      addDoc: firestoreModule.addDoc,
      collection: firestoreModule.collection,
      serverTimestamp: firestoreModule.serverTimestamp
    };
    firebaseCollectionName = firebaseCollection || firebaseCollectionName;
    firebaseReady = true;
  } catch (error) {
    console.warn("Firebase fallback loop online.", error);
  }
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

function readBookings() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function writeBookings(bookings) {
  localStorage.setItem(storageKey, JSON.stringify(bookings));
}

function calculateTotalAmount() {
  const hoursInput = document.querySelector("#hours");
  const playersInput = document.querySelector("#players");
  const setupInput = document.querySelector("#setup");

  let h = parseInt(hoursInput ? hoursInput.value : 1, 10);
  let p = parseInt(playersInput ? playersInput.value : 1, 10);
  const currentSetup = setupInput ? setupInput.value : "Performance PC";

  if (isNaN(h) || h < 1) h = 1;
  if (isNaN(p) || p < 1) p = 1;

  let rate = 0;

  if (currentSetup === "Performance PC") {
    rate = 120;
    return h * p * rate;
  } else if (currentSetup === "PS5 Bay") {
    rate = (p === 1) ? 100 : 180;
    return h * rate;
  } else if (currentSetup === "Squad Block") {
    rate = 400;
    return h * rate;
  }

  return 0;
}

function updateTotalDisplay() {
  if (total) {
    total.textContent = `Rs ${calculateTotalAmount().toLocaleString("en-IN")}`;
  }
}

function updatePlayerLimit() {
  if (!setup || !players) return;
  const selected = setup.value;
  const currentVal = parseInt(players.value, 10) || 1;

  if (selected === "Performance PC") {
    players.min = 1;
    players.max = 10;
  } else if (selected === "PS5 Bay") {
    players.min = 1;
    players.max = 2;
    if (currentVal > 2) players.value = 2;
  } else if (selected === "Squad Block") {
    players.min = 4;
    players.max = 5;
    if (currentVal < 4) players.value = 4;
    if (currentVal > 5) players.value = 5;
  }
  updateTotalDisplay();
}

function setDefaultSlot() {
  if (!dateInput || !timeInput) return;
  const now = new Date();
  now.setMinutes(now.getMinutes() + 15);
  
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  dateInput.min = `${yyyy}-${mm}-${dd}`;
  dateInput.value = `${yyyy}-${mm}-${dd}`;

  const hh = String(now.getHours()).padStart(2, "0");
  timeInput.value = `${hh}:00`;
}

function collectBooking() {
  const hoursInput = document.querySelector("#hours");
  const playersInput = document.querySelector("#players");

  let parsedHours = parseInt(hoursInput ? hoursInput.value : 1, 10);
  let parsedPlayers = parseInt(playersInput ? playersInput.value : 1, 10);

  if (isNaN(parsedHours) || parsedHours < 1) parsedHours = 1;
  if (isNaN(parsedPlayers) || parsedPlayers < 1) parsedPlayers = 1;

  const calculatedEstimate = calculateTotalAmount();

  return {
    code: Math.random().toString(36).substring(2, 10).toUpperCase(),
    name: document.querySelector("#name") ? document.querySelector("#name").value.trim() : "",
    phone: document.querySelector("#phone") ? document.querySelector("#phone").value.trim() : "",
    setup: setup ? setup.value : "Performance PC",
    game: (document.querySelector("#game") && document.querySelector("#game").value.trim()) || "Any Game",
    date: dateInput ? dateInput.value : "",
    time: timeInput ? timeInput.value : "",
    hours: parsedHours,
    players: parsedPlayers,
    notes: document.querySelector("#notes") ? document.querySelector("#notes").value.trim() : "",
    estimate: Number(calculatedEstimate) || 0,
    synced: false,
    createdAt: new Date().toISOString(),
    firebaseCreatedAt: null
  };
}

async function saveBookingOnline(booking) {
  if (!firebaseReady || !firestore) return false;
  try {
    const payload = { ...booking };
    delete payload.synced;
    payload.firebaseCreatedAt = firestore.serverTimestamp();

    await firestore.addDoc(firestore.collection(firestore.db, firebaseCollectionName), payload);
    return true;
  } catch (error) {
    console.error("Cloud entry configuration error", error);
    return false;
  }
}

function renderBookings() {
  if (!bookingList) return;
  const bookings = readBookings();

  if (bookings.length === 0) {
    bookingList.innerHTML = `<p class="empty-notice">No recent configurations stored on this terminal.</p>`;
    return;
  }

  bookingList.innerHTML = bookings
    .map(
      (b) => `
    <div class="booking-card">
      <div class="card-meta">
        <span class="card-code">${b.code}</span>
        <span class="card-status ${b.synced ? "status-cloud" : "status-local"}">
          ${b.synced ? "Cloud Sync" : "Local Record"}
        </span>
      </div>
      <div class="card-details">
        <h3>${b.setup} &ndash; ${b.game || "Any Available Game"}</h3>
        <p>${b.date} at ${b.time} &middot; ${b.hours} Hour${b.hours > 1 ? "s" : ""} &middot; ${b.players} Player${b.players > 1 ? "s" : ""}</p>
        ${b.notes ? `<p class="card-notes">"${b.notes}"</p>` : ""}
      </div>
      <div class="card-actions">
        <button class="btn-icon" data-copy="${b.code}" title="Copy Confirmation Code">Copy Code</button>
        <button class="btn-icon btn-danger" data-delete="${b.code}" title="Remove locally">Clear View</button>
      </div>
    </div>
  `
    )
    .join("");
}

if (form) {
  form.addEventListener("input", updateTotalDisplay);
  if (setup) setup.addEventListener("change", updatePlayerLimit);
  if (players) players.addEventListener("input", updateTotalDisplay);
  if (hours) hours.addEventListener("input", updateTotalDisplay);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!dateInput.value || !timeInput.value) {
      showToast("Pick a future date and time for your HotBox booking.");
      return;
    }

    const booking = collectBooking();
    const submitButton = form.querySelector(".submit-button");
    submitButton.disabled = true;
    submitButton.textContent = "Saving booking...";

    try {
      booking.synced = await saveBookingOnline(booking);
    } catch (error) {
      console.warn("Firebase communication error", error);
    }

    const bookings = [booking, ...readBookings()].slice(0, 8);
    writeBookings(bookings);
    renderBookings();
    
    showToast(booking.synced ? `Booked ${booking.setup} online. ID: ${booking.code}` : `Saved locally.`);
    form.reset();
    setDefaultSlot();
    updatePlayerLimit();

    submitButton.disabled = false;
    submitButton.innerHTML = 'Confirm Booking';
  });
}

if (bookingList) {
  bookingList.addEventListener("click", async (event) => {
    const copyCode = event.target.dataset.copy;
    const deleteCode = event.target.dataset.delete;

    if (copyCode) {
      await navigator.clipboard.writeText(copyCode);
      showToast(`Copied booking ID ${copyCode}.`);
    }

    if (deleteCode) {
      writeBookings(readBookings().filter((booking) => booking.code !== deleteCode));
      renderBookings();
      showToast(`Local view updated.`);
    }
  });
}

document.querySelectorAll('input[type="number"]').forEach(input => {
  input.addEventListener('keydown', (e) => {
    if (['e', 'E', '+', '-'].includes(e.key)) {
      e.preventDefault();
    }
  });
});

window.addEventListener("DOMContentLoaded", async () => {
  setDefaultSlot();
  updatePlayerLimit();
  renderBookings();
  await setupFirebase();
});
