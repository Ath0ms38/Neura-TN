// Neura'TN — navigation partagée.
// Source unique de la liste des pages : le menu « Explorer » de chaque page
// intérieure est construit à partir de ce tableau.
(() => {
  "use strict";

  const PAGES = {
    "Démos": [
      { href: "/mnist", title: "Visualiseur MNIST", note: "Reconnaissance de chiffres dessinés" },
      { href: "/playground", title: "Bac à sable", note: "Entraîner un petit réseau dans le navigateur" },
      { href: "/flappy", title: "Flappy Bird NEAT", note: "Des oiseaux apprennent à jouer par évolution" },
      { href: "/car", title: "Conduite NEAT", note: "Des voitures apprennent à suivre un circuit" },
      { href: "/gridworld", title: "Labyrinthe Q-learning", note: "Un agent apprend à sortir d'un labyrinthe" },
      { href: "/chess", title: "Échecs Alpha-Beta", note: "Une IA avec votre fonction d'évaluation" },
    ],
    "Cours": [
      { href: "/cours/nn", title: "Réseaux de neurones", note: "Neurones, poids, couches, propagation" },
      { href: "/cours/apprentissage", title: "Descente de gradient", note: "Perte, gradient, rétropropagation" },
      { href: "/cours/cnn", title: "Réseaux convolutifs", note: "Filtres, convolution, pooling" },
      { href: "/cours/neat", title: "Neuroévolution NEAT", note: "Mutations, croisement, spéciation" },
      { href: "/cours/rl", title: "Apprentissage par renforcement", note: "Récompenses, exploration, Q-learning" },
    ],
  };

  const header = document.querySelector("body.lab-page > header");
  if (!header) return;

  const here = location.pathname.replace(/\/+$/, "") || "/";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "site-menu-btn";
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", "site-menu");
  btn.innerHTML =
    '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
    '<rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/>' +
    '<rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>' +
    "<span>Explorer</span>";

  const menu = document.createElement("nav");
  menu.id = "site-menu";
  menu.className = "site-menu";
  menu.hidden = true;
  menu.setAttribute("aria-label", "Toutes les démos et tous les cours");

  for (const [group, pages] of Object.entries(PAGES)) {
    const section = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = group;
    const list = document.createElement("ul");
    for (const page of pages) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = page.href;
      a.textContent = page.title;
      const note = document.createElement("small");
      note.textContent = page.note;
      a.appendChild(note);
      if (page.href === here) a.setAttribute("aria-current", "page");
      li.appendChild(a);
      list.appendChild(li);
    }
    section.append(title, list);
    menu.appendChild(section);
  }

  header.appendChild(btn);
  document.body.appendChild(menu);

  function setOpen(open) {
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  }

  btn.addEventListener("click", () => setOpen(menu.hidden));
  document.addEventListener("click", (e) => {
    if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) {
      setOpen(false);
      btn.focus();
    }
  });

  // La hauteur réelle de la barre (elle peut passer sur deux lignes sur mobile)
  // sert aux mises en page pleine hauteur des démos.
  const syncHeight = () =>
    document.documentElement.style.setProperty("--topbar-h", header.offsetHeight + "px");
  syncHeight();
  if ("ResizeObserver" in window) new ResizeObserver(syncHeight).observe(header);
})();
