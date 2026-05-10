const fs = require('fs');
const https = require('https');

const options = {
    headers: {
        'User-Agent': 'VivreFraisBot/2.0 (https://github.com/votre_repo) Node.js'
    }
};

function httpsGet(url) {
    return new Promise((resolve) => {
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
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

    // Strict blocklist
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
        if (t.includes('panorama') || t.includes('skyline') || t.includes('vue globale') || t.includes('aerial')) score += 40;
        if (t.includes('vue') || t.includes('view') || t.includes('paysage')) score += 10;
        if (t.includes('rue') || t.includes('street') || t.includes('wellington')) score += 15;
        if (t.includes('montage')) score += 20;
        if (t.includes(cityName.toLowerCase())) score += 5;

        // Negative signals
        if (t.includes('eglise') || t.includes('église') || t.includes('church')) score -= 15;
        if (t.includes('parc') || t.includes('park')) score -= 5;
        if (t.includes('pont') || t.includes('bridge')) score -= 5;

        if (score > bestScore) {
            bestScore = score;
            selectedImageTitle = img.title;
        }
    }

    if (!selectedImageTitle && validImages.length > 0) {
        selectedImageTitle = validImages[0].title;
    }

    if (!selectedImageTitle) return null;

    const imgQ = encodeURIComponent(selectedImageTitle);
    const imgUrlFr = `https://fr.wikipedia.org/w/api.php?action=query&prop=imageinfo&titles=${imgQ}&iiprop=url&format=json`;
    let imgData = await httpsGet(imgUrlFr);

    if (!imgData || !imgData.query || !imgData.query.pages) return null;
    let imgPages = imgData.query.pages;
    let imgPageId = Object.keys(imgPages)[0];
    if (!imgPages[imgPageId].imageinfo || imgPages[imgPageId].imageinfo.length === 0) return null;
    return imgPages[imgPageId].imageinfo[0].url;
}

const customImages = {
    'Sherbrooke': 'https://upload.wikimedia.org/wikipedia/commons/e/ec/2007-04-18_-_98_-_Sherbrooke_-_H%C3%B4tel_de_ville.jpg',
    'Québec City': 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chateau_Frontenac_and_St_Lawrence_River.jpg',
    'Montréal': 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Montreal_Skyline.jpg',
    'Gatineau': 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Gatineau_Skyline.jpg',
    'Saguenay': 'https://upload.wikimedia.org/wikipedia/commons/d/db/Chicoutimi-Saguenay-1.jpg',
    'Trois-Rivières': 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Trois-Rivi%C3%A8res_-_Centre-ville_%2801%29.jpg',
    'Laval': 'https://upload.wikimedia.org/wikipedia/commons/f/fb/Laval_Skyline.jpg',
    'Longueuil': 'https://upload.wikimedia.org/wikipedia/commons/a/af/Longueuil_from_Mont-Royal.jpg'
};

const defaultImage = "https://images.unsplash.com/photo-1542106655-eb655fbcfd5f?q=80&w=800&auto=format&fit=crop";

async function run() {
    let citiesTs = fs.readFileSync('src/data/cities.ts', 'utf8');

    const regex = /(id:\s*'[^']+',\s*name:\s*['"])([^'"]+)(['"],\s+imageUrl:\s*'([^']+)')/g;
    let match;
    const updates = [];
    while ((match = regex.exec(citiesTs))) {
        updates.push({ name: match[2], currentImg: match[4] });
    }

    let changed = false;
    let replaceCount = 0;

    for (const item of updates) {
        let needsRefetch = false;
        const t = item.currentImg.toLowerCase();

        // 1. Is it a generic default Unsplash?
        if (t.includes('unsplash')) needsRefetch = true;
        // 2. Is it an existing bad image?
        const badWords = ['blason', 'logo', 'drapeau', 'flag', 'carte', 'map', 'armoiries', 'arms', 'shield', '.svg', '.png'];
        for (const word of badWords) if (t.includes(word)) needsRefetch = true;

        // 3. For Sherbrooke we DEFINITELY want to override with our custom nice image
        if (customImages[item.name]) needsRefetch = true;

        if (!needsRefetch) continue;

        let img = null;

        if (customImages[item.name]) {
            img = customImages[item.name];
        } else {
            await new Promise(r => setTimeout(r, 100)); // Be polite
            img = await getWikiImage(item.name);
            if (!img) img = defaultImage;
        }

        // DO THE REPLACEMENT
        const escName = item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Very precisely target this city's imageUrl to avoid messing up the whole file
        const re = new RegExp(`(name:\\s*['"]${escName}['"],\\s+imageUrl:\\s*)'[^']+'`, 'g');
        let prevTs = citiesTs;
        citiesTs = citiesTs.replace(re, `$1'${img}'`);
        if (prevTs !== citiesTs) {
            changed = true;
            replaceCount++;
            console.log(`Updated ${item.name} -> ${img.substring(0, 50)}...`);
        }
    }

    if (changed) {
        fs.writeFileSync('src/data/cities.ts', citiesTs);
        console.log(`Saved changes! Updated ${replaceCount} cities.`);
    } else {
        console.log('No changes needed/made.');
    }
}

run();
