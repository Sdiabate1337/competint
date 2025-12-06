# Comment Déployer les Migrations sur Supabase

## ⚠️ IMPORTANT : Vous devez exécuter ces migrations sur Supabase Cloud, PAS localement

L'erreur `pgvector is not available` signifie que vous essayez d'exécuter les migrations sur une base PostgreSQL locale au lieu de votre projet Supabase Cloud.

---

## Méthode 1 : Via le Dashboard Supabase (RECOMMANDÉE)

### Étape 1 : Activer pgvector

1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Dans le menu de gauche : **Database** → **Extensions**
4. Cherchez "vector" dans la barre de recherche
5. Activez l'extension `vector` en cliquant sur le toggle
6. Attendez quelques secondes

### Étape 2 : Exécuter les migrations via SQL Editor

1. Toujours dans le dashboard, allez à **SQL Editor** (menu de gauche)
2. Cliquez sur **New query**
3. Ouvrez le fichier `supabase/migrations/20231202_initial_schema.sql` localement
4. Copiez tout le contenu
5. Collez-le dans l'éditeur SQL de Supabase
6. Cliquez sur **Run** (en bas à droite)
7. Attendez que l'exécution se termine

8. Répétez pour `supabase/migrations/20231202_rls_policies.sql` :
   - New query → Copier/Coller → Run

### ✅ Vérification

Pour vérifier que tout fonctionne, exécutez dans le SQL Editor :

```sql
-- Vérifier que pgvector est activé
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Vérifier que les tables sont créées
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Vous devriez voir 10+ tables créées.

---

## Méthode 2 : Via Supabase CLI

### Installation

```bash
# macOS
brew install supabase/tap/supabase

# Autres plateformes : https://supabase.com/docs/guides/cli
```

### Connexion à votre projet

```bash
# Récupérez votre Project Ref depuis le dashboard :
# Settings > General > Reference ID

supabase link --project-ref votre-project-ref
```

### Exécution des migrations

```bash
# Depuis le dossier racine du projet
cd /Users/macook/Desktop/compet-int

# Activer pgvector d'abord
echo "CREATE EXTENSION IF NOT EXISTS vector;" > supabase/migrations/00000000000000_enable_vector.sql

# Pousser toutes les migrations
supabase db push
```

---

## Alternative : Migration Sans pgvector (Pour Tests Locaux UNIQUEMENT)

Si vous voulez juste tester l'application localement sans la fonctionnalité de recherche sémantique :

1. Utilisez le fichier `20231202_initial_schema_no_vector.sql` à la place
2. Ce fichier ne contient pas de colonnes `embedding` ni de fonction `match_competitors`
3. ⚠️ Ceci est pour le développement local uniquement - utilisez la version complète en production

---

## Résolution des Problèmes

### "Extension pgvector is not available"

**Cause :** Vous exécutez les migrations sur une base PostgreSQL locale.

**Solution :** Utilisez le SQL Editor de Supabase ou la CLI comme décrit ci-dessus.

### "CREATE EXTENSION must be run as superuser"

**Cause :** Vous essayez d'activer l'extension manuellement.

**Solution :** Sur Supabase Cloud, activez via le dashboard Extensions (méthode 1).

### "Permission denied for schema public"

**Cause :** Problème de permissions.

**Solution :** Assurez-vous d'utiliser le SQL Editor de Supabase avec votre compte authentifié.

---

## Vérification de la Configuration

Après avoir exécuté les migrations, vérifiez que votre `.env` pointe vers Supabase :

```bash
# backend/.env et frontend/.env.local doivent contenir :
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (depuis Dashboard > Settings > API)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (depuis Dashboard > Settings > API)
```

---

## Support

Si vous rencontrez toujours des problèmes, vérifiez que :
- [ ] Vous avez bien créé un projet sur Supabase Cloud
- [ ] Vous exécutez les migrations via le SQL Editor de Supabase, pas localement
- [ ] L'extension vector est activée dans Database > Extensions
- [ ] Vos variables d'environnement pointent vers votre projet Supabase Cloud
