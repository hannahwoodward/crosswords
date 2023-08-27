const fetch = require('node-fetch');
const fs = require('fs');
const PdfGenerator = require('hpdf').PdfGenerator;
const PuzCrossword = require('@confuzzle/puz-crossword').PuzCrossword;

const template = `
<html>
  <head>
    <meta charset="UTF-8">
    <title>{{ title }}</title>
    <style>
      /*!
       *  Hack typeface https://github.com/source-foundry/Hack
       *  License: https://github.com/source-foundry/Hack/blob/master/LICENSE.md
       */
      @font-face {
        font-family: 'Hack';
        src: url('https://cdn.jsdelivr.net/npm/hack-font@3.3.0/build/web/fonts/hack-regular.woff2?sha=3114f1256') format('woff2'), url('fonts/hack-regular.woff?sha=3114f1256') format('woff');
        font-weight: 400;
        font-style: normal;
      }

      @font-face {
        font-family: 'Hack';
        src: url('https://cdn.jsdelivr.net/npm/hack-font@3.3.0/build/web/fonts/hack-bold.woff2?sha=3114f1256') format('woff2'), url('fonts/hack-bold.woff?sha=3114f1256') format('woff');
        font-weight: 700;
        font-style: normal;
      }

      @font-face {
        font-family: 'Hack';
        src: url('https://cdn.jsdelivr.net/npm/hack-font@3.3.0/build/web/fonts/hack-italic.woff2?sha=3114f1256') format('woff2'), url('fonts/hack-italic.woff?sha=3114f1256') format('woff');
        font-weight: 400;
        font-style: italic;
      }

      @font-face {
        font-family: 'Hack';
        src: url('https://cdn.jsdelivr.net/npm/hack-font@3.3.0/build/web/fonts/hack-bolditalic.woff2?sha=3114f1256') format('woff2'), url('fonts/hack-bolditalic.woff?sha=3114f1256') format('woff');
        font-weight: 700;
        font-style: italic;
      }

      html {
        font-family: Hack, monospace, sans-serif;
        margin: 0;
        padding: 2cm;
      }

      h1, p {
        font-size: 7pt;
        font-weight: 400;
        line-height: 1.7;
      }

      h1 {
        margin: 0 0 4pt;
      }

      p {
        margin: 0;
      }

      h2 {
        font-size: 8pt;
        font-weight: 700;
        line-height: 1.625;
        margin: 10pt 0 1pt;
        text-transform: uppercase;
      }

      section {
        display: flex;
      }

      .clues {
        margin-right: 0.65cm;
        width: 12.5cm;
      }

      .grid {
        border-top: 2px solid #000;
        width: 12.05cm;
      }
      .grid__row {
        border-left: 2px solid;
        display: flex;
      }
      .grid__cell {
        aspect-ratio: 1 / 1;
        border-bottom: 2px solid;
        border-right: 2px solid;
        flex: 1;
        font-family: Arial, sans-serif;
        font-size: 6pt;
        padding: 1pt;
      }
      .grid__cell--fill {
        background-color: #000;
      }
    </style>
  </head>
  <body>
    <section>
      <div class="clues">
        <h1>{{ title }}</h1>
        <h2>Across</h2>
        <div>{{ cluesAcross }}</div>
        <h2>Down</h2>
        <div>{{ cluesDown }}</div>
      </div>

      {{ grid }}
    </section>
  </body>
</html>
`;

const configs = {
  help: (argv) => {
    console.log('Downloads and exports crosswords to pdf');
    console.log('Usage: node index.js <crosswordName> [, <crosswordArgs>]');
    console.log('Supported crossword names: `privateEye`');
  },
  privateEye: async (argv) => {
    if (argv.length < 1 || argv[0] === 'help') {
      console.log('Usage: node index.js privateEye crosswordNumMin crosswordNumMax');
      console.log('e.g. `node index.js privateEye 500 510`');
      return;
    }

    const fileMin = argv[0];
    const fileMax = argv[1] || argv[0];
    const urlBase = 'https://www.private-eye.co.uk/pictures/crossword/download';

    for (let n = fileMin; n <= fileMax; n++) {
      await puzToPdf(
        `${urlBase}/${n}.puz`,
        `./out/eye-${n}.pdf`,
        template,
        'Windows-1252'
      );
    }
  }
};

const args = process.argv.slice(2);
const config = args[0] && args[0] in configs ? args[0] : 'help';
configs[config](args.slice(1));


// ----- Functions -----
async function puzToPdf(url, file, template, encoding='UTF-8') {
  const puz = await fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed download of ${url} (${response.status})`)
      }

      return response.arrayBuffer();
    })
    .then(buffer => {
      if (encoding === 'UTF-8') {
        return buffer;
      }

      // Convert to normal dash to fix non-rendering of en dash
      const text = (new TextDecoder(encoding))
        .decode(buffer)
        .replaceAll('–', '-');

      const newBuffer = new ArrayBuffer(text.length);
      const newBufferView = new Uint8Array(newBuffer);
      for (let i = 0; i < text.length; i++) {
        newBufferView[i] = text.charCodeAt(i);
      }

      return newBuffer;
    })
    .then(buffer => PuzCrossword.from(buffer))
    .catch(err => console.warn(err));

  if (!puz) {
    return;
  }

  const cluesProcessed = puz.parsedClues.reduce((obj, c) => {
    const arrKey = c.isAcross ? 'htmlAcross': 'htmlDown';
    obj[arrKey].push(`<p>${c.number}. ${c.text}</p>`);
    obj['gridIndexes'][`${c.row},${c.col}`] = `${c.number}`;

    return obj;
  }, {
    'gridIndexes': {},
    'htmlAcross': [],
    'htmlDown': [],
  });

  const gridLayout = splitInto(puz.state, puz.width);
  let gridRows = [];
  for (let i = 0; i < gridLayout.length; i++) {
    const rowLayout = gridLayout[i].split('');
    const rowCells = []

    for (let j = 0; j < rowLayout.length; j++) {
      const cell = rowLayout[j];
      const cellClass = 'grid__cell' + (cell === '.' ? ' grid__cell--fill' : '');
      const clueLabel = cluesProcessed.gridIndexes[`${i},${j}`] || '';

      rowCells.push(`<div class="${cellClass}">${clueLabel}</div>`);
    }

    gridRows.push(`<div class="grid__row">${rowCells.join('')}</div>`);
  }

  const htmlGrid = `<div class="grid">${gridRows.join('')}</div>`;
  const html = template
    .replaceAll('{{ cluesAcross }}', cluesProcessed.htmlAcross.join(''))
    .replaceAll('{{ cluesDown }}', cluesProcessed.htmlDown.join(''))
    .replaceAll('{{ title }}', puz.title)
    .replaceAll('{{ grid }}', htmlGrid);

  const generator = new PdfGenerator({ min: 1, max: 2 });

  // https://pptr.dev/api/puppeteer.pdfoptions
  doc = await generator.generatePDF(
    html,
    undefined,
    {
      format: 'A4',
      landscape: true,
      printBackground: true
    }
  );
  await fs.promises.writeFile(file, doc);
  await generator.stop();
}

function splitInto(str, len) {
  const regex = new RegExp('.{' + len + '}|.{1,' + Number(len - 1) + '}', 'g');
  return str.match(regex);
}
