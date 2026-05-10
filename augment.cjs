const fs = require('fs');
const https = require('https');

async function getWikiImage(cityName) {
    if (cityName === 'Québec City') cityName = 'Québec (ville)';
    if (cityName === 'Baie-Saint-Paul') cityName = 'Baie-Saint-Paul';
    const q = encodeURIComponent(cityName);
    const url = `https://fr.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles=${q}`;

    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    const pages = parsed.query.pages;
                    const pageId = Object.keys(pages)[0];
                    if (pageId !== '-1' && pages[pageId].original) {
                        resolve(pages[pageId].original.source);
                    } else {
                        // Fallback to english wikipedia
                        const urlEn = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles=${q}`;
                        https.get(urlEn, (res2) => {
                            let data2 = '';
                            res2.on('data', chunk => data2 += chunk);
                            res2.on('end', () => {
                                try {
                                    const parsed2 = JSON.parse(data2);
                                    const pages2 = parsed2.query.pages;
                                    const pageId2 = Object.keys(pages2)[0];
                                    if (pageId2 !== '-1' && pages2[pageId2].original) resolve(pages2[pageId2].original.source);
                                    else resolve(null);
                                } catch (e) { resolve(null); }
                            });
                        });
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

const defaultImage = "https://images.unsplash.com/photo-1542106655-eb655fbcfd5f?q=80&w=800&auto=format&fit=crop";

async function run() {
    let citiesTs = fs.readFileSync('src/data/cities.ts', 'utf8');

    // Fix Val-d\
    citiesTs = citiesTs.replace(/name:\s*'Val-d\\'/, "name: 'Val-d\\'Or'");

    const regex = /name:\s*'([^']+)'/g;
    let match;
    const citiesToProc = [];
    while ((match = regex.exec(citiesTs))) {
        citiesToProc.push(match[1]);
    }

    console.log(`Found ${citiesToProc.length} cities`);
    for (const name of citiesToProc) {
        // Skip if already has imageUrl
        const cityBlockRegex = new RegExp(`name:\\s*'${name.replace(/'/g, "\\\\'")}'[\\s\\S]*?}`);
        const blockMatch = citiesTs.match(cityBlockRegex);
        if (blockMatch && blockMatch[0].includes('imageUrl:')) {
            console.log(`Skipping ${name}, already has image`);
            continue;
        }

        let img = await getWikiImage(name);
        if (!img) img = defaultImage;

        console.log(`${name} -> ${img}`);

        // Inject imageUrl just after name: '...'
        citiesTs = citiesTs.replace(new RegExp(`(name:\\s*'${name.replace(/'/g, "\\\\'")}',\\s+)`), `$1imageUrl: '${img}',\n    `);
    }

    // Now append new cities
    const newCities = [
        {
            id: 'baie-saint-paul',
            name: 'Baie-Saint-Paul',
            region: 'Capitale-Nationale',
            description: 'Ville artistique et culturelle au centre de Charlevoix.',
            population: 7300,
            tags: ['Culture', 'Tourisme', 'Pittoresque'],
            defaultCosts: { housing: 700, food: 400, transportation: 65, utilities: 130, internet: 65, entertainment: 120, healthcare: 50, daycare: 200, other: 80 }
        },
        {
            id: 'la-malbaie',
            name: 'La Malbaie',
            region: 'Capitale-Nationale',
            description: 'Berceau de la villégiature au Canada, offrant des vues imprenables sur le fleuve.',
            population: 8200,
            tags: ["Tourisme", "Bord de l'eau", "Historique"],
            defaultCosts: { housing: 650, food: 390, transportation: 60, utilities: 135, internet: 65, entertainment: 110, healthcare: 50, daycare: 200, other: 75 }
        },
        {
            id: 'sainte-agathe-des-monts',
            name: 'Sainte-Agathe-des-Monts',
            region: 'Laurentides',
            description: 'Au coeur des Laurentides, une ville entourée de montagnes et de lacs.',
            population: 10500,
            tags: ['Nature', 'Lacs', 'Tourisme'],
            defaultCosts: { housing: 750, food: 380, transportation: 65, utilities: 130, internet: 65, entertainment: 100, healthcare: 50, daycare: 200, other: 70 }
        },
        {
            id: 'roberval',
            name: 'Roberval',
            region: 'Saguenay-Lac-Saint-Jean',
            description: 'Ville située sur les rives du majestueux lac Saint-Jean.',
            population: 10000,
            tags: ['Bord de lac', 'Tourisme', 'Nature'],
            defaultCosts: { housing: 600, food: 360, transportation: 60, utilities: 125, internet: 60, entertainment: 90, healthcare: 50, daycare: 200, other: 65 }
        },
        {
            id: 'sainte-marie',
            name: 'Sainte-Marie',
            region: 'Chaudière-Appalaches',
            description: 'Carrefour économique dynamique de la Beauce.',
            population: 13500,
            tags: ['Beauce', 'Pôle économique', 'Manufacturier'],
            defaultCosts: { housing: 650, food: 370, transportation: 60, utilities: 130, internet: 60, entertainment: 100, healthcare: 50, daycare: 200, other: 70 }
        },
        {
            id: 'saint-felicien',
            name: 'Saint-Félicien',
            region: 'Saguenay-Lac-Saint-Jean',
            description: 'Reconnue pour son Zoo sauvage et son dynamisme.',
            population: 10200,
            tags: ['Tourisme', 'Nature', 'Foresterie'],
            defaultCosts: { housing: 600, food: 360, transportation: 60, utilities: 125, internet: 60, entertainment: 100, healthcare: 50, daycare: 200, other: 65 }
        },
        {
            id: 'becancour',
            name: 'Bécancour',
            region: 'Centre-du-Québec',
            description: 'Pôle industriel majeur et plaque tournante de la filière batterie.',
            population: 13000,
            tags: ['Industriel', 'Énergie', 'Transport'],
            defaultCosts: { housing: 700, food: 380, transportation: 65, utilities: 135, internet: 65, entertainment: 100, healthcare: 50, daycare: 200, other: 75 }
        }
    ];

    let newCitiesStr = '';
    for (const c of newCities) {
        let img = await getWikiImage(c.name);
        if (!img) img = defaultImage;

        newCitiesStr += `  {
    id: '${c.id}',
    name: '${c.name.replace(/'/g, "\\'")}',
    imageUrl: '${img}',
    region: '${c.region}',
    description: '${c.description.replace(/'/g, "\\'")}',
    population: ${c.population},
    tags: [${c.tags.map(t => "'" + t.replace(/'/g, "\\'") + "'").join(', ')}],
    defaultCosts: ${JSON.stringify(c.defaultCosts)}
  },\n`;
    }

    citiesTs = citiesTs.replace(/];\s*export const enrichCityData/, newCitiesStr + '];\n\nexport const enrichCityData');

    fs.writeFileSync('src/data/cities.ts', citiesTs);
    console.log('Done mapping images and adding cities.');
}

run();
