const fs = require('fs');
const https = require('https');

const options = {
    headers: {
        'User-Agent': 'VivreFrais/1.0 (https://github.com/votre_repo) Node.js/20'
    }
};

async function getWikiImage(cityName) {
    if (cityName === 'Québec City') cityName = 'Québec (ville)';
    if (cityName === 'Baie-Saint-Paul') cityName = 'Baie-Saint-Paul';
    const q = encodeURIComponent(cityName);
    // added redirects=1
    const url = `https://fr.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles=${q}&redirects=1`;

    return new Promise((resolve) => {
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.query && parsed.query.pages) {
                        const pages = parsed.query.pages;
                        const pageId = Object.keys(pages)[0];
                        if (pageId !== '-1' && pages[pageId].original) {
                            return resolve(pages[pageId].original.source);
                        }
                    }

                    // Fallback to english wikipedia
                    const urlEn = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles=${q}&redirects=1`;
                    https.get(urlEn, options, (res2) => {
                        let data2 = '';
                        res2.on('data', chunk => data2 += chunk);
                        res2.on('end', () => {
                            try {
                                const parsed2 = JSON.parse(data2);
                                if (parsed2.query && parsed2.query.pages) {
                                    const pages2 = parsed2.query.pages;
                                    const pageId2 = Object.keys(pages2)[0];
                                    if (pageId2 !== '-1' && pages2[pageId2].original) return resolve(pages2[pageId2].original.source);
                                }
                                resolve(null);
                            } catch (e) { resolve(null); }
                        });
                    }).on('error', () => resolve(null));
                } catch (e) {
                    console.error('Parse error', e);
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

async function run() {
    let citiesTs = fs.readFileSync('src/data/cities.ts', 'utf8');

    const regex = /name:\s*['"]([^'"]+)['"],\s+imageUrl:\s*'([^']+)'/g;
    let match;
    const updates = [];
    while ((match = regex.exec(citiesTs))) {
        updates.push({ name: match[1], currentImg: match[2] });
    }

    console.log(`Found ${updates.length} cities to process`);
    for (const item of updates) {
        if (!item.currentImg.includes('unsplash') && item.currentImg) {
            continue; // already a valid wiki image
        }

        let img = await getWikiImage(item.name);
        if (!img) {
            console.log(`Still no image found for ${item.name}`);
            continue;
        }

        console.log(`${item.name} -> ${img}`);

        const escName = item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(name:\\s*['"]${escName}['"],\\s+imageUrl:\\s*)'[^']+'`, 'g');
        citiesTs = citiesTs.replace(re, `$1'${img}'`);
    }

    fs.writeFileSync('src/data/cities.ts', citiesTs);
    console.log('Done refetching Wikipedia images.');
}

run();
