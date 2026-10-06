# Thabāt — *Ce qui est ancré demeure*

Application de mémorisation du Coran : un plan calculé automatiquement à partir d'un objectif et d'une date,
des révisions espacées, et une progression mesurée par la **maîtrise réelle** de chaque verset — pas par le
nombre de versets « lus ».

## Démarrage

```bash
cp .env.example .env        # puis changer JWT_SECRET et POSTGRES_PASSWORD
docker compose up -d --build
```

- Application : http://localhost:8080
- API + documentation OpenAPI : http://localhost:8000/docs (port réglable via `API_PORT`)

Au premier démarrage, le backend crée les tables et charge les 6 236 versets depuis la source configurée
(quelques secondes, connexion Internet requise — voir « Données du Coran » pour un fonctionnement hors ligne).

## Identité

| | |
|---|---|
| **Nom** | Thabāt (ثبات) : fermeté, constance, ce qui tient en place |
| **Slogan** | Ce qui est ancré demeure. |
| **Logo** | Un anneau ouvert (le chemin encore à parcourir) autour d'un point fixe (ce qui est ancré) |
| **Couleurs** | Fond neutre `#F7F7F5`, encre `#14181B`, bleu pétrole `#0F4C5C` (action, maîtrise), ocre `#A86810` (attention) |
| **Échelle de maîtrise** | pas encore vu → fragile → en consolidation → solide → ancré (du gris au bleu pétrole) |
| **Typographie** | Schibsted Grotesk (interface et titres), Amiri Quran (texte coranique) |
| **Formes** | Bordures fines, rayons courts, aplats ; pas d'ombres décoratives ni de dégradés |
| **Thèmes** | clair / sombre / automatique — tokens CSS dans `frontend/src/index.css` |

Noms écartés : *Sard* (réciter d'un trait), *Manzil* (l'étape quotidienne).

## Ce que fait l'application

- **Onboarding** : compte, intention, objectif libre (n'importe quels juz ou sourates, ordre au choix), versets déjà connus, date, rythme (3 propositions chiffrées), rappel, plan.
- **Versets déjà connus** : sourates entières ou versets un par un, à l'onboarding ou plus tard depuis « Ancrage ». Ils ne sont plus proposés comme nouveaux et partent en révision pour confirmer leur niveau (jamais « maîtrisés » d'office).
- **Aujourd'hui** : quoi apprendre, quoi réviser, combien de temps, avance ou retard, série, échéance, fin estimée.
- **Session** : Lecture → Répétition (compteur, écoute en boucle, texte estompé) → Test (mots masqués
  progressivement, 25 → 100 %) → Récitation (texte caché, indice mot à mot, erreurs marquées au toucher, auto-évaluation
  en 5 niveaux). Raccourci « Je connais ce verset ». Clavier : Espace pour révéler, 1–5 pour noter.
- **Ancrage** : carte de tous les versets de l'objectif, colorés selon leur maîtrise, par sourate.
- **Objectifs** : par juz, sourate, nombre de versets, quotidien, hebdomadaire ; date cible modifiable (le plan se recalcule).
- **Calendrier** : semaine / mois / depuis le début, quatre états par jour, séries.
- **Parcours** : statistiques, graphiques, 5 niveaux, 10 étapes sobres.
- **Rappels** : heure, jours, type, fréquence ; message contextuel généré à l'envoi.

## Les deux moteurs

**Maîtrise et répétition espacée** — `backend/app/services/srs.py` (fonctions pures, testées).
Chaque verset porte un score 0–100. Une récitation le tire vers une cible qui dépend de l'auto-évaluation
(Très facile / Facile / Moyen / Difficile / Oublié) et des erreurs marquées. L'intervalle suit un schéma de type SM-2,
plafonné quand l'échéance approche. Un verset n'est « maîtrisé » qu'à ≥ 85 % après au moins 3 réussites espacées ;
une révision en retard fait baisser le score affiché. Niveaux : à apprendre, en cours, appris, à réviser, maîtrisé.
La file du jour est triée par retard, faiblesse, oublis passés et proximité de l'objectif.

**Planification** — `backend/app/services/planner.py`.
À partir du total, de la date et du rythme choisi : objectif du jour et de la semaine, marge, avance ou retard
(la journée en cours n'est jamais comptée contre l'utilisateur), rattrapage étalé sur 14 jours au plus, date de fin
projetée d'après le rythme réel des 14 derniers jours. Le ton des messages est toujours encourageant.

Exemple vérifié sur les données réelles : Juz' ʿAmma (564) + Juz' Tabārak (431) = **995 versets** ;
du 6 octobre 2026 au 8 février 2027 = 125 jours → 8/j sans marge, **9/j avec 14 jours de marge** (recommandé).

## Données du Coran

Le texte n'est jamais écrit ni généré dans ce dépôt. Il est chargé par un adaptateur
(`backend/app/services/quran_source/`) :

- `alquran_cloud` (défaut) : texte arabe **Uthmani du Tanzil Project**, CC BY 3.0, reproduit sans modification ;
  traduction française **Muhammad Hamidullah** ; translittération ; numéros de juz, hizb, page.
- `json_file` : copie locale normalisée, pour fonctionner hors ligne —
  `python -m app.database.seed_quran --dump data/quran.json`, puis `QURAN_SOURCE=json_file`.

Changer de source = écrire une classe qui implémente `QuranSource.load()` et l'enregistrer dans `get_quran_source`.

**À vérifier avant toute publication :** Tanzil exige l'attribution et l'absence de modification du texte ; les
conditions de réutilisation de la traduction Hamidullah et des récitations audio (Islamic Network CDN) doivent être
confirmées pour un usage public ou commercial. L'édition de traduction se change par variable d'environnement.
La date « 1 Ramaḍān 1448 ≈ 8 février 2027 » est calculée (Umm al-Qura) et dépend de l'observation de la lune.

## Architecture

```
backend/app/
  api/v1/        routes REST (auth, quran, goals, progress, reminders)
  core/          configuration, sécurité JWT, erreurs, limitation de débit, horloge
  models/        SQLAlchemy : User, UserSettings, RefreshToken, Surah, Juz, Ayah, Goal, GoalItem,
                 Memorization, Review, ReviewSession, DailyProgress, Reminder, Achievement
  schemas/       validation Pydantic
  repositories/  accès aux données
  services/      logique métier (srs, planner, goals, sessions, progress, stats, gamification, rappels)
  database/      session, base, chargement du Coran
  workers/       worker de rappels
frontend/src/
  components/ pages/ layouts/ hooks/ services/ stores/ types/ utils/
```

**Authentification** : jeton d'accès JWT de 15 min gardé en mémoire ; jeton de rafraîchissement opaque dans un
cookie `httpOnly`, stocké haché, avec rotation à chaque usage et révocation de toute la famille en cas de rejeu.
Limitation de débit sur l'inscription et la connexion.

### API (préfixe `/api/v1`)

| | |
|---|---|
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET/PATCH /me` · `PATCH /me/settings` |
| Coran | `GET /surahs` · `GET /surahs/{id}` · `GET /ayahs/{id}` · `GET /juz` |
| Objectifs | `GET/POST /goals` · `POST /goals/preview` · `GET/PATCH/DELETE /goals/{id}` |
| Progression | `GET /progress` · `GET /progress/today` · `GET /progress/calendar` · `GET /statistics` · `GET /achievements` |
| Sessions | `POST /memorization/known` · `POST /sessions` · `POST /sessions/{id}/finish` · `POST /memorization` · `POST /reviews` · `GET /reviews/today` |
| Rappels | `GET/POST /reminders` · `PATCH/DELETE /reminders/{id}` |

## Développement

```bash
# backend (SQLite suffit en local)
cd backend && uv venv --python 3.12 && uv pip install -r requirements-dev.txt
DATABASE_URL=sqlite:///./dev.db .venv/bin/python -m app.database.seed_quran
DATABASE_URL=sqlite:///./dev.db .venv/bin/uvicorn app.main:app --reload

# frontend (proxy /api → http://localhost:8000, modifiable avec VITE_API_PROXY)
cd frontend && npm install && npm run dev
```

### Tests

```bash
cd backend && .venv/bin/python -m pytest          # 30 tests : SRS, planificateur, auth, parcours complet, rappels
cd frontend && npm test                           # 15 tests : utilitaires et composants
cd frontend && npx playwright install chromium && npm run e2e   # parcours complet sur la stack Docker
```

## Limites connues

- **Rappels application fermée** : le worker calcule et journalise les rappels dus, mais aucun canal push
  (Web Push, e-mail, FCM) n'est branché — implémenter `Channel` dans `workers/reminder_worker.py`.
  Application ouverte, les rappels s'affichent (notification système ou message dans l'app).
- **Migrations** : les tables sont créées par `create_all` au démarrage ; ajouter Alembic avant de faire évoluer
  un schéma en production.
- **Limitation de débit** en mémoire (par processus) : passer à Redis avec plusieurs workers.
- **Récitation** : l'évaluation est déclarative (auto-évaluation + erreurs marquées), sans reconnaissance vocale.
- Pas encore de réinitialisation de mot de passe ni de mode hors ligne (PWA).
