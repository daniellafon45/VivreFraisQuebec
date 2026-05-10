# Guide d'utilisation - VivreFrais

## Fonctionnalités principales

### 1. **Profil utilisateur**
- Sélectionnez le nombre de personnes à charge (0 à 5+)
- Choisissez votre secteur d'emploi recherché parmi 16 options
- Ces informations personnalisent automatiquement vos estimations

### 2. **Sélection de ville**
- Choisissez parmi 100 villes du Québec
- Consultez la description, la population et les caractéristiques de chaque ville
- Visualisez la disponibilité des logements et garderies
- Découvrez les secteurs d'emploi présents dans la ville

### 3. **Personnalisation des dépenses**
- Ajustez chaque catégorie de dépenses selon votre situation
- Les dépenses s'adaptent automatiquement au nombre de personnes à charge
- La catégorie "Garderie" apparaît uniquement si vous avez des personnes à charge

### 4. **Analyse intelligente par IA**
- Cliquez sur "Générer l'analyse" pour obtenir une analyse personnalisée
- L'IA évalue si votre budget est réaliste pour la ville choisie
- Recevez des recommandations pour optimiser vos dépenses
- Obtenez des conseils adaptés à votre situation familiale

### 5. **Assistant ChatGPT**
- Cliquez sur l'icône bleue en bas à droite pour ouvrir le chat
- Posez vos questions sur :
  - Le coût de la vie au Québec
  - Les villes et leurs caractéristiques
  - L'emploi dans votre secteur
  - Les services (garderies, logements, etc.)
  - Tout autre sujet lié à votre installation
- L'assistant a accès à toutes vos données pour des réponses personnalisées

### 6. **Comparaison de villes**
- Comparez les coûts entre deux villes
- Visualisez la différence mensuelle
- Prenez une décision éclairée

### 7. **Export PDF**
- Exportez votre estimation en PDF professionnel
- Document entièrement en français
- Design épuré et facile à partager
- Inclut toutes vos informations personnalisées

## Configuration requise

### Variables d'environnement (.env)
```
VITE_OPENAI_API_KEY=votre-clé-api-openai
VITE_SUPABASE_URL=votre-url-supabase
VITE_SUPABASE_ANON_KEY=votre-clé-anon-supabase
```

## Technologies utilisées

- **React + TypeScript** : Interface utilisateur moderne
- **OpenAI GPT-4** : Analyse intelligente et assistant conversationnel
- **Supabase** : Base de données (prête pour le stockage futur)
- **Tailwind CSS** : Design responsive et moderne
- **jsPDF** : Génération de PDF professionnels
- **Lucide React** : Icônes élégantes

## Démarrage

```bash
# Installation
npm install

# Développement
npm run dev

# Build production
npm run build
```

## Contact

Pour toute question sur l'emploi au Québec, contactez **Industrielle RH** :
- Téléphone : +1 (819) 919-8683
- Courriel : recrutement@industriellerh.com
- Site web : industriellerh.com
