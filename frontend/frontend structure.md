
















File structure:
frontend
├── assets
│   └── logo
├── components/
│   ├── footer.html
│   ├── header.html
│   └── sidebar.html    
├── pages/
│   ├── alert-monitor-page.html    
│   ├── audit-log-page.html   
│   ├── dashboard-page.html 
│   ├── exam-setup-page.html
│   ├── login-page.html   
│   ├── settings-page.html     
│   └── student-list-page.html
├── scripts/    
│   ├── component-loader.js             
│   └── theme-controller.js    
├── styles/                
│   └── global.css       
└── index.html




some files are empty.


2. Code:


frontend/index.html

<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>ExamNexus</title>
  </head>

  <body>
    <h2>ExamNexus System</h2>

    <a href="pages/login-page.html">Open Login Page</a>
  </body>
</html>


frontend/styles/global.css
/* 
    frontend/styles.css
*/


frontend/components/footer.html





frontend/components/header.html

<header
  class="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark h-20 px-8 flex items-center justify-between shrink-0"
>
  <div class="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
    <button
      class="bg-secondary hover:bg-emerald-600 text-white px-5 py-2 rounded-md text-sm font-medium shadow-sm transition-colors"
    >
      Start
    </button>
    <button
      class="text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 px-5 py-2 rounded-md text-sm font-medium transition-colors"
    >
      Pause
    </button>
    <button
      class="text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 px-5 py-2 rounded-md text-sm font-medium transition-colors"
    >
      Resume
    </button>
    <button
      class="text-danger hover:bg-red-50 dark:hover:bg-red-900/20 px-5 py-2 rounded-md text-sm font-medium transition-colors"
    >
      Terminate
    </button>
  </div>
  <div class="flex flex-col items-center">
    <span
      class="text-3xl font-bold font-mono tracking-tight text-gray-900 dark:text-white"
      >01:45:22</span
    >
    <span
      class="text-[10px] tracking-widest font-semibold text-gray-400 dark:text-gray-500 uppercase"
      >Remaining Time</span
    >
  </div>
  <div class="flex items-center gap-6">
    <div class="flex flex-col items-end gap-1 text-xs font-medium">
      <div class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <span class="w-2 h-2 rounded-full bg-secondary"></span> BACKEND
      </div>
      <div class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <span class="w-2 h-2 rounded-full bg-secondary"></span> AI ENGINE
      </div>
    </div>
    <div class="h-8 w-px bg-gray-200 dark:bg-gray-700"></div>
    <div class="flex flex-col items-start gap-0.5">
      <div
        class="flex items-center gap-2 text-xs font-semibold text-yellow-500"
      >
        <span class="w-2 h-2 rounded-full bg-yellow-500"></span> 12ms
      </div>
      <span class="text-[10px] text-gray-400">System Status: Optimal</span>
    </div>
    <div class="relative ml-2">
      <span
        class="material-icons-outlined text-gray-500 dark:text-gray-400 text-2xl cursor-pointer"
        >notifications</span
      >
      <span
        class="absolute top-0 right-0 h-2 w-2 rounded-full bg-danger border border-white dark:border-gray-800"
      ></span>
    </div>
  </div>
</header>



frontend/components/sidebar.html

<aside
  class="w-64 bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark flex flex-col justify-between h-full flex-shrink-0 transition-colors duration-200"
>
  <div>
    <div class="p-6 flex items-center gap-3">
      <div
        class="bg-primary rounded-lg p-1.5 flex items-center justify-center shadow-sm"
      >
        <span class="material-symbols-outlined text-white text-2xl"
          >grid_view</span
        >
      </div>
      <div>
        <h1
          class="font-bold text-lg leading-tight text-gray-900 dark:text-white"
        >
          ExamNexus
        </h1>
        <p
          class="text-[10px] uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400 mt-0.5"
        >
          Proctor Console
        </p>
      </div>
    </div>

    <nav class="px-4 py-2 space-y-1">
      <a
        class="nav-link flex items-center gap-3 px-4 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white font-medium rounded-xl group transition-colors"
        href="dashboard-page.html"
      >
        <span
          class="material-icons-outlined text-xl text-gray-400 group-hover:text-primary transition-colors"
          >grid_view</span
        >
        Dashboard
      </a>

      <a
        class="nav-link flex items-center gap-3 px-4 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white font-medium rounded-xl group transition-colors"
        href="exam-setup-page.html"
      >
        <span
          class="material-icons-outlined text-xl text-gray-400 group-hover:text-primary transition-colors"
          >settings_suggest</span
        >
        Exam Setup
      </a>

      <a
        class="nav-link flex items-center gap-3 px-4 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white font-medium rounded-xl group transition-colors"
        href="alert-monitor-page.html"
      >
        <span
          class="material-icons-outlined text-xl text-gray-400 group-hover:text-primary transition-colors"
          >warning_amber</span
        >
        AI Alerts
        <span
          class="ml-auto bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full"
          >2</span
        >
      </a>

      <a
        class="nav-link flex items-center gap-3 px-4 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white font-medium rounded-xl group transition-colors"
        href="student-list-page.html"
      >
        <span
          class="material-icons-outlined text-xl text-gray-400 group-hover:text-primary transition-colors"
          >people_alt</span
        >
        Student List
      </a>

      <a
        class="nav-link flex items-center gap-3 px-4 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white font-medium rounded-xl group transition-colors"
        href="audit-log-page.html"
      >
        <span
          class="material-icons-outlined text-xl text-gray-400 group-hover:text-primary transition-colors"
          >fact_check</span
        >
        Audit Log
      </a>

      <div class="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800">
        <a
          class="nav-link flex items-center gap-3 px-4 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white font-medium rounded-xl group transition-colors"
          href="settings-page.html"
        >
          <span
            class="material-icons-outlined text-xl text-gray-400 group-hover:text-primary transition-colors"
            >settings</span
          >
          Settings
        </a>
      </div>
    </nav>
  </div>

  <div
    class="p-4 mb-4 mx-4 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-between"
  >
    <div class="flex items-center gap-3 overflow-hidden">
      <div
        class="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 w-10 h-10 rounded-full flex items-center justify-center shrink-0"
      >
        <span class="material-icons-outlined">account_circle</span>
      </div>
      <div class="overflow-hidden">
        <p class="text-sm font-bold text-gray-900 dark:text-white truncate">
          Anik Sinha
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
          Senior Proctor
        </p>
      </div>
    </div>
    <button
      onclick="window.location.href = 'login-page.html'"
      title="Logout"
      class="text-gray-400 hover:text-danger dark:hover:text-danger transition-colors p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
    >
      <span class="material-icons-outlined">logout</span>
    </button>
  </div>
</aside>



frontend/scripts/component-loader.js

// Function to fetch and load HTML components
async function loadComponent(elementId, componentPath) {
  try {
    const response = await fetch(componentPath);
    if (!response.ok) throw new Error(`Failed to load ${componentPath}`);

    const htmlContent = await response.text();
    const placeholder = document.getElementById(elementId);

    if (placeholder) {
      placeholder.outerHTML = htmlContent;

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


frontend/scripts/theme-controller.js


frontend/pages/alert-monitor-page.html

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta content="width=device-width, initial-scale=1.0" name="viewport" />
    <title>AI Alerts | ExamNexus</title>
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <link
      href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined"
      rel="stylesheet"
    />
    <link
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
      rel="stylesheet"
    />

    <script>
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              primary: "#FF5722",
              secondary: "#10B981",
              danger: "#EF4444",
              warning: "#F59E0B",
              "background-light": "#F9FAFB",
              "background-dark": "#111827",
              "surface-light": "#FFFFFF",
              "surface-dark": "#1F2937",
              "text-light": "#1F2937",
              "text-dark": "#F3F4F6",
              "border-light": "#E5E7EB",
              "border-dark": "#374151",
            },
            fontFamily: {
              sans: ["Inter", "sans-serif"],
            },
            borderRadius: {
              DEFAULT: "0.5rem",
            },
          },
        },
      };
    </script>
    <style>
      ::-webkit-scrollbar {
        width: 6px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
      }
      .dark ::-webkit-scrollbar-thumb {
        background: #475569;
      }
    </style>
  </head>
  <body
    class="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-sans antialiased h-screen overflow-hidden flex transition-colors duration-200 relative"
  >
    <div id="sidebar-placeholder"></div>

    <main class="flex-1 flex flex-col h-full overflow-hidden relative">
      <header
        class="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark h-20 px-8 flex items-center justify-between z-10 shrink-0"
      >
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">
            AI Alerts Feed
          </h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Real-time feed of detected anomalies requiring attention
          </p>
        </div>
        <div class="flex items-center gap-4">
          <button
            class="text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
          >
            <span class="material-symbols-outlined text-[24px]"
              >notifications</span
            >
          </button>
          <button
            class="text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
          >
            <span class="material-symbols-outlined text-[24px]">help</span>
          </button>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto p-8">
        <div class="max-w-4xl mx-auto space-y-6 relative">
          <div
            class="absolute left-[8.5rem] top-8 bottom-8 w-0.5 bg-gray-200 dark:bg-gray-700 -z-0 hidden md:block"
          ></div>

          <div class="relative flex flex-col md:flex-row gap-8 group">
            <div
              class="flex-shrink-0 w-28 text-right pt-4 hidden md:block pr-4"
            >
              <p class="text-lg font-bold text-gray-900 dark:text-white">
                10:45 AM
              </p>
              <p class="text-xs text-gray-500">Just now</p>
            </div>
            <div
              class="absolute left-[8.5rem] top-6 w-4 h-4 rounded-full border-2 border-white dark:border-gray-900 bg-danger shadow-sm z-10 hidden md:block translate-x-[-50%]"
            ></div>

            <div
              class="flex-1 bg-surface-light dark:bg-surface-dark rounded-xl border border-red-200 dark:border-red-900/30 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              <div class="h-1 bg-danger w-full"></div>
              <div class="p-6">
                <div class="flex justify-between items-start mb-3">
                  <div class="flex items-center gap-3">
                    <span
                      class="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide"
                      >High Severity</span
                    >
                    <span
                      class="text-sm font-bold text-gray-600 dark:text-gray-400"
                      >ID: STU-204</span
                    >
                  </div>
                  <div class="md:hidden text-xs text-gray-500 font-medium">
                    10:45 AM
                  </div>
                </div>
                <h3
                  class="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2"
                >
                  <span class="material-symbols-outlined text-danger filled"
                    >smartphone</span
                  >
                  Mobile Phone Detected
                </h3>
                <p
                  class="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed"
                >
                  AI has detected a rectangular electronic device resembling a
                  mobile phone in the student's hands. Confidence score: 94%.
                </p>

                <div
                  class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-border-light dark:border-border-dark flex items-start gap-4"
                >
                  <div
                    class="w-24 h-16 bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center flex-shrink-0 text-gray-400"
                  >
                    <span class="material-symbols-outlined text-2xl"
                      >image</span
                    >
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-gray-500 uppercase mb-1">
                      Snapshot Analysis
                    </p>
                    <p
                      class="text-xs font-medium text-gray-700 dark:text-gray-300 truncate"
                    >
                      Object_class: phone | Probability: 0.94 | Bounding_box:
                      [x:240, y:310]
                    </p>
                  </div>
                  <button
                    onclick="openStudentModal('STU-204', 'vision')"
                    class="text-primary hover:text-orange-600 text-sm font-bold whitespace-nowrap transition-colors"
                  >
                    View Proof
                  </button>
                </div>

                <div class="mt-5 flex gap-3">
                  <button
                    onclick="openStudentModal('STU-204', 'vision')"
                    class="flex-1 bg-primary hover:bg-orange-600 text-white text-sm font-bold py-2.5 px-4 rounded-lg transition-colors flex justify-center items-center gap-2 shadow-sm"
                  >
                    <span class="material-symbols-outlined text-base"
                      >gavel</span
                    >
                    Take Action
                  </button>
                  <button
                    onclick="this.closest('.group').style.display = 'none'"
                    class="flex-1 bg-white dark:bg-gray-800 border border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-bold py-2.5 px-4 rounded-lg transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="relative flex flex-col md:flex-row gap-8 group">
            <div
              class="flex-shrink-0 w-28 text-right pt-4 hidden md:block pr-4"
            >
              <p class="text-lg font-bold text-gray-900 dark:text-white">
                10:42 AM
              </p>
              <p class="text-xs text-gray-500">3 mins ago</p>
            </div>
            <div
              class="absolute left-[8.5rem] top-6 w-4 h-4 rounded-full border-2 border-white dark:border-gray-900 bg-warning shadow-sm z-10 hidden md:block translate-x-[-50%]"
            ></div>

            <div
              class="flex-1 bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              <div class="h-1 bg-warning w-full"></div>
              <div class="p-6">
                <div class="flex justify-between items-start mb-3">
                  <div class="flex items-center gap-3">
                    <span
                      class="bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide"
                      >Medium Severity</span
                    >
                    <span
                      class="text-sm font-bold text-gray-600 dark:text-gray-400"
                      >ID: STU-209</span
                    >
                  </div>
                  <div class="md:hidden text-xs text-gray-500 font-medium">
                    10:42 AM
                  </div>
                </div>
                <h3
                  class="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2"
                >
                  <span class="material-symbols-outlined text-warning"
                    >record_voice_over</span
                  >
                  Speaking Detected
                </h3>
                <p
                  class="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed"
                >
                  Constant audio levels detected above ambient threshold.
                  Pattern matches conversation. Confidence: 91%.
                </p>
                <div class="mt-5 flex gap-3">
                  <button
                    onclick="openStudentModal('STU-209', 'audio')"
                    class="flex-1 bg-primary hover:bg-orange-600 text-white text-sm font-bold py-2.5 px-4 rounded-lg transition-colors flex justify-center items-center gap-2 shadow-sm"
                  >
                    <span class="material-symbols-outlined text-base"
                      >gavel</span
                    >
                    Take Action
                  </button>
                  <button
                    onclick="this.closest('.group').style.display = 'none'"
                    class="flex-1 bg-white dark:bg-gray-800 border border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-bold py-2.5 px-4 rounded-lg transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="relative flex flex-col md:flex-row gap-8 group">
            <div
              class="flex-shrink-0 w-28 text-right pt-4 hidden md:block pr-4"
            >
              <p class="text-lg font-bold text-gray-900 dark:text-white">
                10:38 AM
              </p>
              <p class="text-xs text-gray-500">7 mins ago</p>
            </div>
            <div
              class="absolute left-[8.5rem] top-6 w-4 h-4 rounded-full border-2 border-white dark:border-gray-900 bg-gray-400 dark:bg-gray-600 shadow-sm z-10 hidden md:block translate-x-[-50%]"
            ></div>

            <div
              class="flex-1 bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden opacity-80"
            >
              <div class="h-1 bg-gray-400 dark:bg-gray-600 w-full"></div>
              <div class="p-6">
                <div class="flex justify-between items-start mb-3">
                  <div class="flex items-center gap-3">
                    <span
                      class="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide"
                      >High Severity</span
                    >
                    <span
                      class="text-sm font-bold text-gray-600 dark:text-gray-400"
                      >ID: STU-8842</span
                    >
                  </div>
                  <div class="md:hidden text-xs text-gray-500 font-medium">
                    10:38 AM
                  </div>
                </div>
                <h3
                  class="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2"
                >
                  <span class="material-symbols-outlined text-gray-500 filled"
                    >group</span
                  >
                  Multiple Persons Detected
                </h3>
                <p
                  class="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed"
                >
                  Second face detected in frame background. Unauthorized person
                  likely present. Confidence: 94%.
                </p>

                <div class="mt-5 flex gap-3">
                  <button
                    disabled
                    class="w-full bg-gray-100 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 text-sm font-bold py-2.5 px-4 rounded-lg flex justify-center items-center gap-2 cursor-not-allowed"
                  >
                    <span class="material-symbols-outlined text-base"
                      >done_all</span
                    >
                    Student Notified
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div
            class="relative flex flex-col md:flex-row gap-8 group opacity-60"
          >
            <div
              class="flex-shrink-0 w-28 text-right pt-4 hidden md:block pr-4"
            >
              <p class="text-lg font-bold text-gray-900 dark:text-white">
                10:35 AM
              </p>
              <p class="text-xs text-gray-500">10 mins ago</p>
            </div>
            <div
              class="absolute left-[8.5rem] top-6 w-4 h-4 rounded-full border-2 border-white dark:border-gray-900 bg-gray-300 dark:bg-gray-700 shadow-sm z-10 hidden md:block translate-x-[-50%]"
            ></div>

            <div
              class="flex-1 bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
            >
              <div class="p-6">
                <div class="flex justify-between items-start mb-3">
                  <div class="flex items-center gap-3">
                    <span
                      class="text-sm font-bold text-gray-500 dark:text-gray-400"
                      >ID: STU-7731</span
                    >
                  </div>
                </div>
                <h3
                  class="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2"
                >
                  <span class="material-symbols-outlined text-gray-400"
                    >visibility_off</span
                  >
                  Looking Away
                </h3>
                <p class="text-sm text-gray-500 dark:text-gray-500 mb-4">
                  Student gaze tracking indicates focus off-screen for > 15
                  seconds.
                </p>
                <div class="mt-2">
                  <div
                    class="flex items-center gap-2 text-secondary dark:text-green-500"
                  >
                    <span class="material-symbols-outlined text-base"
                      >check_circle</span
                    >
                    <span class="text-sm font-bold"
                      >Automatically Resolved</span
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-center mt-10 mb-6">
            <button
              onclick="alert('No older alerts found.')"
              class="bg-white dark:bg-gray-800 border border-border-light dark:border-border-dark text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white shadow-sm hover:shadow text-sm font-bold py-2.5 px-6 rounded-full flex items-center gap-2 transition-all"
            >
              Load older alerts
              <span class="material-symbols-outlined text-base"
                >expand_more</span
              >
            </button>
          </div>
        </div>
      </div>
    </main>

    <div
      id="student-modal"
      class="hidden fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm transition-all duration-300 p-4"
    >
      <div
        class="bg-white dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col md:flex-row overflow-hidden max-h-[90vh]"
      >
        <div
          class="w-full md:w-[60%] flex flex-col border-r border-border-light dark:border-border-dark"
        >
          <div
            class="relative flex-1 bg-[#dcd0c3] min-h-[300px] flex items-center justify-center overflow-hidden"
          >
            <img
              src="https://i.pravatar.cc/600?img=11"
              class="object-cover w-full h-full opacity-80 mix-blend-multiply"
              alt="Student Feed"
            />

            <div
              id="modal-bounding-box"
              class="absolute top-[40%] right-[25%] border-2 border-warning w-24 h-32 rounded-sm shadow-[0_0_15px_rgba(245,158,11,0.5)]"
            >
              <span
                class="absolute -top-6 left-1/2 -translate-x-1/2 bg-warning text-white text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap"
                >ANOMALY DETECTED</span
              >
            </div>

            <div class="absolute top-4 left-4 flex gap-2">
              <div
                class="bg-danger text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 shadow-md"
              >
                <span
                  class="w-2 h-2 rounded-full bg-white animate-pulse"
                ></span>
                LIVE
              </div>
              <div
                class="bg-gray-900/60 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm"
              >
                Camera 02
              </div>
            </div>
          </div>

          <div class="h-48 bg-white dark:bg-surface-dark p-5 overflow-y-auto">
            <h4
              class="text-xs font-bold text-gray-500 flex items-center gap-2 mb-4 uppercase tracking-wider"
            >
              <span class="material-icons-outlined text-sm">history</span>
              Session Log
            </h4>
            <div
              id="modal-ai-log"
              class="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent"
            ></div>
          </div>
        </div>

        <div
          class="w-full md:w-[40%] bg-white dark:bg-surface-dark p-6 flex flex-col"
        >
          <div class="flex justify-between items-start mb-6">
            <div>
              <h2
                id="modal-student-id"
                class="text-2xl font-bold text-gray-900 dark:text-white"
              >
                STU----
              </h2>
              <div class="flex items-center gap-2 mt-1">
                <span
                  class="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded font-medium"
                  >Session Room 1</span
                >
              </div>
            </div>
            <button
              onclick="closeModal('student-modal')"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
            >
              <span class="material-icons-outlined pointer-events-none"
                >close</span
              >
            </button>
          </div>

          <div
            id="modal-warning-banner"
            class="bg-amber-50 dark:bg-amber-900/10 border border-warning/30 rounded-xl p-4 mb-8"
          >
            <h4
              class="font-bold text-amber-700 dark:text-amber-500 flex items-center gap-2 mb-1 text-sm"
            >
              <span class="material-icons-outlined text-warning text-lg"
                >warning_amber</span
              >
              Suspicious Activity Flagged
            </h4>
            <p
              class="text-xs text-amber-600/80 dark:text-amber-400/80 pl-7 leading-relaxed"
            >
              System detected unauthorized activity. Proctor review recommended
              immediately.
            </p>
          </div>

          <div class="mt-auto space-y-3">
            <h4
              class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3"
            >
              Proctor Actions
            </h4>
            <button
              onclick="
                executeAction('Warning Issued to Student!', 'student-modal')
              "
              class="w-full py-3 rounded-lg border border-border-light dark:border-border-dark font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-2 transition-colors"
            >
              <span class="material-icons-outlined text-lg pointer-events-none"
                >campaign</span
              >
              Issue First Warning
            </button>
            <button
              onclick="
                executeAction(
                  'Student Suspended Successfully!',
                  'student-modal',
                )
              "
              class="w-full py-3 rounded-lg bg-warning hover:bg-amber-600 text-white font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <span class="material-icons-outlined text-lg pointer-events-none"
                >pause_circle</span
              >
              Suspend Student
            </button>
            <button
              onclick="
                executeAction(
                  'Student Expelled from Examination!',
                  'student-modal',
                )
              "
              class="w-full py-3 rounded-lg bg-danger hover:bg-red-600 text-white font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <span class="material-icons-outlined text-lg pointer-events-none"
                >person_off</span
              >
              Expel Student
            </button>
          </div>
        </div>
      </div>
    </div>

    <script src="../scripts/component-loader.js"></script>

    <script>
      function openModal(modalId) {
        document.getElementById(modalId).classList.remove("hidden");
      }
      function closeModal(modalId) {
        document.getElementById(modalId).classList.add("hidden");
      }

      // Smart Dynamic Modal Logic
      function openStudentModal(studentId, status) {
        document.getElementById("modal-student-id").innerText = studentId;

        const boundingBox = document.getElementById("modal-bounding-box");
        const warningBanner = document.getElementById("modal-warning-banner");
        const aiLog = document.getElementById("modal-ai-log");

        if (status === "vision") {
          boundingBox.classList.remove("hidden");
          boundingBox.innerHTML = `<span class="absolute -top-6 left-1/2 -translate-x-1/2 bg-warning text-white text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">SMARTPHONE DETECTED</span>`;
          warningBanner.classList.remove("hidden");
          aiLog.innerHTML = `<div class="relative flex items-center justify-between group pl-8"><span class="absolute left-0 w-5 h-5 rounded-full border-4 border-white dark:border-surface-dark bg-warning"></span><div><h5 class="font-bold text-gray-900 dark:text-white text-sm">Smartphone Detected</h5><p class="text-xs text-gray-500">Confidence: 94%</p></div></div>`;
        } else if (status === "audio") {
          boundingBox.classList.add("hidden");
          warningBanner.classList.remove("hidden");
          aiLog.innerHTML = `<div class="relative flex items-center justify-between group pl-8"><span class="absolute left-0 w-5 h-5 rounded-full border-4 border-white dark:border-surface-dark bg-warning"></span><div><h5 class="font-bold text-gray-900 dark:text-white text-sm">Multiple Voices Detected</h5><p class="text-xs text-gray-500">Confidence: 91%</p></div></div>`;
        }

        openModal("student-modal");
      }

      function executeAction(message, modalId) {
        alert(message);
        closeModal(modalId);
        // In a real app, this would also dismiss the alert from the feed or change its visual state to "Notified"
      }
    </script>
  </body>
</html>


frontend/pages/audit-log-page.html

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta content="width=device-width, initial-scale=1.0" name="viewport" />
    <title>Audit Log | ExamNexus</title>
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <link
      href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined"
      rel="stylesheet"
    />
    <link
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
      rel="stylesheet"
    />

    <script>
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              primary: "#FF5722",
              secondary: "#10B981",
              danger: "#EF4444",
              warning: "#F59E0B",
              "background-light": "#F9FAFB",
              "background-dark": "#111827",
              "surface-light": "#FFFFFF",
              "surface-dark": "#1F2937",
              "text-light": "#1F2937",
              "text-dark": "#F3F4F6",
              "border-light": "#E5E7EB",
              "border-dark": "#374151",
            },
            fontFamily: {
              sans: ["Inter", "sans-serif"],
            },
            borderRadius: {
              DEFAULT: "0.5rem",
            },
          },
        },
      };
    </script>
    <style>
      ::-webkit-scrollbar {
        width: 6px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
      }
      .dark ::-webkit-scrollbar-thumb {
        background: #475569;
      }

      .confidence-bar {
        height: 6px;
        border-radius: 3px;
        background-color: #e5e7eb;
        overflow: hidden;
        width: 80px;
      }
      .dark .confidence-bar {
        background-color: #374151;
      }
      .confidence-fill {
        height: 100%;
        border-radius: 3px;
      }

      .toggle-switch input:checked + div {
        background-color: #ff5722;
      }
      .toggle-switch input:checked + div::after {
        transform: translateX(100%);
        border-color: white;
      }
    </style>
  </head>
  <body
    class="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-sans antialiased h-screen overflow-hidden flex transition-colors duration-200 relative"
  >
    <div id="sidebar-placeholder"></div>

    <main class="flex-1 flex flex-col h-full overflow-hidden relative">
      <header
        class="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark h-20 px-8 flex items-center justify-between z-10 shrink-0"
      >
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">
            Audit Log
          </h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Monitoring real-time AI-detected anomalies
          </p>
        </div>
        <div class="flex items-center gap-3">
          <button
            onclick="alert('Exporting audit log to CSV...')"
            class="bg-white dark:bg-gray-800 border border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            <span class="material-symbols-outlined text-sm">download</span>
            Export CSV
          </button>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto p-8">
        <div class="max-w-6xl mx-auto space-y-6">
          <div
            class="flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div class="flex items-center gap-6 flex-1">
              <div class="relative w-full max-w-md">
                <span
                  class="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg"
                  >search</span
                >
                <input
                  id="auditSearch"
                  class="pl-10 pr-4 py-2 w-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none transition-all"
                  placeholder="Search Student ID, event type..."
                  type="text"
                />
              </div>

              <div class="flex items-center gap-6">
                <label class="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    id="filter-high-conf"
                    class="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded-full focus:ring-primary dark:focus:ring-primary dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 transition-colors"
                  />
                  <span
                    class="text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors leading-tight"
                    >High Confidence<br /><span class="text-xs text-gray-400"
                      >(>90%)</span
                    ></span
                  >
                </label>

                <label class="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked
                    id="filter-unresolved"
                    class="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:focus:ring-primary dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 transition-colors"
                  />
                  <span
                    class="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors"
                    >Unresolved Only</span
                  >
                </label>
              </div>
            </div>

            <div
              class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 shrink-0"
            >
              <span id="top-stats-text"
                >Showing
                <strong class="text-gray-900 dark:text-white">0</strong>
                events</span
              >
              <span>•</span>
              <span>Last updated: 10:45:30 AM</span>
            </div>
          </div>

          <div
            class="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden"
          >
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr
                    class="bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark"
                  >
                    <th
                      class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32"
                    >
                      Timestamp
                    </th>
                    <th
                      class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      Student ID
                    </th>
                    <th
                      class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      Event Type
                    </th>
                    <th
                      class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      Confidence %
                    </th>
                    <th
                      class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24 text-center"
                    >
                      Status
                    </th>
                    <th
                      class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      Invigilator Action
                    </th>
                    <th
                      class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center w-20"
                    >
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody
                  class="divide-y divide-border-light dark:border-border-dark"
                  id="auditTableBody"
                >
                  <tr
                    class="audit-row hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    data-confidence="94"
                    data-resolved="false"
                  >
                    <td
                      class="relative px-6 py-5 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white"
                    >
                      <div
                        class="absolute left-0 top-0 bottom-0 w-1 bg-danger"
                      ></div>
                      10:45:22 AM
                    </td>
                    <td
                      class="px-6 py-5 whitespace-nowrap text-sm font-bold text-gray-700 dark:text-gray-300"
                    >
                      STU-204
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap">
                      <span
                        class="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-bold px-2.5 py-1 rounded-full"
                        >Phone Detected</span
                      >
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap">
                      <div class="flex items-center gap-3">
                        <div class="confidence-bar">
                          <div
                            class="confidence-fill bg-danger"
                            style="width: 94%"
                          ></div>
                        </div>
                        <span class="text-sm font-bold text-danger">94%</span>
                      </div>
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap text-center">
                      <label
                        class="toggle-switch relative inline-flex items-center cursor-pointer justify-center"
                      >
                        <input type="checkbox" class="sr-only peer" />
                        <div
                          class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600"
                        ></div>
                      </label>
                    </td>
                    <td
                      class="px-6 py-5 whitespace-nowrap text-sm font-medium text-gray-400 italic"
                    >
                      Awaiting intervention...
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap text-center">
                      <button
                        onclick="openStudentModal('STU-204', 'vision')"
                        class="text-gray-400 hover:text-primary transition-colors p-1 rounded-md hover:bg-orange-50 dark:hover:bg-orange-900/20"
                        title="View Details"
                      >
                        <span class="material-symbols-outlined text-lg"
                          >visibility</span
                        >
                      </button>
                    </td>
                  </tr>

                  <tr
                    class="audit-row hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    data-confidence="91"
                    data-resolved="true"
                  >
                    <td
                      class="px-6 py-5 whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-400"
                    >
                      10:42:15 AM
                    </td>
                    <td
                      class="px-6 py-5 whitespace-nowrap text-sm font-bold text-gray-700 dark:text-gray-300"
                    >
                      STU-209
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap">
                      <span
                        class="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-bold px-2.5 py-1 rounded-full"
                        >Talking</span
                      >
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap">
                      <div class="flex items-center gap-3">
                        <div class="confidence-bar">
                          <div
                            class="confidence-fill bg-warning"
                            style="width: 91%"
                          ></div>
                        </div>
                        <span class="text-sm font-bold text-gray-500">91%</span>
                      </div>
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap text-center">
                      <label
                        class="toggle-switch relative inline-flex items-center cursor-pointer justify-center"
                      >
                        <input type="checkbox" checked class="sr-only peer" />
                        <div
                          class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600"
                        ></div>
                      </label>
                    </td>
                    <td
                      class="px-6 py-5 whitespace-nowrap text-sm font-bold text-secondary flex items-center gap-1.5"
                    >
                      <span class="material-symbols-outlined text-base"
                        >check_circle</span
                      >
                      Dismissed
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap text-center">
                      <button
                        onclick="openStudentModal('STU-209', 'audio')"
                        class="text-gray-400 hover:text-primary transition-colors p-1 rounded-md hover:bg-orange-50 dark:hover:bg-orange-900/20"
                        title="View Details"
                      >
                        <span class="material-symbols-outlined text-lg"
                          >visibility</span
                        >
                      </button>
                    </td>
                  </tr>

                  <tr
                    class="audit-row hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    data-confidence="88"
                    data-resolved="false"
                  >
                    <td
                      class="px-6 py-5 whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-400"
                    >
                      10:38:50 AM
                    </td>
                    <td
                      class="px-6 py-5 whitespace-nowrap text-sm font-bold text-gray-700 dark:text-gray-300"
                    >
                      STU-204
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap">
                      <span
                        class="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-bold px-2.5 py-1 rounded-full"
                        >Multiple People</span
                      >
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap">
                      <div class="flex items-center gap-3">
                        <div class="confidence-bar">
                          <div
                            class="confidence-fill bg-danger"
                            style="width: 88%"
                          ></div>
                        </div>
                        <span class="text-sm font-bold text-danger">88%</span>
                      </div>
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap text-center">
                      <label
                        class="toggle-switch relative inline-flex items-center cursor-pointer justify-center"
                      >
                        <input type="checkbox" class="sr-only peer" />
                        <div
                          class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600"
                        ></div>
                      </label>
                    </td>
                    <td
                      class="px-6 py-5 whitespace-nowrap text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5"
                    >
                      <span class="material-symbols-outlined text-base"
                        >notifications_active</span
                      >
                      Student Notified
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap text-center">
                      <button
                        onclick="openStudentModal('STU-204', 'vision')"
                        class="text-gray-400 hover:text-primary transition-colors p-1 rounded-md hover:bg-orange-50 dark:hover:bg-orange-900/20"
                        title="View Details"
                      >
                        <span class="material-symbols-outlined text-lg"
                          >visibility</span
                        >
                      </button>
                    </td>
                  </tr>

                  <tr
                    class="audit-row hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    data-confidence="65"
                    data-resolved="true"
                  >
                    <td
                      class="px-6 py-5 whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-400"
                    >
                      10:35:12 AM
                    </td>
                    <td
                      class="px-6 py-5 whitespace-nowrap text-sm font-bold text-gray-700 dark:text-gray-300"
                    >
                      STU-215
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap">
                      <span
                        class="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold px-2.5 py-1 rounded-full"
                        >Looking Away</span
                      >
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap">
                      <div class="flex items-center gap-3">
                        <div class="confidence-bar">
                          <div
                            class="confidence-fill bg-blue-500"
                            style="width: 65%"
                          ></div>
                        </div>
                        <span class="text-sm font-bold text-gray-500">65%</span>
                      </div>
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap text-center">
                      <label
                        class="toggle-switch relative inline-flex items-center cursor-pointer justify-center"
                      >
                        <input type="checkbox" checked class="sr-only peer" />
                        <div
                          class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600"
                        ></div>
                      </label>
                    </td>
                    <td
                      class="px-6 py-5 whitespace-nowrap text-sm font-bold text-secondary flex items-center gap-1.5"
                    >
                      <span class="material-symbols-outlined text-base"
                        >check_circle</span
                      >
                      Dismissed
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap text-center">
                      <button
                        onclick="alert('Viewing older log details...')"
                        class="text-gray-400 hover:text-primary transition-colors p-1 rounded-md hover:bg-orange-50 dark:hover:bg-orange-900/20"
                        title="View Details"
                      >
                        <span class="material-symbols-outlined text-lg"
                          >visibility</span
                        >
                      </button>
                    </td>
                  </tr>

                  <tr
                    class="audit-row hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    data-confidence="89"
                    data-resolved="false"
                  >
                    <td
                      class="px-6 py-5 whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-400"
                    >
                      10:30:05 AM
                    </td>
                    <td
                      class="px-6 py-5 whitespace-nowrap text-sm font-bold text-gray-700 dark:text-gray-300"
                    >
                      STU-210
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap">
                      <span
                        class="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 text-xs font-bold px-2.5 py-1 rounded-full"
                        >Audio Anomaly</span
                      >
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap">
                      <div class="flex items-center gap-3">
                        <div class="confidence-bar">
                          <div
                            class="confidence-fill bg-warning"
                            style="width: 89%"
                          ></div>
                        </div>
                        <span class="text-sm font-bold text-gray-500">89%</span>
                      </div>
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap text-center">
                      <label
                        class="toggle-switch relative inline-flex items-center cursor-pointer justify-center"
                      >
                        <input type="checkbox" class="sr-only peer" />
                        <div
                          class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600"
                        ></div>
                      </label>
                    </td>
                    <td
                      class="px-6 py-5 whitespace-nowrap text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5"
                    >
                      <span class="material-symbols-outlined text-base"
                        >flag</span
                      >
                      Flagged for Review
                    </td>
                    <td class="px-6 py-5 whitespace-nowrap text-center">
                      <button
                        onclick="alert('Viewing older log details...')"
                        class="text-gray-400 hover:text-primary transition-colors p-1 rounded-md hover:bg-orange-50 dark:hover:bg-orange-900/20"
                        title="View Details"
                      >
                        <span class="material-symbols-outlined text-lg"
                          >visibility</span
                        >
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              class="bg-white dark:bg-surface-dark px-6 py-4 border-t border-border-light dark:border-border-dark flex items-center justify-between"
            >
              <p
                id="bottom-stats-text"
                class="text-sm text-gray-500 dark:text-gray-400"
              >
                Showing
                <strong class="text-gray-900 dark:text-white">0</strong> entries
              </p>
              <div class="flex items-center gap-1.5">
                <button
                  class="w-8 h-8 flex items-center justify-center rounded border border-border-light dark:border-border-dark text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  disabled
                >
                  <span class="material-symbols-outlined text-sm"
                    >chevron_left</span
                  >
                </button>
                <button
                  class="w-8 h-8 flex items-center justify-center rounded bg-primary text-white text-sm font-bold shadow-sm"
                >
                  1
                </button>
                <button
                  class="w-8 h-8 flex items-center justify-center rounded border border-border-light dark:border-border-dark text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  disabled
                >
                  <span class="material-symbols-outlined text-sm"
                    >chevron_right</span
                  >
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <div
      id="student-modal"
      class="hidden fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm transition-all duration-300 p-4"
    >
      <div
        class="bg-white dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col md:flex-row overflow-hidden max-h-[90vh]"
      >
        <div
          class="w-full md:w-[60%] flex flex-col border-r border-border-light dark:border-border-dark"
        >
          <div
            class="relative flex-1 bg-[#dcd0c3] min-h-[300px] flex items-center justify-center overflow-hidden"
          >
            <img
              src="https://i.pravatar.cc/600?img=11"
              class="object-cover w-full h-full opacity-80 mix-blend-multiply"
              alt="Student Feed"
            />

            <div
              id="modal-bounding-box"
              class="absolute top-[40%] right-[25%] border-2 border-warning w-24 h-32 rounded-sm shadow-[0_0_15px_rgba(245,158,11,0.5)]"
            >
              <span
                class="absolute -top-6 left-1/2 -translate-x-1/2 bg-warning text-white text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap"
                >ANOMALY DETECTED</span
              >
            </div>

            <div class="absolute top-4 left-4 flex gap-2">
              <div
                class="bg-gray-900/60 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm"
              >
                Snapshot Review
              </div>
            </div>
          </div>

          <div class="h-48 bg-white dark:bg-surface-dark p-5 overflow-y-auto">
            <h4
              class="text-xs font-bold text-gray-500 flex items-center gap-2 mb-4 uppercase tracking-wider"
            >
              <span class="material-icons-outlined text-sm">history</span> Event
              Log
            </h4>
            <div
              id="modal-ai-log"
              class="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent"
            ></div>
          </div>
        </div>

        <div
          class="w-full md:w-[40%] bg-white dark:bg-surface-dark p-6 flex flex-col"
        >
          <div class="flex justify-between items-start mb-6">
            <div>
              <h2
                id="modal-student-id"
                class="text-2xl font-bold text-gray-900 dark:text-white"
              >
                STU----
              </h2>
              <div class="flex items-center gap-2 mt-1">
                <span
                  class="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded font-medium"
                  >Historical Record</span
                >
              </div>
            </div>
            <button
              onclick="closeModal('student-modal')"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
            >
              <span class="material-icons-outlined pointer-events-none"
                >close</span
              >
            </button>
          </div>

          <div class="mt-auto space-y-3">
            <h4
              class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3"
            >
              Audit Actions
            </h4>
            <button
              onclick="
                executeAction('Status updated to Resolved', 'student-modal')
              "
              class="w-full py-3 rounded-lg border border-border-light dark:border-border-dark font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-2 transition-colors"
            >
              <span class="material-icons-outlined text-lg pointer-events-none"
                >check_circle</span
              >
              Mark as Resolved
            </button>
            <button
              onclick="
                executeAction(
                  'Flag escalated to Administration',
                  'student-modal',
                )
              "
              class="w-full py-3 rounded-lg bg-danger hover:bg-red-600 text-white font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <span class="material-icons-outlined text-lg pointer-events-none"
                >flag</span
              >
              Escalate Issue
            </button>
          </div>
        </div>
      </div>
    </div>

    <script src="../scripts/component-loader.js"></script>

    <script>
      // Modal Logic
      function openModal(modalId) {
        document.getElementById(modalId).classList.remove("hidden");
      }
      function closeModal(modalId) {
        document.getElementById(modalId).classList.add("hidden");
      }

      function openStudentModal(studentId, status) {
        document.getElementById("modal-student-id").innerText = studentId;
        const boundingBox = document.getElementById("modal-bounding-box");
        const aiLog = document.getElementById("modal-ai-log");

        if (status === "vision") {
          boundingBox.classList.remove("hidden");
          boundingBox.innerHTML = `<span class="absolute -top-6 left-1/2 -translate-x-1/2 bg-warning text-white text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">ANOMALY DETECTED</span>`;
          aiLog.innerHTML = `<div class="relative flex items-center justify-between group pl-8"><span class="absolute left-0 w-5 h-5 rounded-full border-4 border-white dark:border-surface-dark bg-warning"></span><div><h5 class="font-bold text-gray-900 dark:text-white text-sm">Visual Anomaly Logged</h5><p class="text-xs text-gray-500">Historical Snapshot</p></div></div>`;
        } else if (status === "audio") {
          boundingBox.classList.add("hidden");
          aiLog.innerHTML = `<div class="relative flex items-center justify-between group pl-8"><span class="absolute left-0 w-5 h-5 rounded-full border-4 border-white dark:border-surface-dark bg-warning"></span><div><h5 class="font-bold text-gray-900 dark:text-white text-sm">Audio Anomaly Logged</h5><p class="text-xs text-gray-500">Historical Audio Clip</p></div></div>`;
        }
        openModal("student-modal");
      }

      function executeAction(message, modalId) {
        alert(message);
        closeModal(modalId);
      }

      // --- Smart Filtering Logic ---
      const searchInput = document.getElementById("auditSearch");
      const filterHighConf = document.getElementById("filter-high-conf");
      const filterUnresolved = document.getElementById("filter-unresolved");
      const rows = document.querySelectorAll(".audit-row");
      const topStats = document.getElementById("top-stats-text");
      const bottomStats = document.getElementById("bottom-stats-text");

      function applyFilters() {
        const term = searchInput.value.toLowerCase();
        const highConfOnly = filterHighConf.checked;
        const unresolvedOnly = filterUnresolved.checked;
        let visibleCount = 0;

        rows.forEach((row) => {
          const text = row.innerText.toLowerCase();
          const conf = parseInt(row.getAttribute("data-confidence") || "0");
          const isResolved = row.getAttribute("data-resolved") === "true";

          let matchSearch = text.includes(term);
          let matchConf = highConfOnly ? conf > 90 : true;
          let matchUnresolved = unresolvedOnly ? !isResolved : true;

          if (matchSearch && matchConf && matchUnresolved) {
            row.style.display = "table-row";
            visibleCount++;
          } else {
            row.style.display = "none";
          }
        });

        // Update Dynamic Numbers
        if (topStats)
          topStats.innerHTML = `Showing <strong class="text-gray-900 dark:text-white">${visibleCount}</strong> events`;
        if (bottomStats)
          bottomStats.innerHTML = `Showing <strong class="text-gray-900 dark:text-white">${visibleCount}</strong> of <strong class="text-gray-900 dark:text-white">${rows.length}</strong> total entries`;
      }

      // Attach Event Listeners
      searchInput.addEventListener("input", applyFilters);
      filterHighConf.addEventListener("change", applyFilters);
      filterUnresolved.addEventListener("change", applyFilters);

      // Run once on load to set initial numbers based on default checked states
      applyFilters();
    </script>
  </body>
</html>


frontend/pages/dashboard-page.html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta content="width=device-width, initial-scale=1.0" name="viewport" />
    <title>Proctor Console Dashboard</title>
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <link
      href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined"
      rel="stylesheet"
    />
    <link
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
      rel="stylesheet"
    />

    <script>
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              primary: "#FF5722",
              secondary: "#10B981",
              danger: "#EF4444",
              warning: "#F59E0B",
              "background-light": "#F9FAFB",
              "background-dark": "#111827",
              "surface-light": "#FFFFFF",
              "surface-dark": "#1F2937",
              "text-light": "#1F2937",
              "text-dark": "#F3F4F6",
              "border-light": "#E5E7EB",
              "border-dark": "#374151",
            },
            fontFamily: {
              sans: ["Inter", "sans-serif"],
            },
            borderRadius: {
              DEFAULT: "0.5rem",
            },
          },
        },
      };
    </script>
  </head>
  <body
    class="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-sans antialiased h-screen overflow-hidden flex transition-colors duration-200 relative"
  >
    <aside
      id="sidebar-placeholder"
      class="w-64 flex-shrink-0 bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark h-full"
    ></aside>

    <main class="flex-1 flex flex-col h-full overflow-hidden relative">
      <div id="header-placeholder"></div>

      <div class="flex-1 overflow-y-auto p-8 relative">
        <div
          id="notification-dropdown"
          class="hidden absolute top-0 right-8 mt-2 w-80 bg-white dark:bg-surface-dark rounded-xl shadow-lg border border-border-light dark:border-border-dark z-40 overflow-hidden"
        >
          <div
            class="p-4 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-gray-50 dark:bg-gray-800"
          >
            <h3 class="font-bold text-gray-900 dark:text-white">AI Alerts</h3>
            <span
              class="bg-warning text-white text-xs font-bold px-2 py-0.5 rounded-full"
              >2 New</span
            >
          </div>
          <div
            class="divide-y divide-border-light dark:divide-border-dark max-h-64 overflow-y-auto"
          >
            <div
              class="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              onclick="openStudentModal('STU-204', 'vision')"
            >
              <div class="flex items-start gap-3">
                <span class="material-icons-outlined text-warning mt-0.5"
                  >visibility</span
                >
                <div>
                  <p class="text-sm font-bold text-gray-900 dark:text-white">
                    Vision Flag: STU-204
                  </p>
                  <p class="text-xs text-gray-500">
                    Suspicious object detected (Smartphone). Conf: 94%
                  </p>
                </div>
              </div>
            </div>
            <div
              class="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              onclick="openStudentModal('STU-209', 'audio')"
            >
              <div class="flex items-start gap-3">
                <span class="material-icons-outlined text-warning mt-0.5"
                  >mic</span
                >
                <div>
                  <p class="text-sm font-bold text-gray-900 dark:text-white">
                    Audio Flag: STU-209
                  </p>
                  <p class="text-xs text-gray-500">
                    Multiple voices detected. Conf: 91%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div
            class="bg-surface-light dark:bg-surface-dark p-5 rounded-xl border border-border-light dark:border-border-dark shadow-sm"
          >
            <h3
              class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2"
            >
              Total Students
            </h3>
            <div class="flex items-baseline justify-between">
              <span class="text-3xl font-bold text-gray-900 dark:text-white"
                >24</span
              ><span
                class="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold px-2.5 py-1 rounded-md"
                >100% Capacity</span
              >
            </div>
          </div>
          <div
            class="bg-surface-light dark:bg-surface-dark p-5 rounded-xl border border-border-light dark:border-border-dark shadow-sm"
          >
            <h3
              class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2"
            >
              Active
            </h3>
            <div class="flex items-baseline justify-between">
              <span class="text-3xl font-bold text-secondary">22</span
              ><span
                class="bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-semibold px-2.5 py-1 rounded-md"
                >+2.5%</span
              >
            </div>
          </div>
          <div
            class="bg-surface-light dark:bg-surface-dark p-5 rounded-xl border border-border-light dark:border-border-dark shadow-sm"
          >
            <h3
              class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2"
            >
              Paused
            </h3>
            <div class="flex items-baseline justify-between">
              <span class="text-3xl font-bold text-gray-400 dark:text-gray-500"
                >0</span
              ><span
                class="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold px-2.5 py-1 rounded-md"
                >0%</span
              >
            </div>
          </div>
          <div
            class="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-xl border border-amber-200 dark:border-amber-800 shadow-sm relative overflow-hidden"
          >
            <h3
              class="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wide mb-2"
            >
              AI Alerts
            </h3>
            <div class="flex items-baseline justify-between relative z-10">
              <span
                class="text-3xl font-bold text-amber-600 dark:text-amber-500"
                >2</span
              ><span
                class="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-bold px-3 py-1 rounded-md"
                >Action Needed</span
              >
            </div>
          </div>
        </div>

        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
        >
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">
            Student Monitoring Grid
          </h2>
          <div class="flex items-center gap-3">
            <div class="relative">
              <span
                class="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg"
                >search</span
              >
              <input
                id="studentSearch"
                class="pl-10 pr-4 py-2 w-64 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none transition-all"
                placeholder="Search student ID..."
                type="text"
              />
            </div>
            <button
              class="p-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
            >
              <span class="material-icons-outlined text-lg">filter_list</span>
            </button>
          </div>
        </div>

        <div
          id="studentGrid"
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-12"
        >
          <div
            class="student-card bg-white dark:bg-surface-dark rounded-xl p-4 border-2 border-warning shadow-sm relative cursor-pointer hover:shadow-md transition-shadow"
            onclick="openStudentModal('STU-204', 'vision')"
          >
            <div
              class="absolute top-3 right-3 w-2 h-2 bg-warning rounded-full animate-pulse"
            ></div>
            <div class="flex items-start gap-4 mb-4">
              <div
                class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 ring-2 ring-gray-100 dark:ring-gray-700"
              >
                <span class="material-symbols-outlined text-3xl">person</span>
              </div>
              <div>
                <span class="text-[10px] font-bold text-gray-400 uppercase"
                  >A-12</span
                >
                <h4
                  class="student-id font-bold text-gray-900 dark:text-white text-lg leading-tight"
                >
                  STU-204
                </h4>
              </div>
            </div>
            <div
              class="grid grid-cols-2 gap-2 text-xs border-t border-warning/30 pt-3"
            >
              <div>
                <span class="block font-bold text-warning uppercase"
                  >AI Flag:</span
                ><span
                  class="block font-semibold text-gray-700 dark:text-gray-300"
                  >VISION</span
                >
              </div>
              <div class="text-right">
                <span class="block font-bold text-warning">74%</span
                ><span class="block font-semibold text-gray-500">CONF.</span>
              </div>
            </div>
          </div>

          <div
            class="student-card bg-white dark:bg-surface-dark rounded-xl p-4 border border-border-light dark:border-border-dark shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onclick="openStudentModal('STU-205', 'normal')"
          >
            <div class="flex items-start gap-4 mb-6">
              <div
                class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 ring-2 ring-gray-100 dark:ring-gray-700"
              >
                <span class="material-symbols-outlined text-3xl">person</span>
              </div>
              <div>
                <span class="text-[10px] font-bold text-gray-400 uppercase"
                  >A-13</span
                >
                <h4
                  class="student-id font-bold text-gray-900 dark:text-white text-lg leading-tight"
                >
                  STU-205
                </h4>
              </div>
            </div>
            <div class="flex items-center gap-2 mt-auto">
              <span class="w-2 h-2 bg-secondary rounded-full"></span
              ><span
                class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
                >Active Monitoring</span
              >
            </div>
          </div>

          <div
            class="student-card bg-white dark:bg-surface-dark rounded-xl p-4 border-2 border-warning shadow-sm relative cursor-pointer hover:shadow-md transition-shadow"
            onclick="openStudentModal('STU-209', 'audio')"
          >
            <div
              class="absolute top-3 right-3 w-2 h-2 bg-warning rounded-full animate-pulse"
            ></div>
            <div class="flex items-start gap-4 mb-4">
              <div
                class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 ring-2 ring-gray-100 dark:ring-gray-700"
              >
                <span class="material-symbols-outlined text-3xl">person</span>
              </div>
              <div>
                <span class="text-[10px] font-bold text-gray-400 uppercase"
                  >B-01</span
                >
                <h4
                  class="student-id font-bold text-gray-900 dark:text-white text-lg leading-tight"
                >
                  STU-209
                </h4>
              </div>
            </div>
            <div
              class="grid grid-cols-2 gap-2 text-xs border-t border-warning/30 pt-3"
            >
              <div>
                <span class="block font-bold text-warning uppercase"
                  >AI Flag:</span
                ><span
                  class="block font-semibold text-gray-700 dark:text-gray-300"
                  >AUDIO</span
                >
              </div>
              <div class="text-right">
                <span class="block font-bold text-warning">91%</span
                ><span class="block font-semibold text-gray-500">CONF.</span>
              </div>
            </div>
          </div>

          <div
            class="student-card bg-white dark:bg-surface-dark rounded-xl p-4 border border-border-light dark:border-border-dark shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onclick="openStudentModal('STU-210', 'normal')"
          >
            <div class="flex items-start gap-4 mb-6">
              <div
                class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 ring-2 ring-gray-100 dark:ring-gray-700"
              >
                <span class="material-symbols-outlined text-3xl">person</span>
              </div>
              <div>
                <span class="text-[10px] font-bold text-gray-400 uppercase"
                  >B-02</span
                >
                <h4
                  class="student-id font-bold text-gray-900 dark:text-white text-lg leading-tight"
                >
                  STU-210
                </h4>
              </div>
            </div>
            <div class="flex items-center gap-2 mt-auto">
              <span class="w-2 h-2 bg-secondary rounded-full"></span
              ><span
                class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
                >Active Monitoring</span
              >
            </div>
          </div>

          <div
            class="student-card bg-white dark:bg-surface-dark rounded-xl p-4 border border-border-light dark:border-border-dark shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onclick="openStudentModal('STU-211', 'normal')"
          >
            <div class="flex items-start gap-4 mb-6">
              <div
                class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 ring-2 ring-gray-100 dark:ring-gray-700"
              >
                <span class="material-symbols-outlined text-3xl">person</span>
              </div>
              <div>
                <span class="text-[10px] font-bold text-gray-400 uppercase"
                  >B-03</span
                >
                <h4
                  class="student-id font-bold text-gray-900 dark:text-white text-lg leading-tight"
                >
                  STU-211
                </h4>
              </div>
            </div>
            <div class="flex items-center gap-2 mt-auto">
              <span class="w-2 h-2 bg-secondary rounded-full"></span
              ><span
                class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
                >Active Monitoring</span
              >
            </div>
          </div>

          <div
            class="student-card bg-white dark:bg-surface-dark rounded-xl p-4 border border-border-light dark:border-border-dark shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onclick="openStudentModal('STU-215', 'normal')"
          >
            <div class="flex items-start gap-4 mb-6">
              <div
                class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 ring-2 ring-gray-100 dark:ring-gray-700"
              >
                <span class="material-symbols-outlined text-3xl">person</span>
              </div>
              <div>
                <span class="text-[10px] font-bold text-gray-400 uppercase"
                  >C-10</span
                >
                <h4
                  class="student-id font-bold text-gray-900 dark:text-white text-lg leading-tight"
                >
                  STU-215
                </h4>
              </div>
            </div>
            <div class="flex items-center gap-2 mt-auto">
              <span class="w-2 h-2 bg-secondary rounded-full"></span
              ><span
                class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
                >Active Monitoring</span
              >
            </div>
          </div>

          <div
            class="student-card bg-white dark:bg-surface-dark rounded-xl p-4 border border-border-light dark:border-border-dark shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onclick="openStudentModal('STU-216', 'normal')"
          >
            <div class="flex items-start gap-4 mb-6">
              <div
                class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 ring-2 ring-gray-100 dark:ring-gray-700"
              >
                <span class="material-symbols-outlined text-3xl">person</span>
              </div>
              <div>
                <span class="text-[10px] font-bold text-gray-400 uppercase"
                  >C-11</span
                >
                <h4
                  class="student-id font-bold text-gray-900 dark:text-white text-lg leading-tight"
                >
                  STU-216
                </h4>
              </div>
            </div>
            <div class="flex items-center gap-2 mt-auto">
              <span class="w-2 h-2 bg-secondary rounded-full"></span
              ><span
                class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
                >Active Monitoring</span
              >
            </div>
          </div>

          <div
            class="student-card bg-white dark:bg-surface-dark rounded-xl p-4 border border-border-light dark:border-border-dark shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onclick="openStudentModal('STU-217', 'normal')"
          >
            <div class="flex items-start gap-4 mb-6">
              <div
                class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 ring-2 ring-gray-100 dark:ring-gray-700"
              >
                <span class="material-symbols-outlined text-3xl">person</span>
              </div>
              <div>
                <span class="text-[10px] font-bold text-gray-400 uppercase"
                  >C-12</span
                >
                <h4
                  class="student-id font-bold text-gray-900 dark:text-white text-lg leading-tight"
                >
                  STU-217
                </h4>
              </div>
            </div>
            <div class="flex items-center gap-2 mt-auto">
              <span class="w-2 h-2 bg-secondary rounded-full"></span
              ><span
                class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
                >Active Monitoring</span
              >
            </div>
          </div>

          <div
            class="bg-gray-50 dark:bg-surface-dark rounded-xl p-4 border border-dashed border-gray-300 dark:border-gray-700 flex flex-col justify-center h-full"
          >
            <div class="flex items-start gap-4 opacity-50 mb-6">
              <div
                class="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"
              ></div>
              <div class="space-y-2">
                <div
                  class="w-8 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                ></div>
                <div
                  class="w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                ></div>
                <span class="text-xs text-gray-400 italic">Loading...</span>
              </div>
            </div>
            <div class="flex items-center gap-2 mt-auto opacity-50">
              <span class="w-2 h-2 bg-gray-400 rounded-full"></span
              ><span
                class="text-[10px] font-bold text-gray-400 uppercase tracking-wide"
                >Connecting</span
              >
            </div>
          </div>
        </div>
      </div>
    </main>

    <div
      id="terminate-modal"
      class="hidden fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/40 dark:bg-gray-900/60 backdrop-blur-sm transition-all duration-300"
    >
      <div
        class="bg-white dark:bg-surface-dark rounded-2xl shadow-2xl max-w-lg w-full mx-4 border border-gray-100 dark:border-gray-700 overflow-hidden"
      >
        <div class="p-8 pb-6 text-center">
          <div
            class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-6"
          >
            <span class="material-icons-outlined text-3xl text-danger"
              >warning</span
            >
          </div>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Terminate Examination
          </h3>
          <p
            class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed px-4"
          >
            Are you sure you want to terminate this session for all students?
            This action
            <span class="font-bold text-danger">cannot be undone</span>.
          </p>
        </div>
        <div class="px-8 pb-8 space-y-3">
          <button
            onclick="
              executeAction(
                'Standard Exam Termination Complete!',
                'terminate-modal',
              )
            "
            class="w-full flex items-center justify-between p-4 rounded-xl border-2 border-transparent hover:border-secondary bg-gray-50 hover:bg-green-50 dark:bg-gray-800 dark:hover:bg-green-900/20 group transition-all duration-200"
          >
            <div class="flex items-center gap-4">
              <div
                class="w-10 h-10 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform"
              >
                <span class="material-icons-outlined text-secondary"
                  >check_circle</span
                >
              </div>
              <div class="text-left">
                <p
                  class="font-bold text-gray-900 dark:text-white group-hover:text-secondary transition-colors"
                >
                  Exam is Over
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Standard session completion
                </p>
              </div>
            </div>
            <span
              class="material-icons-outlined text-gray-400 group-hover:text-secondary group-hover:translate-x-1 transition-all"
              >arrow_forward</span
            >
          </button>
          <button
            onclick="
              executeAction(
                'Emergency Termination Initiated!',
                'terminate-modal',
              )
            "
            class="w-full flex items-center justify-between p-4 rounded-xl border-2 border-transparent hover:border-danger bg-gray-50 hover:bg-red-50 dark:bg-gray-800 dark:hover:bg-red-900/20 group transition-all duration-200"
          >
            <div class="flex items-center gap-4">
              <div
                class="w-10 h-10 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform"
              >
                <span class="material-icons-outlined text-danger"
                  >emergency_share</span
                >
              </div>
              <div class="text-left">
                <p
                  class="font-bold text-gray-900 dark:text-white group-hover:text-danger transition-colors"
                >
                  Emergency
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Immediate force termination
                </p>
              </div>
            </div>
            <span
              class="material-icons-outlined text-gray-400 group-hover:text-danger group-hover:translate-x-1 transition-all"
              >arrow_forward</span
            >
          </button>
        </div>
        <div
          class="bg-gray-50 dark:bg-gray-800/50 px-8 py-4 flex justify-center border-t border-gray-100 dark:border-gray-700"
        >
          <button
            onclick="closeModal('terminate-modal')"
            class="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <div
      id="student-modal"
      class="hidden fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm transition-all duration-300 p-4"
    >
      <div
        class="bg-white dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col md:flex-row overflow-hidden max-h-[90vh]"
      >
        <div
          class="w-full md:w-[60%] flex flex-col border-r border-border-light dark:border-border-dark"
        >
          <div
            class="relative flex-1 bg-[#dcd0c3] min-h-[300px] flex items-center justify-center overflow-hidden"
          >
            <img
              src="https://i.pravatar.cc/600?img=11"
              class="object-cover w-full h-full opacity-80 mix-blend-multiply"
              alt="Student Feed"
            />

            <div
              id="modal-bounding-box"
              class="absolute top-[40%] right-[25%] border-2 border-warning w-24 h-32 rounded-sm shadow-[0_0_15px_rgba(245,158,11,0.5)]"
            >
              <span
                class="absolute -top-6 left-1/2 -translate-x-1/2 bg-warning text-white text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap"
                >SMARTPHONE DETECTED</span
              >
            </div>

            <div class="absolute top-4 left-4 flex gap-2">
              <div
                class="bg-danger text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 shadow-md"
              >
                <span
                  class="w-2 h-2 rounded-full bg-white animate-pulse"
                ></span>
                LIVE
              </div>
              <div
                class="bg-gray-900/60 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm"
              >
                Camera 02
              </div>
            </div>
          </div>

          <div class="h-48 bg-white dark:bg-surface-dark p-5 overflow-y-auto">
            <h4
              class="text-xs font-bold text-gray-500 flex items-center gap-2 mb-4 uppercase tracking-wider"
            >
              <span class="material-icons-outlined text-sm">history</span>
              Session Log
            </h4>
            <div
              id="modal-ai-log"
              class="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent"
            ></div>
          </div>
        </div>

        <div
          class="w-full md:w-[40%] bg-white dark:bg-surface-dark p-6 flex flex-col"
        >
          <div class="flex justify-between items-start mb-6">
            <div>
              <h2
                id="modal-student-id"
                class="text-2xl font-bold text-gray-900 dark:text-white"
              >
                STU----
              </h2>
              <div class="flex items-center gap-2 mt-1">
                <span
                  class="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded font-medium"
                  >Session Room 1</span
                >
              </div>
            </div>
            <button
              onclick="closeModal('student-modal')"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
            >
              <span class="material-icons-outlined pointer-events-none"
                >close</span
              >
            </button>
          </div>

          <div
            id="modal-warning-banner"
            class="bg-amber-50 dark:bg-amber-900/10 border border-warning/30 rounded-xl p-4 mb-8"
          >
            <h4
              class="font-bold text-amber-700 dark:text-amber-500 flex items-center gap-2 mb-1 text-sm"
            >
              <span class="material-icons-outlined text-warning text-lg"
                >warning_amber</span
              >
              Suspicious Activity Flagged
            </h4>
            <p
              class="text-xs text-amber-600/80 dark:text-amber-400/80 pl-7 leading-relaxed"
            >
              System detected unauthorized activity. Proctor review recommended
              immediately.
            </p>
          </div>

          <div class="mb-auto">
            <h4
              class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3"
            >
              Exam Time Adjustment
            </h4>
            <div
              class="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-2 border border-gray-100 dark:border-gray-700"
            >
              <button
                onclick="adjustTime(-5)"
                class="px-3 py-1.5 rounded text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 shadow-sm text-sm font-medium transition-colors"
              >
                - 5 Min
              </button>
              <span
                id="modal-timer-display"
                class="font-mono font-bold text-gray-900 dark:text-white"
                >00:00:00</span
              >
              <button
                onclick="adjustTime(5)"
                class="px-3 py-1.5 rounded text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 shadow-sm text-sm font-medium transition-colors"
              >
                + 5 Min
              </button>
            </div>
          </div>

          <div class="mt-8 space-y-3">
            <h4
              class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3"
            >
              Proctor Actions
            </h4>
            <button
              onclick="
                executeAction('Warning Issued to Student!', 'student-modal')
              "
              class="w-full py-3 rounded-lg border border-border-light dark:border-border-dark font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-2 transition-colors"
            >
              <span class="material-icons-outlined text-lg pointer-events-none"
                >campaign</span
              >
              Issue First Warning
            </button>
            <button
              onclick="
                executeAction(
                  'Student Suspended Successfully!',
                  'student-modal',
                )
              "
              class="w-full py-3 rounded-lg bg-warning hover:bg-amber-600 text-white font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <span class="material-icons-outlined text-lg pointer-events-none"
                >pause_circle</span
              >
              Suspend Student
            </button>
            <button
              onclick="
                executeAction(
                  'Student Expelled from Examination!',
                  'student-modal',
                )
              "
              class="w-full py-3 rounded-lg bg-danger hover:bg-red-600 text-white font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <span class="material-icons-outlined text-lg pointer-events-none"
                >person_off</span
              >
              Expel Student
            </button>
          </div>
        </div>
      </div>
    </div>

    <script src="../scripts/component-loader.js"></script>

    <script>
      function openModal(modalId) {
        document.getElementById(modalId).classList.remove("hidden");
      }
      function closeModal(modalId) {
        document.getElementById(modalId).classList.add("hidden");
      }

      // Smart Dynamic Modal Logic
      function openStudentModal(studentId, status) {
        document.getElementById("modal-student-id").innerText = studentId;
        document
          .getElementById("notification-dropdown")
          .classList.add("hidden");
        document.getElementById("modal-timer-display").innerText =
          document.querySelector("header span.text-3xl.font-mono")?.innerText ||
          "00:00:00";

        const boundingBox = document.getElementById("modal-bounding-box");
        const warningBanner = document.getElementById("modal-warning-banner");
        const aiLog = document.getElementById("modal-ai-log");

        if (status === "vision") {
          boundingBox.classList.remove("hidden");
          boundingBox.innerHTML = `<span class="absolute -top-6 left-1/2 -translate-x-1/2 bg-warning text-white text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">SMARTPHONE DETECTED</span>`;
          warningBanner.classList.remove("hidden");
          aiLog.innerHTML = `<div class="relative flex items-center justify-between group pl-8"><span class="absolute left-0 w-5 h-5 rounded-full border-4 border-white dark:border-surface-dark bg-warning"></span><div><h5 class="font-bold text-gray-900 dark:text-white text-sm">Smartphone Detected</h5><p class="text-xs text-gray-500">Confidence: 94%</p></div></div>`;
        } else if (status === "audio") {
          boundingBox.classList.add("hidden");
          warningBanner.classList.remove("hidden");
          aiLog.innerHTML = `<div class="relative flex items-center justify-between group pl-8"><span class="absolute left-0 w-5 h-5 rounded-full border-4 border-white dark:border-surface-dark bg-warning"></span><div><h5 class="font-bold text-gray-900 dark:text-white text-sm">Multiple Voices Detected</h5><p class="text-xs text-gray-500">Confidence: 91%</p></div></div>`;
        } else {
          // NORMAL STUDENT
          boundingBox.classList.add("hidden");
          warningBanner.classList.add("hidden");
          aiLog.innerHTML = `<div class="relative flex items-center justify-between group pl-8"><span class="absolute left-0 w-5 h-5 rounded-full border-4 border-white dark:border-surface-dark bg-secondary"></span><div><h5 class="font-bold text-gray-900 dark:text-white text-sm">Active Monitoring</h5><p class="text-xs text-gray-500">No suspicious activity detected.</p></div></div>`;
        }

        openModal("student-modal");
      }

      function executeAction(message, modalId) {
        alert(message);
        closeModal(modalId);
      }

      let timerInterval;
      let totalSeconds = 0;
      let isTimerRunning = false;
      function updateTimerDisplay() {
        const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
        const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(
          2,
          "0",
        );
        const s = String(totalSeconds % 60).padStart(2, "0");
        const formattedTime = `${h}:${m}:${s}`;

        const timerElement = document.querySelector(
          "header span.text-3xl.font-mono",
        );
        if (timerElement) timerElement.innerText = formattedTime;
        const modalTimerElement = document.getElementById(
          "modal-timer-display",
        );
        if (modalTimerElement) modalTimerElement.innerText = formattedTime;
      }

      function adjustTime(minutes) {
        totalSeconds += minutes * 60;
        if (totalSeconds < 0) totalSeconds = 0;
        updateTimerDisplay();
      }

      const observer = new MutationObserver(() => {
        const timerElement = document.querySelector(
          "header span.text-3xl.font-mono",
        );
        if (
          timerElement &&
          timerElement.innerText !== "00:00:00" &&
          !isTimerRunning &&
          totalSeconds === 0
        ) {
          timerElement.innerText = "00:00:00";
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      function resetHeaderButtons() {
        document.querySelectorAll("header button").forEach((btn) => {
          if (["Start", "Pause", "Resume"].includes(btn.innerText.trim())) {
            btn.className =
              "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 px-5 py-2 rounded-md text-sm font-medium transition-colors";
          }
        });
      }

      document.addEventListener("click", function (e) {
        const target = e.target;
        const isBell =
          (target.classList.contains("material-icons-outlined") &&
            target.innerText.trim() === "notifications") ||
          (target.classList.contains("bg-danger") &&
            target.classList.contains("absolute"));
        const notifDropdown = document.getElementById("notification-dropdown");

        if (isBell) notifDropdown.classList.toggle("hidden");
        else if (!target.closest("#notification-dropdown"))
          notifDropdown.classList.add("hidden");

        const btn = target.closest("button");
        if (btn && btn.closest("header")) {
          const text = btn.innerText.trim();
          if (text === "Start") {
            resetHeaderButtons();
            btn.className =
              "bg-secondary hover:bg-emerald-600 text-white px-5 py-2 rounded-md text-sm font-medium shadow-sm transition-colors";
            if (!isTimerRunning) {
              totalSeconds = 0;
              updateTimerDisplay();
              isTimerRunning = true;
              clearInterval(timerInterval);
              timerInterval = setInterval(() => {
                totalSeconds++;
                updateTimerDisplay();
              }, 1000);
            }
          } else if (text === "Pause") {
            resetHeaderButtons();
            btn.className =
              "bg-danger hover:bg-red-600 text-white px-5 py-2 rounded-md text-sm font-medium shadow-sm transition-colors";
            if (isTimerRunning) {
              clearInterval(timerInterval);
              isTimerRunning = false;
            }
          } else if (text === "Resume") {
            resetHeaderButtons();
            btn.className =
              "bg-secondary hover:bg-emerald-600 text-white px-5 py-2 rounded-md text-sm font-medium shadow-sm transition-colors";
            if (!isTimerRunning) {
              isTimerRunning = true;
              timerInterval = setInterval(() => {
                totalSeconds++;
                updateTimerDisplay();
              }, 1000);
            }
          } else if (text === "Terminate") {
            clearInterval(timerInterval);
            isTimerRunning = false;
            openModal("terminate-modal");
          }
        }
      });

      document
        .getElementById("studentSearch")
        .addEventListener("input", function (e) {
          const term = e.target.value.toLowerCase();
          document.querySelectorAll(".student-card").forEach((card) => {
            const idEl = card.querySelector(".student-id");
            if (idEl)
              card.style.display = idEl.innerText.toLowerCase().includes(term)
                ? "block"
                : "none";
          });
        });
    </script>
  </body>
</html>



frontend/pages/exam-setup-page.html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta content="width=device-width, initial-scale=1.0" name="viewport" />
    <title>Exam Setup | ExamNexus</title>
    <script src="https://cdn.tailwindcss.com?plugins=forms,typography"></script>
    <script>
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              primary: "#FF5722",
              secondary: "#10B981",
              danger: "#EF4444",
              warning: "#F59E0B",
              "background-light": "#F9FAFB",
              "background-dark": "#111827",
              "surface-light": "#FFFFFF",
              "surface-dark": "#1F2937",
              "text-light": "#1F2937",
              "text-dark": "#F3F4F6",
              "border-light": "#E5E7EB",
              "border-dark": "#374151",
              "subtext-light": "#64748B",
              "subtext-dark": "#94A3B8",
            },
            fontFamily: {
              sans: ["Inter", "sans-serif"],
            },
            borderRadius: {
              DEFAULT: "0.5rem",
            },
          },
        },
      };
    </script>
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <link
      href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined"
      rel="stylesheet"
    />
    <link
      href="https://fonts.googleapis.com/icon?family=Material+Icons+Round"
      rel="stylesheet"
    />
    <link
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
      rel="stylesheet"
    />
    <style>
      body {
        font-family: "Inter", sans-serif;
      }
      ::-webkit-scrollbar {
        width: 6px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
      }
      .dark ::-webkit-scrollbar-thumb {
        background: #475569;
      }
    </style>
  </head>
  <body
    class="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark antialiased h-screen flex overflow-hidden transition-colors duration-200"
  >
    <aside
      id="sidebar-placeholder"
      class="w-64 flex-shrink-0 bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark h-full"
    ></aside>

    <main class="flex-1 flex flex-col h-full overflow-hidden">
      <header
        class="bg-background-light dark:bg-background-dark border-b border-transparent px-8 py-6 flex items-center justify-between shrink-0"
      >
        <div class="flex flex-col space-y-1">
          <nav
            class="flex items-center text-sm text-subtext-light dark:text-subtext-dark space-x-2"
          >
            <span
              class="hover:text-primary cursor-pointer transition-colors"
              onclick="window.location.href = 'dashboard-page.html'"
              >Dashboard</span
            >
            <span class="material-icons-round text-sm text-slate-400"
              >chevron_right</span
            >
            <span class="font-medium text-slate-900 dark:text-white"
              >Exam Setup</span
            >
            <span
              class="ml-2 px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-bold uppercase tracking-wide"
              >Draft</span
            >
          </nav>
        </div>
        <div class="flex items-center space-x-4">
          <button
            class="text-sm font-medium text-subtext-light dark:text-subtext-dark hover:text-slate-900 dark:hover:text-white transition-colors"
            onclick="alert('Draft Saved Successfully!')"
          >
            Save Draft
          </button>
          <button
            onclick="publishExam()"
            class="bg-primary hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium shadow-sm flex items-center transition-colors"
          >
            <span class="material-icons-round text-base mr-2">publish</span>
            Publish Exam
          </button>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto px-8 pb-10">
        <div class="mb-8">
          <h2 class="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Configure New Examination
          </h2>
          <p class="text-subtext-light dark:text-subtext-dark">
            Define your assessment parameters and security protocols.
          </p>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-7xl">
          <div
            class="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6 shadow-sm"
          >
            <div class="flex items-center space-x-3 mb-6">
              <div class="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <span class="material-icons-round text-primary">info</span>
              </div>
              <h3 class="text-lg font-bold text-slate-900 dark:text-white">
                Basic Exam Info
              </h3>
            </div>
            <div class="space-y-5">
              <div>
                <label
                  class="block text-xs font-bold text-subtext-light dark:text-subtext-dark uppercase tracking-wide mb-1.5"
                  >Exam Title</label
                >
                <input
                  id="examTitle"
                  class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                  placeholder="Enter exam title"
                  type="text"
                  value="e.g. Mid-term Biology 101"
                />
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label
                    class="block text-xs font-bold text-subtext-light dark:text-subtext-dark uppercase tracking-wide mb-1.5"
                    >Subject</label
                  >
                  <div class="relative">
                    <select
                      class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white appearance-none focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                    >
                      <option>Molecular Biology</option>
                      <option>Computer Science</option>
                      <option>History 101</option>
                    </select>
                    <span
                      class="material-icons-round absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                      >expand_more</span
                    >
                  </div>
                </div>
                <div>
                  <label
                    class="block text-xs font-bold text-subtext-light dark:text-subtext-dark uppercase tracking-wide mb-1.5"
                    >Room</label
                  >
                  <input
                    class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                    type="text"
                    value="Lab 4-B"
                  />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label
                    class="block text-xs font-bold text-subtext-light dark:text-subtext-dark uppercase tracking-wide mb-1.5"
                    >Date</label
                  >
                  <div class="relative">
                    <input
                      class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                      type="date"
                    />
                  </div>
                </div>
                <div>
                  <label
                    class="block text-xs font-bold text-subtext-light dark:text-subtext-dark uppercase tracking-wide mb-1.5"
                    >Start Time</label
                  >
                  <div class="relative">
                    <input
                      class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                      type="time"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            class="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6 shadow-sm"
          >
            <div class="flex items-center space-x-3 mb-6">
              <div class="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <span class="material-icons-round text-primary">schedule</span>
              </div>
              <h3 class="text-lg font-bold text-slate-900 dark:text-white">
                Time Controls
              </h3>
            </div>
            <div class="space-y-6">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-semibold text-slate-900 dark:text-white">
                    Duration
                  </p>
                  <p class="text-sm text-subtext-light dark:text-subtext-dark">
                    Total active exam time
                  </p>
                </div>
                <div class="flex items-center">
                  <input
                    class="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-center text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                    type="number"
                    value="120"
                  />
                  <span
                    class="ml-3 text-sm text-subtext-light dark:text-subtext-dark"
                    >min</span
                  >
                </div>
              </div>
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-semibold text-slate-900 dark:text-white">
                    Extra Time Allowance
                  </p>
                  <p class="text-sm text-subtext-light dark:text-subtext-dark">
                    For students with accessibility needs
                  </p>
                </div>
                <div class="flex items-center">
                  <input
                    class="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-center text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                    type="number"
                    value="15"
                  />
                  <span
                    class="ml-3 text-sm text-subtext-light dark:text-subtext-dark"
                    >min</span
                  >
                </div>
              </div>
              <div
                class="pt-4 border-t border-border-light dark:border-border-dark"
              >
                <div class="flex items-center justify-between mb-4">
                  <div>
                    <p class="font-semibold text-slate-900 dark:text-white">
                      Scheduled Break
                    </p>
                    <p
                      class="text-sm text-subtext-light dark:text-subtext-dark"
                    >
                      Automatic pause for all students
                    </p>
                  </div>
                  <label
                    class="relative inline-flex items-center cursor-pointer"
                  >
                    <input checked="" class="sr-only peer" type="checkbox" />
                    <div
                      class="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"
                    ></div>
                  </label>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      class="block text-xs font-bold text-subtext-light dark:text-subtext-dark uppercase tracking-wide mb-1.5"
                      >Break Starts At</label
                    >
                    <input
                      class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                      type="text"
                      value="60"
                    />
                  </div>
                  <div>
                    <label
                      class="block text-xs font-bold text-subtext-light dark:text-subtext-dark uppercase tracking-wide mb-1.5"
                      >Duration (min)</label
                    >
                    <input
                      class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                      type="text"
                      value="10"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            class="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6 shadow-sm"
          >
            <div class="flex items-center space-x-3 mb-6">
              <div class="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <span class="material-icons-round text-primary"
                  >perm_contact_calendar</span
                >
              </div>
              <h3 class="text-lg font-bold text-slate-900 dark:text-white">
                Student Configuration
              </h3>
            </div>
            <div class="space-y-6">
              <div>
                <p class="font-semibold text-slate-900 dark:text-white mb-3">
                  Seat Assignment
                </p>
                <div class="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  <button
                    class="flex-1 bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white text-sm font-semibold py-1.5 rounded-md transition-all"
                  >
                    Automatic
                  </button>
                  <button
                    class="flex-1 text-subtext-light dark:text-subtext-dark hover:text-slate-900 dark:hover:text-white text-sm font-medium py-1.5 rounded-md transition-colors"
                  >
                    Manual Selection
                  </button>
                </div>
              </div>
              <div>
                <p class="font-semibold text-slate-900 dark:text-white mb-3">
                  Device Pairing Status
                </p>
                <div
                  class="bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 overflow-hidden"
                >
                  <div
                    class="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between"
                  >
                    <div class="flex items-center space-x-3">
                      <div class="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
                      <span
                        class="text-sm font-medium text-slate-700 dark:text-slate-200"
                        >Section A Tablets</span
                      >
                    </div>
                    <span
                      class="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded uppercase tracking-wider"
                      >Paired</span
                    >
                  </div>
                  <div class="px-4 py-3 flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                      <div class="w-2.5 h-2.5 bg-yellow-500 rounded-full"></div>
                      <span
                        class="text-sm font-medium text-slate-700 dark:text-slate-200"
                        >Guest Terminals</span
                      >
                    </div>
                    <span
                      class="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-bold rounded uppercase tracking-wider"
                      >Syncing...</span
                    >
                  </div>
                </div>
              </div>
              <button
                onclick="
                  alert('Pairing mode activated. Waiting for devices...')
                "
                class="w-full py-2.5 border border-primary/20 bg-orange-50 dark:bg-primary/10 text-primary hover:bg-orange-100 dark:hover:bg-primary/20 rounded-lg text-sm font-medium transition-colors"
              >
                Pair New Device Cluster
              </button>
            </div>
          </div>

          <div
            class="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-6 shadow-sm"
          >
            <div class="flex items-center space-x-3 mb-6">
              <div class="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <span class="material-icons-round text-primary">security</span>
              </div>
              <h3 class="text-lg font-bold text-slate-900 dark:text-white">
                Safety Controls
              </h3>
            </div>
            <div class="space-y-4">
              <div
                class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700"
              >
                <div class="flex items-start space-x-3">
                  <span class="material-icons-round text-primary mt-0.5"
                    >visibility</span
                  >
                  <div>
                    <p
                      class="font-semibold text-sm text-slate-900 dark:text-white"
                    >
                      AI Proctoring Monitoring
                    </p>
                    <p
                      class="text-xs text-subtext-light dark:text-subtext-dark mt-0.5"
                    >
                      Real-time eye tracking & environment scanning
                    </p>
                  </div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input checked="" class="sr-only peer" type="checkbox" />
                  <div
                    class="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"
                  ></div>
                </label>
              </div>
              <div
                class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700"
              >
                <div class="flex items-start space-x-3">
                  <span class="material-icons-round text-primary mt-0.5"
                    >gesture</span
                  >
                  <div>
                    <p
                      class="font-semibold text-sm text-slate-900 dark:text-white"
                    >
                      Smart Pen Connectivity
                    </p>
                    <p
                      class="text-xs text-subtext-light dark:text-subtext-dark mt-0.5"
                    >
                      Sync digitized handwriting for essay exams
                    </p>
                  </div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input class="sr-only peer" type="checkbox" />
                  <div
                    class="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"
                  ></div>
                </label>
              </div>
              <div
                class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700"
              >
                <div class="flex items-start space-x-3">
                  <span class="material-icons-round text-primary mt-0.5"
                    >lock</span
                  >
                  <div>
                    <p
                      class="font-semibold text-sm text-slate-900 dark:text-white"
                    >
                      Lockdown Browser
                    </p>
                    <p
                      class="text-xs text-subtext-light dark:text-subtext-dark mt-0.5"
                    >
                      Disable all tabs and external software
                    </p>
                  </div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input checked="" class="sr-only peer" type="checkbox" />
                  <div
                    class="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"
                  ></div>
                </label>
              </div>
              <div
                class="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 rounded-lg flex items-start space-x-3"
              >
                <span
                  class="material-icons-round text-yellow-600 dark:text-yellow-500 text-sm mt-0.5"
                  >warning_amber</span
                >
                <p
                  class="text-xs text-yellow-800 dark:text-yellow-200 leading-relaxed"
                >
                  Enabling AI proctoring requires high-speed internet. Ensure
                  all student devices have active cameras.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <script src="../scripts/component-loader.js"></script>

    <script>
      function publishExam() {
        const title = document.getElementById("examTitle").value;
        if (title === "" || title === "e.g. Mid-term Biology 101") {
          alert("Please enter a valid Exam Title before publishing.");
        } else {
          alert("Exam Published Successfully! Redirecting to Dashboard...");
          window.location.href = "dashboard-page.html";
        }
      }
    </script>
  </body>
</html>


frontend/pages/login-page.html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta content="width=device-width, initial-scale=1.0" name="viewport" />
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
    <link
      href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@300;400;500;600;700;900&display=swap"
      rel="stylesheet"
    />
    <link
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700,0..1&display=swap"
      rel="stylesheet"
    />
    <link
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
      rel="stylesheet"
    />
    <script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              primary: "#ec5b13",
              "background-light": "#f8f6f6",
              "background-dark": "#221610",
            },
            fontFamily: {
              display: ["Public Sans", "sans-serif"],
            },
            borderRadius: {
              DEFAULT: "0.25rem",
              lg: "0.5rem",
              xl: "0.75rem",
              full: "9999px",
            },
          },
        },
      };
    </script>
    <title>ExamNexus | Login</title>
  </head>
  <body
    class="font-display bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex flex-col"
  >
    <header
      class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 md:px-20 py-4 bg-white dark:bg-background-dark/50 backdrop-blur-sm sticky top-0 z-50"
    >
      <div class="flex items-center gap-3">
        <div class="p-2 bg-primary rounded-lg text-white">
          <span class="material-symbols-outlined block">grid_view</span>
        </div>
        <h2 class="text-xl font-bold tracking-tight">ExamNexus</h2>
      </div>
      <div class="flex gap-4">
        <button
          class="flex items-center justify-center rounded-xl h-10 px-6 bg-primary/10 text-primary text-sm font-bold hover:bg-primary/20 transition-colors"
        >
          Help
        </button>
      </div>
    </header>
    <main class="flex-1 flex items-center justify-center p-6">
      <div class="w-full max-w-[480px] space-y-8">
        <div class="text-center md:text-left space-y-2">
          <h1
            class="text-4xl font-black tracking-tight text-slate-900 dark:text-white"
          >
            ExamNexus Portal : Login
          </h1>
          <p class="text-slate-500 dark:text-slate-400 text-lg">
            Secure access to your academic dashboard
          </p>
        </div>
        <div
          class="bg-white dark:bg-slate-900/50 p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6"
        >
          <div class="space-y-4">
            <label class="block">
              <span
                class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block"
                >User Login</span
              >
              <div class="relative">
                <span
                  class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  >person</span
                >
                <input
                  id="userId"
                  onkeypress="handleEnter(event)"
                  class="w-full rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 pl-12 pr-4 h-14 focus:ring-primary focus:border-primary dark:text-white placeholder:text-slate-400"
                  placeholder="Enter your User ID"
                  type="text"
                />
              </div>
            </label>
            <label class="block">
              <div class="flex justify-between items-center mb-2">
                <span
                  class="text-sm font-semibold text-slate-700 dark:text-slate-300"
                  >Password</span
                >
              </div>
              <div class="relative flex">
                <span
                  class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  >lock</span
                >
                <input
                  id="password"
                  onkeypress="handleEnter(event)"
                  class="w-full rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 pl-12 pr-12 h-14 focus:ring-primary focus:border-primary dark:text-white placeholder:text-slate-400"
                  placeholder="Enter your password"
                  type="password"
                />
                <button
                  type="button"
                  onclick="togglePassword()"
                  class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                >
                  <span id="toggleIcon" class="material-symbols-outlined"
                    >visibility</span
                  >
                </button>
              </div>
            </label>
          </div>
          <div class="flex items-center justify-end">
            <a
              class="text-sm font-medium text-primary hover:underline underline-offset-4"
              href="#"
              >forgot password?</a
            >
          </div>
          <button
            onclick="handleLogin()"
            class="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
          >
            Login
            <span class="material-symbols-outlined">login</span>
          </button>
          <div class="relative py-4">
            <div class="absolute inset-0 flex items-center">
              <div
                class="w-full border-t border-slate-200 dark:border-slate-800"
              ></div>
            </div>
            <div class="relative flex justify-center text-xs uppercase">
              <span class="bg-white dark:bg-[#221610] px-2 text-slate-400"
                >Authorized Access Only</span
              >
            </div>
          </div>
        </div>
        <div class="flex flex-col items-center gap-4 pt-4">
          <div class="flex gap-4">
            <div class="w-12 h-1 bg-primary/20 rounded-full"></div>
            <div class="w-12 h-1 bg-primary/20 rounded-full"></div>
            <div class="w-12 h-1 bg-primary/20 rounded-full"></div>
          </div>
        </div>
      </div>
    </main>
    <footer
      class="py-8 border-t border-slate-200 dark:border-slate-800 text-center px-6"
    >
      <p class="text-sm text-slate-500 dark:text-slate-400 font-medium">
        Developed & Maintained By <span class="text-primary">AAAF</span> of
        CSE299, NSU
      </p>
      <div class="mt-2 flex justify-center gap-6 text-xs text-slate-400">
        <a class="hover:text-primary" href="#">Privacy Policy</a>
        <a class="hover:text-primary" href="#">Terms of Service</a>
        <a class="hover:text-primary" href="#">Contact Support</a>
      </div>
    </footer>

    <script>
      // লগইন ফাংশন
      function handleLogin() {
        const userIdValue = document.getElementById("userId").value;
        const passwordValue = document.getElementById("password").value;

        if (userIdValue === "123" && passwordValue === "123") {
          window.location.href = "dashboard-page.html";
        } else {
          alert(
            "Incorrect User ID or Password! Please use ID: 123 and Password: 123",
          );
        }
      }

      // এন্টার চাপলে লগইন করার ফাংশন
      function handleEnter(event) {
        if (event.key === "Enter") {
          handleLogin();
        }
      }

      // পাসওয়ার্ড হাইড/শো করার ফাংশন
      function togglePassword() {
        const passwordInput = document.getElementById("password");
        const toggleIcon = document.getElementById("toggleIcon");

        if (passwordInput.type === "password") {
          passwordInput.type = "text";
          toggleIcon.innerText = "visibility_off"; // আইকন পরিবর্তন
        } else {
          passwordInput.type = "password";
          toggleIcon.innerText = "visibility"; // আইকন পরিবর্তন
        }
      }
    </script>
  </body>
</html>


frontend/pages/settings-page.html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta content="width=device-width, initial-scale=1.0" name="viewport" />
    <title>System Settings | ExamNexus</title>
    <script src="https://cdn.tailwindcss.com?plugins=forms,typography"></script>
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <link
      href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined"
      rel="stylesheet"
    />
    <link
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
      rel="stylesheet"
    />

    <script>
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              primary: "#F95721",
              "primary-hover": "#e04e1d",
              "primary-light": "#FFEEE6",
              "background-light": "#F8F9FB",
              "background-dark": "#0F172A",
              "surface-light": "#FFFFFF",
              "surface-dark": "#1E293B",
              "border-light": "#E2E8F0",
              "border-dark": "#334155",
              "text-light": "#1E293B",
              "text-dark": "#E2E8F0",
              "text-secondary-light": "#64748B",
              "text-secondary-dark": "#94A3B8",
            },
            fontFamily: {
              display: ["Inter", "sans-serif"],
              sans: ["Inter", "sans-serif"],
            },
            borderRadius: {
              DEFAULT: "0.5rem",
            },
          },
        },
      };
    </script>
    <style>
      input[type="range"] {
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
      }
      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        height: 16px;
        width: 16px;
        border-radius: 50%;
        background: #f95721;
        cursor: pointer;
        margin-top: -6px;
        box-shadow: 0 0 0 2px #fff;
      }
      .dark input[type="range"]::-webkit-slider-thumb {
        box-shadow: 0 0 0 2px #1e293b;
      }
      input[type="range"]::-webkit-slider-runnable-track {
        width: 100%;
        height: 4px;
        cursor: pointer;
        background: #e2e8f0;
        border-radius: 2px;
      }
      .dark input[type="range"]::-webkit-slider-runnable-track {
        background: #334155;
      }
      .no-scrollbar::-webkit-scrollbar {
        display: none;
      }
      .no-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    </style>
  </head>
  <body
    class="bg-background-light dark:bg-background-dark font-sans text-text-light dark:text-text-dark antialiased selection:bg-primary selection:text-white h-screen overflow-hidden flex transition-colors duration-200"
  >
    <div id="sidebar-placeholder"></div>

    <main
      class="flex-1 flex flex-col h-screen overflow-hidden bg-background-light dark:bg-background-dark relative"
    >
      <header
        class="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark px-8 h-20 flex items-center justify-between z-10 shrink-0"
      >
        <div>
          <h2 class="text-xl font-bold text-text-light dark:text-white">
            System Settings
          </h2>
          <p
            class="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5"
          >
            Configure global application preferences.
          </p>
        </div>
        <div class="flex items-center gap-4">
          <button
            class="text-text-secondary-light dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary transition-colors"
          >
            <span class="material-symbols-outlined text-[24px]"
              >notifications</span
            >
          </button>
          <button
            class="text-text-secondary-light dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary transition-colors"
          >
            <span class="material-symbols-outlined text-[24px]">help</span>
          </button>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto p-8 space-y-6">
        <div class="max-w-7xl space-y-6">
          <div
            class="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark p-6"
          >
            <div class="flex items-center gap-2 mb-5">
              <span class="material-symbols-outlined text-primary text-xl"
                >palette</span
              >
              <h3 class="text-base font-bold text-text-light dark:text-white">
                UI Settings
              </h3>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div class="space-y-5">
                <div>
                  <label
                    class="block text-sm font-semibold text-text-light dark:text-white mb-3"
                    >Interface Theme</label
                  >
                  <div class="grid grid-cols-3 gap-3" id="theme-buttons">
                    <button
                      class="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-primary bg-primary-light/20 text-primary transition-all"
                    >
                      <span class="material-symbols-outlined text-xl mb-1"
                        >light_mode</span
                      >
                      <span class="text-xs font-bold">LIGHT</span>
                    </button>
                    <button
                      class="flex flex-col items-center justify-center p-3 rounded-lg border border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark transition-all"
                    >
                      <span class="material-symbols-outlined text-xl mb-1"
                        >dark_mode</span
                      >
                      <span class="text-xs font-semibold">DARK</span>
                    </button>
                    <button
                      class="flex flex-col items-center justify-center p-3 rounded-lg border border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark transition-all"
                    >
                      <span class="material-symbols-outlined text-xl mb-1"
                        >devices</span
                      >
                      <span class="text-xs font-semibold">SYSTEM</span>
                    </button>
                  </div>
                </div>
                <div>
                  <label
                    class="block text-sm font-semibold text-text-light dark:text-white mb-2"
                    >Display Language</label
                  >
                  <select
                    class="w-full rounded-lg border-border-light dark:border-border-dark bg-white dark:bg-slate-800 text-text-light dark:text-white focus:ring-primary focus:border-primary text-sm py-2.5 outline-none cursor-pointer"
                  >
                    <option>English</option>
                    <option>Bangla</option>
                  </select>
                </div>
              </div>
              <div class="space-y-4">
                <div>
                  <div class="flex justify-between items-center mb-2">
                    <label
                      class="block text-sm font-semibold text-text-light dark:text-white"
                      >Font Scaling</label
                    >
                    <span
                      id="font-scale-val"
                      class="text-xs font-bold text-primary"
                      >100% (Normal)</span
                    >
                  </div>
                  <input
                    id="font-slider"
                    class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    max="125"
                    min="75"
                    type="range"
                    value="100"
                  />
                  <div
                    class="flex justify-between text-xs uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark mt-2 font-bold"
                  >
                    <span>Small</span>
                    <span>Large</span>
                  </div>
                </div>
                <div
                  class="bg-gray-50 dark:bg-slate-900 rounded-lg p-4 border border-border-light dark:border-border-dark"
                >
                  <span
                    class="text-xs text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide font-bold block mb-2"
                    >Preview</span
                  >
                  <p
                    id="font-preview"
                    class="text-text-light dark:text-gray-300 text-sm leading-relaxed transition-all"
                  >
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
                    do eiusmod tempor.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            class="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark p-6"
          >
            <div class="flex items-center gap-2 mb-5">
              <span class="material-symbols-outlined text-primary text-xl"
                >code</span
              >
              <h3 class="text-base font-bold text-text-light dark:text-white">
                Advanced System Settings
              </h3>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div>
                <label
                  class="flex items-center gap-2 text-sm font-semibold text-text-light dark:text-white mb-2"
                >
                  Backend API URL
                  <span
                    class="material-symbols-outlined text-gray-400 text-base cursor-help"
                    >info</span
                  >
                </label>
                <input
                  class="w-full rounded-lg border-border-light dark:border-border-dark bg-white dark:bg-slate-800 text-text-light dark:text-white focus:ring-primary focus:border-primary text-sm py-2.5 outline-none"
                  type="text"
                  value="https://api.examnexus.cloud/v1"
                />
              </div>
              <div>
                <label
                  class="flex items-center gap-2 text-sm font-semibold text-text-light dark:text-white mb-2"
                >
                  AI Service URL
                  <span
                    class="material-symbols-outlined text-gray-400 text-base cursor-help"
                    >info</span
                  >
                </label>
                <input
                  class="w-full rounded-lg border-border-light dark:border-border-dark bg-white dark:bg-slate-800 text-text-light dark:text-white focus:ring-primary focus:border-primary text-sm py-2.5 outline-none"
                  type="text"
                  value="https://ai-proctor.services.internal"
                />
              </div>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-end">
              <div class="lg:col-span-2">
                <label
                  class="block text-sm font-semibold text-text-light dark:text-white mb-2"
                  >Hardware Gateway</label
                >
                <div class="relative">
                  <select
                    class="w-full rounded-lg border-border-light dark:border-border-dark bg-white dark:bg-slate-800 text-text-light dark:text-white focus:ring-primary focus:border-primary appearance-none py-2.5 pl-4 pr-16 text-sm outline-none cursor-pointer"
                  >
                    <option>gw-294-883-pro</option>
                    <option>gw-112-445-std</option>
                  </select>

                  <div
                    class="absolute inset-y-0 right-3 flex items-center gap-2 pointer-events-none"
                  >
                    <span
                      class="material-icons-outlined text-green-500 text-[18px]"
                      >check_circle</span
                    >
                    <svg
                      class="w-4 h-4 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M19 9l-7 7-7-7"
                      ></path>
                    </svg>
                  </div>
                </div>
              </div>

              <div class="flex gap-3">
                <button
                  onclick="alert('Connection Successful! Latency: 14ms')"
                  class="flex-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-text-light dark:text-white font-bold py-2.5 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <span class="material-symbols-outlined text-base">sync</span>
                  Test Connection
                </button>
                <button
                  onclick="alert('Gateways refreshed.')"
                  class="bg-white dark:bg-slate-800 border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-50 dark:hover:bg-slate-700 py-2.5 px-3 rounded-lg transition-colors flex items-center justify-center"
                >
                  <span class="material-symbols-outlined text-base"
                    >refresh</span
                  >
                </button>
              </div>
            </div>
          </div>

          <div
            class="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark p-6"
          >
            <div class="flex items-center gap-2 mb-5">
              <span class="material-symbols-outlined text-primary text-xl"
                >visibility</span
              >
              <h3 class="text-base font-bold text-text-light dark:text-white">
                Proctoring Sensitivity
              </h3>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div>
                <div class="flex justify-between items-center mb-3">
                  <label
                    class="flex items-center gap-2 text-sm font-semibold text-text-light dark:text-white"
                  >
                    Movement Threshold
                    <span
                      class="material-symbols-outlined text-gray-400 text-base cursor-help"
                      >help</span
                    >
                  </label>
                  <span
                    id="move-val"
                    class="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-bold px-2 py-1 rounded"
                    >45%</span
                  >
                </div>
                <input
                  id="move-slider"
                  class="w-full h-1.5"
                  max="100"
                  min="0"
                  type="range"
                  value="45"
                />
                <p
                  class="mt-2 text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
                >
                  Flags behavior when significant posture changes are detected.
                </p>
              </div>
              <div>
                <div class="flex justify-between items-center mb-3">
                  <label
                    class="flex items-center gap-2 text-sm font-semibold text-text-light dark:text-white"
                  >
                    Audio Sensitivity
                    <span
                      class="material-symbols-outlined text-gray-400 text-base cursor-help"
                      >help</span
                    >
                  </label>
                  <span
                    id="audio-val"
                    class="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-bold px-2 py-1 rounded"
                    >72%</span
                  >
                </div>
                <input
                  id="audio-slider"
                  class="w-full h-1.5"
                  max="100"
                  min="0"
                  type="range"
                  value="72"
                />
                <p
                  class="mt-2 text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
                >
                  Threshold for detecting background voices or environmental
                  noise.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        class="bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark px-8 py-5 flex justify-between items-center z-10 shrink-0"
      >
        <button
          onclick="resetDefaults()"
          class="flex items-center gap-2 text-text-secondary-light dark:text-text-secondary-dark hover:text-text-light dark:hover:text-white font-bold transition-colors text-sm"
        >
          <span class="material-symbols-outlined text-base">restart_alt</span>
          Reset to Defaults
        </button>
        <div class="flex gap-4">
          <button
            onclick="window.location.href = 'dashboard-page.html'"
            class="px-5 py-2.5 rounded-lg border border-border-light dark:border-border-dark text-text-light dark:text-white text-sm font-bold hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onclick="saveSettings()"
            class="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-sm transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </main>

    <script src="../scripts/component-loader.js"></script>

    <script>
      document.addEventListener("DOMContentLoaded", () => {
        const themeButtons = document.querySelectorAll("#theme-buttons button");
        themeButtons.forEach((btn, index) => {
          btn.addEventListener("click", () => {
            themeButtons.forEach((b) => {
              b.className =
                "flex flex-col items-center justify-center p-3 rounded-lg border border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark transition-all";
            });
            btn.className =
              "flex flex-col items-center justify-center p-3 rounded-lg border-2 border-primary bg-primary-light/20 text-primary transition-all";

            if (index === 0) {
              document.documentElement.classList.remove("dark");
            } else if (index === 1) {
              document.documentElement.classList.add("dark");
            } else {
              if (
                window.matchMedia &&
                window.matchMedia("(prefers-color-scheme: dark)").matches
              ) {
                document.documentElement.classList.add("dark");
              } else {
                document.documentElement.classList.remove("dark");
              }
            }
          });
        });
      });

      const fontSlider = document.getElementById("font-slider");
      const fontVal = document.getElementById("font-scale-val");
      const fontPreview = document.getElementById("font-preview");

      fontSlider.addEventListener("input", (e) => {
        const val = e.target.value;
        fontVal.innerText = `${val}% ${val == 100 ? "(Normal)" : ""}`;
        fontPreview.style.fontSize = `${14 * (val / 100)}px`;
      });

      const moveSlider = document.getElementById("move-slider");
      const moveVal = document.getElementById("move-val");
      moveSlider.addEventListener("input", (e) => {
        moveVal.innerText = `${e.target.value}%`;
      });

      const audioSlider = document.getElementById("audio-slider");
      const audioVal = document.getElementById("audio-val");
      audioSlider.addEventListener("input", (e) => {
        audioVal.innerText = `${e.target.value}%`;
      });

      function resetDefaults() {
        fontSlider.value = 100;
        fontSlider.dispatchEvent(new Event("input"));
        moveSlider.value = 45;
        moveSlider.dispatchEvent(new Event("input"));
        audioSlider.value = 72;
        audioSlider.dispatchEvent(new Event("input"));
        alert("Settings have been reset to default values.");
      }

      function saveSettings() {
        alert("Settings saved successfully!");
        window.location.href = "dashboard-page.html";
      }
    </script>
  </body>
</html>


frontend/pages/student-list-page.html

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta content="width=device-width, initial-scale=1.0" name="viewport" />
    <title>Student List | ExamNexus</title>
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <link
      href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined"
      rel="stylesheet"
    />
    <link
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
      rel="stylesheet"
    />

    <script>
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              primary: "#FF5722",
              secondary: "#10B981",
              danger: "#EF4444",
              warning: "#F59E0B",
              "background-light": "#F9FAFB",
              "background-dark": "#111827",
              "surface-light": "#FFFFFF",
              "surface-dark": "#1F2937",
              "text-light": "#1F2937",
              "text-dark": "#F3F4F6",
              "border-light": "#E5E7EB",
              "border-dark": "#374151",
            },
            fontFamily: {
              sans: ["Inter", "sans-serif"],
            },
            borderRadius: {
              DEFAULT: "0.5rem",
            },
          },
        },
      };
    </script>
    <style>
      ::-webkit-scrollbar {
        width: 6px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
      }
      .dark ::-webkit-scrollbar-thumb {
        background: #475569;
      }
    </style>
  </head>
  <body
    class="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-sans antialiased h-screen overflow-hidden flex transition-colors duration-200 relative"
  >
    <div id="sidebar-placeholder"></div>

    <main class="flex-1 flex flex-col h-full overflow-hidden relative">
      <header
        class="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark h-20 px-8 flex items-center justify-between z-10 shrink-0"
      >
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">
            Student List
          </h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Manage and monitor all enrolled students
          </p>
        </div>
        <div class="flex items-center gap-3">
          <button
            onclick="alert('Import CSV feature will open a file dialog.')"
            class="bg-white dark:bg-gray-800 border border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
          >
            <span class="material-symbols-outlined text-sm">upload_file</span>
            Import CSV
          </button>
          <button
            onclick="alert('Exporting student list to CSV...')"
            class="bg-primary hover:bg-orange-600 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            <span class="material-symbols-outlined text-sm">download</span>
            Export CSV
          </button>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto p-8">
        <div class="max-w-6xl mx-auto">
          <div
            class="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden"
          >
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr
                    class="bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark"
                  >
                    <th
                      class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      Student Name
                    </th>
                    <th
                      class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      Student ID
                    </th>
                    <th
                      class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      Assigned Exam
                    </th>
                    <th
                      class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      Current Status
                    </th>
                    <th
                      class="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center"
                    >
                      Device Pairing
                    </th>
                  </tr>
                </thead>
                <tbody
                  class="divide-y divide-border-light dark:border-border-dark"
                >
                  <tr
                    class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center gap-3">
                        <div
                          class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center"
                        >
                          <span class="material-symbols-outlined text-sm"
                            >person</span
                          >
                        </div>
                        <span
                          class="text-sm font-bold text-gray-900 dark:text-white"
                          >Mahee</span
                        >
                      </div>
                    </td>
                    <td
                      class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-300"
                    >
                      STU-2024-001
                    </td>
                    <td
                      class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-300"
                    >
                      CSE173
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center gap-2">
                        <span
                          class="w-2 h-2 rounded-full bg-green-500 animate-pulse"
                        ></span>
                        <span
                          class="text-sm font-bold text-gray-700 dark:text-gray-300"
                          >In Exam</span
                        >
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-center">
                      <div
                        class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                        title="Connected"
                      >
                        <span class="material-symbols-outlined text-lg"
                          >link</span
                        >
                      </div>
                    </td>
                  </tr>

                  <tr
                    class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center gap-3">
                        <div
                          class="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center"
                        >
                          <span class="material-symbols-outlined text-sm"
                            >person</span
                          >
                        </div>
                        <span
                          class="text-sm font-bold text-gray-900 dark:text-white"
                          >Aalok</span
                        >
                      </div>
                    </td>
                    <td
                      class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-300"
                    >
                      STU-2024-045
                    </td>
                    <td
                      class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-300"
                    >
                      CSE173
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-warning"></span>
                        <span
                          class="text-sm font-bold text-gray-700 dark:text-gray-300"
                          >Paused</span
                        >
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-center">
                      <div
                        class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                        title="Connected"
                      >
                        <span class="material-symbols-outlined text-lg"
                          >link</span
                        >
                      </div>
                    </td>
                  </tr>

                  <tr
                    class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center gap-3">
                        <div
                          class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center"
                        >
                          <span class="material-symbols-outlined text-sm"
                            >person</span
                          >
                        </div>
                        <span
                          class="text-sm font-bold text-gray-900 dark:text-white"
                          >Fahim</span
                        >
                      </div>
                    </td>
                    <td
                      class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-300"
                    >
                      STU-2024-112
                    </td>
                    <td
                      class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-300"
                    >
                      CSE173
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-gray-400"></span>
                        <span
                          class="text-sm font-bold text-gray-700 dark:text-gray-300"
                          >Not Started</span
                        >
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-center">
                      <div
                        class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                        title="Connected"
                      >
                        <span class="material-symbols-outlined text-lg"
                          >link</span
                        >
                      </div>
                    </td>
                  </tr>

                  <tr
                    class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center gap-3">
                        <div
                          class="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 flex items-center justify-center"
                        >
                          <span class="material-symbols-outlined text-sm"
                            >person</span
                          >
                        </div>
                        <span
                          class="text-sm font-bold text-gray-900 dark:text-white"
                          >Abidur</span
                        >
                      </div>
                    </td>
                    <td
                      class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-300"
                    >
                      STU-2024-089
                    </td>
                    <td
                      class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-300"
                    >
                      CSE173
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center gap-2">
                        <span
                          class="w-2 h-2 rounded-full bg-green-500 animate-pulse"
                        ></span>
                        <span
                          class="text-sm font-bold text-gray-700 dark:text-gray-300"
                          >In Exam</span
                        >
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-center">
                      <div
                        class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                        title="Connected"
                      >
                        <span class="material-symbols-outlined text-lg"
                          >link</span
                        >
                      </div>
                    </td>
                  </tr>

                  <tr
                    class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center gap-3">
                        <div
                          class="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center"
                        >
                          <span class="material-symbols-outlined text-sm"
                            >person</span
                          >
                        </div>
                        <span
                          class="text-sm font-bold text-gray-900 dark:text-white"
                          >Sami</span
                        >
                      </div>
                    </td>
                    <td
                      class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-300"
                    >
                      STU-2024-156
                    </td>
                    <td
                      class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-300"
                    >
                      CSE173
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-danger"></span>
                        <span
                          class="text-sm font-bold text-gray-700 dark:text-gray-300"
                          >Flagged</span
                        >
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-center">
                      <div
                        class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                        title="Connected"
                      >
                        <span class="material-symbols-outlined text-lg"
                          >link</span
                        >
                      </div>
                    </td>
                  </tr>

                  <tr
                    class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center gap-3">
                        <div
                          class="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center"
                        >
                          <span class="material-symbols-outlined text-sm"
                            >person</span
                          >
                        </div>
                        <span
                          class="text-sm font-bold text-gray-900 dark:text-white"
                          >Obayed</span
                        >
                      </div>
                    </td>
                    <td
                      class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-300"
                    >
                      STU-2024-210
                    </td>
                    <td
                      class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-300"
                    >
                      CSE173
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center gap-2">
                        <span
                          class="w-2 h-2 rounded-full bg-green-500 animate-pulse"
                        ></span>
                        <span
                          class="text-sm font-bold text-gray-700 dark:text-gray-300"
                          >In Exam</span
                        >
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-center">
                      <div
                        class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                        title="Connected"
                      >
                        <span class="material-symbols-outlined text-lg"
                          >link</span
                        >
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              class="bg-white dark:bg-surface-dark px-6 py-4 border-t border-border-light dark:border-border-dark flex items-center justify-between"
            >
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Showing
                <span class="font-bold text-gray-700 dark:text-gray-200"
                  >1</span
                >
                to
                <span class="font-bold text-gray-700 dark:text-gray-200"
                  >6</span
                >
                of
                <span class="font-bold text-gray-700 dark:text-gray-200"
                  >24</span
                >
                results
              </p>
              <div class="flex items-center gap-2">
                <button
                  class="p-2 rounded-lg border border-border-light dark:border-border-dark text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  disabled
                >
                  <span class="material-symbols-outlined text-base"
                    >chevron_left</span
                  >
                </button>
                <button
                  onclick="alert('Loading next page...')"
                  class="p-2 rounded-lg border border-border-light dark:border-border-dark text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <span class="material-symbols-outlined text-base"
                    >chevron_right</span
                  >
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <script src="../scripts/component-loader.js"></script>
  </body>
</html>
