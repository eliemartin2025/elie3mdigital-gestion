const dbBilan = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function montantBilan(n) {
  return Number(n || 0).toFixed(2);
}

function creerSectionBilan() {
  const main = document.querySelector("main");
  const sectionFactures = document.getElementById("liste-factures").closest("section");

  const section = document.createElement("section");
  section.innerHTML = `
    <h2>Bilan des ventes</h2>
    <div id="zone-bilan"></div>
    <button type="button" id="btn-actualiser-bilan" class="secondaire">Actualiser le bilan</button>`;

  main.insertBefore(section, sectionFactures);
  document.getElementById("btn-actualiser-bilan").addEventListener("click", chargerBilan);
}

async function chargerBilan() {
  const zone = document.getElementById("zone-bilan");
  zone.textContent = "Chargement...";

  const { data, error } = await dbBilan
    .from("lignes_facture")
    .select("quantite, total, produits(type)");

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
    <p style="font-size:13px;color:#666">Montants sans TVA. Le bilan porte sur toutes les factures enregistrées.</p>`;
}

creerSectionBilan();
chargerBilan();

// Met le bilan à jour quelques secondes après l'enregistrement d'une facture
document.getElementById("form-facture").addEventListener("submit", () => {
  setTimeout(chargerBilan, 2000);
});
