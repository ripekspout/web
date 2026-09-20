const fs = require('fs');
const path = require('path');
const assets = path.join(__dirname, '..', 'assets');
const variants = [
  ['natural', '#e5dac1', '#faf4e5', '#b8603a', '#5c5b4b', 'REPACK', 'made for', 'what’s inside.', 'CUSTOM SPOUT POUCH', '500 ml'],
  ['food', '#ad4930', '#d97850', '#3b3e28', '#fff1d6', 'THE PANTRY EDIT', 'slow', 'sauce.', 'GOOD THINGS TAKE TIME', '500 ml'],
  ['beauty', '#c1b3c9', '#e4d9e8', '#696053', '#3e3841', 'THE DAILY RITUAL', 'daily', 'goods.', 'A MOMENT FOR YOURSELF', '250 ml'],
  ['refill', '#727c50', '#a7b083', '#ded9bc', '#f6f0d9', 'EVERYDAY / AGAIN', 'refill.', 'repeat.', 'SOMETHING WORTH KEEPING', '1 L']
];
for (const [name, base, light, cap, ink, brand, line1, line2, note, volume] of variants) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="460" viewBox="0 0 360 460">
<defs><linearGradient id="film" x1="0" y1="0" x2="1" y2=".25"><stop stop-color="${base}"/><stop offset=".16" stop-color="${light}"/><stop offset=".44" stop-color="${base}"/><stop offset=".83" stop-color="${light}"/><stop offset="1" stop-color="${base}"/></linearGradient><linearGradient id="fold" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#222" stop-opacity=".2"/></linearGradient><filter id="shadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter></defs>
<ellipse cx="181" cy="423" rx="102" ry="12" fill="#24271f" opacity=".16" filter="url(#shadow)"/>
<path d="M110 90 L139 68 L269 68 Q278 68 279 83 L293 388 Q291 419 264 420 L98 420 Q73 417 74 390 L89 123 Z" fill="url(#film)" stroke="${base}" stroke-width="2"/>
<path d="M142 76 L268 76 M99 124 L87 388 Q90 407 112 407 L260 407 Q280 405 281 387 L270 91" fill="none" stroke="${ink}" opacity=".13" stroke-width="2"/>
<path d="M76 376 Q120 397 181 385 Q237 400 290 374 L288 401 Q279 422 258 420 L105 420 Q82 420 76 405Z" fill="url(#fold)"/>
<g transform="translate(97 101) rotate(-39)"><rect x="-14" y="-32" width="29" height="40" rx="4" fill="${cap}"/><rect x="-20" y="-54" width="41" height="34" rx="5" fill="${cap}" stroke="#24271f" stroke-opacity=".18"/><path d="M-15-49v23 M-9-49v23 M-3-49v23 M3-49v23 M9-49v23 M15-49v23" stroke="#fff" stroke-opacity=".2" stroke-width="2"/><path d="M-20-21h41" stroke="#24271f" stroke-opacity=".3" stroke-width="3"/></g>
<g fill="${ink}" text-anchor="middle"><text x="182" y="151" font-family="Arial,sans-serif" font-size="9" letter-spacing="2">${brand}</text><path d="M121 174h122" stroke="${ink}" stroke-opacity=".4"/><text x="182" y="239" font-family="Georgia,serif" font-size="46" letter-spacing="-2">${line1}</text><text x="182" y="286" font-family="Georgia,serif" font-size="40" letter-spacing="-2">${line2}</text><text x="182" y="336" font-family="Arial,sans-serif" font-size="7" letter-spacing="1.4">${note}</text><text x="182" y="371" font-family="Arial,sans-serif" font-size="10">${volume}</text></g></svg>`;
  fs.writeFileSync(path.join(assets, `pouch-${name}.svg`), svg);
}
const resources = path.join(assets, 'resources');
fs.mkdirSync(resources, { recursive: true });
const documents = {
  'packaging-brief.txt': `REPACK — SAMPLE PACKAGING BRIEF
Design preview / planning template, not an approved production specification.

CONTACT
Name:
Company:
Email:
Intended market:

PRODUCT
Product / formula:
Fill volume:
Target shelf life:
Storage conditions:
Filling process and temperature:
Product characteristics (pH, fat/oil content, viscosity):

PACKAGING
Target dimensions:
Spout location, diameter and closure:
Print finish and artwork requirements:
Material preferences:
Initial order quantity / repeat volume:
Sample kit required:
Target launch date:
Delivery destination:

TO CONFIRM WITH YOUR SUPPLIER
Compatibility tests, shelf-life validation, market-specific compliance,
approved artwork and dieline, complete-pack recycling assessment,
final price, minimum order, production and freight timing.

This preview does not submit or send enquiries.
`,
  'material-checklist.txt': `REPACK — MATERIAL DISCUSSION CHECKLIST
Sample planning resource. Not a material data sheet or certification.

1. PRODUCT REQUIREMENTS
Record pH, viscosity, oil/fat content, sensitivity to oxygen, moisture and light.
Define the target shelf life and intended storage conditions.

2. FILLING AND CLOSURE
Confirm fill method, temperature and any pasteurisation or retort process.
Confirm compatibility with filling equipment, spout and cap.
Ask for a documented testing plan for the complete filled package.

3. MATERIAL REVIEW
Request the exact layer structure, total thickness, barrier data and test conditions.
Ask for seal-strength and leak-test criteria.
Obtain current documents applicable to the product and destination market.

4. END OF LIFE
Assess the whole pack: film, closures, labels, inks and adhesives.
Confirm local collection, sorting and recycling routes before making claims.

5. RELEASE
Record approved samples, test results and signed-off specification revision.
No example structure on the website should be used as production approval.
`,
  'artwork-checklist.txt': `REPACK — SAMPLE ARTWORK CHECKLIST
Design planning only. This is not a production dieline.

BEFORE DESIGN
- Obtain the approved dieline for the exact pouch size and closure.
- Confirm safe areas, seal areas, bleed and registration tolerances with the printer.
- Ask for the printer's colour profile, file format and resolution requirements.

BRAND ASSETS
- Vector logo and licensed fonts.
- Colour references and any special finishes.
- High-resolution product images where required.
- Barcode and mandatory product copy for the intended market.

BEFORE APPROVAL
- Check legibility on a physical mockup.
- Confirm barcode scan quality, colour proof and finish locations.
- Keep critical text clear of folds, seals and spout areas.
- Approve the artwork revision and technical specification together.

Example artwork on the site is conceptual and is not print-ready.
`
};
for (const [name, content] of Object.entries(documents)) fs.writeFileSync(path.join(resources, name), content);
