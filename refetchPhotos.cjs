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
        'quebec_', 'canada_'
    ];
    for (const word of badWords) {
        if (t.includes(word)) return false;
    }
    return true;
}

async function getWikiImage(cityName) {
    if (cityName === 'Québec City') cityName = 'Québec (ville)';
    if (cityName === 'Baie-Saint-Paul') cityName = 'Baie-Saint-Paul';
    const q = encodeURIComponent(cityName);
    // 1. Get images from the page
    const url = `https://fr.wikipedia.org/w/api.php?action=query&prop=images&titles=${q}&format=json&imlimit=50&redirects=1`;

    let data = await httpsGet(url);
    if (!data || !data.query || !data.query.pages) return null;

    let pages = data.query.pages;
    let pageId = Object.keys(pages)[0];
    if (pageId === '-1') return null; // Page not found

    let images = pages[pageId].images;
    if (!images) return null;

    let selectedImageTitle = null;
    for (const img of images) {
        if (isValidImage(img.title)) {
            selectedImageTitle = img.title;
            break;
        }
    }

    if (!selectedImageTitle) return null;

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
            const urlEn = `https://en.wikipedia.org/w/api.php?action=query&prop=images&titles=${q}&format=json&imlimit=50&redirects=1`;
            let data = await httpsGet(urlEn);
            if (data && data.query && data.query.pages) {
                let pages = data.query.pages;
                let pageId = Object.keys(pages)[0];
                if (pageId !== '-1' && pages[pageId].images) {
                    for (const image of pages[pageId].images) {
                        if (isValidImage(image.title)) {
                            const imgQ = encodeURIComponent(image.title);
                            const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=imageinfo&titles=${imgQ}&iiprop=url&format=json`;
                            let imgData = await httpsGet(imgUrl);
                            if (imgData && imgData.query && imgData.query.pages) {
                                let imgPages = imgData.query.pages;
                                let imgPageId = Object.keys(imgPages)[0];
                                if (imgPageId !== '-1' && imgPages[imgPageId].imageinfo) {
                                    img = imgPages[imgPageId].imageinfo[0].url;
                                    break;
                                }
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
    console.log('Done refetching Wikipedia images (without coats of arms).');
}

run();
