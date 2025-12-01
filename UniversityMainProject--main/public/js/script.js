(() => {
  'use strict';

  // ---------- Bootstrap form validation ----------
  function initBootstrapValidation() {
    const forms = document.querySelectorAll('.needs-validation');
    Array.from(forms).forEach(form => {
      form.addEventListener('submit', event => {
        if (!form.checkValidity()) {
          event.preventDefault();
          event.stopPropagation();
        }
        form.classList.add('was-validated');
      }, false);
    });
  }

  // ---------- AI Price Suggestion ----------
  // Single consolidated function. It only runs when the create-listing form elements exist.
  async function fetchPriceSuggestion() {
    try {
      const titleEl = document.querySelector('input[name="listing[title]"]');
      const descEl = document.querySelector('textarea[name="listing[description]"]');
      const categoryEl = document.getElementById('category');
      const brandEl = document.getElementById('brand');
      const conditionEl = document.getElementById('condition');
      const meta = document.getElementById('ai-metadata');

      if (!titleEl || !descEl || !categoryEl || !brandEl || !conditionEl) {
        alert("Please open the Create Listing page and fill required fields first.");
        return;
      }

      const title = titleEl.value.trim();
      const description = descEl.value.trim();
      const category = categoryEl.value;
      const brand = brandEl.value;
      const condition = conditionEl.value;

      if (!title || !description || !category || !brand || !condition) {
        alert("Please fill in title, description, category, brand, and condition first.");
        return;
      }

      // metadata fallbacks
      const sellerRating = meta ? parseFloat(meta.dataset.sellerRating || 0) : 0;
      const similarItems = meta ? parseInt(meta.dataset.similarItems || 0) : 0;

      const productData = {
        category,
        brand,
        condition,
        item_age_months: condition === 'New' ? 0 : 12,
        description_length: description.length,
        seller_rating: sellerRating,
        historical_views: 250,
        similar_items: similarItems
      };

      // Try relative URL first, fallback to localhost
      const endpointCandidates = ['/predict', 'http://127.0.0.1:5000/predict', 'http://localhost:5000/predict'];
      let response = null;
      let data = null;
      for (const url of endpointCandidates) {
        try {
          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
          });
          if (!response.ok) {
            // try next candidate
            continue;
          }
          data = await response.json();
          break;
        } catch (err) {
          // try next candidate
          continue;
        }
      }

      if (!data) throw new Error('AI service not reachable or returned an error.');

      if (data.suggested_start_bid != null) {
        const startEl = document.getElementById('aiSuggestedStart');
        if (startEl) startEl.value = `₹${data.suggested_start_bid}`;
      }
      if (data.estimated_max_bid != null) {
        const maxEl = document.getElementById('aiSuggestedMax');
        if (maxEl) maxEl.value = `₹${data.estimated_max_bid}`;
      }
    } catch (err) {
      console.error("Error fetching AI price suggestion:", err);
      alert("Failed to fetch AI price suggestion. See console for details.");
    }
  }

  // ---------- Socket / Real-time Listing UI Helpers ----------
  function formatINR(n) {
    try {
      return Number(n || 0).toLocaleString('en-IN');
    } catch (e) { return n; }
  }

  // Update listing card price element(s)
  function updateListingPrice(listingId, amount) {
    if (!listingId) return;
    const els = document.querySelectorAll(`[data-listing-price-id="${listingId}"]`);
    els.forEach(el => { el.textContent = formatINR(amount); });
    // also update show page price if present
    const showPrice = document.querySelector(`#current-price[data-listing-id="${listingId}"]`);
    if (showPrice) showPrice.textContent = formatINR(amount);
    // update any buy link price span
    document.querySelectorAll(`[data-listing-buy-id="${listingId}"]`).forEach(node => {
      const span = node.querySelector('span');
      if (span) span.textContent = formatINR(amount);
    });
  }

  // Show sold badge on listing card(s) and hide price / disable buy buttons
  function markListingSoldUI(listingId, payload = {}) {
    if (!listingId) return;
    // cards in index/listings
    const cardContainers = document.querySelectorAll(`[data-listing-id="${listingId}"], [data-listing-price-id="${listingId}"]`);
    // Ensure we operate on unique card parent nodes
    const handled = new Set();
    cardContainers.forEach(node => {
      const card = node.closest('.listing-card') || node.closest('.card') || node.closest('[data-listing-id]') || node;
      if (!card) return;
      const key = card.dataset.listingId || card.querySelector('[data-listing-price-id]')?.getAttribute('data-listing-price-id') || listingId;
      if (handled.has(key)) return;
      handled.add(key);

      // set attribute so page-level scripts can detect sold
      try { card.setAttribute('data-listing-sold', '1'); } catch (e) {}

      // hide price wrapper if present
      const priceWrapper = card.querySelector('.price-wrapper') || card.querySelector('.price-box') || card.querySelector('[data-listing-price-id]');
      if (priceWrapper && priceWrapper.classList) priceWrapper.classList.add('visually-hidden');

      // remove price text if direct span
      const priceSpan = card.querySelector(`[data-listing-price-id="${listingId}"]`);
      if (priceSpan) priceSpan.textContent = '';

      // add badge if not present
      if (!card.querySelector('.sold-badge-client') && !card.querySelector('.sold-badge-server') && !card.querySelector('.sold-badge')) {
        const badge = document.createElement('div');
        badge.className = 'sold-badge-client';
        badge.textContent = 'SOLD';
        // prefer to prepend inside card
        const inner = card.querySelector('.card') || card.querySelector('.ios-card') || card;
        if (inner && inner.prepend) inner.prepend(badge);
        else card.insertBefore(badge, card.firstChild);
      }

      // replace buy button(s) with disabled sold button
      const buyNodes = card.querySelectorAll('[data-listing-buy-id], .buy-now-btn, #buy-now-btn, #buy-wallet-btn, .sold-button');
      if (buyNodes.length) {
        buyNodes.forEach(bn => {
          try {
            const parent = bn.parentNode;
            const soldBtn = document.createElement('button');
            soldBtn.className = 'btn btn-outline-secondary w-75 sold-button';
            soldBtn.disabled = true;
            soldBtn.textContent = '✅ Sold';
            if (parent) parent.replaceChild(soldBtn, bn);
            else bn.replaceWith(soldBtn);
          } catch (e) {
            // fallback: disable existing node
            try { bn.disabled = true; bn.textContent = '🔒 Sold'; } catch (e2) {}
          }
        });
      } else {
        // no buy nodes found: append a sold button to action area if present
        const actionCol = card.querySelector('.d-flex.flex-column, #buy-buttons-container, .card-body, .details-wrap');
        if (actionCol && !actionCol.querySelector('.sold-button')) {
          const soldBtn = document.createElement('button');
          soldBtn.className = 'btn btn-outline-secondary w-75 sold-button';
          soldBtn.disabled = true;
          soldBtn.textContent = '✅ Sold';
          actionCol.appendChild(soldBtn);
        }
      }
    });

    // If this is a show page, also ensure buy buttons reflect sold state
    const showContainer = document.querySelector(`[data-listing-id="${listingId}"]`);
    if (showContainer && showContainer.getAttribute) {
      showContainer.setAttribute('data-listing-sold', '1');
      const buyNow = showContainer.querySelector('#buy-now-btn');
      const buyWallet = showContainer.querySelector('#buy-wallet-btn');
      if (buyNow) { buyNow.disabled = true; buyNow.classList.add('disabled-overlay'); buyNow.textContent = '🔒 Sold'; }
      if (buyWallet) { buyWallet.disabled = true; buyWallet.classList.add('disabled-overlay'); buyWallet.textContent = '🔒 Sold'; }
      // add a small sold badge near the price if none
      const priceBox = showContainer.querySelector('.price-box');
      if (priceBox && !showContainer.querySelector('.sold-badge')) {
        const span = document.createElement('span');
        span.className = 'sold-badge';
        span.textContent = 'SOLD';
        priceBox.parentNode.insertBefore(span, priceBox.nextSibling);
      }
    }
  }

  // ---------- Main init on DOMContentLoaded ----------
  window.addEventListener('DOMContentLoaded', () => {
    initBootstrapValidation();

    // Wire AI button if present
    const aiBtn = document.getElementById('aiSuggestBtn');
    if (aiBtn) aiBtn.addEventListener('click', fetchPriceSuggestion);

    // Attempt to connect to Socket.IO if available on the page
    let socket = null;
    try {
      if (typeof io !== 'undefined') {
        socket = io();
        // Listen for general events that update listing cards
        socket.on('auction:bid', (data) => {
          try {
            if (!data) return;
            const listingId = data.listingId || data._id || data.listing_id;
            const currentBid = data.currentBid || data.current_bid || data.amount;
            if (listingId && typeof currentBid !== 'undefined') updateListingPrice(listingId, currentBid);
          } catch (e) { console.error('auction:bid handler error', e); }
        });

        socket.on('updateHighestBid', (data) => {
          try {
            if (!data) return;
            const listingId = data.listingId || (data.highestBid || {}).listingId;
            const amount = (data.highestBid && data.highestBid.amount) || data.currentBid;
            if (listingId && typeof amount !== 'undefined') updateListingPrice(listingId, amount);
          } catch (e) { console.error('updateHighestBid handler error', e); }
        });

        socket.on('auction:ended', (data) => {
          try {
            if (!data) return;
            const listingId = data.listingId || data._id || data.listing_id;
            const finalPrice = data.finalPrice || data.currentBid || data.final_price;
            if (listingId && typeof finalPrice !== 'undefined') updateListingPrice(listingId, finalPrice);
          } catch (e) { console.error('auction:ended handler error', e); }
        });

        // When a listing is sold via payment (card or wallet), reflect UI changes
        socket.on('listing:sold', (data) => {
          try {
            if (!data) return;
            const listingId = data.listingId || data.listing_id || (data.items && data.items[0] && data.items[0].listing);
            const soldPrice = data.soldPrice || data.price || (data.items && data.items[0] && data.items[0].price);
            if (listingId && typeof soldPrice !== 'undefined') {
              updateListingPrice(listingId, soldPrice);
            }
            if (listingId) markListingSoldUI(listingId, data);
          } catch (e) { console.error('listing:sold handler error', e); }
        });
      }
    } catch (err) {
      console.warn('Socket.IO init failed (maybe not used on this page):', err);
    }
  });

})();
