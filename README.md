# Simila

**Veille concurrentielle IA pour les startups d'Afrique francophone**

> Comprenez ce qui marche ailleurs. Exécutez mieux chez vous.

## 🎯 Objectif

Permettre aux startups d'Afrique francophone (Côte d'Ivoire, Sénégal, Cameroun, etc.) de découvrir, analyser et suivre automatiquement leurs concurrents à l'international :
- Afrique anglophone (Kenya, Nigeria, Ghana)
- Amérique latine
- Asie du Sud-Est
- Inde / Moyen-Orient

## 🚀 Fonctionnalités

- **Découverte automatique** : Recherche géo-localisée de concurrents via SERP + IA
- **Extraction intelligente** : LLM pour extraire les informations clés (modèle d'affaires, traction, etc.)
- **Enrichissement** : Données avancées (fondateurs, levées de fonds, technologies)
- **Multi-tenant** : Organisations, projets, gestion des quotas
- **Paiements Mobile Money** : Wave, Orange Money, MTN via Flutterwave

## 🏗️ Architecture

### Frontend
- **Next.js 14** avec App Router
- **TypeScript** + **Tailwind CSS**
- **Supabase Auth** pour l'authentification

### Backend
- **NestJS** (Node.js + TypeScript)
- **Supabase** (PostgreSQL + pgvector)
- **Redis** + **BullMQ** pour les workers

### Intégrations
- **OpenAI** : LLM + embeddings
- **SerpApi** : Résultats de recherche géo-localisés
- **Flutterwave** : Paiements mobile money
- **Playwright** : Scraping avancé

## 📦 Structure du projet

```
compet-int/
├── frontend/          # Next.js app
├── backend/           # NestJS API
├── workers/           # BullMQ workers
├── packages/          # Shared utilities
└── docker-compose.yml # Local dev environment
```

## 🛠️ Installation

### Prérequis
- Node.js >= 20
- npm >= 10
- Docker & Docker Compose

### Configuration

1. **Cloner et installer les dépendances**
```bash
npm install
```

2. **Copier les variables d'environnement**
```bash
cp .env.example .env
```

3. **Configurer les services**
- Créer un projet Supabase sur [supabase.com](https://supabase.com)
- Obtenir une clé API OpenAI sur [platform.openai.com](https://platform.openai.com)
- Obtenir une clé SerpApi sur [serpapi.com](https://serpapi.com)
- Configurer Flutterwave sur [flutterwave.com](https://flutterwave.com)

4. **Démarrer les services Docker**
```bash
docker-compose up -d
```

5. **Lancer l'application en mode développement**
```bash
npm run dev
```

- Frontend : http://localhost:3000
- Backend : http://localhost:4000
- Redis : redis://localhost:6379

## 🗄️ Base de données

### Migrations Supabase

```bash
cd backend
npm run migration:generate
npm run migration:run
```

### Configuration pgvector

pgvector est utilisé pour la recherche sémantique et la déduplication. L'extension est activée automatiquement via les migrations.

## 🧪 Tests

```bash
# Tous les tests
npm run test

# Tests frontend
npm run test:frontend

# Tests backend
npm run test:backend

# Tests E2E
npm run test:e2e
```

## 🚀 Déploiement

### Production

- **Frontend** : Vercel
- **Backend** : Render ou Fly.io
- **Database** : Supabase (managed)
- **Redis** : Upstash ou Redis Cloud

### Variables d'environnement de production

Vérifier que toutes les variables d'environnement sont configurées dans vos services d'hébergement.

## 📚 Documentation

- [Architecture détaillée](./docs/architecture.md) (à venir)
- [Guide API](./docs/api.md) (à venir)
- [Guide de déploiement](./docs/deployment.md) (à venir)

## 🔒 Sécurité

- Row Level Security (RLS) sur Supabase
- Validation des webhooks de paiement
- Rate limiting par organisation
- Encryption at rest (Supabase)

## 📄 License

Proprietary - Tous droits réservés

## 🤝 Support

Pour toute question ou problème, contactez l'équipe de développement.
