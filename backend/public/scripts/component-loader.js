// Function to fetch and load HTML components
async function loadComponent(elementId, componentPath) {
  try {
    const response = await fetch(componentPath);
    if (!response.ok) throw new Error(`Failed to load ${componentPath}`);

    const htmlContent = await response.text();
    const placeholder = document.getElementById(elementId);

    if (placeholder) {
      // outerHTML = htmlContent silently strips <script> execution (innerHTML too).
      // createContextualFragment parses HTML AND marks scripts as executable,
      // so they run the moment the fragment is inserted into the live DOM.
      const range    = document.createRange();
      const fragment = range.createContextualFragment(htmlContent);
      placeholder.replaceWith(fragment);

      // ম্যাজিক: সাইডবার লোড হওয়ার পর অ্যাক্টিভ পেজের কালার চেঞ্জ করা
      if (componentPath.includes("sidebar.html")) {
        // বর্তমান পেজের নাম বের করা (যেমন: dashboard-page.html)
        const currentPath =
          window.location.pathname.split("/").pop() || "dashboard-page.html";
        const navLinks = document.querySelectorAll("aside nav .nav-link");

        navLinks.forEach((link) => {
          const href = link.getAttribute("href");
          if (href === currentPath) {
            // বর্তমান পেজ হলে কমলা ব্যাকগ্রাউন্ড ও কালার সেট করবে
            link.className =
              "nav-link flex items-center gap-3 px-4 py-3 bg-orange-50 dark:bg-orange-900/20 text-primary font-bold rounded-xl group transition-colors";
            const icon = link.querySelector(".material-icons-outlined");
            if (icon) icon.classList.remove("text-gray-400");
          }
        });
      }
    }
  } catch (error) {
    console.error("Error loading component:", error);
  }
}

// When the document is fully loaded, fetch the components
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("sidebar-placeholder")) {
    loadComponent("sidebar-placeholder", "../components/sidebar.html");
  }

  if (document.getElementById("header-placeholder")) {
    loadComponent("header-placeholder", "../components/header.html");
  }
});