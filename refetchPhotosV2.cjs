const fs = require('fs');
const https = require('https');

const options = {
    headers: {
        'User-Agent': 'VivreFrais/1.0 (https://github.com/votre_repo) Node.js/20'
    }
};

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', reject);
    });
}

function isValidImage(title) {
    const t = title.toLowerCase();
    // Mostly want .jpg or .jpeg
    if (!t.endsWith('.jpg') && !t.endsWith('.jpeg')) return false;

    // Avoid coats of arms, flags, maps, logos
    const badWords = [
        'blason', 'logo', 'drapeau', 'flag', 'map', 'carte',
        'armoiries', 'arms', 'icon', 'shield', 'location',
        'locator', 'symbole', 'graph', 'chart', 'mrc', 'province',
        'quebec_', 'canada_', 'couple', 'politique', 'maire', 'portrait'
    ];
    for (const word of badWords) {
        if (t.includes(word)) return false;
    }
    return true;
}

async function getWikiImage(cityName) {
    let qCity = cityName;
    if (cityName === 'Québec City') qCity = 'Québec (ville)';
    if (cityName === 'Baie-Saint-Paul') qCity = 'Baie-Saint-Paul';
    const q = encodeURIComponent(qCity);

    // 1. Get images from the page
    const url = `https://fr.wikipedia.org/w/api.php?action=query&prop=images&titles=${q}&format=json&imlimit=100&redirects=1`;

    let data = await httpsGet(url);
    if (!data || !data.query || !data.query.pages) return null;

    let pages = data.query.pages;
    let pageId = Object.keys(pages)[0];
    if (pageId === '-1') return null; // Page not found

    let images = pages[pageId].images;
    if (!images) return null;

    let selectedImageTitle = null;

    // Try to find a good image, favor things with 'centre', 'ville', 'downtown', 'vue', 'montage'
    let validImages = images.filter(img => isValidImage(img.title));

    if (validImages.length === 0) return null;

    // Attempt scoring to pick a nice panoramic or city view
    let bestScore = -1;
    for (const img of validImages) {
        const t = img.title.toLowerCase();
        let score = 0;
        if (t.includes('centre-ville') || t.includes('downtown')) score += 10;
        if (t.includes('panorama') || t.includes('vue')) score += 5;
        if (t.includes('montage')) score += 15;
        if (t.includes(cityName.toLowerCase())) score += 3;

        if (score > bestScore) {
            bestScore = score;
            selectedImageTitle = img.title;
        }
    }

    if (!selectedImageTitle) {
        selectedImageTitle = validImages[0].title;
    }

    // 2. Get the actual URL of the selected image
    const imgQ = encodeURIComponent(selectedImageTitle);
    const imgUrl = `https://fr.wikipedia.org/w/api.php?action=query&prop=imageinfo&titles=${imgQ}&iiprop=url&format=json`;
    let imgData = await httpsGet(imgUrl);

    if (!imgData || !imgData.query || !imgData.query.pages) return null;

    let imgPages = imgData.query.pages;
    let imgPageId = Object.keys(imgPages)[0];
    if (imgPageId === '-1' || !imgPages[imgPageId].imageinfo || imgPages[imgPageId].imageinfo.length === 0) return null;

    return imgPages[imgPageId].imageinfo[0].url;
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
        let img = await getWikiImage(item.name);

        // If fr.wikipedia fails, try en.wikipedia
        if (!img) {
            const q = encodeURIComponent(item.name);
            const urlEn = `https://en.wikipedia.org/w/api.php?action=query&prop=images&titles=${q}&format=json&imlimit=100&redirects=1`;
            let data = await httpsGet(urlEn);
            if (data && data.query && data.query.pages) {
                let pages = data.query.pages;
                let pageId = Object.keys(pages)[0];
                if (pageId !== '-1' && pages[pageId].images) {
                    let validImages = pages[pageId].images.filter(img => isValidImage(img.title));
                    if (validImages.length > 0) {
                        const imgQ = encodeURIComponent(validImages[0].title); // fallback to first valid on en.wiki
                        const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=imageinfo&titles=${imgQ}&iiprop=url&format=json`;
                        let imgData = await httpsGet(imgUrl);
                        if (imgData && imgData.query && imgData.query.pages) {
                            let imgPages = imgData.query.pages;
                            let imgPageId = Object.keys(imgPages)[0];
                            if (imgPageId !== '-1' && imgPages[imgPageId].imageinfo) {
                                img = imgPages[imgPageId].imageinfo[0].url;
                            }
                        }
                    }
                }
            }
        }

        if (!img) {
            img = "https://images.unsplash.com/photo-1542106655-eb655fbcfd5f?q=80&w=800&auto=format&fit=crop";
            console.log(`[DEFAULT] Still no image found for ${item.name}`);
        } else {
            console.log(`[OK] ${item.name} -> ${img}`);
        }

        const escName = item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(name:\\s*['"]${escName}['"],\\s+imageUrl:\\s*)'[^']+'`, 'g');
        citiesTs = citiesTs.replace(re, `$1'${img}'`);
    }

    fs.writeFileSync('src/data/cities.ts', citiesTs);
    console.log('Done refetching Wikipedia images with smart scoring.');
}

run();
