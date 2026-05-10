const fs = require('fs');
const https = require('https');

const options = {
    headers: {
        'User-Agent': 'VivreFraisBot/1.1 (https://github.com/votre_repo) Node.js'
    }
};

function httpsGet(url) {
    return new Promise((resolve) => {
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    console.error('HTTP', res.statusCode, 'on', url.substring(0, 100));
                    return resolve(null);
                }
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

function isValidImage(title) {
    const t = title.toLowerCase();
    if (!t.endsWith('.jpg') && !t.endsWith('.jpeg')) return false;

    // Strict blocklist to avoid maps and coats of arms
    const badWords = [
        'blason', 'logo', 'drapeau', 'flag', 'map', 'carte',
        'armoiries', 'arms', 'icon', 'shield', 'location',
        'locator', 'symbole', 'graph', 'chart', 'mrc', 'province',
        'quebec_', 'canada_', 'couple', 'politique', 'maire', 'portrait', 'armoir', 'seal',
        'hotel de ville', 'hotel_de_ville', 'mairie', 'hôtel de ville', 'hôtel_de_ville'
    ];
    for (const word of badWords) {
        if (t.includes(word)) return false;
    }
    return true;
}

// Very important: fetch images using max imlimit 500 so we dont miss anything
async function fetchWikiImagesForTitle(title, lang = 'fr') {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=images&titles=${encodeURIComponent(title)}&format=json&imlimit=500&redirects=1`;
    let data = await httpsGet(url);
    if (!data || !data.query || !data.query.pages) return [];
    let pages = data.query.pages;
    let pageId = Object.keys(pages)[0];
    if (pageId === '-1' || !pages[pageId].images) return [];
    return pages[pageId].images.filter(img => isValidImage(img.title));
}

async function getWikiImage(cityName) {
    let qCity = cityName;
    if (cityName === 'Québec City') qCity = 'Québec (ville)';
    if (cityName === 'Baie-Saint-Paul') qCity = 'Baie-Saint-Paul';

    let validImages = await fetchWikiImagesForTitle(qCity, 'fr');

    if (validImages.length === 0) validImages = await fetchWikiImagesForTitle(qCity + " (Québec)", 'fr');
    if (validImages.length === 0) validImages = await fetchWikiImagesForTitle(qCity + " (ville)", 'fr');

    // Try English wiki if nothing found
    if (validImages.length === 0) validImages = await fetchWikiImagesForTitle(qCity, 'en');
    if (validImages.length === 0) validImages = await fetchWikiImagesForTitle(qCity + ", Quebec", 'en');

    if (validImages.length === 0) return null;

    let selectedImageTitle = null;
    let bestScore = -1;
    for (const img of validImages) {
        const t = img.title.toLowerCase();
        let score = 0;

        // Positive signals
        if (t.includes('centre-ville') || t.includes('downtown')) score += 50;
        if (t.includes('panorama') || t.includes('skyline') || t.includes('vue globale') || t.includes('vue_globale') || t.includes('aerial')) score += 40;
        if (t.includes('vue') || t.includes('view')) score += 10;
        if (t.includes('rue') || t.includes('street') || t.includes('wellington') || t.includes('principale')) score += 15;
        if (t.includes('montage')) score += 20;
        // Moderate signal for containing city name, to prioritize specific shots not generic ones
        if (t.includes(cityName.toLowerCase())) score += 5;

        // Negative signals
        if (t.includes('eglise') || t.includes('église') || t.includes('church') || t.includes('cathedral')) score -= 20;
        if (t.includes('parc') || t.includes('park')) score -= 5;
        if (t.includes('gare') || t.includes('station')) score -= 5;
        if (t.includes('pont') || t.includes('bridge')) score -= 5;
        if (t.includes('cimet')) score -= 50;
        if (t.includes('house') || t.includes('maison') || t.includes('batiment') || t.includes('building')) score -= 10;

        if (score > bestScore) {
            bestScore = score;
            selectedImageTitle = img.title;
        }
    }

    if (!selectedImageTitle && validImages.length > 0) {
        selectedImageTitle = validImages[0].title;
    }

    if (!selectedImageTitle) return null;

    console.log(`   Picked: ${selectedImageTitle} (score: ${bestScore})`);

    const imgQ = encodeURIComponent(selectedImageTitle);

    // Fetch image url using fr.wikipedia (Wikimedia commons handles titles transparently anyway)
    const imgUrlFr = `https://fr.wikipedia.org/w/api.php?action=query&prop=imageinfo&titles=${imgQ}&iiprop=url&format=json`;
    let imgData = await httpsGet(imgUrlFr);

    if (!imgData || !imgData.query || !imgData.query.pages) return null;
    let imgPages = imgData.query.pages;
    let imgPageId = Object.keys(imgPages)[0];

    if (!imgPages[imgPageId].imageinfo || imgPages[imgPageId].imageinfo.length === 0) return null;

    return imgPages[imgPageId].imageinfo[0].url;
}

async function run() {
    let citiesTs = fs.readFileSync('src/data/cities.ts', 'utf8');

    const regex = /(id:\s*'[^']+',\s*name:\s*['"])([^'"]+)(['"],\s+imageUrl:\s*'([^']+)')/g;
    let match;
    const updates = [];
    while ((match = regex.exec(citiesTs))) {
        // match[2] is name, match[4] is current image url
        updates.push({ name: match[2], currentImg: match[4] });
    }

    let changed = false;
    let replaceCount = 0;

    for (const item of updates) {
        let needsRefetch = false;
        const t = item.currentImg.toLowerCase();

        // Conditions for refetch:
        // 1. It's using default Unsplash image
        if (t.includes('unsplash')) needsRefetch = true;

        // 2. It's a coat of arms or flag or bad image
        const badWords = ['blason', 'logo', 'drapeau', 'flag', 'carte', 'map', 'armoiries', 'arms', 'shield', '.svg', '.png'];
        for (const word of badWords) {
            if (t.includes(word)) needsRefetch = true;
        }

        if (!needsRefetch) continue;

        console.log(`\nWorking on ${item.name}... `);
        await new Promise(r => setTimeout(r, 1500)); // Be VERY polite to Wikipedia (1.5s delay)
        let img = await getWikiImage(item.name);

        if (!img) {
            console.log(`   [FAIL] Could not find any good images for ${item.name}`);
        } else {
            console.log(`   [SUCCESS] ${img}`);
            const escName = item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Safely replace just this exact city's entry
            const re = new RegExp(`(name:\\s*['"]${escName}['"],\\s+imageUrl:\\s*)'[^']+'`, 'g');
            let prevTs = citiesTs;
            citiesTs = citiesTs.replace(re, `$1'${img}'`);
            if (prevTs !== citiesTs) {
                changed = true;
                replaceCount++;
            }
        }
    }

    if (changed) {
        fs.writeFileSync('src/data/cities.ts', citiesTs);
        console.log(`\nSaved changes! Updated ${replaceCount} cities.`);
    } else {
        console.log('\nNo changes needed/made.');
    }
}

run();
