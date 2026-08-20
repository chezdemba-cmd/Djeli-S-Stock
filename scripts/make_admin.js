// Usage : node scripts/make_admin.js utilisateur@example.com
// Promeut UN SEUL compte (identifié par e-mail) au rôle super_admin.
// Nécessite SUPABASE_SERVICE_ROLE_KEY dans .env.local. Ne jamais committer cette clé.

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const targetEmail = process.argv[2];
if (!targetEmail) {
  console.error("Usage : node scripts/make_admin.js utilisateur@example.com");
  process.exit(1);
}

const envPath = path.join(__dirname, '..', '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY manquante dans .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: userList, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error("Erreur recherche utilisateur :", listErr);
    process.exit(1);
  }

  const user = userList.users.find(u => u.email?.toLowerCase() === targetEmail.toLowerCase());
  if (!user) {
    console.error(`Aucun utilisateur trouvé avec l'e-mail ${targetEmail}`);
    process.exit(1);
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ is_super_admin: true })
    .eq('id', user.id)
    .select();

  if (error) {
    console.error("Erreur :", error);
    process.exit(1);
  }

  console.log(`Compte ${targetEmail} (${user.id}) promu super_admin.`, data);
}

main();
