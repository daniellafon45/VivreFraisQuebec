const fs = require('fs');
const https = require('https');

const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 VivreFrais/1.0'
    }
};

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    console.error('HTTP', res.statusCode, 'on', url);
                    return resolve(null);
                }
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    console.error('PARSE ERR on', url, 'data:', data.substring(0, 50));
                    resolve(null);
                }
            });
        }).on('error', err => {
            console.error('HTTP ERR', err);
            resolve(null);
        });
    });
}

function isValidImage(title) {
    const t = title.toLowerCase();
    if (!t.endsWith('.jpg') && !t.endsWith('.jpeg')) return false;

    const badWords = [
        'blason', 'logo', 'drapeau', 'flag', 'map', 'carte',
        'armoiries', 'arms', 'icon', 'shield', 'location',
        'locator', 'symbole', 'graph', 'chart', 'mrc', 'province',
        'quebec_', 'canada_', 'couple', 'politique', 'maire', 'portrait', 'armoiries'
    ];
    for (const word of badWords) {
        if (t.includes(word)) return false;
    }
    return true;
}

async function fetchWikiImagesForTitle(title) {
    const url = `https://fr.wikipedia.org/w/api.php?action=query&prop=images&titles=${encodeURIComponent(title)}&format=json&imlimit=100&redirects=1`;
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

    let validImages = await fetchWikiImagesForTitle(qCity);

    if (validImages.length === 0) {
        validImages = await fetchWikiImagesForTitle(qCity + " (Québec)");
    }

    if (validImages.length === 0) {
        validImages = await fetchWikiImagesForTitle(qCity + " (ville)");
    }

    if (validImages.length === 0) return null;

    let selectedImageTitle = null;
    let bestScore = -1;
    for (const img of validImages) {
        const t = img.title.toLowerCase();
        let score = 0;
        if (t.includes('centre-ville') || t.includes('downtown')) score += 10;
        if (t.includes('panorama') || t.includes('vue') || t.includes('skyline')) score += 5;
        if (t.includes('montage')) score += 15;
        if (t.includes('hotel de ville') || t.includes('hotel_de_ville')) score -= 2;
        if (t.includes('mairie')) score -= 2;
        if (t.includes('eglise') || t.includes('église')) score -= 1;
        if (t.includes(cityName.toLowerCase())) score += 3;

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

    let changed = false;

    console.log(`Found ${updates.length} cities to process`);
    for (const item of updates) {
        // ALWAYS refetch if the current image is a coat of arms, flag, etc, OR if it's default generic
        const t = item.currentImg.toLowerCase();
        const isGeneric = t.includes('unsplash');
        const hasBadKeyword = t.includes('blason') || t.includes('logo') || t.endsWith('.svg') || t.endsWith('.png') || t.includes('carte') || t.includes('map') || t.includes('armoiries');

        if (!isGeneric && !hasBadKeyword) {
            continue; // Keep the legitimate photo
        }

        console.log(`Working on ${item.name}...`);
        await new Promise(r => setTimeout(r, 200)); // Delay to avoid rate limit
        let img = await getWikiImage(item.name);

        if (!img) {
            const urlsEn = [
                `https://en.wikipedia.org/w/api.php?action=query&prop=images&titles=${encodeURIComponent(item.name)}&format=json&imlimit=100&redirects=1`,
                `https://en.wikipedia.org/w/api.php?action=query&prop=images&titles=${encodeURIComponent(item.name + ", Quebec")}&format=json&imlimit=100&redirects=1`
            ];

            for (const urlEn of urlsEn) {
                let data = await httpsGet(urlEn);
                if (data && data.query && data.query.pages) {
                    let pages = data.query.pages;
                    let pageId = Object.keys(pages)[0];
                    if (pageId !== '-1' && pages[pageId].images) {
                        let validImages = pages[pageId].images.filter(image => isValidImage(image.title));
                        if (validImages.length > 0) {
                            const imgQ = encodeURIComponent(validImages[0].title);
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
            console.log(`[DEFAULT] Still no image found for ${item.name}`);
        } else {
            console.log(`[OK] ${item.name} -> ${img}`);
            const escName = item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`(name:\\s*['"]${escName}['"],\\s+imageUrl:\\s*)'[^']+'`, 'g');
            citiesTs = citiesTs.replace(re, `$1'${img}'`);
            changed = true;
        }
    }

    if (changed) {
        fs.writeFileSync('src/data/cities.ts', citiesTs);
        console.log('Saved changes.');
    } else {
        console.log('No changes needed.');
    }
}

run();
