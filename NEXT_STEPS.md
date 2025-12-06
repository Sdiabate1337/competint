# Guide de Configuration Finale - CompetInt SaaS

## ✅ Ce qui est déjà fait

### Frontend
- ✅ Next.js 14 avec design premium
- ✅ Pages d'authentification (login/signup)
- ✅ Dashboard protégé avec middleware
- ✅ Landing page avec copywriting français

### Backend
- ✅ NestJS avec modules (Organizations, Discovery, Competitors)
- ✅ Services Supabase intégrés
- ✅ API endpoints REST complets
- ✅ Build réussi

### Database
- ✅ Schéma créé dans Supabase (sans pgvector)
- ✅ 10 tables : organizations, projects, competitors, etc.

---

## 🔧 Configuration Requise

### backend/.env

Créez ce fichier et remplissez avec vos vraies valeurs:

```bash
# Application
NODE_ENV=development
PORT=4000

# Supabase (RÉCUPÉREZ CES VALEURS depuis https://supabase.com/dashboard)
# Settings > API > Project URL
SUPABASE_URL=https://votre-project-id.supabase.co

# Settings > API > Project API keys > anon public
SUPABASE_ANON_KEY=eyJhbGc...

# Settings > API > Project API keys > service_role (secret!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Redis (pour tests locaux uniquement)
REDIS_HOST=localhost
REDIS_PORT=6379

# OpenAI (optionnel pour l'instant - pour LLM extraction plus tard)
OPENAI_API_KEY=sk-...

# SERP API (optionnel pour l'instant)
SERPAPI_KEY=...

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

### frontend/.env.local

```bash
NEXT_PUBLIC_SUPABASE_URL=https://votre-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

---

## 🚀 Démarrage

### 1. Appliquer les RLS Policies

Dans le SQL Editor de Supabase, exécutez:
```sql
-- Contenu de supabase/migrations/20231202_rls_policies.sql
```

### 2. Démarrer les services

#### Terminal 1 - Frontend
```bash
cd frontend
npm run dev
# → http://localhost:3000
```

#### Terminal 2 - Backend
```bash
cd backend
npm run dev
# → http://localhost:4000
```

#### Terminal 3 - Redis (optionnel pour MVP)
```bash
docker-compose up -d
```

---

## 📝 Prochaines Étapes de Développement

### Phase 1 : Tester l'Auth
1. Ouvrez http://localhost:3000
2. Cliquez sur "Commencer"
3. Créez un compte avec votre email
4. Vérifiez que vous accédez au dashboard

### Phase 2 : Créer une organisation
1. Créer un endpoint POST `/api/organizations` dans le backend
2. Ajouter un formulaire de création d'org dans le dashboard
3. Tester la création d'une organisation

### Phase 3 : Projets et Discovery
1. Interface de création de projets
2. Configuration des découvertes (pays, keywords)
3. Lancer une découverte (même sans SERP API pour l'instant)

### Phase 4 : Intégration SERP + LLM
1. Créer un compte SerpApi (https://serpapi.com)
2. Intégrer l'appel SERP dans les workers
3. Utiliser OpenAI pour extraction des données

---

## 🐛 Dépannage

### "Cannot connect to Supabase"
- Vérifiez que les URLs et clés sont correctes dans `.env`
- Vérifiez que le projet Supabase est actif

### "Authentication failed"
- Vérifiez que vous avez désactivé l'email confirmation dans Supabase:
  - Dashboard > Authentication > Settings
  - Désactivez "Enable email confirmations"

### "Table not found"
- Vérifiez que les migrations ont été exécutées
- Allez dans Database > Tables pour voir vos tables

---

## 📊 Structure du Projet

```
compet-int/
├── frontend/              Next.js app
│   ├── app/
│   │   ├── page.tsx      Landing page
│   │   ├── login/        Auth pages
│   │   ├── signup/
│   │   └── dashboard/    Protected area
│   └── lib/supabase/     Supabase clients
│
├── backend/               NestJS API
│   └── src/
│       ├── organizations/ Multi-tenant
│       ├── discovery/     Search runs
│       └── competitors/   Results
│
├── workers/               BullMQ workers (à implémenter)
└── supabase/
    └── migrations/        Database schema
```

---

## 🎯 MVP Checklist

- [ ] Configurer les .env avec vraies credentials
- [ ] Tester signup/login
- [ ] Créer première organisation
- [ ] Créer premier projet
- [ ] Lancer première découverte (mockée)
- [ ] Valider des concurrents
- [ ] Export CSV

Une fois ce MVP testé, on pourra ajouter:
- Intégration SERP API réelle
- LLM extraction avec OpenAI
- Workers BullMQ pour parallélisation
- Système de paiement
