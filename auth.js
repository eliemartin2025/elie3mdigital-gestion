const dbAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function deconnexion() {
  await dbAuth.auth.signOut();
  window.location.href = "login.html";
}

// Éléments masqués pour le vendeur
const BOUTONS_CACHES_VENDEUR = [
  "Supprimer",
  "Télécharger le PDF",
  "Envoyer par WhatsApp (PDF)",
  "Afficher le bon de livraison"
];
const SECTIONS_CACHEES_VENDEUR = ["Produits et prestations", "Bilan des ventes"];

function cacherPourVendeur() {
  document.querySelectorAll("button").forEach(b => {
    if (BOUTONS_CACHES_VENDEUR.includes(b.textContent.trim())) {
      b.style.display = "none";
    }
  });
  document.querySelectorAll("section").forEach(s => {
    const titre = s.querySelector("h2");
    if (titre && SECTIONS_CACHEES_VENDEUR.includes(titre.textContent.trim())) {
      s.style.display = "none";
    }
  });
}

function ajouterBoutonDeconnexion() {
  const bouton = document.createElement("button");
  bouton.textContent = "Se déconnecter";
  bouton.className = "secondaire";
  bouton.style.cssText = "width:auto;margin-left:auto;padding:6px 10px;font-size:14px";
  bouton.addEventListener("click", deconnexion);
  document.querySelector("header").appendChild(bouton);
}

(async () => {
  const { data } = await dbAuth.auth.getSession();

  if (!data.session) {
    window.location.href = "login.html";
    return;
  }

  const { data: profil } = await dbAuth
    .from("profils")
    .select("role")
    .eq("id", data.session.user.id)
    .single();

  if (!profil) {
    alert("Ce compte n'a pas de rôle attribué.");
    await deconnexion();
    return;
  }

  ajouterBoutonDeconnexion();

  if (profil.role === "vendeur") {
    document.body.classList.add("vendeur");
    cacherPourVendeur();
    // Les listes sont redessinées par l'application : on surveille les changements
    new MutationObserver(cacherPourVendeur).observe(document.body, { childList: true, subtree: true });
  }
})();
