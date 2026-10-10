const dbBilan = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function montantBilan(n) {
  return Number(n || 0).toFixed(2);
}

// Date au format AAAA-MM-JJ, en heure locale
function formaterIso(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function periodeAujourdhui() {
  const d = formaterIso(new Date());
  return { debut: d, fin: d };
}

// La semaine va du lundi au dimanche
function periodeSemaine() {
  const d = new Date();
  const decalage = (d.getDay() + 6) % 7;
  const lundi = new Date(d);
  lundi.setDate(d.getDate() - decalage);
  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);
  return { debut: formaterIso(lundi), fin: formaterIso(dimanche) };
}

function periodeMois() {
  const d = new Date();
  const premier = new Date(d.getFullYear(), d.getMonth(), 1);
  const dernier = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { debut: formaterIso(premier), fin: formaterIso(dernier) };
}

function formaterDate(iso) {
  if (!iso) return "";
  return iso.split("-").reverse().join("/");
}

function appliquerPeriode(p) {
  document.getElementById("b-debut").value = p.debut;
  document.getElementById("b-fin").value = p.fin;
  chargerBilan();
}

function creerSectionBilan() {
  const main = document.querySelector("main");
  const sectionFactures = document.getElementById("liste-factures").closest("section");
  const mois = periodeMois();

  const section = document.createElement("section");
  section.innerHTML = `
    <h2>Bilan des ventes</h2>
    <div class="deux-colonnes">
      <div>
        <label>Du</label>
        <input id="b-debut" type="date" value="${mois.debut}">
      </div>
      <div>
        <label>Au</label>
        <input id="b-fin" type="date" value="${mois.fin}">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">
      <button type="button" id="btn-bilan-jour" class="secondaire">Aujourd'hui</button>
      <button type="button" id="btn-bilan-semaine" class="secondaire">Cette semaine</button>
      <button type="button" id="btn-bilan-mois" class="secondaire">Ce mois</button>
      <button type="button" id="btn-bilan-tout" class="secondaire">Toute la période</button>
    </div>
    <div id="zone-bilan"></div>`;

  main.insertBefore(section, sectionFactures);

  document.getElementById("b-debut").addEventListener("change", chargerBilan);
  document.getElementById("b-fin").addEventListener("change", chargerBilan);
  document.getElementById("btn-bilan-jour").addEventListener("click", () => appliquerPeriode(periodeAujourdhui()));
  document.getElementById("btn-bilan-semaine").addEventListener("click", () => appliquerPeriode(periodeSemaine()));
  document.getElementById("btn-bilan-mois").addEventListener("click", () => appliquerPeriode(periodeMois()));
  document.getElementById("btn-bilan-tout").addEventListener("click", () => {
    document.getElementById("b-debut").value = "";
    document.getElementById("b-fin").value = "";
    chargerBilan();
  });
}

async function chargerBilan() {
  const zone = document.getElementById("zone-bilan");
  const debut = document.getElementById("b-debut").value;
  const fin = document.getElementById("b-fin").value;
  zone.textContent = "Chargement...";

  // !inner : ne garde que les lignes dont la facture existe, pour filtrer sur sa date
  let requete = dbBilan
    .from("lignes_facture")
    .select("quantite, total, produits(type), factures!inner(date_facture)");

  if (debut) requete = requete.gte("factures.date_facture", debut);
  if (fin) requete = requete.lte("factures.date_facture", fin);

  const { data, error } = await requete;

  if (error) {
    zone.textContent = "Erreur bilan : " + error.message;
    return;
  }

  const cumul = {
    produit: { lignes: 0, montant: 0 },
    prestation: { lignes: 0, montant: 0 },
    autre: { lignes: 0, montant: 0 }
  };

  data.forEach(l => {
    const type = l.produits?.type;
    const cle = type === "prestation" ? "prestation" : type === "produit" ? "produit" : "autre";
    cumul[cle].lignes += 1;
    cumul[cle].montant += Number(l.total || 0);
  });

  const totalLignes = cumul.produit.lignes + cumul.prestation.lignes + cumul.autre.lignes;
  const totalMontant = cumul.produit.montant + cumul.prestation.montant + cumul.autre.montant;

  let periode;
  if (debut && fin) periode = "Du " + formaterDate(debut) + " au " + formaterDate(fin);
  else if (debut) periode = "À partir du " + formaterDate(debut);
  else if (fin) periode = "Jusqu'au " + formaterDate(fin);
  else periode = "Toute la période";

  let lignesHtml = `
    <tr>
      <td>Produits</td>
      <td>${cumul.produit.lignes}</td>
      <td>${montantBilan(cumul.produit.montant)}</td>
    </tr>
    <tr>
      <td>Prestations</td>
      <td>${cumul.prestation.lignes}</td>
      <td>${montantBilan(cumul.prestation.montant)}</td>
    </tr>`;

  if (cumul.autre.lignes > 0) {
    lignesHtml += `
    <tr>
      <td>Autre (produit supprimé)</td>
      <td>${cumul.autre.lignes}</td>
      <td>${montantBilan(cumul.autre.montant)}</td>
    </tr>`;
  }

  zone.innerHTML = `
    <p><strong>${periode}</strong></p>
    <table>
      <thead>
        <tr><th>Type</th><th>Lignes vendues</th><th>Montant</th></tr>
      </thead>
      <tbody>${lignesHtml}</tbody>
      <tfoot>
        <tr>
          <th>Total</th>
          <th>${totalLignes}</th>
          <th>${montantBilan(totalMontant)}</th>
        </tr>
      </tfoot>
    </table>
    <p style="font-size:13px;color:#666">Montants sans TVA.</p>`;
}

creerSectionBilan();
chargerBilan();

// Met le bilan à jour après l'enregistrement d'une facture
document.getElementById("form-facture").addEventListener("submit", () => {
  setTimeout(chargerBilan, 2000);
});
