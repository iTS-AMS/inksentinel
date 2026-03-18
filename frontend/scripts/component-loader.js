// Function to fetch and load HTML components
async function loadComponent(elementId, componentPath) {
  try {
    const response = await fetch(componentPath);
    if (!response.ok) throw new Error(`Failed to load ${componentPath}`);

    const htmlContent = await response.text();
    const placeholder = document.getElementById(elementId);

    if (placeholder) {
      // outerHTML ব্যবহার করার কারণ হলো, এতে placeholder div টি মুছে গিয়ে একদম অরিজিনাল কোডটি বসবে, ডিজাইন ভাঙবে না।
      placeholder.outerHTML = htmlContent;
    }
  } catch (error) {
    console.error("Error loading component:", error);
  }
}

// When the document is fully loaded, fetch the components
document.addEventListener("DOMContentLoaded", () => {
  // এখানে আমরা "../components/" পাথ ব্যবহার করছি কারণ আমাদের HTML পেজগুলো "pages" ফোল্ডারের ভেতরে আছে
  if (document.getElementById("sidebar-placeholder")) {
    loadComponent("sidebar-placeholder", "../components/sidebar.html");
  }

  if (document.getElementById("header-placeholder")) {
    loadComponent("header-placeholder", "../components/header.html");
  }
});
