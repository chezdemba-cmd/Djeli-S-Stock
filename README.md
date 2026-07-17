# DJELI'S STOCK

MVP mobile-first de gestion de marchandises pour grossistes et dépôts d'Afrique de l'Ouest.

## Fonctions disponibles

- tableau de bord avec valeur du stock et alertes ;
- catalogue filtrable de produits ;
- ajout d'une nouvelle référence ;
- entrées et sorties avec mise à jour immédiate ;
- journal des mouvements ;
- interface responsive pour smartphone ;
- schéma Supabase multi-entreprises avec RLS.

Les données de l'interface sont actuellement des données de démonstration locales. Le fichier `supabase/schema.sql` prépare la connexion sécurisée à la base réelle.

## Démarrage

```bash
npm install
npm run dev
```

Ouvrez ensuite `http://localhost:3000`.

## Validation

```bash
npm run lint
npm run build
```
