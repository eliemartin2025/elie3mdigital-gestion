const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let lignesEnCours = [];
let factureCourante = null;

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

/* ---------- PRODUITS ---------- */

async function chargerProduits() {
  const { data, error } = await db.from("produits").select("*").order("nom");
  if (error) return afficherMessage("Erreur produits : " + error.message, "err");

  const tbody = document.getElementById("liste-produits");
  const select = document.getElementById("f-produit");
  tbody.innerHTML = "";
  select.innerHTML = '<option value="">-- Choisir un produit --</option>';

  data.forEach(p => {
    tbody.innerHTML += `<tr>
      <td>${echapper(p.nom)}</td>
      <td>${formaterMontant(p.prix_unitaire)}</td>
      <td><button type="button" class="danger" onclick="supprimerProduit(${p.id}, '${echapper(p.nom).replace(/'/g, "\\'")}')">Supprimer</button></td>
    </tr>`;
    select.innerHTML += `<option value="${p.id}" data-prix="${p.prix_unitaire}" data-nom="${echapper(p.nom)}">${echapper(p.nom)}</option>`;
  });
}

async function supprimerProduit(id, nom) {
  if (!confirm("Supprimer le produit « " + nom + " » ?")) return;
  const { error } = await db.from("produits").delete().eq("id", id);
  if (error) return afficherMessage("Erreur : " + error.message, "err");
  afficherMessage("Produit supprimé.", "ok");
  chargerProduits();
}

document.getElementById("form-produit").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nouveauProduit = {
    nom: document.getElementById("p-nom").value.trim(),
    prix_unitaire: Number(document.getElementById("p-prix").value),
    description: document.getElementById("p-description").value.trim()
  };
  const { error } = await db.from("produits").insert(nouveauProduit);
  if (error) return afficherMessage("Erreur : " + error.message, "err");
  afficherMessage("Produit ajouté.", "ok");
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

  if (!option || !option.value) return afficherMessage("Choisis un produit.", "err");
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
    .select("*, clients(nom, email, telephone, adresse), lignes_facture(*)")
    .eq("id", id)
    .single();
  if (error) return afficherMessage("Erreur : " + error.message, "err");

  factureCourante = f;

  const lignesHtml = f.lignes_facture.map(l => `
    <tr>
      <td>${echapper(l.designation)}</td>
      <td>${l.quantite}</td>
      <td>${formaterMontant(l.prix_unitaire)}</td>
      <td>${formaterMontant(l.total)}</td>
    </tr>`).join("");

  document.getElementById("facture-imprimable").innerHTML = `
    <h2>Elie3MDigital</h2>
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

  document.getElementById("section-apercu").style.display = "block";
  document.getElementById("section-apercu").scrollIntoView({ behavior: "smooth" });
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

function nomFichierPDF() {
  return "Facture-" + factureCourante.numero.replace(/[^a-zA-Z0-9_-]/g, "_") + ".pdf";
}

async function creerPDF(f) {
  const jsPDF = await chargerJsPDF();
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(18);
  doc.setTextColor(30, 77, 140);
  doc.text("Elie3MDigital", 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("Votre partenaire digital au quotidien", 14, y);
  y += 14;

  doc.setFontSize(14);
  doc.text("Facture " + f.numero, 14, y);
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
  doc.text("Prix", 145, y);
  doc.text("Total", 190, y, { align: "right" });
  doc.line(14, y + 2, 196, y + 2);
  doc.setFont(undefined, "normal");
  y += 9;

  (f.lignes_facture || []).forEach(l => {
    doc.text(String(l.designation), 14, y);
    doc.text(String(l.quantite), 115, y);
    doc.text(formaterMontant(l.prix_unitaire), 145, y);
    doc.text(formaterMontant(l.total), 190, y, { align: "right" });
    y += 8;
  });

  doc.line(14, y, 196, y);
  y += 8;
  doc.setFontSize(13);
  doc.setFont(undefined, "bold");
  doc.text("Total : " + formaterMontant(f.montant_total), 190, y, { align: "right" });

  return doc;
}

async function telechargerPDF() {
  if (!factureCourante) return;
  try {
    const doc = await creerPDF(factureCourante);
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
  if (!factureCourante) return;
  try {
    const doc = await creerPDF(factureCourante);
    const blob = doc.output("blob");
    const fichier = new File([blob], nomFichierPDF(), { type: "application/pdf" });
    const texte = "Bonjour, veuillez trouver votre facture " + factureCourante.numero +
                  ". Total : " + formaterMontant(factureCourante.montant_total);

    if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
      await navigator.share({ files: [fichier], title: "Facture " + factureCourante.numero, text: texte });
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

function creerBoutonsPDF() {
  const section = document.getElementById("section-apercu");
  const div = document.createElement("div");
  div.innerHTML = `
    <button type="button" id="btn-pdf">Télécharger le PDF</button>
    <button type="button" id="btn-whatsapp">Envoyer par WhatsApp (PDF)</button>`;
  section.insertBefore(div, document.getElementById("btn-imprimer"));

  document.getElementById("btn-pdf").addEventListener("click", telechargerPDF);
  document.getElementById("btn-whatsapp").addEventListener("click", envoyerWhatsApp);
}

document.getElementById("btn-imprimer").addEventListener("click", () => window.print());
document.getElementById("btn-fermer-apercu").addEventListener("click", () => {
  document.getElementById("section-apercu").style.display = "none";
});

/* ---------- DÉMARRAGE ---------- */

creerBoutonsPDF();
chargerProduits();
chargerClients();
chargerFactures();
