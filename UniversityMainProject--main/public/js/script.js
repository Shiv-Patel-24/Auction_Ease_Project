(() => {
  'use strict'

  // Bootstrap form validation
  const forms = document.querySelectorAll('.needs-validation');
  Array.from(forms).forEach(form => {
    form.addEventListener('submit', event => {
      if (!form.checkValidity()) {
        event.preventDefault()
        event.stopPropagation()
      }

      form.classList.add('was-validated')
    }, false);
  });

  // -------------------------------
  // AI Price Suggestion Integration
  // -------------------------------

  async function fetchPriceSuggestion() {
    const title = document.querySelector('input[name="listing[title]"]')?.value || '';
    const description = document.querySelector('textarea[name="listing[description]"]')?.value || '';

    // Dummy/static values for now
    const productData = {
      category: "Electronics",
      brand: "Apple",
      condition: "Used",
      item_age_months: 12,
      description_length: description.trim().length,
      seller_rating: 4.5,
      historical_views: 250,
      similar_items: 3
    };

    try {
      const response = await fetch("http://localhost:5000/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(productData)
      });

      const result = await response.json();

      if (result.suggested_start_bid && result.estimated_max_bid) {
        document.getElementById("aiSuggestedStart").value = `₹${result.suggested_start_bid}`;
        document.getElementById("aiSuggestedMax").value = `₹${result.estimated_max_bid}`;
      } else {
        console.warn("AI API returned an unexpected response:", result);
      }

    } catch (error) {
      console.error("Error contacting AI price API:", error);
    }
  }

  // Attach event listeners only if the create listing page exists
  window.addEventListener('DOMContentLoaded', () => {
  const aiBtn = document.getElementById('aiSuggestBtn');

  aiBtn?.addEventListener('click', fetchPriceSuggestion);
});

async function fetchPriceSuggestion() {
  const title = document.querySelector('input[name="listing[title]"]').value;
  const description = document.querySelector('textarea[name="listing[description]"]').value;
  const category = document.getElementById('category').value;
  const brand = document.getElementById('brand').value;
  const condition = document.getElementById('condition').value;

  if (!title || !description || !category || !brand || !condition) {
    alert("Please fill in title, description, category, brand, and condition first.");
    return;
  }

  const meta = document.getElementById('ai-metadata');
  const sellerRating = parseFloat(meta.dataset.sellerRating);
  const similarItems = parseInt(meta.dataset.similarItems);

  const productData = {
    category: category,
    brand: brand,
    condition: condition,
    item_age_months: condition === 'New' ? 0 : 12,
    description_length: description.trim().length,
    seller_rating: sellerRating,
    historical_views: 250,
    similar_items: similarItems
  };

  try {
    const response = await fetch('http://127.0.0.1:5000/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(productData)
    });

    if (!response.ok) throw new Error("AI service failed");

    const data = await response.json();

    document.getElementById('aiSuggestedStart').value = `₹${data.suggested_start_bid}`;
    document.getElementById('aiSuggestedMax').value = `₹${data.estimated_max_bid}`;
  } catch (error) {
    console.error("Error fetching AI price suggestion:", error);
    alert("Failed to fetch AI price suggestion.");
  }
}


  const category = document.getElementById('category')?.value || '';
  const brand = document.getElementById('brand')?.value || '';
  const condition = document.getElementById('condition')?.value || '';

  const productData = {
  category: category,
  brand: brand,
  condition: condition,
  item_age_months: condition === 'New' ? 0 : 12,
  description_length: description.trim().length,
  seller_rating: window.sellerRating,
  historical_views: 250,
  similar_items: window.similarItems
};


})();
