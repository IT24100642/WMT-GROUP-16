const DRAFT_KEY = "mv_booking_draft_v1";
const RESUME_MODAL_KEY = "mv_resume_booking_modal";
const FOOD_SUCCESS_KEY = "mv_food_order_during_booking_done";

/**
 * Persist in-progress room/offer booking while guest visits the restaurant, then return to /book.
 */
export function saveBookingDraft(draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota */
  }
}

export function loadBookingDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearBookingDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * After placing a room-bill food order during /book → /restaurant flow, add it to the saved draft
 * so the booking form total and submit payload include restaurant charges.
 * @param {{ _id?: string, subtotal?: number }} order
 */
export function appendFoodOrderToDraft(order) {
  if (!order?._id) return;
  try {
    const draft = loadBookingDraft();
    if (!draft) return;
    const sub = Math.round(Number(order.subtotal) || 0);
    const id = String(order._id);
    const next = { ...draft };
    next.restaurantFolioSubtotal = (Math.round(Number(next.restaurantFolioSubtotal)) || 0) + sub;
    next.linkedFoodOrderIds = Array.isArray(next.linkedFoodOrderIds) ? [...next.linkedFoodOrderIds] : [];
    if (!next.linkedFoodOrderIds.includes(id)) next.linkedFoodOrderIds.push(id);
    saveBookingDraft(next);
  } catch {
    /* ignore */
  }
}

export function setResumeBookingModalFlag() {
  try {
    sessionStorage.setItem(RESUME_MODAL_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** @returns {boolean} */
export function consumeResumeBookingModalFlag() {
  try {
    const v = sessionStorage.getItem(RESUME_MODAL_KEY);
    sessionStorage.removeItem(RESUME_MODAL_KEY);
    return v === "1";
  } catch {
    return false;
  }
}

export function setFoodDuringBookingSuccessFlag() {
  try {
    sessionStorage.setItem(FOOD_SUCCESS_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** @returns {boolean} */
export function consumeFoodDuringBookingSuccessFlag() {
  try {
    const v = sessionStorage.getItem(FOOD_SUCCESS_KEY);
    sessionStorage.removeItem(FOOD_SUCCESS_KEY);
    return v === "1";
  } catch {
    return false;
  }
}
