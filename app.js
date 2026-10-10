const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let lignesEnCours = [];
let factureCourante = null;
let modeCourant = "facture";

function echapper(texte) {
  const div = document.createElement("div");
  div.textContent = texte ?? "";
  return div.innerHTML;
}

function afficherMessage(texte, type) {
  const box = document.getElementById("message");
  box.textContent = texte;
  box.className = type;
  setTimeout(() => { box.className = ""; box.textContent = ""; }, 4000);
}

function formaterMontant(n) {
  return Number(n || 0).toFixed(2);
}

function ajouterColonneAction(idTbody) {
  const table = document.getElementById(idTbody).closest("table");
  const tr = table.querySelector("thead tr");
  if (!tr.querySelector(".col-action")) {
    const th = document.createElement("th");
    th.className = "col-action";
    th.textContent = "Action";
    tr.appendChild(th);
  }
}

ajouterColonneAction("liste-produits");
ajouterColonneAction("liste-clients");

/* ---------- PRODUITS ET PRESTATIONS ---------- */

async function chargerProduits() {
  const { data, error } = await db.from("produits").select("*").order("nom");
  if (error) return afficherMessage("Erreur produits : " + error.message, "err");

  const tbody = document.getElementById("liste-produits");
  const select = document.getElementById("f-produit");
  tbody.innerHTML = "";
  select.innerHTML = '<option value="">-- Choisir un produit ou une prestation --</option>';

  data.forEach(p => {
    const type = p.type === "prestation" ? "Prestation" : "Produit";
    tbody.innerHTML += `<tr>
      <td>${echapper(p.nom)}</td>
      <td>${type}</td>
      <td>${formaterMontant(p.prix_unitaire)}</td>
      <td><button type="button" class="danger" onclick="supprimerProduit(${p.id}, '${echapper(p.nom).replace(/'/g, "\\'")}')">Supprimer</button></td>
    </tr>`;
    select.innerHTML += `<option value="${p.id}" data-prix="${p.prix_unitaire}" data-nom="${echapper(p.nom)}">${echapper(p.nom)}</option>`;
  });
}

async function supprimerProduit(id, nom) {
  if (!confirm("Supprimer « " + nom + " » ?")) return;
  const { error } = await db.from("produits").delete().eq("id", id);
  if (error) return afficherMessage("Erreur : " + error.message, "err");
  afficherMessage("Supprimé.", "ok");
  chargerProduits();
}

document.getElementById("form-produit").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nouveau = {
    nom: document.getElementById("p-nom").value.trim(),
    type: document.getElementById("p-type").value,
    unite: document.getElementById("p-unite").value.trim() || "unité",
    prix_unitaire: Number(document.getElementById("p-prix").value),
    description: document.getElementById("p-description").value.trim()
  };
  const { error } = await db.from("produits").insert(nouveau);
  if (error) return afficherMessage("Erreur : " + error.message, "err");
  afficherMessage("Ajouté.", "ok");
  e.target.reset();
  chargerProduits();
});

/* ---------- CLIENTS ---------- */

async function chargerClients() {
  const { data, error } = await db.from("clients").select("*").order("nom");
  if (error) return afficherMessage("Erreur clients : " + error.message, "err");

  const tbody = document.getElementById("liste-clients");
  const select = document.getElementById("f-client");
  tbody.innerHTML = "";
  select.innerHTML = '<option value="">-- Choisir un client --</option>';

  data.forEach(c => {
    tbody.innerHTML += `<tr>
      <td>${echapper(c.nom)}</td>
      <td>${echapper(c.email)}</td>
      <td>${echapper(c.telephone)}</td>
      <td><button type="button" class="danger" onclick="supprimerClient(${c.id}, '${echapper(c.nom).replace(/'/g, "\\'")}')">Supprimer</button></td>
    </tr>`;
    select.innerHTML += `<option value="${c.id}">${echapper(c.nom)}</option>`;
  });
}

async function supprimerClient(id, nom) {
  if (!confirm("Supprimer le client « " + nom + " » ET toutes ses factures ?")) return;
  const { error } = await db.from("clients").delete().eq("id", id);
  if (error) return afficherMessage("Erreur : " + error.message, "err");
  afficherMessage("Client supprimé.", "ok");
  chargerClients();
  chargerFactures();
}

document.getElementById("form-client").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nouveauClient = {
    nom: document.getElementById("c-nom").value.trim(),
    email: document.getElementById("c-email").value.trim(),
    telephone: document.getElementById("c-telephone").value.trim(),
    adresse: document.getElementById("c-adresse").value.trim()
  };
  const { error } = await db.from("clients").insert(nouveauClient);
  if (error) return afficherMessage("Erreur : " + error.message, "err");
  afficherMessage("Client ajouté.", "ok");
  e.target.reset();
  chargerClients();
});

/* ---------- LIGNES DE FACTURE ---------- */

function rafraichirLignes() {
  const tbody = document.getElementById("lignes-facture");
  tbody.innerHTML = "";
  let total = 0;

  lignesEnCours.forEach((l, index) => {
    const sousTotal = l.quantite * l.prix_unitaire;
    total += sousTotal;
    tbody.innerHTML += `<tr>
      <td>${echapper(l.designation)}</td>
      <td>${l.quantite}</td>
      <td>${formaterMontant(l.prix_unitaire)}</td>
      <td>${formaterMontant(sousTotal)}</td>
      <td><button type="button" class="danger" onclick="supprimerLigne(${index})">Retirer</button></td>
    </tr>`;
  });

  document.getElementById("f-total").textContent = formaterMontant(total);
}

function supprimerLigne(index) {
  lignesEnCours.splice(index, 1);
  rafraichirLignes();
}

document.getElementById("btn-ajouter-ligne").addEventListener("click", () => {
  const select = document.getElementById("f-produit");
  const option = select.options[select.selectedIndex];
  const quantite = Number(document.getElementById("f-quantite").value);

  if (!option || !option.value) return afficherMessage("Choisis un produit ou une prestation.", "err");
  if (!quantite || quantite <= 0) return afficherMessage("Quantité invalide.", "err");

  lignesEnCours.push({
    produit_id: Number(option.value),
    designation: option.dataset.nom,
    quantite: quantite,
    prix_unitaire: Number(option.dataset.prix)
  });

  document.getElementById("f-quantite").value = 1;
  select.value = "";
  rafraichirLignes();
});

/* ---------- FACTURES ---------- */

async function chargerFactures() {
  const { data, error } = await db
    .from("factures")
    .select("id, numero, date_facture, montant_total, clients(nom)")
    .order("created_at", { ascending: false });
  if (error) return afficherMessage("Erreur factures : " + error.message, "err");

  const tbody = document.getElementById("liste-factures");
  tbody.innerHTML = "";
  data.forEach(f => {
    tbody.innerHTML += `<tr>
      <td>${echapper(f.numero)}</td>
      <td>${echapper(f.clients?.nom)}</td>
      <td>${echapper(f.date_facture)}</td>
      <td>${formaterMontant(f.montant_total)}</td>
      <td>
        <button type="button" class="secondaire" onclick="voirFacture(${f.id})">Voir</button>
        <button type="button" class="danger" onclick="supprimerFacture(${f.id}, '${echapper(f.numero).replace(/'/g, "\\'")}')">Supprimer</button>
      </td>
    </tr>`;
  });
}

async function supprimerFacture(id, numero) {
  if (!confirm("Supprimer la facture « " + numero + " » ?")) return;
  const { error } = await db.from("factures").delete().eq("id", id);
  if (error) return afficherMessage("Erreur : " + error.message, "err");

  if (factureCourante && factureCourante.id === id) {
    factureCourante = null;
    document.getElementById("section-apercu").style.display = "none";
  }
  afficherMessage("Facture supprimée.", "ok");
  chargerFactures();
}

document.getElementById("form-facture").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (lignesEnCours.length === 0) {
    return afficherMessage("Ajoute au moins une ligne à la facture.", "err");
  }

  const total = lignesEnCours.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);

  const { data: facture, error: errFacture } = await db
    .from("factures")
    .insert({
      numero: document.getElementById("f-numero").value.trim(),
      client_id: Number(document.getElementById("f-client").value),
      montant_total: total
    })
    .select()
    .single();

  if (errFacture) return afficherMessage("Erreur facture : " + errFacture.message, "err");

  const lignes = lignesEnCours.map(l => ({
    facture_id: facture.id,
    produit_id: l.produit_id,
    designation: l.designation,
    quantite: l.quantite,
    prix_unitaire: l.prix_unitaire,
    total: l.quantite * l.prix_unitaire
  }));

  const { error: errLignes } = await db.from("lignes_facture").insert(lignes);
  if (errLignes) return afficherMessage("Erreur lignes : " + errLignes.message, "err");

  afficherMessage("Facture enregistrée.", "ok");
  lignesEnCours = [];
  e.target.reset();
  rafraichirLignes();
  chargerFactures();
});

async function voirFacture(id) {
  const { data: f, error } = await db
    .from("factures")
    .select("*, clients(nom, email, telephone, adresse), lignes_facture(*, produits(type, unite))")
    .eq("id", id)
    .single();
  if (error) return afficherMessage("Erreur : " + error.message, "err");

  factureCourante = f;
  afficherApercu("facture");
}

/* ---------- DOCUMENTS : FACTURE ET BON DE LIVRAISON ---------- */

// Un bon de livraison ne reprend que les produits, pas les prestations
function lignesPourMode(f, mode) {
  const lignes = f.lignes_facture || [];
  if (mode === "livraison") {
    return lignes.filter(l => l.produits?.type !== "prestation");
  }
  return lignes;
}

function genererHtmlDocument(f, mode) {
  const lignes = lignesPourMode(f, mode);
  const entete = `<img src="logo.png" alt="Logo Elie3MDigital" style="height:80px;display:block;margin-bottom:8px">`;

  if (mode === "livraison") {
    if (lignes.length === 0) {
      return "<p>Cette facture ne contient que des prestations : il n'y a pas de bon de livraison.</p>";
    }
    const lignesHtml = lignes.map(l => `
      <tr>
        <td>${echapper(l.designation)}</td>
        <td>${l.quantite}</td>
        <td>${echapper(l.produits?.unite || "")}</td>
      </tr>`).join("");

    return `
      ${entete}
      <h2>Bon de livraison ${echapper(f.numero)}</h2>
      <p>Date : ${echapper(f.date_facture)}</p>
      <p><strong>Client :</strong> ${echapper(f.clients?.nom)}<br>
         ${echapper(f.clients?.adresse)}<br>
         ${echapper(f.clients?.telephone)}</p>
      <table>
        <thead><tr><th>Désignation</th><th>Quantité</th><th>Unité</th></tr></thead>
        <tbody>${lignesHtml}</tbody>
      </table>
      <p style="margin-top:40px">Reçu par : ____________________ &nbsp;&nbsp; Signature : ____________________</p>
    `;
  }

  const lignesHtml = lignes.map(l => `
    <tr>
      <td>${echapper(l.designation)}</td>
      <td>${l.quantite}</td>
      <td>${formaterMontant(l.prix_unitaire)}</td>
      <td>${formaterMontant(l.total)}</td>
    </tr>`).join("");

  return `
    ${entete}
    <h2>Facture ${echapper(f.numero)}</h2>
    <p>Date : ${echapper(f.date_facture)}</p>
    <p><strong>Client :</strong> ${echapper(f.clients?.nom)}<br>
       ${echapper(f.clients?.adresse)}<br>
       ${echapper(f.clients?.telephone)}</p>
    <table>
      <thead><tr><th>Désignation</th><th>Qté</th><th>Prix</th><th>Total</th></tr></thead>
      <tbody>${lignesHtml}</tbody>
    </table>
    <div class="total">Total : ${formaterMontant(f.montant_total)}</div>
  `;
}

function afficherApercu(mode) {
  if (!factureCourante) return;
  modeCourant = mode;
  document.getElementById("facture-imprimable").innerHTML = genererHtmlDocument(factureCourante, mode);
  const section = document.getElementById("section-apercu");
  section.style.display = "block";
  section.scrollIntoView({ behavior: "smooth" });
}

function nomFichierPDF() {
  const prefixe = modeCourant === "livraison" ? "BL-" : "Facture-";
  return prefixe + factureCourante.numero.replace(/[^a-zA-Z0-9_-]/g, "_") + ".pdf";
}

function verifierDocument() {
  if (!factureCourante) return false;
  if (modeCourant === "livraison" && lignesPourMode(factureCourante, "livraison").length === 0) {
    afficherMessage("Pas de bon de livraison : cette facture ne contient que des prestations.", "err");
    return false;
  }
  return true;
}

/* ---------- PDF ET WHATSAPP ---------- */

function chargerJsPDF() {
  return new Promise((resolve, reject) => {
    if (window.jspdf) return resolve(window.jspdf.jsPDF);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = () => resolve(window.jspdf.jsPDF);
    s.onerror = () => reject(new Error("Impossible de charger le générateur PDF"));
    document.head.appendChild(s);
  });
}

// Charge le logo sous forme de données, pour l'inclure dans le PDF
function chargerLogoPDF() {
  return fetch("logo.png")
    .then(r => (r.ok ? r.blob() : null))
    .then(blob => {
      if (!blob) return null;
      return new Promise(resolve => {
        const lecteur = new FileReader();
        lecteur.onload = () => resolve(lecteur.result);
        lecteur.onerror = () => resolve(null);
        lecteur.readAsDataURL(blob);
      });
    })
    .catch(() => null);
}

async function creerPDF(f, mode) {
  const jsPDF = await chargerJsPDF();
  const doc = new jsPDF();
  const livraison = mode === "livraison";
  const lignes = lignesPourMode(f, mode);

  const logo = await chargerLogoPDF();
  if (logo) doc.addImage(logo, "PNG", 14, 8, 36, 36);

  doc.setFontSize(18);
  doc.setTextColor(30, 77, 140);
  doc.text("Elie3MDigital", 56, 20);
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("Votre partenaire digital au quotidien", 56, 27);

  let y = 50;

  doc.setFontSize(14);
  doc.text((livraison ? "Bon de livraison " : "Facture ") + f.numero, 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.text("Date : " + (f.date_facture || ""), 14, y);
  y += 10;

  doc.text("Client : " + (f.clients?.nom || ""), 14, y);
  y += 5;
  if (f.clients?.adresse) { doc.text(f.clients.adresse, 14, y); y += 5; }
  if (f.clients?.telephone) { doc.text(f.clients.telephone, 14, y); y += 5; }
  y += 8;

  doc.setFont(undefined, "bold");
  doc.text("Désignation", 14, y);
  doc.text("Qté", 115, y);
  if (livraison) {
    doc.text("Unité", 145, y);
  } else {
    doc.text("Prix", 145, y);
    doc.text("Total", 190, y, { align: "right" });
  }
  doc.line(14, y + 2, 196, y + 2);
  doc.setFont(undefined, "normal");
  y += 9;

  lignes.forEach(l => {
    doc.text(String(l.designation), 14, y);
    doc.text(String(l.quantite), 115, y);
    if (livraison) {
      doc.text(String(l.produits?.unite || ""), 145, y);
    } else {
      doc.text(formaterMontant(l.prix_unitaire), 145, y);
      doc.text(formaterMontant(l.total), 190, y, { align: "right" });
    }
    y += 8;
  });

  doc.line(14, y, 196, y);
  y += 10;

  if (livraison) {
    doc.setFontSize(10);
    doc.text("Reçu par : ____________________", 14, y);
    doc.text("Signature : ____________________", 110, y);
  } else {
    doc.setFontSize(13);
    doc.setFont(undefined, "bold");
    doc.text("Total : " + formaterMontant(f.montant_total), 190, y, { align: "right" });
  }

  return doc;
}

async function telechargerPDF() {
  if (!verifierDocument()) return;
  try {
    const doc = await creerPDF(factureCourante, modeCourant);
    doc.save(nomFichierPDF());
  } catch (err) {
    afficherMessage("Erreur PDF : " + err.message, "err");
  }
}

function ouvrirWhatsApp(texte) {
  const tel = (factureCourante.clients?.telephone || "").replace(/\D/g, "");
  if (!tel) return afficherMessage("Ce client n'a pas de numéro de téléphone.", "err");
  window.open("https://wa.me/" + tel + "?text=" + encodeURIComponent(texte), "_blank");
}

async function envoyerWhatsApp() {
  if (!verifierDocument()) return;
  try {
    const doc = await creerPDF(factureCourante, modeCourant);
    const blob = doc.output("blob");
    const fichier = new File([blob], nomFichierPDF(), { type: "application/pdf" });

    const texte = modeCourant === "livraison"
      ? "Bonjour, veuillez trouver votre bon de livraison " + factureCourante.numero + "."
      : "Bonjour, veuillez trouver votre facture " + factureCourante.numero +
        ". Total : " + formaterMontant(factureCourante.montant_total);

    if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
      await navigator.share({ files: [fichier], title: nomFichierPDF(), text: texte });
      return;
    }

    doc.save(nomFichierPDF());
    ouvrirWhatsApp(texte);
    afficherMessage("PDF téléchargé. Joins-le dans WhatsApp.", "ok");
  } catch (err) {
    if (err.name === "AbortError") return;
    afficherMessage("Erreur WhatsApp : " + err.message, "err");
  }
}

function creerBoutonsDocuments() {
  const section = document.getElementById("section-apercu");
  const div = document.createElement("div");
  div.innerHTML = `
    <button type="button" id="btn-afficher-facture">Afficher la facture</button>
    <button type="button" id="btn-afficher-bl">Afficher le bon de livraison</button>
    <button type="button" id="btn-pdf">Télécharger le PDF</button>
    <button type="button" id="btn-whatsapp">Envoyer par WhatsApp (PDF)</button>`;
  section.insertBefore(div, document.getElementById("btn-imprimer"));

  document.getElementById("btn-afficher-facture").addEventListener("click", () => {
    if (factureCourante) afficherApercu("facture");
  });
  document.getElementById("btn-afficher-bl").addEventListener("click", () => {
    if (factureCourante) afficherApercu("livraison");
  });
  document.getElementById("btn-pdf").addEventListener("click", telechargerPDF);
  document.getElementById("btn-whatsapp").addEventListener("click", envoyerWhatsApp);
}

document.getElementById("btn-imprimer").addEventListener("click", () => {
  if (verifierDocument()) window.print();
});
document.getElementById("btn-fermer-apercu").addEventListener("click", () => {
  document.getElementById("section-apercu").style.display = "none";
});

/* ---------- DÉMARRAGE ---------- */

creerBoutonsDocuments();
chargerProduits();
chargerClients();
chargerFactures();
