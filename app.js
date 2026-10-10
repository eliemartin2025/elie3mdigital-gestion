const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    </tr>`;
    select.innerHTML += `<option value="${c.id}">${echapper(c.nom)}</option>`;
  });
}

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
      <td>${Number(f.montant_total).toFixed(2)}</td>
    </tr>`;
  });
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

document.getElementById("form-facture").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nouvelleFacture = {
    numero: document.getElementById("f-numero").value.trim(),
    client_id: Number(document.getElementById("f-client").value),
    montant_total: Number(document.getElementById("f-montant").value)
  };
  const { error } = await db.from("factures").insert(nouvelleFacture);
  if (error) return afficherMessage("Erreur : " + error.message, "err");
  afficherMessage("Facture créée.", "ok");
  e.target.reset();
  chargerFactures();
});

chargerClients();
chargerFactures();
